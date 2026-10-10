import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Flag,
  Hand,
  Info,
  Pause,
  Play,
  RotateCcw,
  Search,
  ScrollText,
} from "lucide-react";

import { api } from "@/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PlaceHeader } from "@/components/fx/PlaceHeader";

/* ═══════════════════════════════════════════════════════════════════════
   LANGUE DES SIGNES (LSF)

   Ce que cette page est, et ce qu'elle refuse d'être :

   · Les clips sont des VIDÉOS DE PERSONNES QUI SIGNENT, prises sur
     Wikimedia Commons. Rien n'est dessiné, rien n'est généré.

   · Chaque clip porte sa licence, lue dans les métadonnées du fichier
     Commons. Le crédit s'affiche sur la fiche, systématiquement — c'est
     une     obligation CC BY, pas une politesse, et c'est aussi la seule
     façon de rendre visible qui a enseigné ces signes.

   · Les mots affichés sont les NOMS DES FICHIERS. Ils sont donc
     marqués « à valider » et chaque fiche ouvre un bouton « Signaler
     une erreur » : sans cette porte, la page ferait passer des noms de
     fichiers pour une nomenclature validée par des locuteurs.

   · L'interface dit ce que la LSF n'est pas (ni ASL, ni langue des
     signes africaine) et qu'un signeur n'est pas « la » LSF. Cette page
     n'annonce aucune autre langue des signes — il n'y en a aucune de
     libre de droits ici.
   ═══════════════════════════════════════════════════════════════════════ */

type Sign = {
  id: string;
  gloss: string;
  theme: string;
  signer: string;
  license: string;
  usageTerms: string;
  licenseUrl: string;
  attributionRequired: boolean;
  descriptionUrl: string;
  videoUrl: string;
  bytes: number;
  sourceSet: string;
  sourceLabel: string;
  verified: boolean;
  seen?: boolean;
};

const PAGE = 60;

function SignVideo({
  sign,
  autoPlay = false,
  className,
}: {
  sign: Sign;
  autoPlay?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  return (
    <video
      ref={ref}
      src={sign.videoUrl}
      // `muted` + `playsInline` : sans eux, le navigateur refuse la
      // lecture automatique — et sans lecture automatique, une fiche de
      // signe reste une image morte.
      muted
      playsInline
      loop={autoPlay}
      autoPlay={autoPlay}
      preload={autoPlay ? "auto" : "metadata"}
      onMouseEnter={() => {
        const v = ref.current;
        if (!v) return;
        v.preload = "auto";
        void v.play().catch(() => undefined);
      }}
      onMouseLeave={() => {
        const v = ref.current;
        if (v && autoPlay) v.pause();
      }}
      className={cn("h-full w-full bg-noir object-contain", className)}
    />
  );
}

/**
 * Réchauffe la vidéo d'une carte DÈS que l'utilisateur la touche.
 *
 * MODULE B1 — la grille ne se chargeait qu'au survol (`onMouseEnter`).
 * Au doigt il n'y a pas de survol : la carte restait un cadre noir, et
 * « rien ne se passe » était la seule impression possible. Le geste
 * réel (`pointerdown`, qui couvre souris, stylet ET toucher) et le
 * clavier (`focus`) déclenchent maintenant le chargement, donc la
 * lecture commence au moment où l'utilisateur décide de regarder.
 */
function warmCardVideo(el: HTMLElement | null): void {
  const v = el?.querySelector("video");
  if (!v) return;
  v.preload = "auto";
  v.loop = true;
  void v.play().catch(() => undefined);
}

/** Le crédit voyage avec le clip : jamais dans une note de bas de page. */
function SignCredit({ sign, t }: { sign: Sign; t: (k: string) => string }) {
  return (
    <p className="text-[0.625rem] leading-relaxed text-ink-3">
      {t("signs.by")}{" "}
      <span className="text-ink-2">{sign.signer}</span> ·{" "}
      <a
        href={sign.licenseUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="text-gold/80 underline underline-offset-2"
      >
        {sign.license}
      </a>{" "}
      ·{" "}
      <a
        href={sign.descriptionUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="underline underline-offset-2 hover:text-gold"
      >
        {t("signs.source")}
      </a>
    </p>
  );
}

/* ── Fiche détaillée ───────────────────────────────────────────────── */

function SignSheet({
  sign,
  onClose,
}: {
  sign: Sign;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const markSeen = useMutation(api.signs.markSeen);
  const reportSign = useMutation(api.signs.reportSign);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("wrongWord");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const replay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.playbackRate = 1;
    void v.play().catch(() => undefined);
  };
  const slow = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.playbackRate = 0.5;
    void v.play().catch(() => undefined);
  };

  const send = async () => {
    setSending(true);
    try {
      await reportSign({ signId: sign.id, reason, note: note || undefined });
      toast.success(t("signs.reportDone"));
      setReporting(false);
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="ln-card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">{sign.gloss}</h2>
            {/* Le gloss vient du nom du fichier Commons : on le dit. */}
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2 py-0.5 text-[0.5625rem] text-ink-2">
              <AlertTriangle className="size-2.5" /> {t("signs.toValidate")}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-ink-3 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-noir">
          <video
            ref={videoRef}
            src={sign.videoUrl}
            muted
            playsInline
            loop
            autoPlay
            preload="auto"
            onPlay={() => void markSeen({ signId: sign.id })}
            className="h-full w-full object-contain"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={replay}
            className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm font-medium text-gold hover:bg-gold/20"
          >
            <RotateCcw className="size-3.5" /> {t("signs.repeat")}
          </button>
          <button
            type="button"
            onClick={slow}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-ink-2 hover:border-gold/40 hover:text-gold"
          >
            <Play className="size-3.5" /> {t("signs.slow")}
          </button>
          <button
            type="button"
            onClick={() => setReporting((r) => !r)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-ink-2 hover:border-gold/40 hover:text-gold"
          >
            <Flag className="size-3.5" /> {t("signs.report")}
          </button>
        </div>

        <div className="mt-4 border-t border-white/5 pt-3">
          <SignCredit sign={sign} t={t} />
          <p className="mt-1 text-[0.625rem] text-ink-3">
            {sign.sourceLabel} · {(sign.bytes / 1024).toFixed(0)} Ko
          </p>
        </div>

        {reporting ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-noir-2/60 p-3">
            <p className="text-sm font-semibold text-ink">{t("signs.reportTitle")}</p>
            <p className="mt-1 text-xs text-ink-2">{t("signs.reportBody")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ["wrongWord", t("signs.reportReasons.wrongWord")],
                  ["duplicate", t("signs.reportReasons.duplicate")],
                  ["wrongSign", t("signs.reportReasons.wrongSign")],
                  ["other", t("signs.reportReasons.other")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setReason(id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    reason === id
                      ? "border-gold/50 bg-gold/10 text-gold"
                      : "border-white/10 text-ink-2 hover:border-white/25",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={t("signs.reportNote")}
              className="mt-3 w-full rounded-lg border border-white/10 bg-noir px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-gold/40"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending}
                className="rounded-lg bg-gradient-to-r from-gold-strong to-gold px-3 py-1.5 text-sm font-semibold text-noir disabled:opacity-50"
              >
                {t("signs.reportSend")}
              </button>
              <button
                type="button"
                onClick={() => setReporting(false)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-ink-2"
              >
                {t("signs.reportCancel")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Quiz des signes ───────────────────────────────────────────────── */

function SignQuiz({ signs, t }: { signs: Sign[]; t: (k: string) => string }) {
  const submitGuess = useMutation(api.signs.submitGuess);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<{ correct: boolean; gloss: string; xp: number } | null>(
    null,
  );

  // Quatre propositions : le bon mot + trois autres, de préférence du même
  // thème pour que le choix porte sur le sens et pas sur le pangage.
  //
  // Les glosss sont DÉDUPLIQUÉS : le catalogue contient le même mot
  // signé par plusieurs personnes (« au revoir » par Taliba31 et par
  // Hugo en résidence), et trois clones d'un même mot donnaient un
  // QCM à deux bonnes réponses — ou aucune. On ne garde donc que des
  // mots distincts, et on complète avec d'autres signes si le thème
  // n'en offre pas assez.
  const round = useMemo(() => {
    if (signs.length < 4) return null;
    const answer = signs[index % signs.length];
    const key = (s: Sign) => s.gloss.trim().toLowerCase();
    const answerKey = key(answer);
    const pool = signs.filter((s) => key(s) !== answerKey);
    const sameTheme = pool.filter((s) => s.theme === answer.theme);
    const others = [...sameTheme, ...pool.filter((s) => s.theme !== answer.theme)];
    const picked = [...others]
      .sort(() => Math.random() - 0.5)
      .filter((s, _i, arr) => arr.findIndex((o) => key(o) === key(s)) === _i)
      .slice(0, 3)
      .map((s) => s.gloss);
    // La bonne réponse FAIT PARTIE des propositions. Elle en était
    // absente : le QCM proposait trois distracteurs et la bonne réponse
    // n'était nulle part — donc aucune réponse n'était jamais juste, et
    // le joueur ne pouvait ni gagner d'XP ni progresser.
    const options = [answer.gloss, ...picked];
    return { answer, options: options.sort(() => Math.random() - 0.5) };
  }, [signs, index]);

  if (!round) {
    return <p className="text-sm text-ink-3">{t("signs.quizEmpty")}</p>;
  }

  const choose = async (option: string) => {
    if (result) return;
    const r = await submitGuess({ signId: round.answer.id, guess: option });
    setPicked(option);
    setResult({ correct: r.correct, gloss: r.gloss, xp: r.xpGained });
  };
  const next = () => {
    setPicked(null);
    setResult(null);
    setIndex((i) => i + 1);
  };

  return (
    <div className="ln-card p-5">
      <h2 className="font-display text-lg text-ink">{t("signs.quizTitle")}</h2>
      <p className="mt-1 text-sm text-ink-2">{t("signs.quizBody")}</p>
      <p className="mt-3 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
        {t("signs.quizQuestion")}
      </p>
      <div className="mx-auto mt-3 aspect-video max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-noir">
        <SignVideo sign={round.answer} autoPlay />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {round.options.map((option) => {
          const isAnswer = option === round.answer.gloss;
          const chosen = option === picked;
          return (
            <button
              key={option}
              type="button"
              onClick={() => void choose(option)}
              disabled={!!result}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm transition-colors",
                !result && "border-white/10 text-ink-2 hover:border-gold/50 hover:text-gold",
                result && isAnswer && "border-gold bg-gold/10 text-gold",
                result && chosen && !isAnswer && "border-white/20 text-ink-3 line-through",
                result && !chosen && !isAnswer && "border-white/5 text-ink-3 opacity-60",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      {result ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "flex items-center gap-1.5 text-sm font-semibold",
              result.correct ? "text-gold" : "text-ink-2",
            )}
          >
            {result.correct ? <Check className="size-4" /> : <Pause className="size-4" />}
            {result.correct ? t("signs.quizRight") : `${t("signs.quizWrong")} « ${result.gloss} »`}
          </span>
          {result.xp > 0 ? <span className="text-xs text-ink-3">+{result.xp} XP</span> : null}
          <button
            type="button"
            onClick={next}
            className="ml-auto rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm font-medium text-gold hover:bg-gold/20"
          >
            {t("signs.quizNext")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ── La section ────────────────────────────────────────────────────── */

export function SignLanguageView() {
  const { t } = useI18n();
  const [theme, setTheme] = useState("tous");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Sign | null>(null);

  const themes = useQuery(api.signs.listThemes, {});
  const result = useQuery(api.signs.listSigns, { theme, q: q || undefined, limit });

  const signs = result?.signs ?? [];
  const total = result?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PlaceHeader
        place="signs"
        title={t("signs.title")}
        icon={Hand}
        motif="adinkra"
        description={t("signs.subtitle")}
        actions={
          <Link
            to="/app/signs/credits"
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-ink-2 hover:border-gold/40 hover:text-gold"
          >
            <ScrollText className="size-3.5" /> {t("signs.credits")}
          </Link>
        }
      />

      {/* Honnêteté — avant tout, pas dans une note de bas de page. */}
      <div className="ln-card border-gold/30 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-gold">
          <Info className="size-4" /> {t("signs.honestTitle")}
        </p>
        <p className="mt-2 text-sm text-ink-2">{t("signs.honestBody")}</p>
        <p className="mt-1.5 text-sm text-ink-2">{t("signs.honestVariant")}</p>
      </div>

      {/* Filtres */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={t("signs.search")}
            className="ln-card w-full py-2.5 ps-9 pe-3 text-sm text-ink outline-none placeholder:text-ink-3"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setTheme("tous");
              setLimit(PAGE);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              theme === "tous"
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-white/10 text-ink-2 hover:border-white/25",
            )}
          >
            {t("signs.themeAll")}
            {themes ? ` · ${themes.total}` : ""}
          </button>
          {(themes?.themes ?? []).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTheme(item.id);
                setLimit(PAGE);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                theme === item.id
                  ? "border-gold/50 bg-gold/10 text-gold"
                  : "border-white/10 text-ink-2 hover:border-white/25",
              )}
            >
              {item.label} · {item.count}
            </button>
          ))}
        </div>
      </div>

      {/* Grille */}
      {result === undefined ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : signs.length === 0 ? (
        <p className="ln-card p-4 text-sm text-ink-3">{t("signs.notStarted")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {signs.map((sign) => (
            /* Pas de Card3D ici : le basculement 3D, le grossissement 1.03
               et le reflet qui suivait le curseur passaient PAR-DESSUS le
               clip — on doit voir le signe à tout moment. La carte garde
               son cadre, sa bordure et son ombre, sans effet de survol. */
            <div key={sign.id} className="ln-card flex flex-col p-3">
              <button
                type="button"
                // MODULE B1 — toute la carte est cliquable, et le geste
                // déclenche le chargement. Pas de « ça marche à la souris
                // seulement ».
                onPointerDown={(e) => warmCardVideo(e.currentTarget)}
                onFocus={(e) => warmCardVideo(e.currentTarget)}
                onClick={() => setOpen(sign)}
                className="flex flex-col text-start"
                title={sign.gloss}
              >
                <span className="relative block aspect-video w-full overflow-hidden rounded-xl bg-noir">
                  <SignVideo sign={sign} />
                  {/* Pastille de lecture, toujours visible : sur un écran
                      tactile, une carte sans image fait croire à un
                      contenu cassé. `pointer-events-none` : elle ne peut
                      jamais voler le clic à la carte. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute end-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full bg-black/70"
                  >
                    <Play className="size-3 text-gold" />
                  </span>
                </span>
                <span className="mt-2 text-sm font-semibold text-ink">{sign.gloss}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[0.5625rem] text-ink-3">
                    {sign.license}
                  </span>
                  {!sign.verified ? (
                    <span className="rounded-full border border-white/15 px-1.5 py-0.5 text-[0.5625rem] text-ink-2">
                      {t("signs.toValidate")}
                    </span>
                  ) : null}
                  {sign.seen ? (
                    <span className="font-mono text-[0.5625rem] text-gold/70">
                      ✓ {t("signs.seen")}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-[0.625rem] text-ink-3">
                  {t("signs.by")} {sign.signer}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {result && signs.length < total ? (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="w-full rounded-xl border border-white/10 py-2.5 text-sm text-ink-2 hover:border-gold/40 hover:text-gold"
        >
          + {Math.min(PAGE, total - signs.length)}
        </button>
      ) : null}

      {signs.length >= 4 ? <SignQuiz signs={signs} t={t} /> : null}

      {open ? <SignSheet sign={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
