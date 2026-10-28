import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { SLANG_SEED, slangSlug } from "./slangSeed";
import { LANGUAGE_CODES, normalizeRegion, registerKey } from "./languages";
import type { LanguageCode } from "./languages";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import type { GenericDatabaseReader } from "convex/server";

/** Langue d'apprentissage = toute langue de `LANGUAGE_CODES`, plus `fr` qui
    n'est portée ici que comme vocabulaire cible de traduction. */
type AnyLang = LanguageCode | "fr";
type LearningLanguage = Exclude<AnyLang, "fr">;
const entryTable = "slangExpressions" as const;

/* ── Anti-quota (R6) ──────────────────────────────────────────────────
   Toute lecture de slangExpressions passe par un index. Les scans de
   table complète sont remplacés par des lectures par-langue (index
   `by_language_popularity`) ; les filtres pays et la recherche par mot
   exploitent les colonnes dénormalisées indexées `regionKey` / `normExpr`
   (remplies par slang:seed, backfill idempotent inclus).

   ⚠ Cette liste n'est PAS la liste des langues déclarées, mais celle des
   langues qui portent RÉELLEMENT du contenu : elle est dérivée du seed, avec
   `fr` en plus (vocabulaire cible). Depuis le Lot 4, TOUTES les langues
   déclarées portent du contenu : cette liste couvre donc désormais
   l'intégralité de `LANGUAGE_CODES` + `fr`. Elle reste DÉRIVÉE du seed pour
   la raison d'origine — ajouter une langue vide ne doit pas multiplier des
   lectures d'index sans résultat, ni élargir le budget de lecture des
   fonctions Convex pour rien.
   Le seul écrivain hors seed (`dynamicMemory`) écrit toujours `en`. */
const SEEDED_LANGS = new Set<string>(SLANG_SEED.map((entry) => entry.language));
// Vérification d'intégrité au démarrage (dev only) : le seed doit couvrir
// toutes les langues de contenu que le front attend (build `vite.config.ts`).
// Escapée en try/catch pour les backends qui ne supportent pas import.meta.
try {
  if (import.meta.env && import.meta.env.DEV) {
    const expected = new Set(["en","zh","es","ar","ru","sw","ln","ha","yo","zu","wo","de","pt","it","ko","ja","tr","pl","hi","bn","ur","id","th","vi","fa","tl","el","am","ig","fr"]);
    for (const code of expected) {
      if (!SEEDED_LANGS.has(code)) {
        console.warn(`[seed] langue attendue manquante dans SLANG_SEED : ${code}`);
      }
    }
  }
} catch (_) { /* import.meta non supporté par ce runtime — silently skip */ }
const ALL_LANGS: readonly AnyLang[] = [...LANGUAGE_CODES, "fr" as const].filter(
  (code) => SEEDED_LANGS.has(code),
);

/* La MÊME question (« cette langue a-t-elle du contenu ? ») se pose côté
   interface, pour les badges « Bientôt » : elle y est calculée AU BUILD sur
   le même seed (`vite.config.ts` → `data/contentLanguages`), et non par une
   requête — les fonctions Convex se déploient à la main, si bien qu'un badge
   dépendant d'une fonction non encore poussée aurait disparu en silence. */

/**
 * Clé dénormalisée du compteur global du catalogue, écrite par
 * `recomputeAggregates` et lue par `landingStats.getLandingNumbers`.
 * Préfixe « total: » — hors de la plage « register:…register; » que le
 * calcul des registres balaie, donc jamais purgé par erreur.
 */
export const CATALOG_TOTAL_KEY = "total:catalog";

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
  v.literal("de"),
  v.literal("hi"),
  v.literal("bn"),
  v.literal("pt"),
  v.literal("ur"),
  v.literal("id"),
  v.literal("ja"),
  v.literal("tr"),
  v.literal("ko"),
  v.literal("it"),
  v.literal("th"),
  v.literal("vi"),
  v.literal("am"),
  v.literal("ig"),
  v.literal("fa"),
  v.literal("tl"),
  v.literal("pl"),
  v.literal("el"),
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
  v.literal("de"),
  v.literal("hi"),
  v.literal("bn"),
  v.literal("pt"),
  v.literal("ur"),
  v.literal("id"),
  v.literal("ja"),
  v.literal("tr"),
  v.literal("ko"),
  v.literal("it"),
  v.literal("th"),
  v.literal("vi"),
  v.literal("am"),
  v.literal("ig"),
  v.literal("fa"),
  v.literal("tl"),
  v.literal("pl"),
  v.literal("el"),
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
  // Fiche à faire relire par un natif (`false`) — absente partout ailleurs.
  // Doit figurer ici : les `returns` de ces requêtes sont STRICTS, et
  // `stripInternal` laisse passer tout le reste de la ligne → sans cette
  // ligne, chaque requête publique échouerait à la validation.
  validated: v.optional(v.boolean()),
  // Contenu adulte (`true` seulement) — même contrainte que `validated` :
  // sans cette ligne dans la projection, l'avertissement ne pourrait pas
  // sortir du serveur du tout.
  isAdult: v.optional(v.boolean()),
};

/**
 * Plan de semis : les langues qui portent réellement du contenu, dérivées du
 * seed. C'est la SEULE liste dont le pilote (`scripts/seed-backend.mjs`) a
 * besoin — aucune liste parallèle à tenir à jour côté script.
 */
export const seedPlan = query({
  args: {},
  handler: async () => [...SEEDED_LANGS],
  returns: v.array(v.string()),
});

/**
 * Idempotent seed, safe to re-run at any time: dedupes by slug (unknown
 * expressions are inserted, existing ones get their copy refreshed only when
 * it drifted, and duplicates within the batch are skipped). Returns
 * per-action counts for verification.
 *
 * ── POURQUOI UNE LANGUE PAR EXÉCUTION ─────────────────────────────────
 * L'ancienne version lisait TOUT le catalogue en une transaction (un scan
 * pour dédupliquer, un second pour le backfill, un troisième pour les
 * agrégats). Convex plafonne à 4 096 lectures par exécution : le jour où le
 * catalogue a franchi ce seuil (~4 100 fiches), le seed s'est mis à échouer
 * — la limite était structurelle, pas accidentelle. Chaque exécution ne
 * touche donc plus qu'UNE partition de langue (`by_language`) et n'écrit que
 * ses fiches ; le pilote enchaîne les langues.
 *
 * Appelé SANS `language`, le seed échoue franchement (il ne sèmerait qu'une
 * partie du catalogue — un demi-semis silencieux est pire qu'une erreur).
 *
 * ── INTERNE DEPUIS P0.2 ──────────────────────────────────────────────
 * Cette mutation écrit le catalogue public : elle n'a AUCUN appelant dans
 * l'application (uniquement le pilote d'exploitation et les tests). Exposée
 * publiquement, elle laissait n'importe quel client HTTP — même anonyme —
 * insérer ou réécrire des fiches. Elle est donc `internalMutation` : le CLI
 * Convex authentifié par la clé admin du déploiement sait exécuter les
 * fonctions internes (`npx convex run internal.slang.seed …`), un client de
 * l'application non. Même chemin que `internal.crossSeed.seedCrossConcepts`.
 */
export const seed = internalMutation({
  args: { language: v.optional(languageValidator) },
  handler: async (ctx, args) => {
    const lang = args.language;
    if (!lang) {
      throw new Error(
        "slang:seed ne sème plus tout le catalogue en une seule exécution " +
          "(limite Convex de 4096 lectures par transaction). Appelle-le langue " +
          "par langue — npx convex run internal.slang.seed " +
          '\'{"language":"en"}\' — ou utilise le pilote : node scripts/seed-backend.mjs.',
      );
    }
    const batch = SLANG_SEED.filter((item) => item.language === lang);
    // Une seule lecture d'index : la partition de CETTE langue.
    const existing = await ctx.db
      .query("slangExpressions")
      .withIndex("by_language", (q) => q.eq("language", lang))
      .collect();
    const bySlug = new Map<string, Id<"slangExpressions">>();
    for (const row of existing) {
      bySlug.set(slangSlug(row.language, row.expression), row._id);
      // Backfill anti-quota : colonnes indexées dénormalisées (idempotent —
      // ne patche que les lignes pas encore à jour). Chaque langue étant
      // visitée une fois, le backfill reste complet sur tout le catalogue.
      const normExpr = normKey(row.expression);
      const regionKey = normalizeRegion(row.region);
      if (row.normExpr !== normExpr || row.regionKey !== regionKey) {
        await ctx.db.patch(row._id, { normExpr, regionKey });
      }
    }
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    for (const item of batch) {
      const slug = slangSlug(item.language, item.expression);
      const found = bySlug.get(slug);
      if (found === undefined) {
        const id = await ctx.db.insert("slangExpressions", {
          ...item,
          normExpr: normKey(item.expression),
          regionKey: normalizeRegion(item.region),
        });
        // La fiche vient d'être écrite : une seconde occurrence du même slug
        // dans le seed la retrouve ici et se contente de la comparer (même
        // règle qu'avant : la première occurrence gagne, les suivantes sont
        // comptées « skipped »).
        bySlug.set(slug, id);
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
          row.popularity !== item.popularity ||
          // Le drapeau « à faire relire » fait partie du contenu : le retirer
          // (retour à `undefined`) ou le poser doit rattraper les lignes
          // déjà en base au prochain seed, sans quoi une correction de
          // validation resterait invisible pour toujours. Idem pour
          // `isAdult` : un avertissement qu'on retire doit disparaître.
          row.validated !== item.validated ||
          row.isAdult !== item.isAdult)
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
          // `undefined` = non signalé (Convex retire alors le champ), ce qui
          // permet d'effacer un `false` devenu caduc. Toujours l'écrire ici :
          // sans ça, une fiche repassée en « non signalé » resterait marquée
          // `false` et serait re-patchée à chaque exécution du seed.
          validated: item.validated,
          isAdult: item.isAdult,
        });
        updated += 1;
      } else {
        skipped += 1;
      }
    }
    // Les agrégats ne sont PLUS recalculés ici : leur recalcul lit une
    // partition entière, ce qui doublait le coût de lecture de la
    // transaction. Le pilote appelle `recomputeAggregates` langue par langue
    // juste après (voir scripts/seed-backend.mjs).
    return {
      language: lang,
      inserted,
      updated,
      skipped,
      total: inserted + updated + skipped,
      seeded: batch.length,
    };
  },
});

/**
 * Agrégats pré-calculés (anti-quota R6), PAR LANGUE.
 *
 * Le recalcul global historique lisait tout le catalogue en une seule
 * transaction : passé ~2 600 fiches il frisait la limite, à ~4 100 il la
 * dépassait (4 096 lectures). Il est découpé en deux temps, tous deux bornés :
 *   1. la partition de la langue demandée (~300 lignes) → écrit
 *      `lang:<code>` (compteur de la langue, « fr » compris) et
 *      `langreg:<code>:<registre>` (ventilation par registre) ;
 *   2. un roll-up sur les SEULES petites lignes d'agrégats (~150 lignes) →
 *      réécrit les totaux globaux `register:<registre>` (lus par les
 *      dashboards) et `total:catalog` (lu par la landing).
 * Les totaux globaux sont donc exacts dès que chaque langue a été recalculée
 * une fois — c'est exactement ce que fait le pilote de semis.
 * Idempotent : upsert des comptes, purge des registres et langues disparus.
 *
 * INTERNE DEPUIS P0.2 : même raison que `seed` — écriture de maintenance,
 * aucun appelant dans l'application, exécution par le CLI Convex authentifié
 * (`npx convex run internal.slang.recomputeAggregates …`) ou par le pilote
 * `scripts/seed-backend.mjs`.
 */
export const recomputeAggregates = internalMutation({
  args: { language: languageValidator },
  handler: async (ctx, args) => {
    const lang = args.language;
    const rows = await ctx.db
      .query("slangExpressions")
      .withIndex("by_language", (q) => q.eq("language", lang))
      .collect();

    // 1. Compteur de la langue (toutes langues, « fr » compris) — lu par
    //    `slang:stats`.
    const langKey = `lang:${lang}`;
    const langRow = await ctx.db
      .query("slangAggregates")
      .withIndex("by_key", (q) => q.eq("key", langKey))
      .unique();
    if (rows.length === 0) {
      if (langRow) await ctx.db.delete(langRow._id);
    } else if (langRow) {
      if (langRow.total !== rows.length) {
        await ctx.db.patch(langRow._id, { total: rows.length });
      }
    } else {
      await ctx.db.insert("slangAggregates", { key: langKey, total: rows.length });
    }

    // 2. Ventilation par registre de CETTE langue. La clé porte le code de
    //    langue : c'est ce préfixe qui rend le recalcul possible une langue à
    //    la fois (et le roll-up possible depuis des lignes minuscules).
    const perRegister = new Map<string, number>();
    for (const r of rows) {
      perRegister.set(r.register, (perRegister.get(r.register) ?? 0) + 1);
    }
    const prefix = `langreg:${lang}:`;
    const slice = await ctx.db
      .query("slangAggregates")
      .withIndex("by_key", (q) => q.gte("key", prefix).lt("key", `langreg:${lang};`))
      .collect();
    const live = new Set<string>();
    for (const [register, total] of perRegister) {
      const key = `${prefix}${register}`;
      live.add(key);
      const found = slice.find((r) => r.key === key);
      if (found) {
        if (found.total !== total) await ctx.db.patch(found._id, { total });
      } else {
        await ctx.db.insert("slangAggregates", { key, total });
      }
    }
    for (const row of slice) {
      if (!live.has(row.key)) await ctx.db.delete(row._id);
    }

    // 3. Roll-up global. Plages disjointes par construction :
    //    « lang: » < « langreg: » < « lang; » < « register: » < « register; ».
    const langRows = await ctx.db
      .query("slangAggregates")
      .withIndex("by_key", (q) => q.gte("key", "lang:").lt("key", "lang;"))
      .collect();
    let grandTotal = 0;
    for (const r of langRows) grandTotal += r.total;

    const regRows = await ctx.db
      .query("slangAggregates")
      .withIndex("by_key", (q) => q.gte("key", "langreg:").lt("key", "langreg;"))
      .collect();
    const totals = new Map<string, number>();
    for (const r of regRows) {
      const parts = r.key.split(":");
      const code = parts[1];
      const register = parts[2];
      if (!code || !register) continue;
      // « fr » est du vocabulaire cible de traduction, pas une langue
      // d'apprentissage : il ne compte pas dans les totales par registre
      // (même règle qu'avant le découpage).
      if (code === "fr") continue;
      if (!(LANGUAGE_CODES as readonly string[]).includes(code)) continue;
      totals.set(register, (totals.get(register) ?? 0) + r.total);
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
    const totalRow = await ctx.db
      .query("slangAggregates")
      .withIndex("by_key", (q) => q.eq("key", CATALOG_TOTAL_KEY))
      .unique();
    if (totalRow) {
      if (totalRow.total !== grandTotal) {
        await ctx.db.patch(totalRow._id, { total: grandTotal });
      }
    } else {
      await ctx.db.insert("slangAggregates", { key: CATALOG_TOTAL_KEY, total: grandTotal });
    }
    return {
      language: lang,
      inLanguage: rows.length,
      registers: totals.size,
      total: [...totals.values()].reduce((a, b) => a + b, 0),
      catalogTotal: grandTotal,
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

/**
 * Database stats for the landing page. Lues sur les agrégats dénormalisés
 * (`lang:` ≈ une ligne par langue) et non plus en relisant le catalogue : à
 * 4 136 fiches, l'ancien scan dépassait la limite de lecture par exécution et
 * cette requête est appelée par QuizRoom / LastChanceModal à chaque écran.
 * Si une langue affiche 0 alors qu'elle a du contenu, c'est que
 * `recomputeAggregates` n'a pas encore été rejoué pour elle (le pilote de
 * semis s'en charge) — la mesure directe reste `recomputeAggregates`.
 */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("slangAggregates")
      .withIndex("by_key", (q) => q.gte("key", "lang:").lt("key", "lang;"))
      .collect();
    const byLanguage: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      const code = r.key.slice("lang:".length);
      byLanguage[code] = r.total;
      total += r.total;
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
