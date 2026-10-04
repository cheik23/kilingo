import { SPECS } from "./index";
import type { RawHit, SearchOpts } from "./types";

/* ═════════════════════════════ Connecteur d'ambiance ═══════════════════
   SLEEPSHADOW — playlist détente

   Il n'existe pas d'API publique « musique pour dormir » : ce module
   interroge les catalogues libres déjà branchés (Jamendo, Audius,
   Internet Archive) avec des requêtes ciblées sur l'ambiance. Un seul
   critère : un flux jouable. Sans flux, le résultat est écarté — jamais
   de fiche morte dans une playlist de sommeil.
   ═══════════════════════════════════════════════════════════════════════ */

/** Ambiances douces, mélangées pour la variété de la playlist. */
const MOODS = ["ambient", "lofi", "relaxation", "sleep", "chillout", "meditation"];

/** Pioche des ambiances différentes à chaque appel (variété des sessions). */
function pickMoods(count: number): string[] {
  const pool = [...MOODS];
  const out: string[] = [];
  for (let i = 0; i < count && pool.length; i += 1) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

const SLEEP_OPTS = (rows: number): SearchOpts => ({ kind: "music", rows, sort: "popular" });

/** Récupère des titres jouables sur une ambiance, sans jamais lever. */
async function moodTracks(source: string, mood: string, rows: number): Promise<RawHit[]> {
  try {
    const spec = SPECS[source];
    if (!spec?.search) return [];
    const hits = await spec.search(mood, SLEEP_OPTS(rows));
    // Uniquement des titres réellement écoutables ici et maintenant.
    return hits.filter((h) => Boolean(h.streamUrl));
  } catch {
    return [];
  }
}

export async function sleepPlaylist(rows = 14): Promise<RawHit[]> {
  const perMood = Math.max(2, Math.ceil(rows / 6));
  const moods = pickMoods(6);

  const [jamendo, audius, archive] = await Promise.all([
    Promise.all(moods.slice(0, 3).map((m) => moodTracks("jamendo", m, perMood))),
    Promise.all(moods.slice(3).map((m) => moodTracks("audius", m, perMood))),
    moodTracks("internet_archive", "ambient", perMood + 2).catch(() => [] as RawHit[]),
  ]);

  // Alternance des sources pour la variété : Jamendo, Audius, Archive.
  const groups = [...jamendo, ...audius, archive.flat()]
    .map((group) => group.filter((h) => h.streamUrl))
    .filter((group) => group.length > 0);

  const out: RawHit[] = [];
  const seen = new Set<string>();
  let index = 0;
  while (out.length < rows) {
    let added = false;
    for (const group of groups) {
      const hit = group[index];
      if (!hit) continue;
      added = true;
      const dedupeKey = `${hit.title.toLowerCase().slice(0, 50)}|${(hit.creator ?? "").toLowerCase().slice(0, 30)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push(hit);
      if (out.length >= rows) break;
    }
    if (!added) break;
    index += 1;
  }
  return out;
}
