import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ExternalLink,
  Headphones,
  Loader2,
  Pause,
  Play,
  Radio,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/utils";
import { EmptyState } from "./MediaHubView";
import { BookDetail, type BookDetailInput } from "./BookDetail";
import type { UiLang } from "@/lib/i18n";
import type { HubMedia } from "@/components/media/MediaRoomView";

/* ═══════════════════════════════════════════════════════════════════
   Livres (Open Library + Gutenberg) et Talk (podcasts + radio).
   Tout est keyless ; les lectures/diffusions sont 100 % légales.
   ═══════════════════════════════════════════════════════════════════ */

const LANGS = [
  { code: "en", label: "Anglais" },
  { code: "es", label: "Espagnol" },
  { code: "ru", label: "Russe" },
  { code: "ar", label: "Arabe" },
  { code: "zh", label: "Mandarin" },
] as const;

function LangSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Langue du média"
      className="rounded-lg border border-white/10 bg-noir px-3 py-2 text-xs text-ink focus:border-gold/60 focus:outline-none"
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

/* ── Vue lecture interne avec clic-mots (dictionnaire unifié) ──────── */

function ReaderView({
  title,
  paragraphs,
  language,
  onAnalyzeChapter,
}: {
  title: string;
  paragraphs: string[];
  language: string;
  onAnalyzeChapter: () => void;
}) {
  const [entry, setEntry] = useState<{
    word: string;
    meaning: string;
    example?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(word: string) {
    setLoading(true);
    setEntry(null);
    try {
      const res = await fetch(
        `${(import.meta.env.VITE_CONVEX_URL as string).replace(/^ws/, "https")}/api/query`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "slang:searchLocal",
            args: { query: word, exact: true, limit: 1 },
            format: "json",
          }),
        },
      );
      const data = (await res.json()) as {
        status?: string;
        value?: Array<{ expression: string; meaning: string }>;
      };
      if (data.status === "success" && data.value && data.value.length > 0) {
        setEntry({ word: data.value[0].expression, meaning: data.value[0].meaning });
      } else {
        // Fallback silencieux : dictionnaire unifié (resolveWord).
        const { resolveWord } = await import("@/lib/dictionary");
        const e = await resolveWord(word, language);
        setEntry(e ? { word: e.expression, meaning: e.meaning, example: e.example } : null);
      }
    } catch {
      setEntry(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/5 bg-noir-2 p-6">
        <p className="font-mono text-[0.625rem] tracking-widest text-gold uppercase">
          {title}
        </p>
        <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-2 text-[0.9375rem] leading-relaxed text-ink-2">
          {paragraphs.map((p, i) => (
            <p key={i}>
              {p.split(/(\s+)/).map((tok, j) => {
                if (/^\s+$/.test(tok)) return tok;
                const word = tok.replace(/[«».,!?;:…()[\]{}"'’“”]/g, "");
                if (word.length < 2) return tok;
                return (
                  <button
                    key={j}
                    onClick={() => void lookup(word)}
                    className="rounded-sm text-left transition-colors hover:text-gold"
                  >
                    {tok}
                  </button>
                );
              })}
            </p>
          ))}
        </div>
      </div>

      {loading && (
        <div className="ln-accordion space-y-1.5 rounded-xl border border-white/5 bg-noir-2 p-4">
          <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
        </div>
      )}
      {!loading && entry && (
        <div className="ln-accordion rounded-xl border border-white/5 bg-noir-2 p-4">
          <p className="text-sm text-ink">
            <span className="mr-1.5">📖</span>
            <span className="font-medium text-gold">{entry.word}</span>
            <span className="mx-1.5 text-ink-3">—</span>
            {entry.meaning}
          </p>
          {entry.example && (
            <p className="mt-1 text-xs italic text-ink-2">{entry.example}</p>
          )}
        </div>
      )}
      {!loading && !entry && (
        <p className="text-center text-xs text-ink-3">
          Clique un mot pour sa définition.
        </p>
      )}

      <button
        onClick={onAnalyzeChapter}
        className="w-full rounded-xl bg-gradient-to-r from-gold-strong to-gold py-2.5 text-sm font-medium text-noir"
      >
        Analyser ce chapitre
      </button>
    </div>
  );
}

/* ── Onglet Livres ─────────────────────────────────────────────────── */

type OlBook = { key: string; title: string; author: string; year: string; coverUrl: string };
type GbBook = { id: number; title: string; authors: string; textUrl: string };
type GoogleBook = {
  bookId: string;
  title: string;
  author: string;
  year: string;
  coverUrl: string;
  description: string;
  previewLink: string;
  source: string;
};

export function BooksTab({
  language,
  onOpenRoom,
}: {
  language: string;
  onOpenRoom: (media: HubMedia) => void;
}) {
  const [query, setQuery] = useState("");
  const [ol, setOl] = useState<OlBook[] | null>(null);
  const [gb, setGb] = useState<GbBook[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [reader, setReader] = useState<{ title: string; paragraphs: string[] } | null>(null);
  const [embed, setEmbed] = useState<{ title: string; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const searchOl = useAction(api.mediaHub3.openLibrarySearch);
  const searchGb = useAction(api.mediaHub3.gutenbergSearch);
  const fetchText = useAction(api.mediaHub3.gutenbergText);
  const gbEmbed = useAction(api.mediaHub3.googleBooksEmbed);
  const searchGoogleBooks = useAction(api.connectors.googleBooksCatalog.googleBooksSearch);
  const createMedia = useMutation(api.media.createHubMedia);
  const analyzeSegments = useAction(api.mediaHub2.analyzeHubSegments);
  // Couvertures réelles Google Books (catalogue 2000-2026, cache 24 h).
  const [googleBooks, setGoogleBooks] = useState<GoogleBook[] | null>(null);
  // D1 — fiche détail traduite (carte cliquable).
  const [detail, setDetail] = useState<BookDetailInput | null>(null);

  async function doSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setReader(null);
    setEmbed(null);
    try {
      const [a, b, g] = await Promise.all([
        searchOl({ query: q }).catch(() => []),
        searchGb({ query: q }).catch(() => []),
        searchGoogleBooks({ query: q, limit: 12 }).catch(() => null),
      ]);
      setOl(a);
      setGb(b);
      setGoogleBooks((g?.items ?? []) as unknown as GoogleBook[]);
    } finally {
      setSearching(false);
    }
  }

  async function openGutenberg(book: GbBook) {
    if (!book.textUrl) {
      toast.error("Texte complet indisponible pour ce livre.");
      return;
    }
    toast.loading("Chargement du texte…", { id: "gb-text" });
    try {
      const raw = await fetchText({ textUrl: book.textUrl });
      // Retire l'en-tête/pied Gutenberg.
      const start = raw.indexOf("*** START OF");
      const end = raw.indexOf("*** END OF");
      const body = raw.slice(start > 0 ? raw.indexOf("\n", start) + 1 : 0, end > 0 ? end : undefined);
      const paragraphs = body
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\n/g, " ").trim())
        .filter((p) => p.length > 40)
        .slice(0, 120);
      setReader({ title: `${book.title} — ${book.authors}`, paragraphs });
      toast.success("Texte prêt — clique un mot pour sa définition.", { id: "gb-text" });
    } catch (err) {
      toast.error(friendlyError(err, "Texte indisponible."), { id: "gb-text" });
    }
  }

  async function analyzeChapter() {
    if (!reader) return;
    try {
      // 1 paragraphe ≈ 1 segment, 6 s de lecture parlée estimée.
      const segments = reader.paragraphs.slice(0, 60).map((p, i) => ({
        start: i * 6,
        end: (i + 1) * 6,
        text: p.slice(0, 400),
      }));
      const id = await createMedia({
        language: language as "en",
        title: reader.title,
        sourceName: reader.title,
        mediaType: "book",
      });
      await analyzeSegments({
        mediaId: id,
        language: language as "en",
        segments,
        transcriptSource: "book_text",
      });
      toast.success("Chapitre envoyé — traduction et argot en cours.");
      onOpenRoom({
        kind: "book",
        title: reader.title,
        language,
        statusId: id,
      });
    } catch (err) {
      toast.error(friendlyError(err, "Analyse impossible."));
    }
  }

  async function handleTxt(file: File) {
    try {
      const raw = await file.text();
      const paragraphs = raw
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\n/g, " ").trim())
        .filter((p) => p.length > 40)
        .slice(0, 120);
      setReader({ title: file.name, paragraphs });
    } catch {
      toast.error("Fichier illisible.");
    }
  }

  return (
    <>
      {detail && (
        <BookDetail
          book={detail}
          language={language as UiLang}
          onClose={() => setDetail(null)}
        />
      )}
      <div className="space-y-4">
      {reader ? (
        <ReaderView
          title={reader.title}
          paragraphs={reader.paragraphs}
          language={language}
          onAnalyzeChapter={() => void analyzeChapter()}
        />
      ) : embed ? (
        <div className="space-y-2">
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/5">
            <iframe src={embed.url} title={embed.title} className="h-full w-full" />
          </div>
          <button
            onClick={() => setEmbed(null)}
            className="text-xs text-ink-3 hover:text-gold"
          >
            ← Retour aux résultats
          </button>
        </div>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void doSearch();
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Un livre… (ex : Sherlock Holmes, Dracula)"
                aria-label="Rechercher un livre"
                className="h-11 w-full rounded-xl border border-white/10 bg-noir-2 pl-10 pr-4 text-sm text-ink placeholder:text-ink-3 focus:border-gold/60 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="shrink-0 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-5 font-medium text-noir disabled:opacity-50"
            >
              {searching ? <Loader2 className="size-4 animate-spin" /> : "Chercher"}
            </button>
            <LangSelect value={language} onChange={() => {}} />
          </form>

          {!ol && !gb && !searching && (
            <EmptyState
              icon={<BookOpen className="size-6 text-gold" />}
              title="Lis et analyse des livres"
              hint="Texte intégral à lire et à traduire ici."
              suggestions={["Sherlock Holmes", "Dracula", "Alice in Wonderland"]}
            />
          )}

          {searching && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          )}

          {gb && gb.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
                Texte intégral — lisible ici
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {gb.map((b, i) => (
                  <div
                    key={b.id}
                    className="ln-stagger-item flex flex-col rounded-2xl border border-white/5 bg-noir-2 p-3 transition-colors hover:border-gold/40"
                    style={{ "--ln-i": Math.min(i, 11) } as React.CSSProperties}
                  >
                    <p className="line-clamp-2 text-sm font-medium text-ink">{b.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-ink-3">{b.authors}</p>
                    <div className="mt-3 flex flex-1 flex-col justify-end gap-1.5">
                      <button
                        onClick={() => void openGutenberg(b)}
                        className="w-full rounded-lg bg-gold/15 py-1.5 text-xs text-gold hover:bg-gold/25"
                      >
                        Lire ici
                      </button>
                      <button
                        onClick={() => void analyzeChapter()}
                        className="w-full rounded-lg border border-gold/30 py-1.5 text-[0.625rem] text-gold/80 hover:bg-gold/10"
                      >
                        Analyser (après lecture)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {googleBooks && googleBooks.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
                Couvertures réelles — Google Books 2000–2026
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {googleBooks.map((b, i) => (
                  <div
                    key={b.bookId}
                    role="button"
                    tabIndex={0}
                    aria-label={`Fiche du livre ${b.title}`}
                    onClick={() =>
                      setDetail({
                        bookId: b.bookId,
                        title: b.title,
                        author: b.author,
                        year: b.year,
                        coverUrl: b.coverUrl,
                        description: b.description,
                        previewLink: b.previewLink,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetail({
                          bookId: b.bookId,
                          title: b.title,
                          author: b.author,
                          year: b.year,
                          coverUrl: b.coverUrl,
                          description: b.description,
                          previewLink: b.previewLink,
                        });
                      }
                    }}
                    title="Voir la fiche traduite"
                    className="ln-stagger-item flex cursor-pointer flex-col rounded-2xl border border-white/5 bg-noir-2 p-3 transition-colors hover:border-gold/40 focus:outline-none focus-visible:border-gold"
                    style={{ "--ln-i": Math.min(i, 11) } as React.CSSProperties}
                  >
                    {b.coverUrl ? (
                      <img
                        src={b.coverUrl}
                        alt=""
                        loading="lazy"
                        className="mb-2 h-32 w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="mb-2 flex h-32 w-full items-center justify-center rounded-lg bg-white/5">
                        <BookOpen className="size-5 text-ink-3" />
                      </div>
                    )}
                    <p className="line-clamp-2 text-sm font-medium text-ink">{b.title}</p>
                    <p className="line-clamp-1 text-xs text-ink-3">{b.author}</p>
                    <p className="mt-0.5 flex items-center justify-between font-mono text-[0.625rem] text-ink-3">
                      <span>{b.year || "—"}</span>
                      <span className="rounded-full border border-white/10 bg-black/30 px-1.5 py-0.5 tracking-widest uppercase">
                        Google Books
                      </span>
                    </p>
                    {b.previewLink && (
                      <a
                        href={b.previewLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 w-full rounded-lg bg-gold/15 py-1.5 text-center text-xs text-gold transition-colors hover:bg-gold/25"
                      >
                        Aperçu
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {ol && ol.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
                Catalogue & prêts légaux
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ol.map((b) => (
                  <div
                    key={b.key}
                    className="flex flex-col rounded-2xl border border-white/5 bg-noir-2 p-3 transition-colors hover:border-gold/40"
                  >
                    {b.coverUrl ? (
                      <img
                        src={b.coverUrl}
                        alt=""
                        loading="lazy"
                        className="mb-2 h-32 w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="mb-2 flex h-32 w-full items-center justify-center rounded-lg bg-white/5">
                        <BookOpen className="size-5 text-ink-3" />
                      </div>
                    )}
                    <p className="line-clamp-2 text-sm font-medium text-ink">{b.title}</p>
                    <p className="line-clamp-1 text-xs text-ink-3">{b.author}</p>
                    <p className="font-mono text-[0.625rem] text-ink-3">{b.year}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(ol ?? []).length === 0 && (gb ?? []).length === 0 && !searching && (ol !== null || gb !== null) && (
            <EmptyState
              icon={<BookOpen className="size-6 text-ink-3" />}
              title="Aucun livre trouvé"
              hint="Essaie un titre ou un auteur en anglais."
            />
          )}

          <button
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl border border-dashed border-white/10 py-3 text-xs text-ink-2 hover:border-gold/40 hover:text-gold"
          >
            Ou uploade ton propre .txt / .md
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleTxt(f);
              e.target.value = "";
            }}
          />
        </>
      )}
      </div>
    </>
  );
}

/* ── Onglet Talk (podcasts + radio) ────────────────────────────────── */

type Podcast = { collectionName: string; artistName: string; artworkUrl: string; feedUrl: string };
type Episode = { title: string; date: string; audioUrl: string; description: string };
type Station = { name: string; url: string; country: string };

function StreamButton({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);
  // A4 — validation AVANT toute affectation au DOM : jamais d'<audio> avec
  // une src vide ou non-HTTP(S) (« no supported source » = Runtime error).
  const usable = Boolean(src && src.trim() && /^https?:\/\//i.test(src.trim()));
  if (!usable) {
    return (
      <span title="Flux indisponible" className="inline-flex items-center gap-2">
        <span
          aria-disabled
          className="flex size-8 shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-white/10 text-ink-3/60"
        >
          <Play className="size-3.5" />
        </span>
        <span className="font-mono text-[0.625rem] text-ink-3">sans flux</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <audio
        ref={ref}
        src={src}
        preload="none"
        onError={() => {
          // A3 — capturé ici : ne remonte JAMAIS au window.
          setBroken(true);
          setPlaying(false);
          toast.info("Preview indisponible pour ce titre");
        }}
      />
      <button
        onClick={() => {
          if (broken) {
            toast.info("Preview indisponible pour ce titre");
            return;
          }
          const el = ref.current;
          if (!el) return;
          if (el.paused) {
            document.querySelectorAll("audio").forEach((a) => a !== el && a.pause());
            // A2 — rejection toujours gérée.
            el.play().catch(() => {
              setBroken(true);
              setPlaying(false);
              toast.info("Preview indisponible pour ce titre");
            });
          } else {
            el.pause();
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-label={playing ? `Mettre en pause ${label}` : `Écouter ${label}`}
        className="flex size-8 items-center justify-center rounded-full bg-gold/15 text-gold transition-colors hover:bg-gold/25 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={broken}
      >
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </button>
    </span>
  );
}

export function TalkTab({
  language,
  onOpenRoom,
}: {
  language: string;
  onOpenRoom: (media: HubMedia) => void;
}) {
  const [query, setQuery] = useState("");
  const [podcasts, setPodcasts] = useState<Podcast[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [show, setShow] = useState<Podcast | null>(null);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [loadingEp, setLoadingEp] = useState(false);
  const [transcribing, setTranscribing] = useState<string | null>(null);
  const [radioQ, setRadioQ] = useState("");
  const [stations, setStations] = useState<Station[] | null>(null);
  const [radioBusy, setRadioBusy] = useState(false);

  const searchPodcasts = useAction(api.mediaHub.itunesSearchPodcasts);
  // Épisodes réels : flux RSS parsé CÔTE SERVEUR (enclosures MP3, cache 24 h).
  const loadEpisodes = useAction(api.connectors.podcastFeed.podcastFeedEpisodes);
  const sizeCheck = useAction(api.mediaHub.audioSizeCheck);
  const transcribe = useAction(api.mediaHub2.transcribeRemoteAudio);
  const createJob = useMutation(api.mediaJobs.create);
  const runLong = useAction(api.mediaJobRun.transcribeLongAudio);
  const searchRadio = useAction(api.mediaHub4.radioSearch);

  async function doSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    setShow(null);
    setEpisodes(null);
    try {
      setPodcasts(await searchPodcasts({ query: query.trim() }));
    } catch (err) {
      toast.error(friendlyError(err, "Recherche impossible."));
    } finally {
      setSearching(false);
    }
  }

  async function openPodcast(p: Podcast) {
    setShow(p);
    setLoadingEp(true);
    try {
      const res = await loadEpisodes({ feedUrl: p.feedUrl, limit: 20 });
      setEpisodes((res.episodes ?? []) as unknown as Episode[]);
    } catch (err) {
      toast.error(friendlyError(err, "Flux indisponible."));
    } finally {
      setLoadingEp(false);
    }
  }

  async function transcribeEpisode(ep: Episode) {
    setTranscribing(ep.audioUrl);
    try {
      const size = await sizeCheck({ url: ep.audioUrl });
      if (!size.okForUpload) {
        // > 25 Mo : job chunked — plus jamais d'erreur bloquante, la
        // progression est suivie en direct dans la MediaRoom.
        const jobId = await createJob({
          title: `${show?.collectionName ?? "Podcast"} — ${ep.title}`,
          sourceUrl: ep.audioUrl,
        });
        toast.success("Fichier long — transcription par extraits lancée.");
        onOpenRoom({
          kind: "podcast",
          title: `${show?.collectionName ?? "Podcast"} — ${ep.title}`,
          artist: show?.collectionName,
          artworkUrl: show?.artworkUrl,
          previewUrl: ep.audioUrl,
          language,
          jobId,
        });
        void runLong({ jobId: jobId as never, language: language as "en" });
        return;
      }
      const title = `${show?.collectionName ?? "Podcast"} — ${ep.title}`;
      const r = await transcribe({
        url: ep.audioUrl,
        title,
        language: language as "en",
      });
      toast.success("Transcription lancée — ouverture de la MediaRoom.");
      onOpenRoom({
        kind: "podcast",
        title,
        artist: show?.collectionName,
        artworkUrl: show?.artworkUrl,
        previewUrl: ep.audioUrl,
        language,
        statusId: (r as { mediaId?: string }).mediaId,
      });
    } catch (err) {
      toast.error(friendlyError(err, "Transcription impossible."));
    } finally {
      setTranscribing(null);
    }
  }

  async function doRadio() {
    if (radioQ.trim().length < 2) return;
    setRadioBusy(true);
    try {
      setStations(await searchRadio({ query: radioQ.trim() }));
    } catch (err) {
      toast.error(friendlyError(err, "Recherche radio impossible."));
    } finally {
      setRadioBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doSearch();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Un podcast… (ex : true crime, business anglais)"
              aria-label="Rechercher un podcast"
              className="h-11 w-full rounded-xl border border-white/10 bg-noir-2 pl-10 pr-4 text-sm text-ink placeholder:text-ink-3 focus:border-gold/60 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="shrink-0 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-5 font-medium text-noir disabled:opacity-50"
          >
            {searching ? <Loader2 className="size-4 animate-spin" /> : "Chercher"}
          </button>
        </form>

        {show && episodes ? (
          <div className="space-y-2">
            <button
              onClick={() => {
                setShow(null);
                setEpisodes(null);
              }}
              className="text-xs text-ink-3 hover:text-gold"
            >
              ← Retour aux podcasts
            </button>
            <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-noir-2 p-3">
              {show.artworkUrl && (
                <img src={show.artworkUrl} alt="" loading="lazy" decoding="async" width={56} height={56} className="size-14 rounded-xl object-cover" />
              )}
              <div>
                <p className="text-sm font-medium text-ink">{show.collectionName}</p>
                <p className="text-xs text-ink-3">{show.artistName}</p>
              </div>
            </div>
            {loadingEp && (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
                ))}
              </div>
            )}
            {!loadingEp && episodes.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-3">
                Aucun épisode avec audio trouvé dans ce flux.
              </p>
            )}
            {episodes.map((ep, i) => (
              <div
                key={ep.audioUrl}
                className="ln-stagger-item flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-noir-2 p-3"
                style={{ "--ln-i": Math.min(i, 11) } as React.CSSProperties}
              >
                <StreamButton src={ep.audioUrl} label={ep.title} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{ep.title}</p>
                  <p className="font-mono text-[0.625rem] text-ink-3">{ep.date}</p>
                </div>
                <button
                  onClick={() => void transcribeEpisode(ep)}
                  disabled={transcribing !== null}
                  className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs text-gold hover:bg-gold/20 disabled:opacity-50"
                >
                  {transcribing === ep.audioUrl ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    "Transcrire"
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <>
            {!podcasts && !searching && (
              <EmptyState
                icon={<Headphones className="size-6 text-gold" />}
                title="Le cœur argot : podcasts de la rue"
                hint="Écoute en streaming depuis l'hébergeur d'origine, transcription courte gratuite."
                suggestions={["true crime", "street interviews", "business anglais"]}
              />
            )}
            {searching && (
              <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
                ))}
              </div>
            )}
            {podcasts && podcasts.length === 0 && !searching && (
              <EmptyState
                icon={<Headphones className="size-6 text-ink-3" />}
                title="Aucun podcast trouvé"
                hint="Essaie en anglais pour plus de résultats."
              />
            )}
            {podcasts && podcasts.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {podcasts.map((p) => (
                  <button
                    key={p.feedUrl}
                    onClick={() => void openPodcast(p)}
                    className="flex gap-3 rounded-2xl border border-white/5 bg-noir-2 p-3 text-left transition-colors hover:border-gold/40"
                  >
                    {p.artworkUrl && (
                      <img src={p.artworkUrl} alt="" loading="lazy" className="size-14 shrink-0 rounded-xl object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-ink">
                        {p.collectionName}
                      </p>
                      <p className="line-clamp-1 text-xs text-ink-3">{p.artistName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Radio live */}
      <div className="rounded-2xl border border-white/5 bg-noir-2 p-5">
        <p className="flex items-center gap-2 font-mono text-[0.625rem] tracking-widest text-gold uppercase">
          <Radio className="size-3.5" /> Radio live
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doRadio();
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={radioQ}
            onChange={(e) => setRadioQ(e.target.value)}
            placeholder="Genre, ville, langue…"
            aria-label="Rechercher une radio"
            className="h-9 flex-1 rounded-lg border border-white/10 bg-noir px-3 text-xs text-ink placeholder:text-ink-3 focus:border-gold/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={radioBusy}
            className="rounded-lg border border-gold/40 bg-gold/10 px-4 text-xs text-gold hover:bg-gold/20 disabled:opacity-50"
          >
            {radioBusy ? <Loader2 className="size-3.5 animate-spin" /> : "Chercher"}
          </button>
        </form>
        {stations && stations.length > 0 && (
          <div className="mt-3 space-y-2">
            {stations.map((s) => (
              <div
                key={s.url}
                className="flex items-center gap-3 rounded-lg border border-white/5 p-2.5"
              >
                <StreamButton src={s.url} label={s.name} />
                <p className="min-w-0 flex-1 truncate text-sm text-ink">{s.name}</p>
                <p className="shrink-0 font-mono text-[0.625rem] text-ink-3">{s.country}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
