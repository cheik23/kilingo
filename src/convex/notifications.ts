import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const kindValidator = v.union(
  v.literal("streak"),
  v.literal("loot"),
  v.literal("record"),
  v.literal("achievement"),
);

const notificationValidator = v.object({
  _id: v.id("userNotifications"),
  kind: kindValidator,
  title: v.string(),
  body: v.string(),
  readAt: v.union(v.number(), v.null()),
  createdAt: v.number(),
});

/** Écriture interne partagée : conserve la transaction appelante. */
export async function insertNotification(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    kind: "streak" | "loot" | "record" | "achievement";
    title: string;
    body: string;
  },
): Promise<Id<"userNotifications">> {
  return ctx.db.insert("userNotifications", {
    userId: args.userId,
    kind: args.kind,
    title: args.title,
    body: args.body,
    readAt: null,
    createdAt: Date.now(),
  });
}

/** Point d'entrée interne : appelé uniquement depuis une fonction Convex. */
export const pushNotificationInternal = internalMutation({
  args: {
    userId: v.id("users"),
    kind: kindValidator,
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    return insertNotification(ctx, args);
  },
});

/** Rappel du streak : une seule notification par fenêtre de rappel. */
export const notifyStreak = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const since = Date.now() - RETENTION_MS;
    const existing = await ctx.db
      .query("userNotifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (existing.some((n) => n.kind === "streak" && n.createdAt >= since)) {
      return { ok: true, already: true };
    }
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const streak = stats?.currentStreak ?? 0;
    const title = "⚡ Ton streak expire bientôt";
    const body = `${streak} jours de suite te attendent. Une micro-session suffit pour le sauver.`;
    const id = await insertNotification(ctx, { userId, kind: "streak", title, body });
    return { ok: true, already: false, id };
  },
  returns: v.object({
    ok: v.boolean(),
    already: v.boolean(),
    id: v.optional(v.id("userNotifications")),
  }),
});

/** Liste limitée à sept jours ; les anciennes entrées sont_RETENTION ignorées. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const since = Date.now() - RETENTION_MS;
    const rows = await ctx.db
      .query("userNotifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    return rows
      .filter((n) => n.createdAt >= since)
      .map((n) => ({
        _id: n._id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        readAt: n.readAt ?? null,
        createdAt: n.createdAt,
      }));
  },
  returns: v.array(notificationValidator),
});

export const markRead = mutation({
  args: { notificationId: v.id("userNotifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const row = await ctx.db.get(args.notificationId);
    if (!row || row.userId !== userId) throw new Error("Notification introuvable");
    if (row.readAt == null) await ctx.db.patch(row._id, { readAt: Date.now() });
    return { ok: true };
  },
  returns: v.object({ ok: v.boolean() }),
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const rows = await ctx.db
      .query("userNotifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();
    let changed = 0;
    for (const row of rows) {
      if (row.readAt == null) {
        await ctx.db.patch(row._id, { readAt: now });
        changed += 1;
      }
    }
    return { ok: true, changed };
  },
  returns: v.object({ ok: v.boolean(), changed: v.number() }),
});
