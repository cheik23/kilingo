import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { spendGemsInternal } from "./gamification";
import { CUSTOMIZATION_DEFINITIONS } from "./customizationCatalog";

const DEFAULT_AVATAR = "avatar-lion";
const rarityValidator = v.union(
  v.literal("common"),
  v.literal("rare"),
  v.literal("epic"),
  v.literal("legendary"),
);
const typeValidator = v.union(
  v.literal("avatar"),
  v.literal("hat"),
  v.literal("glasses"),
  v.literal("background"),
);

const catalogItemValidator = v.object({
  itemId: v.string(),
  type: typeValidator,
  name: v.string(),
  description: v.string(),
  rarity: rarityValidator,
  priceGems: v.number(),
  achievementId: v.optional(v.string()),
  previewUrl: v.string(),
});

async function getOrCreateUserCustomization(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await ctx.db
    .query("userCustomization")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("userCustomization", {
    userId,
    selectedAvatar: DEFAULT_AVATAR,
    unlocked: [],
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Customization initialization failed");
  return created;
}

/** Projection serveur : on n'envoie QUE les champs consommés par l'UI.
    Les documents seedés portent aussi `_id`, `_creationTime` et les tables de
    traduction ; les renvoyer brut cassait le validateur de la query
    (ReturnsValidationError sur `.catalog[]`). Les translations restent
    appliquées ici, les documents intacts en base. */
function localizedCatalog(
  rows: Array<{
    itemId: string;
    type: "avatar" | "hat" | "glasses" | "background";
    name: string;
    description: string;
    rarity: "common" | "rare" | "epic" | "legendary";
    priceGems: number;
    achievementId?: string;
    previewUrl: string;
    nameTranslations?: Record<string, string>;
    descriptionTranslations?: Record<string, string>;
  }>,
  lang?: string,
) {
  return rows.map((row) => ({
    itemId: row.itemId,
    type: row.type,
    name: row.nameTranslations?.[lang ?? "fr"] ?? row.name,
    description: row.descriptionTranslations?.[lang ?? "fr"] ?? row.description,
    rarity: row.rarity,
    priceGems: row.priceGems,
    previewUrl: row.previewUrl,
    // Champ optionnel : absent = item achetable librement.
    ...(row.achievementId ? { achievementId: row.achievementId } : {}),
  }));
}

/** Catalogue + sélection. Anonyme : avatar par défaut et collection vide. */
export const getMyCustomization = query({
  args: { lang: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const storedCatalog = await ctx.db.query("customizationCatalog").collect();
    const catalog = storedCatalog.length > 0 ? storedCatalog : CUSTOMIZATION_DEFINITIONS;
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        selectedAvatar: DEFAULT_AVATAR,
        selectedHat: null,
        selectedGlasses: null,
        selectedBackground: null,
        unlocked: [],
        gems: 0,
        rpmAvatarUrl: null,
        catalog: localizedCatalog(catalog, args.lang),
      };
    }
    const row = await ctx.db
      .query("userCustomization")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return {
      selectedAvatar: row?.selectedAvatar ?? DEFAULT_AVATAR,
      selectedHat: row?.selectedHat ?? null,
      selectedGlasses: row?.selectedGlasses ?? null,
      selectedBackground: row?.selectedBackground ?? null,
      unlocked: row?.unlocked ?? [],
      gems: stats?.gems ?? 0,
      rpmAvatarUrl: row?.rpmAvatarUrl ?? null,
      catalog: localizedCatalog(catalog, args.lang),
    };
  },
  returns: v.object({
    selectedAvatar: v.string(),
    selectedHat: v.union(v.string(), v.null()),
    selectedGlasses: v.union(v.string(), v.null()),
    selectedBackground: v.union(v.string(), v.null()),
    unlocked: v.array(v.string()),
    gems: v.number(),
    rpmAvatarUrl: v.union(v.string(), v.null()),
    catalog: v.array(catalogItemValidator),
  }),
});

/** Juste l'URL de l'avatar 3D — pour les en-têtes qui n'ont besoin que du
    portrait (conversation, classement) sans charger tout le catalogue. */
export const getMyRpmAvatarUrl = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const row = await ctx.db
      .query("userCustomization")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return row?.rpmAvatarUrl ?? null;
  },
  returns: v.union(v.string(), v.null()),
});

/** Débloque via gems ou achievement ; le gem writer reste unique. */
export const unlockItem = mutation({
  args: { itemId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const storedItem = await ctx.db
      .query("customizationCatalog")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .unique();
    const item = storedItem ?? CUSTOMIZATION_DEFINITIONS.find((candidate) => candidate.itemId === args.itemId);
    if (!item) throw new Error("Item introuvable");
    const customization = await getOrCreateUserCustomization(ctx, userId);
    if (customization.unlocked.includes(item.itemId)) {
      return { ok: true, alreadyUnlocked: true };
    }
    const achievement = item.achievementId
      ? await ctx.db
          .query("userAchievements")
          .withIndex("by_user_achievement", (q) => q.eq("userId", userId).eq("achievementId", item.achievementId!))
          .unique()
      : null;
    if (item.achievementId && !achievement?.completed) {
      return { ok: false, reason: "achievement_required" as const };
    }
    const cost = achievement?.completed ? 0 : item.priceGems;
    const payment = await spendGemsInternal(ctx, userId, cost, `customization_${item.itemId}`);
    if (!payment.ok) return { ok: false, reason: payment.reason, gems: payment.gems };
    await ctx.db.patch(customization._id, { unlocked: [...customization.unlocked, item.itemId] });
    return { ok: true, alreadyUnlocked: false, gems: payment.gems };
  },
  returns: v.object({
    ok: v.boolean(),
    alreadyUnlocked: v.optional(v.boolean()),
    reason: v.optional(v.union(v.literal("not_enough_gems"), v.literal("achievement_required"))),
    gems: v.optional(v.number()),
  }),
});

/** Applique l'accessoire à son champ de sélection, sans duplication. */
export const selectItem = mutation({
  args: { itemId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const [storedItem, customization] = await Promise.all([
      ctx.db.query("customizationCatalog").withIndex("by_item", (q) => q.eq("itemId", args.itemId)).unique(),
      getOrCreateUserCustomization(ctx, userId),
    ]);
    const item = storedItem ?? CUSTOMIZATION_DEFINITIONS.find((candidate) => candidate.itemId === args.itemId);
    if (!item) throw new Error("Item introuvable");
    if (!customization.unlocked.includes(item.itemId)) throw new Error("Item non débloqué");
    if (item.type === "avatar") await ctx.db.patch(customization._id, { selectedAvatar: item.itemId });
    if (item.type === "hat") await ctx.db.patch(customization._id, { selectedHat: item.itemId });
    if (item.type === "glasses") await ctx.db.patch(customization._id, { selectedGlasses: item.itemId });
    if (item.type === "background") await ctx.db.patch(customization._id, { selectedBackground: item.itemId });
    return { ok: true };
  },
  returns: v.object({ ok: v.boolean() }),
});

/* ── Avatar 3D (Ready Player Me) ───────────────────────────────────
   Le studio RPM renvoie une URL .glb hébergée par sa plateforme. On ne
   stocke que cette URL : aucun octet de modèle ne passe par notre base,
   et l'utilisateur peut la régénérer depuis son propre compte RPM.

   Garde-fous : HTTPS obligatoire, extension .glb, longueur bornée — on
   refuse une URL qui servirait de vecteur (javascript:, data:, autre
   domaine que le CDN officiel de RPM). */
const RPM_ALLOWED_HOSTS = ["models.readyplayer.me", "readyplayer.me"];

export const setRpmAvatar = mutation({
  args: { url: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    if (args.url === null) {
      const customization = await getOrCreateUserCustomization(ctx, userId);
      await ctx.db.patch(customization._id, { rpmAvatarUrl: undefined });
      return { ok: true };
    }
    const url = args.url.trim();
    if (url.length > 500) throw new Error("URL avatar trop longue");
    if (!url.startsWith("https://")) throw new Error("URL avatar invalide");
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("URL avatar invalide");
    }
    if (!RPM_ALLOWED_HOSTS.includes(parsed.hostname)) {
      throw new Error("Source avatar non autorisée");
    }
    if (!parsed.pathname.toLowerCase().endsWith(".glb")) {
      throw new Error("Source avatar non autorisée");
    }
    const customization = await getOrCreateUserCustomization(ctx, userId);
    await ctx.db.patch(customization._id, { rpmAvatarUrl: url });
    return { ok: true };
  },
  returns: v.object({ ok: v.boolean() }),
});
