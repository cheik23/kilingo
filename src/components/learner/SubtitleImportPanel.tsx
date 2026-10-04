import { useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import {
  BookOpenCheck,
  Check,
  Languages,
  Loader2,
  Sparkles,
  Upload,
  FileText,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import {
  parseSubtitles,
  SubtitleParseError,
  type ParsedSubtitleSegment,
} from "@/lib/subtitleParse";
import { UI_LANGS, uiLangMeta, loadStoredTargetLang, storeTargetLang } from "@/lib/i18n";
import type { UiLang } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════════
   PANNEAU D'IMPORT SRT/VTT — porte de secours universelle (LOT B → LOT D)

   Un seul composant pour les 3 points d'entrée (session Shadow, idle
   Shadow, média en salle) : fichier .srt/.vtt/.txt OU texte collé → lecture
   CLIENT pure (subtitleParse) → callback avec les lignes.

   LOT D — deux ajouts :
   · la LANGUE DU FICHIER est déclarée ici, parce que le texte traduit ne
     peut pas être deviné de façon fiable : un .srt anglais pendant qu'on
     apprend le yoruba doit être traduit en → cible. Par défaut on propose
     la langue d'apprentissage (le cas le plus courant : les sous-titres
     sont dans la langue qu'on étudie) ;
   · « Traduire un texte » traduit le texte ENTIER, paragraphe par
     paragraphe — pas ligne par ligne. Une chanson ou un article se lisent
     d'un bloc : la traduction suit le sens, et l'argot détecté part dans
     Ma mémoire en un clic.
   ═══════════════════════════════════════════════════════════════════════ */

const MAX_BYTES = 2_000_000; // 2 Mo

export type SubtitleImportMeta = {
  synced: boolean;
  sourceName: string;
  /** Langue réelle du texte importé (LOT D). */
  sourceLang: string;
  truncated?: boolean;
};

type DetectedSlang = {
  slangId: string;
  expression: string;
  meaning: string;
  context?: string;
};

type BlockResult = {
  translation: string;
  blocks: number;
  cached: boolean;
  detected: DetectedSlang[];
};

/** Raisons renvoyées par l'action — toujours une phrase, jamais une trace. */
const BLOCK_ERRORS: Record<string, string> = {
  empty: "Colle d'abord un texte.",
  too_long: "Ce texte est trop long (24 000 caractères maximum).",
  not_signed_in: "Connecte-toi pour traduire un texte.",
};

export function SubtitleImportPanel({
  onImport,
  onClose,
  defaultSourceLang = "en",
}: {
  onImport: (
    segments: ParsedSubtitleSegment[],
    meta: SubtitleImportMeta,
  ) => void;
  onClose: () => void;
  defaultSourceLang?: string;
}) {
  const [mode, setMode] = useState<"file" | "text" | "block">("file");
  const [draft, setDraft] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState(defaultSourceLang);
  const [targetLang, setTargetLang] = useState<string>(loadStoredTargetLang);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ── « Traduire un texte » (traduction intégrale en blocs) ────────────
  const translateBlock = useAction(api.textTranslate.translateTextBlock);
  const addToSrs = useMutation(api.learning.addToSrs);
  const [blockBusy, setBlockBusy] = useState(false);
  const [block, setBlock] = useState<BlockResult | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const ingest = (text: string, name: string) => {
    if (text.length > MAX_BYTES) {
      toast.error("Ce fichier est trop gros (2 Mo maximum).");
      return;
    }
    setBusy(true);
    try {
      const result = parseSubtitles(text);
      onImport(result.segments, {
        synced: result.synced,
        sourceName: name,
        sourceLang,
        ...(result.truncated ? { truncated: true } : {}),
      });
    } catch (err) {
      // Jamais de crash : une phrase claire dans un toast.
      const reason =
        err instanceof SubtitleParseError
          ? err.reason === "empty"
            ? "Le fichier est vide."
            : err.reason === "too_large"
              ? "Ce fichier est trop gros (2 Mo maximum)."
              : "On n'a pas reconnu le format — un fichier .srt ou .vtt est attendu."
          : "On n'a pas reconnu le format — un fichier .srt ou .vtt est attendu.";
      toast.error(reason);
    } finally {
      setBusy(false);
    }
  };

  /** Traduit le texte collé d'un bloc (un paragraphe = une unité de sens). */
  const handleBlockTranslate = async () => {
    const text = draft.trim();
    if (text.length < 2) {
      toast.error(BLOCK_ERRORS.empty);
      return;
    }
    setBlockBusy(true);
    setAdded(new Set());
    try {
      const result = await translateBlock({
        text,
        sourceLanguage: sourceLang as UiLang,
        targetLanguage: targetLang as UiLang,
      });
      if (!result.ok) {
        toast.error(BLOCK_ERRORS[result.reason] ?? "La traduction est indisponible pour le moment.");
        setBlock(null);
        return;
      }
      setBlock({
        translation: result.translation,
        blocks: result.blocks,
        cached: result.cached,
        detected: result.detected,
      });
      storeTargetLang(targetLang as UiLang);
    } catch (err) {
      console.error("[SubtitleImport] traduction de texte impossible:", err);
      toast.error("La traduction est indisponible pour le moment.");
    } finally {
      setBlockBusy(false);
    }
  };

  /** « + Ma mémoire » : une expression détectée → une carte SRS. */
  const handleAddToMemory = async (hit: DetectedSlang) => {
    try {
      const res = await addToSrs({ slangId: hit.slangId as never });
      if (!res.ok) {
        toast.info(
          res.reason === "already"
            ? `« ${hit.expression} » est déjà dans ta mémoire.`
            : `« ${hit.expression} » est déjà couvert par tes langues de focus.`,
        );
        return;
      }
      setAdded((prev) => new Set(prev).add(hit.slangId));
      toast.success(`« ${hit.expression} » ajouté à Ma mémoire`);
    } catch (err) {
      console.error("[SubtitleImport] ajout mémoire impossible:", err);
      toast.error("Ajout impossible — réessaie.");
    }
  };

  const handleAddAll = async () => {
    const pending = (block?.detected ?? []).filter((hit) => !added.has(hit.slangId));
    for (const hit of pending) {
      await handleAddToMemory(hit);
    }
  };

  const langSelects = (
    <div className="mt-4 flex flex-wrap items-end gap-4">
      <label htmlFor="subs-source-lang" className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
          <Languages className="size-3.5 text-gold" aria-hidden />
          Langue de ce texte
        </span>
        <select
          id="subs-source-lang"
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
          className="appearance-none rounded-lg border border-white/10 bg-noir-2 px-3 py-1.5 text-xs text-ink transition-colors hover:border-white/25 focus:border-gold/50 focus:outline-none"
        >
          {UI_LANGS.map((code) => {
            const meta = uiLangMeta(code);
            return (
              <option key={code} value={code}>
                {meta.flag} {meta.native}
              </option>
            );
          })}
        </select>
      </label>
      {mode === "block" && (
        <label htmlFor="subs-target-lang" className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
            <Languages className="size-3.5 text-gold" aria-hidden />
            Traduire vers
          </span>
          <select
            id="subs-target-lang"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="appearance-none rounded-lg border border-white/10 bg-noir-2 px-3 py-1.5 text-xs text-ink transition-colors hover:border-white/25 focus:border-gold/50 focus:outline-none"
          >
            {UI_LANGS.map((code) => {
              const meta = uiLangMeta(code);
              return (
                <option key={code} value={code}>
                  {meta.flag} {meta.native}
                </option>
              );
            })}
          </select>
        </label>
      )}
    </div>
  );

  return (
    <div className="ln-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs tracking-widest text-gold uppercase">
          Importer des sous-titres
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-lg p-1 text-ink-3 transition-colors hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-2">
        Un fichier .srt / .vtt / .txt (2 Mo max), du texte collé ligne par
        ligne, ou un texte entier à traduire d'un bloc.
      </p>

      {langSelects}

      {/* Trois entrées possibles : fichier, texte lignes, texte entier. */}
      <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-white/8 bg-noir/70 p-1">
        {(
          [
            ["file", "Fichier", Upload],
            ["text", "Coller un texte", FileText],
            ["block", "Traduire un texte", BookOpenCheck],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            aria-pressed={mode === key}
            className={
              "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center text-[0.6875rem] leading-tight transition-colors " +
              (mode === key ? "bg-gold/15 text-gold" : "text-ink-3 hover:text-ink")
            }
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {mode === "file" ? (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="mt-3 w-full rounded-2xl border border-dashed border-white/15 bg-noir/40 p-6 text-center transition-colors hover:border-gold/40 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="mx-auto size-7 animate-spin text-gold" />
            ) : (
              <Upload className="mx-auto size-7 text-gold" />
            )}
            <p className="mt-2 text-sm text-ink-2">
              {fileName
                ? `« ${fileName} » — clique pour en choisir un autre`
                : "Choisir un fichier .srt / .vtt / .txt"}
            </p>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".srt,.vtt,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (f.size > MAX_BYTES) {
                toast.error("Ce fichier est trop gros (2 Mo maximum).");
                return;
              }
              setFileName(f.name);
              void f.text().then((text) => ingest(text, f.name));
            }}
          />
        </>
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={mode === "block" ? 10 : 8}
            placeholder={
              mode === "block"
                ? "Colle le texte entier : paroles d'une chanson, article, dialogue…\n\nLa traduction suit les paragraphes — pas les lignes.\n\nC'est tout : la traduction et l'argot arrivent d'un coup."
                : "Colle ici les lignes à étudier.\n\nAvec leurs temps (recommandé) :\n1\n00:00:01,000 --> 00:00:03,500\nHello world\n\nOu juste le texte, une ligne par phrase."
            }
            className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-noir/60 p-3 font-mono text-xs leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-gold/50"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="font-mono text-[0.625rem] text-ink-3">
              {draft.trim().length.toLocaleString("fr-FR")} caractères
            </p>
            <button
              type="button"
              disabled={
                (mode === "block" ? blockBusy : busy) || draft.trim().length < 2
              }
              onClick={() =>
                mode === "block"
                  ? void handleBlockTranslate()
                  : ingest(draft, "texte collé")
              }
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-4 py-2 text-xs font-semibold text-noir transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {mode === "block" ? (
                blockBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Languages className="size-3.5" />
                )
              ) : busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {mode === "block" ? "Traduire tout" : "Analyser ce texte"}
            </button>
          </div>
        </>
      )}

      {/* ── Traduction intégrale + argot détecté (argot → 1 clic) ─────── */}
      {mode === "block" && blockBusy && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-gold/20 bg-gold/5 p-3 text-xs text-ink-2">
          <Loader2 className="size-4 animate-spin text-gold" />
          Traduction en cours — le texte complet, paragraphe par paragraphe…
        </div>
      )}
      {mode === "block" && block && !blockBusy && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[0.625rem] tracking-widest text-gold uppercase">
              Traduction
            </p>
            <p className="font-mono text-[0.625rem] text-ink-3">
              {block.blocks} bloc{block.blocks > 1 ? "s" : ""}
              {block.cached ? " · déjà traduit" : ""}
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-noir/60 p-4 text-sm leading-relaxed whitespace-pre-wrap text-ink">
            {block.translation}
          </div>

          {block.detected.length > 0 ? (
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
                  <Sparkles className="size-3.5" aria-hidden />
                  Argot repéré ({block.detected.length})
                </p>
                {block.detected.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void handleAddAll()}
                    className="rounded-full border border-gold/40 px-3 py-1 text-[0.625rem] font-semibold text-gold transition-colors hover:bg-gold/10"
                  >
                    Tout ajouter à Ma mémoire
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {block.detected.map((hit) => (
                  <div
                    key={hit.slangId}
                    className="flex items-start justify-between gap-3 rounded-xl border border-gold/20 bg-gold/[0.05] p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gold">{hit.expression}</p>
                      <p className="text-sm text-ink">{hit.meaning}</p>
                      {hit.context && (
                        <p className="mt-1 text-xs text-ink-3">{hit.context}</p>
                      )}
                    </div>
                    {added.has(hit.slangId) ? (
                      <span className="flex shrink-0 items-center gap-1 font-mono text-[0.625rem] text-gold/80">
                        <Check className="size-3" /> en mémoire
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleAddToMemory(hit)}
                        className="shrink-0 rounded-full border border-gold/40 px-3 py-1 text-[0.625rem] font-semibold text-gold transition-colors hover:bg-gold/10"
                      >
                        + Ma mémoire
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 p-3 text-xs text-ink-3">
              Aucune expression d'argot connue dans ce texte — la traduction
              reste disponible ci-dessus.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
