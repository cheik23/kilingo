import { getAuthUserId } from "@convex-dev/auth/server";
import { action, mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { contentKindValidator } from "./ovRights";
import { contentDraftValidator, makeDraft } from "./ovSearch";
import { sleepPlaylist as fetchSleepPlaylist } from "./connectors/sleepAudio";

/* ═══════════════════════════════════════════════════════════════════════
   OPENVERSE MEDIA — BIBLIOTHÈQUE UTILISATEUR
   Favoris, historique et reprise de lecture, marque-pages, playlists,
   collections, préférences et recommandations.
   Aucune donnée personnelle superflue : uniquement des clés de contenu.
   ═══════════════════════════════════════════════════════════════════════ */

const KIND_LANGS = v.union(
  v.literal("fr"),
  v.literal("en"),
  v.literal("es"),
  v.literal("pt"),
  v.literal("it"),
  v.literal("de"),
  v.literal("ar"),
  v.literal("zh"),
  v.literal("ja"),
  v.literal("ko"),
  v.literal("ru"),
);

async function requireUser(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Connexion requise pour gérer ta bibliothèque.");
  return userId;
}

/** Métadonnées minimales recopiées dans la bibliothèque (dénormalisation). */
async function snapshot(ctx: MutationCtx, contentKey: string) {
  const content = await ctx.db
    .query("ovContents")
    .withIndex("by_key", (q) => q.eq("key", contentKey))
    .unique();
  if (!content) throw new Error("Contenu inconnu : effectue d'abord une recherche.");
  return {
    contentKey,
    kind: content.kind,
    title: content.title,
    creator: content.creator,
    thumbnail: content.thumbnail,
    externalUrl: content.externalUrl,
    rightsStatus: content.rightsStatus,
    hostingAllowed: content.hostingAllowed ?? false,
  };
}

/* ── Favoris ────────────────────────────────────────────────────────── */

export const toggleFavorite = mutation({
  args: { contentKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("ovFavorites")
      .withIndex("by_user_content", (q) => q.eq("userId", userId).eq("contentKey", args.contentKey))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { favorite: false as const };
    }
    const snap = await snapshot(ctx, args.contentKey);
    await ctx.db.insert("ovFavorites", { userId, ...snap, addedAt: Date.now() });
    return { favorite: true as const };
  },
});

/* ── Historique + reprise de lecture ────────────────────────────────── */

export const recordProgress = mutation({
  args: {
    contentKey: v.string(),
    position: v.number(),
    duration: v.optional(v.number()),
    completed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("ovHistory")
      .withIndex("by_user_content", (q) => q.eq("userId", userId).eq("contentKey", args.contentKey))
      .unique();
    const progress =
      args.duration && args.duration > 0
        ? Math.min(100, Math.round((args.position / args.duration) * 100))
        : args.completed
          ? 100
          : 0;
    const patch = {
      position: Math.max(0, Math.round(args.position)),
      duration: args.duration,
      progress,
      completed: args.completed ?? progress >= 95,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { updated: true as const };
    }
    const snap = await snapshot(ctx, args.contentKey);
    await ctx.db.insert("ovHistory", { userId, ...snap, ...patch, createdAt: Date.now() });
    return { updated: false as const };
  },
});

export const removeFromHistory = mutation({
  args: { contentKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("ovHistory")
      .withIndex("by_user_content", (q) => q.eq("userId", userId).eq("contentKey", args.contentKey))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return { removed: true as const };
  },
});

export const clearHistory = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db
      .query("ovHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(500);
    for (const row of rows) await ctx.db.delete(row._id);
    return { cleared: rows.length };
  },
});

/* ── Marque-pages (position de lecture précise) ─────────────────────── */

export const addBookmark = mutation({
  args: { contentKey: v.string(), label: v.string(), position: v.number(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const snap = await snapshot(ctx, args.contentKey);
    await ctx.db.insert("ovBookmarks", {
      userId,
      ...snap,
      label: args.label.slice(0, 160),
      position: Math.max(0, Math.round(args.position)),
      note: args.note?.slice(0, 400),
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});

export const removeBookmark = mutation({
  args: { id: v.id("ovBookmarks") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) throw new Error("Marque-page introuvable.");
    await ctx.db.delete(args.id);
    return { ok: true as const };
  },
});

/* ── Playlists & collections ────────────────────────────────────────── */

export const createPlaylist = mutation({
  args: {
    name: v.string(),
    kind: v.optional(v.union(v.literal("playlist"), v.literal("collection"))),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("ovPlaylists", {
      userId,
      name: args.name.slice(0, 120),
      kind: args.kind ?? "playlist",
      description: args.description?.slice(0, 400),
      items: [],
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  },
});

export const deletePlaylist = mutation({
  args: { id: v.id("ovPlaylists") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) throw new Error("Playlist introuvable.");
    await ctx.db.delete(args.id);
    return { ok: true as const };
  },
});

export const toggleInPlaylist = mutation({
  args: { id: v.id("ovPlaylists"), contentKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) throw new Error("Playlist introuvable.");
    const present = row.items.some((i) => i.contentKey === args.contentKey);
    if (present) {
      await ctx.db.patch(args.id, {
        items: row.items.filter((i) => i.contentKey !== args.contentKey),
        updatedAt: Date.now(),
      });
      return { added: false as const };
    }
    const snap = await snapshot(ctx, args.contentKey);
    await ctx.db.patch(args.id, {
      items: [...row.items, snap],
      updatedAt: Date.now(),
    });
    return { added: true as const };
  },
});

export const createCollection = mutation({
  args: { name: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const id = await ctx.db.insert("ovCollections", {
      userId,
      name: args.name.slice(0, 120),
      description: args.description?.slice(0, 400),
      contentKeys: [],
      createdAt: Date.now(),
    });
    return { id };
  },
});

export const toggleInCollection = mutation({
  args: { id: v.id("ovCollections"), contentKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) throw new Error("Collection introuvable.");
    const keys = row.contentKeys.includes(args.contentKey)
      ? row.contentKeys.filter((k) => k !== args.contentKey)
      : [...row.contentKeys, args.contentKey];
    await ctx.db.patch(args.id, { contentKeys: keys });
    return { added: keys.includes(args.contentKey) };
  },
});

/* ── Préférences ────────────────────────────────────────────────────── */

export const getPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const defaults = {
      uiLang: "fr",
      translationLang: "fr",
      subtitleLang: "fr",
      autoplay: false,
      dataSaver: true,
      safeSearch: true,
      preferLocalEngines: true,
    };
    if (!userId) return { ...defaults, stored: false };
    const row = await ctx.db
      .query("ovPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!row) return { ...defaults, stored: false };
    return {
      uiLang: row.uiLang ?? defaults.uiLang,
      translationLang: row.translationLang ?? defaults.translationLang,
      subtitleLang: row.subtitleLang ?? defaults.subtitleLang,
      autoplay: row.autoplay ?? defaults.autoplay,
      dataSaver: row.dataSaver ?? defaults.dataSaver,
      safeSearch: row.safeSearch ?? defaults.safeSearch,
      preferLocalEngines: row.preferLocalEngines ?? defaults.preferLocalEngines,
      stored: true,
    };
  },
});

export const setPreferences = mutation({
  args: {
    uiLang: v.optional(KIND_LANGS),
    translationLang: v.optional(KIND_LANGS),
    subtitleLang: v.optional(KIND_LANGS),
    autoplay: v.optional(v.boolean()),
    dataSaver: v.optional(v.boolean()),
    safeSearch: v.optional(v.boolean()),
    preferLocalEngines: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("ovPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const patch = { ...args, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, patch);
    else
      await ctx.db.insert("ovPreferences", {
        userId,
        uiLang: args.uiLang ?? "fr",
        translationLang: args.translationLang ?? "fr",
        subtitleLang: args.subtitleLang ?? "fr",
        autoplay: args.autoplay ?? false,
        dataSaver: args.dataSaver ?? true,
        safeSearch: args.safeSearch ?? true,
        preferLocalEngines: args.preferLocalEngines ?? true,
        updatedAt: Date.now(),
      });
    return { ok: true as const };
  },
});

/* ── Lectures ───────────────────────────────────────────────────────── */

/** Tout ce qu'il faut pour l'onglet « Ma bibliothèque ». */
export const myLibrary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const [favorites, history, bookmarks, playlists, collections, searches] = await Promise.all([
      ctx.db.query("ovFavorites").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(60),
      ctx.db.query("ovHistory").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(60),
      ctx.db.query("ovBookmarks").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(60),
      ctx.db.query("ovPlaylists").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(30),
      ctx.db.query("ovCollections").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(30),
      ctx.db.query("ovSearchHistory").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(20),
    ]);
    return { favorites, history, bookmarks, playlists, collections, searches };
  },
});

export const favoriteKeys = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [] as string[];
    const rows = await ctx.db
      .query("ovFavorites")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(300);
    return rows.map((r) => r.contentKey);
  },
});

export const clearSearchHistory = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const rows = await ctx.db
      .query("ovSearchHistory")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(300);
    for (const row of rows) await ctx.db.delete(row._id);
    return { cleared: rows.length };
  },
});

/**
 * Recommandations : recoupement genres / types / langues observés dans
 * les favoris et l'historique. Aucune donnée personnelle n'est utilisée.
 */
export const recommendations = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const limit = Math.min(args.limit ?? 12, 30);
    const pool = await ctx.db.query("ovContents").withIndex("by_seen").order("desc").take(300);
    if (!userId) {
      return pool
        .filter((c) => c.hostingAllowed || c.rightsStatus === "PUBLIC_DOMAIN" || c.rightsStatus === "CC_ALLOWED")
        .slice(0, limit)
        .map((c) => ({ ...c, score: c.searchCount ?? 0, reason: "populaire" as const }));
    }

    const [favorites, history] = await Promise.all([
      ctx.db.query("ovFavorites").withIndex("by_user", (q) => q.eq("userId", userId)).take(80),
      ctx.db.query("ovHistory").withIndex("by_user", (q) => q.eq("userId", userId)).take(80),
    ]);

    const seenKeys = new Set([...favorites, ...history].map((r) => r.contentKey));
    const kindWeight = new Map<string, number>();
    for (const row of [...favorites.map((f) => f.kind), ...history.map((h) => h.kind)]) {
      kindWeight.set(row, (kindWeight.get(row) ?? 0) + 1);
    }

    const preferredGenres = new Map<string, number>();
    for (const key of seenKeys) {
      const content = await ctx.db
        .query("ovContents")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      for (const genre of content?.genres ?? []) {
        preferredGenres.set(genre, (preferredGenres.get(genre) ?? 0) + 1);
      }
      if (content?.language) {
        preferredGenres.set(`lang:${content.language}`, (preferredGenres.get(`lang:${content.language}`) ?? 0) + 1);
      }
    }

    const scored = pool
      .filter((c) => !seenKeys.has(c.key))
      .map((c) => {
        let score = (c.searchCount ?? 0) * 0.5;
        score += (kindWeight.get(c.kind) ?? 0) * 4;
        for (const genre of c.genres ?? []) score += (preferredGenres.get(genre) ?? 0) * 6;
        if (c.language) score += (preferredGenres.get(`lang:${c.language}`) ?? 0) * 3;
        if (c.rightsStatus === "UNKNOWN" || c.rightsStatus === "RESTRICTED") score -= 25;
        return { ...c, score, reason: (kindWeight.get(c.kind) ? "habitudes" : "exploration") as "habitudes" | "exploration" };
      })
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
  },
});

/** Détail d'un contenu + état utilisateur, en une seule requête. */
export const contentState = query({
  args: { contentKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const content = await ctx.db
      .query("ovContents")
      .withIndex("by_key", (q) => q.eq("key", args.contentKey))
      .unique();
    if (!userId) {
      return { content, favorite: false, progress: null, bookmarks: [], playlists: [] };
    }
    const [favorite, progress, bookmarks, playlists] = await Promise.all([
      ctx.db
        .query("ovFavorites")
        .withIndex("by_user_content", (q) => q.eq("userId", userId).eq("contentKey", args.contentKey))
        .unique(),
      ctx.db
        .query("ovHistory")
        .withIndex("by_user_content", (q) => q.eq("userId", userId).eq("contentKey", args.contentKey))
        .unique(),
      ctx.db
        .query("ovBookmarks")
        .withIndex("by_user_content", (q) => q.eq("userId", userId).eq("contentKey", args.contentKey))
        .take(30),
      ctx.db.query("ovPlaylists").withIndex("by_user", (q) => q.eq("userId", userId)).take(30),
    ]);
    return {
      content,
      favorite: Boolean(favorite),
      progress,
      bookmarks,
      playlists: playlists.map((p) => ({
        id: p._id,
        name: p.name,
        kind: p.kind,
        contains: p.items.some((i) => i.contentKey === args.contentKey),
      })),
    };
  },
});

/* ── SleepShadow — playlist détente ─────────────────────────────────── */

/**
 * Playlist « détente » de SleepShadow : titres d'ambiance libres et
 * jouables (Jamendo, Audius, Internet Archive), mélangés par humeur.
 * Le Rights Engine s'applique exactement comme ailleurs — ici, seuls les
 * titres avec un flux public survivent de toute façon.
 */
export const sleepPlaylist = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 14, 4), 20);
    const hits = await fetchSleepPlaylist(limit);
    return hits.map((hit) => makeDraft(hit));
  },
});
