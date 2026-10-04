import { useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import {
  BookOpen,
  ExternalLink,
  Globe,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { UiLang } from "@/lib/i18n";
import { useLocalizedText } from "@/lib/translate";

/* ═══════════════════════════════════════════════════════════════════
   BOOK DETAIL (lot UX v2, D) — fiche Google Books traduite.

   - Description TRADUITE dans la langue cible choisie (cascade client
     MyMemory, cache 24 h par (bookId + target)) ; skeleton pendant le
     chargement ; échec = texte original + note grise.
   - Aperçu : iframe Google Books quand previewLink existe.
   - « Étudier un extrait » : panneau texte → pipeline existant
     (createHubMedia + analyzeHubSegments, traduction + argot).
   - Boutons externes : Google Books (previewLink/infoLink) et
     archive.org (prêts légaux uniquement).
   ═══════════════════════════════════════════════════════════════════ */

export type BookDetailInput = {
  bookId: string;
  title: string;
  author: string;
  year: string;
  coverUrl: string;
  description: string;
  previewLink: string;
  lang?: string;
};

/** Un extrait a-t-il l'air d'un résumé/annonce ? (prêts légaux archive.org) */
function isDescriptionLike(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /publish|éditions?|roman|novel|author|bestsell|prix|award|collection/.test(t) ||
    text.trim().length > 120
  );
}

export function BookDetail({
  book,
  language,
  onClose,
}: {
  book: BookDetailInput;
  language: UiLang;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"about" | "preview" | "excerpt">("about");
  const [excerpt, setExcerpt] = useState("");
  const [studying, setStudying] = useState(false);

  const createMedia = useMutation(api.media.createHubMedia);
  const analyzeSegments = useAction(api.mediaHub2.analyzeHubSegments);
  const searchArchive = useAction(api.mediaHub3.archiveTextSearch);
  const [archiveUrl, setArchiveUrl] = useState<string | null>(null);

  // D2 — description traduite dans la langue cible (détail = fiche de
  // service, hors pipeline média : cascade client, cache 24 h).
  const sourceLang = book.lang && book.lang.length === 2 ? book.lang : "en";
  const desc = useLocalizedText(
    book.description || undefined,
    sourceLang,
    language,
  );
  const translated = Boolean(desc.value) && desc.value !== book.description;

  // D4 — archive.org : prêts légaux uniquement (description-like match).
  useEffect(() => {
    let alive = true;
    setArchiveUrl(null);
    searchArchive({ query: `${book.title} ${book.author}`.trim(), limit: 4 })
      .then((res) => {
        if (!alive) return;
        const hit = (res.items ?? []).find(
          (it: { description?: string }) =>
            typeof it.description === "string" &&
            isDescriptionLike(it.description),
        );
        if (hit?.identifier) {
          setArchiveUrl(
            `https://archive.org/details/${encodeURIComponent(hit.identifier)}`,
          );
        }
      })
      .catch(() => {
        /* repli silencieux : bouton non affiché */
      });
    return () => {
      alive = false;
    };
  }, [book.title, book.author, searchArchive]);

  /** D5 — « Étudier un extrait » : pipeline existant, aucune duplication. */
  const studyExcerpt = async () => {
    const text = excerpt.trim();
    if (text.length < 40) {
      toast.error("Colle d'abord un extrait d'au moins quelques phrases.");
      return;
    }
    setStudying(true);
    try {
      // 1 phrase ≈ 1 segment, 6 s de lecture estimée.
      const sentences = text
        .split(/(?<=[.!?…])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 60);
      const segments = sentences.map((s, i) => ({
        start: i * 6,
        end: (i + 1) * 6,
        text: s.slice(0, 400),
      }));
      const id = await createMedia({
        language: (book.lang && book.lang.length === 2 ? book.lang : "en") as "en",
        title: `${book.title}${book.author ? ` — ${book.author}` : ""}`,
        sourceName: "Google Books",
        mediaType: "book",
      });
      await analyzeSegments({
        mediaId: id,
        language: (book.lang && book.lang.length === 2 ? book.lang : "en") as "en",
        segments,
        transcriptSource: "book_excerpt",
      });
      toast.success("Extrait ajouté — traduction et repérage de l'argot en cours.");
      setExcerpt("");
      setTab("about");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Analyse impossible.",
      );
    } finally {
      setStudying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="ln-card relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden">
        {/* En-tête */}
        <div className="flex items-start gap-4 border-b border-white/5 p-4 sm:p-5">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt=""
              className="h-32 w-22 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-32 w-22 shrink-0 items-center justify-center rounded-lg bg-white/5">
              <BookOpen className="size-6 text-ink-3" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[0.625rem] tracking-[0.3em] text-gold uppercase">
              Google Books {book.year && `· ${book.year}`}
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold leading-tight text-ink">
              {book.title}
            </h2>
            <p className="mt-1 text-sm text-ink-2">{book.author}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-2.5 py-0.5 text-[0.6875rem] text-gold">
                <Globe className="size-3" /> Traduire vers : {language.toUpperCase()}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1 text-ink-3 transition-colors hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 border-b border-white/5 px-4 sm:px-5">
          {(
            [
              ["about", "Résumé"],
              ...(book.previewLink ? ([["preview", "Aperçu"]] as const) : []),
              ["excerpt", "Étudier un extrait"],
            ] as [typeof tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`shrink-0 border-b-2 px-3 py-2 text-xs transition-colors ${
                tab === key
                  ? "border-gold text-gold"
                  : "border-transparent text-ink-3 hover:text-ink-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {tab === "about" && (
            <div className="space-y-3">
              {desc.loading ? (
                <div className="space-y-2">
                  <div className="h-3 w-full animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-11/12 animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
                </div>
              ) : desc.value ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">
                  {desc.value}
                </p>
              ) : (
                <p className="text-sm text-ink-3">
                  Aucun résumé disponible pour ce titre.
                </p>
              )}
              {/* D2 — échec : texte original déjà affiché + note grise. */}
              {!desc.loading && translated && (
                <p className="text-[0.6875rem] text-ink-3 italic">
                  Traduit automatiquement — l'original est conservé dans la fiche source.
                </p>
              )}
              {!desc.loading && !translated && book.description && sourceLang !== language && (
                <p className="text-[0.6875rem] text-ink-3 italic">
                  traduction indisponible
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {book.previewLink && (
                  <a
                    href={book.previewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-xl bg-gold/15 px-3.5 py-2 text-xs font-medium text-gold transition-colors hover:bg-gold/25"
                  >
                    <ExternalLink className="size-3.5" /> Voir sur Google Books
                  </a>
                )}
                {archiveUrl && (
                  <a
                    href={archiveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
                  >
                    <ExternalLink className="size-3.5" /> Chercher sur archive.org
                  </a>
                )}
                {book.previewLink && (
                  <button
                    type="button"
                    onClick={() => setTab("preview")}
                    className="rounded-xl border border-gold/30 px-3.5 py-2 text-xs text-gold/90 transition-colors hover:bg-gold/10"
                  >
                    Ouvrir l'aperçu intégré
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTab("excerpt")}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-3.5 py-2 text-xs font-semibold text-noir transition-opacity hover:opacity-90"
                >
                  <Sparkles className="size-3.5" /> Étudier un extrait
                </button>
              </div>
            </div>
          )}

          {tab === "preview" && book.previewLink && (
            <div className="aspect-[3/4] w-full overflow-hidden rounded-xl border border-white/5">
              <iframe
                src={`https://books.google.com/books?id=${encodeURIComponent(book.bookId)}&printsec=frontcover&output=embed`}
                title={`Aperçu — ${book.title}`}
                className="h-full w-full"
              />
            </div>
          )}

          {tab === "excerpt" && (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-ink-2">
                Colle un passage du livre (ou de son aperçu) : la traduction et
                la détection d'argot suivent automatiquement via le pipeline
                existant.
              </p>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={8}
                placeholder="Colle ici un extrait du livre…"
                className="w-full rounded-xl border border-white/10 bg-noir-2 p-3 text-sm text-ink placeholder:text-ink-3 focus:border-gold/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void studyExcerpt()}
                disabled={studying}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-4 py-2.5 text-sm font-semibold text-noir transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {studying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Analyser cet extrait
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
