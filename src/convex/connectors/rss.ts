import { feedEpisodes } from "./podcasts";
import type { ConnectorSpec, RawHit } from "./types";

/* ═══════════════════════════════════════════════════════════════════════
   FLUX RSS / ATOM — podcasts, créateurs indépendants, blogs

   Ce connecteur ne cherche rien par mot-clé : il normalise UN flux précis
   fourni par l'utilisateur (l'URL du flux d'un créateur, d'un média ou
   d'une émission). C'est le mécanisme qui permet d'ajouter du contenu
   moderne sans embarquer de catalogue tiers.

   · enclosure audio/vidéo publiée par l'éditeur → écoute/lecture en
     streaming depuis sa source (aucune copie) ;
   · tout le reste → fiche informative + lien vers la source.
   ═══════════════════════════════════════════════════════════════════════ */

export const rss: ConnectorSpec = {
  key: "rss",
  kinds: ["podcast", "audio", "video", "article"],
  // Pas de recherche plein texte : la source, c'est l'URL du flux.
  search: async () => [],
};

/** Normalise un flux quelconque en contenus lisibles par le moteur. */
export async function feedHits(url: string, limit = 20): Promise<RawHit[]> {
  const feed = await feedEpisodes(url, "rss", limit);
  return feed.episodes;
}
