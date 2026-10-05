/* ═══════════════════════════════════════════════════════════════════════
   PAROLES — lrclib.net (sans clé)

   Repli du connecteur Genius : lrclib est une base communautaire libre,
   gratuite, sans clé ni quota, qui expose le texte brut ET les paroles
   synchronisées (LRC) — ce que l'API Genius ne fournit jamais.

   Endpoints :
     GET /api/search?q=…            → liste de candidats (avec paroles)
     GET /api/get/{id}              → fiche complète d'un titre

   Aucune exception ne doit sortir d'ici : indisponible → [] / null + log.
   ═══════════════════════════════════════════════════════════════════════ */

const LRCLIB_BASE = "https://lrclib.net/api";

/** lrclib demande un User-Agent identifiable et bloque les UA vides. */
const LRCLIB_UA = "Kilingo/1.0 (apprentissage linguistique)";

export type LrclibHit = {
  id: number;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  instrumental?: boolean;
  /** Texte brut des paroles (sans horodatage). */
  plain?: string;
  /** Paroles synchronisées au format LRC « [mm:ss.xx] texte ». */
  synced?: string;
};

type LrclibRecord = {
  id?: number;
  name?: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

/** GET JSON tolérant : 404 discret, toute autre erreur → null + log. */
async function lrclibGetJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": LRCLIB_UA, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      if (res.status !== 404) {
        console.warn(`[lrclib] HTTP ${res.status} — repli/cascade`);
      }
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.warn(
      "[lrclib] réseau indisponible — repli/cascade :",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function toHit(record: LrclibRecord | null | undefined): LrclibHit | null {
  if (!record || typeof record.id !== "number") return null;
  const plain = typeof record.plainLyrics === "string" ? record.plainLyrics.trim() : "";
  const synced = typeof record.syncedLyrics === "string" ? record.syncedLyrics.trim() : "";
  return {
    id: record.id,
    title: (record.trackName ?? record.name ?? "Sans titre").trim(),
    artist: (record.artistName ?? "").trim(),
    ...(record.albumName ? { album: record.albumName } : {}),
    ...(typeof record.duration === "number" ? { duration: record.duration } : {}),
    instrumental: record.instrumental === true,
    ...(plain ? { plain } : {}),
    ...(synced ? { synced } : {}),
  };
}

/**
 * Recherche de candidats. Ne garde que les fiches réellement porteuses de
 * paroles (texte ou LRC) : le reste ne sert pas la fiche.
 *
 * Deux requêtes complémentaires quand artiste ET titre sont connus :
 * lrclib expose des filtres structurés (`track_name` + `artist_name`) bien
 * plus précis que le texte libre quand plusieurs morceaux partagent un nom
 * — « Hello » seul remonte des homonymes obscurs et rate la version voulue.
 */
export async function searchLrclib(
  q: string,
  opts?: { trackName?: string; artistName?: string; limit?: number },
): Promise<LrclibHit[]> {
  const query = q.trim();
  const track = opts?.trackName?.trim();
  const artist = opts?.artistName?.trim();
  const limit = opts?.limit ?? 8;
  if (!query && !(track && artist)) return [];

  const urls: string[] = [];
  if (track && artist) {
    urls.push(
      `${LRCLIB_BASE}/search?track_name=${encodeURIComponent(track)}&artist_name=${encodeURIComponent(artist)}`,
    );
  }
  if (query) urls.push(`${LRCLIB_BASE}/search?q=${encodeURIComponent(query)}`);

  const seen = new Set<number>();
  const withText: LrclibHit[] = [];
  for (const url of urls) {
    const data = await lrclibGetJson<LrclibRecord[]>(url);
    if (!Array.isArray(data)) continue;
    for (const record of data) {
      const hit = toHit(record);
      if (!hit || seen.has(hit.id)) continue;
      seen.add(hit.id);
      if (hit.plain || hit.synced) withText.push(hit);
    }
    if (withText.length >= limit) break;
  }
  return withText.slice(0, limit);
}

/** Fiche complète par identifiant lrclib (texte + LRC). */
export async function getLrclibById(id: number): Promise<LrclibHit | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  const data = await lrclibGetJson<LrclibRecord>(`${LRCLIB_BASE}/get/${id}`);
  return toHit(data);
}
