import { describe, expect, test } from "bun:test";
import { createSessionClock } from "../src/lib/sessionClock";

/* ═══════════════════════════════════════════════════════════════════════
   HORLOGE DE SESSION SLEEPSHADOW — TESTS 100 % DÉTERMINISTES

   Aucun setInterval, aucune horloge murale : un tick = une seconde. Ces
   tests verrouillent le contrat produit final :
     1. Pause suspend le décompte (le temps restant ne diminue pas).
     2. Reprendre relance depuis la position exacte — jamais de reset.
     3. L'arrêt automatique survient EXACTEMENT à la durée choisie,
        une seule fois ; après la fin, tick() est un no-op définitif.
     4. Pause après fin : rien ne ressuscite.
   La position AUDIO réelle (média) n'est PAS simulée ici : elle vit dans
   tts.ts / speech.ts et est prouvée par la sonde moteur + l'UI réelle
   (vérifications indirectes documentées) — ce fichier ne jure que sur
   ce qu'il peut voir : le décompte pur.
   ═══════════════════════════════════════════════════════════════════════ */

describe("SessionClock — progression normale", () => {
  test("un tick = une seconde, dans l'ordre, sans saut", () => {
    const clock = createSessionClock(30 * 60);
    expect(clock.elapsed).toBe(0);
    clock.tick();
    expect(clock.elapsed).toBe(1);
    clock.tick();
    clock.tick();
    expect(clock.elapsed).toBe(3);
    expect(clock.finished).toBe(false);
  });

  test("90 ticks = 90 secondes exactement (pas de dérive)", () => {
    const clock = createSessionClock(30 * 60);
    for (let i = 0; i < 90; i++) clock.tick();
    expect(clock.elapsed).toBe(90);
    expect(clock.finished).toBe(false);
  });
});

describe("SessionClock — pause suspend le décompte (décision produit)", () => {
  test("sous pause, aucun tick ne progresse : le temps restant ne diminue pas", () => {
    const clock = createSessionClock(30 * 60);
    for (let i = 0; i < 10; i++) clock.tick();
    expect(clock.elapsed).toBe(10);
    clock.pause();
    expect(clock.paused).toBe(true);
    // Ticks primés sous pause : le décompte est FIGÉ, point final.
    for (let i = 0; i < 25; i++) clock.tick();
    expect(clock.elapsed).toBe(10);
    expect(clock.finished).toBe(false);
  });

  test("reprendre relance depuis la position EXACTE — jamais de reset", () => {
    const clock = createSessionClock(15 * 60);
    for (let i = 0; i < 7; i++) clock.tick();
    clock.pause();
    for (let i = 0; i < 9; i++) clock.tick(); // ticks fantômes sous pause
    expect(clock.elapsed).toBe(7);
    clock.resume();
    expect(clock.paused).toBe(false);
    clock.tick();
    expect(clock.elapsed).toBe(8); // 7 → 8, et pas 1 (aucun reset)
  });

  test("pause/resume alternés : cumul exact, aucune seconde perdue ni doublée", () => {
    const clock = createSessionClock(30 * 60);
    for (let i = 0; i < 5; i++) clock.tick();
    clock.pause();
    clock.resume();
    for (let i = 0; i < 3; i++) clock.tick();
    clock.pause();
    for (let i = 0; i < 100; i++) clock.tick();
    clock.resume();
    clock.tick();
    expect(clock.elapsed).toBe(9);
  });
});

describe("SessionClock — arrêt automatique à la durée choisie", () => {
  test("la fin survient EXACTEMENT au tick n° total (45 min = 2700 ticks)", () => {
    const clock = createSessionClock(45 * 60);
    for (let i = 0; i < 45 * 60 - 1; i++) clock.tick();
    expect(clock.finished).toBe(false);
    expect(clock.elapsed).toBe(45 * 60 - 1);
    clock.tick(); // la dernière seconde
    expect(clock.finished).toBe(true);
    expect(clock.elapsed).toBe(45 * 60);
  });

  test("après la fin, tick() est un no-op DÉFINITIF (pas de double fin)", () => {
    const clock = createSessionClock(15 * 60);
    for (let i = 0; i < 15 * 60; i++) clock.tick();
    expect(clock.finished).toBe(true);
    for (let i = 0; i < 500; i++) clock.tick();
    expect(clock.elapsed).toBe(15 * 60); // jamais plus
    expect(clock.finished).toBe(true); // jamais re-déclenché
  });

  test("pause après la fin : rien ne ressuscite", () => {
    const clock = createSessionClock(15 * 60);
    for (let i = 0; i < 15 * 60; i++) clock.tick();
    clock.pause();
    clock.resume();
    for (let i = 0; i < 10; i++) clock.tick();
    expect(clock.finished).toBe(true);
    expect(clock.elapsed).toBe(15 * 60);
  });

  test("durées produit 15/30/45 : la borne est bien la durée en secondes", () => {
    for (const minutes of [15, 30, 45]) {
      const clock = createSessionClock(minutes * 60);
      for (let i = 0; i < minutes * 60 - 1; i++) clock.tick();
      expect(clock.finished).toBe(false);
      clock.tick();
      expect(clock.finished).toBe(true);
      expect(clock.elapsed).toBe(minutes * 60);
    }
  });
});

describe("SessionClock — robustesse d'entrée", () => {
  test("une durée de 0 ou négative est bornée à 1 s (naissance d'un clock sans fin impossible)", () => {
    for (const total of [0, -30, 0.9]) {
      const clock = createSessionClock(total);
      clock.tick();
      expect(clock.finished).toBe(true);
      expect(clock.elapsed).toBe(1);
    }
  });

  test("pause() avant tout tick : le premier tick réel part de 0", () => {
    const clock = createSessionClock(30 * 60);
    clock.pause();
    clock.tick();
    expect(clock.elapsed).toBe(0);
    clock.resume();
    clock.tick();
    expect(clock.elapsed).toBe(1);
  });
});
