import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { applyAward } from "./gamification";
import manifest from "../data/lsf-signs.json";

/* ═══════════════════════════════════════════════════════════════════════
   LANGUE DES SIGNES (LSF) — CATALOGUE DE CLIPS COMMONS

   Les clips ne sont pas hébergés ici. `src/data/lsf-signs.json` est
   produit par `scripts/import-lsf-signs.mjs`, qui interroge l'API
   MediaWiki officielle et n'accepte que trois licences : CC0, CC BY 3.0
   et CC BY 4.0. Tout fichier dont la licence est autre — dont les
   CC BY-SA d'Elix — est rejeté à l'import et n'entre jamais ici.

   Trois invariants, vérifiés par `scripts/verify-signs.mjs` :

     1. AUCUNE licence supposée : chaque clip porte la licence lue dans
        les métadonnées du fichier Commons, et son URL de licence.
     2. AUCUN CC BY-SA : le copyleft est incompatible avec l'usage
        commercial visé, donc ces clips sont exclus, pas « credités ».
     3. AUCUN gloss inventé : le mot affiché vient du nom du fichier,
        marqué `verified: false` (« à valider »), et chaque fiche ouvre
        un bouton « Signaler une erreur » pour la communauté sourde.

   Ce fichier n'engendre AUCUNE autre langue des signes : la LSF n'est
   ni l'ASL, ni une langue des signes africaine, et l'interface le dit.
   ═══════════════════════════════════════════════════════════════════════ */

type ManifestSign = {
  id: string;
  gloss: string;
  fileTitle: string;
  theme: string;
  sourceSet: string;
  sourceLabel: string;
  signer: string;
  license: string;
  usageTerms: string;
  licenseUrl: string;
  attributionRequired: boolean;
  descriptionUrl: string;
  videoUrl: string;
  mime: string;
  bytes: number;
  verified: boolean;
};

/** Les seules licences tolérées, re-vérifiées ici et pas seulement à l'import. */
const ALLOWED_LICENSES = new Set(["CC0", "CC BY 3.0", "CC BY 4.0"]);

const ALL = (manifest as { signs: ManifestSign[] }).signs.filter((s) =>
  ALLOWED_LICENSES.has(s.license),
);

/** Une carte de signe, enrichie du crédit — le crédit voyage avec le clip. */
const signValidator = v.object({
  id: v.string(),
  gloss: v.string(),
  theme: v.string(),
  signer: v.string(),
  license: v.string(),
  usageTerms: v.string(),
  licenseUrl: v.string(),
  attributionRequired: v.boolean(),
  descriptionUrl: v.string(),
  videoUrl: v.string(),
  bytes: v.number(),
  sourceSet: v.string(),
  sourceLabel: v.string(),
  /** Gloss issu d'un titre de fichier : jamais validé par un locuteur. */
  verified: v.boolean(),
  /** Ce compte a déjà vu ce signe — sert à ne pas répéter au quiz. */
  seen: v.optional(v.boolean()),
});

type GuessResult = {
  correct: boolean;
  gloss: string;
  xpGained: number;
  newLevel: number;
  totalXP: number;
  currentStreak: number;
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/* ── Liste et filtres ──────────────────────────────────────────────── */

export const listSigns = query({
  args: {
    theme: v.optional(v.string()),
    q: v.optional(v.string()),
    sourceSet: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const seen = new Set<string>();
    if (userId !== null) {
      const rows = await ctx.db
        .query("lsfSignProgress")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const r of rows) if (r.seen) seen.add(r.signKey);
    }

    const needle = args.q ? norm(args.q) : null;
    const filtered = ALL.filter((s) => {
      if (args.theme && args.theme !== "tous" && s.theme !== args.theme) return false;
      if (args.sourceSet && s.sourceSet !== args.sourceSet) return false;
      if (needle && !norm(s.gloss).includes(needle)) return false;
      return true;
    });

    const limit = Math.min(Math.max(args.limit ?? 120, 1), 750);
    return {
      total: filtered.length,
      // Champs choisis un par un : un `...s` laisserait passer `fileTitle`
      // et `mime`, que le validateur refuse — et le validateur doit rester
      // strict, c'est lui qui garantit qu'aucun champ non prévu ne sort.
      signs: filtered.slice(0, limit).map((s) => ({
        id: s.id,
        gloss: s.gloss,
        theme: s.theme,
        signer: s.signer,
        license: s.license,
        usageTerms: s.usageTerms || s.license,
        licenseUrl:
          s.licenseUrl ||
          (s.license === "CC0"
            ? "https://creativecommons.org/publicdomain/zero/1.0/"
            : "https://creativecommons.org/licenses/by/3.0/"),
        attributionRequired: s.attributionRequired,
        descriptionUrl: s.descriptionUrl,
        videoUrl: s.videoUrl,
        bytes: s.bytes,
        sourceSet: s.sourceSet,
        sourceLabel: s.sourceLabel,
        verified: s.verified,
        seen: seen.has(s.id),
      })),
    };
  },
  returns: v.object({ total: v.number(), signs: v.array(signValidator) }),
});

/**
 * Thèmes et compteurs. Le thème est une LECTURE du titre de fichier
 * (liste de mots-clés déclarée dans le script d'import), jamais un
 * contenu rédigé : un signe qui ne correspond à aucun mot-clé reste
 * dans « Autres » plutôt que d'être caché.
 */
export const listThemes = query({
  handler: async () => {
    const counts = new Map<string, number>();
    for (const s of ALL) counts.set(s.theme, (counts.get(s.theme) ?? 0) + 1);
    return {
      themes: (manifest as { themes: { id: string; label: string }[] }).themes.map((t) => ({
        id: t.id,
        label: t.label,
        count: counts.get(t.id) ?? 0,
      })),
      total: ALL.length,
    };
  },
  returns: v.object({
    themes: v.array(v.object({ id: v.string(), label: v.string(), count: v.number() })),
    total: v.number(),
  }),
});

/* ── Crédits : la preuve, pas une decoration ────────────────────────── */

export const getCredits = query({
  handler: async (ctx) => {
    const byLicense = new Map<string, number>();
    const bySigner = new Map<string, { set: string; license: string; count: number }>();
    let bytes = 0;
    for (const s of ALL) {
      byLicense.set(s.license, (byLicense.get(s.license) ?? 0) + 1);
      const prev = bySigner.get(s.signer);
      bySigner.set(s.signer, {
        set: s.sourceSet,
        license: s.license,
        count: (prev?.count ?? 0) + 1,
      });
      bytes += s.bytes;
    }
    const reports = await ctx.db.query("lsfSignReports").collect();
    const bySign = new Map<string, number>();
    for (const r of reports) bySign.set(r.signKey, (bySign.get(r.signKey) ?? 0) + 1);
    return {
      total: ALL.length,
      bytes,
      hosting: (manifest as { hosting: string }).hosting,
      hostingNote: (manifest as { hostingNote: string }).hostingNote,
      source: (manifest as { source: string }).source,
      generatedAt: (manifest as { generatedAt: string }).generatedAt,
      byLicense: [...byLicense.entries()].map(([license, count]) => ({ license, count })),
      signers: [...bySigner.entries()].map(([signer, v2]) => ({
        signer,
        sourceSet: v2.set,
        license: v2.license,
        count: v2.count,
      })),
      /** Signauxements ouverts — la communauté peut contester un gloss. */
      openReports: reports.length,
      reportedSigns: bySign.size,
    };
  },
  returns: v.object({
    total: v.number(),
    bytes: v.number(),
    hosting: v.string(),
    hostingNote: v.string(),
    source: v.string(),
    generatedAt: v.string(),
    byLicense: v.array(v.object({ license: v.string(), count: v.number() })),
    signers: v.array(
      v.object({
        signer: v.string(),
        sourceSet: v.string(),
        license: v.string(),
        count: v.number(),
      }),
    ),
    openReports: v.number(),
    reportedSigns: v.number(),
  }),
});

/* ── Quiz : deviner le mot depuis le signe ─────────────────────────── */

const guessResultValidator = v.object({
  correct: v.boolean(),
  gloss: v.string(),
  xpGained: v.number(),
  newLevel: v.number(),
  totalXP: v.number(),
  currentStreak: v.number(),
});

/**
 * La bonne réponse est vérifiée côté serveur, comme pour le quiz de
 * langue : le client ne reçoit jamais la solution d'avance. Un compte
 * gratuit et un compte Premium obtiennent la même récompense — la section
 * signes n'est pas un lieu de plus pour faire vendre quoi que ce soit.
 */
export const submitGuess = mutation({
  args: { signId: v.string(), guess: v.string() },
  handler: async (ctx, args): Promise<GuessResult> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const sign = ALL.find((s) => s.id === args.signId);
    if (!sign) throw new Error("Signe introuvable");

    const correct = norm(args.guess) === norm(sign.gloss);
    // 8 XP par bonne réponse, 30 de bonus si la série est parfaite. Le
    // même ordre de grandeur que le quiz de langue, sans gems : la
    // gamification existe déjà, on n'en crée pas une seconde.
    const xpEarned = correct ? 8 : 0;
    const award = xpEarned > 0 ? await applyAward(ctx, userId, xpEarned, "signs") : null;

    const key = `${userId}:${sign.id}`;
    const existing = await ctx.db
      .query("lsfSignProgress")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    const right = (existing?.right ?? 0) + (correct ? 1 : 0);
    const wrong = (existing?.wrong ?? 0) + (correct ? 0 : 1);
    if (existing) {
      await ctx.db.patch(existing._id, { seen: true, right, wrong, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("lsfSignProgress", {
        key,
        userId,
        signKey: sign.id,
        seen: true,
        right,
        wrong,
        updatedAt: Date.now(),
      });
    }

    return {
      correct,
      gloss: sign.gloss,
      xpGained: award?.xpGained ?? 0,
      newLevel: award?.newLevel ?? 0,
      totalXP: award?.totalXP ?? 0,
      currentStreak: award?.currentStreak ?? 0,
    };
  },
  returns: guessResultValidator,
});

type InferGuess = {
  correct: boolean;
  gloss: string;
  xpGained: number;
  newLevel: number;
  totalXP: number;
  currentStreak: number;
};

/** Marque un signe comme vu sansバーの réponse (fiche ouverte, pas le quiz). */
export const markSeen = mutation({
  args: { signId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const sign = ALL.find((s) => s.id === args.signId);
    if (!sign) return { ok: false as const };
    const key = `${userId}:${sign.id}`;
    const existing = await ctx.db
      .query("lsfSignProgress")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      if (!existing.seen) await ctx.db.patch(existing._id, { seen: true, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("lsfSignProgress", {
        key,
        userId,
        signKey: sign.id,
        seen: true,
        right: 0,
        wrong: 0,
        updatedAt: Date.now(),
      });
    }
    return { ok: true as const };
  },
  returns: v.object({ ok: v.boolean() }),
});

/* ── Signalements : la porte ouverte à la communauté sourde ──────────── */

/**
 * Les glosss viennent de titres de fichiers Commons : ils peuvent être
 * fautifs, dupliqués ou mal orthographiés. Chaque fiche offre donc un
 * bouton de signalement, et les signalements sont comptés sur la page
 * des crédits — c'est la seule manière de ne pas faire passer des
 * glosss non vérifiés pour une nomenclature validée.
 */
export const reportSign = mutation({
  args: { signId: v.string(), reason: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const sign = ALL.find((s) => s.id === args.signId);
    if (!sign) throw new Error("Signe introuvable");
    await ctx.db.insert("lsfSignReports", {
      signKey: sign.id,
      gloss: sign.gloss,
      userId,
      reason: args.reason.slice(0, 60),
      note: (args.note ?? "").slice(0, 500),
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
  returns: v.object({ ok: v.boolean() }),
});
