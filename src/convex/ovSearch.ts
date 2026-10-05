import { getAuthUserId } from "@convex-dev/auth/server";
import type { GenericActionCtx } from "convex/server";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, type Infer } from "convex/values";
import {
  contentKindValidator,
  decisionValidator,
  evaluateRights,
  rightsStatusValidator,
  type ContentKind,
  type RightsDecision,
} from "./ovRights";
import { CONNECTORS, connectorReady } from "./ovSources";
import { envReady } from "./ovEnv";
import { SPECS, specKeys } from "./connectors";
import { feedEpisodes } from "./connectors/podcasts";
import { feedHits } from "./connectors/rss";
import { seriesEpisodes as tvmazeEpisodes } from "./connectors/tvmaze";
import {
  freshnessScore,
  playability,
  type ConnectorSpec,
  type RawHit,
  type SearchOpts,
  type SortKey,
} from "./connectors/types";

/* ═══════════════════════════════════════════════════════════════════════
   KILINGO — CONTENT AGGREGATION ENGINE

   Une requête (ou l'ouverture d'un rayon) → tous les connecteurs
   compatibles, en parallèle. Chaque résultat est normalisé puis traversé
   par le Rights Engine avant d'atteindre l'interface : on ne propose
   jamais de lire ce qu'on n'a pas le droit de lire.

   Trois modes de lecture du catalogue :
     · `searchUniversal` — recherche par mots-clés ;
     · `browseLive`      — rayons : nouveautés / tendances, sans requête ;
     · `browse`          — relecture du catalogue déjà indexé (instantané).
   ═══════════════════════════════════════════════════════════════════════ */

export const contentDraftValidator = v.object({
  key: v.string(),
  source: v.string(),
  externalId: v.string(),
  kind: contentKindValidator,
  title: v.string(),
  creator: v.optional(v.string()),
  creatorKind: v.optional(v.string()),
  year: v.optional(v.number()),
  language: v.optional(v.string()),
  country: v.optional(v.string()),
  duration: v.optional(v.number()),
  genres: v.optional(v.array(v.string())),
  description: v.optional(v.string()),
  thumbnail: v.optional(v.string()),
  rating: v.optional(v.number()),
  externalUrl: v.string(),
  streamUrl: v.optional(v.string()),
  previewUrl: v.optional(v.string()),
  embedUrl: v.optional(v.string()),
  textUrl: v.optional(v.string()),
  body: v.optional(v.string()),
  rssUrl: v.optional(v.string()),
  mediaFormat: v.optional(v.string()),
  publishedAt: v.optional(v.number()),
  releaseDate: v.optional(v.number()),
  lastUpdatedAt: v.optional(v.number()),
  popularity: v.optional(v.number()),
  freshness: v.optional(v.number()),
  subtype: v.optional(v.string()),
  rightsStatus: rightsStatusValidator,
  licenseCode: v.optional(v.string()),
  licenseName: v.optional(v.string()),
  attribution: v.optional(v.string()),
  attributionRequired: v.boolean(),
  territory: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
  commercialUseAllowed: v.boolean(),
  fullStreamAllowed: v.boolean(),
  downloadAllowed: v.boolean(),
  hostingAllowed: v.boolean(),
  translationAllowed: v.boolean(),
  derivativeWorkAllowed: v.boolean(),
  decision: decisionValidator,
});

export type ContentDraft = Infer<typeof contentDraftValidator>;

/** Applique le Rights Engine à un résultat brut de connecteur. */
export function makeDraft(hit: RawHit, now = Date.now()): ContentDraft {
  const decision: RightsDecision = evaluateRights({
    rightsStatus: hit.rightsStatus,
    license: hit.license ?? null,
    // Un texte (Gutenberg, article CC, corps récupéré) est un fichier
    // redistribuable au même titre qu'un flux : sans cela, les contenus
    // lisibles resteraient bloqués en « source officielle ».
    hostable: Boolean(hit.streamUrl || hit.textUrl || hit.body),
    embeddable: Boolean(hit.embedUrl),
    previewable: Boolean(hit.previewUrl),
    officialFeed: Boolean(hit.officialFeed),
    commercialIntent: true,
    territory: "WORLD",
  });

  const publishedAt = hit.publishedAt ?? hit.releaseDate;

  return {
    key: `${hit.source}:${hit.externalId}`,
    source: hit.source,
    externalId: hit.externalId,
    kind: hit.kind,
    title: hit.title.slice(0, 400),
    creator: hit.creator?.slice(0, 240),
    creatorKind: hit.creatorKind,
    year: hit.year,
    language: hit.language,
    country: hit.country,
    duration: hit.duration,
    genres: hit.genres?.slice(0, 8),
    description: hit.description?.slice(0, 900),
    thumbnail: hit.thumbnail,
    rating: hit.rating,
    externalUrl: hit.externalUrl,
    // Aucune URL de fichier n'est conservée quand le moteur la bloque.
    streamUrl: decision.canStream ? hit.streamUrl : undefined,
    previewUrl: decision.canPreview ? hit.previewUrl : undefined,
    embedUrl: decision.canEmbed ? hit.embedUrl : undefined,
    textUrl: decision.canStream ? hit.textUrl : undefined,
    body: decision.canStream ? hit.body : undefined,
    rssUrl: hit.rssUrl,
    mediaFormat: hit.mediaFormat,
    publishedAt: hit.publishedAt,
    releaseDate: hit.releaseDate,
    lastUpdatedAt: hit.lastUpdatedAt,
    popularity: hit.popularity,
    freshness: freshnessScore(publishedAt, now),
    subtype: hit.subtype,
    rightsStatus: hit.rightsStatus,
    licenseCode: hit.license?.code,
    licenseName: hit.license?.name,
    attribution: hit.attribution,
    attributionRequired: hit.license?.attributionRequired ?? true,
    territory: "WORLD",
    expiresAt: undefined,
    commercialUseAllowed: decision.commercialUseAllowed,
    fullStreamAllowed: decision.canStream,
    downloadAllowed: decision.canDownload,
    hostingAllowed: decision.canHost,
    translationAllowed: decision.canTranslate,
    derivativeWorkAllowed: decision.canDerive,
    decision,
  };
}

/* ── Routage : quels connecteurs pour quel type de contenu ? ────────── */

function readySpecs(kind: ContentKind | null): Array<[string, ConnectorSpec]> {
  const out: Array<[string, ConnectorSpec]> = [];
  for (const key of specKeys()) {
    const meta = CONNECTORS.find((c) => c.key === key);
    if (!meta || !meta.implemented) continue;
    if (!envReady(meta.requiresEnv)) continue;
    const spec = SPECS[key];
    if (!spec) continue;
    if (kind && !spec.kinds.includes(kind)) continue;
    out.push([key, spec]);
  }
  return out;
}

/* Les sources officielles récentes (extraits et aperçus publiés) passent
   devant les sources libres : catalogue réel d'abord, domain public ensuite. */
function catalogBoost(item: ContentDraft): number {
  if (item.previewUrl || (item.embedUrl && !item.streamUrl && !item.textUrl)) return 120;
  return 0;
}

const SOURCE_WEIGHT: Record<string, number> = {
  deezer: 32,
  google_books: 30,
  internet_archive: 28,
  gutendex: 26,
  open_library: 24,
  librivox: 23,
  youtube: 24,
  podcasts: 23,
  itunes: 26,
  jamendo: 20,
  audius: 18,
  dailymotion: 24,
  prelinger: 20,
  wikinews: 21,
  wikipedia: 20,
  radio: 18,
  tvmaze: 18,
  wikimedia_commons: 16,
  musicbrainz: 10,
};

function relevance(item: ContentDraft, q: string, wanted: ContentKind | null): number {
  const t = item.title.toLowerCase();
  const needle = q.toLowerCase();
  let score = SOURCE_WEIGHT[item.source] ?? 10;
  // Catalogue réel (extrait/aperçu officiel) devant le tout-venant.
  score += catalogBoost(item);
  if (t === needle) score += 100;
  else if (t.startsWith(needle)) score += 60;
  else if (t.includes(needle)) score += 40;
  if (item.creator?.toLowerCase().includes(needle)) score += 15;
  if (item.description?.toLowerCase().includes(needle)) score += 5;
  if (wanted) score += item.kind === wanted ? 35 : -12;

  // « Puis-je le lire ici ? » : ce qui est lisible passe devant une fiche.
  const playable = Boolean(item.streamUrl || item.textUrl || item.body || item.previewUrl || item.embedUrl);
  if (item.rightsStatus === "PUBLIC_DOMAIN") score += 45;
  else if (item.rightsStatus === "CC_ALLOWED") score += 25;
  else if (item.rightsStatus === "EMBED_ALLOWED" || item.rightsStatus === "RIGHTS_GRANTED") score += 15;
  else if (item.rightsStatus === "UNKNOWN" || item.rightsStatus === "RESTRICTED") score -= 35;
  if (playable && (item.rightsStatus === "PUBLIC_DOMAIN" || item.rightsStatus === "CC_ALLOWED")) score += 10;
  return score;
}

/** Tri par fraîcheur ou popularité — les deux axes des rayons. */
function rankBySort(items: ContentDraft[], sort: SortKey): ContentDraft[] {
  const sorted = [...items];
  if (sort === "new") {
    sorted.sort((a, b) => (b.publishedAt ?? b.releaseDate ?? 0) - (a.publishedAt ?? a.releaseDate ?? 0));
  } else if (sort === "popular" || sort === "trending") {
    sorted.sort((a, b) => {
      const playDiff = playabilityScore(b) - playabilityScore(a);
      if (playDiff !== 0) return playDiff;
      return (b.popularity ?? 0) - (a.popularity ?? 0);
    });
  }
  return sorted;
}

function playabilityScore(item: ContentDraft): number {
  let score = 0;
  if (item.streamUrl) score += 3;
  if (item.textUrl || item.body) score += 3;
  if (item.previewUrl) score += 2;
  if (item.embedUrl) score += 1;
  return score;
}

/**
 * Alterne les sources : un rayon ne doit pas être monopolisé par un seul
 * connecteur très bavard (Internet Archive, par exemple).
 */
function interleave(groups: ContentDraft[][], limit: number): ContentDraft[] {
  const out: ContentDraft[] = [];
  const seen = new Set<string>();
  const seenTitles = new Set<string>();
  let index = 0;
  while (out.length < limit) {
    let added = false;
    for (const group of groups) {
      const item = group[index];
      if (!item) continue;
      added = true;
      const titleKey = `${item.title.toLowerCase().slice(0, 60)}|${(item.creator ?? "").toLowerCase().slice(0, 40)}`;
      if (seen.has(item.key) || seenTitles.has(titleKey)) continue;
      seen.add(item.key);
      seenTitles.add(titleKey);
      out.push(item);
      if (out.length >= limit) break;
    }
    if (!added) break;
    index += 1;
  }
  return out;
}

/* ── Mémorisation des réponses des sources (30 minutes) ───────────────
   Une requête coûteuse (des centaines de résultats demandés à Deezer,
   iTunes, YouTube…) n'est payée qu'une fois : la réponse est gardée
   côté base et resservie instantanément pendant 30 minutes. Les quotas
   des sources sont protégés, et l'utilisateur attend beaucoup moins. */

const CACHE_TTL_MS = 30 * 60 * 1000;

/** borne douce : 20 Ko par connecteur, 300 Ko au total. */
const MAX_CACHE_PAYLOAD_BYTES = 20_000;

function cacheKeyFor(mode: "search" | "browse", query: string, kinds: string, rest: string): string {
  return `${mode}|${query.toLowerCase()}|${kinds}|${rest}`;
}

async function readCache(ctx: GenericActionCtx<any>, cacheKey: string): Promise<unknown[] | null> {
  const cached = await ctx.runQuery(internal.ovSearch.cacheGet, { cacheKey });
  if (!cached) return null;
  try {
    return JSON.parse(cached) as RawHit[];
  } catch {
    return null;
  }
}

async function writeCache(ctx: GenericActionCtx<any>, cacheKey: string, hits: readonly unknown[]): Promise<void> {
  try {
    let payload = "";
    for (const hit of hits) {
      const chunk = JSON.stringify(hit) + "\n";
      if (payload.length + chunk.length > MAX_CACHE_PAYLOAD_BYTES) break;
      payload += chunk;
    }
    if (!payload) return;
    await ctx.runMutation(internal.ovSearch.cachePut, {
      cacheKey,
      payload: payload.split("\n").filter(Boolean),
    });
  } catch {
    // Une écriture de cache qui échoue ne doit jamais faire échouer la recherche.
  }
}

export const cacheGet = internalQuery({
  args: { cacheKey: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("ovSourceCache")
      .withIndex("by_key", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    if (!row) return null;
    // Expiré = transparent : on renvoie null, la prochaine écriture
    // écrasera la valeur périmée (une requête ne modifie jamais la base).
    if (Date.now() - row.createdAt > CACHE_TTL_MS) return null;
    return row.payload.join("\n");
  },
});

export const cachePut = internalMutation({
  args: { cacheKey: v.string(), payload: v.array(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ovSourceCache")
      .withIndex("by_key", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { payload: args.payload, createdAt: Date.now() });
      return;
    }
    await ctx.db.insert("ovSourceCache", {
      cacheKey: args.cacheKey,
      payload: args.payload,
      createdAt: Date.now(),
    });
  },
});

/** Fusionne les résultats de connecteurs et les normalise en brouillons. */
function toDrafts(hits: RawHit[], now = Date.now()): ContentDraft[] {
  const out: ContentDraft[] = [];
  for (const hit of hits) {
    if (!hit.title || !hit.externalUrl) continue;
    out.push(makeDraft(hit, now));
  }
  return out;
}

/* ── Recherche universelle ──────────────────────────────────────────── */

export const searchUniversal = action({
  args: {
    query: v.string(),
    kind: v.optional(contentKindValidator),
    lang: v.optional(v.string()),
    country: v.optional(v.string()),
    sort: v.optional(
      v.union(v.literal("new"), v.literal("popular"), v.literal("trending"), v.literal("relevant")),
    ),
    /** Ne garder que les contenus publiés après ce timestamp (epoch ms). */
    newerThan: v.optional(v.number()),
    limit: v.optional(v.number()),
    /** false = contourner la mémoire des sources (test, fraîcheur). */
    cache: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const q = args.query.trim().replace(/\s+/g, " ");
    const limit = Math.min(Math.max(args.limit ?? 24, 6), 400);
    if (q.length < 2) {
      return { query: q, items: [] as ContentDraft[], sources: [] as string[], failures: [], truncated: false, totalRaw: 0 };
    }

    const userId = await getAuthUserId(ctx);
    if (userId) {
      // Protection anti-abus : 30 recherches par minute et par compte.
      const recent = await ctx.runQuery(internal.ovSearch.recentSearchCount, { userId });
      if (recent > 30) {
        throw new Error("Trop de recherches en peu de temps. Réessaie dans une minute.");
      }
    }

    // Volume massif : un rayon (type précisé) demande des centaines de
    // résultats ; chaque connecteur en ramène autant qu'il peut.
    const perSourceRows = args.kind ? 120 : 80;
    const targets = readySpecs(args.kind ?? null).filter(([, spec]) => spec.search);

    const cacheKey = cacheKeyFor(
      "search",
      q,
      args.kind ?? "",
      `${args.sort ?? "relevant"}|${args.lang ?? ""}|${args.country ?? ""}|${args.newerThan ?? ""}`,
    );
    const cached = args.cache === false ? null : ((await readCache(ctx, cacheKey)) as ContentDraft[] | null);
    let failures: { source: string; error: string }[] = [];
    let groups: ContentDraft[][] = [];
    let totalRaw = 0;
    if (cached?.length) {
      groups = [cached];
      totalRaw = cached.length;
    } else {
      const settled = await Promise.allSettled(
        targets.map(async ([key, spec]) => ({
          key,
          hits: await spec.search(q, {
            kind: args.kind ?? null,
            rows: perSourceRows,
            lang: args.lang,
            country: args.country,
            sort: args.sort,
          }),
        })),
      );
      settled.forEach((res, i) => {
        if (res.status === "fulfilled") {
          const drafts = toDrafts(res.value.hits);
          totalRaw += drafts.length;
          groups.push(drafts);
        } else {
          failures.push({
            source: targets[i][0],
            error: String((res.reason as Error)?.message ?? res.reason),
          });
        }
      });
      // Réponse mémorisée une fois : les recherches suivantes du quart
      // d'heure (et des 30 minutes) sont instantanées et sans coût source.
      if (args.cache !== false && totalRaw >= 30) {
        void writeCache(ctx, cacheKey, groups.flat().slice(0, 400));
      }
    }

    const wanted = args.kind ?? null;
    const sort = args.sort ?? "relevant";
    // Filtre « Nouveautés » : on ne garde que le frais demandé (12 mois).
    // Doit précéder `flattened` — sinon le filtre est ignoré par le tri.
    if (args.newerThan !== undefined) {
      groups.forEach((group, i) => {
        groups[i] = group.filter((d) => (d.publishedAt ?? d.releaseDate ?? 0) >= args.newerThan!);
      });
    }
    const flattened = groups.flat();
    let items =
      sort === "relevant"
        ? flattened.sort((a, b) => relevance(b, q, wanted) - relevance(a, q, wanted))
        : rankBySort(flattened, sort);

    // Dédoublonnage par titre/auteur (les mêmes œuvres vivent dans
    // plusieurs sources) puis alternance des sources pour la variété.
    const deduped: ContentDraft[][] = [];
    const perSource = new Map<string, ContentDraft[]>();
    const seenTitles = new Set<string>();
    for (const item of items) {
      const titleKey = `${item.title.toLowerCase().slice(0, 64)}|${(item.creator ?? "").toLowerCase().slice(0, 40)}`;
      if (seenTitles.has(titleKey)) continue;
      seenTitles.add(titleKey);
      const list = perSource.get(item.source) ?? [];
      list.push(item);
      perSource.set(item.source, list);
    }
    deduped.push(...perSource.values());
    items = sort === "relevant" ? interleave(deduped, limit) : items.slice(0, limit);

    if (items.length || failures.length) {
      await ctx.runMutation(internal.ovSearch.ingest, {
        query: q,
        userId: userId ?? undefined,
        items,
        failures,
        count: true,
      });
    }      return { query: q, items, sources: targets.map(([key]) => key), failures, truncated: totalRaw > items.length, totalRaw };
  },
});

/* ── Rayons : nouveautés & tendances, sans requête ──────────────────── */

export const browseLive = action({
  args: {
    kinds: v.optional(v.array(contentKindValidator)),
    sort: v.optional(
      v.union(v.literal("new"), v.literal("popular"), v.literal("trending"), v.literal("relevant")),
    ),
    /** Filtre « Nouveautés » du rayon : ne garder que le frais (< 12 mois). */
    newerThan: v.optional(v.number()),
    lang: v.optional(v.string()),
    country: v.optional(v.string()),
    limit: v.optional(v.number()),
    /** false = contourner la mémoire des sources. */
    cache: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const kinds = args.kinds?.length ? args.kinds : null;
    const sort: SortKey = args.sort ?? "new";
    const limit = Math.min(Math.max(args.limit ?? 24, 6), 60);

    const cacheKey = cacheKeyFor(
      "browse",
      "",
      (args.kinds ?? []).join(","),
      `${sort}|${args.country ?? ""}|${args.lang ?? ""}|${args.newerThan ?? ""}`,
    );
    const cached = args.cache === false ? null : ((await readCache(ctx, cacheKey)) as ContentDraft[] | null);
    let failures: { source: string; error: string }[] = [];
    let groups: ContentDraft[][] = [];
    let sources: string[] = [];
    if (cached?.length) {
      groups = [cached];
    } else {
      const targets: Array<[string, ConnectorSpec, ContentKind]> = [];
      for (const kind of kinds ?? []) {
        for (const [key, spec] of readySpecs(kind)) {
          if (!spec.discover) continue;
          if (targets.some(([k]) => k === key)) continue;
          targets.push([key, spec, kind]);
        }
      }
      if (!kinds) {
        for (const [key, spec] of readySpecs(null)) {
          if (spec.discover) targets.push([key, spec, "movie"]);
        }
      }
      sources = targets.map(([key]) => key);

      const settled = await Promise.allSettled(
        targets.map(async ([key, spec, kind]) => ({
          key,
          hits: await spec.discover!({
            kind,
            rows: kinds && kinds.length === 1 ? 120 : 48,
            lang: args.lang,
            country: args.country,
            sort,
          }),
        })),
      );

      settled.forEach((res, i) => {
        if (res.status === "fulfilled") groups.push(rankBySort(toDrafts(res.value.hits), sort));
        else
          failures.push({
            source: targets[i][0],
            error: String((res.reason as Error)?.message ?? res.reason),
          });
      });
      // Réponse mémorisée : les réouvertures du rayon dans la demi-heure
      // sont instantanées et n'appellent plus les sources.
      if (args.cache !== false && groups.flat().length >= 20) {
        void writeCache(ctx, cacheKey, groups.flat().slice(0, 400));
      }
    }

    if (args.newerThan !== undefined) {
      groups.forEach((group, i) => {
        groups[i] = group.filter((d) => (d.publishedAt ?? d.releaseDate ?? 0) >= args.newerThan!);
      });
    }

    const items = interleave(groups, limit);

    if (items.length || failures.length) {
      const userId = await getAuthUserId(ctx);
      await ctx.runMutation(internal.ovSearch.ingest, {
        query: `rayon:${(kinds ?? ["all"]).join(",")}`,
        userId: userId ?? undefined,
        items,
        failures,
        // Un rayon ne doit pas gonfler la popularité des contenus.
        count: false,
      });
    }

    return {
      items,
      sources,
      failures,
    };
  },
});

/* ── Catalogue déjà indexé (lecture instantanée) ────────────────────── */

export const browse = query({
  args: {
    kind: v.optional(contentKindValidator),
    kindIn: v.optional(v.array(contentKindValidator)),
    source: v.optional(v.string()),
    country: v.optional(v.string()),
    language: v.optional(v.string()),
    sort: v.optional(
      v.union(v.literal("new"), v.literal("popular"), v.literal("trending"), v.literal("relevant")),
    ),
    newerThan: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 24, 1), 60);
    const sort = args.sort ?? "new";

    if (sort === "new") {
      const keep = (row: { kind: string; source: string; country?: string; language?: string; publishedAt?: number }) => {
        if (args.kindIn?.length && !args.kindIn.includes(row.kind as ContentKind)) return false;
        if (args.source && row.source !== args.source) return false;
        if (args.country && row.country !== args.country.toUpperCase()) return false;
        if (args.language && row.language !== args.language) return false;
        if (args.newerThan !== undefined && (!row.publishedAt || row.publishedAt < args.newerThan)) return false;
        return true;
      };

      if (args.kind) {
        const rows = await ctx.db
          .query("ovContents")
          .withIndex("by_kind_published", (q) => q.eq("kind", args.kind!))
          .order("desc")
          .take(limit * 3);
        return rows.filter((r) => r.publishedAt && keep(r)).slice(0, limit);
      }
      const rows = await ctx.db.query("ovContents").withIndex("by_published").order("desc").take(limit * 4);
      return rows.filter((r) => r.publishedAt && keep(r)).slice(0, limit);
    }

    const base = args.kind
      ? await ctx.db
          .query("ovContents")
          .withIndex("by_kind_seen", (q) => q.eq("kind", args.kind!))
          .order("desc")
          .take(limit * 3)
      : await ctx.db.query("ovContents").withIndex("by_seen").order("desc").take(limit * 3);

    const filtered = base.filter((row) => {
      if (args.kindIn?.length && !args.kindIn.includes(row.kind as ContentKind)) return false;
      if (args.source && row.source !== args.source) return false;
      if (args.country && row.country !== args.country.toUpperCase()) return false;
      if (args.language && row.language !== args.language) return false;
      return true;
    });
    return filtered.sort((a, b) => (b.searchCount ?? 0) - (a.searchCount ?? 0)).slice(0, limit);
  },
});

/** Facettes des rayons : ce que le catalogue contient réellement. */
export const facets = query({
  args: {},
  handler: async (ctx) => {
    // Borné volontairement : les facettes décrivent le catalogue récent,
    // elles ne déclenchent jamais un balayage complet de la base.
    const rows = await ctx.db.query("ovContents").withIndex("by_seen").order("desc").take(500);

    const kinds = new Map<string, number>();
    const languages = new Map<string, number>();
    const countries = new Map<string, number>();
    const sources = new Map<string, number>();
    let newest: number | undefined;
    let playable = 0;

    for (const row of rows) {
      kinds.set(row.kind, (kinds.get(row.kind) ?? 0) + 1);
      if (row.language) languages.set(row.language, (languages.get(row.language) ?? 0) + 1);
      if (row.country) countries.set(row.country, (countries.get(row.country) ?? 0) + 1);
      sources.set(row.source, (sources.get(row.source) ?? 0) + 1);
      if (row.publishedAt && (!newest || row.publishedAt > newest)) newest = row.publishedAt;
      if (row.hostingAllowed || row.fullStreamAllowed || row.body || row.embedUrl) playable += 1;
    }

    const sorted = (map: Map<string, number>) =>
      [...map.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));

    return {
      total: rows.length,
      playable,
      newest,
      kinds: sorted(kinds),
      languages: sorted(languages).slice(0, 12),
      countries: sorted(countries).slice(0, 12),
      sources: sorted(sources).slice(0, 16),
    };
  },
});

/* ── Expansion : épisodes d'une série, d'un podcast, d'un flux ──────── */

const feedMetaValidator = v.object({
  title: v.optional(v.string()),
  author: v.optional(v.string()),
  image: v.optional(v.string()),
  description: v.optional(v.string()),
});

/** Épisodes d'une série (TVmaze) — la fiche reste interne. */
export const listSeriesEpisodes = action({
  args: { showId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const meta = CONNECTORS.find((c) => c.key === "tvmaze");
    if (!meta?.implemented || !envReady(meta.requiresEnv)) {
      return { items: [] as ContentDraft[], meta: {} };
    }
    const hits = await tvmazeEpisodes(args.showId, Math.min(args.limit ?? 40, 60));
    const items = toDrafts(hits);
    if (items.length) {
      const userId = await getAuthUserId(ctx);
      await ctx.runMutation(internal.ovSearch.ingest, {
        query: `serie:${args.showId}`,
        userId: userId ?? undefined,
        items,
        failures: [],
        count: false,
      });
    }
    return { items, meta: {} };
  },
});

/** Épisodes d'un podcast ou d'un flux RSS quelconque. */
export const listFeedItems = action({
  args: { feedUrl: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const url = args.feedUrl.trim();
    if (!/^https?:\/\//i.test(url)) throw new Error("URL de flux invalide.");
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 40);

    // Un podcast connu passe par son connecteur, tout le reste par le
    // connecteur RSS générique : même normalisation, même Rights Engine.
    const isPodcast = /podcast|anchor\.fm|megaphone|simplecast|buzzsprout|podbean|acast|libsyn/i.test(url);
    const raw = isPodcast ? await feedEpisodes(url, "podcasts", limit) : null;
    const feed = raw ?? (await feedEpisodes(url, "rss", limit));
    const hits: RawHit[] = feed.episodes;

    const items = toDrafts(hits);
    if (items.length) {
      const userId = await getAuthUserId(ctx);
      await ctx.runMutation(internal.ovSearch.ingest, {
        query: `flux:${url.slice(0, 120)}`,
        userId: userId ?? undefined,
        items,
        failures: [],
        count: false,
      });
    }
    return {
      items,
      meta: {
        title: feed.title,
        author: feed.author,
        image: feed.image,
        description: feed.description,
      },
    };
  },
});

/**
 * Normalise un flux collé par l'utilisateur (bouton « Ajouter un flux ») et
 * l'indexe : les éléments obtenus sont ensuite consultables comme n'importe
 * quel contenu (favoris, historique, reprise de lecture).
 */
export const previewFeed = action({
  args: { feedUrl: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const url = args.feedUrl.trim();
    if (!/^https?:\/\//i.test(url)) throw new Error("URL de flux invalide.");
    const hits = await feedHits(url, Math.min(args.limit ?? 12, 30));
    const items = toDrafts(hits);
    if (items.length) {
      const userId = await getAuthUserId(ctx);
      await ctx.runMutation(internal.ovSearch.ingest, {
        query: `flux:${url.slice(0, 120)}`,
        userId: userId ?? undefined,
        items,
        failures: [],
        count: false,
      });
    }
    return items;
  },
});

/* ── Lectures unitaires ─────────────────────────────────────────────── */

export const getContents = query({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, args) => {
    const out = [];
    for (const key of args.keys.slice(0, 60)) {
      const doc = await ctx.db.query("ovContents").withIndex("by_key", (q) => q.eq("key", key)).unique();
      if (doc) out.push(doc);
    }
    return out;
  },
});

export const getContent = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("ovContents").withIndex("by_key", (q) => q.eq("key", args.key)).unique();
  },
});

/** Suggestions de recherche : historique récent + titres déjà indexés. */
export const suggest = query({
  args: { q: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const needle = args.q.trim();
    const titles: string[] = [];

    if (needle.length >= 2) {
      // L'index est sensible à la casse : on interroge aussi les formes
      // capitalisée et majuscule pour que « sher » trouve « Sherlock ».
      const variants = [needle, needle.charAt(0).toUpperCase() + needle.slice(1), needle.toUpperCase()];
      for (const variant of [...new Set(variants)]) {
        const rows = await ctx.db
          .query("ovContents")
          .withIndex("by_title", (q) => q.gte("title", variant).lt("title", `${variant}\uffff`))
          .take(4);
        titles.push(...rows.map((r) => r.title));
      }
    }

    const recent = userId
      ? (
          await ctx.db
            .query("ovSearchHistory")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .take(12)
        ).map((r) => r.query)
      : [];

    return { recent: [...new Set(recent)].filter((r) => !r.startsWith("rayon:") && !r.startsWith("flux:") && !r.startsWith("serie:")).slice(0, 6), titles: [...new Set(titles)] };
  },
});

/** Contenus les plus consultés, par type (compatibilité historique). */
export const trending = query({
  args: { kind: v.optional(contentKindValidator), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 12, 40);
    if (args.kind) {
      const rows = await ctx.db
        .query("ovContents")
        .withIndex("by_kind_seen", (q) => q.eq("kind", args.kind!))
        .order("desc")
        .take(limit * 2);
      return rows
        .filter((r) => r.rightsStatus !== "UNKNOWN" || r.hostingAllowed)
        .sort((a, b) => (b.searchCount ?? 0) - (a.searchCount ?? 0))
        .slice(0, limit);
    }
    const rows = await ctx.db.query("ovContents").withIndex("by_seen").order("desc").take(limit * 2);
    return rows.sort((a, b) => (b.searchCount ?? 0) - (a.searchCount ?? 0)).slice(0, limit);
  },
});

/* ── Ingestion & anti-abus ──────────────────────────────────────────── */

export const recentSearchCount = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const since = Date.now() - 60_000;
    const rows = await ctx.db
      .query("ovSearchHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(60);
    return rows.filter((r) => r.createdAt >= since).length;
  },
});

export const ingest = internalMutation({
  args: {
    query: v.string(),
    userId: v.optional(v.id("users")),
    items: v.array(contentDraftValidator),
    failures: v.array(v.object({ source: v.string(), error: v.string() })),
    count: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const item of args.items) {
      const existing = await ctx.db
        .query("ovContents")
        .withIndex("by_key", (q) => q.eq("key", item.key))
        .unique();
      const doc = {
        source: item.source,
        externalId: item.externalId,
        kind: item.kind,
        title: item.title,
        creator: item.creator,
        creatorKind: item.creatorKind,
        year: item.year,
        language: item.language,
        country: item.country,
        duration: item.duration,
        genres: item.genres,
        description: item.description,
        thumbnail: item.thumbnail,
        rating: item.rating,
        externalUrl: item.externalUrl,
        streamUrl: item.streamUrl,
        previewUrl: item.previewUrl,
        embedUrl: item.embedUrl,
        textUrl: item.textUrl,
        body: item.body,
        rssUrl: item.rssUrl,
        mediaFormat: item.mediaFormat,
        publishedAt: item.publishedAt,
        releaseDate: item.releaseDate,
        lastUpdatedAt: item.lastUpdatedAt,
        popularity: item.popularity,
        freshness: item.freshness,
        subtype: item.subtype,
        rightsStatus: item.rightsStatus,
        licenseCode: item.licenseCode,
        licenseName: item.licenseName,
        attribution: item.attribution,
        attributionRequired: item.attributionRequired,
        territory: item.territory,
        expiresAt: item.expiresAt,
        commercialUseAllowed: item.commercialUseAllowed,
        fullStreamAllowed: item.fullStreamAllowed,
        downloadAllowed: item.downloadAllowed,
        hostingAllowed: item.hostingAllowed,
        translationAllowed: item.translationAllowed,
        derivativeWorkAllowed: item.derivativeWorkAllowed,
        decisionLabels: item.decision.reasons,
        lastSeenAt: now,
      };

      if (existing) {
        // Une revue humaine des droits prime sur la décision automatique.
        const humanReviewed = Boolean(existing.rightsReviewedBy);
        await ctx.db.patch(existing._id, {
          ...(humanReviewed
            ? { lastSeenAt: now, searchCount: (existing.searchCount ?? 0) + (args.count ? 1 : 0) }
            : doc),
          ...(humanReviewed ? {} : { rightsSource: "connector" }),
          ...(humanReviewed ? {} : { searchCount: (existing.searchCount ?? 0) + (args.count ? 1 : 0) }),
        });
      } else {
        await ctx.db.insert("ovContents", {
          key: item.key,
          ...doc,
          rightsSource: "connector",
          searchCount: args.count ? 1 : 0,
          createdAt: now,
        });
      }
    }

    if (args.userId) {
      await ctx.db.insert("ovSearchHistory", {
        userId: args.userId,
        query: args.query,
        resultCount: args.items.length,
        createdAt: now,
      });
      // Plafond R6 : 50 entrées d'historique par utilisateur maximum.
      const history = await ctx.db
        .query("ovSearchHistory")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(51);
      for (const row of history.slice(50)) {
        await ctx.db.delete(row._id);
      }
    }

    // Journal des sources en échec : un connecteur cassé doit se voir.
    for (const failure of args.failures.slice(0, 8)) {
      await ctx.db.insert("ovLogs", {
        level: "warn",
        scope: "connector",
        message: `${failure.source} : ${failure.error.slice(0, 300)}`,
        createdAt: now,
      });
    }
  },
});

/** Diagnostic : état du registre (admin). */
export const engineStatus = query({
  args: {},
  handler: async () => {
    const implemented = new Set(specKeys());
    return {
      implemented: [...implemented].sort(),
      ready: CONNECTORS.filter((c) => c.implemented && connectorReady(c)).map((c) => c.key).sort(),
      registered: CONNECTORS.length,
    };
  },
});
