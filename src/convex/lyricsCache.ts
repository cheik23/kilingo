import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/* ═══════════════════════════════════════════════════════════════════════
   CACHE PAROLES (ovSourceCache) — TTL 24 h, clé « lyrics-tr:{id}:{lang} ».
   Module séparé de l'action (Node) : Convex n'accepte que des actions dans
   les fichiers "use node". TTL spécifique — ovSearch.cacheGet utilise 30 min.
   ═══════════════════════════════════════════════════════════════════════ */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Lecture du cache paroles (24 h, transparent : expiré ⇒ null). */
export const cacheGetLyrics = internalQuery({
  args: { cacheKey: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("ovSourceCache")
      .withIndex("by_key", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    if (!row) return null;
    if (Date.now() - row.createdAt > CACHE_TTL_MS) return null;
    return row.payload.join("\n");
  },
});

/** Écriture du cache paroles (upsert, jamais bloquante pour l'appelant). */
export const cachePutLyrics = internalMutation({
  args: { cacheKey: v.string(), payload: v.array(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ovSourceCache")
      .withIndex("by_key", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        payload: args.payload,
        createdAt: Date.now(),
      });
      return;
    }
    await ctx.db.insert("ovSourceCache", {
      cacheKey: args.cacheKey,
      payload: args.payload,
      createdAt: Date.now(),
    });
  },
});
