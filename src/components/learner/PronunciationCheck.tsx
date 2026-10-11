import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import {
  Check,
  Info,
  Loader2,
  Mic,
  RotateCcw,
  Square,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { LanguageCode } from "@/convex/languages";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { isSpeechSupported, speakText, stopSpeaking } from "@/lib/speech";
import { decodeToPcm16k, transcribeLocal } from "@/lib/localEngines";
import {
  evaluateFlow,
  flowWordsFromSegments,
  type FlowOutcome,
} from "@/lib/flowCheck";
import { soundEngine } from "@/lib/soundEngine";

/* ═══════════════════════════════════════════════════════════════════
   FLOW CHECK — « redis cette expression, je te dis ce que j'ai compris »

   Ce que le composant fait réellement :
     micro → MediaRecorder → décodage PCM 16 kHz (WebAudio, dans
     l'onglet) → Whisper ONNX local (`transcribeLocal`) → comparaison
     mot à mot (lib/flowCheck) → score de RECONNAISSANCE + mots manqués
     + débit calculé sur les horodatages réels du moteur.

   Ce qu'il refuse de faire :
     • annoncer un accent validé (le moteur ne rend que du texte) ;
     • afficher un score quand le micro, le décodeur ou le moteur
       échoue — chaque panne a son message, et aucun XP n'est accordé ;
     • accorder deux fois l'XP d'une même expression (marqueur local).

   Aucune donnée audio ne quitte l'appareil : la transcription s'exécute
   dans l'onglet, l'audio n'est jamais uploadé.
   ═══════════════════════════════════════════════════════════════════ */

/** Au-delà, l'enregistrement s'arrête tout seul (une expression, pas un discours). */
const MAX_RECORD_MS = 12_000;
/** Prise minimale : en dessous, « trop courte » est une réponse, pas un score. */
const MIN_PCM_SAMPLES = 16_000;

const PASSED_KEY = "flowcheck.passed";

/** Marqueur LOCAL des expressions déjà validées sur cet appareil : il évite
 *  qu'un même succès accorde l'XP en boucle. Il n'est posé QU'APRÈS une
 *  confirmation du serveur — une panne passagère ne doit pas condamner
 *  l'expression à ne plus jamais rien rapporter. Il ne prétend pas être un
 *  garde-fou serveur (le suivi par compte n'existe pas encore côté Convex). */
function passKey(expression: string, language: string): string {
  return `${language}|${expression.trim().toLowerCase()}`;
}

function readPassed(): string[] {
  try {
    const raw = localStorage.getItem(PASSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function hasPassedLocally(key: string): boolean {
  return readPassed().includes(key);
}

function markPassedLocally(key: string): void {
  try {
    const list = readPassed();
    if (!list.includes(key)) list.push(key);
    localStorage.setItem(PASSED_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* stockage indisponible : l'XP reste accordé une fois par montage */
  }
}

type Phase = "idle" | "recording" | "working" | "done" | "error";

/** Panne nommée : `key` est la clé i18n du message, jamais un texte en dur. */
type CheckFailure = { key: string };

function asFailure(error: unknown): CheckFailure {
  const message = error instanceof Error ? error.message : String(error);
  // Le moteur local signale explicitement ces cas (lib/localEngines.ts) :
  // on les traduit par le message le plus utile, pas par un « erreur ».
  if (message.includes("ASR_FAILED")) return { key: "flow.errNoSpeech" };
  if (message.includes("INVALID_AUDIO")) return { key: "flow.errShort" };
  return { key: "flow.errAsr" };
}

export function PronunciationCheck({
  expression,
  language,
  meaning,
  className = "",
}: {
  /** L'expression à prononcer (telle qu'affichée à l'utilisateur). */
  expression: string;
  /** Langue de l'expression — donnée à l'ASR comme indice. */
  language: LanguageCode;
  /** Sens de l'expression, s'il est connu. */
  meaning?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const recordSession = useMutation(api.learning.recordSession);

  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<FlowOutcome | null>(null);
  const [heard, setHeard] = useState("");
  const [failure, setFailure] = useState<CheckFailure | null>(null);
  const [elapsed, setElapsed] = useState(0);
  /** Expression déjà validée AVANT cet essai (badge persistant). */
  const [passedBefore, setPassedBefore] = useState(() =>
    hasPassedLocally(passKey(expression, language)),
  );
  const [xpGained, setXpGained] = useState<number | null>(null);
  const [xpNote, setXpNote] = useState<"already" | "recorded" | "unrecorded" | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const key = passKey(expression, language);

  const releaseMic = useCallback(() => {
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      } catch {
        /* déjà arrêté */
      }
      releaseMic();
      stopSpeaking();
    };
  }, [releaseMic]);

  /** Enregistre la session côté serveur et rend compte du gain RÉEL. */
  const grantXp = useCallback(
    async (language: LanguageCode, seconds: number) => {
      if (hasPassedLocally(key)) {
        setXpNote("already");
        return;
      }
      try {
        const result = await recordSession({
          language,
          kind: "flowcheck",
          durationSeconds: Math.max(1, Math.round(seconds)),
          itemsLearned: 0,
        });
        // Le marqueur n'est posé QUE si le serveur a bien enregistré la
        // session : sinon une panne passagère priverait l'expression de son
        // XP pour toujours sur cet appareil.
        markPassedLocally(key);
        if (!mountedRef.current) return;
        setPassedBefore(true);
        const gained = result?.xpGain ?? 0;
        setXpGained(gained);
        setXpNote(gained > 0 ? "recorded" : "unrecorded");
      } catch {
        if (!mountedRef.current) return;
        setXpNote("unrecorded");
      }
    },
    [key, recordSession],
  );

  const analyse = useCallback(
    async (blob: Blob, seconds: number) => {
      setPhase("working");
      setStage(t("flow.working"));
      try {
        if (blob.size === 0) {
          setFailure({ key: "flow.errShort" });
          setPhase("error");
          return;
        }
        const pcm = await decodeToPcm16k(await blob.arrayBuffer()).catch(() => {
          throw new Error("INVALID_AUDIO");
        });
        if (pcm.length < MIN_PCM_SAMPLES) {
          setFailure({ key: "flow.errShort" });
          setPhase("error");
          return;
        }
        const transcript = await transcribeLocal(pcm, {
          language,
          onProgress: (p) => {
            if (mountedRef.current) setStage(p.message || t("flow.model"));
          },
        });
        if (!mountedRef.current) return;
        const words = flowWordsFromSegments(transcript.segments);
        const result = evaluateFlow(expression, transcript.text, words);
        setHeard(transcript.text.trim());
        if (result.kind === "no-speech") {
          setFailure({ key: "flow.errNoSpeech" });
          setPhase("error");
          return;
        }
        setOutcome(result);
        setPhase("done");
        setStage(null);
        if (result.verdict === "passed") {
          soundEngine.play("correct");
          void grantXp(language, seconds);
        } else {
          soundEngine.play("error");
        }
      } catch (error) {
        if (!mountedRef.current) return;
        setFailure(asFailure(error));
        setPhase("error");
        setStage(null);
      }
    },
    [expression, grantXp, language, t],
  );

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    setFailure(null);
    setOutcome(null);
    setHeard("");
    setXpGained(null);
    setXpNote(null);
    setElapsed(0);
    stopSpeaking();

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setFailure({ key: "flow.errMic" });
      setPhase("error");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setFailure({ key: "flow.errMic" });
      setPhase("error");
      return;
    }
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setFailure({ key: "flow.errSecure" });
      setPhase("error");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setFailure({
        key:
          name === "NotAllowedError" || name === "SecurityError"
            ? "flow.errDenied"
            : "flow.errMic",
      });
      setPhase("error");
      return;
    }
    if (!mountedRef.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }

    streamRef.current = stream;
    const startedAt = Date.now();
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const seconds = (Date.now() - startedAt) / 1000;
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      chunksRef.current = [];
      releaseMic();
      void analyse(blob, seconds);
    };

    recorder.start();
    setPhase("recording");
    tickRef.current = window.setInterval(() => {
      if (mountedRef.current) setElapsed(Date.now() - startedAt);
    }, 200);
    autoStopRef.current = window.setTimeout(() => stop(), MAX_RECORD_MS);
  }, [analyse, releaseMic, stop]);

  const listen = useCallback(() => {
    speakText(expression, language, { rate: 0.9 });
  }, [expression, language]);

  const listening = isSpeechSupported();
  const scored = outcome && outcome.kind === "scored" ? outcome : null;
  const verdict = scored ? scored.verdict : null;
  const recognized = scored ? scored.comparison.coverage : 0;
  const expectedCount = scored?.comparison.expected.length ?? 0;
  const matchedCount = scored
    ? scored.comparison.expected.length - scored.comparison.missing.length
    : 0;
  const seconds = (elapsed / 1000).toFixed(1);

  return (
    <div className={cn("ln-card p-4", className)}>
      {/* En-tête : titre + expression à prononcer */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.25em] text-gold uppercase">
            <Mic className="size-3" /> {t("flow.title")}
          </p>
          <p className="mt-2 font-display text-lg text-ink italic">« {expression} »</p>
          {meaning && <p className="mt-1 text-xs text-gold">{meaning}</p>}
          <p className="mt-1.5 text-xs text-ink-3">{t("flow.intro")}</p>
        </div>
        {passedBefore && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-400/40 bg-green-400/10 px-2 py-0.5 text-[0.625rem] font-medium text-green-300">
            <Check className="size-3" /> {t("flow.alreadyPassed")}
          </span>
        )}
      </div>

      {/* Commandes */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={listen}
          disabled={!listening || phase === "recording" || phase === "working"}
          title={listening ? undefined : t("flow.errMic")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gold/40 px-3 py-2 text-xs font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-40"
        >
          <Volume2 className="size-3.5" /> {t("flow.listen")}
        </button>

        {phase === "recording" ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-3 py-2 text-xs font-semibold text-noir"
          >
            <Square className="size-3.5" /> {t("flow.stop")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            disabled={phase === "working"}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-gold-strong to-gold px-3 py-2 text-xs font-semibold text-noir transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Mic className="size-3.5" /> {t("flow.record")}
          </button>
        )}

        {(phase === "done" || phase === "error") && (
          <button
            type="button"
            onClick={() => void start()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs text-ink-2 transition-colors hover:border-white/30 hover:text-ink"
          >
            <RotateCcw className="size-3.5" /> {t("flow.retry")}
          </button>
        )}
      </div>

      {/* États */}
      {phase === "recording" && (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-2" aria-live="polite">
          <span className="size-2 animate-pulse rounded-full bg-red-400" />
          {t("flow.recording")} {seconds}s
        </p>
      )}

      {phase === "working" && (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-2" aria-live="polite">
          <Loader2 className="size-3.5 animate-spin text-gold" />
          {stage ?? t("flow.working")}
        </p>
      )}

      {phase === "error" && failure && (
        <p
          className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90"
          role="status"
        >
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {t(failure.key)}
        </p>
      )}

      {phase === "done" && scored && (
        <div className="mt-3 space-y-2" aria-live="polite">
          <div className="flex items-baseline gap-3">
            <p
              className={cn(
                "font-display text-3xl font-bold",
                verdict === "passed" ? "text-green-300" : "text-ink",
              )}
            >
              {recognized} %
            </p>
            <p className="text-xs text-ink-2">
              {t("flow.score")} · {t("flow.coverage")}{" "}
              {expectedCount > 0 ? `${matchedCount}/${expectedCount}` : "—"}
            </p>
          </div>

          <p
            className={cn(
              "text-sm",
              verdict === "passed" ? "text-green-300" : "text-ink-2",
            )}
          >
            {verdict === "passed"
              ? t("flow.verdictPass", { score: recognized })
              : verdict === "close"
                ? t("flow.verdictClose", { score: recognized })
                : t("flow.verdictFail", { score: recognized })}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
            {heard && (
              <span>
                {t("flow.heard")} : <span className="text-ink-2">{heard}</span>
              </span>
            )}
            {scored.tempo && (
              <span>
                {t("flow.tempo")} :{" "}
                {scored.tempo.band === "slow"
                  ? t("flow.tempoSlow", { wpm: scored.tempo.wpm })
                  : scored.tempo.band === "fast"
                    ? t("flow.tempoFast", { wpm: scored.tempo.wpm })
                    : t("flow.tempoSteady", { wpm: scored.tempo.wpm })}
              </span>
            )}
          </div>

          <div>
            <p className="font-mono text-[0.625rem] tracking-widest text-ink-3 uppercase">
              {t("flow.missing")}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {scored.comparison.missing.length === 0 ? (
                <span className="text-xs text-green-300">{t("flow.missingNone")}</span>
              ) : (
                scored.comparison.missing.map((word) => (
                  <span
                    key={word}
                    className="rounded-full border border-amber-400/30 bg-amber-400/5 px-2 py-0.5 text-[0.6875rem] text-amber-200/90"
                  >
                    {word}
                  </span>
                ))
              )}
            </div>
          </div>

          {xpNote && (
            <p className="flex items-center gap-1.5 text-xs">
              {xpNote === "already" ? (
                <span className="text-ink-3">{t("flow.alreadyPassed")}</span>
              ) : xpNote === "recorded" ? (
                <span className="font-semibold text-gold">
                  {t("flow.xp", { xp: xpGained ?? 0 })}
                </span>
              ) : (
                /* Session non enregistrée par le serveur : on le dit au lieu
                   de promettre un XP qui n'a pas été accordé. */
                <span className="text-ink-3">{t("flow.unrecorded")}</span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Le garde-fou de lecture : ce score n'est pas une note d'accent. */}
      <p className="mt-3 flex items-start gap-1.5 border-t border-white/5 pt-2.5 text-[0.6875rem] leading-relaxed text-ink-3">
        <Info className="mt-0.5 size-3 shrink-0" />
        {t("flow.note")}
      </p>
    </div>
  );
}
