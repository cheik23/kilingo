/**
 * TTS de repli gratuit — Piper (voices MIT de Rhasspy, exécutées dans le
 * navigateur via onnxruntime-web).
 *
 * Réalité vérifiée (README + dist du paquet) :
 *  - le paquet `@realtimex/piper-tts-web` pèse ~23 KB (le JavaScript) ;
 *  - ONNX Runtime 1.22.0 et le phonémiseur piper_phonemize sont téléchargés
 *    au PREMIER usage depuis jsDelivr, le modèle vocal (~20–74 Mo selon la
 *    voix) depuis Hugging Face — aucune clé, aucun abonnement ;
 *  - les fichiers sont mis en cache par le navigateur dans l'OPFS
 *    (navigator.storage) : la 2e lecture est hors ligne.
 *
 * Ce module n'importe JAMAIS le paquet au chargement initial : import
 * dynamique au moment de la 1re lecture uniquement. Il ne fait pas de
 * promesse qu'il ne peut pas tenir : `piperVoiceFor` ne dit "disponible"
 * que pour une voix réellement listée dans le paquet.
 */

/** Voix Piper par langue de l'app — choix préférentiel des plus légères
 *  (x_low) afin de limiter le 1er téléchargement. */
/** Registre à double statut — seule source de vérité des voix Piper.
 *
 *  `technicalStatus` = ce que l'on a OBSERVÉ (sonde tts-probe.html, texte
 *  natif court, ONNX Runtime 1.22.0 du paquet 1.1.1) :
 *    - "tested-working"    : téléchargement + inférence OrtRun + WAV non-nul
 *                            + lecture observée dans le navigateur ;
 *    - "inference-failure": modèle présent dans le paquet mais OrtRun
 *                           s'effondre (« indices element out of data
 *                           bounds », reproduit live) — jamais annoncé ;
 *    - "untested"          : non auditée — quotient « à tester », jamais
 *                            « fonctionnelle ».
 *
 *  `commercialStatus` = ce que les SOURCES LICENCE disent (carte
 *  MODEL_CARD du miroir diffusionstudio/piper-voices et corpus vérifiés) :
 *    - "verified"       : usage commercial confirmé par le texte (CC0/PD) ;
 *    - "conditional"    : commercial possible UNIQUEMENT avec obligations
 *                         documentées (attribution, partage à l'identique,
 *                         notice, non-endossement) — listées dans `notes` ;
 *    - "non-commercial" : restriction explicite — jamais autorisé
 *                         commercialement, même si techniquement parfait ;
 *    - "unknown"        : aucune preuve lisible — reste « inconnu », ne
 *                         devient jamais une autorisation.
 */
export type PiperCommercialStatus =
  | "verified"
  | "conditional"
  | "non-commercial"
  | "unknown";

export type PiperVoiceRecord = {
  voiceId: string;
  technicalStatus: "tested-working" | "inference-failure" | "untested";
  commercialStatus: PiperCommercialStatus;
  /** Où la licence a été établie (carte HF du miroir, corpus). */
  licenseSource: string;
  /** Obligations ou incertitudes pour conditional/unknown/NC. */
  notes?: string;
  /** Obligations d'attribution/notice RÉELLEMENT remplies dans le produit
   *  (ex. page d'attributions en ligne). Absent ou false = non remplies. */
  obligationsMet?: boolean;
};

export const PIPER_VOICE_REGISTRY: Record<string, PiperVoiceRecord> = {
  es: {
    voiceId: "es_ES-carlfm-x_low",
    technicalStatus: "tested-working",
    commercialStatus: "verified",
    licenseSource:
      "https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/carlfm/x_low/MODEL_CARD",
    notes: "« Public domain » de la carte = licence du CORPUS déclaré (github.com/carlfm01/my-speech-datasets) — distincte de la licence MIT du code Piper et des métadonnées du dépôt HF.",
  },
  pl: {
    voiceId: "pl_PL-gosia-medium",
    technicalStatus: "tested-working",
    commercialStatus: "unknown",
    licenseSource:
      "https://huggingface.co/rhasspy/piper-voices/blob/main/pl/pl_PL/gosia/medium/MODEL_CARD",
    notes: "CC0 sur le dataset PPOTR (NabuCasa/OHF voice-datasets), MAIS filiation vérifiée : « finetuned from U.S. English lessac voice (medium) » — le modèle de base Lessac s'appuie sur Blizzard 2013 (licence cstr.ed.ac.uk réservée à la recherche, CC non commerciale vérifiée). Compatibilité commerciale des poids dérivés NON démontrée : unknown, bloquée en production jusqu'à une source fiable.",
  },
  el: {
    voiceId: "el_GR-rapunzelina-low",
    technicalStatus: "tested-working",
    commercialStatus: "unknown",
    licenseSource:
      "https://huggingface.co/rhasspy/piper-voices/blob/main/el/el_GR/rapunzelina/low/MODEL_CARD",
    notes: "Dataset propre « Greek Single Speaker » : CC0 (carte), MAIS filiation vérifiée : « finetuned from U.S. English Ryan voice (low) » — la carte Ryan low référence le corpus RyanSpeech (Kaggle) en « CC BY-NC-SA 4.0 » (le papier RyanSpeech déclare CC BY-NC-ND : divergence de source non résolue). Compatibilité commerciale des poids dérivés NON démontrée : unknown, bloquée en production jusqu'à une source fiable.",
  },
  tr: {
    voiceId: "tr_TR-fahrettin-medium",
    technicalStatus: "tested-working",
    commercialStatus: "unknown",
    licenseSource:
      "https://huggingface.co/diffusionstudio/piper-voices/blob/main/tr/tr_TR/fahrettin/medium/MODEL_CARD",
    notes: "Filiation vérifiée : « finetuned from U.S. English lessac voice (medium) » (carte du miroir). Dataset PPOTR CTCC0 (NabuCasa/OHF voice-datasets), MAIS le modèle de base Lessac est entraîné sur le corpus Blizzard 2013 dont la licence officielle (cstr.ed.ac.uk blizzard/2013/lessac_blizzard2013/license.html) réserve l'usage à la recherche — compatibilité commerciale des poids dérivés NON démontrée : statut unknown, bloquée en production jusqu'à une source fiable.",
  },
  de: {
    voiceId: "de_DE-eva_k-x_low",
    technicalStatus: "tested-working",
    commercialStatus: "conditional",
    licenseSource:
      "https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/eva_k/x_low/MODEL_CARD",
    notes: "M-AILABS : usage commercial permis AVEC conditions — conserver la notice copyright/conditions/disclaimer à la redistribution ; les noms des ayants droit interdits pour l'endossement sans permission écrite. La page Caito d'origine était inaccessible (licence relue via une copie du texte).",
  },
  en: {
    voiceId: "en_US-amy-low",
    technicalStatus: "tested-working",
    commercialStatus: "unknown",
    licenseSource:
      "https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/amy/low/MODEL_CARD",
    notes: "Filiation vérifiée : « finetuned from U.S. English Ryan voice (low) » — le corpus RyanSpeech (Kaggle) est déclaré « CC BY-NC-SA 4.0 » sur la carte Ryan low (le papier RyanSpeech déclare CC BY-NC-ND : divergence non résolue). La licence CC BY-SA du dépôt Mycroft (mimic3-voices) ne suffit PAS à autoriser l'usage commercial du modèle dérivé — statut « unknown », jamais transformé en autorisation.",
  },
  pt: {
    voiceId: "pt_BR-edresson-low",
    technicalStatus: "tested-working",
    commercialStatus: "conditional",
    licenseSource:
      "https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_BR/edresson/low/MODEL_CARD",
    notes: "CC BY 4.0 : attribution obligatoire (non encore remplie côté produit). Filiation vérifiée : « finetuned from U.S. English Ryan voice (low) » — corpus RyanSpeech carte NC : la compatibilité commerciale via le modèle de base reste à trancher indépendamment des obligations d'attribution.",
  },
  sw: {
    voiceId: "sw_CD-lanfrica-medium",
    technicalStatus: "tested-working",
    commercialStatus: "non-commercial",
    licenseSource: "https://data.mendeley.com/datasets/vbvj6j6pm9/1",
    notes: "« The authors permit use for non-profit, educational, and public benefit purposes. » — l'usage commercial n'est PAS autorisé par ce texte : testable en dev/éducatif, exclu de toute offre commerciale tant que cette restriction demeure.",
  },
  ar: {
    voiceId: "ar_JO-kareem-low",
    technicalStatus: "tested-working",
    commercialStatus: "unknown",
    licenseSource:
      "https://huggingface.co/rhasspy/piper-voices/blob/main/ar/ar_JO/kareem/low/MODEL_CARD",
    notes: "Deux incertitudes cumulées : (1) carte « See URL » → github.com/AliMokhammad/arabicttstrain : corpus/licence invérifiables ; (2) filiation vérifiée « finetuned from U.S. English lessac voice (low) » — corpus Blizzard 2013 réservé à la recherche. Statut maintenu « inconnu », jamais transformé en autorisation.",
  },
  /* Modèles PRÉSENTS dans le paquet mais inférence OrtRun cassée (reproduite
     live, ONNX Runtime 1.22.0) — jamais annoncés, jamais jouables. */
  zh: {
    voiceId: "zh_CN-huayan-x_low",
    technicalStatus: "inference-failure",
    commercialStatus: "unknown",
    licenseSource:
      "https://huggingface.co/rhasspy/piper-voices/blob/main/zh/zh_CN/huayan/x_low/MODEL_CARD",
    notes: "Offre non évaluée au niveau corpus ; la voix est de toute façon exclue par l'échec d'inférence jusqu'à un test concluant.",
  },
  it: {
    voiceId: "it_IT-riccardo-x_low",
    technicalStatus: "inference-failure",
    commercialStatus: "conditional",
    licenseSource:
      "https://huggingface.co/rhasspy/piper-voices/blob/main/it/it_IT/riccardo/x_low/MODEL_CARD",
    notes: "M-AILABS (conditionnel) — sans portée : exclue par l'échec d'inférence.",
  },
  vi: {
    voiceId: "vi_VN-vivos-x_low",
    technicalStatus: "inference-failure",
    commercialStatus: "non-commercial",
    licenseSource:
      "https://huggingface.co/rhasspy/piper-voices/blob/main/vi/vi_VN/vivos/x_low/MODEL_CARD",
    notes: "Corpus VIVOS : CC BY-NC-SA 4.0 explicite — usage NON commercial seulement ; exclusion commerciale indépendante de l'échec d'inférence.",
  },
  ru: {
    voiceId: "ru_RU-irina-medium",
    technicalStatus: "inference-failure",
    commercialStatus: "conditional",
    licenseSource:
      "https://huggingface.co/rhasspy/piper-voices/blob/main/ru/ru_RU/irina/medium/MODEL_CARD",
    notes: "RHVoice Irina : CC BY-SA 4.0 via le paquet Arch ; la carte Piper marque « Unknown » — conditionnel PROVISOIRE, non tranché pour le modèle Piper lui-même.",
  },
  fa: {
    voiceId: "fa_IR-amir-medium",
    technicalStatus: "inference-failure",
    commercialStatus: "verified",
    licenseSource:
      "https://huggingface.co/rhasspy/piper-voices/blob/main/fa/fa_IR/amir/medium/MODEL_CARD",
    notes: "CC0 — sans portée : exclue par l'échec d'inférence.",
  },
};

/** Entrées réellement utilisables : dérivées du registre (unique source de
 *  vérité) — une langue ne peut être mappée sans être audité OK en live. */
const PIPER_VOICES: Record<string, string> = Object.fromEntries(
  Object.entries(PIPER_VOICE_REGISTRY)
    .filter(([, v]) => v.technicalStatus === "tested-working")
    .map(([lang, v]) => [lang, v.voiceId]),
);

/** Langues SANS voix libre ni système documentée — la limite doit rester
 *  visible plutôt que cachée (aucune lecture prometto-fantôme). */
export function piperVoiceFor(langCode: string): string | null {
  return PIPER_VOICES[langCode] ?? null;
}

export function piperLanguages(): string[] {
  return Object.keys(PIPER_VOICES);
}

/** Politique d'activation POUR UNE OFFRE COMMERCIALE (distinte du mode
 *  dev/test ci-dessus). Règle strictement évidence-dépendante :
 *    - "verified"        → activable (ex. CC0/domaine public sur le
 *                          MODÈLE lui-même, pas sur un dépôt vague) ;
 *    - "conditional"     → activable UNIQUEMENT si les obligations
 *                          (attribution, notice…) sont RÉELLEMENT
 *                          remplies côté produit — signal explicite
 *                          `obligationsMet: true` du registre ; tant
 *                          qu'elles ne le sont pas, la voix reste
 *                          désactivée en production ;
 *    - "non-commercial"  → exclu (commercial jamais autorisé) ;
 *    - "unknown"         → exclu (une incertitude ne devient jamais
 *                          une autorisation) ;
 *    - tout autre statut technique que "tested-working" → exclu.
 *  Échec PRUDENT : tout statut manquant ou non explicite → null. */
export function piperVoiceForCommercial(langCode: string): string | null {
  const rec = PIPER_VOICE_REGISTRY[langCode];
  // Fail-safe : pas d'enregistrement, statut ou source de licence absent
  // ⇒ l'application n'autorise rien (protection par défaut).
  if (
    !rec ||
    !rec.voiceId ||
    !rec.licenseSource ||
    !rec.technicalStatus ||
    !rec.commercialStatus
  ) {
    return null;
  }
  if (rec.technicalStatus !== "tested-working") return null;
  if (
    rec.commercialStatus === "non-commercial" ||
    rec.commercialStatus === "unknown"
  ) {
    return null;
  }
  if (
    rec.commercialStatus === "conditional" &&
    rec.obligationsMet !== true
  ) {
    // Obligations d'attribution/notice NON remplies côté produit :
    // désactivée par défaut tant que la page d'attributions, etc. n'existe pas.
    return null;
  }
  return rec.voiceId;
}

/** Point de résolution UNIQUE de la voix au runtime — le seul que l'UI et
 *  `playPiper` doivent jamais utiliser. En build de PRODUCTION Vite
 *  (`import.meta.env.PROD === true`) : la porte commerciale stricte.
 *  En développement : l'essai technique des voix auditées est permis
 *  (leurs avertissements d'interface restent affichés côté vue).
 *  Fail-safe : environnement ambigu (env indisponible) ⇒ traité comme
 *  production stricte, jamais plus permissif que le mode commercial. */
const PROD_BUILD: boolean = (() => {
  if (typeof import.meta === "undefined") return true; // échec prudent
  const env = (import.meta as ViteEnv).env;
  if (typeof env !== "object" || env === null) return true; // échec prudent
  return env.PROD === true;
})();

export function piperVoiceForRuntime(langCode: string): string | null {
  return PROD_BUILD
    ? piperVoiceForCommercial(langCode)
    : piperVoiceFor(langCode);
}

interface ViteEnv {
  env?: { PROD?: boolean; DEV?: boolean };
}

/* ── Contrôle de lecture (un seul flux à la fois, jamais concurrents) ── */

type ProgressCb = (loaded: number, total: number) => void;
type PlayCb = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
  onProgress?: ProgressCb;
};

/** Interface minimale — aucune dépendance aux types du paquet au build. */
type PiperModule = {
  predict(
    config: { text: string; voiceId: string },
    callback?: (p: { url: string; total: number; loaded: number }) => void,
  ): Promise<Blob>;
};

let modulePromise: Promise<PiperModule> | null = null;
async function piperModule(): Promise<PiperModule> {
  modulePromise ??= import("@realtimex/piper-tts-web").then(
    (mod) => mod as unknown as PiperModule,
  );
  try {
    return await modulePromise;
  } catch (error) {
    modulePromise = null; // on retentera la prochaine fois
    throw error;
  }
}

/** Voix déjà en cache OPFS (2e lecture et suivantes : hors ligne). */
export async function piperCached(langCode: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !("storage" in navigator)) {
    return false;
  }
  try {
    const mod = await import("@realtimex/piper-tts-web");
    const voice = piperVoiceForRuntime(langCode);
    if (!voice) return false;
    const stored = (await (
      mod as unknown as { stored: () => Promise<string[]> }
    ).stored()) as string[];
    return stored.includes(voice);
  } catch {
    return false;
  }
}

let audio: HTMLAudioElement | null = null;
let audioUrl: string | null = null;
let token = 0; // invalide toute synthèse/lance déjà démarrée
/** Pause demandée alors que play() n'a pas encore pris (média en cours de
 *  démarrage) : à l'onplay réel, on la réapplique — jamais de boucle muette,
 *  jamais de lecture qui continue sous un état « En pause ». */
let pausePending = false;

function cleanupAudio() {
  pausePending = false;
  if (audio) {
    audio.onplay = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
  }
  audio = null;
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = null;
  }
}

/** Stop immédiatement la lecture Piper (pas de son qui survit à l'arrêt). */
export function stopPiper(): void {
  token += 1;
  cleanupAudio();
}

export function pausePiper(): void {
  if (!audio) return;
  pausePending = true; // couvre aussi la fenêtre de démarrage de play()
  audio.pause();
}

export function resumePiper(): void {
  if (!audio) return;
  pausePending = false;
  const el = audio;
  el.play().catch(() => {});
  /* Relance bornée : quand la pause est tombée DANS la fenêtre de démarrage
   * (play jamais résolu), certains moteurs refusent la 1re reprise — on la
   * retente (idempotent), jamais plus de 3 essais, jamais de boucle infinie. */
  let essais = 0;
  const relance = setInterval(() => {
    if (audio !== el || !el.paused || essais >= 3) {
      clearInterval(relance);
      return;
    }
    essais += 1;
    el.play().catch(() => {});
  }, 250);
}

export function piperPlaying(): boolean {
  return audio !== null;
}

/** En pause réelle (audio.pause() en cours) ? */
export function piperPaused(): boolean {
  return audio?.paused ?? false;
}

/** Position réelle du média en cours (secondes) — lecture seule :
 *  permet de PROUVER que la pause fige currentTime et que la reprise
 *  repart de la même position (mesurable, pas un booléen de confiance). */
export function piperPositionSeconds(): number | null {
  if (!audio) return null;
  return +audio.currentTime.toFixed(3);
}

/** Synthèse + lecture immédiate. Télécharge la voix au 1er appel
 *  (progression honnête via onProgress), lit le WAV produit.
 *  Un nouvel appel coupe proprement l'appel précédent. */
export async function playPiper(
  text: string,
  langCode: string,
  callbacks?: PlayCb,
): Promise<void> {
  if (typeof window === "undefined" || typeof URL === "undefined") {
    callbacks?.onError?.(new Error("Environnement sans audio navigateur"));
    return;
  }
  // Porte runtime : dev = voix auditées techniques ; prod = commerciale.
  const voice = piperVoiceForRuntime(langCode);
  if (!voice) {
    callbacks?.onError?.(
      new Error(`Aucune voix disponible pour « ${langCode} »`),
    );
    return;
  }

  const myToken = ++token; // toute lecture concurrente est invalidée
  cleanupAudio();

  let blob: Blob;
  try {
    const mod = await piperModule();
    if (myToken !== token) return; // stoppée entre-temps
    blob = await mod.predict(
      { text, voiceId: voice },
      (p) => {
        if (myToken !== token) return;
        if (p.total > 0) callbacks?.onProgress?.(p.loaded, p.total);
      },
    );
  } catch (error) {
    if (myToken === token) callbacks?.onError?.(error);
    return;
  }
  if (myToken !== token) return; // stoppée pendant la synthèse

  audioUrl = URL.createObjectURL(blob);
  const el = new Audio();
  el.src = audioUrl;
  audio = el;
  el.onplay = () => {
    if (myToken !== token) return;
    /* Une pause peut avoir été demandée PENDANT le démarrage (fenêtre de
       moins d'une seconde) : on l'applique au vrai lancement — le média ne
       démarre pas, l'état « en pause » est réel (audio.pause() effectif). */
    if (pausePending) {
      pausePending = false;
      el.pause();
      return; // pas de onStart : la phrase n'a jamais sonné
    }
    callbacks?.onStart?.();
  };
  el.onended = () => {
    const ended = myToken === token;
    cleanupAudio();
    if (ended) callbacks?.onEnd?.();
  };
  el.onerror = () => {
    const errored = myToken === token;
    cleanupAudio();
    if (errored) callbacks?.onError?.(new Error("Échec de la lecture audio"));
  };
  el.play().catch((error) => {
    if (myToken !== token) return;
    /* « The play() request was interrupted by a call to pause() » : la pause
       a été demandée pendant le démarrage — l'état réel du média est en
       pause (audio.pause() a été appliqué). Ce n'est PAS une erreur : ni
       cleanup (qui tuerait une lecture légitime) ni onError honnête faux. */
    const msg = `${(error as { name?: string })?.name ?? ""} ${
      error instanceof Error ? error.message : String(error)
    }`;
    if (/interrupted by a call to pause/i.test(msg)) return;
    cleanupAudio();
    callbacks?.onError?.(error);
  });
}
