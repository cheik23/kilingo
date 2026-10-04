import type { TranscriptMediaInfo } from "./transcript";
import {
  registerTranscriptProvider,
  transcriptProviders,
  TRANSCRIPT_UNAVAILABLE,
  type TranscriptProvider,
  type TranscriptResult,
} from "./transcript";

/* ═══════════════════════════════════════════════════════════════════════
   PROVIDERS DE TRANSCRIPT — une implémentation par famille de source.

   Priorité (§7) :
     10  YouTubeCaptionsProvider   captions natives légitimes (1→2)
     50  TikTokTranscriptProvider  répond honnêtement UNAVAILABLE
     90  UploadedAudioAsrProvider  ASR sur fichier uploadé (4)

   Règles absolues :
     • ne JAMAIS scraper l'iframe TikTok ni accéder à son flux audio par
       hacks cross-origin (TikTokTranscriptProvider documente pourquoi) ;
     • ne JAMAIS promettre un transcript sans source exploitable ;
     • `faster-whisper` (MIT) est le moteur ASR open source de référence :
       il s'exécute côté worker dédié (WHISPER_LOCAL_URL — Speaches ou
       faster-whisper-server, endpoint OpenAI-compatible) et n'est PAS
       appelable depuis une fonction Convex. L'ASR des fichiers uploadés
       passe par ce worker quand il est configuré, sinon par l'API Groq
       (Whisper) en repli — le choix est centralisé dans asrEngine.ts.
   ═══════════════════════════════════════════════════════════════════════ */

/** Captions YouTube : déjà récupérées par le backend (youtubePipeline). */
const youtubeCaptions: TranscriptProvider = {
  key: "youtube-captions",
  priority: 10,
  canProvide: (media) => media.platform === "youtube",
  async getTranscript(): Promise<TranscriptResult> {
    // Le transcript YouTube est extrait CÔTÉ BACKEND (youtubePipeline :
    // sous-titres officiels d'abord) et publié réactivement dans la base —
    // ce provider ne refait pas le travail en double côté client. Il
    // déclare la source légitime et renvoie vers le média en base (le
    // Shadow lit status.subtitles).
    return {
      ...TRANSCRIPT_UNAVAILABLE,
      reason: "NO_ACCESSIBLE_AUDIO",
      message:
        "Transcript YouTube géré par le pipeline backend (sous-titres officiels + Whisper) — déjà synchronisé dans Shadow.",
    };
  },
};

/**
 * TikTok : le lecteur officiel (player/v1) affiche des closed captions dans
 * SON interface mais n'expose AUCUNE API documentée fournissant le texte
 * synchronisé au document hôte. Récupérer le flux audio exigerait de
 * scraper l'iframe ou de contourner les protections cross-origin —
 * expressément interdit ici. Résultat honnête : UNAVAILABLE avec la raison
 * exacte. La lecture (player) reste PASS indépendamment (§10).
 */
const tiktokTranscript: TranscriptProvider = {
  key: "tiktok-official",
  priority: 50,
  canProvide: (media) => media.platform === "tiktok",
  async getTranscript(): Promise<TranscriptResult> {
    return {
      status: "UNAVAILABLE",
      segments: [],
      reason: "PLATFORM_RESTRICTION",
      message:
        "TikTok n'expose pas de transcript accessible via son lecteur officiel — la récupération exigerait de contourner ses protections (interdit). Analyse complète : télécharge l'audio et utilise « Upload fichier ».",
    };
  },
};

/**
 * ASR sur fichier uploadé : la source audio est GARANTIE accessible
 * (stockage Convex de l'utilisateur). La transcription tourne côté backend
 * (faster-whisper local via WHISPER_LOCAL_URL, sinon Groq Whisper —
 * asrEngine.ts décide) ; côté client ce provider déclare simplement la
 * couverture.
 */
const uploadedAudioAsr: TranscriptProvider = {
  key: "uploaded-asr",
  priority: 90,
  canProvide: (media) =>
    (media.mediaType === "audio" || media.mediaType === "video") &&
    typeof media.storageId === "string",
  async getTranscript(): Promise<TranscriptResult> {
    return {
      ...TRANSCRIPT_UNAVAILABLE,
      reason: "NO_ACCESSIBLE_AUDIO",
      message:
        "Transcription des fichiers gérée par le pipeline backend (Whisper) — déjà synchronisée dans Shadow.",
    };
  },
};

/** Enregistre les providers de la plateforme (une seule fois par process). */
export function registerBuiltinTranscriptProviders(): void {
  for (const p of [youtubeCaptions, tiktokTranscript, uploadedAudioAsr]) {
    if (!transcriptProviders().some((existing) => existing.key === p.key)) {
      registerTranscriptProvider(p);
    }
  }
}
