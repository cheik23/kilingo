import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { LyricsResult } from "@/convex/mediaHub4";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Captions, Clapperboard, Languages, Layers, Loader2, Music } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n, UI_LANGS, uiLangMeta, loadStoredTargetLang, storeTargetLang, type UiLang } from "@/lib/i18n";
import { TiltCard } from "@/components/fx/interact";
import {
  SubtitleImportPanel,
  type SubtitleImportMeta,
} from "@/components/learner/SubtitleImportPanel";
import type { ParsedSubtitleSegment } from "@/lib/subtitleParse";
import { YouTubeEmbed } from "@/components/learner/YouTubeEmbed";
import type { YTControls } from "@/hooks/use-youtube-player";

/* ═══════════════════════════════════════════════════════════════════
   MediaRoom — vue dédiée d'un média du Hub.
   Colonne gauche : lecteur. Colonne droite : panneau contenu
   (max-h-[70vh] overflow-y-auto — JAMAIS de débordement).
   ═══════════════════════════════════════════════════════════════════ */

export type HubMedia = {
  kind: "music" | "youtube" | "archive" | "series" | "book" | "podcast" | "radio";
  title: string;
  artist?: string;
  /** Synopsis (TVmaze/TMDB) — affiché sur les fiches sans lecteur. */
  summary?: string;
  year?: string;
  artworkUrl?: string;
  previewUrl?: string; // audio direct (musique, podcast, radio)
  trackViewUrl?: string;
  /** Durée réelle du morceau (s) : aide à choisir la bonne version. */
  durationSec?: number;
  embedUrl?: string; // iframe (youtube, archive, books)
  gutenbergTextUrl?: string;
  language: string; // langue du média (source de transcription)
  /** id Convex du userMedia une fois l'analyse lancée. */
  statusId?: string;
  /** Job de transcription longue (chunking > 25 Mo) en cours. */
  jobId?: string;
};

const LANGS = UI_LANGS.map((code) => ({
  code,
  label: `${uiLangMeta(code).flag} ${uiLangMeta(code).native}`,
}));

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function parseMmSs(v: string): number {
  const [m, s] = v.split(":").map(Number);
  if (!Number.isFinite(m)) return 0;
  return m * 60 + (Number.isFinite(s) ? s : 0);
}

/* ── Sélecteur de plage (t0/t1) : poignées + ticks + inputs mm:ss ──── */

function TimeWindowSelector({
  max,
  win,
  onChange,
  segBounds,
  selectedCount,
  wordCount,
}: {
  max: number;
  win: { t0: number; t1: number };
  onChange: (w: { t0: number; t1: number }) => void;
  segBounds: Array<{ start: number; end: number }>;
  selectedCount: number;
  wordCount: number;
}) {
  const [dragging, setDragging] = useState<null | "t0" | "t1">(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<null | "t0" | "t1">(null);

  const pos = (t: number) => `${Math.min(100, Math.max(0, (t / max) * 100))}%`;

  function tFromClientX(clientX: number): number {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * max;
  }

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const t = tFromClientX(e.clientX);
      const cur = dragRef.current;
      if (cur === "t0") {
        onChange({ t0: Math.min(t, win.t1 - 1), t1: win.t1 });
      } else if (cur === "t1") {
        onChange({ t0: win.t0, t1: Math.max(t, win.t0 + 1) });
      }
    };
    const up = () => {
      dragRef.current = null;
      setDragging(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, win.t0, win.t1, max, onChange]);

  const snapT0 = () => {
    const cands = segBounds.map((s) => s.start).filter((s) => s <= win.t1 - 1);
    if (cands.length === 0) return;
    const best = cands.reduce((a, b) =>
      Math.abs(b - win.t0) < Math.abs(a - win.t0) ? b : a,
    );
    onChange({ t0: best, t1: win.t1 });
  };
  const snapT1 = () => {
    const cands = segBounds.map((s) => s.end).filter((s) => s >= win.t0 + 1);
    if (cands.length === 0) return;
    const best = cands.reduce((a, b) =>
      Math.abs(b - win.t1) < Math.abs(a - win.t1) ? b : a,
    );
    onChange({ t0: win.t0, t1: best });
  };

  return (
    <div>
      <div
        ref={barRef}
        className="relative h-9 select-none"
        role="slider"
        aria-label="Sélection de plage à traduire"
        aria-valuemin={0}
        aria-valuemax={Math.round(max)}
        aria-valuenow={Math.round(win.t0)}
      >
        <div className="absolute top-4 h-1.5 w-full rounded-full bg-white/10" />
        {segBounds.map((s, i) => (
          <span
            key={i}
            className="absolute top-3 h-3 w-px bg-white/15"
            style={{ left: pos(s.start) }}
          />
        ))}
        <div
          className="absolute top-4 h-1.5 rounded-full bg-gold"
          style={{
            left: pos(win.t0),
            width: `${((win.t1 - win.t0) / max) * 100}%`,
          }}
        />
        {(["t0", "t1"] as const).map((k) => (
          <button
            key={k}
            onPointerDown={(e) => {
              e.preventDefault();
              dragRef.current = k;
              setDragging(k);
            }}
            onDoubleClick={k === "t0" ? snapT0 : snapT1}
            aria-label={k === "t0" ? "Début de la plage" : "Fin de la plage"}
            className={cn(
              "absolute top-2 z-10 size-5 -translate-x-1/2 cursor-ew-resize rounded-full border-2 border-gold bg-noir transition-transform hover:scale-110",
              dragging === k && "scale-110 shadow-[0_0_12px_rgba(212,165,116,0.5)]",
            )}
            style={{ left: pos(win[k]) }}
          />
        ))}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <input
          value={fmt(win.t0)}
          onChange={(e) => {
            const t = parseMmSs(e.target.value);
            onChange({ t0: Math.min(t, win.t1 - 1), t1: win.t1 });
          }}
          className="w-14 rounded-md border border-white/10 bg-noir px-1.5 py-1 text-center font-mono text-[0.6875rem] text-gold focus:border-gold/60 focus:outline-none"
          aria-label="Début mm:ss"
        />
        <span className="text-ink-3">→</span>
        <input
          value={fmt(win.t1)}
          onChange={(e) => {
            const t = parseMmSs(e.target.value);
            onChange({ t0: win.t0, t1: Math.max(t, win.t0 + 1) });
          }}
          className="w-14 rounded-md border border-white/10 bg-noir px-1.5 py-1 text-center font-mono text-[0.6875rem] text-gold focus:border-gold/60 focus:outline-none"
          aria-label="Fin mm:ss"
        />
        <span className="ml-auto font-mono text-[0.625rem] text-ink-3">
          {selectedCount} segments sélectionnés · {wordCount} mots
        </span>
      </div>
    </div>
  );
}

/* ── Lecteurs par type ─────────────────────────────────────────────── */

function MediaPlayer({
  media,
  onTime,
  playerRef,
}: {
  media: HubMedia;
  onTime: (t: number) => void;
  playerRef: React.RefObject<HTMLAudioElement | null>;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [broken, setBroken] = useState(false);
  // A4 — previewUrl validée avant toute affectation au DOM (<audio> avec une
  // src vide déclenche « no supported source » = dialogue Runtime error).
  const raw = media.previewUrl ?? "";
  const usable = Boolean(raw.trim() && /^https?:\/\//i.test(raw.trim()));
  if (!usable) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-white/5 bg-noir-2">
        <span className="font-mono text-[0.625rem] text-ink-3">sans preview</span>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {media.artworkUrl && (
        <img
          src={media.artworkUrl}
          alt=""
          className="mx-auto aspect-square w-full max-w-[280px] rounded-2xl object-cover shadow-2xl"
        />
      )}
      <audio
        ref={playerRef}
        src={raw}
        onError={() => {
          // A3 — capturé ici : ne remonte JAMAIS au window.
          setBroken(true);
          setPlaying(false);
          toast.info("Preview indisponible pour ce titre");
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => onTime(e.currentTarget.currentTime)}
        preload="metadata"
        className="hidden"
      />
      <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-noir-2 p-4">
        <button
          onClick={() => {
            if (broken) {
              toast.info("Preview indisponible pour ce titre");
              return;
            }
            const el = playerRef.current;
            if (!el) return;
            if (el.paused) {
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
          disabled={broken}
          aria-label={playing ? "Pause" : "Lecture"}
          className="flex size-11 items-center justify-center rounded-full bg-gold text-noir transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {playing ? "⏸" : "▶"}
        </button>
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Panneau de contenu (droite) ───────────────────────────────────── */

type MediaStatus = {
  _id: string;
  title: string;
  language: string;
  status: string;
  error?: string;
  translationProgress?: number;
  translationFailed?: boolean;
  segmentCount?: number;
  subtitles: Array<{
    id: number;
    start: number;
    end: number;
    originalText: string;
    translatedText: string;
    isSlang: boolean;
  }>;
  slangDetected: Array<{ expression: string; meaning: string; context?: string }>;
};

const ROOM_TABS = [
  { key: "transcript", labelKey: "media.tabTranscript" },
  { key: "translation", labelKey: "media.tabTranslation" },
  { key: "slang", labelKey: "media.tabSlang" },
] as const;

export function MediaRoomView({
  media,
  onBack,
}: {
  media: HubMedia;
  onBack: () => void;
}) {
  // Cible « TRADUIRE VERS » (LOT UI 2) : 12 langues UI, persistée
  // (shadow.targetLang), défaut = langue UI courante. Source de vérité
  // unique partagée avec ShadowView — passée à l'analyse (création média),
  // à la re-traduction à chaud et au toggle « Traduire » des paroles.
  const [targetLang, setTargetLangState] = useState<string>(
    loadStoredTargetLang,
  );
  const statusAction = useAction(api.mediaRetranslate.retranslateMedia);
  const setMediaTargetLang = useMutation(api.media.setMediaTargetLanguage);
  // Porte de secours SRT/VTT (médias vidéo du Hub) : parse client puis
  // injection dans le pipeline existant (traduction cible + argot).
  const [showSubsImport, setShowSubsImport] = useState(false);
  const analyzeHubSegments = useAction(api.mediaHub2.analyzeHubSegments);
  const isVideoMedia = media.kind === "youtube" || media.kind === "archive";
  // C1/C2 — Médias sans source audio/vidéo (fiches TMDB/TVmaze…) : le
  // HubMedia est créé/attaché au premier « Analyser », puis l'import
  // SRT/VTT devient la source de transcription principale.
  const createHubMedia = useMutation(api.media.createHubMedia);
  const [ensuredMediaId, setEnsuredMediaId] = useState<string | null>(null);
  // C — feedback visible garanti : loading pendant la création du média,
  // panneau SRT/VTT ouvert à la fin, toast de confirmation. Jamais de clic
  // silencieux (l'utilisateur doit TOUJOURS voir quelque chose se passer).
  const [analyzingDetail, setAnalyzingDetail] = useState(false);
  const effectiveMediaId = media.statusId ?? ensuredMediaId;
  const hasPlayer = Boolean(media.embedUrl || media.previewUrl);
  const sourceless = !hasPlayer;
  const ensureMediaId = async (): Promise<string> => {
    if (effectiveMediaId) return effectiveMediaId;
    const id = await createHubMedia({
      language: (media.language || "en") as "en",
      title: media.title,
      sourceName: media.embedUrl ?? media.title,
      mediaType: "film",
    });
    setEnsuredMediaId(id);
    return id;
  };
  /** C1 — « Analyser ce média » : HubMedia garanti + porte SRT/VTT ouverte. */
  const analyzeFromDetail = async () => {
    setAnalyzingDetail(true);
    try {
      await ensureMediaId();
      setShowSubsImport(true);
      toast.info("Importe un SRT/VTT (ou colle le texte) — la traduction et l'argot suivent.");
    } catch (err) {
      console.error("[MediaRoom] création média impossible:", err);
      toast.error("Analyse impossible — réessaie.");
    } finally {
      setAnalyzingDetail(false);
    }
  };

  /** B1 — remplace les segments du média en cours via le pipeline existant.
      Échec = toast, jamais de crash. */
  const handleSubsImportRoom = async (
    segments: ParsedSubtitleSegment[],
    meta: SubtitleImportMeta,
  ) => {
    if (!effectiveMediaId) {
      toast.error("Clique d'abord « Analyser ce média » pour créer le média.");
      return;
    }
    setShowSubsImport(false);
    try {
      await analyzeHubSegments({
        mediaId: effectiveMediaId as never,
        language: (media.language || "en") as "en",
        targetLanguage: targetLang as "fr",
        // LOT D — langue réelle du fichier déclarée à l'import : un .srt
        // anglais est traduit en → cible, jamais comme la langue du média.
        sourceLanguage: meta.sourceLang as "en",
        segments: meta.synced
          ? segments
          : segments.map((s) => ({ ...s, start: 0, end: 0 })),
        transcriptSource: "subtitle_file",
      });
      toast.success(
        `${segments.length} lignes importées — traduction et argot mis à jour`,
        meta.truncated
          ? { description: "Seules les 5 000 premières lignes ont été gardées." }
          : undefined,
      );
    } catch (err) {
      console.error("[MediaRoom] import SRT impossible:", err);
      toast.error("Import impossible — réessaie.");
    }
  };
  /** « Traduire tout » : relance la traduction du média ENTIER avec la
      cible courante, sans re-transcrire. C'est le recours quand la cascade
      n'a rien renvoyé (colonne cible vide) — et le seul moyen de relancer
      sans changer de langue. Échec = toast, jamais de trace. */
  const retranslateNow = async () => {
    if (!media.statusId) {
      toast.error("Clique d'abord « Analyser ce média » pour créer le média.");
      return;
    }
    setTranslating(true);
    try {
      const r = await statusAction({
        mediaId: media.statusId as never,
        targetLanguage: targetLang as "fr",
      });
      if (!r.ok) {
        console.log(`[MediaRoom] re-traduction ignorée — ${r.reason}`);
        toast.error("Rien à traduire pour l'instant.");
      }
    } catch (err) {
      console.error("[MediaRoom] re-traduction impossible:", err);
      toast.error("Traduction impossible — réessaie.");
    } finally {
      setTranslating(false);
    }
  };

  /** Change la cible : persistance + (re-)traduction du média en cours.
      Échec silencieux loggé — jamais de crash. */
  const changeTargetLang = (next: string) => {
    setTargetLangState(next);
    storeTargetLang(next as UiLang);
    if (!media.statusId) return;
    void (async () => {
      try {
        await setMediaTargetLang({
          mediaId: media.statusId as never,
          targetLanguage: next as "fr",
        });
        const r = await statusAction({
          mediaId: media.statusId as never,
          targetLanguage: next as "fr",
        });
        if (!r.ok) console.log(`[MediaRoom] re-traduction ignorée — ${r.reason}`);
      } catch (err) {
        console.error("[MediaRoom] re-traduction impossible:", err);
      }
    })();
  };
  const [tab, setTab] = useState<
    "transcript" | "translation" | "slang" | "lyrics"
  >("transcript");
  /** Traduction relancée à la demande (bouton « Traduire tout »). */
  const [translating, setTranslating] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);
  const [win, setWin] = useState({ t0: 0, t1: 30 });
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  /** Horloge du lecteur YouTube (API IFrame) pour surligner le segment actif. */
  const [ytTime, setYtTime] = useState<number | null>(null);
  /** Contrôles YouTube : clic sur une ligne de paroles = seek. */
  const ytControlsRef = useRef<YTControls | null>(null);

  /** Seek unifié du lecteur (YouTube embed ou audio natif). */
  function seekLyrics(t: number) {
    if (ytControlsRef.current) {
      ytControlsRef.current.seek(t);
      setYtTime(t);
    } else if (playerRef.current) {
      playerRef.current.currentTime = t;
      setCurrentTime(t);
    }
  }

  const status = useQuery(
    api.media.getMediaStatus,
    media.statusId ? { mediaId: media.statusId as never } : "skip",
  );

  // Job de transcription longue : progression live (doneChunks/totalChunks).
  const { t, lang: uiLang } = useI18n();
  const job = useQuery(
    api.mediaJobs.get,
    media.jobId ? { id: media.jobId as never } : "skip",
  );
  const retryJob = useAction(api.mediaJobRun.transcribeLongAudio);
  const seedCache = useMutation(api.mediaJobs.seedCache);
  const jobRunning =
    job != null &&
    (job.status === "pending" ||
      job.status === "chunking" ||
      job.status === "transcribing" ||
      job.status === "translating");

  // Miroir du cache serveur vers localStorage (chunkcache:{url}:{i}) —
  // source du « Réessayer » si la session change entre-temps.
  useEffect(() => {
    if (!job?.chunkCache?.length) return;
    try {
      for (const c of job.chunkCache) {
        localStorage.setItem(
          `chunkcache:${job.sourceUrl}:${c.i}`,
          JSON.stringify({ segments: c.segments, lang: c.lang }),
        );
      }
    } catch {
      /* quota — le miroir est best-effort */
    }
  }, [job?.chunkCache, job?.sourceUrl]);
  const jobProgressPct =
    job?.totalChunks && job?.doneChunks != null
      ? Math.round((job.doneChunks / job.totalChunks) * 100)
      : 0;
  // Compteur live : segments stockés dans le job (officiels) ou dérivés du
  // média chargé pendant l'analyse (le pipeline écrit au fil de l'eau).
  const jobSegCount =
    job?.segments?.length ?? (jobRunning ? (status?.subtitles.length ?? 0) : 0);

  const addToSrs = useMutation(api.learning.addToSrs);
  const [added, setAdded] = useState<Set<number>>(new Set());

  // Recherche locale pour « + Réviser » (expression → id slang).
  const [srsQuery, setSrsQuery] = useState<string | null>(null);
  const localHit = useQuery(
    api.slang.searchLocal,
    srsQuery ? { query: srsQuery, exact: true, limit: 1 } : "skip",
  );

  // Paroles : connecteur Genius (RapidAPI → API officielle) avec repli
  // lrclib.net, chargé paresseusement au premier affichage de l'onglet.
  const lyricsSearch = useAction(api.mediaHub4.lyricsFor);
  const [lyrics, setLyrics] = useState<LyricsResult | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const lyricsRequested = useRef(false);
  const showLyricsTab = media.kind === "music";

  /** Titre qui sent la chanson : on propose alors « Paroles synchronisées ».
      `media.kind === "music"` reste la source sûre ; le motif couvre les
      vidéos YouTube musicales mal classées par le Hub. */
  const looksLikeSong =
    showLyricsTab ||
    /(feat\.|ft\.|lyrics?|paroles|official (video|audio|music)|clip officiel|karaoke|remix)/i.test(
      media.title,
    );
  const [syncingLyrics, setSyncingLyrics] = useState(false);

  /**
   * « Paroles synchronisées » (lrclib/Genius) : quand la source expose les
   * horodatages (LRC), on les INJECTE dans le pipeline existant — même table
   * de sous-titres, même traduction, même détection d'argot, même karaoké.
   * Aucun lecteur parallèle : le média garde une seule vérité. Si la source
   * n'a pas de temps, on le dit et on renvoie vers le texte collé.
   */
  async function syncLyrics() {
    if (!effectiveMediaId) {
      toast.error("Clique d'abord « Analyser ce média » pour créer le média.");
      return;
    }
    setSyncingLyrics(true);
    try {
      const res = (await lyricsSearch({
        title: media.title,
        ...(media.artist ? { artist: media.artist } : {}),
        ...(media.durationSec ? { durationSec: media.durationSec } : {}),
      })) as LyricsResult;
      const lines = res.ok ? res.segments : undefined;
      if (!lines || lines.length === 0) {
        toast.info(
          "Pas de paroles horodatées pour ce titre — colle le texte à la place.",
          {
            description:
              "« SRT/VTT » puis « Traduire un texte » traduit le texte entier d'un bloc.",
          },
        );
        return;
      }
      const segments = lines
        .map((line, i) => ({
          start: line.start,
          end: lines[i + 1]?.start ?? line.start + 4,
          text: line.text.trim(),
        }))
        .filter((s) => s.text.length > 0);
      if (segments.length === 0) {
        toast.info("Ces paroles ne contiennent aucune ligne exploitable.");
        return;
      }
      await analyzeHubSegments({
        mediaId: effectiveMediaId as never,
        language: (media.language || "en") as "en",
        targetLanguage: targetLang as "fr",
        sourceLanguage: (media.language || "en") as "en",
        segments,
        transcriptSource: "synced_lyrics",
      });
      setLyrics(res);
      toast.success(
        `${segments.length} lignes de paroles synchronisées — traduction et argot mis à jour`,
      );
    } catch (err) {
      console.error("[MediaRoom] paroles synchronisées impossibles:", err);
      toast.error("Impossible de récupérer les paroles — réessaie.");
    } finally {
      setSyncingLyrics(false);
    }
  }

  async function loadLyrics() {
    if (lyricsRequested.current) return;
    lyricsRequested.current = true;
    setLyricsLoading(true);
    try {
      const res = await lyricsSearch({
        title: media.title,
        ...(media.artist ? { artist: media.artist } : {}),
        ...(media.durationSec ? { durationSec: media.durationSec } : {}),
      });
      setLyrics(res as LyricsResult);
    } catch {
      setLyrics({
        ok: false,
        reason: "error",
        title: media.title,
        artist: media.artist ?? "",
        text: "",
      });
    } finally {
      setLyricsLoading(false);
    }
  }

  // Ligne de paroles active quand la source fournit des horodatages (LRC).
  const lyricClock = ytTime ?? currentTime;
  const activeLyricIndex = useMemo(() => {
    const lines = lyrics?.ok ? lyrics.segments : undefined;
    if (!lines || lines.length === 0) return -1;
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lyricClock >= lines[i].start) index = i;
    }
    return index;
  }, [lyrics, lyricClock]);

  const lyricsListRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (activeLyricIndex < 0 || !lyricsListRef.current) return;
    document
      .getElementById(`lyric-line-${activeLyricIndex}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLyricIndex]);

  const geniusSearchUrl = `https://genius.com/search?q=${encodeURIComponent(
    [media.artist, media.title].filter(Boolean).join(" "),
  )}`;

  // ── Traduction des paroles (cascade Groq → local → MyMemory, cache 24 h
  // dans ovSourceCache par (lyricsId + langue UI)). Échec ⇒ toggle off,
  // jamais de crash.
  const translateLines = useAction(api.lyricsTranslate.translateLyrics);
  const [lyricsTr, setLyricsTr] = useState<string[] | null>(null);
  const [lyricsTrLoading, setLyricsTrLoading] = useState(false);
  const [lyricsTrFailed, setLyricsTrFailed] = useState(false);
  const lyricsId =
    lyrics?.ok
      ? (lyrics.url ??
        `${lyrics.artist}|${lyrics.title}`.toLowerCase().trim())
      : null;
  const lyricsHasText =
    lyrics?.ok && (lyrics.segments?.length ?? 0) > 0
      ? true
      : Boolean(lyrics?.ok && lyrics.text.trim());

  async function toggleLyricsTranslate() {
    if (!lyrics?.ok || lyricsTrFailed) return;
    if (lyricsTr) {
      setLyricsTr(null); // re-toggle = retour au texte source
      return;
    }
    if (lyricsTrLoading) return;
    setLyricsTrLoading(true);
    try {
      const lines =
        lyrics.segments && lyrics.segments.length > 0
          ? lyrics.segments.map((seg) => seg.text)
          : (lyrics.text || "").split("\n").filter((l) => l.trim());
      if (lines.length === 0) {
        setLyricsTrFailed(true);
        return;
      }
      const id =
        lyrics.url ??
        `${lyrics.artist}|${lyrics.title}`.toLowerCase().trim();
      const res = await translateLines({
        lyricsId: id,
        lang: targetLang,
        lines,
      });
      if (res.ok) {
        setLyricsTr(res.lines);
      } else {
        setLyricsTrFailed(true);
        toast.error("Traduction indisponible pour le moment.");
      }
    } catch {
      setLyricsTrFailed(true);
      toast.error("Traduction indisponible pour le moment.");
    } finally {
      setLyricsTrLoading(false);
    }
  }

  // Changement de cible : la traduction affichée est invalidée — le
  // prochain « Traduire » repartira sur la nouvelle langue (cache 24 h
  // par cible côté serveur). Un état échec est réinitialisé pour retenter.
  useEffect(() => {
    setLyricsTr(null);
    setLyricsTrFailed(false);
  }, [targetLang]);

  // Durée = fin du dernier segment transcrit (preview iTunes = 30 s par défaut).
  const segBounds = useMemo(
    () =>
      (status?.subtitles ?? []).map((s) => ({ start: s.start, end: s.end })),
    [status?.subtitles],
  );
  const segCount = segBounds.length;
  useEffect(() => {
    const subs = status?.subtitles ?? [];
    const maxEnd = subs.length > 0 ? subs[subs.length - 1].end : 30;
    setDuration(maxEnd);
    setWin({ t0: 0, t1: maxEnd });
  }, [status?.subtitles]);

  const inWindow = (s: { start: number; end: number }) =>
    s.end > win.t0 && s.start < win.t1;
  const shown = (status?.subtitles ?? []).filter(inWindow);
  const wordCount = shown.reduce(
    (a, s) => a + s.originalText.split(/\s+/).filter(Boolean).length,
    0,
  );

  // Scroll auto vers le segment actif.
  const activeSeg = shown.find(
    (s) => currentTime >= s.start && currentTime < s.end,
  );
  // En lecture YouTube, l'horloge vient de l'API IFrame (ytTime) : le
  // segment surligné suit la vidéo réelle, pas l'horloge audio fictive.
  const ytClock = ytTime ?? 0;
  const activeSegYt =
    media.embedUrl && ytTime != null
      ? (status?.subtitles ?? []).find(
          (s) => ytClock >= s.start && ytClock < s.end,
        )
      : undefined;
  useEffect(() => {
    if (!activeSegYt || !listRef.current) return;
    document
      .getElementById(`seg-${activeSegYt.id}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSegYt?.id]);
  useEffect(() => {
    if (!activeSeg || !listRef.current) return;
    document
      .getElementById(`seg-${activeSeg.id}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSeg?.id]);

  function handleRevise(seg: { id: number; originalText: string }) {
    const words = seg.originalText
      .toLowerCase()
      .replace(/[^a-zàâäéèêëïîôöùûüçñ' -]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
    if (words.length === 0) {
      toast.info("Aucun mot révisable dans ce segment.");
      return;
    }
    setSrsQuery(words[0]);
    setAdded((prev) => new Set(prev).add(seg.id));
  }

  useEffect(() => {
    if (!srsQuery) return;
    if (localHit && localHit.length > 0) {
      void addToSrs({ slangId: localHit[0]._id }).then((r) => {
        if (r?.ok) toast.success(`« ${localHit[0].expression} » ajouté à réviser`);
        else toast.info("Déjà dans ta liste de révision.");
      });
      setSrsQuery(null);
    } else if (localHit !== undefined) {
      toast.info("Expression pas encore en base — révision indisponible.");
      setSrsQuery(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localHit, srsQuery]);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-ink-2 transition-colors hover:text-gold"
      >
        <ArrowLeft className="size-4" /> Retour au Hub
      </button>

      <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
        {/* ── Colonne gauche : lecteur selon le type ── */}
        <div className="min-w-0 space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">
              {media.title}
            </h2>
            {media.artist && <p className="text-sm text-ink-2">{media.artist}</p>}
          </div>
          {media.embedUrl && /youtube(-nocookie)?\.com|youtu\.be/.test(media.embedUrl) ? (
            /* Lecteur YouTube officiel intégré (API IFrame) : l'horloge
               remonte vers le panneau pour le suivi de sous-titres. */
            <YouTubeEmbed
              videoId={
                /embed\/([\w-]{6,})/.exec(media.embedUrl)?.[1] ?? null
              }
              onTimeUpdate={(t) => setYtTime(t)}
              controlsRef={ytControlsRef}
            />
          ) : media.embedUrl ? (
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/5">
              <iframe
                src={media.embedUrl}
                title={media.title}
                allow="fullscreen"
                className="h-full w-full"
              />
            </div>
          ) : media.previewUrl ? (
            <MediaPlayer media={media} onTime={setCurrentTime} playerRef={playerRef} />
          ) : media.artworkUrl || media.summary ? (
            /* B4 — fiche sans lecteur : visuel propre (poster + synopsis +
               année + badge source), jamais un rectangle vide. */
            <div className="flex gap-4 rounded-2xl border border-white/5 bg-noir-2 p-4">
              <div className="w-28 shrink-0 sm:w-36">
                {media.artworkUrl ? (
                  <img
                    src={media.artworkUrl}
                    alt=""
                    loading="lazy"
                    className="aspect-[2/3] w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-white/5">
                    <Clapperboard className="size-6 text-ink-3" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {media.year && (
                    <span className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-0.5 font-mono text-[0.625rem] text-gold">
                      {media.year}
                    </span>
                  )}
                  <span className="rounded-full border border-white/10 px-2.5 py-0.5 font-mono text-[0.625rem] text-ink-3">
                    TVmaze · TMDB
                  </span>
                </div>
                {media.summary ? (
                  <p className="line-clamp-6 text-xs leading-relaxed text-ink-2">
                    {media.summary}
                  </p>
                ) : (
                  <p className="text-xs text-ink-3">
                    Ce média n'a pas de lecteur intégré — l'analyse de contenu
                    reste disponible à droite.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-white/5 bg-noir-2">
              <p className="max-w-xs px-4 text-center text-xs text-ink-3">
                Ce média n'a pas de lecteur intégré — l'analyse de contenu reste
                disponible à droite.
              </p>
            </div>
          )}
        </div>

        {/* ── Colonne droite : panneau contenu ── */}
        <TiltCard className="flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-white/5 bg-noir-2 p-4">
          {/* Progression du job de transcription longue (chunking > 25 Mo). */}
          {job && (
            <div
              className={cn(
                "mb-3 rounded-xl border p-3",
                job.status === "failed"
                  ? "border-red-500/30 bg-red-500/10"
                  : job.status === "completed"
                    ? "border-gold/40 bg-gold/10"
                    : "border-white/10 bg-noir",
              )}
              role="status"
              aria-live="polite"
            >
              {job.status === "failed" ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-red-300">
                    {t("media.jobFailed", {
                      err: job.error ?? t("errors.generic"),
                    })}
                  </p>
                  <button
                    onClick={() => {
                      // Sème le cache localStorage dans le job : les chunks
                      // déjà transcrits ne seront pas refaits.
                      const entries: Array<{
                        i: number;
                        segments: Array<{
                          start: number;
                          end: number;
                          text: string;
                        }>;
                        lang?: string;
                      }> = [];
                      try {
                        for (let idx = 0; idx < 200; idx++) {
                          const raw = localStorage.getItem(
                            `chunkcache:${job.sourceUrl}:${idx}`,
                          );
                          if (!raw) continue;
                          const parsed = JSON.parse(raw) as {
                            segments: Array<{
                              start: number;
                              end: number;
                              text: string;
                            }>;
                            lang?: string;
                          };
                          if (parsed?.segments?.length) {
                            entries.push({
                              i: idx,
                              segments: parsed.segments,
                              lang: parsed.lang,
                            });
                          }
                        }
                      } catch {
                        /* cache illisible — reprise serveur seule */
                      }
                      if (entries.length > 0)
                        void seedCache({ id: job._id as never, entries });
                      void retryJob({
                        jobId: job._id as never,
                        language: media.language as "en",
                      });
                    }}
                    className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs text-gold hover:bg-gold/20"
                  >
                    {t("media.jobRetry")}
                  </button>
                </div>
              ) : job.status === "completed" ? (
                <p className="text-xs text-gold">{t("media.stepDone")}</p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-2">
                      {t(job.currentStep ?? "media.stepQueued")}
                    </span>
                    <span className="font-mono text-gold">
                      {job.totalChunks
                        ? t("media.jobProgress", {
                            done: job.doneChunks ?? 0,
                            total: job.totalChunks,
                          })
                        : t("media.jobQueued")}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold-strong to-gold transition-[width] duration-500 ease-out"
                      style={{ width: `${jobProgressPct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[0.625rem] text-ink-3">
                    {t("media.jobSegments", {
                      done: jobSegCount,
                      total: status?.subtitles.length ?? 0,
                    })}
                  </p>
                </>
              )}
              {job.warning && job.status !== "failed" && (
                <p className="mt-2 text-[0.625rem] text-ink-3">⚠ {job.warning}</p>
              )}
            </div>
          )}
          {/* C1 — fiche sans lecteur : l'analyse reste accessible (impasse supprimée). */}
          {segCount === 0 && (
            <button
              type="button"
              onClick={() => void analyzeFromDetail()}
              disabled={analyzingDetail}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-4 py-2.5 text-sm font-semibold text-noir transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {analyzingDetail ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Layers className="size-4" />
              )}
              Analyser ce média
            </button>
          )}
          <div className="flex items-center justify-between gap-2">
            {/* Porte SRT/VTT — secours vidéo ET source principale des médias
                sans audio/vidéo (TVmaze, fiches métadonnées seules…). */}
            {(isVideoMedia || sourceless) && (
              <button
                type="button"
                onClick={() => setShowSubsImport((v) => !v)}
                title={
                  sourceless
                    ? "Importer un fichier SRT/VTT — source de transcription principale"
                    : "Importer un fichier SRT/VTT (secours si YouTube bloque les sous-titres)"
                }
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.6875rem] transition-colors",
                  showSubsImport
                    ? "border-gold/50 bg-gold/10 text-gold"
                    : "border-white/15 text-ink-2 hover:border-gold/40 hover:text-gold",
                )}
              >
                <Captions className="size-3.5" />
                <span className="hidden sm:inline">SRT/VTT</span>
              </button>
            )}
            {looksLikeSong && (
              <button
                type="button"
                onClick={() => void syncLyrics()}
                disabled={syncingLyrics || !effectiveMediaId}
                title="Récupérer les paroles horodatées (lrclib) et les traiter comme des sous-titres"
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[0.6875rem] text-ink-2 transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-40"
              >
                {syncingLyrics ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Music className="size-3.5" />
                )}
                <span className="hidden sm:inline">Paroles synchronisées</span>
              </button>
            )}
            <select
              value={targetLang}
              onChange={(e) => changeTargetLang(e.target.value)}
              aria-label="Langue cible"
              className="rounded-lg border border-white/10 bg-noir px-2.5 py-1.5 text-xs text-ink focus:border-gold/60 focus:outline-none"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            {/* Relancer la traduction SANS changer de langue : le recours
                quand la cascade n'a rien renvoyé pour certaines lignes. */}
            <button
              type="button"
              onClick={() => void retranslateNow()}
              disabled={translating || !effectiveMediaId}
              title="Relancer la traduction de tout le média"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[0.6875rem] text-ink-2 transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-40"
            >
              {translating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Languages className="size-3.5" />
              )}
              <span className="hidden sm:inline">{t("media.translateAll")}</span>
            </button>
          </div>

          {showSubsImport && (
            <SubtitleImportPanel
              onImport={(segs, meta) => void handleSubsImportRoom(segs, meta)}
              onClose={() => setShowSubsImport(false)}
              defaultSourceLang={(media.language || "en") as string}
            />
          )}

          <div className="mt-3">
            {segCount === 0 ? (
              <div
                title="Disponible dès que des segments existent"
                aria-disabled
                className="pointer-events-none select-none rounded-xl opacity-40"
              >
                <TimeWindowSelector
                  max={duration}
                  win={win}
                  onChange={setWin}
                  segBounds={segBounds}
                  selectedCount={shown.length}
                  wordCount={wordCount}
                />
              </div>
            ) : (
              <TimeWindowSelector
                max={duration}
                win={win}
                onChange={setWin}
                segBounds={segBounds}
                selectedCount={shown.length}
                wordCount={wordCount}
              />
            )}
          </div>

          <div className="mt-3 flex gap-1.5 border-b border-white/5">
            {ROOM_TABS.map((roomTab) => (
              <button
                key={roomTab.key}
                onClick={() => setTab(roomTab.key)}
                className={cn(
                  "shrink-0 border-b-2 px-2.5 pb-2 text-xs transition-colors",
                  tab === roomTab.key
                    ? "border-gold text-gold"
                    : "border-transparent text-ink-3 hover:text-ink-2",
                )}
              >
                {t(roomTab.labelKey)}
              </button>
            ))}
            {showLyricsTab && (
              <button
                onClick={() => {
                  setTab("lyrics");
                  void loadLyrics();
                }}
                className={cn(
                  "shrink-0 border-b-2 px-2.5 pb-2 text-xs transition-colors",
                  tab === "lyrics"
                    ? "border-gold text-gold"
                    : "border-transparent text-ink-3 hover:text-ink-2",
                )}
              >
                {t("media.tabLyrics")}
              </button>
            )}
          </div>

          <div
            key={tab}
            ref={listRef}
            className="ln-tab-in mt-3 flex-1 space-y-2 overflow-y-auto pr-1"
          >
            {tab === "lyrics" && (
              <div className="space-y-3">
                {lyricsLoading && (
                  <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-ink-2">
                    <Loader2 className="size-4 animate-spin text-gold" />
                    {t("common.loading")}
                  </div>
                )}

                {!lyricsLoading && lyrics?.ok && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-mono text-[0.625rem] uppercase text-gold">
                        {lyrics.artist ? `${lyrics.artist} — ` : ""}
                        {lyrics.title}
                      </p>
                      {/* Toggle Traduire — cascade Groq → local → MyMemory,
                          cache 24 h. Échec ⇒ désactivé + tooltip. */}
                      {lyricsHasText && (
                        <button
                          type="button"
                          onClick={() => void toggleLyricsTranslate()}
                          disabled={lyricsTrFailed || lyricsTrLoading}
                          title={
                            lyricsTrFailed
                              ? "Traduction indisponible"
                              : lyricsTrLoading
                                ? "Traduction en cours…"
                                : lyricsTr
                                  ? "Afficher le texte original"
                                  : "Traduire les paroles"
                          }
                          className={cn(
                            "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.6875rem] transition-colors",
                            lyricsTrFailed
                              ? "cursor-not-allowed border-white/10 text-ink-3 opacity-50"
                              : lyricsTr
                                ? "border-gold/50 bg-gold/10 text-gold"
                                : "border-white/15 text-ink-2 hover:border-gold/40 hover:text-gold",
                          )}
                        >
                          {lyricsTrLoading ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Languages className="size-3.5" />
                          )}
                          <span className="hidden sm:inline">
                            {lyricsTrFailed
                              ? "Traduction indisponible"
                              : lyricsTr
                                ? "Original"
                                : "Traduire"}
                          </span>
                        </button>
                      )}
                    </div>
                    {lyrics.segments && lyrics.segments.length > 0 ? (
                      <div
                        ref={lyricsListRef}
                        className={cn(
                          "rounded-xl border border-gold/20 bg-noir p-4",
                          lyricsTr && "lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-5",
                        )}
                      >
                        {/* Colonne originale — clic = seek du player. */}
                        <div className="space-y-0.5">
                          {lyrics.segments.map((line, i) => {
                            const active = i === activeLyricIndex;
                            return (
                              <button
                                key={`${line.start}-${i}`}
                                type="button"
                                id={`lyric-line-${i}`}
                                onClick={() => seekLyrics(line.start)}
                                title="Aller à ce moment"
                                className={cn(
                                  "relative w-full border-l-2 py-1.5 pl-3 pr-2 text-left text-sm leading-relaxed transition-colors",
                                  active
                                    ? "border-gold bg-gold/10 font-medium text-gold"
                                    : "border-transparent text-ink-2/60 hover:text-ink-2",
                                )}
                              >
                                {line.text}
                                {/* Empilé mobile : la traduction suit la ligne. */}
                                {lyricsTr && (
                                  <span className="mt-0.5 block text-xs font-normal italic text-gold-soft lg:hidden">
                                    {lyricsTr[i] ?? line.text}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {/* Colonne traduction (desktop ≥1024px), même ordre,
                            ligne active surlignée en parallèle. */}
                        {lyricsTr && (
                          <div className="hidden space-y-0.5 lg:block">
                            {lyrics.segments.map((line, i) => (
                              <p
                                key={`tr-${line.start}-${i}`}
                                className={cn(
                                  "py-1.5 pl-3 text-sm leading-relaxed transition-colors",
                                  i === activeLyricIndex
                                    ? "font-medium text-gold"
                                    : "text-ink-2/60",
                                )}
                              >
                                {lyricsTr[i] ?? line.text}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-gold/20 bg-noir p-4">
                        <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2/60">
                          {lyricsTr
                            ? lyricsTr.join("\n")
                            : lyrics.text}
                        </p>
                      </div>
                    )}
                    <a
                      href={lyrics.url ?? geniusSearchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-gold transition-colors hover:text-gold-soft"
                    >
                      {t("media.fullLyrics")}
                    </a>
                  </>
                )}

                {!lyricsLoading && lyrics && !lyrics.ok && (
                  <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-ink-2">
                    <p>{t("errors.textUnavailable")}</p>
                    <a
                      href={lyrics.url ?? geniusSearchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-gold transition-colors hover:text-gold-soft"
                    >
                      {t("media.fullLyrics")}
                    </a>
                  </div>
                )}
              </div>
            )}

            {tab === "slang" && (
              <div className="space-y-2">
                {(status?.slangDetected ?? []).map((h, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-gold/25 bg-gold/[0.06] p-3"
                  >
                    <p className="font-medium text-gold">{h.expression}</p>
                    <p className="text-sm text-ink">{h.meaning}</p>
                    {h.context && (
                      <p className="mt-1 text-xs text-ink-3">{h.context}</p>
                    )}
                  </div>
                ))}
                {(status?.slangDetected ?? []).length === 0 && (
                  <p className="py-6 text-center text-xs text-ink-3">
                    Aucun argot détecté dans la plage.
                  </p>
                )}
              </div>
            )}

            {/* Traduction en cours : progression réelle publiée par le pipeline. */}
            {(translating || status?.status === "processing") && (
              <div className="mb-3 rounded-xl border border-gold/25 bg-gold/[0.05] p-3">
                <div className="flex items-center justify-between gap-3 text-xs text-ink-2">
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin text-gold" />
                    {t("media.translating")}
                  </span>
                  <span className="font-mono text-[0.6875rem] text-gold">
                    {Math.min(
                      100,
                      Math.max(0, Math.round(status?.translationProgress ?? 0)),
                    )}
                    {" %"}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold-strong to-gold transition-[width] duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, status?.translationProgress ?? 0))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Colonne cible vide : on le DIT, au lieu de recopier l'original.
                (C'était le bug « la traduction = la source ».) */}
            {!translating &&
              status?.status === "completed" &&
              status.subtitles.some((s) => !s.translatedText) && (
                <div className="mb-3 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-xs text-amber-200/85">
                  <p>{t("media.translationUnavailable")}</p>
                  {status.subtitles.length > 0 && (
                    <p className="mt-1 text-amber-200/70">
                      La ligne d'origine reste affichée : rien n'est inventé.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void retranslateNow()}
                    className="mt-2 flex items-center gap-1.5 rounded-lg border border-gold/40 px-3 py-1 text-[0.6875rem] font-semibold text-gold transition-colors hover:bg-gold/10"
                  >
                    <Languages className="size-3" /> {t("media.translateAll")}
                  </button>
                </div>
              )}

            {(tab === "transcript" || tab === "translation") &&
              shown.map((s) => (
                <div
                  key={s.id}
                  id={`seg-${s.id}`}
                  className={cn(
                    "rounded-xl border p-3 transition-colors",
                    activeSeg?.id === s.id || activeSegYt?.id === s.id
                      ? "border-gold/60 bg-gold/10"
                      : s.isSlang
                        ? "border-gold/25 bg-gold/[0.04]"
                        : "border-white/5 bg-white/[0.02]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[0.625rem] text-ink-3">
                      {fmt(s.start)} → {fmt(s.end)}
                    </span>
                    {s.isSlang && (
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[0.5625rem] uppercase text-gold">
                        argot
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-ink">{s.originalText}</p>
                  {s.translatedText ? (
                    <p className="mt-0.5 text-sm text-gold-soft">
                      {s.translatedText}
                    </p>
                  ) : tab === "translation" ? (
                    <p className="mt-0.5 text-xs text-ink-3 italic">
                      {t("media.translationUnavailable")}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center gap-2">
                    {s.isSlang && !added.has(s.id) && (
                      <button
                        onClick={() => handleRevise(s)}
                        className="flex items-center gap-1.5 rounded-full border border-gold/40 px-2.5 py-1 text-[0.625rem] text-gold hover:bg-gold/10"
                      >
                        <Layers className="size-3" /> + Réviser
                      </button>
                    )}
                    {added.has(s.id) && (
                      <span className="font-mono text-[0.625rem] text-gold/70">
                        ✓ demandé
                      </span>
                    )}
                    {s.isSlang && added.has(s.id) && srsQuery && (
                      <Loader2 className="size-3 animate-spin text-gold/60" />
                    )}
                  </div>
                </div>
              ))}

            {status?.status === "failed" && status.error && (
              <p className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-200">
                {status.error}
              </p>
            )}
            {status?.status === "processing" && (
              <div className="flex items-center gap-2 p-4 text-xs text-ink-2">
                <Loader2 className="size-4 animate-spin text-gold" />
                Traduction… {status.translationProgress ?? 0} %
              </div>
            )}
            {status?.status === "pending" && (
              <div className="flex items-center gap-2 p-4 text-xs text-ink-2">
                <Loader2 className="size-4 animate-spin text-gold" /> Préparation…
              </div>
            )}
            {!status && (
              <p className="py-6 text-center text-xs text-ink-3">
                {t("media.panelEmpty")}
              </p>
            )}
          </div>
        </TiltCard>
      </div>
    </div>
  );
}
