import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { premiumStatusFor } from "./subscriptions";
import { isCharacterLocked } from "../lib/premiumLimits";
import type { Id } from "./_generated/dataModel";
import {
  addGemsInternal,
  applyAward,
  applyBadgeGems,
  grantLootBox,
  levelFromTotalXp,
} from "./gamification";
import { ensureCharactersFor } from "./aiCharacters";
import { ensureScenariosFor } from "./aiScenarios";
import { chatWithGroq, type ChatMessage } from "./connectors/groqChat";

/* ═══════════════════════════════════════════════════════════════════
   MOTEUR DE CONVERSATION IA (Phase 3/4)

   startConversation (mutation) : seeds auto + objectifs résolus dans
     la VRAIE base slang de la langue + message d'ouverture.
   sendMessage (action)         : Groq (cascade groqChat) + matching
     local des expressions + XP ; commit en mutation
     (aiConversationStore:commitTurn — même transaction Convex).
   endConversation (mutation)   : score final, XP de fin, badges.
   Corrections temps réel       : l'IA marque ses corrections avec la
     ligne « CORRECTION: «mauvais» → «bon» (note) » — parsée ici ;
     robuste même si le modèle oublie (corrections[] vide, aucun crash).
   Cache 1 h (aiChatCache)      : (personnage + scénario + dernier msg).
   Zéro crash si Groq échoue    : fallback « IA indisponible ».
   ═══════════════════════════════════════════════════════════════════ */

const POOL_SIZE = 60;

type SlangLang =
  | "en" | "zh" | "es" | "ar" | "ru"
  | "sw" | "ln" | "ha" | "yo" | "zu" | "wo" | "fr";

type Correction = { wrong: string; right: string; note?: string };

function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** L'utilisateur a-t-il utilisé cette expression ? (inclusion ou tokens) */
function usesExpression(msg: string, expression: string): boolean {
  const m = normKey(msg);
  const e = normKey(expression);
  if (!m || !e) return false;
  if (m.includes(e)) return true;
  const tokens = e.split(" ").filter((t) => t.length >= 3);
  if (tokens.length >= 2) return tokens.every((t) => m.includes(t));
  return false;
}

/** Hash court djb2 — clé de cache (dédup, pas de la crypto). */
function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36) + "." + s.length.toString(36);
}

/** Extrait les lignes « CORRECTION: … » de la réponse IA (les retire). */
function parseCorrections(reply: string): {
  reply: string;
  corrections: Correction[];
} {
  const corrections: Correction[] = [];
  const kept = reply.split("\n").filter((line) => {
    const m = line.match(/^\s*CORRECTION\s*:\s*(.+)$/i);
    if (!m) return true;
    const hit = m[1].match(
      /[«"“']([^»"”']+)[»"”']\s*(?:→|->)\s*[«"“']([^»"”']+)[»"”']\s*(?:\(([^)]*)\))?/,
    );
    if (hit) {
      corrections.push({
        wrong: hit[1].trim(),
        right: hit[2].trim(),
        note: hit[3]?.trim(),
      });
    }
    return false;
  });
  return { reply: kept.join("\n").trim(), corrections };
}

/* ── Seeds + listes (écran d'accueil) ───────────────────────────────── */

/** Garantit personnages + scénarios d'une langue (appelé au montage UI). */
export const ensureSeeds = mutation({
  args: { language: v.string() },
  handler: async (ctx, args) => {
    await ensureCharactersFor(ctx, args.language);
    await ensureScenariosFor(ctx, args.language);
  },
  returns: v.null(),
});

/* ── MODULE C — PERSONNAGES VERROUILLÉS ─────────────────────────────── */

/**
 * Erreur typée du Module C : l'interface la reconnaît
 * (`isCharacterLockedError`) et affiche le bloc de GAIN, jamais une panne
 * technique. Comme `quota_shadow`, le CODE seul remonte dans le message
 * Convex — c'est la seule chose qui traverse la frontière serveur/client.
 */
export const CHARACTER_LOCKED_ERROR = "character_locked";

const characterValidator = v.object({
  id: v.string(),
  name: v.string(),
  description: v.string(),
  avatar: v.string(),
  register: v.string(),
  language: v.string(),
  /**
   * MODULE C — verrouillé pour ce compte ?
   *
   * Le personnage reste VISIBLE et DÉCRIT : c'est la visibilité qui crée
   * l'envie. Une liste tronquée à deux entrées ferait croire que le
   * catalogue ne contient que deux personnages, ce qui serait un mensonge
   * sur le produit.
   */
  locked: v.boolean(),
});

export const listCharacters = query({
  args: { language: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("aiCharacters")
      .withIndex("by_language", (q) => q.eq("language", args.language))
      .collect();
    // MODULE C — le drapeau `locked` est calculé par la règle pure, à
    // partir de l'unique source de vérité d'abonnement. Les six
    // personnages verrouillés sont renvoyés QUAND MÊME : le client les
    // affiche en aperçu.
    const userId = await getAuthUserId(ctx);
    const status = await premiumStatusFor(ctx, userId);
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      avatar: c.avatar,
      register: c.register,
      language: c.language,
      locked: isCharacterLocked(c.id, status.isPremium),
    }));
  },
  returns: v.array(characterValidator),
});

const scenarioValidator = v.object({
  id: v.string(),
  characterId: v.string(),
  title: v.string(),
  description: v.string(),
  difficulty: v.string(),
  objectives: v.array(v.string()),
});

export const listScenarios = query({
  args: { language: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("aiScenarios")
      .withIndex("by_language", (q) => q.eq("language", args.language))
      .collect();
    return rows.map((s) => ({
      id: s.id,
      characterId: s.characterId,
      title: s.title,
      description: s.description,
      difficulty: s.difficulty,
      objectives: s.objectives.slice(0, 3),
    }));
  },
  returns: v.array(scenarioValidator),
});

/* ── 1.4 startConversation ──────────────────────────────────────────── */

/** Banque d'argot locale de la langue (échantillon aléatoire). */
function samplePool(
  rows: { expression: string; meaning: string; context: string }[],
): { expression: string; meaning: string; example?: string }[] {
  return [...rows]
    .sort(() => Math.random() - 0.5)
    .slice(0, POOL_SIZE)
    .map((s) => ({
      expression: s.expression,
      meaning: s.meaning,
      example: s.context || undefined,
    }));
}

/** 5 à 8 objectifs RÉELS depuis la base, par motifs thématiques du seed. */
function resolveObjectives(
  rows: { expression: string; meaning: string; popularity: number }[],
  motifs: string[],
): { expression: string; done: boolean }[] {
  const picked: string[] = [];
  const pick = (expression: string) => {
    if (picked.length < 8 && !picked.includes(expression)) picked.push(expression);
  };
  for (const motif of motifs) {
    const m = normKey(motif);
    if (!m) continue;
    const hit = rows.find((s) => {
      const expr = normKey(s.expression);
      const mean = normKey(s.meaning);
      return mean.includes(m) || expr.includes(m);
    });
    if (hit) pick(hit.expression);
  }
  const byPop = [...rows].sort((a, b) => b.popularity - a.popularity);
  for (const s of byPop) {
    if (picked.length >= 5) break;
    pick(s.expression);
  }
  return picked.map((expression) => ({ expression, done: false }));
}

export const startConversation = mutation({
  args: {
    characterId: v.string(),
    scenarioId: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");

    // 1.1 — auto-ensure idempotent AVANT le lookup : si la langue n'a
    // encore AUCUN personnage, on sème personnages + scénarios puis on
    // relit (retry de fait). Re-seeder une langue déjà prête ne fait rien.
    const existingChars = await ctx.db
      .query("aiCharacters")
      .withIndex("by_language", (q) => q.eq("language", args.language))
      .collect();
    if (existingChars.length === 0) {
      await ensureCharactersFor(ctx, args.language);
      await ensureScenariosFor(ctx, args.language);
    }

    // Les `id` de personnage sont volontairement partagés entre langues
    // (baba_street existe en yo, fr, en…) : chercher par `id` seul renvoie
    // le premier document sequencé, donc celui d'une AUTRE langue.
    // On filtre donc par langue puis par id.
    const character = (
      await ctx.db
        .query("aiCharacters")
        .withIndex("by_language", (q) => q.eq("language", args.language))
        .collect()
    ).find((candidate) => candidate.id === args.characterId);
    if (!character) {
      // 1.1 — erreur conviviale : remontée telle quelle au client (toast),
      // jamais de crash brut côté interface.
      throw new Error(
        "Personnage indisponible pour cette langue — réessaie dans un instant.",
      );
    }

    // MODULE C — verrou au DÉBUT d'une nouvelle conversation seulement.
    //
    // ⚠ `sendMessage` et `endConversation` ne sont PAS verrouillés, et c'est
    // délibéré : une conversation déjà commencée avec un personnage
    // aujourd'hui payant doit se poursuivre intégralement. Verrouiller
    // `sendMessage` couperait une conversation EN COURS — c'est-à-dire
    // retirer un contenu déjà acquis, exactement ce que ce lot interdit.
    {
      const { isPremium } = await premiumStatusFor(ctx, userId);
      if (isCharacterLocked(character.id, isPremium)) {
        throw new Error(CHARACTER_LOCKED_ERROR);
      }
    }
    const scenario = (
      await ctx.db
        .query("aiScenarios")
        .withIndex("by_language", (q) => q.eq("language", args.language))
        .collect()
    ).find((s) => s.id === args.scenarioId);
    if (!scenario) {
      throw new Error(
        "Scénario indisponible pour cette langue — réessaie dans un instant.",
      );
    }

    // Banque d'argot locale (matching sans re-query pendant le chat).
    const lang = args.language as SlangLang;
    const rows = (
      await ctx.db
        .query("slangExpressions")
        .withIndex("by_language", (q) => q.eq("language", lang))
        .take(250)
    )
      .filter((s) => s.expression.length > 0 && s.meaning.length > 0)
      .map((s) => ({
        expression: s.expression,
        meaning: s.meaning,
        context: s.context,
        popularity: s.popularity,
      }));
    const pool = samplePool(rows);
    // 1.3 — un scénario n'est JAMAIS masqué ni skippé : quand la base slang
    // de la langue est vide (aucun objectif résoluble), la conversation
    // démarre en MODE LIBRE (objectifs = [], freeMode = true) ; l'UI
    // affiche un badge « mode libre » au lieu d'un écran masqué.
    const freeMode = rows.length === 0;
    const objectives = freeMode ? [] : resolveObjectives(rows, scenario.objectives);
    const now = Date.now();

    const conversationId = await ctx.db.insert("aiConversations", {
      userId,
      characterId: character.id,
      scenarioId: scenario.id,
      language: args.language,
      messages: [
        { role: "assistant" as const, content: scenario.opening, timestamp: now },
      ],
      startedAt: now,
      xpEarned: 0,
      expressionsUsed: [],
      status: "active" as const,
      objectives,
      freeMode,
      pool,
      qualitySum: 0,
      qualityCount: 0,
    });

    return { conversationId, firstMessage: scenario.opening };
  },
  returns: v.object({
    conversationId: v.id("aiConversations"),
    firstMessage: v.string(),
  }),
});

/* ── 1.4 sendMessage (action : fetch Groq) ──────────────────────────── */

const sendResultValidator = v.object({
  assistantMessage: v.string(),
  corrections: v.array(
    v.object({
      wrong: v.string(),
      right: v.string(),
      note: v.optional(v.string()),
    }),
  ),
  xpGained: v.number(),
  expressionsUsed: v.array(v.string()),
  iaFailed: v.boolean(),
  levelUp: v.optional(v.number()),
});

export const sendMessage = action({
  args: {
    conversationId: v.id("aiConversations"),
    userMessage: v.string(),
  },
  handler: async (ctx, args): Promise<{
    assistantMessage: string;
    corrections: Correction[];
    xpGained: number;
    expressionsUsed: string[];
    iaFailed: boolean;
    levelUp?: number;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const text = args.userMessage.trim().slice(0, 500);
    if (!text) throw new Error("Message vide.");

    const conv = await ctx.runQuery(api.aiConversationStore.getConversation, {
      conversationId: args.conversationId,
    });
    if (!conv) throw new Error("Conversation introuvable.");
    if (conv.status !== "active") throw new Error("Conversation terminée.");

    // Matching local des expressions (pool stocké : aucune lecture lourde).
    const poolDoc = await ctx.runQuery(api.aiConversationStore.getPoolFor, {
      conversationId: args.conversationId,
    });
    const usedNow = (poolDoc ?? []).filter((p) =>
      usesExpression(text, p.expression),
    );

    // ── Cache 1 h (personnage + scénario + dernier message) ─────────
    const lastAssistant =
      [...conv.messages].reverse().find((m) => m.role === "assistant")?.content ??
      "";
    const cacheKey = `v1:${conv.characterId}:${conv.scenarioId}:${hashKey(
      lastAssistant + "||" + text,
    )}`;
    const cached = await ctx.runQuery(api.aiConversationStore.peekCache, {
      key: cacheKey,
    });

    let reply: string;
    let iaFailed = false;
    if (cached !== null) {
      reply = cached;
    } else {
      // ── Prompt system : personnage + scénario + niveau + argot ────
      const stats = await ctx.runQuery(api.gamification.getUserStats, {});
      const level = stats?.level ?? 0;
      const levelName =
        level >= 6 ? "avancé" : level >= 3 ? "intermédiaire" : "débutant";
      const levelHint =
        level >= 6
          ? "L'apprenant est avancé : argot dense, peu d'aide, challenge-le."
          : level >= 3
            ? "L'apprenant est intermédiaire : rythme normal, indices occasionnels."
            : "L'apprenant est débutant : guide beaucoup, phrases simples, reformule.";

      const charDoc = await ctx.runQuery(api.aiConversationStore.getCharacter, {
        characterId: conv.characterId,
        language: conv.language,
      });
      const scenDoc = await ctx.runQuery(api.aiConversationStore.getScenario, {
        scenarioId: conv.scenarioId,
        language: conv.language,
      });
      if (!charDoc || !scenDoc) {
        throw new Error("Personnage ou scénario introuvable.");
      }

      const bank = (poolDoc ?? [])
        .slice(0, 25)
        .map((p) => `« ${p.expression} » = ${p.meaning}`)
        .join("\n");

      const system: string = [
        charDoc.personality,
        `SCÉNARIO : ${scenDoc.title} — ${scenDoc.context}`,
        `DIFFICULTÉ : ${
          scenDoc.difficulty === "beginner"
            ? "débutant — tu guides beaucoup, phrases très simples."
            : scenDoc.difficulty === "intermediate"
              ? "intermédiaire — rythme normal, indices ponctuels."
              : "avancé — tu parles vite, argot dense, presque pas d'aide."
        }`,
        `NIVEAU DE L'APPRENANT : ${levelName}. ${levelHint}`,
        `OBJECTIFS : l'apprenant doit essayer d'utiliser des expressions comme : ${conv.objectives
          .filter((o) => !o.done)
          .slice(0, 5)
          .map((o) => `« ${o.expression} »`)
          .join(", ")}. Félicite-le quand il y arrive.`,
        "BANQUE D'ARGOT LOCALE (utilise 2 à 3 de ces expressions PAR réponse, entre guillemets, telles quelles) :",
        bank,
        "CORRECTIONS TEMPS RÉEL : si le message de l'apprenant contient une erreur (mauvaise expression, calque, faute de contexte), réponds naturellement PUIS ajoute à la FIN une ligne au format exact :",
        "CORRECTION: «ce qui était faux» → «ce qu'il fallait dire» (note courte)",
        "Si tout est correct, n'ajoute PAS de ligne CORRECTION. N'écris jamais ce format ailleurs.",
      ].join("\n\n");

      const history: ChatMessage[] = conv.messages
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));
      const messages: ChatMessage[] = [
        { role: "system", content: system },
        ...history,
        { role: "user", content: text },
      ];

      const turn = await chatWithGroq(messages, {
        temperature: 0.8,
        maxTokens: 1500,
        deadline: Date.now() + 25_000,
      });
      if (turn === null) {
        iaFailed = true;
        reply = "IA indisponible, réessaie plus tard.";
      } else {
        reply = turn.reply;
      }
    }

    // ── Corrections temps réel (lignes CORRECTION: parsées) ─────────
    const { reply: cleanReply, corrections } = parseCorrections(reply);
    const finalReply = cleanReply.length > 0 ? cleanReply : reply;

    // ── Score qualité heuristique (0-100) + XP du tour ──────────────
    const words = text.split(/\s+/).length;
    const freshExpr = usedNow.filter(
      (p) => !conv.expressionsUsed.includes(p.expression),
    );
    const freshObjectives = conv.objectives.filter(
      (o) => !o.done && usesExpression(text, o.expression),
    );
    const quality = Math.min(
      100,
      (words >= 5 ? 50 : 30) +
        freshExpr.length * 20 +
        freshObjectives.length * 10,
    );
    const xpGained = iaFailed
      ? 0
      : freshExpr.length * 5 + freshObjectives.length * 5;

    // ── Commit (mutation, même transaction Convex) ──────────────────
    const commit: { expressionsUsed: string[]; levelUp?: number } =
      await ctx.runMutation(api.aiConversationStore.commitTurn, {
        conversationId: args.conversationId,
        userMessage: text,
        assistantMessage: finalReply,
        corrections,
        newlyUsed: freshExpr.map((p) => p.expression),
        newlyDone: freshObjectives.map((o) => o.expression),
        xpGained,
        quality,
        cacheKey: cached === null && !iaFailed ? cacheKey : undefined,
        cacheReply: cached === null && !iaFailed ? finalReply : undefined,
      });

    return {
      assistantMessage: finalReply,
      corrections,
      xpGained,
      expressionsUsed: commit.expressionsUsed,
      iaFailed,
      levelUp: commit.levelUp,
    };
  },
  returns: sendResultValidator,
});

/* ── 1.4 endConversation : score final + XP + badges ────────────────── */

type ConvRow = {
  status: string;
  language: string;
  characterId: string;
  scenarioId: string;
  expressionsUsed: string[];
  objectives: { expression: string; done: boolean }[];
  qualitySum: number;
  qualityCount: number;
  xpEarned: number;
  messages: unknown[];
};

function avgQualityOf(h: ConvRow): number {
  return h.qualityCount > 0 ? h.qualitySum / h.qualityCount : 0;
}

export const endConversation = mutation({
  args: { conversationId: v.id("aiConversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const conv = (await ctx.db.get(args.conversationId)) as ConvRow | null;
    if (!conv) throw new Error("Conversation introuvable.");
    const doc = (await ctx.db.get(args.conversationId)) as
      | (ConvRow & { _id: Id<"aiConversations">; userId: Id<"users"> })
      | null;
    if (!doc || doc.userId !== userId) throw new Error("Conversation introuvable.");

    const objectivesTotal = conv.objectives.length;
    const objectivesDone = conv.objectives.filter((o) => o.done).length;
    const avgQuality = Math.round(avgQualityOf(conv));
    const perfect = objectivesTotal > 0 && objectivesDone === objectivesTotal;

    if (conv.status !== "active") {
      return {
        objectivesDone,
        objectivesTotal,
        avgQuality,
        xpGained: 0,
        newBadges: [] as string[],
        gemsEarned: 0,
        lootBoxId: undefined,
        totalXP: 0,
        level: 0,
      };
    }

    // XP de fin : 10 par expression + 50 bonus si tous les objectifs.
    const xpGained = conv.expressionsUsed.length * 10 + (perfect ? 50 : 0);

    const award = await applyAward(ctx, userId, xpGained, "conversation_end");

    // Badges spéciaux conversation — historique + conditions.
    const history = (await ctx.db
      .query("aiConversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect()) as ConvRow[];
    const done = history.filter((h) => h.status === "completed");
    const countBy = (pred: (h: ConvRow) => boolean) =>
      done.filter(pred).length + 1; // + conversation courante
    const langConvs = done.filter((h) => h.language === conv.language);

    const stats = await ctx.db
      .query("userStats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const newBadges: string[] = [];
    if (stats) {
      const badges = new Set(stats.badges);
      const grant = (id: string) => {
        if (!badges.has(id)) {
          badges.add(id);
          newBadges.push(id);
        }
      };
      const score70 = (h: ConvRow) => avgQualityOf(h) >= 70;
      if (countBy((h) => h.characterId === "baba_street" && score70(h)) >= 5)
        grant("acteur_ne");
      if (countBy((h) => h.scenarioId === "marche_lagos" && score70(h)) >= 5)
        grant("negociateur");
      if (countBy((h) => h.characterId === "love_guru" && avgQualityOf(h) > 80) >= 3)
        grant("tombeur");
      if (countBy((h) => h.scenarioId === "studio_enregistrement") >= 5)
        grant("mc");
      if (countBy((h) => h.scenarioId === "session_gaming") >= 10)
        grant("gamer_pro_badge");
      if (countBy((h) => h.characterId === "mama_wisdom") >= 5) grant("sage");
      if (done.length + 1 >= 50) grant("fluent");
      const perfectPast = done.filter(
        (h) =>
          h.objectives.length > 0 &&
          h.objectives.every((o) => o.done) &&
          avgQualityOf(h) >= 95,
      ).length;
      if (perfectPast + (perfect && avgQuality >= 95 ? 1 : 0) >= 10)
        grant("legende_vivante");
      const langs = new Set(done.map((h) => h.language));
      langs.add(conv.language);
      if (done.length + 1 >= 10 && langs.size >= 3)
        grant("polyglotte_conversationnel");
      // Maître de scénarios : 15 scénarios de la langue maîtrisés (≥ 80 %).
      if (langConvs.length >= 15) {
        const mastered = new Set(
          langConvs
            .filter(
              (h) =>
                h.objectives.length > 0 &&
                h.objectives.filter((o) => o.done).length / h.objectives.length >=
                  0.8,
            )
            .map((h) => h.scenarioId),
        );
        if (mastered.size >= 15) grant("maitre_scenarios");
      }
      if (newBadges.length > 0) {
        await ctx.db.patch(stats._id, { badges: [...badges] });
      }
    }

    await ctx.db.patch(args.conversationId, {
      status: "completed",
      endedAt: Date.now(),
      xpEarned: conv.xpEarned + xpGained,
    });

    // MOD 2 — économie gems + loot box (récompenses variables) :
    // qualité moyenne > 80 % → +30 gems et 1 loot box ; +100 par badge.
    let gemsEarned = 0;
    let lootBoxId: Id<"userLootBoxes"> | undefined;
    if (avgQuality > 80) {
      gemsEarned += await addGemsInternal(ctx, userId, 30, "conv_quality");
      lootBoxId = await grantLootBox(ctx, userId, "conversation");
    }
    if (newBadges.length > 0) {
      gemsEarned += await applyBadgeGems(ctx, userId, newBadges.length);
    }

    return {
      objectivesDone,
      objectivesTotal,
      avgQuality,
      xpGained,
      newBadges,
      gemsEarned,
      lootBoxId,
      totalXP: award.totalXP,
      level: award.newLevel,
    };
  },
  returns: v.object({
    objectivesDone: v.number(),
    objectivesTotal: v.number(),
    avgQuality: v.number(),
    xpGained: v.number(),
    newBadges: v.array(v.string()),
    gemsEarned: v.number(),
    lootBoxId: v.optional(v.id("userLootBoxes")),
    totalXP: v.number(),
    level: v.number(),
  }),
});

/** Dernières conversations (historique, max 10). */
export const getConversationHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 20);
    const rows = await ctx.db
      .query("aiConversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
    return rows.map((c) => ({
      conversationId: c._id,
      characterId: c.characterId,
      scenarioId: c.scenarioId,
      language: c.language,
      status: c.status,
      xpEarned: c.xpEarned,
      messagesCount: c.messages.length,
      expressionsUsed: c.expressionsUsed.length,
      objectivesDone: c.objectives.filter((o) => o.done).length,
      objectivesTotal: c.objectives.length,
      startedAt: c.startedAt,
    }));
  },
  returns: v.array(
    v.object({
      conversationId: v.id("aiConversations"),
      characterId: v.string(),
      scenarioId: v.string(),
      language: v.string(),
      status: v.string(),
      xpEarned: v.number(),
      messagesCount: v.number(),
      expressionsUsed: v.number(),
      objectivesDone: v.number(),
      objectivesTotal: v.number(),
      startedAt: v.number(),
    }),
  ),
});
