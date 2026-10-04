import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LANGUAGES, type LanguageCode } from "@/convex/languages";
import { activeSubtitle, formatTimestamp } from "@/convex/subtitles";
import { toast } from "sonner";
import { cn, friendlyError } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  Check,
  Clapperboard,
  FileText,
  FileVideo,
  FlaskConical,
  Heart,
  Layers,
  Link2,
  Loader2,
  Mic,
  Languages,
  ExternalLink,
  ScanSearch,
  TriangleAlert,
  Upload,
  Youtube,
} from "lucide-react";
import { Captions, ChevronDown, Columns2 } from "lucide-react";
import type { ParsedSubtitleSegment } from "@/lib/subtitleParse";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  UI_LANGS,
  uiLangMeta,
  loadStoredTargetLang,
  storeTargetLang,
  type UiLang,
} from "@/lib/i18n";

/** Message unique quand la cible choisie est la langue du média himself. */
const TARGET_SAME_AS_SOURCE =
  "Choisis une autre langue que celle du média — sinon la colonne de droite serait identique à la colonne de gauche.";
import { UrlInput, parseVideoUrl, type ParsedVideo } from "./UrlInput";
import {
  detectPlatform,
  PLATFORM_LABELS as RESOLVER_LABELS,
  type MediaResolution,
} from "../../convex/mediaResolver";
import { YouTubeEmbed } from "./YouTubeEmbed";
import { TikTokEmbed } from "./TikTokEmbed";
import { DailymotionEmbed } from "./DailymotionEmbed";
import { useTikTokPlayer, type TTControls } from "@/hooks/use-tiktok-player";
import {
  describeTranscriptStatus,
  resolveTranscript,
  type TranscriptResult,
} from "@/lib/transcript";
import { registerBuiltinTranscriptProviders } from "@/lib/transcriptProviders";
import { SubtitlePanel } from "./SubtitlePanel";
import {
  SubtitleImportPanel,
  type SubtitleImportMeta,
} from "./SubtitleImportPanel";
import {
  UploadedPlayer,
  TextShadowPlayer,
  ShadowTransport,
  type ShadowControls,
} from "./ShadowPlayers";
import type { YTControls } from "@/hooks/use-youtube-player";
import { GoldBurst } from "@/components/fx/rewards";
import { PlaceHeader } from "@/components/fx/PlaceHeader";
import {
  LOCAL_ASR_ENGINE,
  MAX_LOCAL_BYTES,
  MAX_LOCAL_SECONDS,
  baseLang,
  decodeToPcm16k,
  probeLocalAsr,
  transcribeLocal,
  translateLocal,
} from "@/lib/localEngines";

/* Étapes affichées pendant l'analyse — mots simples, aucun terme interne. */
const STEPS = [
  { key: "pending", label: "Lien ou fichier ajouté", icon: FileVideo },
  { key: "transcript", label: "Récupération des paroles", icon: Mic },
  { key: "translate", label: "Traduction", icon: Languages },
  { key: "extract", label: "Repérage de l'argot", icon: ScanSearch },
] as const;

type ActiveKind = "youtube" | "tiktok" | "dailymotion" | "file" | "text";

export function ShadowView() {
  const myLanguages = useQuery(api.learning.myLanguages, {});
  const addToSrs = useMutation(api.learning.addToSrs);
  const recordSession = useMutation(api.learning.recordSession);
  const recordActivity = useMutation(api.achievements.recordActivity);
  const checkAchievements = useAction(api.achievements.checkAchievements);
  const createUploadUrl = useMutation(api.media.createUploadUrl);
  const createMedia = useMutation(api.media.createMedia);
  const createLinkMedia = useMutation(api.media.createLinkMedia);
  const resolveMediaUrl = useAction(api.media.resolveMediaUrl);
  const createTextMedia = useMutation(api.media.createTextMedia);
  const kickPipeline = useMutation(api.media.kickPipeline);
  // Transcript produit par le moteur local du déploiement (§7).
  const ingestLocalTranscript = useAction(api.mediaHub2.ingestLocalTranscript);
  // Porte de secours SRT/VTT (LOT B) : création média sans pipeline +
  // injection des segments parsés dans le pipeline EXISTANT.
  const createHubMedia = useMutation(api.media.createHubMedia);
  const analyzeHubSegments = useAction(api.mediaHub2.analyzeHubSegments);
  // Cible de traduction — re-traduction à chaud (LOT UI 2).
  const setMediaTargetLang = useMutation(api.media.setMediaTargetLanguage);
  const retranslate = useAction(api.mediaRetranslate.retranslateMedia);

  const [lang, setLang] = useState<LanguageCode>("en");
  // Cible « TRADUIRE VERS » : les 12 langues UI, persistée
  // (shadow.targetLang), défaut = langue UI courante.
  const [targetLang, setTargetLang] = useState<LanguageCode | "fr">(
    loadStoredTargetLang,
  );
  // Re-traduction en cours (changement de cible en session).
  const [retranslating, setRetranslating] = useState(false);
  // Porte de secours SRT/VTT — panneau d'import (session + échec quota).
  const [showSubsImport, setShowSubsImport] = useState(false);
  // Horloge virtuelle pour un média « sous-titres seuls » (B2).
  const subsClockRef = useRef<number | null>(null);
  const [mediaId, setMediaId] = useState<Id<"userMedia"> | null>(null);
  const [uploading, setUploading] = useState(false);
  // Étape du moteur local (téléchargement du modèle, transcription,
  // traduction) — affichée à l'utilisateur, jamais un spinner muet.
  const [localStage, setLocalStage] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<
    "file" | "url" | "text" | "subs"
  >("file");
  const [textDraft, setTextDraft] = useState("");
  const [sendingText, setSendingText] = useState(false);
  // Plateforme reconnue mais non lisible dans MOOVY : carte honnête
  // (raison + « Ouvrir la source » + orientation upload), jamais un lecteur vide.
  const [unresolved, setUnresolved] = useState<{
    label: string;
    reason: string;
    url: string;
    thumbnailUrl?: string;
  } | null>(null);
  const [busyUrl, setBusyUrl] = useState(false);
  // Micro-reward: gold burst fires when the pipeline completes.
  const [burstTick, setBurstTick] = useState(0);
  const burstRef = useRef(0);
  // Playback clock of the active media (sampled / virtual for text).
  const [playbackTime, setPlaybackTime] = useState(0);
  // Disposition des sous-titres — persistée (shadow.layout : side | stacked).
  // Mobile (<1024px) reste toujours empilé, quel que soit l'état.
  const [sideBySide, setSideBySide] = useState(() => {
    try {
      // Défaut = côte à côte sur desktop (LOT UI 2) — la vue empilée reste
      // inchangée <1024px (CSS). « stacked » explicite = préférence stockée.
      return localStorage.getItem("shadow.layout") !== "stacked";
    } catch {
      return true;
    }
  });
  const toggleSideBySide = () =>
    setSideBySide((v) => {
      const next = !v;
      try {
        localStorage.setItem("shadow.layout", next ? "side" : "stacked");
      } catch {
        /* quota — l'état reste appliqué pour la session */
      }
      return next;
    });
  /** ── Porte de secours SRT/VTT (LOT B) ──
      Injection des segments parsés via le pipeline EXISTANT
      (analyzeHubSegments → cascade de traduction cible + argot). L'état
      « pending » du média fraîchement créé est first patché en processing
      (sinon le status resterait stuck, kickPipeline ignorant les médias
      terminés). Ré-import = remplacement des segments (runSharedPipeline
      réécrit subtitles/slangDetected — pas de duplication). */
  const injectSubtitleSegments = async (
    mediaId: Id<"userMedia">,
    segments: ParsedSubtitleSegment[],
    synced: boolean,
    /** LOT D — langue réelle du fichier importé (déclarée par
        l'utilisateur) : un .srt anglais pendant qu'on apprend le yoruba
        doit être traduit en → cible, jamais yo → cible. */
    sourceLang: string,
  ) => {
    await analyzeHubSegments({
      mediaId,
      language: lang,
      targetLanguage: targetLang,
      sourceLanguage: sourceLang as UiLang,
      segments: synced
        ? segments
        : segments.map((s) => ({ ...s, start: 0, end: 0 })),
      transcriptSource: "subtitle_file",
    });
  };

  /** B2 — idle : crée une session « sous-titres seuls » (horloge timer en
      mode synchro, liste en mode nu). */
  const handleSubsImportIdle = async (
    segments: ParsedSubtitleSegment[],
    meta: SubtitleImportMeta,
  ) => {
    setBusyUrl(true);
    try {
      const mediaId = await createHubMedia({
        language: lang,
        title: meta.sourceName.replace(/\.(srt|vtt|txt)$/i, "").slice(0, 80),
        sourceName: meta.sourceName,
        mediaType: "subs",
        targetLanguage: targetLang,
      });
      setMediaId(mediaId);
      subsClockRef.current = 0;
      await injectSubtitleSegments(mediaId, segments, meta.synced, meta.sourceLang);
      toast.success(
        `${segments.length} lignes importées${meta.synced ? " — les temps du fichier sont gardés" : " — lues les unes après les autres"}`,
        meta.truncated
          ? { description: "Seules les 5 000 premières lignes ont été gardées." }
          : undefined,
      );
    } catch (err) {
      console.error("[subs] import idle impossible:", err);
      toast.error(friendlyError(err, "Import impossible"));
    } finally {
      setBusyUrl(false);
    }
  };

  /** B1 — session : remplace les segments du média en cours. */
  const handleSubsImportSession = async (
    segments: ParsedSubtitleSegment[],
    meta: SubtitleImportMeta,
  ) => {
    if (!mediaId) return;
    setShowSubsImport(false);
    try {
      await injectSubtitleSegments(mediaId, segments, meta.synced, meta.sourceLang);
      toast.success(
        `${segments.length} lignes importées — traduction et argot mis à jour`,
        meta.truncated
          ? { description: "Seules les 5 000 premières lignes ont été gardées." }
          : undefined,
      );
    } catch (err) {
      console.error("[subs] import session impossible:", err);
      toast.error(friendlyError(err, "Import impossible"));
    }
  };

  /** Changement de cible « TRADUIRE VERS » : persistance locale, puis
      re-traduction immédiate du média en cours via la cascade existante
      (le transcript est déjà stocké — aucune re-transcription, cache 24 h
      par cible). Échec ⇒ toast, l'affichage garde l'état précédent. */
  const changeTargetLang = (next: LanguageCode | "fr") => {
    // Garde LOT D : la colonne cible ne peut pas être la langue du média
    // (elle recopierait la colonne source à l'identique).
    if (next === lang) {
      toast.error(TARGET_SAME_AS_SOURCE);
      return;
    }
    setTargetLang(next);
    storeTargetLang(next);
    if (!mediaId) return;
    setRetranslating(true);
    void (async () => {
      try {
        await setMediaTargetLang({ mediaId, targetLanguage: next });
        const r = await retranslate({ mediaId, targetLanguage: next });
        if (!r.ok) console.log(`[ui] re-traduction ignorée — ${r.reason}`);
      } catch (err) {
        console.error("[ui] re-traduction impossible:", err);
        toast.error(friendlyError(err, "Re-traduction impossible"));
      } finally {
        setRetranslating(false);
      }
    })();
  };
  // YouTube transport state (rate persists across the session).
  const [ytPlaying, setYtPlaying] = useState(false);
  const [ytRate, setYtRate] = useState(1);
  const [ytVolume, setYtVolume] = useState(1);
  const [ytMuted, setYtMuted] = useState(false);
  const [ttMuted, setTtMuted] = useState(false);
  const ytControlsRef = useRef<YTControls | null>(null);
  const ttControlsRef = useRef<TTControls | null>(null);
  const fileControlsRef = useRef<ShadowControls | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live pipeline status (reactive — updates as the action progresses).
  const status = useQuery(
    api.media.getMediaStatus,
    mediaId ? { mediaId } : "skip",
  );

  useEffect(() => {
    if (myLanguages && myLanguages.activeFocus.length > 0) {
      setLang(myLanguages.activeFocus[0]);
    }
  }, [myLanguages]);

  // Re-résolution LOCALE du média actif (module pur — zéro réseau) : le
  // lecteur est choisi d'après le MODE du contrat MediaResolution, plus
  // aucun test d'URL éparpillé dans le composant.
  const stored = useMemo(() => {
    if (!status?.sourceUrl) return null;
    const detected = detectPlatform(status.sourceUrl);
    if (!detected) return null;
    const base = detected.adapter.resolve(detected.url);
    return { platform: detected.adapter.key, id: base.id, mode: base.mode };
  }, [status?.sourceUrl]);
  const ytVideoId = stored?.platform === "youtube" ? stored.id : null;
  const tiktokPostId =
    stored?.platform === "tiktok" && stored.mode === "EMBED_ALLOWED"
      ? stored.id
      : null;
  // Dailymotion : lecteur officiel dailymotion.com/embed (lecture dans
  // l'app, sans contrôle postMessage documenté — pas de karaoké). La
  // résolution locale redonne aussi l'URL lisible pour les médias
  // DIRECT_STREAM (Archive.org, fichiers directs) : un <video>/<audio>
  // natif suffit, aucune redirection.
  const dailymotionId =
    stored?.platform === "dailymotion" && stored.mode === "EMBED_ALLOWED"
      ? stored.id
      : null;
  const directPlayableUrl = useMemo(() => {
    if (!status?.sourceUrl || status.mediaType === "text") return null;
    if (ytVideoId || tiktokPostId || dailymotionId) return null;
    if (status.mediaUrl) return null; // fichier uploadé : déjà servi par Convex
    const detected = detectPlatform(status.sourceUrl);
    if (!detected) return null;
    const base = detected.adapter.resolve(detected.url);
    return base.mode === "DIRECT_STREAM" && base.playableUrl
      ? base.playableUrl
      : null;
  }, [status?.sourceUrl, status?.mediaUrl, status?.mediaType, ytVideoId, tiktokPostId, dailymotionId]);
  // État de lecture TikTok (messages postMessage du lecteur officiel).
  const tt = useTikTokPlayer(tiktokPostId ?? null);
  // Familles de lecture : YouTube embed, TikTok officiel, Dailymotion
  // officiel, média direct (Archive/fichier URL), fichier uploadé, texte.
  const activeKind: ActiveKind =
    status?.mediaType === "text"
      ? "text"
      : ytVideoId
        ? "youtube"
        : tiktokPostId
          ? "tiktok"
          : dailymotionId
            ? "dailymotion"
            : "file";

  // ── Couche TranscriptProvider (indépendante du player) ──
  // La résolution suit la priorité §7 (captions natives → captions →
  // externe → ASR → UNAVAILABLE honnête). Aucun lien de dépendance avec le
  // player : un média peut être lisible sans transcript et réciproquement.
  const [ttTranscript, setTtTranscript] = useState<TranscriptResult | null>(
    null,
  );
  useEffect(() => {
    registerBuiltinTranscriptProviders();
    if (activeKind !== "tiktok" || !stored?.id) {
      setTtTranscript(null);
      return;
    }
    let cancelled = false;
    setTtTranscript(null);
    void resolveTranscript({
      platform: stored.platform,
      platformId: stored.id,
      mediaType: "video",
      originalUrl: status?.sourceUrl,
    }).then((result) => {
      if (!cancelled) setTtTranscript(result);
      console.log(
        `[ShadowURL] transcript — status ${result.status}` +
          (result.reason ? ` (${result.reason})` : ""),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [activeKind, stored?.platform, stored?.id]);

  // Débuts de segments — partagés aux barres de transport pour les sauts.
  const segmentStarts = useMemo(
    () => (status?.subtitles ?? []).map((s) => s.start),
    [status?.subtitles],
  );

  /** Seek unifié : YouTube via l'API IFrame, fichier via l'élément natif,
      texte via l'horloge virtuelle. */
  const seekTo = (t: number) => {
    if (activeKind === "youtube") {
      ytControlsRef.current?.seek(t);
      setPlaybackTime(t);
    } else if (activeKind === "tiktok") {
      ttControlsRef.current?.seekTo(t);
      setPlaybackTime(t);
    } else if (activeKind === "text") {
      setPlaybackTime(Math.max(0, t));
    } else {
      fileControlsRef.current?.seek(t);
      // Optimiste (l'élément clampe) : sans cette mise à jour, un clic segment
      // en PAUSE ne déplaçait le surlignage qu'au prochain `timeupdate`.
      setPlaybackTime(t);
    }
  };

  const jumpSegment = (starts: number[], dir: "prev" | "next") => {
    if (activeKind === "file") {
      if (dir === "prev") fileControlsRef.current?.prevSegment(starts);
      else fileControlsRef.current?.nextSegment(starts);
      return;
    }
    const target =
      dir === "prev"
        ? [...starts].reverse().find((s) => s < playbackTime - 0.4)
        : starts.find((s) => s > playbackTime + 0.2);
    if (target !== undefined) seekTo(target);
  };

  // Auto-scroll to the subtitle matching the video playback clock.
  const lastActiveSubRef = useRef<number | null>(null);
  useEffect(() => {
    if (!status || status.status !== "completed") return;
    const active = activeSubtitle(status.subtitles, playbackTime);
    if (active && active.id !== lastActiveSubRef.current) {
      lastActiveSubRef.current = active.id;
      document
        .getElementById(`subtitle-${active.id}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      // Colonne traduction (côte à côte) : même segment, même mouvement.
      document
        .getElementById(`subtitle-tr-${active.id}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    if (!active) lastActiveSubRef.current = null;
  }, [playbackTime, status]);

  // Debug trace mirroring the backend's [shadow] logs: log each pipeline
  // status transition once, so the browser console shows the same story the
  // Convex dashboard does while debugging a stall.
  const lastLoggedStatus = useRef("");
  useEffect(() => {
    if (!status) return;
    const key = `${status.status}:${status.error ?? ""}`;
    if (key === lastLoggedStatus.current) return;
    const prev = lastLoggedStatus.current;
    lastLoggedStatus.current = key;
    console.log(
      `[ui] pipeline status: ${status.status}` +
        (status.transcriptSource ? ` — source: ${status.transcriptSource}` : "") +
        (status.error ? ` — ${status.error}` : ""),
    );
    // Step moments as toasts (skip the first observation — the intake toast
    // already covers it). Mirrors the old stepMessage idea, driven by the
    // reactive DB subscription instead of local state.
    if (prev && status.status === "completed") {
      burstRef.current += 1;
      setBurstTick(burstRef.current);
      const embedOnly =
        (activeKind === "tiktok" || activeKind === "dailymotion") &&
        status.subtitles.length === 0;
      toast.success(embedOnly ? "Lecteur monté ▶" : "Terminé ! 🎉", {
        description: embedOnly
          ? "Lecture TikTok active — TikTok ne donne pas les paroles : le karaoké n'est pas possible ici."
          : `${status.subtitles.length} sous-titres synchronisés${
              status.slangDetected.length > 0
                ? ` · ${status.slangDetected.length} expression${status.slangDetected.length > 1 ? "s" : ""} d'argot`
                : ""
            }`,
      });
    } else if (prev && status.status === "failed") {
      toast.error("Le traitement a échoué", {
        description: status.error ?? "Erreur inconnue",
      });
    }
  }, [status]);

  // Stall watchdog: if the pipeline stays in pending/processing for 45s, offer
  // a manual kick (covers actions killed before writing any status change).
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (
      !status ||
      (status.status !== "pending" && status.status !== "processing")
    ) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(0);
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [status?._id, status?.status]);
  const pipelineStalled = elapsedSeconds >= 45;

  const handleKick = async () => {
    if (!mediaId) return;
    try {
      await kickPipeline({ mediaId });
      toast.success("Analyse relancée");
    } catch {
      toast.error("Relance impossible");
    }
  };

  // ASR engine diagnostic. Le moteur PRINCIPAL est désormais celui du
  // déploiement : Whisper ONNX exécuté dans l'onglet (poids libres, aucun
  // service à lancer). Le bouton charge réellement ce moteur et exécute une
  // inférence — s'il répond, le chemin local est prouvé ; sinon le repli
  // serveur (faster-whisper auto-hébergé → Groq) reste disponible.
  type AsrCheck = { success: boolean; message?: string; error?: string };
  const testAsrEngine = useAction(api.youtubePipeline.testAsrEngine);
  const [asrCheck, setAsrCheck] = useState<AsrCheck | null>(null);
  const [asrChecking, setAsrChecking] = useState(false);
  const handleAsrCheck = async () => {
    setAsrChecking(true);
    setAsrCheck(null);
    try {
      const probe = await probeLocalAsr((p) =>
        console.log(`[local-asr] ${p.stage} — ${p.message}`),
      );
      setAsrCheck({
        success: true,
        message: `Moteur local du déploiement disponible — ${probe.engine} (${probe.model}, ${probe.device}) · inférence test en ${probe.seconds.toFixed(1)} s · aucun service externe`,
      });
    } catch (e) {
      console.error("[ui] moteur local indisponible:", e);
      // Repli : on interroge l'ancien moteur serveur pour dire à
      // l'utilisateur ce qui prendra le relais, sans jamais mentir.
      try {
        const server = await testAsrEngine({});
      setAsrCheck({
        success: false,
        error: server.success
          ? "L'écoute sur ton appareil n'est pas disponible ici — le traitement automatique prend le relais."
          : "Transcription indisponible pour le moment.",
      });
      } catch {
        setAsrCheck({
          success: false,
          error: "Transcription indisponible pour le moment.",
        });
      }
    } finally {
      setAsrChecking(false);
    }
  };

  /**
   * Chemin principal : le moteur local du déploiement (Whisper ONNX dans
   * l'onglet) transcrit puis traduit ; le résultat est publié via
   * `ingestLocalTranscript`. Toute défaillance (modèle inaccessible, audio
   * indécodable, mémoire) bascule sur le pipeline serveur existant — jamais
   * un échec silencieux ni un faux succès.
   */
  const runLocalPipeline = async (
    mediaId: Id<"userMedia">,
    file: File,
    sourceLanguage: string,
  ) => {
    try {
      setLocalStage("Lecture de l'audio…");
      const pcm = await decodeToPcm16k(await file.arrayBuffer());
      if (pcm.length / 16000 > MAX_LOCAL_SECONDS) {
        throw new Error(
          `audio de ${(pcm.length / 16000 / 60).toFixed(1)} min — au-delà du moteur navigateur`,
        );
      }
      const transcript = await transcribeLocal(pcm, {
        language: sourceLanguage,
        onProgress: (p) => setLocalStage(p.message),
      });
      const wordCount = transcript.segments.reduce(
        (n, s) => n + (s.words?.length ?? 0),
        0,
      );
      console.log(
        `[local-asr] ${transcript.engine} — ${transcript.segments.length} segments, ${wordCount} mots horodatés, audio ${transcript.seconds.toFixed(1)} s`,
      );

      // Traduction locale (OPUS-MT). null ⇒ pas de route pour la paire :
      // la cascade serveur s'en charge (aucune traduction vide affichée).
      setLocalStage("Traduction locale…");
      const translations = await translateLocal(
        transcript.segments.map((s) => s.text),
        baseLang(transcript.language) ?? sourceLanguage,
        targetLang,
        (p) => setLocalStage(p.message),
      );

      setLocalStage("Publication des sous-titres…");
      await ingestLocalTranscript({
        mediaId,
        language: lang,
        targetLanguage: targetLang,
        transcriptSource: LOCAL_ASR_ENGINE,
        text: transcript.text,
        durationSeconds: transcript.seconds,
        detectedLanguage: transcript.language,
        segments: transcript.segments.map((s) => ({
          start: s.start,
          end: s.end,
          text: s.text,
          ...(s.words && s.words.length > 0 ? { words: s.words } : {}),
        })),
        translations: translations ?? undefined,
      });
      toast.success(
        `Transcrit en local — ${transcript.segments.length} sous-titres`,
        {
          description: translations
            ? "Traduction assurée par le moteur local (aucune requête distante)."
            : "Traduction assurée par le service de repli.",
        },
      );
    } catch (err) {
      console.warn(
        "[local-asr] moteur local indisponible → repli pipeline serveur:",
        err,
      );
      try {
        await kickPipeline({ mediaId });
        toast.info("Traitement automatique…", {
          description:
            "Ton appareil n'a pas pu traiter ce fichier — le traitement automatique prend le relais.",
        });
      } catch (fallbackErr) {
        console.error("[ui] repli serveur impossible:", fallbackErr);
        toast.error(
          fallbackErr instanceof Error
            ? fallbackErr.message
            : "Traitement impossible",
        );
      }
    } finally {
      setLocalStage(null);
    }
  };

  const handleFile = async (file: File) => {
    // Garde-fou AVANT tout upload : un fichier non-média (PDF, .txt, image…)
    // envoyé au pipeline ne pouvait que finir en échec de transcription —
    // message utilisateur clair + aucune écriture en base.
    const looksLikeMedia =
      file.type.startsWith("audio/") ||
      file.type.startsWith("video") ||
      /\.(mp3|mp4|m4a|wav|ogg|oga|webm|mov|mkv|flac|aac)$/i.test(file.name);
    if (!looksLikeMedia) {
      toast.error(
        `« ${file.name} » n'est pas un fichier audio ou vidéo. Choisis un MP3, MP4, WAV, MOV…`,
      );
      return;
    }
    // Au-delà de la limite, on laisse le pipeline serveur découper le fichier
    // (mediaJobs) au lieu de figer l'onglet sur une inférence géante.
    const localEligible = file.size <= MAX_LOCAL_BYTES;
    setUploading(true);
    try {
      const postUrl = await createUploadUrl({});
      const res = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("Échec de l'upload");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const created = await createMedia({
        language: lang,
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
        sourceName: file.name,
        mediaType: file.type.startsWith("video") ? "video" : "audio",
        storageId,
        targetLanguage: targetLang,
        // Le moteur local prend la main : le pipeline serveur n'est pas
        // planifié (aucune requête ASR distante), sauf en repli explicite.
        deferPipeline: localEligible,
      });
      console.log(
        `[ui] upload enregistré — média ${created.mediaId}, moteur local : ${localEligible ? "oui" : "non (fichier volumineux)"}`,
      );
      setMediaId(created.mediaId);
      if (localEligible) {
        toast.success("Média envoyé — transcription locale en cours");
        void runLocalPipeline(created.mediaId, file, lang);
      } else {
        toast.success("Média envoyé — l'analyse démarre");
      }
    } catch (err) {
      console.error("[ui] échec upload/création média:", err);
      toast.error(friendlyError(err, "Upload impossible"));
    } finally {
      setUploading(false);
    }
  };

  /** Texte collé : segmentation + traduction + argot — sans transcription. */
  const handleTextImport = async () => {
    const text = textDraft.trim();
    if (text.length < 2) {
      toast.error("Colle d'abord un texte à analyser.");
      return;
    }
    setSendingText(true);
    try {
      const created = await createTextMedia({
        language: lang,
        title: text.slice(0, 60).replace(/\s+/g, " ") || "Texte importé",
        text,
        targetLanguage: targetLang,
      });
      console.log(`[ui] texte enregistré — média ${created.mediaId}`);
      setMediaId(created.mediaId);
      toast.success("Texte enregistré — l'analyse démarre");
    } catch (err) {
      console.error("[ui] échec création média texte:", err);
      toast.error(friendlyError(err, "Import impossible"));
    } finally {
      setSendingText(false);
    }
  };

  const reset = () => {
    setMediaId(null);
    setShowSubsImport(false);
    setUnresolved(null);
    setPlaybackTime(0);
    setYtPlaying(false);
    setYtVolume(1);
    setYtMuted(false);
    setTtMuted(false);
    ytControlsRef.current = null;
    ttControlsRef.current = null;
    fileControlsRef.current = null;
  };

  /** URL intake : résolution universelle (MediaUrlResolver) puis routage
      selon le verdict. Une plateforme non lisible affiche une carte honnête
      — jamais de média fantôme ni de faux succès. */
  const handleAnalyse = async (v: ParsedVideo) => {
    console.log(`[ShadowURL] input — ${v.url}`);
    setBusyUrl(true);
    try {
      // 1. Résolution backend : normalizeUrl → detectPlatform → adapter →
      // oEmbed officiel → MediaResolution. Verdict RÉEL (privée, supprimée,
      // embed interdit…) AVANT toute création de média.
      const resolution: MediaResolution = await resolveMediaUrl({ url: v.url });
      console.log(
        `[ShadowURL] platform ${resolution.platform} — mode ${resolution.mode}` +
          (resolution.title ? ` — « ${resolution.title} »` : ""),
      );
      const platformLabel =
        RESOLVER_LABELS[resolution.platform as keyof typeof RESOLVER_LABELS] ??
        resolution.platform;

      if (resolution.mode === "UNAVAILABLE") {
        console.log(`[ShadowURL] verdict UNAVAILABLE — ${resolution.reason ?? ""}`);
        setUnresolved({
          label: platformLabel,
          reason: resolution.reason ?? "Média indisponible.",
          url: resolution.originalUrl,
          thumbnailUrl: resolution.thumbnailUrl,
        });
        return;
      }
      // 2. Média EMBED_ALLOWED (YouTube, TikTok) : création + pipeline adapté.
      // Le CHOIX DU LECTEUR, plus bas, dépend de `mode` + `platform` du
      // contrat — plus aucun if d'URL dans le composant.
      if (resolution.mode === "EMBED_ALLOWED") {
        const title = resolution.title
          ? `${platformLabel} · ${resolution.title}`
          : `${platformLabel} · ${v.videoId ?? "media"}`;
        console.log(
          `[ShadowURL] création média — embedUrl ${resolution.embedUrl ?? "—"}`,
        );
        const created = await createLinkMedia({
          language: lang,
          title,
          url: v.url,
          platform: resolution.platform,
          targetLanguage: targetLang,
        });
        console.log(`[ShadowURL] média créé — ${created.mediaId} ; suivi du pipeline`);
        setMediaId(created.mediaId);
        toast.success(
          resolution.platform === "youtube"
            ? "Lien enregistré — sous-titres YouTube en récupération"
            : "Lien enregistré — lecteur officiel monté",
        );
        return;
      }
      // 3. Tout le reste (DIRECT_STREAM, EXTERNAL_ONLY, …) : carte honnête —
      // raison explicite + « Ouvrir la source » + orientation upload.
      console.log(`[ShadowURL] verdict ${resolution.mode} — carte honnête`);
      setUnresolved({
        label: platformLabel,
        reason:
          resolution.reason ??
          "Lecture directe limitée — utilise « Upload fichier » pour l'analyse complète.",
        url: resolution.originalUrl,
        thumbnailUrl: resolution.thumbnailUrl,
      });
    } catch (err) {
      console.error("[ShadowURL] échec analyse du lien:", err);
      toast.error(friendlyError(err, "Analyse impossible"));
    } finally {
      setBusyUrl(false);
    }
  };

  // ─── Idle: intake ──────────────────────────────────────────────
  if (!mediaId) {
    return (
      <div className="space-y-6">
        <PlaceHeader
          place="shadow"
          title="Shadow un contenu"
          icon={Clapperboard}
          motif="halftone"
          description="Envoie un extrait de série ou un podcast dans ta langue focus, colle un lien YouTube — ou colle simplement un texte. Tout reste lisible et synchronisé ici : traduction automatique, argot repéré dans notre base, lecture au rythme du média — sans aucune clé payante."
        />

        {/* Translation target — the language subtitles are rendered in. */}
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="target-lang"
            className="font-mono text-[0.625rem] uppercase tracking-widest text-ink-3"
          >
            Traduire vers
          </label>
          <div className="relative">
            <select
              id="target-lang"
              value={targetLang}
              onChange={(e) =>
                changeTargetLang(e.target.value as LanguageCode | "fr")
              }
              className="appearance-none rounded-lg border border-white/10 bg-noir-2 py-2 pl-4 pr-9 text-sm text-ink transition-colors hover:border-white/25 focus:border-gold/50 focus:outline-none"
            >
              {/* Les 12 langues UI — libellé natif + drapeau via uiLangMeta.
                  La langue du média est désactivée : la cible doit être une
                  AUTRE langue, sinon la colonne cible recopie la source. */}
              {UI_LANGS.map((code) => {
                const meta = uiLangMeta(code);
                const isMediaLang = code === lang;
                return (
                  <option key={code} value={code} disabled={isMediaLang}>
                    {meta.flag} {meta.native}
                    {isMediaLang ? " — langue du média" : ""}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-ink-3" />
          </div>
          {targetLang === lang && (
            <p className="w-full text-xs text-amber-300">
              {TARGET_SAME_AS_SOURCE}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => {
            const active = myLanguages?.activeFocus.includes(l.code);
            return (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition-all ${
                  lang === l.code
                    ? "border-gold/50 bg-gold/10 text-gold"
                    : "border-white/10 text-ink-2 hover:border-white/25"
                }`}
              >
                <span>{l.flag}</span>
                {l.name}
                {active && (
                  <span
                    className="size-1.5 rounded-full bg-gold"
                    title="Focus actif"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Intake mode: file upload, pasted link, or pasted text — plus an
            always-visible gold upload CTA, so the guaranteed path is one tap
            from intake. */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex rounded-xl border border-white/10 bg-noir-2/60 p-1">
            {(
              [
                { key: "url", label: "Coller un lien", icon: Link2 },
                { key: "file", label: "Fichier", icon: Upload },
                { key: "text", label: "Texte", icon: FileText },
                { key: "subs", label: "Sous-titres (SRT/VTT)", icon: Captions },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                onClick={() => setInputMode(m.key)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-all ${
                  inputMode === m.key
                    ? "bg-gold/15 text-gold"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                <m.icon className="size-4" />
                {m.label}
              </button>
            ))}
          </div>
          {inputMode !== "text" && inputMode !== "subs" && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || localStage !== null}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-5 py-2.5 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {uploading || localStage ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {localStage ? "Moteur local…" : "Upload fichier"}
            </button>
          )}
        </div>

        {/* ASR engine diagnostic (faster-whisper local → Groq) */}
        {inputMode !== "text" && inputMode !== "subs" && (
          <div className="mx-auto w-fit text-center">
            <button
              onClick={() => void handleAsrCheck()}
              disabled={asrChecking}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 font-mono text-[0.6875rem] uppercase tracking-wider text-ink-3 transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-50"
            >
              {asrChecking ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FlaskConical className="size-3.5" />
              )}
              Tester le moteur de transcription
            </button>
            {asrCheck && (
              <p
                className={`mt-2 max-w-md font-mono text-xs ${
                  asrCheck.success ? "text-emerald-300" : "text-terracotta-ink"
                }`}
              >
                {asrCheck.success ? asrCheck.message : asrCheck.error}
              </p>
            )}
          </div>
        )}

        <div className="mx-auto w-full max-w-xl">
          <AnimatePresence mode="wait" initial={false}>
            {inputMode === "file" ? (
              <motion.div
                key="file"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="ln-card p-8"
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full rounded-2xl border border-dashed border-white/15 bg-noir/40 p-8 text-center transition-colors hover:border-gold/40 disabled:opacity-50"
                >
                  {uploading || localStage ? (
                    <Loader2 className="mx-auto size-9 animate-spin text-gold" />
                  ) : (
                    <Upload className="mx-auto size-9 text-gold" />
                  )}
                  <p className="mt-3 text-sm text-ink-2">
                    {localStage
                      ? localStage
                      : uploading
                        ? "Upload en cours…"
                        : "Clique pour choisir un fichier (MP4, MP3, MOV, WAV)"}
                  </p>
                  <p className="mt-1 font-mono text-[0.625rem] text-ink-3 uppercase">
                    {localStage
                      ? "sur ton appareil · rien à installer"
                      : "transcription · traduction · argot — automatiques"}
                  </p>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = "";
                  }}
                />
              </motion.div>
            ) : inputMode === "text" ? (
              <motion.div
                key="text"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="ln-card p-6"
              >
                <label
                  htmlFor="text-draft"
                  className="font-mono text-[0.625rem] uppercase tracking-widest text-ink-3"
                >
                  Colle un texte (article, paroles, dialogue, interview…)
                </label>
                <textarea
                  id="text-draft"
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  rows={10}
                  maxLength={100_000}
                  placeholder="Le texte complet arrive ici — segmentation, traduction et détection d'argot sont automatiques."
                  className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-noir/60 p-4 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-gold/50"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="font-mono text-[0.625rem] text-ink-3">
                    {textDraft.trim().length.toLocaleString("fr-FR")} / 100 000
                    caractères
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleTextImport()}
                    disabled={sendingText || textDraft.trim().length < 2}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft px-5 py-2.5 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {sendingText ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Languages className="size-4" />
                    )}
                    Analyser le texte
                  </button>
                </div>
              </motion.div>
            ) : inputMode === "subs" ? (
              // B2 — porte de secours universelle : une session complète
              // (traduction cible + argot + karaoké/liste) sans aucun média.
              <motion.div
                key="subs"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                <SubtitleImportPanel
                  onImport={(segs, meta) => void handleSubsImportIdle(segs, meta)}
                  onClose={() => setInputMode("file")}
                  defaultSourceLang={lang}
                />
              </motion.div>
            ) : unresolved ? (
              // Plateforme reconnue mais non lisible dans MOOVY :
              // raison explicite + « Ouvrir la source » + orientation upload.
              <motion.div
                key="unresolved"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="ln-card p-6"
              >
                <div className="flex items-start gap-4">
                  {unresolved.thumbnailUrl ? (
                    <img
                      src={unresolved.thumbnailUrl}
                      alt=""
                      className="hidden h-20 w-36 shrink-0 rounded-lg object-cover sm:block"
                    />
                  ) : (
                    <Link2 className="size-9 shrink-0 text-gold" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {unresolved.label} détecté
                    </p>
                    <p className="mt-1 text-sm text-ink-2">{unresolved.reason}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setUnresolved(null);
                      setInputMode("file");
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold to-gold-soft px-4 py-2 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5"
                  >
                    <Upload className="size-4" />
                    Uploader le fichier
                  </button>
                  <button
                    onClick={() => setUnresolved(null)}
                    className="rounded-lg border border-white/15 px-4 py-2 text-sm text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
                  >
                    Analyser un autre lien
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="url-input"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                <UrlInput
                  onAnalyse={(v) => void handleAnalyse(v)}
                  busy={busyUrl}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ─── Active media: pipeline status / results ───────────────────
  if (!status) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-shimmer h-40 w-full max-w-xl rounded-2xl" />
      </div>
    );
  }

  const stepIndex =
    status.status === "completed"
      ? 4
      : status.status === "failed"
        ? -1
        : status.transcription
          ? status.subtitles.length > 0
            ? 3
            : 2
          : 1;

  // Per-stage messaging, matching the pipeline's real checkpoints.
  const stageHint =
    stepIndex <= 1
      ? activeKind === "text"
        ? "Segmentation du texte…"
        : "Récupération des sous-titres YouTube…"
      : stepIndex === 2
        ? status.segmentCount
          ? `Traduction (${Math.max(1, Math.round(((status.translationProgress ?? 0) / 100) * status.segmentCount))}/${status.segmentCount} segments)…`
          : "Traduction en cours…"
        : "Détection d'argot…";
  const showProgressBar =
    stepIndex === 2 && typeof status.translationProgress === "number";

  // Last segment end — honest duration proxy for the YouTube transport bar.
  const lastSegmentEnd =
    status.subtitles.length > 0
      ? status.subtitles[status.subtitles.length - 1].end
      : (status.durationSeconds ?? 0);

  return (
    <div className="space-y-6">
      <PlaceHeader
        place="shadow"
        title={status.title}
        icon={Clapperboard}
        motif="halftone"
        actions={
          <span
            className={`rounded-full border px-4 py-1.5 font-mono text-[0.6875rem] uppercase ${
              status.status === "completed"
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                : status.status === "failed"
                  ? "border-terracotta/40 bg-terracotta/10 text-terracotta-ink"
                  : "border-gold/40 bg-gold/10 text-gold"
            }`}
          >
            {status.status === "completed"
              ? "terminé"
              : status.status === "failed"
                ? "échec"
                : "processing…"}
          </span>
        }
      />
      {status.transcriptSource && (
        <p className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 font-mono text-[0.625rem] uppercase tracking-wider text-gold">
          <Youtube className="size-3" aria-hidden />
          {status.transcriptSource === "youtube_subtitles"
            ? "sous-titres de la vidéo"
            : status.transcriptSource === "browser_whisper_local"
              ? "transcription Whisper locale (dans ton navigateur)"
              : status.transcriptSource === "faster_whisper_local"
                ? "transcription faster-whisper (local)"
              : status.transcriptSource === "groq_whisper"
                ? "transcription automatique de l'audio"
                : status.transcriptSource === "pasted_text"
                ? "texte importé"
                : status.transcriptSource.endsWith("_embed_only")
                  ? "Lecteur officiel"
                  : "audio analysé"}
        </p>
      )}

      {status.status === "failed" && status.errorKind === "no_transcript" ? (
        // Plus de carte d'échec : une vidéo sans sous-titres publiés reste
        // une vidéo lisible. Le pipeline termine désormais ce cas en
        // « completed » sans sous-titres — ce bloc ne concerne plus que les
        // médias historiques laissés en échec, avec la même présentation douce.
        <div className="rounded-2xl border border-gold/20 bg-noir-2/60 p-5 text-center">
          <p className="text-sm text-ink-2">
            Transcription indisponible pour ce contenu — la vidéo reste
            lisible ci-dessus.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => void handleKick()}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
            >
              Relancer le traitement
            </button>
            <button
              onClick={reset}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-ink-2 hover:text-ink"
            >
              Essayer un autre média
            </button>
          </div>
        </div>
      ) : status.status === "failed" ? (
        <div className="rounded-2xl border border-terracotta/35 bg-terracotta/5 p-5">
          <p className="text-sm text-terracotta-ink">
            Le traitement a échoué : {status.error ?? "erreur inconnue"}
          </p>
          {/* Recovery path depends on the failure kind — never a dead end. */}
          {status.errorKind === "rate_limited" && (
            <p className="mt-2 text-sm text-ink-2">
              C'est temporaire — réessaie dans une minute, ou passe
              directement par « Upload fichier » qui n'est pas concerné.
            </p>
          )}
          {status.errorKind === "rate_limited" && (
            // B3 — secours en 1 clic : la vidéo reste bloquée par YouTube,
            // mais des sous-titres importés déclenchent tout le pipeline.
            <button
              type="button"
              onClick={() => setShowSubsImport(true)}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
            >
              <Captions className="size-4" />
              Importer SRT/VTT
            </button>
          )}
          {status.errorKind === "timeout" && (
            <p className="mt-2 text-sm text-ink-2">
              Réessaie avec un média plus court (quelques minutes), ou
              découpe-le en plusieurs uploads.
            </p>
          )}
          {status.errorKind === "missing_key" && (
            <p className="mt-2 text-sm text-ink-2">
              La transcription automatique n'est pas disponible pour le moment.
              Réessaie plus tard, ou importe un fichier qui contient déjà ses
              sous-titres.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {/* Failures the upload flow solves outright get a one-tap jump. */}
            {status.errorKind === "rate_limited" && (
              <button
                onClick={() => {                    void checkAchievements({}).catch(() => undefined);
                    reset();
                  setInputMode("file");
                }}
                className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20"
              >
                Passer à l'upload
              </button>
            )}
            <button
              onClick={() => void handleKick()}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
            >
              Relancer le traitement
            </button>
            <button
              onClick={reset}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-ink-2 hover:text-ink"
            >
              Essayer un autre média
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Porte de secours SRT/VTT (B1/B3) : panneau au-dessus des
          lecteurs quand ouvert — le résultat remplace les segments du média
          via le pipeline existant. ── */}
      {showSubsImport && (
        <div className="mx-auto w-full max-w-xl">
          <SubtitleImportPanel
            onImport={(segs, meta) => void handleSubsImportSession(segs, meta)}
            onClose={() => setShowSubsImport(false)}
            defaultSourceLang={lang}
          />
        </div>
      )}

      {/* ── Lecteurs embed — UN SEUL point de montage, tous les états ── */}
      {/* YouTube (API IFrame) et TikTok (lecteur officiel) restent à la même
          position de l'arbre React entre « processing » et « completed » :
          l'iframe n'est JAMAIS détruite/recréée pendant le pipeline. */}
      {ytVideoId && status.status !== "failed" && (
        <div className="mx-auto w-full max-w-[800px]">
          <YouTubeEmbed
            videoId={ytVideoId}
            onTimeUpdate={setPlaybackTime}
            controlsRef={ytControlsRef}
            onPlayingChange={setYtPlaying}
          />
        </div>
      )}
      {tiktokPostId && status.status !== "failed" && (
        <div className="mx-auto w-full max-w-[340px]">
          <TikTokEmbed
            postId={tiktokPostId}
            onTimeUpdate={setPlaybackTime}
            controlsRef={ttControlsRef}
            onPlayingChange={setYtPlaying}
            onRequestUpload={() => setInputMode("file")}
            onRequestPaste={() => setInputMode("text")}
          />
        </div>
      )}
      {dailymotionId && status.status !== "failed" && (
        <div className="mx-auto w-full max-w-[800px]">
          <DailymotionEmbed videoId={dailymotionId} />
        </div>
      )}
      {/* Média direct résolu (Archive.org, fichier URL) : lecteur natif avec
          la barre de transport Shadow — le fichier joue dans l'app, aucune
          redirection. Monté dès que l'URL est connue, quel que soit l'état
          du pipeline (même règle que UploadedPlayer). */}
      {directPlayableUrl && status.status !== "failed" && (
        <div className="mx-auto w-full max-w-[800px]">
          <UploadedPlayer
            mediaUrl={directPlayableUrl}
            mediaType={status.mediaType}
            onTime={setPlaybackTime}
            onPlayingChange={() => {}}
            onEnded={() => {}}
            onError={() => toast.error("Lecture directe indisponible pour le moment.")}
            controlsRef={fileControlsRef}
            starts={segmentStarts}
          />
        </div>
      )}

      {(status.status === "pending" || status.status === "processing") && (
        <>
          <div className="ln-card mx-auto max-w-xl p-8">
            <div className="space-y-3">
              {STEPS.map((s, i) => {
                const label =
                  i === 1 && status.transcriptSource === "youtube_subtitles"
                    ? "Sous-titres de la vidéo récupérés"
                    : i === 1 &&
                        (status.transcriptSource === "groq_whisper" ||
                         status.transcriptSource === "faster_whisper_local" ||
                         status.transcriptSource === "browser_whisper_local")
                      ? "Audio transcrit automatiquement"
                      : i === 1 && status.transcriptSource === "pasted_text"
                        ? "Texte segmenté"
                        : s.label;
                const done = stepIndex > i;
                const active = stepIndex === i;
                return (
                  <div
                    key={s.key}
                    className={`flex items-center gap-3 rounded-xl border p-3.5 transition-all ${
                      done
                        ? "border-emerald-400/25 bg-emerald-400/5"
                        : active
                          ? "border-gold/40 bg-gold/5"
                          : "border-white/5 opacity-40"
                    }`}
                  >
                    <span
                      className={`flex size-8 items-center justify-center rounded-lg ${
                        done
                          ? "bg-emerald-400/15 text-emerald-300"
                          : active
                            ? "bg-gold/15 text-gold"
                            : "bg-white/5 text-ink-3"
                      }`}
                    >
                      {done ? (
                        <Check className="size-4" />
                      ) : (
                        <s.icon className="size-4" />
                      )}
                    </span>
                    <p className="text-sm">{label}</p>
                    {active && (
                      <Loader2 className="ml-auto size-4 animate-spin text-gold" />
                    )}
                  </div>
                );
              })}
            </div>
            {showProgressBar && (
              <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-all duration-700"
                  style={{ width: `${status.translationProgress}%` }}
                />
              </div>
            )}
            <div className="mt-5 flex items-center gap-2.5 border-t border-white/5 pt-4">
              <Loader2 className="size-4 shrink-0 animate-spin text-gold" />
              <p className="font-mono text-xs text-ink-3">
                {stageHint} — {elapsedSeconds} s écoulée
                {elapsedSeconds > 1 ? "s" : ""}.
              </p>
            </div>
          </div>

          {pipelineStalled && (
            <div className="mx-auto max-w-xl rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5">
              <p className="text-sm text-amber-300">
                Aucune progression depuis {elapsedSeconds} s — le pipeline
                semble bloqué. Tu peux le relancer sans perdre ce média.
              </p>
              <button
                onClick={() => void handleKick()}
                className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm text-amber-200 transition-colors hover:bg-amber-400/20"
              >
                Relancer le traitement
              </button>
            </div>
          )}
        </>
      )}

      {/* Lecteur fichier — monté dès que l'URL existe, quel que soit l'état
          du pipeline. C'était LE bug « Shadow muet » : le lecteur n'existait
          qu'en état completed, donc un MP3 uploadé restait inaudible pendant
          (et après) un échec de transcription. Défini une seule fois ici pour
          n'avoir qu'une instance du média — une seule source de vérité. */}
      <div className="mx-auto w-full max-w-[800px]">
        {status.mediaUrl && (
          <UploadedPlayer
            mediaUrl={status.mediaUrl}
            mediaType={status.mediaType}
            onTime={setPlaybackTime}
            onPlayingChange={() => {}}
            onEnded={() => {}}
            onError={() => toast.error("Lecture indisponible pour le moment.")}
            controlsRef={fileControlsRef}
            starts={segmentStarts}
          />
        )}
      </div>

      {/* Les sous-titres suivent le lecteur dans tous les états : dès que des
          segments existent (publiés progressivement par le pipeline), le
          panneau karaoké s'affiche — même si l'argot échoue ensuite. */}
      {status.subtitles.length > 0 && status.status !== "completed" && (
        <div className="mx-auto w-full max-w-[800px]">
          <SubtitlePanel
            subtitles={status.subtitles}
            currentTime={playbackTime}
            language={status.language}
          />
        </div>
      )}

      {status.status === "completed" && (
        // LOT C — Desktop 1024px et plus : video a gauche, transcription
        // et traduction a droite. Mobile : layout empile inchangé.
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
          {/* Colonne gauche : lecteur, transport, argot. */}
          <div className="min-w-0">
              {/* Célébration d'analyse terminée — burst doré one-shot. */}
              <GoldBurst trigger={burstTick} className="sr-only" aria-hidden="true">
                <span />
              </GoldBurst>
              {/* Lecteur + encadré de traduction synchronisé — l'embed YouTube est
                  déjà monté plus haut (bloc stable), on ne le re-rend PAS ici :
                  le remount détruirait l'iframe et couperait la lecture au moment
                  même où les sous-titres arrivent. */}
              {ytVideoId ? (
                <div className="mx-auto flex w-full max-w-[800px] flex-col gap-4">
                  <ShadowTransport
                    playing={ytPlaying}
                    time={playbackTime}
                    duration={lastSegmentEnd}
                    volume={ytVolume}
                    muted={ytMuted}
                    rate={ytRate}
                    hasMedia
                    starts={segmentStarts}
                    onToggle={() =>
                      ytPlaying
                        ? ytControlsRef.current?.pause()
                        : ytControlsRef.current?.play()
                    }
                    onSeek={seekTo}
                    onNudge={(d) => seekTo(Math.max(0, playbackTime + d))}
                    onPrevSeg={(starts) => jumpSegment(starts, "prev")}
                    onNextSeg={(starts) => jumpSegment(starts, "next")}
                    onVolume={(v) => {
                      setYtVolume(v);
                      if (v > 0 && ytMuted) {
                        setYtMuted(false);
                        ytControlsRef.current?.unMute();
                      }
                      ytControlsRef.current?.setVolume(v);
                    }}
                    onMute={() => {
                      if (ytMuted) {
                        setYtMuted(false);
                        ytControlsRef.current?.unMute();
                      } else {
                        setYtMuted(true);
                        ytControlsRef.current?.mute();
                      }
                    }}
                    onRate={(r) => {
                      setYtRate(r);
                      ytControlsRef.current?.setRate(r);
                    }}
                  />
                  <SubtitlePanel
                    subtitles={status.subtitles}
                    currentTime={playbackTime}
                    language={status.language}
                  />
                  {/* Bandeau discret + actions actives même sans transcription :
                      la vidéo reste lisible, le cœur, Ma mémoire et le texte
                      collé fonctionnent sans karaoké. */}
                  {status.transcriptSource?.endsWith("_embed_only") && (
                    <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-center text-xs text-ink-2">
                      Transcription indisponible pour ce contenu.
                    </p>
                  )}
                  {ytVideoId && status.transcriptSource?.endsWith("_embed_only") && (
                    <ShadowNoTranscriptActions
                      contentKey={`youtube:${ytVideoId}`}
                      onText={(text) => {
                        setTextDraft(text);
                        setInputMode("text");
                      }}
                      onUpload={() => {
                        reset();
                        setInputMode("file");
                      }}
                    />
                  )}
                </div>
              ) : tiktokPostId ? (
                // Lecteur TikTok officiel : transport réel, sans sous-titres
                // synchronisés (TikTok n'expose pas de transcript).
                <div className="mx-auto flex w-full max-w-[800px] flex-col gap-4">
                  <ShadowTransport
                    playing={ytPlaying}
                    time={playbackTime}
                    duration={tt.duration > 0 ? tt.duration : lastSegmentEnd}
                    volume={1}
                    muted={ttMuted}
                    rate={1}
                    hasMedia={tt.ready}
                    volumeControl={false}
                    rateControl={false}
                    starts={segmentStarts}
                    onToggle={() =>
                      ytPlaying
                        ? ttControlsRef.current?.pause()
                        : ttControlsRef.current?.play()
                    }
                    onSeek={seekTo}
                    onNudge={(d) => seekTo(Math.max(0, playbackTime + d))}
                    onPrevSeg={(starts) => jumpSegment(starts, "prev")}
                    onNextSeg={(starts) => jumpSegment(starts, "next")}
                    onVolume={() => {}}
                    onMute={() => {
                      if (ttMuted) {
                        setTtMuted(false);
                        ttControlsRef.current?.unMute();
                      } else {
                        setTtMuted(true);
                        ttControlsRef.current?.mute();
                      }
                    }}
                    onRate={() => {}}
                  />
                  <div className="ln-card p-4">
                    <p className="text-sm text-ink-2">
                      {ttTranscript === null
                        ? "Transcription en cours de vérification…"
                        : ttTranscript.status === "UNAVAILABLE"
                          ? `Transcription indisponible — ${describeTranscriptStatus(ttTranscript)}.${ttTranscript.message ? ` ${ttTranscript.message}` : ""}`
                          : `${describeTranscriptStatus(ttTranscript)} : ${ttTranscript.segments.length} segments synchronisés.`}
                    </p>
                    {ttTranscript?.status === "UNAVAILABLE" && (
                      <button
                        onClick={() => {
                          reset();
                          setInputMode("file");
                        }}
                        className="mt-3 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold to-gold-soft px-4 py-2 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5"
                      >
                        <Upload className="size-4" />
                        Uploader le fichier — analyse complète
                      </button>
                    )}
                  </div>
                </div>
              ) : status.mediaUrl ? (
                // Lecteur fichier déjà rendu au niveau du bloc parent —
                // le panneau de sous-titres complète l'affichage ici.
                <div className="mx-auto flex w-full max-w-[800px] flex-col gap-4">
                  <SubtitlePanel
                    subtitles={status.subtitles}
                    currentTime={playbackTime}
                    language={status.language}
                  />
                </div>
              ) : activeKind === "text" ? (
                <div className="mx-auto flex w-full max-w-[800px] flex-col gap-4">
                  <TextShadowPlayer
                    title={status.title}
                    segments={status.subtitles.map((s) => ({
                      id: s.id,
                      start: s.start,
                      end: s.end,
                      text: s.originalText,
                    }))}
                    currentTime={playbackTime}
                    onSeekClock={setPlaybackTime}
                    starts={segmentStarts}
                  />
                  <SubtitlePanel
                    subtitles={status.subtitles}
                    currentTime={playbackTime}
                    language={status.language}
                  />
                </div>
              ) : (
                <div className="ln-card mx-auto max-w-[800px] p-6 text-center">
                  <p className="text-sm text-ink-2">
                    Lecture indisponible pour le moment — l'analyse du contenu
                    reste disponible ci-dessous.
                  </p>
                </div>
              )}

              {/* Slang detected */}
              {status.slangDetected.length > 0 && (
                <div>
                  <p className="font-mono text-xs tracking-widest text-gold uppercase">
                    {status.slangDetected.length} expression
                    {status.slangDetected.length > 1 ? "s" : ""} d'argot détectée
                    {status.slangDetected.length > 1 ? "s" : ""}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {status.slangDetected.map((hit, i) => (
                      <motion.div
                        key={`${hit.expression}-${i}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="ln-card p-4"
                      >
                        <p className="font-display text-lg italic">
                          {hit.expression}
                        </p>
                        <p className="mt-1 text-sm text-gold">{hit.meaning}</p>
                        {hit.context && (
                          <p className="mt-1 line-clamp-2 text-xs text-ink-3">
                            {hit.context}
                          </p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Discreet notice when no provider could translate. */}
              {status.translationFailed && (
                <p className="rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-2.5 text-xs text-amber-200/80">
                  Traduction indisponible pour ce média — les sous-titres
                  affichent le texte original. Tu peux réessayer plus tard depuis
                  l'historique.
                </p>
              )}
          </div>
          {/* Colonne droite : panneau « Transcription et Traduction » */}
          <div className="min-w-0">

              {/* Synchronized subtitles — click a segment to jump there. */}
              {status.subtitles.length > 0 && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs tracking-widest text-ink-2 uppercase">
                      Sous-titres synchronisés · {status.subtitles.length} segments
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {/* Porte de secours SRT/VTT (B1) — remplace les segments
                          importés précédents (réécriture du pipeline, pas de
                          duplication). */}
                      <button
                        type="button"
                        onClick={() => setShowSubsImport(true)}
                        title="Importer un fichier SRT/VTT pour remplacer ces sous-titres"
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] text-ink-2 transition-colors hover:border-gold/40 hover:text-gold"
                      >
                        <Captions className="size-3.5" />
                        <span className="hidden sm:inline">Importer SRT/VTT</span>
                      </button>
                      {/* Cible « TRADUIRE VERS » — changeable en cours de session :
                          re-traduction immédiate via la cascade existante (le
                          transcript n'est pas re-transcrit), cache 24 h par cible. */}
                      <div className="relative">
                        <select
                          aria-label="Traduire vers"
                          value={targetLang}
                          onChange={(e) =>
                            changeTargetLang(e.target.value as LanguageCode | "fr")
                          }
                          className="appearance-none rounded-lg border border-white/10 bg-noir-2 py-1.5 pr-8 pl-3 text-[11px] text-ink transition-colors hover:border-white/25 focus:border-gold/50 focus:outline-none"
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
                        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3 -translate-y-1/2 text-ink-3" />
                      </div>
                      {retranslating && (
                        <span className="flex items-center gap-1 font-mono text-[10px] text-gold">
                          <Loader2 className="size-3 animate-spin" />
                          <span className="hidden sm:inline">traduction…</span>
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={toggleSideBySide}
                      title={
                        sideBySide
                          ? "Passer en vue empilée"
                          : "Passer en vue côte à côte"
                      }
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors",
                        sideBySide
                          ? "border-gold/50 bg-gold/10 text-gold"
                          : "border-white/15 text-ink-2 hover:border-gold/40 hover:text-gold",
                      )}
                    >
                      <Columns2 className="size-3.5" />
                      <span className="hidden sm:inline">
                        {sideBySide ? "Empilé" : "Côte à côte"}
                      </span>
                    </button>
                  </div>
                  <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-2">
                    {status.subtitles.map((sub) => {
                      const isActive =
                        playbackTime >= sub.start && playbackTime < sub.end;
                      return (
                      <div
                        key={sub.id}
                        id={`subtitle-${sub.id}`}
                        onClick={() => seekTo(sub.start)}
                        title="Aller à ce moment"
                        className={`cursor-pointer rounded-xl border p-3.5 transition-colors hover:border-gold/40 ${
                          isActive
                            ? "border-gold/60 bg-gold/10"
                            : sub.isSlang
                              ? "border-gold/30 bg-gold/[0.06]"
                              : "border-white/5 bg-noir-2/60"
                        }${sideBySide ? " lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-5" : ""}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
                            {formatTimestamp(sub.start)} → {formatTimestamp(sub.end)}
                          </span>
                          {sub.isSlang && (
                            <span className="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[9px] tracking-wider text-gold uppercase">
                              slang
                            </span>
                          )}
                        </div>
                        <p className={cn("mt-2 text-sm font-medium", sideBySide && "lg:col-start-1 lg:row-start-2 lg:mt-0 lg:self-start")}>
                          {sub.originalText}
                        </p>
                        <p
                          id={`subtitle-tr-${sub.id}`}
                          className={cn(
                            "mt-0.5 text-sm text-ink-2",
                            sideBySide && "lg:col-start-2 lg:row-start-2 lg:mt-0 lg:self-start",
                          )}
                        >
                          {sub.translatedText ? (
                            sub.translatedText
                          ) : (
                            <em className="text-ink-3">{sub.originalText}</em>
                          )}
                        </p>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={async () => {
                    await recordSession({
                      language: lang,
                      kind: "shadowing",
                      durationSeconds: Math.max(
                        30,
                        Math.round(status.durationSeconds ?? 120),
                      ),
                      itemsLearned: status.slangDetected.length,
                    });
                    toast.success("Session shadowing enregistrée · +XP");
                    reset();
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-soft py-3 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5"
                >
                  <Layers className="size-4" />
                  Terminer la session
                </button>
                <button
                  onClick={reset}
                  className="rounded-xl border border-white/15 px-5 py-3 text-sm text-ink-2 hover:border-white/30 hover:text-ink"
                >
                  Nouveau média
                </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShadowNoTranscriptActions({
  contentKey,
  onText,
  onUpload,
}: {
  contentKey: string;
  onText: (text: string) => void;
  onUpload: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const tryEmbedText = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/transcript-embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentKey }),
      });
      const data = (await res.json()) as { text?: string };
      if (data.text) onText(data.text);
      else toast.error("Texte indisponible pour ce contenu.");
    } catch {
      toast.error("Récupération impossible pour le moment.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      <button
        type="button"
        onClick={() => void tryEmbedText()}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Captions className="size-4" />
        )}
        Coller le texte de la vidéo
      </button>
      <button
        type="button"
        onClick={onUpload}
        className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-ink-2 transition-colors hover:border-white/30 hover:text-ink"
      >
        <Upload className="size-4" />
        Uploader un fichier audio
      </button>
    </div>
  );
}
