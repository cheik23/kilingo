/* ═══════════════════════════════════════════════════════════════════════
   HORLOGE DE SESSION SLEEPSHADOW — PURE, DÉTERMINISTE

   Le contrat produit (décision finale) :
     • Pause suspend le MEDIA **et** le chronomètre : sous pause, aucun
       tick ne modifie elapsed — le temps restant ne diminue pas.
     • Reprendre relance la lecture ET le chronomètre à partir de la
       position exacte : aucun reset de elapsed, jamais.
     • L'arrêt automatique survient EXACTEMENT à la durée choisie et se
       produit UNE fois : après finished, tick() devient définitivement
       un no-op (aucune seconde en trop, aucun double déclenchement).
     • Aucune horloge murelle ici : le composant injecte le setInterval ;
       cette machine reste testable déterministement (bun : 1 tick = 1 s).

   Le média lui-même (position audio réelle) reste dans tts.ts / speech.ts :
   ce module ne JURE que sur le décompte — pas de promesse qu'il ne tient pas.
   ═══════════════════════════════════════════════════════════════════════ */

export type SessionClock = {
  /** Secondes comptabilisées de session (n'augmentent JAMAIS sous pause). */
  readonly elapsed: number;
  /** Décompte suspendu sur demande explicite. */
  readonly paused: boolean;
  /** Durée choisie atteinte : fin de session, définitif. */
  readonly finished: boolean;
  /** Un tick = une seconde réelle. No-op sous pause et après la fin. */
  tick(): void;
  /** Suspend le décompte (idempotent, no-op après la fin). */
  pause(): void;
  /** Relance le décompte depuis la position exacte (idempotent). */
  resume(): void;
};

export function createSessionClock(totalSeconds: number): SessionClock {
  let elapsed = 0;
  let paused = false;
  let finished = false;
  // Durée comprise : jamais 0 min (un clock sans fin n'a aucun sens ici),
  // jamais de fraction de seconde (1 tick = 1 s, par construction).
  const total = Math.max(1, Math.floor(totalSeconds));

  return {
    get elapsed() {
      return elapsed;
    },
    get paused() {
      return paused;
    },
    get finished() {
      return finished;
    },
    tick() {
      /* Sous pause : le temps restant ne bouge PAS — comportement demandé
         et verrouillé par les tests (aucune seconde ne s'échappe). */
      if (paused || finished) return;
      if (elapsed + 1 >= total) {
        // Arrêt automatique EXACT : la dernière seconde est la durée choisie.
        elapsed = total;
        finished = true;
        return;
      }
      elapsed += 1;
    },
    pause() {
      if (!finished) paused = true;
    },
    resume() {
      paused = false;
    },
  };
}
