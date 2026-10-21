import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LANGUAGES, type LanguageCode } from "@/convex/languages";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Moon, Sparkles, Timer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSessionClock, type SessionClock } from "@/lib/sessionClock";
import { createSleepSpeechScheduler } from "@/lib/sleepSpeechScheduler";
import {
  createUtteranceWatchdog,
  decideResumeAction,
} from "@/lib/sleepTtsRecovery";
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

/* Choix aléatoire du prochain énoncé, isolé au niveau module : la pureté
   du rendu (react-hooks/purity) interdit Math.random() dans le corps du
   composant. La boucle de session l'appelle DANS SON TIMER, jamais
   pendant un rendu — le comportement produit (énoncé tiré au sort parmi
   le deck de la langue active) est strictement inchangé. */
const pickRandom = <T,>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)];

export function SleepView() {
  const myLanguages = useQuery(api.learning.myLanguages);
  const recordSession = useMutation(api.learning.recordSession);

  /* Langue active SANS setState dans un effet (react-hooks
     /set-state-in-effect) : l'ancien sync `setLang(firstActive)` dans
     l'effet myLanguages cascadaient un rendu à chaque résolution de la
     requête. L'état porte désormais uniquement le CHOIX explicite de
     l'utilisateur ; avant ce choix, `lang` est DÉRIVÉ au rendu de la
     première langue active (puis la première) — valeur pure, jamais
     obsolète, et le choix utilisateur garde la priorité une fois posé. */
  const [chosenLang, setChosenLang] = useState<LanguageCode | null>(null);
  const fallbackLang = useMemo<LanguageCode>(() => {
    if (!myLanguages || myLanguages.rows.length === 0) return "en";
    const firstActive = myLanguages.rows.find((r) => r.active);
    return (firstActive ?? myLanguages.rows[0]).language as LanguageCode;
  }, [myLanguages]);
  const lang = chosenLang ?? fallbackLang;
  const [duration, setDuration] = useState(30);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  /* Playlist de la langue SÉLECTIONNÉE — plus la mixture multilingue
     globale (trending) que la session prononçait avec le mauvais tag BCP-47
     (preuve live : « مش »/« Ок » envoyés au moteur en lang="en-US").
     La requête existante `slang.list` est exacte par langue. La valeur
     dérivée est mémoïsée : l'effet « refs latest » ci-dessous doit se
     réexécuter UNIQUEMENT quand le contenu change, jamais à chaque rendu. */
  const playlistRows = useQuery(api.slang.list, { language: lang, limit: 8 });
  const playlist = useMemo(() => playlistRows ?? [], [playlistRows]);

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
  const [speechScheduler] = useState(() =>
    createSleepSpeechScheduler({
      launch: () => undefined,
    }),
  );

  // ── AUDIO RÉEL ──────────────────────────────────────────────
  // « L'audio répète doucement ton vocabulaire » : la session diffuse
  // réellement la playlist via la synthèse vocale native (Web Speech API,
  // déjà utilisée par SpeakButton — pas de nouvelle dépendance). Chaque
  // énoncé démarre le suivant à sa fin → boucle continue tant que running.
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sessionPaused, setSessionPaused] = useState(false);
  /* Source de vérité de la pause de session : un ref miroir tenu À JOUR au
     moment du set (les closures des timers/moteurs ne lisent jamais un
     rendu périmé). La consigne produit : la décision pause/reprise se fonde
     sur CET état explicite, jamais sur la seule valeur instantanée du
     moteur — Edge ignore parfois pause() (paused restant faux) et le
     dérivé moteur classerait « Reprendre » dans le chemin pause. */
  const sessionPausedRef = useRef(false);
  const setSessionPausedState = (value: boolean) => {
    sessionPausedRef.current = value;
    setSessionPaused(value);
  };

  /* Le décompte (mis sous l'état `paused` ci-dessus pour que la PAUSE
     suspende média ET chrono) : l'interval 1 s tourne mais tick() est un
     no-op sous pause — le temps restant ne diminue pas. La fin de durée
     est détectée par la machine (finished à la seconde exacte) : l'arrêt
     automatique part de là, UNE seule fois (garde dans stop()). */
  useEffect(() => {
    if (!running || paused || sessionPaused) return;
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
  }, [running, paused, sessionPaused]);
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
     handler de clic (chooseLang) : les refs y restent libres, et la
     langue dérivée au rendu (sans setState d'effet) ne déclenche jamais
     de boucle fantôme au montage. */
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

  const playlistRef = useRef(playlist);
  const langRef = useRef(lang);
  /* Refs « latest » : écrites dans des EFFETS (jamais pendant le rendu,
     règle react-hooks/refs) — les timers hors cycle React lisent la
     fermeture la plus fraîche sans recréer l'interval à chaque rendu. */
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const launchSpeech = (
    complete: (nextDelayMs: number | null) => void,
    isCurrent: () => boolean,
  ) => {
    if (!runningRef.current || !isCurrent()) return;
    const items = playlistRef.current;
    if (items.length === 0) {
      // Rien à lire : on garde la session ouverte, on retente plus tard
      // (les données arrivent réactivement depuis la base).
      complete(4000);
      return;
    }
    const item = pickRandom(items);
    const text = speakableText(item.expression);
    /* Réel à l'instant T : la voix native est réinterrogée, on ne se fie
       pas au seul état initial (les voix se chargent en asynchrone). */
    const nativeNow = isSpeechSupported() && hasVoiceFor(langRef.current);
    if (!nativeNow && !piperVoiceForRuntime(langRef.current)) {
      complete(null); // Aucun moteur : silence honnête, aucun timer fantôme.
      return;
    }

    speakingRef.current = true;
    setSpeaking(true);
    /* Vigie d'utterance : le moteur Edge ignore parfois pause() ET tire
       parfois ni onstart ni onend (matrice live). Sans vigie, une utterance
       perdue inactive activeSpeechId pour toujours : session muette.
       Le budget ne tourne QUE hors pause (suspension moteur réelle ||
       session explicitement en pause) — zéro faux positif sous pause. */
    let watchdogHandle: { stop(): void } | null = null;
    let nativeEnded = false;
    const finishVoice = (nextDelayMs: number | null) => {
      nativeEnded = true;
      watchdogHandle?.stop();
      if (!isCurrent()) return;
      speakingRef.current = false;
      setSpeaking(false);
      setCurrentPhrase("");
      complete(nextDelayMs);
    };
    const failVoice = () => {
      // Une erreur/netteté TTS ne tue pas la session : on retente si elle reste active.
      finishVoice(3000);
    };

    if (nativeNow) {
      let seenStart = false;
      watchdogHandle = createUtteranceWatchdog({
        isPaused: () =>
          sessionPausedRef.current ||
          (isSpeechSupported() && window.speechSynthesis.paused),
        isCurrent,
        hasStarted: () => seenStart,
        hasEnded: () => nativeEnded,
        /* La relance n'est PAS faite ici : on coupe via finishVoice (la
           nouvelle utterance, émise par speakText, annule d'abord le
           moteur — cleanup naturel du wedge). */
        onStall: failVoice,
      });
      speakText(text, langRef.current, {
        rate: 0.75,
        onStart: () => {
          if (!isCurrent()) return;
          seenStart = true;
          /* Sync du texte : la phrase active vient de l'événement onstart du
             moteur (pas d'une estimation). */
          setCurrentPhrase(text);
        },
        onEnd: () => finishVoice(800),
        onError: failVoice,
      });
      return;
    }

    /* Repli libre Piper : téléchargement si la voix n'est pas encore en
       cache (progression affichée), puis lecture WAV locale. Après 3
       échecs consécutifs on s'arrête net : pas de boucle fantôme. */
    setUsingPiper(true);
    void playPiper(text, langRef.current, {
      onStart: () => {
        if (isCurrent()) setCurrentPhrase(text);
      },
      onEnd: () => {
        if (!isCurrent()) return;
        piperErrorsRef.current = 0;
        setPiperProgress(null);
        setPiperReady(true); // la voix est forcément en OPFS maintenant
        setUsingPiper(false);
        finishVoice(800);
      },
      onError: () => {
        if (!isCurrent()) return;
        piperErrorsRef.current += 1;
        setUsingPiper(false);
        setPiperProgress(null);
        if (piperErrorsRef.current >= 3) {
          setPiperFailed(true); // diagramme honnête : consultable, pas jouable
          finishVoice(null);
          return;
        }
        finishVoice(3000);
      },
      onProgress: (loaded, total) => {
        if (isCurrent()) setPiperProgress({ loaded, total });
      },
    });
  };

  useEffect(() => {
    speechScheduler.setLaunchHandler(launchSpeech);
  }, [speechScheduler]);

  const start = () => {
    setRunning(true);
    setElapsed(0);
    setPaused(false);
    setSessionPausedState(false);
    setCurrentPhrase("");
    runningRef.current = true;
    /* Horloge neuve à chaque session : la durée choisie est FONDÉE au
       lancement (les sélecteurs de durée sont désactivés pendant la
       session) — l'arrêt automatique tombèra exactement là. */
    clockRef.current = createSessionClock(duration * 60);
    toast.success("SleepShadow lancé", {
      description: `${duration} min d'audio passif · ${LANGUAGES.find((l) => l.code === lang)?.name}`,
    });
    // Le scheduler attend le silence d'ouverture avant de lancer le premier énoncé.
    speechScheduler.start();
  };

  /* Choix de langue : setLang +, si une session tourne, relance de la
     boucle sur la NOUVELLE langue PENDANT le même event (avec Piper,
     les callbacks du média tué sont invalidés par le privé : sans
     relance, la session resterait muette pour toujours). Honnêteté coup:
     le média étant coupé, plus rien n'est réellement en pause — le
     décompte reprend (aucune ancienne voix, aucun ancien chrono). */
  const chooseLang = (code: LanguageCode) => {
    setChosenLang(code);
    if (!runningRef.current) return;
    speechScheduler.restart(900);
    setTimeout(() => {
      setSpeaking(false);
      setCurrentPhrase("");
      setPaused(false);
      setSessionPausedState(false);
      clockRef.current?.resume();
    }, 0);
  };

  // Pause/Reprise réelles : suspendre passe par speechSynthesis.pause/resume ou
  // audio.pause() ; la MÊME action suspend le décompte (horloge de session) —
  // pause = média ET chrono figés, reprise = les deux au même endroit.
  /* Décision pause/reprise : la SOURCE DE VÉRITÉ est l'état de session
     explicite (sessionPausedRef), jamais la valeur instantanée du moteur.
     Preuve recette : Edge ignore parfois pause() sur une utterance en
     cours (paused reste false) — un dérivé synth.paused faisait alors du
     bouton « Reprendre » un second Pause : session figée pour toujours.
     La suspension du FLUX passe toujours par le scheduler + l'horloge,
     donc la session est réellement figée même si le moteur n'a rien
     entendu. Le rôle du moteur est réduit au MODE de reprise
     (decideResumeAction : reprise en place / récupération wedge / idle). */
  const togglePause = () => {
    if (!runningRef.current) return;
    const clock = clockRef.current;
    if (usingPiper) {
      if (piperPaused()) {
        resumePiper();
        speechScheduler.resume();
        clock?.resume();
        setPaused(false);
        setSessionPausedState(false);
      } else if (piperPlaying()) {
        pausePiper();
        speechScheduler.pause();
        clock?.pause();
        setPaused(true);
        setSessionPausedState(true);
      }
      return;
    }
    if (!isSpeechSupported()) return;
    const synth = window.speechSynthesis;

    /* ── PASSER EN PAUSE — toujours possible pendant une session, et un
       seul chemin : scheduler + horloge + états React. La suspension
       native est best-effort (les moteurs fidèles figent l'audio en
       place) ; le mode de reprise décidera si elle a marché. */
    if (!sessionPausedRef.current) {
      speechScheduler.pause();
      clock?.pause();
      setPaused(true);
      setSessionPausedState(true);
      if (synth.speaking || synth.pending) {
        try {
          synth.pause();
        } catch {
          /* Moteur récalcitrant : la session est déjà figée par le
             scheduler ; la reprise décidera (wedge → récupération). */
        }
        /* Durcissement anti-fuite audio : un moteur honnête MARTCHE paused
           tout de suite (cf. matrice live). Si paused est DEMEURÉ faux
           alors qu'un média « parle », le moteur refuse — on le coupe
           NET, maintenant et sous contrôle différé (certains moteurs
           appliquent la pause en async) : pendant une pause, rien ne
           sonne. La reprise route alors via resume-idle/wedge → une seule
           phrase neuve, jamais deux. */
        const cancelIfEngineIgnored = () => {
          if (!sessionPausedRef.current) return; // reprise déjà intervenue
          if (synth.paused || !synth.speaking) return; // pause réelle ou silence
          stopSpeaking();
          speakingRef.current = false;
          setSpeaking(false);
          setCurrentPhrase("");
        };
        if (!synth.paused && synth.speaking) cancelIfEngineIgnored();
        else setTimeout(cancelIfEngineIgnored, 250);
      }
      return;
    }

    /* ── REPRENDRE — par construction du chemin : la session EST en pause
       (état explicite), on ne peut plus retomber dans Pause. Le mode
       exact est décidé par la pure fonction testée (sleepTtsRecovery). */
    const action = decideResumeAction({
      enginePaused: synth.paused,
      hasActiveUtterance:
        speechScheduler.hasActiveUtterance() || speakingRef.current,
    });
    if (action === "resume-engine") {
      // Le média a réellement suspendu : reprise EN PLACE de la même phrase
      // (le scheduler garde l'utterance active — jamais de doublon).
      try {
        synth.resume();
      } catch {
        /* Réponse moteur défaillante : à défaut la branche wedge traiterait */
      }
      speechScheduler.resume();
      clock?.resume();
      setPaused(false);
      setSessionPausedState(false);
      return;
    }
    if (action === "recover-wedge") {
      /* Le moteur n'a JAMAIS appliqué la pause (paused resté false) et une
         utterance est active : elle ne tires jamais onend, elle ne peut
         être « reprise en place » par personne. Compromis assumé : on la
         coupe net et le scheduler relance UNE phrase NEUVE de la playlist
         (pas une relecture du même mot depuis le début, pas de doublon —
         le cancel précède tout nouveau speak et restart invalide les
         callbacks périmés, protection eb36149 conservée). */
      stopSpeaking();
      speakingRef.current = false;
      setSpeaking(false);
      setCurrentPhrase("");
      setPaused(false);
      setSessionPausedState(false);
      clock?.resume();
      speechScheduler.restart(0); // un seul remplacement après le petit silence
      return;
    }
    /* reprise-idle : pause entre deux phrases — le scheduler relance
       exactement une fois (idempotent même si resume est rappelé). */
    speechScheduler.resume();
    clock?.resume();
    setPaused(false);
    setSessionPausedState(false);
  };

  const stop = async () => {
    /* Garde d'unicité : la concurrence auto-stop/arrêt manuel ne peut
       enregistrer la session QU'UNE fois — le premier appel coupe
       runningRef, tout appel suivant sort ici sans re-partir. */
    if (!runningRef.current) return;
    setRunning(false);
    runningRef.current = false;
    speechScheduler.stop();
    setPaused(false);
    setSessionPausedState(false);
    setCurrentPhrase("");
    /* L'horloge est figée en l'état : ses secondes finales sont la vérité
       (au dernier tick de l'auto-stop, la closure `elapsed` du rendu
       peut être en retard d'une seconde — l'horloge, elle, est exacte). */
    const finalSeconds = clockRef.current?.elapsed ?? elapsed;
    clockRef.current = null;
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
  });

  // Sécurité de cycle de vie : démontage / changement de langue → on coupe.
  useEffect(() => {
    return () => {
      runningRef.current = false;
      speechScheduler.stop();
      stopSpeaking();
      stopPiper();
    };
  }, [speechScheduler]);

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
              {/* La PAUSE passe AVANT l'apparence speaking du moteur : une
                  utterance wedgée ne tire jamais onend, speaking resterait
                  vrai pendant toute la pause et masquerait le bandeau. */}
              {(paused || sessionPaused) &&
                "⏸️ En pause — reprends quand tu veux"}
              {!(paused || sessionPaused) &&
                (speaking
                  ? currentPhrase
                    ? `🗣️ « ${currentPhrase} »`
                    : "🗣️ Répétition en cours…"
                  : running
                    ? "Repos actif…"
                    : "Prêt à dormir ?")}
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
                    : !running
                }
                className="mt-2 w-full rounded-xl border border-gold/30 py-3 text-sm font-medium text-gold transition-colors hover:bg-gold/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {paused || sessionPaused ? "▶ Reprendre" : "⏸︎ Pause"}
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
