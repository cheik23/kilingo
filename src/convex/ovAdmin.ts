import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { rightsStatusValidator } from "./ovRights";

/* ═══════════════════════════════════════════════════════════════════════
   OPENVERSE MEDIA — ADMINISTRATION
   Contenus, sources, licences, droits, erreurs, utilisateurs, alertes.
   Réservé aux comptes dont le rôle est `admin`.
   ═══════════════════════════════════════════════════════════════════════ */

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Connexion requise.");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") {
    throw new Error("Accès réservé à l'administration.");
  }
  return userId;
}

export const amIAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { admin: false, claimable: false };
    const user = await ctx.db.get(userId);
    const admins = await ctx.db.query("users").take(200);
    return {
      admin: user?.role === "admin",
      claimable: !admins.some((u) => u.role === "admin"),
    };
  },
});

/** Amorçage : le premier compte connecté peut revendiquer l'administration. */
export const claimAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Connexion requise.");
    const users = await ctx.db.query("users").take(200);
    if (users.some((u) => u.role === "admin")) {
      throw new Error("Un administrateur existe déjà.");
    }
    await ctx.db.patch(userId, { role: "admin" });
    return { ok: true as const };
  },
});

export const setRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("user"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.userId, { role: args.role });
    return { ok: true as const };
  },
});

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [contents, sources, logs, users, transcriptions, favorites, history] = await Promise.all([
      ctx.db.query("ovContents").withIndex("by_seen").order("desc").take(600),
      ctx.db.query("ovSources").take(40),
      ctx.db.query("ovLogs").withIndex("by_created").order("desc").take(60),
      ctx.db.query("users").take(300),
      ctx.db.query("ovTranscriptions").order("desc").take(200),
      ctx.db.query("ovFavorites").order("desc").take(300),
      ctx.db.query("ovHistory").order("desc").take(300),
    ]);

    const byKind: Record<string, number> = {};
    const byRights: Record<string, number> = {};
    for (const c of contents) {
      byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
      byRights[c.rightsStatus] = (byRights[c.rightsStatus] ?? 0) + 1;
    }

    return {
      totals: {
        contents: contents.length,
        playable: contents.filter((c) => c.hostingAllowed || c.fullStreamAllowed).length,
        blocked: contents.filter((c) => c.rightsStatus === "UNKNOWN" || c.rightsStatus === "RESTRICTED").length,
        sources: sources.length,
        activeSources: sources.filter((s) => s.active).length,
        users: users.length,
        transcriptions: transcriptions.length,
        translations: transcriptions.filter((t) => t.status === "done").length,
        favorites: favorites.length,
        historyEntries: history.length,
      },
      byKind,
      byRights,
      sources,
      errors: logs.filter((l) => l.level === "error"),
      alerts: logs.filter((l) => l.level === "warn" && l.scope === "rights"),
      recentLogs: logs,
      blockedContents: contents
        .filter((c) => c.rightsStatus === "UNKNOWN" || c.rightsStatus === "RESTRICTED")
        .slice(0, 30)
        .map((c) => ({
          key: c.key,
          title: c.title,
          source: c.source,
          kind: c.kind,
          rightsStatus: c.rightsStatus,
          reviewed: Boolean(c.rightsReviewedBy),
          reason: c.blockedReason,
        })),
      topContents: contents
        .slice()
        .sort((a, b) => (b.searchCount ?? 0) - (a.searchCount ?? 0))
        .slice(0, 12),
    };
  },
});

export const listContents = query({
  args: {
    rights: v.optional(rightsStatusValidator),
    source: v.optional(v.string()),
    kind: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(args.limit ?? 50, 200);
    if (args.rights) {
      return await ctx.db
        .query("ovContents")
        .withIndex("by_rights", (q) => q.eq("rightsStatus", args.rights!))
        .order("desc")
        .take(limit);
    }
    if (args.source) {
      return await ctx.db
        .query("ovContents")
        .withIndex("by_source", (q) => q.eq("source", args.source!))
        .order("desc")
        .take(limit);
    }
    if (args.kind) {
      return await ctx.db
        .query("ovContents")
        .withIndex("by_kind", (q) => q.eq("kind", args.kind!))
        .order("desc")
        .take(limit);
    }
    return await ctx.db.query("ovContents").withIndex("by_seen").order("desc").take(limit);
  },
});

/**
 * Revue manuelle des droits : un administrateur qui a vérifié une licence
 * peut lever (ou durcir) le statut. La décision est tracée dans le registre
 * et la source n'écrasera plus ce contenu (verrou `rightsReviewedBy`).
 */
export const reviewRights = mutation({
  args: {
    contentKey: v.string(),
    rightsStatus: rightsStatusValidator,
    commercialUseAllowed: v.boolean(),
    fullStreamAllowed: v.boolean(),
    downloadAllowed: v.boolean(),
    hostingAllowed: v.boolean(),
    translationAllowed: v.boolean(),
    derivativeWorkAllowed: v.boolean(),
    /* Champs du modèle de droits demandés par le produit : une revue humaine
       peut préciser le territoire, la date d'expiration des droits et le
       caractère obligatoire de l'attribution. Sans valeur fournie, on ne
       modifie pas l'existant (aucune donnée inventée). */
    territory: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    attributionRequired: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const content = await ctx.db
      .query("ovContents")
      .withIndex("by_key", (q) => q.eq("key", args.contentKey))
      .unique();
    if (!content) throw new Error("Contenu introuvable.");
    const now = Date.now();
    await ctx.db.patch(content._id, {
      rightsStatus: args.rightsStatus,
      commercialUseAllowed: args.commercialUseAllowed,
      fullStreamAllowed: args.fullStreamAllowed,
      downloadAllowed: args.downloadAllowed,
      hostingAllowed: args.hostingAllowed,
      translationAllowed: args.translationAllowed,
      derivativeWorkAllowed: args.derivativeWorkAllowed,
      rightsSource: "admin",
      rightsReviewedBy: adminId,
      rightsReviewedAt: now,
      blockedReason: args.note,
      ...(args.territory !== undefined ? { territory: args.territory } : {}),
      ...(args.expiresAt !== undefined ? { expiresAt: args.expiresAt } : {}),
      ...(args.attributionRequired !== undefined
        ? { attributionRequired: args.attributionRequired }
        : {}),
    });
    await ctx.db.insert("ovRightsLedger", {
      contentKey: args.contentKey,
      source: content.source,
      rightsStatus: args.rightsStatus,
      mode: args.fullStreamAllowed ? "stream" : args.hostingAllowed ? "stream" : "external",
      reasons: [args.note ?? "Revue manuelle de l'administration"],
      actor: adminId,
      createdAt: now,
    });
    return { ok: true as const };
  },
});

/** Journalise un événement côté client (upload refusé, erreur lecteur…). */
export const logClientEvent = mutation({
  args: {
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    scope: v.string(),
    message: v.string(),
    meta: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    await ctx.db.insert("ovLogs", {
      level: args.level,
      scope: args.scope.slice(0, 40),
      message: args.message.slice(0, 500),
      meta: args.meta?.slice(0, 1000),
      userId: userId ?? undefined,
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});
