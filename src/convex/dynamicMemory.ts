import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { normalizeRegion } from "./languages";
import { newCardDefaults } from "./languages";

/* ═══════════════════════════════════════════════════════════════════════
   MÉMOIRE UTILISATEUR — capture 1 clic d'un mot HORS base (recherche
   universelle). Crée une carte SRS ; si la définition vient d'Urban
   Dictionary, persiste aussi l'entrée dans slangExpressions (language
   "en", register "internet", popularity 50) — idempotent.
   XP gagné : 10 ("Ajouté à ta mémoire ! +10 XP").
   ═══════════════════════════════════════════════════════════════════════ */

function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** XP personnalisée enregistrée sur la carte : le toast lit cette valeur. */
const XP_PER_DYNAMIC_CARD = 10;

export const addDynamicCard = mutation({
  args: {
    text: v.string(),
    definition: v.string(),
    targetLang: v.optional(v.string()),
    origin: v.optional(v.string()),
    /** Exemple réel (phrase UD) persisté dans context pour les prochaines fois. */
    example: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");

    const text = args.text.trim().slice(0, 200);
    const definition = args.definition.trim().slice(0, 4000);
    if (!text || !definition) {
      return {
        ok: false as const,
        reason: "invalid_input" as const,
        createdSlang: false,
        storedExample: false,
        xpGain: 0,
      };
    }
    const origin = args.origin ?? "translated";

    /* ── Idempotence : le terme est-il déjà mémorisé ? ───────────────
       L'idempotence effective se fait sur l'entrée slang (normExpr) puis
       sur la carte (userId, slangId) — une carte référence TOUJOURS une
       entrée slangExpressions existante ou fraîchement créée.           */
    const existingSlang = await ctx.db
      .query("slangExpressions")
      .withIndex("by_norm_expr", (q) => q.eq("normExpr", normKey(text)))
      .collect();
    const matchingSlang = existingSlang.filter(
      (s) => normKey(s.expression) === normKey(text),
    );

    let slangId: string | null = null;
    let createdSlang = false;
    let storedExample = false;

    if (matchingSlang.length > 0) {
      // Entrée existante : réutilise-la (base OU import dynamique précédent).
      // Complète l'exemple réel s'il arrive plus tard (UD re-fetch côté
      // SearchPage) et marque la langue du sens si absent.
      const entry = matchingSlang[0];
      const patch: { context?: string; meaningLang?: string } = {};
      if (entry.meaningLang === undefined) {
        patch.meaningLang = origin === "urban" ? "en" : "fr";
      }
      if (args.example && !entry.context.trim()) {
        patch.context = args.example.trim().slice(0, 600);
        storedExample = true;
      }
      if (Object.keys(patch).length > 0) await ctx.db.patch(entry._id, patch);
      slangId = entry._id;
    } else {
      const inserted = await ctx.db.insert("slangExpressions", {
        language: "en" as const,
        expression: text,
        meaning: definition,
        // La phrase de contexte EST l'exemple réel quand il existe —
        // jamais de placeholder type « Importé depuis… ».
        context:
          args.example?.trim().slice(0, 600) ||
          (origin === "urban" ? "" : ""),
        register: "internet",
        region: "Internet",
        popularity: 50,
        normExpr: normKey(text),
        regionKey: normalizeRegion("Internet"),
        meaningLang: origin === "urban" ? "en" : "fr",
      });
      slangId = inserted;
      createdSlang = true;
      storedExample = Boolean(args.example?.trim());
    }

    /* ── Carte SRS (idempotente par (userId, slangId)) ─────────────── */
    const already = await ctx.db
      .query("srsCards")
      .withIndex("by_user_slang", (q) =>
        q.eq("userId", userId).eq("slangId", slangId as never),
      )
      .collect();
    if (already.length > 0) {
      return {
        ok: true as const,
        reason: "already" as const,
        slangId: slangId ?? undefined,
        createdSlang,
        storedExample,
        xpGain: 0,
      };
    }

    const now = Date.now();
    await ctx.db.insert("srsCards", {
      userId,
      language: "en" as const,
      slangId: slangId as never,
      register: "internet",
      ...newCardDefaults(now),
    });

    /* ── XP (+10) sur la première langue active de l'utilisateur ───── */
    const langRows = await ctx.db
      .query("userLanguages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const target = langRows.find((r) => r.active) ?? langRows[0];
    if (target) {
      await ctx.db.patch(target._id, {
        xp: target.xp + XP_PER_DYNAMIC_CARD,
        lastActivity: now,
      });
    }

    return {
      ok: true as const,
      reason: "created" as const,
      slangId: slangId ?? undefined,
      createdSlang,
      storedExample,
      xpGain: XP_PER_DYNAMIC_CARD,
    };
  },
  returns: v.object({
    ok: v.boolean(),
    reason: v.string(),
    slangId: v.optional(v.string()),
    createdSlang: v.boolean(),
    storedExample: v.boolean(),
    xpGain: v.number(),
  }),
});
