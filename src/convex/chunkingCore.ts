/* ═══════════════════════════════════════════════════════════════════
   Chunking audio — fonctions pures (testables hors Convex).

   - Détection de conteneur : "ID3" / sync word mp3 → mp3, sinon brut ;
   - Découpe ~20 Mo alignée sur les frames mp3 (sync word 0xFF ex +
     version/layer/bitrate plausibles) ;
   - Découpe brute 20 Mo pour les autres conteneurs (webm/m4a/ogg).
   ═══════════════════════════════════════════════════════════════════ */

export const DIRECT_LIMIT = 24 * 1024 * 1024;
export const CHUNK_TARGET = 20 * 1024 * 1024;

export type RawSeg = { start: number; end: number; text: string };

/** True si l'octet i commence un header de frame mp3 plausible. */
export function isMp3FrameStart(b: Buffer, i: number): boolean {
  return (
    b[i] === 0xff &&
    (b[i + 1] & 0xe0) === 0xe0 && // sync + version/layer non réservés
    (b[i + 1] & 0x18) !== 0x08 && // version ≠ reserved
    (b[i + 1] & 0x06) !== 0x00 && // layer ≠ reserved
    (b[i + 2] & 0xc0) !== 0xc0 // bitrate ≠ « bad »
  );
}

/** Détection conteneur : "ID3" (ID3v2 tag) ou sync word 0xFFex → mp3. */
export function detectContainer(b: Buffer, url: string): "mp3" | "raw" {
  if (/\.mp3$/i.test(new URL(url).pathname || "")) return "mp3";
  if (b.length > 2 && b.subarray(0, 3).toString("latin1") === "ID3") return "mp3";
  if (b.length > 1 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "mp3";
  return "raw";
}

/** Coupe le buffer en ~20 Mo alignés sur les frames mp3. */
export function splitMp3(b: Buffer): Buffer[] {
  const cuts: number[] = [];
  let pos = 0;
  while (b.length - pos > CHUNK_TARGET * 1.1) {
    // Cherche un début de frame autour de la cible (tolérance ±512 Ko).
    let cut = -1;
    const target = pos + CHUNK_TARGET;
    for (let i = target; i < Math.min(target + 512 * 1024, b.length - 1); i++) {
      if (isMp3FrameStart(b, i)) {
        cut = i;
        break;
      }
    }
    if (cut <= pos) break; // pas de sync trouvé : stop, dernier chunk plus gros
    cuts.push(cut);
    pos = cut;
  }
  const parts: Buffer[] = [];
  let prev = 0;
  for (const c of [...cuts, b.length]) {
    parts.push(b.subarray(prev, c));
    prev = c;
  }
  return parts.filter((p) => p.length > 0);
}

/** Découpe brute (webm/m4a/ogg…) : limites sans garantie de frame. */
export function splitRaw(b: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  for (let pos = 0; pos < b.length; pos += CHUNK_TARGET) {
    parts.push(b.subarray(pos, Math.min(pos + CHUNK_TARGET, b.length)));
  }
  return parts.filter((p) => p.length > 0);
}
