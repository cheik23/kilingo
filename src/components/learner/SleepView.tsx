import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LANGUAGES, type LanguageCode } from "@/convex/languages";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Moon, Sparkles, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createSessionClock, type SessionClock } from "@/lib/sessionClock";
import {
  hasVoiceFor,
  isSpeechSupported,
  speakText,
  speakableText,
  stopSpeaking,
} from "@/lib/speech";
import {
  pausePiper,
  piperCached,
  piperPaused,
  piperPlaying,
  piperVoiceForRuntime,
  playPiper,
  resumePiper,
  stopPiper,
} from "@/lib/tts";

const mb = (bytes: number) =>
  Math.round(bytes / (1024 * 1024)).toLocaleString("fr-FR");

const DURATIONS = [15, 30, 45];

export function SleepView() {
  const myLanguages = useQuery(api.learning.myLanguages);
  const recordSession = useMutation(api.learning.recordSession);

  const [lang, setLang] = useState<LanguageCode>("en");
  const [duration, setDuration] = useState(30);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  /* Playlist de la langue SÉLECTIONNÉE — plus la mixture multilingue
     globale (trending) que la session prononçait avec le mauvais tag BCP-47
     (preuve live : « مش »/« Ок » envoyés au moteur en lang="en-US").
     La requête existante `slang.list` est exacte par langue. */
  const playlistRows = useQuery(api.slang.list, { language: lang, limit: 8 });

  useEffect(() => {
    if (myLanguages && myLanguages.rows.length > 0) {
      const firstActive = myLanguages.rows.find((r) => r.active);
      setLang((firstActive ?? myLanguages.rows[0]).language as LanguageCode);
    }
  }, [myLanguages]);

  /* ── Chronomètre de session (horloge pure sessionClock.ts) ──
     Décision produit : la PAUSE suspend le média ET le décompte — sous
     pause, tick() est un no-op, le temps restant ne diminue pas.
     Reprendre ne RESET RIEN : la machine garde elapsed et repart de la
     position exacte. L'arrêt automatique est détecté par la machine
     (finished à la seconde exacte de la durée choisie) et est unique :
     après la fin, tick() est définitivement mort — pas de seconde en
     trop, pas de double déclenchement. */
  const clockRef = useRef<SessionClock | null>(null);
  /* Refs « latest » : les timers hors cycle React lisent la fermeture
     la plus fraîche sans recréer l'interval à chaque rendu — écrites
     dans un effet (jamais pendant le rendu, règle react-hooks). */
  const stopRef = useRef<(() => void) | null>(null);
  const scheduleNextRef = useRef<((ms: number) => void) | null>(null);

  // ── AUDIO RÉEL ──────────────────────────────────────────────
  // « L'audio répète doucement ton vocabulaire » : la session diffuse
  // réellement la playlist via la synthèse vocale native (Web Speech API,
  // déjà utilisée par SpeakButton — pas de nouvelle dépendance). Chaque
  // énoncé démarre le suivant à sa fin → boucle continue tant que running.
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);

  /* Le décompte (mis sous l'état `paused` ci-dessus pour que la PAUSE
     suspende média ET chrono) : l'interval 1 s tourne mais tick() est un
     no-op sous pause — le temps restant ne diminue pas. La fin de durée
     est détectée par la machine (finished à la seconde exacte) : l'arrêt
     automatique part de là, UNE seule fois (garde dans stop()). */
  useEffect(() => {
    if (!running || paused) return;
    const t = setInterval(() => {
      const clock = clockRef.current;
      if (!clock) return;
      clock.tick();
      setElapsed(clock.elapsed); // setState dans le listener d'interval : hors fil de l'effet
      if (clock.finished) {
        void stopRef.current?.();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [running, paused]);
  /* Phrase active : récupérée directement des événements du moteur
     (onStart/onEnd) — pas de timestamps fabriqués. */
  const [currentPhrase, setCurrentPhrase] = useState("");
  /* Honnêteté du bouton : si le navigateur n'a AUCUNE voix compatible
     (preuve live : 3 voix fr-FR seulement), on l'annonce AVANT de laisser
     croire à une lecture — l'indicateur d'activité ne tourne pas à vide. */
  const [voiceOk, setVoiceOk] = useState(() =>
    isSpeechSupported() ? hasVoiceFor(lang) : false,
  );
  /* Changement de langue : recalcul au rendu (pattern React officiel
     « adjust state during render », pas d'effet → pas de cascade). */
  const [voiceLang, setVoiceLang] = useState(lang);
  if (voiceLang !== lang) {
    setVoiceLang(lang);
    setVoiceOk(isSpeechSupported() ? hasVoiceFor(lang) : false);
  }

  /* Voix libre (Piper, licence MIT, aucun service payant) : utilisée quand
     la synthèse native manque. Le paquet JS est léger (~23 KB, import
     dynamique) ; ONNX Runtime + le modèle (~20–74 Mo, voix x_low/low)
     ne sont téléchargés QU'au 1er lancement, mis en cache par le
     navigateur (OPFS) : lectures suivantes hors ligne. */
  /* La voix à proposer dépend du MODE DE BUILD : dev = voix auditée
     technique ; prod = porte commerciale stricte (piperVoiceForRuntime). */
  const piperVoice = piperVoiceForRuntime(lang);
  const [piperReady, setPiperReady] = useState(false);
  const [piperProgress, setPiperProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);
  const [piperFailed, setPiperFailed] = useState(false);
  const piperErrorsRef = useRef(0);
  /* Le repli Piper est-il le moteur actif ? (état, pas une ref : il entre
     dans le rendu du bandeau de progression) */
  const [usingPiper, setUsingPiper] = useState(false);

  /* Changement de langue : remise à zéro du repli au rendu (même pattern
     « adjust state during render » que voiceOk ci-dessus). */
  const [piperResetLang, setPiperResetLang] = useState(lang);
  if (piperResetLang !== lang) {
    setPiperResetLang(lang);
    setPiperReady(false);
    setPiperFailed(false);
  }
  /* Une fois par langue : la voix est-elle déjà en cache OPFS ? */
  useEffect(() => {
    void piperCached(lang).then(setPiperReady);
  }, [lang]);
  /* Les voix se chargent en asynchrone (Chrome) : on suit l'événement
     moteur — setState dans le listener uniquement, jamais synchronement
     dans l'effet (react-hooks/set-state-in-effect). */
  useEffect(() => {
    if (!isSpeechSupported()) return;
    const refresh = () => setVoiceOk(hasVoiceFor(lang));
    window.speechSynthesis.addEventListener?.("voiceschanged", refresh);
    return () =>
      window.speechSynthesis.removeEventListener?.("voiceschanged", refresh);
  }, [lang]);
  /* Changement de langue : le son de l'ancienne langue NE SURVIT PAS —
     la lecture en cours est coupée netLes états d'affichage sont mis à
     jour en dehors du fil de l'effet (setTimeout 0) pour ne jamais
     cascader pendant son exécution — le moteur fait le reste honnêtement.
     La RELANCE de la boucle sur la nouvelle langue se fait dans le
     handler de clic (chooseLang) : les refs y restent libres, et un
     simple setLang par l'effet myLanguages (mont) ne déclenche jamais
     de boucle fantôme. */
  useEffect(() => {
    stopSpeaking();
    stopPiper();
    setTimeout(() => {
      setSpeaking(false);
      setCurrentPhrase("");
      setPaused(false);
      clockRef.current?.resume();
    }, 0);
  }, [lang]);
  const speakingRef = useRef(false);
  const runningRef = useRef(false);
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playlist = playlistRows ?? [];
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;
  const langRef = useRef(lang);
  langRef.current = lang;

  const scheduleNext = (delayMs: number) => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    nextTimerRef.current = setTimeout(() => void speakLoop(), delayMs);
  };

  const speakLoop = async () => {
    if (!runningRef.current) return;
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
    const text = speakableText(item.expression);
    /* Réel à l'instant T : la voix native est réinterrogée, on ne se fie
       pas au seul état initial (les voix se chargent en asynchrone). */
    const nativeNow = isSpeechSupported() && hasVoiceFor(langRef.current);
    if (!nativeNow && !piperVoiceForRuntime(langRef.current)) return; // aucun moteur : silence honnête
    speakingRef.current = true;
    setSpeaking(true);
    const finishVoice = () => {
      speakingRef.current = false;
      setSpeaking(false);
      setCurrentPhrase("");
      if (runningRef.current) scheduleNext(800);
    };
    const failVoice = () => {
      speakingRef.current = false;
      setSpeaking(false);
      setCurrentPhrase("");
      // Une erreur TTS ne doit pas tuer la session : on retente.
      if (runningRef.current) scheduleNext(3000);
    };
    if (nativeNow) {
      speakText(text, langRef.current, {
        rate: 0.75,
        onStart: () => {
          /* Sync du texte : la phrase active vient de l'événement onstart du
             moteur (pas d'une estimation). */
          setCurrentPhrase(text);
        },
        onEnd: finishVoice,
        onError: failVoice,
      });
      return;
    }
    /* Repli libre Piper : téléchargement si la voix n'est pas encore en
       cache (progression affichée), puis lecture WAV locale. Après 3
       échecs consécutifs on s'arrête net : pas de boucle fantôme. */
    setUsingPiper(true);
    void playPiper(text, langRef.current, {
      onStart: () => setCurrentPhrase(text),
      onEnd: () => {
        piperErrorsRef.current = 0;
        setPiperProgress(null);
        setPiperReady(true); // la voix est forcément en OPFS maintenant
        setUsingPiper(false);
        finishVoice();
      },
      onError: () => {
        piperErrorsRef.current += 1;
        setUsingPiper(false);
        setPiperProgress(null);
        if (piperErrorsRef.current >= 3) {
          setPiperFailed(true); // diagramme honnête : consultable, pas jouable
          return;
        }
        if (runningRef.current) scheduleNext(3000);
      },
      onProgress: (loaded, total) => setPiperProgress({ loaded, total }),
    });
  };

  const start = () => {
    setRunning(true);
    setElapsed(0);
    setPaused(false);
    setCurrentPhrase("");
    runningRef.current = true;
    /* Horloge neuve à chaque session : la durée choisie est FONDÉE au
       lancement (les sélecteurs de durée sont désactivés pendant la
       session) — l'arrêt automatique tombèra exactement là. */
    clockRef.current = createSessionClock(duration * 60);
    toast.success("SleepShadow lancé", {
      description: `${duration} min d'audio passif · ${LANGUAGES.find((l) => l.code === lang)?.name}`,
    });
    // Le premier énoncé part tout de suite — l'utilisateur ENTEND la session.
    void speakLoop();
  };

  /* Choix de langue : setLang +, si une session tourne, relance de la
     boucle sur la NOUVELLE langue PENDANT le même event (avec Piper,
     les callbacks du média tué sont invalidés par le privé : sans
     relance, la session resterait muette pour toujours). Honnêteté coup:
     le média étant coupé, plus rien n'est réellement en pause — le
     décompte reprend (aucune ancienne voix, aucun ancien chrono). */
  const chooseLang = (code: LanguageCode) => {
    setLang(code);
    if (!runningRef.current) return;
    scheduleNextRef.current?.(900);
    setTimeout(() => {
      setSpeaking(false);
      setCurrentPhrase("");
      setPaused(false);
      clockRef.current?.resume();
    }, 0);
  };

  // Pause/Reprise réelles : suspendre passe par speechSynthesis.pause/resume ou
  // audio.pause() ; la MÊME action suspend le décompte (horloge de session) —
  // pause = média ET chrono figés, reprise = les deux au position exact.
  const togglePause = () => {
    if (!runningRef.current) return;
    const clock = clockRef.current;
    if (usingPiper) {
      if (piperPaused()) {
        resumePiper();
        clock?.resume();
        setPaused(false);
      } else if (piperPlaying()) {
        pausePiper();
        clock?.pause();
        setPaused(true);
      }
      return;
    }
    if (!isSpeechSupported()) return;
    const synth = window.speechSynthesis;
    if (synth.paused) {
      synth.resume();
      clock?.resume();
      setPaused(false);
    } else if (synth.speaking || synth.pending) {
      synth.pause();
      clock?.pause();
      setPaused(true);
    }
  };

  const stop = async () => {
    /* Garde d'unicité : la concurrence auto-stop/arrêt manuel ne peut
       enregistrer la session QU'UNE fois — le premier appel coupe
       runningRef, tout appel suivant sort ici sans re-partir. */
    if (!runningRef.current) return;
    setRunning(false);
    runningRef.current = false;
    setPaused(false);
    setCurrentPhrase("");
    /* L'horloge est figée en l'état : ses secondes finales sont la vérité
       (au dernier tick de l'auto-stop, la closure `elapsed` du rendu
       peut être en retard d'une seconde — l'horloge, elle, est exacte). */
    const finalSeconds = clockRef.current?.elapsed ?? elapsed;
    clockRef.current = null;
    if (nextTimerRef.current) {
      clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }
    // Stopper toute voix en cours — sinon elle continuerait après « Arrêter ».
    stopSpeaking();
    stopPiper();
    setUsingPiper(false);
    piperErrorsRef.current = 0;
    setPiperProgress(null);
    speakingRef.current = false;
    setSpeaking(false);
    await recordSession({
      language: lang,
      kind: "sleep",
      durationSeconds: finalSeconds,
      itemsLearned: Math.min(8, Math.floor(finalSeconds / 60) + 1),
    });
    toast.success("Bonne nuit 🌙", {
      description: `Session enregistrée · ${Math.max(1, Math.round(finalSeconds / 60))} min`,
    });
  };

  /* Refs « latest » : écrites APRÈS le rendu (jamais pendant), pour que
     l'auto-stop (dans l'interval) et la relance après changement de
     langue lisent toujours la fermeture la plus fraîche de stop/plan
     sans jamais recréer d'interval. */
  useEffect(() => {
    stopRef.current = () => void stop();
    scheduleNextRef.current = scheduleNext;
  });

  // Sécurité de cycle de vie : démontage / changement de langue → on coupe.
  useEffect(() => {
    return () => {
      runningRef.current = false;
      stopSpeaking();
      stopPiper();
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

            <p className="mt-6 min-h-16 break-words px-2 font-display text-2xl">
              {speaking
                ? currentPhrase
                  ? `🗣️ « ${currentPhrase} »`
                  : "🗣️ Répétition en cours…"
                : paused
                  ? "⏸️ En pause — reprends quand tu veux"
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

            {/* Honnêteté du lecteur : aucune voix compatible = pas de Gros bouton
                qui semble fonctionner sans résultat. La playlist reste
                consultable ici même. */}
            {!isSpeechSupported() && piperVoice === null && (
              <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                ⚠️ La synthèse vocale n'est pas supportée par ce navigateur —
                la playlist reste consultable ci-dessous.
              </p>
            )}
            {isSpeechSupported() && !voiceOk && piperVoice !== null && (
              <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                ⚠️ Aucune voix système pour cette langue — {piperFailed ?
                  "la voix libre a échoué (réseau ?) ; réessaie plus tard." :
                  `la première lecture télécharge une voix libre gratuite
                  (${piperReady ? "déjà en cache" : "~20–74 Mo, puis hors ligne"}) ;
                  la playlist reste consultable ici.`}
              </p>
            )}
            {isSpeechSupported() && !voiceOk && piperVoice === null && (
              <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                ⚠️ Aucune voix installée pour cette langue — la lecture risquerait
                d'être silencieuse. Choisis une langue qui a une voix, ou
                installe une voix système ; la playlist reste consultable ici.
              </p>
            )}
            {usingPiper && piperProgress && !voiceOk && (
              <p className="mt-3 w-full mx-2 font-mono text-xs text-ink-3">
                {piperProgress.total === 0
                  ? "Téléchargement de la voix libre…"
                  : `Téléchargement de la voix libre — ${mb(piperProgress.loaded)} / ${mb(piperProgress.total)} Mo`}
                {piperProgress.total > 0 &&
                  ` (${Math.round((piperProgress.loaded / piperProgress.total) * 100)} %)`}
              </p>
            )}
            {running ? (
              <button
                onClick={stop}
                className="mt-4 w-full rounded-xl border border-white/15 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-white/30 hover:text-ink"
              >
                Arrêter et enregistrer
              </button>
            ) : (
              <button
                onClick={start}
                disabled={
                  (!voiceOk && (piperVoice === null || piperFailed)) ||
                  playlist.length === 0
                }
                title={
                  !voiceOk && piperVoice === null
                    ? "Aucune voix compatible pour cette langue"
                    : !voiceOk && piperFailed
                      ? "La voix libre a échoué — réessaie plus tard"
                      : playlist.length === 0
                        ? "Aucune expression dans la playlist pour cette langue"
                        : undefined
                }
                className={`ln-glow mt-7 w-full rounded-xl bg-gradient-to-r from-gold to-gold-soft py-3 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5 disabled:opacity-40 ${
                  (!voiceOk && (piperVoice === null || piperFailed)) ||
                  playlist.length === 0
                    ? "cursor-not-allowed"
                    : "hover:-translate-y-0.5"
                }`}
              >
                {!voiceOk && piperVoice === null
                  ? "Voix indisponible pour cette langue"
                  : !voiceOk && piperFailed
                    ? "Voix libre échouée — réessaie plus tard"
                    : playlist.length === 0
                      ? "Playlist vide pour cette langue"
                      : !voiceOk
                        ? piperReady
                          ? "Lancer la session nocturne (voix libre)"
                          : "Lancer — télécharge la voix libre"
                        : "Lancer la session nocturne"}
              </button>
            )}
            {running && (
              <button
                onClick={togglePause}
                /* Honnêteté de la pause : le bouton est INERTIE tant qu'aucun
                   média réel n'est jouable ou déjà en pause. Pendant le
                   téléchargement/synthèse Piper (3–13 s) ou l'attente de
                   phrase native, cliquer ne doit PAS laisser croire à une
                   pause. L'état « ⏸ en pause » reflète audio.paused réel
                   (piperPaused / speechSynthesis.paused), jamais un simple
                   booléen React. */
                disabled={
                  usingPiper
                    ? !piperPlaying() && !piperPaused()
                    : !(
                        window.speechSynthesis?.speaking ||
                        window.speechSynthesis?.pending ||
                        window.speechSynthesis?.paused
                      )
                }
                className="mt-2 w-full rounded-xl border border-gold/30 py-3 text-sm font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {paused ? "▶ Reprendre" : "⏸︎ Pause"}
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
                  disabled={running}
                  title={running ? "La durée choisie est fixée pour cette session" : undefined}
                  className={`rounded-xl border py-3 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
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
                  onClick={() => chooseLang(l.code)}
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
