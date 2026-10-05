import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  Bookmark,
  Brain,
  Globe,
  Heart,
  Loader2,
  Play,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { usePageBack } from "@/hooks/use-detail-back";
import { PlayerHost } from "./Players";
import { EpisodeList } from "./EpisodeList";
import {
  KIND_META,
  LANGS,
  decisionOf,
  download,
  fmtDuration,
  langLabel,
  slug,
  toSrt,
  toVtt,
  type Content,
  type Segment,
} from "@/openverse/model";

/** Message unique pour toute indisponibilité technique — jamais d'erreur brute. */
const UNAVAILABLE = "Indisponible pour le moment.";

/**
 * Correspondance lisible : quand une fiche ne se lit pas ici (série
 * métadonnées seules, film non diffusable…), on cherche automatiquement
 * dans le moteur un contenu équivalent et lisible dans KILINGO. Résultat
 * affiché en cartes internes — jamais un lien externe.
 */
function ReadableMatch({ content }: { content: Content }) {
  const navigate = useNavigate();
  const searchUniversal = useAction(api.ovSearch.searchUniversal);
  const [matches, setMatches] = useState<Content[] | null>(null);

  useEffect(() => {
    let alive = true;
    setMatches(null);
    searchUniversal({ query: content.title.slice(0, 80), limit: 12 })
      .then((res) => {
        if (!alive) return;
        const readable = (res.items as unknown as Content[])
          .filter((item) => {
            if (item.key === content.key) return false;
            const d = decisionOf(item);
            return d.canStream || d.canPreview || d.canEmbed;
          })
          .slice(0, 3);
        setMatches(readable);
      })
      .catch(() => {
        if (alive) setMatches([]);
      });
    return () => {
      alive = false;
    };
  }, [content.key, content.title, searchUniversal]);

  if (!matches?.length) return null;
  return (
    <div className="ln-card p-4">
      <h3 className="text-sm font-semibold text-ink">Lisible dans KILINGO</h3>
      <p className="mt-1 text-xs text-ink-3">Des contenus proches se regardent ou s'écoutent directement ici.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {matches.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => navigate(`/app/content/${encodeURIComponent(item.key)}`)}
            className="flex items-center gap-3 rounded-xl border border-white/5 p-2 text-left transition-colors hover:border-gold/30 hover:bg-white/[0.02]"
          >
            {item.thumbnail ? (
              <img src={item.thumbnail} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xl">
                {KIND_META[item.kind].icon}
              </span>
            )}
            <span className="min-w-0">
              <span className="line-clamp-1 text-xs text-ink">{item.title}</span>
              <span className="line-clamp-1 text-[0.625rem] text-ink-3">{item.creator ?? KIND_META[item.kind].label}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-white/5 py-2 last:border-0">
      <span className="w-36 shrink-0 font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">{label}</span>
      <span className="min-w-0 flex-1 text-sm text-ink-2">{children}</span>
    </div>
  );
}

export function ContentDetail({
  content,
  onClose,
  mode = "page",
}: {
  content: Content;
  /** Mode « page » (défaut) : onClose = retour vers la vue précédente.
   *  Le panneau latéral historique a été remplacé par la fiche pleine page. */
  onClose?: () => void;
  mode?: "page";
}) {
  const state = useQuery(api.ovLibrary.contentState, { contentKey: content.key });
  const studio = useQuery(api.ovStudio.studioState, { contentKey: content.key });
  const prefs = useQuery(api.ovLibrary.getPreferences);

  const toggleFavorite = useMutation(api.ovLibrary.toggleFavorite);
  const recordProgress = useMutation(api.ovLibrary.recordProgress);
  const addBookmark = useMutation(api.ovLibrary.addBookmark);
  const saveSubtitle = useMutation(api.ovStudio.saveSubtitle);
  const toggleInPlaylist = useMutation(api.ovLibrary.toggleInPlaylist);
  const createPlaylist = useMutation(api.ovLibrary.createPlaylist);

  const runTranscription = useAction(api.ovStudio.requestTranscription);
  const runTranslation = useAction(api.ovStudio.translateTranscription);
  const translateSnippet = useAction(api.ovStudio.translateSnippet);
  // « Apprendre » : la première expression de la base d'argot détectée
  // dans le contenu entre en révision (SRS) — le même système que Découverte.
  const addToSrs = useMutation(api.learning.addToSrs);

  const [starting, setStarting] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState("fr");
  const [note, setNote] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  // Un épisode ouvert depuis la fiche remplace celle-ci et garde un retour.
  const [nested, setNested] = useState<Content | null>(null);

  useEffect(() => {
    if (prefs?.translationLang) setTargetLang(prefs.translationLang);
  }, [prefs?.translationLang]);

  // La fiche affichée s'appuie sur l'état réellement stocké quand il existe :
  // une entrée de bibliothèque ne porte qu'un instantané partiel des droits.
  const view: Content = (state?.content as unknown as Content | undefined) ?? content;
  const decision = decisionOf(view);

  // Retour arrière unifié : bouton « ← Retour », Escape, swipe mobile et
  // bouton précédent du navigateur. La page étant une vraie route, le
  // navigateur gère lui-même l'historique : on ne pousse rien, onClose
  // navigue en arrière et le scroll/filtres de la vue d'origine sont
  // conservés par React Router + le navigateur.
  const { close } = usePageBack(() => (nested ? setNested(null) : onClose?.()));

  const segments: Segment[] = useMemo(() => {
    const raw = studio?.transcription?.segments ?? [];
    if (raw.length) return raw.map((s) => ({ start: s.start, end: s.end, text: s.text }));
    return [];
  }, [studio]);

  const translationSegments: Segment[] | undefined = useMemo(() => {
    const match = (studio?.translations ?? []).find((t) => t.targetLang === targetLang);
    if (!match?.segments) return undefined;
    return match.segments.map((s) => ({ start: s.start, end: s.end, text: s.text }));
  }, [studio, targetLang]);

  const studioEnabled = decision.canDerive || decision.canTranslate;
  const progress = state?.progress;

  // « Apprendre » : le premier segment transcrit est confronté à la base
  // d'argot (recherche indexée) — la correspondance entre en révision SRS.
  const learnCandidate = useMemo(() => {
    const line = segments.find((s) => s.text?.trim());
    return line?.text.trim().split(/\s+/).slice(0, 6).join(" ") ?? null;
  }, [segments]);
  const learnMatch = useQuery(
    api.slang.searchLocal,
    learnCandidate ? { query: learnCandidate, limit: 1 } : "skip",
  );
  const learnSlang = (learnMatch ?? [])[0];
  const [learnNote, setLearnNote] = useState<string | null>(null);
  const handleLearn = async () => {
    if (!learnSlang) {
      setLearnNote("Aucune expression à réviser n'a été trouvée dans ce contenu.");
      return;
    }
    try {
      const out = await addToSrs({ slangId: learnSlang._id as never });
      setLearnNote(
        out.ok ? "Ajouté à ta mémoire — révision programmée." : "Déjà dans ta mémoire.",
      );
    } catch {
      setLearnNote("Indisponible pour le moment.");
    }
  };

  const startTranscription = async () => {
    setStarting(true);
    setNote(null);
    try {
      const out = await runTranscription({ contentKey: content.key });
      if (!out.ok) {
        setNote(
          out.reason === "no_engine"
            ? "La transcription n'est pas disponible pour le moment. Réessaie plus tard."
            : "Cette fonctionnalité n'est pas disponible pour ce contenu.",
        );
      } else if (out.warnings?.length) {
        setNote(UNAVAILABLE);
      }
    } catch {
      setNote(UNAVAILABLE);
    } finally {
      setStarting(false);
    }
  };

  const launchTranslation = async (transcriptionId: string) => {
    setTranslating(true);
    setNote(null);
    try {
      const out = await runTranslation({ transcriptionId: transcriptionId as never, targetLang });
      if (!out.ok) setNote("Traduction partielle : texte original conservé.");
    } catch {
      setNote(UNAVAILABLE);
    } finally {
      setTranslating(false);
    }
  };

  if (nested) {
    return <ContentDetail content={nested} mode={mode} onClose={() => setNested(null)} />;
  }

  return (
    <section className="ln-card-in w-full overflow-y-auto bg-noir">
        <header className="sticky top-0 z-10 flex items-start gap-4 border-b border-white/5 bg-noir/95 p-5 backdrop-blur">
          {content.thumbnail ? (
            <img
              src={content.thumbnail}
              alt=""
              className="h-28 w-20 shrink-0 rounded-lg object-cover sm:h-32 sm:w-24"
            />
          ) : (
            <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-lg bg-white/5 text-3xl opacity-50 sm:h-32 sm:w-24">
              {KIND_META[content.kind].icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
                {KIND_META[content.kind].label}
              </span>
            </div>
            <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-ink">{content.title}</h2>
            <p className="mt-1 text-sm text-ink-2">
              {content.creator ?? "Auteur inconnu"}
              {content.year ? ` · ${content.year}` : ""}
              {content.duration ? ` · ${fmtDuration(content.duration)}` : ""}
            </p>
            {/* ── Barre d'actions : lecture · transcription · traduction ·
                apprendre · favori · ranger ─────────────────────────── */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {decision.canStream || decision.canPreview || decision.canEmbed ? (
                <a
                  href="#ln-player"
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-3 text-xs font-semibold text-noir"
                >
                  <Play className="size-3.5" />
                  {content.kind === "book"
                    ? "Lire"
                    : content.kind === "music" || content.kind === "podcast" || content.kind === "audio"
                      ? "Écouter"
                      : "Regarder"}
                </a>
              ) : null}
              {studioEnabled && (
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("ln-studio")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
                >
                  📝 Transcription
                </button>
              )}
              {translationSegments?.length ? (
                <span className="flex h-9 items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 text-xs text-gold">
                  <Globe className="size-3.5" /> Traduction prête
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void handleLearn()}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
              >
                <Brain className="size-3.5" /> Apprendre
              </button>
              <button
                type="button"
                onClick={() => void toggleFavorite({ contentKey: content.key })}
                className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs transition-colors ${
                  state?.favorite
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "border-white/10 text-ink-2 hover:border-gold/30 hover:text-gold"
                }`}
              >
                <Heart className={`size-3.5 ${state?.favorite ? "fill-current" : ""}`} />
                {state?.favorite ? "Dans tes favoris" : "Favori"}
              </button>
              {studioEnabled && (
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("ln-studio")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
                >
                  <Bookmark className="size-3.5" /> Ma mémoire
                </button>
              )}
            </div>
            {learnNote && <p className="mt-2 text-[0.6875rem] text-gold-soft">{learnNote}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {onClose && (
              <button
                type="button"
                onClick={close}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
              >
                <ArrowLeft className="size-3.5" /> Retour
              </button>
            )}
            <button
              type="button"
              onClick={close}
              aria-label="Fermer"
              className="text-ink-3 hover:text-ink"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <div className="space-y-6 p-5">
          {/* ── Épisodes : séries, podcasts, flux RSS ─────────────── */}
          {(view.kind === "series" || Boolean(view.rssUrl) || view.subtype === "show") && (
            <EpisodeList content={view} onOpen={setNested} />
          )}

          {/* ── Correspondance lisible (fiche non lisible uniquement) ── */}
          {!(decision.canStream || decision.canPreview || decision.canEmbed) && (
            <ReadableMatch content={view} />
          )}

          {/* ── Lecture ────────────────────────────────────────────── */}
          {(decision.canStream || decision.canPreview || decision.canEmbed) ? (
            <div id="ln-player">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <Play className="size-4 text-gold" /> Lecture
              </h3>
              <PlayerHost
                content={view}
                segments={segments}
                translation={translationSegments}
                startAt={progress?.position ?? 0}
                onProgress={(position, duration) =>
                  void recordProgress({ contentKey: content.key, position, duration })
                }
                onBookmark={(label, position) =>
                  void addBookmark({ contentKey: content.key, label, position })
                }
                onTranslate={async (text) => {
                  try {
                    const out = await translateSnippet({ contentKey: content.key, text, targetLang });
                    return out.ok ? out.text : (out.reason ?? null);
                  } catch {
                    return null;
                  }
                }}
              />
            </div>
          ) : (
            <div className="ln-card p-4">
              <p className="text-sm text-ink-2">{UNAVAILABLE}</p>
              <p className="mt-1 text-xs text-ink-3">
                Essaie la transcription, ou explore un autre contenu du rayon.
              </p>
            </div>
          )}

          {/* ── Studio : transcription & traduction ────────────────── */}
          <div id="ln-studio" className="ln-card p-4">
            <h3 className="text-sm font-semibold text-ink">
              Transcription &amp; traduction
            </h3>
            {!studioEnabled && (
              <p className="mt-2 text-xs text-ink-3">
                Transcription indisponible pour ce contenu.
              </p>
            )}
            {studioEnabled && (
              <>
                <p className="mt-2 text-xs leading-relaxed text-ink-3">
                  Obtiens le texte de ce contenu, puis sa traduction : sous-titres
                  horodatés, téléchargeables en .srt ou .vtt.
                </p>

                {!studio?.transcription && (
                  <button
                    type="button"
                    onClick={() => void startTranscription()}
                    disabled={starting}
                    className="mt-3 flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-4 text-sm font-semibold text-noir disabled:opacity-50"
                  >
                    {starting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    Lancer la transcription
                  </button>
                )}

                {studio?.transcription && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[0.625rem] ${
                          studio.transcription.status === "done"
                            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                            : studio.transcription.status === "error"
                              ? "border-red-400/30 bg-red-400/10 text-red-300"
                              : "border-white/10 text-ink-2"
                        }`}
                      >
                        {studio.transcription.status === "done"
                          ? "prête"
                          : studio.transcription.status === "error"
                            ? "incomplète"
                            : "en cours"}
                      </span>
                      {studio.transcription.segments?.length ? (
                        <span>{studio.transcription.segments.length} répliques horodatées</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void startTranscription()}
                        className="rounded-md border border-white/10 px-2 py-0.5 hover:text-gold"
                      >
                        Relancer
                      </button>
                    </div>

                    {studio.transcription.error && (
                      <p className="rounded-xl border border-red-400/20 bg-red-400/5 p-2.5 text-[0.6875rem] text-red-200">
                        Transcription incomplète pour ce contenu.
                      </p>
                    )}

                    {studio.transcription.segments?.length ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={targetLang}
                            onChange={(e) => setTargetLang(e.target.value)}
                            className="h-9 rounded-lg border border-white/10 bg-noir px-2 text-xs text-ink"
                            aria-label="Langue de traduction"
                          >
                            {LANGS.map((l) => (
                              <option key={l.code} value={l.code}>
                                {l.flag} {l.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={translating}
                            onClick={() => void launchTranslation(studio.transcription!._id)}
                            className="flex h-9 items-center gap-2 rounded-lg bg-gold/15 px-3 text-xs font-semibold text-gold disabled:opacity-50"
                          >
                            {translating ? <Loader2 className="size-3.5 animate-spin" /> : null}
                            Traduire
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              download(`${slug(content.title)}.srt`, toSrt(segments), "application/x-subrip")
                            }
                            className="h-9 rounded-lg border border-white/10 px-3 text-xs text-ink-2 hover:text-gold"
                          >
                            .srt
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              download(`${slug(content.title)}.vtt`, toVtt(segments), "text/vtt")
                            }
                            className="h-9 rounded-lg border border-white/10 px-3 text-xs text-ink-2 hover:text-gold"
                          >
                            .vtt
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void saveSubtitle({
                                contentKey: content.key,
                                format: "srt",
                                lang: targetLang,
                                body: toSrt(segments),
                              })
                            }
                            className="flex h-9 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs text-ink-2 hover:text-gold"
                          >
                            <Plus className="size-3" /> Conserver
                          </button>
                        </div>

                        <div className="max-h-64 overflow-y-auto rounded-xl border border-white/5 bg-black/30">
                          {(translationSegments ?? segments).slice(0, 400).map((s, i) => (
                            <div
                              key={`${s.start}-${i}`}
                              className="flex gap-3 border-b border-white/5 px-3 py-1.5 last:border-0"
                            >
                              <span className="font-mono text-[0.625rem] text-ink-3">{fmtDuration(s.start)}</span>
                              <span className="text-xs text-ink-2">{s.text}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : studio.transcription.text ? (
                      <div className="rounded-xl border border-white/5 bg-black/30 p-3">
                        <p className={`whitespace-pre-wrap text-xs leading-relaxed text-ink-2 ${showText ? "" : "line-clamp-8"}`}>
                          {studio.transcription.text}
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowText((s) => !s)}
                          className="mt-2 text-[0.6875rem] text-gold"
                        >
                          {showText ? "Réduire" : "Afficher tout le texte"}
                        </button>
                      </div>
                    ) : null}

                    {(studio.translations ?? []).length > 0 && (
                      <p className="font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
                        Traductions disponibles :{" "}
                        {(studio.translations ?? []).map((t) => langLabel(t.targetLang)).join(" · ")}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            {note && (
              <p className="mt-3 rounded-xl border border-white/10 bg-black/40 p-2.5 text-[0.6875rem] leading-relaxed text-ink-2">
                {note}
              </p>
            )}
          </div>

          {/* ── Organisation ───────────────────────────────────────── */}
          <div className="ln-card p-4">
            <h3 className="text-sm font-semibold text-ink">Ranger</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {(state?.playlists ?? []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void toggleInPlaylist({ id: p.id as never, contentKey: content.key })}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    p.contains ? "border-gold/40 bg-gold/10 text-gold" : "border-white/10 text-ink-2 hover:text-gold"
                  }`}
                >
                  {p.contains ? "✓ " : "+ "}
                  {p.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const name = window.prompt("Nom de la nouvelle playlist ?");
                  if (name) void createPlaylist({ name });
                }}
                className="rounded-full border border-dashed border-white/15 px-3 py-1.5 text-xs text-ink-3 hover:text-gold"
              >
                + Nouvelle playlist
              </button>
            </div>
            {(state?.bookmarks ?? []).length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-ink-3">
                {(state?.bookmarks ?? []).slice(0, 5).map((b) => (
                  <li key={b._id}>
                    · {b.label} — {fmtDuration(b.position)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
  );
}
