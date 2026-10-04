/* ═══════════════════════════════════════════════════════════════════════
   IDENTITÉ SONORE — 8 SONS SIGNATURE (MODULE 4)

   Chaque son est SYNTHÉTISÉ sur l'appareil (aucun fichier, aucun réseau),
   puis lu via un `Audio` sur un data-URI WAV. La recette décrit des voix
   (oscillateur + bruit + enveloppe), ce qui permet des timbres de
   percussion crédibles sans échantillon :

     · click      → woodblock  (bruit + claquement haut, très court)
     · correct    → kora       (corde pincée, attaque nette)
     · error      → tom        (peau grave qui descend)
     · reward     → arpège kora (4 cordes ascendantes)
     · loot       → djembe     (deux frappes + claquement)
     · levelUp    → cloche     (partiels inharmoniques, longue queue)
     · streak     → shaker     (souffle de graines)
     · unlock     → kalimba    (lame de pouce, partiel métallique)

   Réglages persistés : volume global + mute (localStorage), icône
   Lucide Volume2 / VolumeX côté interface.

   Garde-fou absolu : `prefers-reduced-motion: reduce` OU mute OU volume 0
   ⇒ silence total (rien n'est généré, rien n'est joué).
   ═══════════════════════════════════════════════════════════════════════ */

export type SoundName =
  | "click"
  | "correct"
  | "error"
  | "reward"
  | "loot"
  | "levelUp"
  | "streak"
  | "unlock"
  | "achievement";

const VOLUME_KEY = "ln.audio.volume";
const MUTED_KEY = "ln.audio.muted";
const SAMPLE_RATE = 22_050;

/** Une voix = un oscillateur (ou un bruit) avec son enveloppe. */
type Voice = {
  freq: number;
  dur: number;
  type?: OscillatorType;
  /** Échantillon de départ, en secondes. */
  start?: number;
  gain?: number;
  /** Temps de montée (très court pour une percussion). */
  attack?: number;
  /** Exposant de décroissance : plus grand = plus sec. */
  decay?: number;
  /** Multiplicateur de fréquence atteint en fin de voix (glissando). */
  bend?: number;
  /** Part de bruit blanc (0 = pur, 1 = bruit seul). */
  noise?: number;
};

type SoundRecipe = { duration: number; voices: Voice[] };

/** Rend une recette en PCM 16 bits mono échantillonné à 22 050 Hz. */
function render(recipe: SoundRecipe): Int16Array {
  const samples = Math.max(1, Math.floor(SAMPLE_RATE * recipe.duration));
  const out = new Int16Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / SAMPLE_RATE;
    let sum = 0;
    for (const v of recipe.voices) {
      const local = t - (v.start ?? 0);
      if (local < 0 || local > v.dur) continue;
      const p = local / v.dur;
      const attack = Math.min(1, local / Math.max(0.0006, v.attack ?? 0.004));
      const env = attack * Math.pow(1 - p, v.decay ?? 2.5);
      const freq = v.freq * (1 + ((v.bend ?? 1) - 1) * p);
      const osc = Math.sin(2 * Math.PI * freq * local);
      const noisy = v.noise ?? 0;
      const s = osc * (1 - noisy) + (noisy > 0 ? (Math.random() * 2 - 1) * noisy : 0);
      sum += s * env * (v.gain ?? 1);
    }
    // Soft-clip : deux voix fortes ne saturent jamais en craquement numérique.
    out[i] = Math.round(Math.tanh(sum) * 0.92 * 0x7fff);
  }
  return out;
}

/** Emballe du PCM dans un conteneur WAV, puis en data-URI lisible par Audio. */
function wavDataUri(pcm: Int16Array): string {
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) =>
    [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true);
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/** Une lame de kalimba : sinus + partiel métallique, queue moyenne. */
function kalimba(freq: number, start: number): Voice[] {
  return [
    { freq, dur: 0.5, start, type: "sine", decay: 2.2, gain: 0.85 },
    { freq: freq * 3.01, dur: 0.22, start, type: "sine", decay: 4, gain: 0.22 },
  ];
}

/** Une corde de kora pincée : attaque sèche, décroissance naturelle. */
function koraPluck(freq: number, start: number, dur: number): Voice[] {
  return [
    { freq, dur, start, type: "triangle", attack: 0.0015, decay: 3, gain: 0.8 },
    { freq: freq * 2, dur: dur * 0.6, start, type: "sine", attack: 0.0015, decay: 4.5, gain: 0.25 },
  ];
}

const RECIPES: Record<SoundName, SoundRecipe> = {
  // Woodblock : bois sec — bruit filtré + claquement haut très court.
  click: {
    duration: 0.07,
    voices: [
      { freq: 1, dur: 0.05, noise: 1, attack: 0.0006, decay: 7, gain: 0.5 },
      { freq: 1_650, dur: 0.045, type: "square", attack: 0.0006, decay: 8, gain: 0.35 },
      { freq: 2_400, dur: 0.02, attack: 0.0004, decay: 12, gain: 0.25 },
    ],
  },
  // Kora : deux cordes pincées, note → quinte.
  correct: {
    duration: 0.42,
    voices: [...koraPluck(880, 0, 0.36), ...koraPluck(1_318.5, 0.07, 0.32)],
  },
  // Tom : peau grave qui descend, un souffle de main.
  error: {
    duration: 0.38,
    voices: [
      { freq: 190, dur: 0.34, type: "sine", bend: 0.55, decay: 2.2, gain: 0.9 },
      { freq: 1, dur: 0.06, noise: 0.35, attack: 0.0008, decay: 6, gain: 0.2 },
    ],
  },
  // Arpège de kora : quatre cordes montantes.
  reward: {
    duration: 0.62,
    voices: [
      ...koraPluck(523.25, 0, 0.34),
      ...koraPluck(659.25, 0.07, 0.34),
      ...koraPluck(783.99, 0.14, 0.34),
      ...koraPluck(1_046.5, 0.21, 0.4),
    ],
  },
  // Djembe : frappe grave, puis frappe + claquement.
  loot: {
    duration: 0.5,
    voices: [
      { freq: 95, dur: 0.3, type: "sine", bend: 0.75, decay: 2, gain: 0.95 },
      { freq: 1, dur: 0.07, noise: 0.8, attack: 0.0008, decay: 5, gain: 0.35 },
      { freq: 150, dur: 0.24, type: "sine", bend: 0.8, decay: 2.6, start: 0.16, gain: 0.7 },
      { freq: 1, dur: 0.06, noise: 0.7, start: 0.16, attack: 0.0008, decay: 6, gain: 0.3 },
      { freq: 420, dur: 0.1, start: 0.16, attack: 0.001, decay: 5, gain: 0.3 },
    ],
  },
  // Cloche : partiels inharmoniques, longue queue.
  levelUp: {
    duration: 0.95,
    voices: [
      { freq: 523.25, dur: 0.9, type: "sine", attack: 0.002, decay: 2.4, gain: 0.8 },
      { freq: 1_318, dur: 0.7, type: "sine", attack: 0.002, decay: 3, gain: 0.42 },
      { freq: 2_093, dur: 0.5, type: "sine", attack: 0.002, decay: 3.8, gain: 0.24 },
      { freq: 2_640, dur: 0.3, type: "sine", attack: 0.002, decay: 5, gain: 0.14 },
    ],
  },
  // Shaker : trois souffles de graines.
  streak: {
    duration: 0.34,
    voices: [
      { freq: 1, dur: 0.09, noise: 1, start: 0, attack: 0.006, decay: 3.4, gain: 0.5 },
      { freq: 1, dur: 0.09, noise: 1, start: 0.1, attack: 0.006, decay: 3.4, gain: 0.55 },
      { freq: 1, dur: 0.11, noise: 1, start: 0.2, attack: 0.006, decay: 3, gain: 0.6 },
    ],
  },
  // Kalimba : trois lames ascendantes.
  unlock: {
    duration: 0.85,
    voices: [
      ...kalimba(1_046.5, 0),
      ...kalimba(1_567.98, 0.11),
      ...kalimba(2_093, 0.22),
    ],
  },
  // Succès : arpège kalimba descendant puis remontant, plus ample.
  achievement: {
    duration: 1.1,
    voices: [
      ...kalimba(783.99, 0),
      ...kalimba(987.77, 0.1),
      ...kalimba(1_174.66, 0.2),
      ...kalimba(1_567.98, 0.3),
      ...kalimba(2_093, 0.42),
    ],
  },
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

class SoundEngine {
  private cache = new Map<SoundName, HTMLAudioElement>();
  private volume = 0.45;
  private muted = false;
  private unlocked = false;

  constructor() {
    try {
      const storedVolume = Number(localStorage.getItem(VOLUME_KEY));
      if (Number.isFinite(storedVolume)) this.volume = Math.max(0, Math.min(1, storedVolume));
      this.muted = localStorage.getItem(MUTED_KEY) === "1";
    } catch {
      /* mode privé */
    }
  }

  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value));
    try {
      localStorage.setItem(VOLUME_KEY, String(this.volume));
    } catch {
      /* ignore */
    }
    for (const audio of this.cache.values()) audio.volume = this.volume;
  }

  setMuted(value: boolean) {
    this.muted = value;
    try {
      localStorage.setItem(MUTED_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  getVolume() {
    return this.volume;
  }

  isMuted() {
    return this.muted;
  }

  /** Prépare les 8 sons après la première interaction (autoplay policies). */
  preload() {
    if (this.unlocked || typeof window === "undefined" || typeof Audio === "undefined") return;
    this.unlocked = true;
    for (const name of Object.keys(RECIPES) as SoundName[]) this.audio(name);
  }

  play(name: SoundName) {
    // Mute, volume nul ou mouvement réduit : silence total, rien n'est créé.
    if (this.muted || this.volume <= 0 || prefersReducedMotion()) return;
    if (typeof window === "undefined" || typeof Audio === "undefined") return;
    this.preload();
    const audio = this.audio(name);
    audio.currentTime = 0;
    audio.volume = this.volume;
    void audio.play().catch(() => undefined);
  }

  private audio(name: SoundName) {
    let audio = this.cache.get(name);
    if (!audio) {
      audio = new Audio(wavDataUri(render(RECIPES[name])));
      audio.preload = "auto";
      audio.volume = this.volume;
      this.cache.set(name, audio);
    }
    return audio;
  }
}

export const soundEngine = new SoundEngine();

if (typeof window !== "undefined") {
  const unlock = () => soundEngine.preload();
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true, passive: true });
}
