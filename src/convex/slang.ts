import { api } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { SLANG_SEED, slangSlug } from "./slangSeed";
import { LANGUAGE_CODES, normalizeRegion, registerKey } from "./languages";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import type { GenericDatabaseReader } from "convex/server";

type LearningLanguage = "en" | "zh" | "es" | "ar" | "ru";
const entryTable = "slangExpressions" as const;

/* ── Anti-quota (R6) ──────────────────────────────────────────────────
   Toute lecture de slangExpressions passe par un index. Les scans de
   table complète sont remplacés par des lectures par-langue (index
   `by_language_popularity`) ; les filtres pays et la recherche par mot
   exploitent les colonnes dénormalisées indexées `regionKey` / `normExpr`
   (remplies par slang:seed, backfill idempotent inclus). */
const ALL_LANGS = [
  "en",
  "zh",
  "es",
  "ar",
  "ru",
  "sw",
  "ln",
  "ha",
  "yo",
  "zu",
  "wo",
  "fr",
] as const;
type AnyLang = (typeof ALL_LANGS)[number];

async function rowsForLanguages(
  db: GenericDatabaseReader<DataModel>,
  langs: readonly AnyLang[],
): Promise<Array<Doc<"slangExpressions">>> {
  const out: Array<Doc<"slangExpressions">> = [];
  for (const lang of langs) {
    const rows = await db
      .query("slangExpressions")
      .withIndex("by_language_popularity", (q) => q.eq("language", lang))
      .collect();
    out.push(...rows);
  }
  return out;
}

/* ── Fenêtres exactes (anti-quota R6) ─────────────────────────────────
   Lecture fenêtrée sur l'index `by_language_popularity` (ordre popularité
   décroissante). Une fenêtre n'est JAMAIS tronquée silencieusement :
   `truncated` signale que la partition peut contenir davantage de lignes,
   et les appelants grandissent la fenêtre tant que l'exactitude du
   résultat n'est pas prouvée. Pire cas = partition complète (identique à
   l'ancien comportement) ; cas typique = quelques dizaines de lignes. */

type LangWindow = {
  lang: AnyLang;
  rows: Array<Doc<typeof entryTable>>;
  /** true si la fenêtre a atteint sa taille avant la fin de la partition. */
  truncated: boolean;
};

async function popularityWindow(
  db: GenericDatabaseReader<DataModel>,
  lang: AnyLang,
  window: number,
): Promise<LangWindow> {
  const rows = await db
    .query(entryTable)
    .withIndex("by_language_popularity", (q) => q.eq("language", lang))
    .order("desc")
    .take(window);
  return { lang, rows, truncated: rows.length === window };
}

function windowRows(windows: readonly LangWindow[]): Array<Doc<typeof entryTable>> {
  return windows.flatMap((w) => w.rows);
}

/**
 * Le top-`limit` calculé sur les fenêtres est-il déjà exact ? Les lignes
 * non lues d'une fenêtre tronquée ont toutes une popularité ≤ à celle de
 * la dernière ligne lue de cette fenêtre. Si le `limit`-ième élément du
 * pool (trié popularité desc) dépasse toutes ces bornes, aucun candidat
 * manquant ne peut entrer dans le top — le résultat est prouvé exact.
 * `pool` DOIT être trié popularité décroissante.
 */
function needsBiggerWindow(
  windows: readonly LangWindow[],
  pool: readonly Doc<typeof entryTable>[],
  limit: number,
  /** Effectif du pool filtré PAR langue (assemblage rotation/focus). */
  poolByLang?: ReadonlyMap<string, number>,
): boolean {
  // (A) Pool insuffisant : toute fenêtre tronquée peut encore cacher des
  // candidats — il faut grandir (jamais de troncation silencieuse).
  if (pool.length < limit) {
    return windows.some((w) => w.truncated && w.rows.length > 0);
  }
  // (B) Top-`limit` global : les lignes non lues d'une fenêtre tronquée
  // ont une popularité ≤ dernière ligne lue ; si cette borne atteint le
  // seuil du limit-ème, un candidat manquant peut encore entrer au top.
  const threshold = pool[limit - 1].popularity;
  const globalCut =
    pool.length >= limit &&
    windows.some(
      (w) =>
        w.truncated &&
        w.rows.length > 0 &&
        w.rows[w.rows.length - 1].popularity >= threshold,
    );
  if (globalCut) return true;
  // (C) Assemblage rotation/focus : chaque langue peut contribuer jusqu'à
  // `limit` éléments (rotation jusqu'à épuisement, remplissage par focus).
  // Si une langue tronquée a moins de `limit` éléments examinés dans le
  // pool, ses lignes non lues peuvent entrer dans l'assemblage → grandir.
  if (poolByLang) {
    return windows.some(
      (w) =>
        w.truncated &&
        w.rows.length > 0 &&
        (poolByLang.get(w.lang) ?? 0) < limit,
    );
  }
  return false;
}

/** Taille initiale d'une fenêtre par langue (≥ 2× limit, plancher 60). */
function initialWindow(limit: number): number {
  return Math.max(limit * 2, 60);
}

/**
 * Ordre total identique à l'ancien tri : popularité desc, puis langue dans
 * l'ordre de lecture, puis création croissante. L'ancien code concaténait
 * les partitions (ordre index asc = création croissante à popularité égale)
 * puis triait de façon stable — ce comparateur reproduit exactement cet
 * ordre effectif, égalités de popularité comprises (parité bit-à-bit).
 */
function popSort(langs: readonly AnyLang[]) {
  const order = new Map<string, number>(langs.map((l, i) => [l as string, i]));
  return (
    a: Doc<typeof entryTable>,
    b: Doc<typeof entryTable>,
  ): number =>
    b.popularity - a.popularity ||
    (order.get(a.language) ?? 0) - (order.get(b.language) ?? 0) ||
    a._creationTime - b._creationTime;
}

/** Plafond de croissance : au-delà, la fenêtre couvre toute la base. */
const MAX_WINDOW = 10_000;

/** Case- and diacritic-insensitive key for word matching. */
function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const languageValidator = v.union(
  v.literal("en"),
  v.literal("zh"),
  v.literal("es"),
  v.literal("ar"),
  v.literal("ru"),
  v.literal("sw"),
  v.literal("ln"),
  v.literal("ha"),
  v.literal("yo"),
  v.literal("zu"),
  v.literal("wo"),
  v.literal("fr"),
);

/** The learning languages — "fr" is translation-target vocabulary only. */
const learningLanguageValidator = v.union(
  v.literal("en"),
  v.literal("zh"),
  v.literal("es"),
  v.literal("ar"),
  v.literal("ru"),
  v.literal("sw"),
  v.literal("ln"),
  v.literal("ha"),
  v.literal("yo"),
  v.literal("zu"),
  v.literal("wo"),
);

/**
 * Internal: all expressions for one language, used by the media pipeline to
 * flag subtitle lines containing known slang (no API needed — pure DB scan).
 */
export const allForLanguage = internalQuery({
  args: { language: languageValidator },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("slangExpressions")
      .withIndex("by_language_popularity", (q) =>
        q.eq("language", args.language),
      )
      .order("desc")
      .collect();
    // Projection explicite : le validateur `returns` est strict — les
    // colonnes internes (normExpr, regionKey…) ne doivent jamais fuir.
    // `slangId` : identité publique de la ligne, seule façon pour un appelant
    // interne (détection d'argot d'un texte collé) de proposer « + Ma
    // mémoire » en un clic — addToSrs exige l'id de l'expression.
    return rows.map((r) => ({
      slangId: r._id,
      expression: r.expression,
      meaning: r.meaning,
      context: r.context,
    }));
  },
  returns: v.array(
    v.object({
      slangId: v.id("slangExpressions"),
      expression: v.string(),
      meaning: v.string(),
      context: v.optional(v.string()),
    }),
  ),
});

const PUBLIC_FIELDS = {
  language: languageValidator,
  expression: v.string(),
  literal: v.optional(v.string()),
  meaning: v.string(),
  context: v.string(),
  register: v.string(),
  region: v.string(),
  popularity: v.number(),
  mediaRefs: v.optional(v.array(v.string())),
  meaningLang: v.optional(v.string()),
};

/**
 * Idempotent seed, safe to re-run at any time: dedupes by slug (unknown
 * expressions are inserted, existing ones get their copy refreshed only when
 * it drifted, and duplicates within the batch are skipped). Returns
 * per-action counts for verification.
 */
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("slangExpressions").collect();
    const bySlug = new Map<string, Id<"slangExpressions"> | "fresh">();
    for (const row of existing) {
      bySlug.set(slangSlug(row.language, row.expression), row._id);
    }
    // Backfill anti-quota : colonnes indexées dénormalisées (idempotent —
    // ne patche que les lignes pas encore à jour).
    for (const row of existing) {
      const normExpr = normKey(row.expression);
      const regionKey = normalizeRegion(row.region);
      if (row.normExpr !== normExpr || row.regionKey !== regionKey) {
        await ctx.db.patch(row._id, { normExpr, regionKey });
      }
    }
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    for (const item of SLANG_SEED) {
      const slug = slangSlug(item.language, item.expression);
      const found = bySlug.get(slug);
      if (found === "fresh") {
        // Duplicate within the seed batch itself — first occurrence wins.
        skipped += 1;
        continue;
      }
      if (found === undefined) {
        await ctx.db.insert("slangExpressions", {
          ...item,
          normExpr: normKey(item.expression),
          regionKey: normalizeRegion(item.region),
        });
        bySlug.set(slug, "fresh");
        inserted += 1;
        continue;
      }
      const row = await ctx.db.get(found);
      if (
        row &&
        (row.meaning !== item.meaning ||
          row.context !== item.context ||
          row.literal !== item.literal ||
          row.register !== item.register ||
          row.region !== item.region ||
          row.popularity !== item.popularity)
      ) {
        await ctx.db.patch(found, {
          literal: item.literal,
          meaning: item.meaning,
          context: item.context,
          register: item.register,
          region: item.region,
          popularity: item.popularity,
          normExpr: normKey(item.expression),
          regionKey: normalizeRegion(item.region),
          ...(item.mediaRefs ? { mediaRefs: item.mediaRefs } : {}),
        });
        updated += 1;
      } else {
        skipped += 1;
      }
    }
    // Agrégats pré-calculés : maintenus dans la même transaction que le
    // seed (idempotent) — les dashboards n'ont plus jamais à balayer la table.
    await ctx.runMutation(api.slang.recomputeAggregates, {});
    return { inserted, updated, skipped, total: inserted + updated + skipped };
  },
});

/**
 * Agrégats pré-calculés (anti-quota R6) : compte les expressions par
 * registre sur les 5 langues d'apprentissage (« fr » exclu — simple cible
 * de traduction) et synchronise la petite table `slangAggregates`.
 * Coût : un passage indexé par langue (~les partitions) UNE fois par
 * exécution, au lieu d'un scan par CHARGEMENT de dashboard côté client.
 * Idempotent : upsert des comptes, purge des registres disparus.
 */
export const recomputeAggregates = mutation({
  args: {},
  handler: async (ctx) => {
    const totals = new Map<string, number>();
    for (const lang of LANGUAGE_CODES) {
      const rows = await ctx.db
        .query("slangExpressions")
        .withIndex("by_language_popularity", (q) => q.eq("language", lang))
        .collect();
      for (const r of rows) {
        totals.set(r.register, (totals.get(r.register) ?? 0) + 1);
      }
    }
    const existing = await ctx.db
      .query("slangAggregates")
      .withIndex("by_key", (q) => q.gte("key", "register:").lt("key", "register;"))
      .collect();
    const liveKeys = new Set<string>();
    for (const [register, total] of totals) {
      const key = `register:${register}`;
      liveKeys.add(key);
      const found = existing.find((e) => e.key === key);
      if (found) {
        if (found.total !== total) await ctx.db.patch(found._id, { total });
      } else {
        await ctx.db.insert("slangAggregates", { key, total });
      }
    }
    for (const row of existing) {
      if (!liveKeys.has(row.key)) await ctx.db.delete(row._id);
    }
    return {
      registers: totals.size,
      total: [...totals.values()].reduce((a, b) => a + b, 0),
    };
  },
});

/** List expressions with optional language / register filters and a search string. */
export const list = query({
  args: {
    language: v.optional(languageValidator),
    register: v.optional(v.string()),
    country: v.optional(v.string()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    // Filtres communs aux deux chemins (registre normalisé : accepte les
    // ids actuels « urban… » comme les anciens « street… » ; pays = filtre
    // réel — Espagne ne renvoie AUCUNE expression US).
    const wantedRegister = args.register ? registerKey(args.register) : null;
    const applyFilters = (
      rows: Array<Doc<"slangExpressions">>,
    ): Array<Doc<"slangExpressions">> => {
      let filtered = rows;
      if (wantedRegister) {
        filtered = filtered.filter((r) => registerKey(r.register) === wantedRegister);
      }
      if (args.country) {
        filtered = filtered.filter((r) => normalizeRegion(r.region) === args.country);
      }
      if (args.search) {
        const s = args.search.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.expression.toLowerCase().includes(s) ||
            r.meaning.toLowerCase().includes(s) ||
            r.region.toLowerCase().includes(s),
        );
      }
      return filtered;
    };

    // Chemin pays : partitions (langue, regionKey) lues en entier — déjà
    // bornées et exactes (le tri popularity se fait après lecture).
    if (args.country) {
      const regionKey = normalizeRegion(args.country);
      const langs: readonly AnyLang[] = args.language
        ? [args.language]
        : ALL_LANGS;
      let rows: Array<Doc<"slangExpressions">> = [];
      for (const lang of langs) {
        const found = await ctx.db
          .query("slangExpressions")
          .withIndex("by_language_region", (q) =>
            q.eq("language", lang).eq("regionKey", regionKey),
          )
          .collect();
        rows.push(...found);
      }
      // Sécurité backfill : regionKey pas encore remplie ⇒ repli par-langue.
      if (rows.length === 0) rows = await rowsForLanguages(ctx.db, langs);
      const filtered = applyFilters(rows);
      filtered.sort((a, b) => b.popularity - a.popularity);
      return filtered.slice(0, limit).map(stripInternal);
    }

    // Chemin sans pays : fenêtres popularity-desc par langue + croissance
    // prouvée exacte (jamais de troncation silencieuse — pire cas = les
    // partitions complètes, comme avant ; cas typique = ~limit/langue).
    const want = Math.min(Math.max(limit, 1), 500);
    const langs: readonly AnyLang[] = args.language ? [args.language] : ALL_LANGS;
    // Départ minimal (want/langue) — croissance exacte au besoin.
    let window = want;
    for (;;) {
      const windows = await Promise.all(
        langs.map((lang) => popularityWindow(ctx.db, lang, window)),
      );
      const filtered = applyFilters(windowRows(windows));
      filtered.sort(popSort(langs));
      if (!needsBiggerWindow(windows, filtered, want) || window >= MAX_WINDOW) {
        return filtered.slice(0, want).map(stripInternal);
      }
      window = Math.min(window * 2, MAX_WINDOW);
    }
  },
  returns: v.array(
    v.object({
      _id: v.id("slangExpressions"),
      _creationTime: v.number(),
      ...PUBLIC_FIELDS,
    }),
  ),
});

/** Liste publique : les colonnes indexées internes restent en base. */
function stripInternal<T extends Doc<typeof entryTable>>(row: T) {
  const { normExpr: _normExpr, regionKey: _regionKey, ...pub } = row;
  return pub as Omit<T, "normExpr" | "regionKey">;
}

/**
 * Search the local base (normalized case/diacritic-insensitive), ranked by
 * match quality then popularity. `exact` restricts to full-expression
 * equality — used by word lookups, not by free-text search.
 */
export const searchLocal = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    exact: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const q = normKey(args.query);
    if (!q) return [];
    const limit = Math.min(Math.max(args.limit ?? 6, 1), 20);

    // 1) Chemin indexé (by_norm_expr) : correspondance exacte, puis préfixe.
    const best = new Map<
      Id<"slangExpressions">,
      { row: Doc<"slangExpressions">; score: number }
    >();
    const add = (row: Doc<"slangExpressions">, score: number) => {
      const prev = best.get(row._id);
      if (!prev || score > prev.score) best.set(row._id, { row, score });
    };
    const exactRows = await ctx.db
      .query("slangExpressions")
      .withIndex("by_norm_expr", (c) => c.eq("normExpr", q))
      .take(limit);
    for (const r of exactRows) add(r, 100);
    if (!args.exact && exactRows.length < limit) {
      const prefixRows = await ctx.db
        .query("slangExpressions")
        .withIndex("by_norm_expr", (c) =>
          c.gte("normExpr", q).lt("normExpr", `${q}\uffff`),
        )
        .take(limit);
      for (const r of prefixRows) add(r, 80);
    }
    // 2) Repli (sous-chaîne / sens) : seulement si l'index n'a pas fourni
    //    assez de candidats — les clics-mot (exact) ne scannent plus dès que
    //    le backfill normExpr a tourné (slang:seed).
    if (best.size < limit && (!args.exact || exactRows.length === 0)) {
      const rows = await rowsForLanguages(ctx.db, ALL_LANGS);
      for (const row of rows) {
        const expr = normKey(row.expression);
        if (expr === q) {
          add(row, 100);
        } else if (!args.exact) {
          if (expr.startsWith(q)) add(row, 80);
          else if (expr.includes(q)) add(row, 60);
          else if (normKey(row.meaning).includes(q)) add(row, 30);
        }
      }
    }
    const hits = [...best.values()];
    hits.sort(
      (a, b) => b.score - a.score || b.row.popularity - a.row.popularity,
    );
    return hits.slice(0, limit).map((h) => stripInternal(h.row));
  },
  returns: v.array(
    v.object({
      _id: v.id("slangExpressions"),
      _creationTime: v.number(),
      ...PUBLIC_FIELDS,
    }),
  ),
});

/**
 * Which of the given words exist in the local base? Returns normalized keys
 * so the client can compare with the same normalization.
 */
export const knownWords = query({
  args: { words: v.array(v.string()) },
  handler: async (ctx, args) => {
    const wanted = new Set(
      args.words
        .slice(0, 40)
        .map((w) => normKey(w))
        .filter((w) => w.length > 1),
    );
    if (wanted.size === 0) return [];
    // Une lecture indexée (by_norm_expr) par mot — pas de scan de table.
    const found = new Set<string>();
    for (const w of wanted) {
      const hit = await ctx.db
        .query("slangExpressions")
        .withIndex("by_norm_expr", (c) => c.eq("normExpr", w))
        .first();
      if (hit) found.add(w);
    }
    // Sécurité backfill : un seul repli par-langue si normExpr est vide.
    if (found.size === 0) {
      const rows = await rowsForLanguages(ctx.db, ALL_LANGS);
      for (const row of rows) {
        const key = normKey(row.expression);
        if (wanted.has(key)) found.add(key);
      }
    }
    return [...found];
  },
  returns: v.array(v.string()),
});

/** Discovery deck: unseen expressions for the signed-in user, in one language or mixed. */
export const discovery = query({
  args: {
    language: v.optional(languageValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const limit = args.limit ?? 15;

    const all = await rowsForLanguages(
      ctx.db,
      args.language ? [args.language] : ALL_LANGS,
    );

    // "fr" rows serve the translated-subtitles experience only — they are
    // never part of a learning deck.
    const unseen = all.filter(
      (e): e is typeof e & { language: "en" | "zh" | "es" | "ar" | "ru" } =>
        e.language !== "fr",
    );

    if (userId === null) {
      return unseen.slice(0, limit).map(stripInternal);
    }

    const seen = await ctx.db
      .query("srsCards")
      .withIndex("by_user_language", (q) => q.eq("userId", userId))
      .collect();
    const seenIds = new Set(seen.map((c) => c.slangId));
    const unseenUser = unseen.filter((e) => !seenIds.has(e._id));
    // interleave languages so a mixed deck rotates through the 5 languages
    unseen.sort((a, b) => b.popularity - a.popularity);
    const byLang = new Map<string, typeof unseen>();
    for (const e of unseen) {
      const arr = byLang.get(e.language) ?? [];
      arr.push(e);
      byLang.set(e.language, arr);
    }
    const mixed: typeof unseen = [];
    let added = true;
    while (mixed.length < Math.min(limit, unseenUser.length) && added) {
      added = false;
      for (const code of LANGUAGE_CODES) {
        const arr = byLang.get(code);
        if (arr && arr.length > 0) {
          mixed.push(arr.shift()!);
          added = true;
          if (mixed.length >= limit) break;
        }
      }
    }
    return mixed.length > 0
      ? mixed.map(stripInternal)
      : unseenUser.slice(0, limit).map(stripInternal);
  },
  returns: v.array(
    v.object({
      _id: v.id("slangExpressions"),
      _creationTime: v.number(),
      ...PUBLIC_FIELDS,
      language: learningLanguageValidator,
    }),
  ),
});

/**
 * Deck de découverte à variation réelle — les filtres sont RÉELS :
 * - language   : une seule langue, ou rien (mélange multilingue) ;
 * - country    : région normalisée (« es » ⇒ aucune expression US) ;
 * - register   : registre normalisé (urban / colloquial / unfiltered /
 *                trending, anciens ids acceptés) ;
 * - exclusion stricte : ids client (localStorage FIFO 300) + srsCards.
 */
export const discoveryDeck = query({
  args: {
    excludeIds: v.optional(v.array(v.id("slangExpressions"))),
    limit: v.optional(v.number()),
    language: v.optional(languageValidator),
    country: v.optional(v.string()),
    register: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const limit = Math.min(args.limit ?? 30, 80);
    const exclude = new Set<Id<"slangExpressions">>(args.excludeIds ?? []);

    // Données par-utilisateur (naturellement bornées) lues une seule fois.
    const seenCards =
      userId === null
        ? []
        : await ctx.db
            .query("srsCards")
            .withIndex("by_user_language", (q) => q.eq("userId", userId))
            .collect();
    const srsIds = new Set(seenCards.map((c) => c.slangId));

    const wantedRegister = args.register ? registerKey(args.register) : null;
    const country = args.country ? normalizeRegion(args.country) : null;

    const langs: readonly AnyLang[] = args.language
      ? [args.language]
      : [...LANGUAGE_CODES];

    // Fenêtres popularity-desc par langue, agrandies tant que l'exactitude
    // du top-`limit` n'est pas prouvée (needsBiggerWindow). Pire cas =
    // partitions complètes (ancien comportement) ; cas typique = une seule
    // passe de ~limit/langue. Le chemin « pays » lit déjà des partitions
    // (langue, regionKey) bornées : pas de fenêtrage nécessaire.
    let window = initialWindow(limit);
    for (;;) {
      let allRaw: Array<Doc<"slangExpressions">>;
      let windows: LangWindow[] | null = null;
      if (country) {
        allRaw = [];
        for (const lang of langs) {
          const rows = await ctx.db
            .query("slangExpressions")
            .withIndex("by_language_region", (q) =>
              q.eq("language", lang).eq("regionKey", country),
            )
            .collect();
          allRaw.push(...rows);
        }
        // Sécurité backfill : regionKey pas encore remplie ⇒ repli par-langue.
        if (allRaw.length === 0) allRaw = await rowsForLanguages(ctx.db, langs);
      } else {
        windows = await Promise.all(
          langs.map((lang) => popularityWindow(ctx.db, lang, window)),
        );
        allRaw = windowRows(windows);
      }

      const all = allRaw.filter(
        (e): e is typeof e & { language: LearningLanguage } =>
          e.language !== "fr" && !exclude.has(e._id),
      );

      // Filtres réels appliqués AVANT tout échantillonnage : le pays ne
      // "priorise" pas, il exclut. Espagne sélectionnée ⇒ zéro résultat US.
      let pool0 = all;
      if (args.language) {
        pool0 = pool0.filter((e) => e.language === args.language);
      }
      if (country) {
        pool0 = pool0.filter((e) => normalizeRegion(e.region) === country);
      }
      if (wantedRegister) {
        pool0 = pool0.filter((e) => registerKey(e.register) === wantedRegister);
      }

      // Pool personnel (hors cartes SRS), trié popularité décroissante —
      // sert au contrôle d'exactitude ET à l'assemblage du deck.
      const pool = pool0
        .filter((e) => !srsIds.has(e._id))
        .sort(popSort(langs));

      // Effectifs par langue du pool filtré : condition d'exactitude (C)
      // pour l'assemblage rotation/focus (chaque langue peut contribuer
      // jusqu'à `limit` éléments).
      const poolByLang = new Map<string, number>();
      for (const e of pool) {
        poolByLang.set(e.language, (poolByLang.get(e.language) ?? 0) + 1);
      }

      const exact =
        windows === null ||
        !needsBiggerWindow(windows, pool, limit, poolByLang) ||
        window >= MAX_WINDOW;
      if (!exact) {
        window = Math.min(window * 2, MAX_WINDOW);
        continue;
      }

      const pub = (rows: Array<Doc<typeof entryTable>>) =>
        rows.slice(0, limit).map(stripInternal);

      if (userId === null) {
        return pub(pool);
      }

      // Une langue précise (et/ou pays/registre) : pas de mélange — le
      // filtre doit dominer, trié par popularité.
      if (args.language || country || wantedRegister) {
        return pub(pool);
      }

      // Sans filtre : focus utilisateur (langues actives) d'abord, mélange ensuite.
      const langRows = await ctx.db
        .query("userLanguages")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const focus = new Set(
        langRows.filter((r) => r.active).map((r) => r.language),
      );

      const focusPool = pool.filter((e) => focus.has(e.language));
      const otherPool = pool.filter((e) => !focus.has(e.language));

      const focusShare = Math.min(focusPool.length, Math.ceil(limit * 0.7));
      const out: Array<Doc<typeof entryTable>> = [
        ...focusPool.slice(0, focusShare),
      ];
      // Rotation équitable entre les langues du groupe "autres".
      const restByLang = new Map<string, typeof otherPool>();
      for (const e of otherPool) {
        const arr = restByLang.get(e.language) ?? [];
        arr.push(e);
        restByLang.set(e.language, arr);
      }
      let added = true;
      while (out.length < limit && added) {
        added = false;
        for (const code of LANGUAGE_CODES) {
          const arr = restByLang.get(code);
          if (arr && arr.length > 0) {
            out.push(arr.shift()!);
            added = true;
            if (out.length >= limit) break;
          }
        }
      }
      // Complète avec le focus si les autres langues sont épuisées.
      for (const e of focusPool.slice(focusShare)) {
        if (out.length >= limit) break;
        out.push(e);
      }
      return pub(out);
    }
  },
});

/** Trending: top popularity overall. */
export const trending = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Anti-quota : top-k global = union des top-k par langue (index
    // popularité desc) + croissance exacte : une égalité de popularité à
    // cheval sur la frontière d'une fenêtre tronquée déclenche la
    // croissance (needsBiggerWindow) — le groupe de ties est alors entier
    // et popSort tranque exactement comme l'ancien tri stable.
    const k = Math.min(Math.max(args.limit ?? 10, 1), 50);
    // Départ minimal (k/langue) : la croissance prouvée (clauses A/B)
    // agrandit la fenêtre uniquement si une égalité de popularité à
    // cheval sur une frontière l'exige — cas typique : 5×k lectures.
    let window = k;
    for (;;) {
      const windows = await Promise.all(
        LANGUAGE_CODES.map((lang) => popularityWindow(ctx.db, lang, window)),
      );
      const rows = windowRows(windows)
        .filter(
          (r): r is typeof r & { language: LearningLanguage } =>
            r.language !== "fr",
        )
        .sort(popSort(LANGUAGE_CODES));
      if (!needsBiggerWindow(windows, rows, k) || window >= MAX_WINDOW) {
        return rows.slice(0, k).map(stripInternal);
      }
      window = Math.min(window * 2, MAX_WINDOW);
    }
  },
  returns: v.array(
    v.object({
      _id: v.id("slangExpressions"),
      _creationTime: v.number(),
      ...PUBLIC_FIELDS,
      language: learningLanguageValidator,
    }),
  ),
});

/** Database stats for the landing page. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const rows = await rowsForLanguages(ctx.db, ALL_LANGS);
    const byLanguage: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byLanguage[r.language] = (byLanguage[r.language] ?? 0) + 1;
      total += 1;
    }
    return { total, byLanguage };
  },
  returns: v.object({
    total: v.number(),
    byLanguage: v.record(v.string(), v.number()),
  }),
});

/* ── Backfill one-shot meaningLang (lot UX v2, A1) ──────────────────── */

/**
 * Marque les entrées importées d'Urban Dictionary (language "en" +
 * register "internet" + popularity 50 + meaningLang absent) avec
 * meaningLang "en". Idempotent : re-lancer ne fait rien de plus.
 * Index by_language disponible ; la clé de borne est le registre,
 * dénormalisé sur les cartes mais présent dans la table elle-même.
 */
export const backfillMeaningLang = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("slangExpressions")
      .withIndex("by_language", (q) => q.eq("language", "en"))
      .collect();
    let patched = 0;
    for (const row of rows) {
      if (row.meaningLang !== undefined) continue;
      if (row.register !== "internet" || row.popularity !== 50) continue;
      await ctx.db.patch(row._id, { meaningLang: "en" });
      patched += 1;
    }
    return { patched };
  },
});
