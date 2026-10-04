import { gutendex, openLibrary } from "./books";
import { deezer } from "./deezer";
import { dailymotion } from "./dailymotion";
import { googleBooks } from "./googlebooks";
import { audius, jamendoConnector } from "./jamendo";
import { internetArchive, librivox, prelinger } from "./internetArchive";
import { itunes } from "./itunes";
import { musicbrainz } from "./musicbrainz";
import { podcasts } from "./podcasts";
import { radio } from "./radio";
import { rss } from "./rss";
import type { ConnectorSpec } from "./types";
import { tvmaze } from "./tvmaze";
import { wikimedia, wikinews, wikipedia } from "./wikimedia";
import { youtube } from "./youtube";

/* ═══════════════════════════════════════════════════════════════════════
   REGISTRE DES CONNECTEURS

   Ajouter une source = un fichier dans ce dossier + une ligne ici.
   Le moteur (ovSearch), le registre public (ovSources) et l'interface
   (rayons) se mettent à jour automatiquement : aucune autre modification
   n'est nécessaire.
   ═══════════════════════════════════════════════════════════════════════ */

/* L'ordre d'enregistrement est la priorité d'affichage des rayons :
   le catalogue réel (Deezer, Google Books, iTunes) passe devant les
   sources libres. */
export const SPECS: Record<string, ConnectorSpec> = {
  deezer,
  google_books: googleBooks,
  itunes,
  internet_archive: internetArchive,
  prelinger,
  librivox,
  gutendex,
  open_library: openLibrary,
  jamendo: jamendoConnector,
  audius,
  dailymotion,
  podcasts,
  radio,
  tvmaze,
  wikimedia_commons: wikimedia,
  musicbrainz,
  wikipedia,
  wikinews,
  rss,
  youtube,
};

/** Clés des connecteurs réellement implémentés (source de vérité). */
export function specKeys(): string[] {
  return Object.keys(SPECS);
}

export function specFor(key: string): ConnectorSpec | undefined {
  return SPECS[key];
}

export type { ConnectorSpec, RawHit, SearchOpts, SortKey } from "./types";
