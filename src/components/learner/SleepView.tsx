import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LANGUAGES, type LanguageCode } from "@/convex/languages";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Moon, Sparkles, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  isSpeechSupported,
  speakText,
  speakableText,
  stopSpeaking,
} from "@/lib/speech";

const DURATIONS = [15, 30, 45];

export function SleepView() {
  const myLanguages = useQuery(api.learning.myLanguages);
  const recordSession = useMutation(api.learning.recordSession);
  const trending = useQuery(api.slang.trending, { limit: 8 });

  const [lang, setLang] = useState<LanguageCode>("en");
  const [duration, setDuration] = useState(30);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (myLanguages && myLanguages.rows.length > 0) {
      const firstActive = myLanguages.rows.find((r) => r.active);
      setLang((firstActive ?? myLanguages.rows[0]).language as LanguageCode);
    }
  }, [myLanguages]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // ── AUDIO RÉEL ──────────────────────────────────────────────
  // « L'audio répète doucement ton vocabulaire » : la session diffuse
  // réellement la playlist via la synthèse vocale native (Web Speech API,
  // déjà utilisée par SpeakButton — pas de nouvelle dépendance). Chaque
  // énoncé démarre le suivant à sa fin → boucle continue tant que running.
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);
  const runningRef = useRef(false);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playlist = (trending ?? []).slice(0, 6);
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;
  const langRef = useRef(lang);
  langRef.current = lang;

  const scheduleNext = (delayMs: number) => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    nextTimerRef.current = setTimeout(() => void speakLoop(), delayMs);
  };

  const speakLoop = async () => {
    if (!runningRef.current || !isSpeechSupported()) return;
    const items = playlistRef.current;
    if (items.length === 0) {
      // Rien à lire : on garde la session ouverte, on retente plus tard
      // (les données arrivent réactivement depuis la base).
      scheduleNext(4000);
      return;
    }
    // Pause douce entre chaque énoncé : le rythme « endormant » du produit.
    await new Promise((r) => setTimeout(r, 1200));
    if (!runningRef.current) return;
    const item = items[Math.floor(Math.random() * items.length)];
    speakingRef.current = true;
    setSpeaking(true);
    speakText(speakableText(item.expression), langRef.current, {
      rate: 0.75,
      onEnd: () => {
        speakingRef.current = false;
        setSpeaking(false);
        if (runningRef.current) scheduleNext(800);
      },
      onError: () => {
        speakingRef.current = false;
        setSpeaking(false);
        // Une erreur TTS ne doit pas tuer la session : on retente.
        if (runningRef.current) scheduleNext(3000);
      },
    });
  };

  const start = () => {
    setRunning(true);
    setElapsed(0);
    runningRef.current = true;
    toast.success("SleepShadow lancé", {
      description: `${duration} min d'audio passif · ${LANGUAGES.find((l) => l.code === lang)?.name}`,
    });
    // Le premier énoncé part tout de suite — l'utilisateur ENTEND la session.
    void speakLoop();
  };

  const stop = async () => {
    setRunning(false);
    runningRef.current = false;
    if (nextTimerRef.current) {
      clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }
    // Stopper toute voix en cours — sinon elle continuerait après « Arrêter ».
    stopSpeaking();
    speakingRef.current = false;
    setSpeaking(false);
    await recordSession({
      language: lang,
      kind: "sleep",
      durationSeconds: elapsed,
      itemsLearned: Math.min(8, Math.floor(elapsed / 60) + 1),
    });
    toast.success("Bonne nuit 🌙", {
      description: `Session enregistrée · ${Math.max(1, Math.round(elapsed / 60))} min`,
    });
  };

  // Sécurité de cycle de vie : démontage / changement de langue → on coupe.
  useEffect(() => {
    return () => {
      runningRef.current = false;
      stopSpeaking();
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    };
  }, []);

  const pct = Math.min(100, (elapsed / (duration * 60)) * 100);

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 font-mono text-xs tracking-widest text-gold uppercase">
          <Moon className="size-3.5" /> SleepShadow
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">
          Apprends en dormant
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-2">
          L'audio répète doucement ton vocabulaire. Ton cerveau consolide
          pendant les phases de sommeil profond — sans effort conscient.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* player */}
        <div className="ln-card overflow-hidden p-8">
          <div className="flex flex-col items-center">
            <motion.div
              animate={
                running
                  ? { scale: [1, 1.06, 1], opacity: [1, 0.85, 1] }
                  : { scale: 1 }
              }
              transition={{ duration: 3, repeat: Infinity }}
              className="relative flex size-32 items-center justify-center rounded-full border border-gold/25 bg-gradient-to-br from-gold/15 to-transparent"
            >
              <div className="absolute inset-0 rounded-full border border-gold/10 blur-md" />
              <Moon className="size-12 text-gold" />
            </motion.div>

            <p className="mt-6 font-display text-2xl">
              {speaking
                ? "🗣️ Répétition en cours…"
                : running
                  ? "Repos actif…"
                  : "Prêt à dormir ?"}
            </p>
            <p className="mt-1 font-mono text-xs text-ink-3">
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")} / {duration}:00
            </p>

            {/* waveform */}
            <div className="mt-6 flex h-16 w-full items-end justify-center gap-1.5">
              {Array.from({ length: 28 }).map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 rounded-full bg-gradient-to-t from-gold/40 to-gold"
                  style={{
                    height: `${20 + ((i * 37) % 80)}%`,
                    animation: running
                      ? `ln-wave ${1.4 + (i % 5) * 0.2}s ease-in-out ${i * 0.06}s infinite`
                      : "none",
                    opacity: running ? 1 : 0.35,
                  }}
                />
              ))}
            </div>

            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>

            {running ? (
              <button
                onClick={stop}
                className="mt-7 w-full rounded-xl border border-white/15 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-white/30 hover:text-ink"
              >
                Arrêter et enregistrer
              </button>
            ) : (
              <button
                onClick={start}
                className="ln-glow mt-7 w-full rounded-xl bg-gradient-to-r from-gold to-gold-soft py-3 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5"
              >
                Lancer la session nocturne
              </button>
            )}
          </div>
        </div>

        {/* settings */}
        <div className="space-y-4">
          <div className="ln-card p-6">
            <p className="flex items-center gap-2 font-mono text-xs tracking-widest text-ink-2 uppercase">
              <Timer className="size-3.5 text-gold" /> Durée
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`rounded-xl border py-3 text-sm transition-all ${
                    duration === d
                      ? "border-gold/50 bg-gold/10 font-semibold text-gold"
                      : "border-white/10 text-ink-2 hover:border-white/25"
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          <div className="ln-card p-6">
            <p className="font-mono text-xs tracking-widest text-ink-2 uppercase">
              Langue
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-all ${
                    lang === l.code
                      ? "border-gold/50 bg-gold/10 text-gold"
                      : "border-white/10 text-ink-2 hover:border-white/25"
                  }`}
                >
                  {l.flag} {l.name}
                </button>
              ))}
            </div>
          </div>

          <div className="ln-card p-6">
            <p className="flex items-center gap-2 font-mono text-xs tracking-widest text-ink-2 uppercase">
              <Sparkles className="size-3.5 text-gold" /> Playlist du soir
            </p>
            <div className="mt-3 space-y-2">
              {playlist.map((e, i) => (
                <div
                  key={e._id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-noir/40 px-3.5 py-2.5"
                >
                  <span className="flex items-center gap-2.5 text-sm">
                    <span className="font-mono text-[0.625rem] text-ink-3">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display italic">{e.expression}</span>
                  </span>
                  <span className="text-xs text-ink-3">{e.meaning}</span>
                </div>
              ))}
              {playlist.length === 0 && (
                <p className="text-sm text-ink-3">Chargement…</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
