import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Check,
  CircleDashed,
  Flag,
  Flame,
  Loader2,
  Lock,
  MessageCircle,
  Send,
  Sparkles,
  Zap,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { loadDefLang, uiLangMeta, useI18n, type UiLang } from "@/lib/i18n";
import { isCharacterLockedError } from "@/lib/premiumLimits";
import { PremiumUpsell } from "./PremiumUpsell";
import { badgeIcon, badgeLabel } from "@/lib/badges";
import { cn } from "@/lib/utils";
import { LootBoxModal } from "./LootBoxModal";
import { showAchievementFeedback } from "@/lib/achievementFeedback";
import { soundEngine } from "@/lib/soundEngine";
import { PlaceHeader } from "@/components/fx/PlaceHeader";
import { Card3D } from "@/components/fx/Card3D";
import { RpmHead } from "@/components/fx/RpmHead";

/* ═══════════════════════════════════════════════════════════════════
   CONVERSATION IA (Phase 3/4) — personnages + scénarios + corrections
   temps réel. Thème or/noir (ln-card, text-gold, bg-noir).

   Écrans : accueil (personnage + scénario) → chat (temps réel) →
   résultats (XP, objectifs, badges). Aucun crash sur données vides :
   loading states + fallbacks partout, hooks toujours inconditionnels.
   ═══════════════════════════════════════════════════════════════════ */

const MAX_LEN = 500;

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
};

type TLabel = (k: string, p?: Record<string, string | number>) => string;

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

  const [screen, setScreen] = useState<"pick" | "chat" | "results">("pick");
  const [conversationId, setConversationId] = useState<Id<"aiConversations"> | null>(null);
  const [character, setCharacter] = useState<CharacterView | null>(null);
  const [scenario, setScenario] = useState<ScenarioView | null>(null);
  const [result, setResult] = useState<EndResult | null>(null);

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
        setScreen("chat");
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
        {t("conv.start")}
      </button>
    </div>
  );
}

/* ── 2.3 Interface de chat ──────────────────────────────────────────── */

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
  const myRpmAvatar = useQuery(api.customization.getMyRpmAvatarUrl, {});
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

  const sendMsg = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || sending) return;
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
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Envoi impossible.");
      } finally {
        setSending(false);
      }
    },
    [conversationId, send, sending, t],
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
      onFinished(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clôture impossible.");
      setEnding(false);
    }
  }, [conversationId, endConv, onFinished, t, checkAchievements]);

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
            {suggestions.length > 0 && (
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
            )}
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

/* ── 2.4 Écran de résultats ─────────────────────────────────────────── */

function Results({
  conversationId,
  result,
  t,
  onHome,
}: {
  conversationId: Id<"aiConversations">;
  result: EndResult;
  t: TLabel;
  onHome: () => void;
}) {
  const conv = useQuery(api.aiConversationStore.getConversation, {
    conversationId,
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6">
      {/* Score + XP */}
      <div className="ln-card p-6 text-center">
        <p className="font-mono text-[0.625rem] tracking-[0.3em] text-gold uppercase">
          {t("conv.results")}
        </p>
        <p className="mt-2 font-display text-4xl font-bold text-ink">
          {result.objectivesDone}/{result.objectivesTotal}{" "}
          <span className="text-lg text-ink-2">{t("conv.objectives")}</span>
        </p>
        <p className="mt-1 text-sm text-ink-2">
          {t("conv.quality")} {result.avgQuality} %
        </p>
        <p className="mt-4 font-display text-5xl font-bold text-gold">
          +{result.xpGained} XP
        </p>
        <p className="mt-1 text-xs text-ink-3">
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

      {/* Rejouer ce scénario / choisir un autre / retour hub */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onHome}
          className="flex-1 rounded-xl bg-gradient-to-r from-gold-strong to-gold py-3 text-sm font-semibold text-noir transition-opacity hover:opacity-90"
        >
          {t("conv.replay")}
        </button>
        <button
          type="button"
          onClick={onHome}
          className="flex-1 rounded-xl border border-gold/40 py-3 text-sm font-medium text-gold transition-colors hover:bg-gold/10"
        >
          {t("conv.backHub")}
        </button>
      </div>
    </div>
  );
}
