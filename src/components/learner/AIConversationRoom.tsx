import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Check,
  CircleDashed,
  Compass,
  Flag,
  Flame,
  Loader2,
  Lock,
  MessageCircle,
  Mic,
  Play,
  Send,
  Sparkles,
  Target,
  Timer,
  Trophy,
  X,
  Zap,
  BadgeCheck,
} from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { loadDefLang, uiLangMeta, useI18n, type UiLang } from "@/lib/i18n";
import { isCharacterLockedError } from "@/lib/premiumLimits";
import { useOptionalQuery } from "@/lib/optionalQuery";
import { PremiumUpsell } from "./PremiumUpsell";
import { badgeIcon, badgeLabel } from "@/lib/badges";
import { cn } from "@/lib/utils";
import { LootBoxModal } from "./LootBoxModal";
import { showAchievementFeedback } from "@/lib/achievementFeedback";
import { soundEngine } from "@/lib/soundEngine";
import { PlaceHeader } from "@/components/fx/PlaceHeader";
import { Card3D } from "@/components/fx/Card3D";
import { RpmHead } from "@/components/fx/RpmHead";
import { PronunciationCheck } from "./PronunciationCheck";
import type { LanguageCode } from "@/convex/languages";

/* ═══════════════════════════════════════════════════════════════════
   CONVERSATION IA (Phase 3/4) — personnages + scénarios + corrections
   temps réel. Thème or/noir (ln-card, text-gold, bg-noir).

   Écrans : accueil (personnage + scénario) → briefing de mission
   (contexte, objectifs, durée) → chat (situations à choix + saisie
   libre) → résultats (XP, objectifs, badges). Aucun crash sur données
   vides : loading states + fallbacks partout, hooks toujours
   inconditionnels.
   ═══════════════════════════════════════════════════════════════════ */

const MAX_LEN = 500;

/* ── MISSION — 3 situations, 40 XP ──────────────────────────────────────
   Le cœur du jeu : au lieu d'un champ de texte nu, la conversation
   propose des SITUATIONS à choix. Chaque situation cible une expression
   que la mission doit faire apprendre ; les deux autres propositions
   viennent de la même banque d'argot. La bonne réponse est envoyée au
   serveur comme un vrai message : c'est le serveur qui compte l'XP et
   coche l'objectif, exactement comme en saisie libre. */
const MISSION_COUNT = 3;
const MISSION_XP_TARGET = 40;

type CharacterView = {
  id: string;
  name: string;
  description: string;
  avatar: string;
  register: string;
  language: string;
  /** MODULE C — verrouillé pour ce compte (calculé par le serveur). */
  locked: boolean;
};

type ScenarioView = {
  id: string;
  characterId: string;
  title: string;
  description: string;
  difficulty: string;
  objectives: string[];
};

type ConversationView = {
  _id: string;
  characterId: string;
  scenarioId: string;
  language: string;
  messages: {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    corrections?: { wrong: string; right: string; note?: string }[];
  }[];
  objectives: { expression: string; done: boolean }[];
  freeMode: boolean;
  expressionsUsed: string[];
  xpEarned: number;
  status: string;
  qualityAvg: number;
};

type EndResult = {
  objectivesDone: number;
  objectivesTotal: number;
  avgQuality: number;
  xpGained: number;
  newBadges: string[];
  /** MOD 2 — économie gems + loot. */
  gemsEarned?: number;
  lootBoxId?: Id<"userLootBoxes">;
  totalXP: number;
  level: number;
  /**
   * Bilan de MISSION — calculé par le client à partir des situations
   * réellement jouées (le serveur ne connaît que la conversation). `xp`
   * est le total de la mission : XP gagné pendant le jeu + XP de fin
   * accordé par le serveur. `learned` vient du serveur (objectifs cochés).
   */
  missions?: { total: number; passed: number; learned: number; xp: number };
};

/** Résultat d'une situation : ce que le joueur a choisi, et ce que ça a valu. */
type Outcome = {
  correct: boolean;
  picked: string;
  /** XP accordé par le SERVEUR pour cette réponse (0 tant qu'il n'a pas répondu). */
  xp: number;
};

type TLabel = (k: string, p?: Record<string, string | number>) => string;

type PoolItem = { expression: string; meaning: string };

/** Une situation = une expression à retrouver + trois propositions. */
type Situation = {
  key: string;
  target: PoolItem;
  options: PoolItem[];
};

/** Hash FNV-1a : même entrée ⇒ même mélange, donc aucun saut entre deux
 *  rendus (un tirage aléatoire ferait bouger les propositions sous le
 *  doigt de l'utilisateur). */
function stableSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function stableShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

/**
 * Construit les situations depuis les objectifs RÉELS de la conversation.
 *
 * Aucune donnée inventée : chaque cible est une expression que le serveur
 * a déjà inscrite dans les objectifs, et chaque proposition vient de la
 * banque d'argot de la conversation. Deux garde-fous :
 *   - moins de 3 expressions disponibles ⇒ pas de situation du tout
 *     (l'interface retombe sur les suggestions existantes) ;
 *   - une proposition de même SENS que la bonne réponse est écartée,
 *     sinon la question aurait deux réponses justes.
 */
function buildSituations(
  objectives: { expression: string; done: boolean }[],
  pool: PoolItem[],
): Situation[] {
  if (pool.length < 3) return [];
  const byExpression = new Map(pool.map((p) => [p.expression, p]));
  const fromObjectives = objectives
    .map((o) => byExpression.get(o.expression))
    .filter((p): p is PoolItem => p !== undefined);
  const chosen = (fromObjectives.length > 0 ? fromObjectives : pool).slice(
    0,
    MISSION_COUNT,
  );
  const norm = (s: string) => s.trim().toLowerCase();
  return chosen
    .map((target): Situation | null => {
      const candidates = pool.filter(
        (p) =>
          p.expression !== target.expression &&
          norm(p.meaning) !== norm(target.meaning),
      );
      if (candidates.length < 2) return null;
      const distractors = stableShuffle(
        candidates,
        stableSeed(target.expression),
      ).slice(0, 2);
      return {
        key: target.expression,
        target,
        options: stableShuffle(
          [target, ...distractors],
          stableSeed(`${target.meaning}|${target.expression}`),
        ),
      };
    })
    .filter((s): s is Situation => s !== null);
}

/* ── Rendu d'un message IA : expressions «…» en gras doré ─────────── */
function RichReply({ text }: { text: string }) {
  const parts = useMemo(() => {
    const out: { slang: boolean; content: string }[] = [];
    const re = /[«]"([^"]+)"[»]/g;
    let last = 0;
    for (const m of text.matchAll(re)) {
      const i = m.index ?? 0;
      if (i > last) out.push({ slang: false, content: text.slice(last, i) });
      out.push({ slang: true, content: m[1] });
      last = i + m[0].length;
    }
    if (last < text.length) out.push({ slang: false, content: text.slice(last) });
    return out;
  }, [text]);
  return (
    <p className="text-sm leading-relaxed">
      {parts.map((p, i) =>
        p.slang ? (
          <strong key={i} className="font-semibold text-gold" title={p.content}>
            {p.content}
          </strong>
        ) : (
          <span key={i}>{p.content}</span>
        ),
      )}
    </p>
  );
}

/* ── CARTE DE MISSION — situations à choix ─────────────────────────── */

function SituationBoard({
  situations,
  cursor,
  outcomes,
  busy,
  t,
  onPick,
  onContinue,
}: {
  situations: Situation[];
  cursor: number;
  outcomes: Record<string, Outcome>;
  busy: boolean;
  t: TLabel;
  onPick: (situation: Situation, option: PoolItem) => void;
  onContinue: () => void;
}) {
  const total = situations.length;
  // La progression compte les situations RÉSOLUES (celles dont le feedback
  // a été vu), pas la position du curseur : la barre avance au moment où
  // le joueur appuie sur « Continuer ».
  const done = Math.min(cursor, total);
  const current = situations[cursor] ?? null;

  if (!current) {
    return (
      <div className="rounded-xl border border-gold/30 bg-gold/[0.07] p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-gold">
          <Trophy className="size-4" aria-hidden /> {t("conv.situation.complete")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          {t("conv.situation.summary")}
        </p>
      </div>
    );
  }

  const outcome = outcomes[current.key];
  const head = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.25em] text-gold uppercase">
          <Target className="size-3" aria-hidden /> {t("conv.situation.progress")}
        </span>
        <span className="font-mono text-[0.625rem] text-ink-3">
          {t("conv.situation.label", { current: done + 1, total })}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-strong to-gold transition-all"
          style={{ width: `${Math.round((done / total) * 100)}%` }}
        />
      </div>
    </>
  );

  /* ── C · FEEDBACK — la réponse est commentée AVANT la suite ─────────
     La carte dit ce qui était attendu et ce que l'expression veut dire :
     c'est le moment d'apprentissage. « Continuer » n'est actif qu'une
     fois l'XP du serveur arrivé — on n'affiche jamais « +X XP » avant de
     l'avoir reçu. */
  if (outcome) {
    return (
      <div
        className={cn(
          "rounded-xl border p-3",
          outcome.correct
            ? "border-green-400/30 bg-green-500/[0.06]"
            : "border-red-400/30 bg-red-500/[0.05]",
        )}
      >
        {head}
        <p
          className={cn(
            "mt-3 flex items-center gap-2 text-sm font-semibold",
            outcome.correct ? "text-green-300" : "text-red-300",
          )}
        >
          {outcome.correct ? (
            <Check className="size-4 shrink-0" aria-hidden />
          ) : (
            <X className="size-4 shrink-0" aria-hidden />
          )}
          {outcome.correct ? t("conv.feedback.good") : t("conv.feedback.bad")}
          {outcome.correct && outcome.xp > 0 ? (
            <span className="ml-auto rounded-full bg-gold/15 px-2.5 py-0.5 font-mono text-xs font-normal text-gold">
              {t("conv.feedback.xp", { xp: outcome.xp })}
            </span>
          ) : null}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
          {outcome.correct
            ? t("conv.feedback.means", {
                expression: current.target.expression,
                meaning: current.target.meaning,
              })
            : `${t("conv.feedback.expected", {
                expression: current.target.expression,
              })} ${t("conv.feedback.means", {
                expression: current.target.expression,
                meaning: current.target.meaning,
              })}`}
        </p>
        <button
          type="button"
          onClick={onContinue}
          disabled={busy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-strong to-gold py-2.5 text-sm font-semibold text-noir transition-opacity hover:opacity-90 disabled:cursor-progress disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {t("conv.feedback.next")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gold/25 bg-gold/[0.05] p-3">
      {head}
      <p className="mt-3 text-sm text-ink">
        {t("conv.situation.prompt", { meaning: current.target.meaning })}
      </p>
      <div className="mt-2 space-y-1.5">
        {current.options.map((option) => (
          <button
            key={option.expression}
            type="button"
            onClick={() => onPick(current, option)}
            disabled={busy}
            className={cn(
              "w-full rounded-xl border border-white/10 bg-noir-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:border-gold/50 hover:bg-gold/5",
              busy && "opacity-60",
            )}
          >
            {option.expression}
          </button>
        ))}
      </div>
    </div>
  );
}

function DifficultyStars({ level }: { level: string }) {
  const n = level === "advanced" ? 3 : level === "intermediate" ? 2 : 1;
  return (
    <span className="shrink-0 text-[0.625rem] text-gold" aria-label={`Difficulté ${n}/3`}>
      {"⭐".repeat(n)}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ROUTEUR D'ÉCRANS
   ═══════════════════════════════════════════════════════════════════ */

export function AIConversationRoom() {
  const { t } = useI18n();
  const [language, setLanguage] = useState<UiLang>("fr");

  useEffect(() => {
    setLanguage(loadDefLang());
  }, []);

  const [screen, setScreen] = useState<
    "pick" | "briefing" | "chat" | "results"
  >("pick");
  const [conversationId, setConversationId] = useState<Id<"aiConversations"> | null>(null);
  const [character, setCharacter] = useState<CharacterView | null>(null);
  const [scenario, setScenario] = useState<ScenarioView | null>(null);
  const [result, setResult] = useState<EndResult | null>(null);

  /**
   * E — « Rejouer cette mission » : une NOUVELLE conversation sur le même
   * personnage et le même scénario (donc de nouveaux objectifs et une
   * nouvelle banque d'argot), puis retour au briefing. Tout se fait dans
   * l'état du composant : la route ne change pas, la page ne recharge pas.
   */
  const startConv = useMutation(api.aiConversation.startConversation);
  const [replaying, setReplaying] = useState(false);
  const replay = useCallback(async () => {
    if (!character || !scenario || replaying) return;
    setReplaying(true);
    try {
      const r = await startConv({
        characterId: character.id,
        scenarioId: scenario.id,
        language: character.language,
      });
      setResult(null);
      setConversationId(r.conversationId);
      setScreen("briefing");
    } catch (err) {
      // Échec signalé, et surtout : pas d'impasse. On rend la sélection,
      // où le joueur peut relancer la mission lui-même.
      toast.error(err instanceof Error ? err.message : "Démarrage impossible.");
      setConversationId(null);
      setScreen("pick");
    } finally {
      setReplaying(false);
    }
  }, [character, scenario, replaying, startConv]);

  if (screen === "briefing" && conversationId && character && scenario) {
    return (
      <Briefing
        conversationId={conversationId}
        character={character}
        scenario={scenario}
        t={t}
        onLaunch={() => setScreen("chat")}
        onBack={() => {
          setScreen("pick");
          setConversationId(null);
        }}
      />
    );
  }
  if (screen === "chat" && conversationId) {
    return (
      <ChatRoom
        conversationId={conversationId}
        character={character}
        scenario={scenario}
        t={t}
        onFinished={(r) => {
          setResult(r);
          setScreen("results");
        }}
        onQuit={() => setScreen("pick")}
      />
    );
  }
  if (screen === "results" && conversationId && result) {
    return (
      <Results
        conversationId={conversationId}
        result={result}
        t={t}
        replaying={replaying}
        onReplay={() => void replay()}
        onHome={() => {
          setScreen("pick");
          setConversationId(null);
        }}
      />
    );
  }
  return (
    <ConversationHome
      language={language}
      t={t}
      onStart={(id, c, s) => {
        setConversationId(id);
        setCharacter(c);
        setScenario(s);
        setScreen("briefing");
      }}
    />
  );
}

/* ── 2.2 Écran d'accueil : personnage + scénario ───────────────────── */

function ConversationHome({
  language,
  t,
  onStart,
}: {
  language: UiLang;
  t: TLabel;
  onStart: (conversationId: Id<"aiConversations">, c: CharacterView, s: ScenarioView) => void;
}) {
  const [charId, setCharId] = useState<string | null>(null);
  const [scenId, setScenId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  // MODULE C — le refus du serveur sur un personnage verrouillé.
  const [characterBlocked, setCharacterBlocked] = useState(false);

  // Seeds auto puis listes (réactives : les seeds apparaissent en direct).
  const ensureSeeds = useMutation(api.aiConversation.ensureSeeds);
  const startConv = useMutation(api.aiConversation.startConversation);
  const chars = useQuery(api.aiConversation.listCharacters, { language });
  const scens = useQuery(api.aiConversation.listScenarios, { language });
  const stats = useQuery(api.gamification.getUserStats, {});
  const history = useQuery(api.aiConversation.getConversationHistory, { limit: 10 });

  useEffect(() => {
    void ensureSeeds({ language }).catch(() => undefined);
  }, [ensureSeeds, language]);

  // Scénarios filtrés par personnage sélectionné (§2.2).
  const scenList = useMemo(
    () => (scens ?? []).filter((s) => !charId || s.characterId === charId),
    [scens, charId],
  );

  // 1.4 — la langue de conversation est celle du PERSONNAGE choisi
  // (indépendante de la langue d'interface).
  const selectedChar = (chars ?? []).find((c) => c.id === charId) ?? null;
  const conversationLang = selectedChar?.language ?? language;
  const conversationLangMeta = uiLangMeta(conversationLang as UiLang);

  // Badge « Débloqué » : personnage déjà utilisé 3+ fois.
  const usageByChar = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of history ?? []) {
      m.set(h.characterId, (m.get(h.characterId) ?? 0) + 1);
    }
    return m;
  }, [history]);

  const pickChar = (id: string) => {
    setCharId(id);
    setCharacterBlocked(false);
    // Le scénario sélectionné peut appartenir à un autre personnage.
    const stillOk = scenId != null && scenList.some((s) => s.id === scenId);
    if (!stillOk) setScenId(null);
  };

  const start = useCallback(async () => {
    const c = (chars ?? []).find((x) => x.id === charId);
    const s = (scens ?? []).find((x) => x.id === scenId);
    if (!c || !s) return;
    setStarting(true);
    try {
      const r = await startConv({
        characterId: c.id,
        scenarioId: s.id,
        // 1.4 — langue de conversation = langue du personnage.
        language: c.language,
      });
      onStart(r.conversationId, c, s);
    } catch (err) {
      // MODULE C — blocage de verrou : on affiche le panneau de gain, pas
      // une erreur technique. Le serveur reste la seule autorité (c'est
      // lui qui refuse) ; le client ne fait que traduire le refus.
      if (isCharacterLockedError(err)) {
        setCharacterBlocked(true);
      } else {
        // 1.4 — erreur TOUJOURS signalée (toast), jamais silencieuse.
        toast.error(
          err instanceof Error ? err.message : "Démarrage impossible.",
        );
      }
    } finally {
      setStarting(false);
    }
  }, [chars, scens, charId, scenId, startConv, onStart]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      {/* Stats rapides (niveau, XP, streak) */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="ln-card px-3 py-1.5 text-xs text-gold">
          {t("quiz.level")} {stats?.level ?? 0}
        </span>
        <span className="ln-card px-3 py-1.5 text-xs text-gold">
          {stats?.totalXP ?? 0} XP
        </span>
        <span className="ln-card flex items-center gap-1 px-3 py-1.5 text-xs text-gold">
          <Flame className="size-3.5" aria-hidden />
          {stats?.currentStreak ?? 0}
        </span>
      </div>

      <PlaceHeader
        place="conversation"          title={t("conv.title")}
          icon={MessageCircle}
          motif="adinkra"
        description={t("conv.subtitle")}
        actions={
          /* 1.4 — badge langue de conversation visible (drapeau + nom natif).
             Il est TOUJOURS rendu, simplement invisible tant qu'aucun
             personnage n'est choisi : l'apparition de ce badge dans l'en-tête
             agrandissait la carte héros de 43 px et décalait d'autant toute
             la page vers le bas — dont la ligne de prérequis et le bouton
             « Commencer », précisément là où l'utilisateur vient de poser le
             doigt. La hauteur du pilule ne dépend pas de son texte, la
             réservation est donc exacte. */
          <p
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs text-gold",
              !selectedChar && "invisible",
            )}
          >
            <span aria-hidden>{conversationLangMeta.flag}</span>
            {conversationLangMeta.native}
          </p>
        }
      />

      {/* Personnages */}
      <section>
        <h2 className="mb-2 font-mono text-[0.625rem] tracking-[0.3em] text-gold uppercase">
          {t("conv.pickCharacter")}
        </h2>
        {chars === undefined ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : chars.length === 0 ? (
          <p className="ln-card p-4 text-sm text-ink-3">{t("conv.preparing")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {chars.map((c) => (
              <Card3D key={c.id}>
                <button
                  type="button"
                  onClick={() => pickChar(c.id)}
                  // Infobulle native (le même mécanisme que la description) :
                  // sur un personnage ouvert elle garde la description seule,
                  // sur un verrouillé elle dit aussi comment l'ouvrir.
                  title={
                    c.locked
                      ? `${c.description} · ${t("premium.characters.tooltip")}`
                      : c.description
                  }
                  className={cn(
                    "ln-card flex h-full w-full flex-col items-start p-3 text-left transition-colors hover:border-gold/50",
                    // 1.4 — sélection nette : bordure or + fond or/10.
                    charId === c.id && "border-gold bg-gold/10",
                    // MODULE C — un personnage verrouillé reste VISIBLE et
                    // SÉLECTIONNABLE : l'aperçu est ce qui donne envie. Une
                    // carte grisée non cliquable serait un cul-de-sac sans
                    // explication — le refus vient du serveur, au moment où
                    // l'utilisateur appuie sur « Commencer ».
                    c.locked && "opacity-80",
                  )}
                >
                  <span data-card3d-depth="40" className="text-2xl">{c.avatar}</span>
                  <span data-card3d-depth="20" className="mt-1 text-sm font-semibold text-ink">{c.name}</span>
                  <span className="line-clamp-2 text-[0.6875rem] text-ink-3">
                    {c.description}
                  </span>
                  <span className="mt-1 font-mono text-[0.5625rem] tracking-widest text-gold/70 uppercase">
                    {c.register}
                  </span>
                  {(usageByChar.get(c.id) ?? 0) >= 3 && (
                    <span data-card3d-depth="60" className="mt-1 flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[0.5625rem] text-gold">
                      <BadgeCheck className="size-2.5" /> {t("conv.unlocked")}
                    </span>
                  )}
                  {/* MODULE C — pastille de verrou, sur la carte visible.
                      « Premium » dit ce que ça coûte ; sans elle, le
                      personnage passerait pour un contenu cassé. Tons or
                      discrets : un badge rouge crierait une sanction sur
                      une page de jeu, alors que c'est une invitation. */}
                  {c.locked ? (
                    <span
                      data-card3d-depth="60"
                      className="mt-1 flex items-center gap-1 rounded-full border border-gold/20 bg-gold/[0.08] px-1.5 py-0.5 text-[0.5625rem] text-gold/80"
                    >
                      <Lock className="size-2.5" /> {t("premium.characters.locked")}
                    </span>
                  ) : null}
                </button>
              </Card3D>
            ))}
          </div>
        )}

        {/* MODULE C — le panneau de gain n'apparaît qu'au moment du refus,
            c'est-à-dire après que l'utilisateur a choisi un personnage
            verrouillé. Avant, la pastille suffit : un panneau ouvert en
            permanence serait un mur de vente sur une page de jeu. */}
        {characterBlocked ? (
          <PremiumUpsell
            title={t("premium.lock.characters.title")}
            body={t("premium.lock.characters.body")}
            cta={t("premium.lock.characters.cta")}
            freeAction={{
              label: t("premium.characters.preview"),
              onClick: () => {
                // Issue gratuite : le premier personnage OUVERT du compte.
                const firstFree = (chars ?? []).find((x) => !x.locked);
                if (firstFree) pickChar(firstFree.id);
                setCharacterBlocked(false);
              },
            }}
          />
        ) : null}
      </section>

      {/* Scénarios (filtrés par personnage) */}
      <section>
        <h2 className="mb-2 font-mono text-[0.625rem] tracking-[0.3em] text-gold uppercase">
          {t("conv.pickScenario")}
        </h2>
        {scens === undefined ? (
          <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
        ) : scenList.length === 0 ? (
          <p className="ln-card p-4 text-sm text-ink-3">
            {charId ? t("conv.noScenario") : t("conv.preparing")}
          </p>
        ) : (
          /* Hauteur FIXE : la liste se filtre quand on choisit un personnage,
             et ce retrait faisait glisser toute la suite — ligne de prérequis
             et bouton « Commencer » comprise — sous le doigt de l'utilisateur.
             Mon propre clic de test a ainsi atterri sur « Atlas ». La boîte
             garde donc toujours la même hauteur et défile elle-même : plus rien
             ne bouge après un tap, sur tactile comme à la souris. */
          <div className="grid h-[20rem] content-start gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2">
            {scenList.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScenId(s.id)}
                className={cn(
                  "ln-card p-3 text-left transition-colors hover:border-gold/50",
                  // 1.4 — sélection nette : bordure or + fond or/10.
                  scenId === s.id && "border-gold bg-gold/10",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{s.title}</span>
                  <DifficultyStars level={s.difficulty} />
                </div>
                <p className="mt-0.5 line-clamp-2 text-[0.6875rem] text-ink-3">
                  {s.description}
                </p>
                <p className="mt-1 line-clamp-1 font-mono text-[0.5625rem] tracking-wider text-gold/60 uppercase">
                  {t("conv.objectives")}: {s.objectives.join(" · ")}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* CTA « Commencer » — 1.4 : gardé tant que personnage + scénario
          ne sont pas choisis. Le motif du blocage est affiché EN VISIBLE :
          un attribut `title` seul est invisible au doigt comme au lecteur
          d'écran, le bouton restait donc muet pour l'utilisateur. */}
      <p
        id="ln-conv-steps"
        className="mb-3 mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[0.625rem] tracking-wider uppercase"
      >
        <span className={charId ? "text-gold" : "text-ink-3"}>
          {charId ? "✓" : "✗"} {t("conv.stepCharacter")}
        </span>
        <span className={scenId ? "text-gold" : "text-ink-3"}>
          {scenId ? "✓" : "✗"} {t("conv.stepScenario")}
        </span>
      </p>
      <button
        type="button"
        onClick={() => void start()}
        disabled={!charId || !scenId || starting}
        aria-describedby="ln-conv-steps"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-strong to-gold py-3 font-display font-semibold text-noir transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {starting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {t("conv.prepare")}
      </button>
    </div>
  );
}

/* ── 2.3 Carte de briefing — le contexte AVANT l'action ─────────────── */

/**
 * Le briefing dit ce qui va se passer, avec les CHIFFRES RÉELS de la
 * conversation : le nombre d'expressions vient des objectifs résolus par
 * le serveur, la cible d'XP de la constante de mission, la durée de la
 * difficulté du scénario. Aucune promesse inventée : on n'annonce jamais
 * « 5 expressions » avant de savoir combien le serveur en a inscrites.
 */
function Briefing({
  conversationId,
  character,
  scenario,
  t,
  onLaunch,
  onBack,
}: {
  conversationId: Id<"aiConversations">;
  character: CharacterView;
  scenario: ScenarioView;
  t: TLabel;
  onLaunch: () => void;
  onBack: () => void;
}) {
  const conv = useQuery(api.aiConversationStore.getConversation, {
    conversationId,
  });
  /**
   * La banque d'argot sert à vérifier qu'un objectif est réellement
   * JOUABLE : les situations se construisent sur le pool, donc un objectif
   * absent du pool ne produirait aucune situation. On ne promet jamais
   * « 3 situations » avant de savoir combien le pool en permet — le
   * compte affiché est celui que le tableau de mission affichera.
   */
  const pool = useQuery(api.aiConversationStore.getPoolFor, {
    conversationId,
  });
  const objectives = conv?.objectives ?? [];
  const total = objectives.length;
  const freeMode = conv !== undefined && total === 0;
  const playable = useMemo(() => {
    if (!pool) return null;
    const known = new Set(pool.map((p) => p.expression));
    return objectives.filter((o) => known.has(o.expression)).length;
  }, [pool, objectives]);
  const missions =
    playable === null ? MISSION_COUNT : Math.min(MISSION_COUNT, playable);
  const range =
    scenario.difficulty === "advanced"
      ? "7-10"
      : scenario.difficulty === "intermediate"
        ? "5-7"
        : "3-5";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6">
      <div className="ln-card p-6">
        <p className="font-mono text-[0.625rem] tracking-[0.3em] text-gold uppercase">
          {t("conv.briefing.title")}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-4xl" aria-hidden>
            {character.avatar}
          </span>
          <div className="min-w-0">
            <p className="font-display text-xl font-bold text-ink">
              {scenario.title}
            </p>
            <p className="text-xs text-ink-3">
              {character.name} · {character.register}
            </p>
          </div>
        </div>

        {/* Contexte narratif : la phrase d'accroche du personnage, puis le
            décor écrit du scénario. Le joueur sait OÙ il est et POURQUOI
            il parle, au lieu d'atterrir sur un champ de texte vide. */}
        <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-ink-2">
          <Compass className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
          <span>
            {t("conv.briefing.lead", { character: character.name })}{" "}
            {scenario.description}
          </span>
        </p>

        <h3 className="mt-5 mb-2 flex items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.25em] text-gold uppercase">
          <Target className="size-3" aria-hidden /> {t("conv.briefing.objectives")}
        </h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
            <span className="text-ink-2">
              {freeMode
                ? t("conv.briefing.learnFree")
                : t("conv.briefing.learnExpressions", { count: total })}
            </span>
          </li>
          {!freeMode && missions > 0 ? (
            <li className="flex items-start gap-2">
              <Trophy className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
              <span className="text-ink-2">
                {t("conv.briefing.situations", { count: missions })}
              </span>
            </li>
          ) : null}
          <li className="flex items-start gap-2">
            <Zap className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
            <span className="text-ink-2">
              {t("conv.briefing.xpTarget", { xp: MISSION_XP_TARGET })}
            </span>
          </li>
        </ul>

        {freeMode ? (
          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            {t("conv.briefing.freeNote")}
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {objectives.map((o) => (
              <span
                key={o.expression}
                className="rounded-full border border-gold/25 bg-gold/5 px-2.5 py-1 text-[0.6875rem] text-gold"
              >
                {o.expression}
              </span>
            ))}
          </div>
        )}

        <p className="mt-5 flex items-center gap-1.5 text-xs text-ink-3">
          <Timer className="size-3.5 text-gold" aria-hidden />
          {t("conv.briefing.duration")} ·{" "}
          {t("conv.briefing.minutes", { range })}
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onLaunch}
            // Tant que les objectifs ne sont pas lus, on ne prétend pas
            // savoir combien d'expressions la mission contient.
            disabled={conv === undefined || pool === undefined}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-strong to-gold py-3 font-display font-semibold text-noir transition-opacity hover:opacity-90 disabled:cursor-progress disabled:opacity-60"
          >
            {conv === undefined || pool === undefined ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" aria-hidden />
            )}
            {t("conv.briefing.start")}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded-xl border border-gold/40 py-3 text-sm font-medium text-gold transition-colors hover:bg-gold/10"
          >
            {t("conv.briefing.back")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 2.4 Interface de chat ──────────────────────────────────────────── */

function ChatRoom({
  conversationId,
  character,
  scenario,
  t,
  onFinished,
  onQuit,
}: {
  conversationId: Id<"aiConversations">;
  character: CharacterView | null;
  scenario: ScenarioView | null;
  t: TLabel;
  onFinished: (r: EndResult) => void;
  onQuit: () => void;
}) {
  const { lang } = useI18n();
  const achievements = useQuery(api.achievements.getMyAchievements, { lang });
  // Portrait 3D du joueur (s'il en a créé un) : l'en-tête montre « qui parle ».
  // Lecture TOLÉRANTE : cet ornement ne doit jamais empêcher la conversation
  // de s'ouvrir. En production, le déploiement Convex peut être en retard d'une
  // fonction — `useQuery` relancerait l'erreur pendant le rendu et ferait
  // tomber l'écran entier ; ici l'absence d'avatar se traduit par… aucun
  // avatar, et le chat démarre quand même.
  const { data: myRpmAvatar } = useOptionalQuery(
    api.customization.getMyRpmAvatarUrl,
    {},
  );
  const send = useAction(api.aiConversation.sendMessage);
  const checkAchievements = useAction(api.achievements.checkAchievements);
  const endConv = useMutation(api.aiConversation.endConversation);
  const conv = useQuery(api.aiConversationStore.getConversation, {
    conversationId,
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  // MOD 2 — loot box gagnée si qualité > 80 % (modal d'ouverture).
  const [lootId, setLootId] = useState<Id<"userLootBoxes"> | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages.length, sending]);

  // Suggestions : expressions du pool non encore utilisées (§2.3).
  const pool = useQuery(api.aiConversationStore.getPoolFor, { conversationId });
  const suggestions = useMemo(() => {
    const used = new Set(conv?.expressionsUsed ?? []);
    return (pool ?? []).filter((p) => !used.has(p.expression)).slice(0, 3);
  }, [pool, conv?.expressionsUsed]);

  /**
   * Situations de la mission, figées à la PREMIÈRE lecture des données.
   *
   * Les recalculer à chaque changement d'objectifs ferait disparaître la
   * situation en cours juste après une bonne réponse : le joueur verrait
   * la liste se réorganiser sous son doigt. Une fois construites, elles
   * ne bougent plus.
   */
  const [missions, setMissions] = useState<Situation[] | null>(null);
  /** Situation en cours + résultat de chacune (le feedback s'affiche ici). */
  const [cursor, setCursor] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});

  useEffect(() => {
    if (missions !== null || !conv || !pool) return;
    const built = buildSituations(conv.objectives, pool);
    if (built.length > 0) setMissions(built);
  }, [missions, conv, pool]);

  /** Envoie un message et renvoie l'XP ACCORDÉ PAR LE SERVEUR (0 si échec). */
  const sendMsg = useCallback(
    async (text: string): Promise<number> => {
      const value = text.trim();
      if (!value || sending) return 0;
      setSending(true);
      setInput("");
      try {
        const r = await send({ conversationId, userMessage: value });
        if (r.xpGained > 0) {
          setFlash(`+${r.xpGained} XP`);
          setTimeout(() => setFlash(null), 1500);
        }
        for (const c of r.corrections) {
          soundEngine.play("error");
          toast.info(`${t("conv.correction")}: ${c.right}`, { description: c.note });
        }
        if (r.corrections.length === 0) soundEngine.play("correct");
        if (r.iaFailed) { soundEngine.play("error"); toast.error(t("conv.iaUnavailable")); }
        return r.xpGained;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Envoi impossible.");
        return 0;
      } finally {
        setSending(false);
      }
    },
    [conversationId, send, sending, t],
  );

  /**
   * Réponse à une situation.
   *
   * Le geste décisif : la bonne expression part au serveur comme un VRAI
   * message (`sendMsg`). L'XP et la coche de l'objectif restent donc
   * calculés par le serveur, exactement comme en saisie libre — aucune
   * récompense décidée par le navigateur. Une mauvaise proposition, elle,
   * ne part jamais : on ne fait pas écrire au personnage une phrase fausse.
   */
  const pickOption = useCallback(
    async (situation: Situation, option: PoolItem) => {
      if (sending || outcomes[situation.key]) return;
      if (option.expression !== situation.target.expression) {
        // Mauvaise réponse : rien ne part au serveur (on ne fait pas écrire
        // au personnage une phrase fausse) et la situation est consommée.
        soundEngine.play("error");
        setOutcomes((prev) => ({
          ...prev,
          [situation.key]: { correct: false, picked: option.expression, xp: 0 },
        }));
        return;
      }
      setOutcomes((prev) => ({
        ...prev,
        [situation.key]: { correct: true, picked: option.expression, xp: 0 },
      }));
      const xp = await sendMsg(option.expression);
      setOutcomes((prev) => {
        const settled = prev[situation.key];
        if (!settled) return prev;
        return { ...prev, [situation.key]: { ...settled, xp } };
      });
    },
    [sending, outcomes, sendMsg],
  );

  const end = useCallback(async () => {
    setEnding(true);
    try {
      const r = await endConv({ conversationId });
      // MOD 2 — toasts récompenses (gems, loot box, badges).
      if ((r.gemsEarned ?? 0) > 0) soundEngine.play("reward");
      if ((r.gemsEarned ?? 0) > 0) {
        toast.success(`💎 +${r.gemsEarned} ${t("quiz.gemsWon")}`);
      }
      if (r.lootBoxId) {
        setLootId(r.lootBoxId);
      }
      void checkAchievements({}).then((result) => { showAchievementFeedback(result); if (result.completed.length > 0) soundEngine.play("achievement"); }).catch(() => undefined);
      // Bilan de mission : situations RÉELLEMENT jouées (comptées ici) +
      // XP total = celui déjà gagné dans la conversation avant clôture,
      // augmenté de l'XP de fin que le serveur vient d'accorder. Les
      // expressions apprises viennent du serveur (`objectivesDone`).
      const total = missions?.length ?? 0;
      const passed = missions
        ? missions.filter((m) => outcomes[m.key]?.correct).length
        : 0;
      onFinished({
        ...r,
        missions: {
          total,
          passed,
          learned: r.objectivesDone,
          xp: (conv?.xpEarned ?? 0) + r.xpGained,
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clôture impossible.");
      setEnding(false);
    }
  }, [
    conversationId,
    endConv,
    onFinished,
    t,
    checkAchievements,
    missions,
    outcomes,
    conv?.xpEarned,
  ]);

  /**
   * « Continuer » : situation suivante. Après la DERNIÈRE, on clôture la
   * conversation — c'est le serveur qui calcule l'XP de fin, les badges et
   * les gems, puis l'écran de bilan s'affiche. Aucun rechargement : tout
   * se joue dans l'état du composant.
   */
  const continueMission = useCallback(() => {
    const total = missions?.length ?? 0;
    if (cursor + 1 < total) {
      setCursor(cursor + 1);
      return;
    }
    setCursor(total);
    void end();
  }, [missions, cursor, end]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">
      {achievements?.items.find((item) => item.achievementId === "actor-5") && (
        <div className="flex items-center justify-between rounded-2xl border border-gold/20 bg-gold/5 px-4 py-3 text-xs text-ink-2">
          <span>🎭 Plus que <strong className="text-gold">{Math.max(0, 5 - (achievements.items.find((item) => item.achievementId === "actor-5")?.progress ?? 0))} conversations</strong> pour Acteur Né</span>
          <span className="font-mono text-[0.625rem] text-ink-3">{achievements.items.find((item) => item.achievementId === "actor-5")?.progress ?? 0}/5</span>
        </div>
      )}
      <LootBoxModal lootId={lootId} onClose={() => setLootId(null)} />
      {/* Header : avatar + personnage + scénario + XP temps réel */}
      <div className="ln-card flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={onQuit}
          className="rounded-lg p-1 text-ink-3 transition-colors hover:text-gold"
          aria-label={t("conv.backHub")}
        >
          ←
        </button>
        <span className="text-3xl">{character?.avatar ?? "💬"}</span>
        <div className="min-w-0 flex-1">
          <p className="min-w-0 truncate font-display font-semibold text-ink">
            {character?.name ?? "…"}
          </p>
          <p className="truncate text-[0.6875rem] text-ink-3">
            {scenario?.title ?? t("conv.title")}
          </p>
        </div>
        {flash && (
          <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 font-mono text-xs text-gold">
            <Zap className="size-3" /> {flash}
          </span>
        )}
        <span className="rounded-full bg-gold/10 px-2.5 py-1 font-mono text-xs text-gold">
          {conv?.xpEarned ?? 0} XP
        </span>
        {myRpmAvatar && <RpmHead url={myRpmAvatar} className="size-9" alt="" />}
        {/* 1.4 — badge langue de conversation (drapeau + nom natif). */}
        <span className="hidden shrink-0 items-center gap-1 rounded-full border border-gold/30 bg-gold/5 px-2.5 py-1 font-mono text-[0.6875rem] text-gold sm:flex">
          {uiLangMeta((conv?.language ?? character?.language ?? "fr") as UiLang).flag}
          {conv?.language ?? character?.language ?? ""}
        </span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_260px]">
        {/* Zone messages */}
        <div className="ln-card flex max-h-[60vh] min-h-[45vh] flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {(conv?.messages ?? []).map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {m.role === "assistant" && (
                  <span className="mt-1 text-lg">{character?.avatar ?? "💬"}</span>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2.5",
                    m.role === "user"
                      ? "rounded-br-sm bg-gold/15 text-ink"
                      : "rounded-bl-sm border border-gold/15 bg-noir-2 text-ink-2",
                  )}
                >
                  {m.role === "assistant" ? (
                    <RichReply text={m.content} />
                  ) : (
                    <p className="text-sm leading-relaxed">{m.content}</p>
                  )}
                  {/* Corrections : faux barré rouge → vrai vert */}
                  {(m.corrections ?? []).map((c, j) => (
                    <p key={j} className="mt-2 border-t border-white/5 pt-2 text-xs">
                      <span className="text-red-400 line-through">{c.wrong}</span>
                      <span className="mx-1.5 text-ink-3">→</span>
                      <span className="font-medium text-green-400">{c.right}</span>
                      {c.note && (
                        <span className="ml-1 text-ink-3 italic">({c.note})</span>
                      )}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-ink-3">
                <span className="text-lg">{character?.avatar ?? "💬"}</span>
                {character?.name ?? "IA"} {t("conv.typing")}
                <Loader2 className="size-3 animate-spin" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Saisie : suggestions + compteur + envoi */}
          <div className="border-t border-white/5 p-3">
            {/* Le guidage d'abord. Les suggestions d'expressions ne
                s'affichent que lorsqu'aucune situation n'est disponible
                (mode libre) : à côté d'un choix multiple, elles
                donnaient la réponse. */}
            {missions && missions.length > 0 ? (
              <>
                <div className="mb-3">
                  <SituationBoard
                    situations={missions}
                    cursor={cursor}
                    outcomes={outcomes}
                    busy={sending || ending}
                    t={t}
                    onPick={(situation, option) =>
                      void pickOption(situation, option)
                    }
                    onContinue={continueMission}
                  />
                </div>
                <p className="mb-1.5 font-mono text-[0.5625rem] tracking-widest text-ink-3 uppercase">
                  {t("conv.situation.orFree")}
                </p>
              </>
            ) : suggestions.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s.expression}
                    type="button"
                    onClick={() => void sendMsg(s.expression)}
                    disabled={sending}
                    title={s.meaning}
                    className="rounded-full border border-gold/25 bg-gold/5 px-2.5 py-1 text-[0.6875rem] text-gold transition-colors hover:bg-gold/15 disabled:opacity-50"
                  >
                    {s.expression}
                  </button>
                ))}
              </div>
            ) : null}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMsg(input);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, MAX_LEN))}
                  placeholder={t("conv.placeholder")}
                  disabled={sending}
                  className="h-10 w-full rounded-xl border border-white/10 bg-noir-2 px-3 pr-14 text-sm text-ink placeholder:text-ink-3 focus:border-gold/60 focus:outline-none disabled:opacity-50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[0.625rem] text-ink-3">
                  {input.length}/{MAX_LEN}
                </span>
              </div>
              <button
                type="submit"
                disabled={sending || input.trim().length === 0}
                className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-r from-gold-strong to-gold text-noir transition-opacity hover:opacity-90 disabled:opacity-40"
                aria-label={t("conv.send")}
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Panneau latéral : objectifs + expressions utilisées */}
        <aside className="ln-card h-fit space-y-4 p-4">
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.25em] text-gold uppercase">
              <Flag className="size-3" /> {t("conv.objectives")}
            </h3>
            <ul className="space-y-1.5">
              {(conv?.objectives ?? []).map((o) => (
                <li key={o.expression} className="flex items-start gap-2 text-xs">
                  {o.done ? (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-green-400" />
                  ) : (
                    <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
                  )}
                  <span className={o.done ? "text-ink-3 line-through" : "text-ink-2"}>
                    {o.expression}
                  </span>
                </li>
              ))}
              {(conv?.objectives ?? []).length === 0 && (
                <li className="flex items-center gap-1.5">
                  {/* 1.3 — MODE LIBRE : badge dédié, jamais d'écran masqué. */}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[0.625rem] font-medium text-gold">
                    <Zap className="size-3" />
                    {t("conv.freeMode")}
                  </span>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-mono text-[0.625rem] tracking-[0.25em] text-gold uppercase">
              {t("conv.usedExpressions")}
            </h3>
            <div className="flex flex-wrap gap-1">
              {(conv?.expressionsUsed ?? []).map((e) => (
                <span
                  key={e}
                  className="rounded-full bg-gold/10 px-2 py-0.5 text-[0.625rem] text-gold"
                >
                  {e}
                </span>
              ))}
              {(conv?.expressionsUsed ?? []).length === 0 && (
                <span className="text-xs text-ink-3">—</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void end()}
            disabled={ending}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gold/40 py-2 text-xs font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
          >
            {ending && <Loader2 className="size-3 animate-spin" />}
            {t("conv.finish")}
          </button>
        </aside>
      </div>
    </div>
  );
}

/* ── 2.5 Écran de fin de mission (résultats) ───────────────────────── */

function Results({
  conversationId,
  result,
  t,
  replaying,
  onReplay,
  onHome,
}: {
  conversationId: Id<"aiConversations">;
  result: EndResult;
  t: TLabel;
  replaying: boolean;
  onReplay: () => void;
  onHome: () => void;
}) {
  const conv = useQuery(api.aiConversationStore.getConversation, {
    conversationId,
  });
  const mission = result.missions;
  const hasMission = !!mission && mission.total > 0;
  const cleared = hasMission && mission.passed === mission.total;
  // Flow Check : expression de la mission choisie pour la prise de voix.
  const [flowExp, setFlowExp] = useState<string | null>(null);
  const usedExpressions = conv?.expressionsUsed ?? [];
  const conversationLanguage = (conv?.language ?? "en") as LanguageCode;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6">
      {/* Titre + score de mission */}
      <div className="ln-card p-6 text-center">
        <p className="font-mono text-[0.625rem] tracking-[0.3em] text-gold uppercase">
          {t("conv.results")}
        </p>
        <p className="mt-2 font-display text-3xl font-bold text-ink">
          {cleared ? t("conv.recap.done") : t("conv.recap.ended")}
        </p>

        {hasMission ? (
          <>
            <p className="mt-4 font-display text-5xl font-bold text-gold">
              +{mission.xp} XP
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-ink-2">
              <li className="flex items-center justify-center gap-2">
                <Trophy className="size-4 text-gold" aria-hidden />
                {t("conv.recap.situations", {
                  passed: mission.passed,
                  total: mission.total,
                })}
              </li>
              <li className="flex items-center justify-center gap-2">
                <Sparkles className="size-4 text-gold" aria-hidden />
                {t("conv.recap.learned", { count: mission.learned })}
              </li>
              <li className="text-xs text-ink-3">
                {t("conv.quality")} {result.avgQuality} %
              </li>
            </ul>
          </>
        ) : (
          /* Mode libre (aucune situation jouable) : on garde le bilan
             historique — objectifs + XP, jamais un écran vide. */
          <>
            <p className="mt-3 font-display text-4xl font-bold text-ink">
              {result.objectivesDone}/{result.objectivesTotal}{" "}
              <span className="text-lg text-ink-2">{t("conv.objectives")}</span>
            </p>
            <p className="mt-1 text-sm text-ink-2">
              {t("conv.quality")} {result.avgQuality} %
            </p>
            <p className="mt-4 font-display text-5xl font-bold text-gold">
              +{result.xpGained} XP
            </p>
          </>
        )}
        <p className="mt-2 text-xs text-ink-3">
          {t("quiz.level")} {result.level} · {result.totalXP} XP
        </p>
      </div>

      {/* Badges débloqués */}
      {result.newBadges.length > 0 && (
        <div className="ln-card p-4">
          <h3 className="mb-2 font-mono text-[0.625rem] tracking-[0.25em] text-gold uppercase">
            {t("conv.newBadges")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {result.newBadges.map((id) => {
              const Icon = badgeIcon(id);
              return (
                <span
                  key={id}
                  className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold"
                >
                  <Icon className="size-3.5" /> {badgeLabel(id)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Expressions utilisées */}
      <div className="ln-card p-4">
        <h3 className="mb-2 font-mono text-[0.625rem] tracking-[0.25em] text-gold uppercase">
          {t("conv.usedExpressions")}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {(conv?.expressionsUsed ?? []).map((e) => (
            <span
              key={e}
              className="rounded-full border border-gold/25 bg-gold/5 px-2.5 py-1 text-[0.6875rem] text-gold"
            >
              {e}
            </span>
          ))}
          {(conv?.expressionsUsed ?? []).length === 0 && (
            <span className="text-xs text-ink-3">—</span>
          )}
        </div>
      </div>

      {/* Flow Check — la mission se prolonge par la voix : on choisit une
          expression réellement utilisée et on la dit à voix haute. */}
      {usedExpressions.length > 0 && (
        <div className="ln-card p-4">
          <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.25em] text-gold uppercase">
            <Mic className="size-3" /> {t("flow.title")}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {usedExpressions.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setFlowExp((current) => (current === e ? null : e))}
                aria-expanded={flowExp === e}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[0.6875rem] transition-colors",
                  flowExp === e
                    ? "border-gold bg-gold/15 text-gold"
                    : "border-gold/25 bg-gold/5 text-gold hover:bg-gold/10",
                )}
              >
                {e}
              </button>
            ))}
          </div>
          {flowExp && (
            <PronunciationCheck
              key={flowExp}
              className="mt-3"
              expression={flowExp}
              language={conversationLanguage}
            />
          )}
        </div>
      )}

      {/* D — trois issues claires : rejouer, changer de personnage, ou
          aller voir ses courbes. « Rejouer » crée une VRAIE nouvelle
          conversation (nouveaux objectifs, nouvelle banque d'argot). */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onReplay}
          disabled={replaying}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-strong to-gold py-3 text-sm font-semibold text-noir transition-opacity hover:opacity-90 disabled:cursor-progress disabled:opacity-60"
        >
          {replaying ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("conv.recap.replaying")}
            </>
          ) : (
            t("conv.recap.replay")
          )}
        </button>
        <button
          type="button"
          onClick={onHome}
          className="flex-1 rounded-xl border border-gold/40 py-3 text-sm font-medium text-gold transition-colors hover:bg-gold/10"
        >
          {t("conv.recap.otherCharacter")}
        </button>
        <Link
          to="/app/dashboard"
          className="flex flex-1 items-center justify-center rounded-xl border border-white/10 py-3 text-sm font-medium text-ink transition-colors hover:border-gold/40"
        >
          {t("conv.recap.dashboard")}
        </Link>
      </div>
    </div>
  );
}
