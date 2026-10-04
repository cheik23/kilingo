import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Languages } from "lucide-react";
import {
  activeSubtitle,
  formatTimestamp,
  type Subtitle,
} from "@/convex/subtitles";
import { SpeakButton } from "./SpeakButton";
import { TiltCard } from "@/components/fx/interact";
import { resolveInLang, type DictEntry } from "@/lib/dictionary";
import { useI18n, loadDefLang } from "@/lib/i18n";

/**
 * Encadré de traduction affiché sous le lecteur vidéo, façon karaoké :
 * la ligne originale est découpée en mots synchronisés sur l'horloge de
 * lecture (passés = or, courant = or clair + glow, futurs = blanc), chaque
 * mot est cliquable pour afficher une définition inline en accordéon,
 * badge ARGOT pulsant, prononciation native. Aucune mention de source
 * n'est jamais affichée — les définitions arrivent comme si de rien n'était.
 */

type WordState = "past" | "current" | "future";

/** Note discrète de repli (traduction indisponible) — jamais de source. */
function DefNote() {
  const { t } = useI18n();
  return <p className="text-[0.625rem] text-ink-3">{t("errors.defNote")}</p>;
}

/* ── Définition inline (accordéon, un seul mot déplié à la fois) ─────── */

function WordDefinition({
  entry,
  loading,
  fallback,
}: {
  entry: DictEntry | null;
  loading: boolean;
  fallback: boolean;
}) {
  if (loading) {
    return (
      <div className="ln-accordion mt-2 space-y-1.5 rounded-lg border border-white/5 bg-white/[0.02] p-3">
        <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-full animate-pulse rounded bg-white/10" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
      </div>
    );
  }
  if (!entry) {
    return (
      <div className="ln-accordion mt-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
        <p className="text-xs text-ink-3">
          Définition introuvable pour ce mot.
        </p>
      </div>
    );
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return (
    <div className="ln-accordion mt-2 space-y-1.5 rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <p className="text-sm leading-relaxed text-ink">
        <span className="mr-1.5">📖</span>
        <span className="font-medium text-gold">{entry.expression}</span>
        <span className="mx-1.5 text-ink-3">—</span>
        {entry.meaning}
      </p>
      {fallback && <DefNote />}
      {entry.example && (
        <p className="text-xs italic text-ink-2">{entry.example}</p>
      )}
      {(entry.context || entry.region || entry.register) && (
        <p className="font-mono text-[0.625rem] text-ink-3">
          {entry.context}
          {entry.context && (entry.region || entry.register) ? " · " : ""}
          {entry.region}
          {entry.region && entry.register ? " · " : ""}
          {entry.register}
        </p>
      )}
    </div>
  );
}

function KaraokeWords({
  text,
  progress,
  realIndex,
  knownKeys,
  expandedWord,
  onWordClick,
}: {
  text: string;
  progress: number;
  /** Index du mot courant selon les VRAIS timestamps du moteur — null quand
   * l'ASR n'en fournit pas (fallback proportionnel), -1 avant le 1er mot. */
  realIndex: number | null;
  knownKeys: Set<string>;
  expandedWord: string | null;
  onWordClick: (word: string, surface: string) => void;
}) {
  // split(/(\s+)/) keeps the whitespace tokens so spacing is preserved.
  const tokens = useMemo(() => text.split(/(\s+)/).filter(Boolean), [text]);
  const words = useMemo(
    () => tokens.filter((t) => !/^\s+$/.test(t)),
    [tokens],
  );
  if (words.length === 0) return null;

  // Priorité aux timestamps de mots RÉELS de l'ASR ; fallback proportionnel
  // (ancien comportement) quand le moteur n'en fournit pas.
  const activeIndex =
    realIndex !== null
      ? Math.min(realIndex, words.length - 1)
      : Math.floor(Math.min(1, Math.max(0, progress)) * words.length);

  return (
    <p className="font-mono text-sm leading-relaxed">
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token)) return token;
        const wordIndex = tokens
          .slice(0, i)
          .filter((t) => !/^\s+$/.test(t)).length;
        const state: WordState =
          wordIndex < activeIndex
            ? "past"
            : wordIndex === activeIndex
              ? "current"
              : "future";
        const cleaned = stripPunct(token);
        const isKnown = cleaned.length > 1 && knownKeys.has(cleaned.toLowerCase());
        const isExpanded = expandedWord === token;
        const cls =
          state === "past"
            ? "ln-word-past"
            : state === "current"
              ? "ln-word-current"
              : "ln-word-future";
        return (
          <button
            key={`${i}-${wordIndex}`}
            onClick={(e) => {
              e.preventDefault();
              onWordClick(token, token);
            }}
            className={`${cls} rounded-sm transition-colors hover:text-gold ${
              isKnown ? "decoration-dotted decoration-gold/40 underline underline-offset-4" : ""
            } ${isExpanded ? "bg-gold/10" : ""}`}
          >
            {token}
          </button>
        );
      })}
    </p>
  );
}

/** Accordéon de contexte (dépliage animé max-height + opacity). */
function ContextAccordion({ context }: { context?: string }) {
  const [open, setOpen] = useState(false);
  if (!context) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 font-mono text-[0.625rem] tracking-wider text-gold/80 uppercase transition-colors hover:text-gold"
      >
        <ChevronDown
          className={`size-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
        Définition
      </button>
      {open && (
        <div className="ln-accordion mt-1.5 text-xs leading-relaxed text-ink-2">
          {context}
        </div>
      )}
    </div>
  );
}

const PUNCT_RE = /[«».,!?;:…()[\]{}"'’“”]/g;

function stripPunct(w: string): string {
  return w.replace(PUNCT_RE, "");
}

export function SubtitlePanel({
  subtitles,
  currentTime,
  language,
  className = "",
}: {
  subtitles: Subtitle[];
  currentTime: number;
  language: string;
  className?: string;
}) {
  const active = useMemo(() => {
    const current = activeSubtitle(subtitles, currentTime);
    if (current) return current;
    // Hold : garde la dernière ligne affichée 3 s après sa fin (le rythme
    // des captions évite le clignotement entre deux segments).
    const past = subtitles.filter((s) => s.end <= currentTime);
    const last = past[past.length - 1];
    if (last && currentTime - last.end < 3) return last;
    return null;
  }, [subtitles, currentTime]);

  // Progression dans le segment actif → index du mot karaoké.
  const progress = active
    ? Math.min(
        1,
        Math.max(
          0,
          (currentTime - active.start) / Math.max(0.001, active.end - active.start),
        ),
      )
    : 0;

  // ── Karaoké mot par mot sur les VRAIS timestamps du moteur ───────────
  // `active.words` = horodatages faster-whisper (word_timestamps=True),
  // portés tels quels depuis l'ASR — jamais fabriqués. Quand le moteur ne
  // fournit pas de mots, le fallback proportionnel existant est conservé.
  const activeWordIndex = useMemo(() => {
    const ws = active?.words;
    if (ws && ws.length > 0) {
      const t = currentTime;
      if (t < ws[0].start) return -1;
      for (let i = ws.length - 1; i >= 0; i--) {
        if (t >= ws[i].start) return i;
        if (t < ws[i].end) return i - 1;
        if (t < ws[i].start) return i - 1;
      }
    }
    return null; // pas de mots moteur → fallback proportionnel
  }, [active, currentTime]);

  // ── Mots connus en base locale (soulignement pointillé) ──────────────
  const [knownKeys, setKnownKeys] = useState<Set<string>>(new Set());
  const activeText = active?.originalText ?? "";
  const activeId = active?.id ?? null;
  useEffect(() => {
    if (!activeText) {
      setKnownKeys(new Set());
      return;
    }
    const words = activeText
      .split(/\s+/)
      .map((w) => stripPunct(w).toLowerCase())
      .filter((w) => w.length > 1);
    if (words.length === 0) {
      setKnownKeys(new Set());
      return;
    }
    let cancelled = false;
    // knownWords expects lowercase normalized-ish strings; the server
    // normalizes further (case + diacritics).
    fetchKnown(words).then((keys) => {
      if (!cancelled) setKnownKeys(keys);
    });
    return () => {
      cancelled = true;
    };
  }, [activeId, activeText]);

  // ── Définition inline (un seul mot déplié à la fois) ────────────────
  const [expandedWord, setExpandedWord] = useState<string | null>(null);
  const [wordEntry, setWordEntry] = useState<DictEntry | null>(null);
  const [wordFallback, setWordFallback] = useState(false);
  const [wordLoading, setWordLoading] = useState(false);

  const handleWordClick = (word: string) => {
    if (expandedWord === word) {
      // Re-clic = repli.
      setExpandedWord(null);
      setWordEntry(null);
      return;
    }
    setExpandedWord(word);
    setWordEntry(null);
    setWordFallback(false);
    setWordLoading(true);
    resolveInLang(stripPunct(word), language, loadDefLang())
      .then((res) => {
        setWordEntry(res?.entry ?? null);
        setWordFallback(res?.fallback ?? false);
        setWordLoading(false);
      })
      .catch(() => {
        setWordEntry(null);
        setWordFallback(false);
        setWordLoading(false);
      });
  };

  return (
    <TiltCard
      className={`mx-auto w-full max-w-[800px] bg-noir-2 p-6 ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {active ? (
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="ln-segment-in flex items-start justify-between gap-4"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.625rem] text-ink-3">
                  {formatTimestamp(active.start)} → {formatTimestamp(active.end)}
                </span>
                {active.isSlang && (
                  <span className="ln-slang-badge rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[0.5625rem] font-semibold tracking-wider text-gold uppercase">
                    argot
                  </span>
                )}
              </div>
              <KaraokeWords
                text={active.originalText}
                progress={progress}
                realIndex={activeWordIndex}
                knownKeys={knownKeys}
                expandedWord={expandedWord}
                onWordClick={handleWordClick}
              />
              {/* LOT D — la ligne cible n'est JAMAIS la copie de l'original :
                  sans traduction, on affiche la source en italique gris, avec
                  la raison. L'ancien comportement (le backend recopiait la
                  source dans `translatedText`) faisait croire à un bug de
                  câblage. */}
              {active.translatedText ? (
                <p className="font-sans text-lg leading-snug font-medium text-ink">
                  {active.translatedText}
                </p>
              ) : (
                <p className="font-sans text-base leading-snug text-ink-3 italic">
                  {active.originalText}
                </p>
              )}
              {!active.translatedText && <DefNote />}
              {expandedWord && (
                <WordDefinition
                  entry={wordEntry}
                  loading={wordLoading}
                  fallback={wordFallback}
                />
              )}
              <ContextAccordion context={active.context} />
            </div>
            <SpeakButton
              text={active.originalText}
              language={language}
              className="mt-1"
            />
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex min-h-[96px] flex-col items-center justify-center gap-2 text-center"
          >
            <Languages className="size-5 text-ink-3" />
            <p className="text-sm text-ink-3">
              {subtitles.length > 0
                ? "Lance la vidéo — la traduction suit le son, ligne par ligne."
                : "Aucun sous-titre pour ce média."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </TiltCard>
  );
}

/* ── Utilitaire : mots connus via la requête publique ────────────────── */

async function fetchKnown(words: string[]): Promise<Set<string>> {
  try {
    const res = await fetch(`${convexHttpUrl()}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application.json" },
      body: JSON.stringify({
        path: "slang:knownWords",
        args: { words },
        format: "json",
      }),
    });
    if (!res.ok) return new Set();
    const data = (await res.json()) as { status?: string; value?: unknown };
    if (data.status !== "success" || !Array.isArray(data.value)) return new Set();
    return new Set(data.value.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function convexHttpUrl(): string {
  const ws = (import.meta.env.VITE_CONVEX_URL as string | undefined) ?? "";
  return ws.startsWith("ws") ? `https${ws.slice(3)}` : "";
}
