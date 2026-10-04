import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Heart, Loader2 } from "lucide-react";
import { AudioPlayer } from "./Players";
import type { Content } from "@/openverse/model";

/* ═══════════════════════════════════════════════════════════════════════
   FAVORIS — mini-lecteur inline

   Le même AudioPlayer que la fiche (transport, progression, volume) est
   réutilisé tel quel : aucune logique de lecture dupliquée. Ce composant
   ne fait que trois choses :
     1. retrouver les favoris qui ont un flux ou un extrait jouable ;
     2. naviguer préc/suivant entre eux (l'AudioPlayer affiche lui-même
        les boutons quand on lui passe onNext / onPrev) ;
     3. laisser les favoris sans audio sous forme de cartes cliquables
        dans la grille en dessous.
   ═══════════════════════════════════════════════════════════════════════ */

/** Types qui se écoutent : tout le reste reste une carte. */
const AUDIO_KINDS = new Set(["music", "audio", "podcast"]);

export function FavoritesInlinePlayer({ items }: { items: Content[] }) {
  const candidates = useMemo(
    () => items.filter((c) => AUDIO_KINDS.has(c.kind)),
    [items],
  );
  const keys = useMemo(() => candidates.map((c) => c.key), [candidates]);

  // Les lignes de favoris ne portent pas les URLs jouables : on récupère
  // les fiches indexées (streamUrl / previewUrl) par la requête existante.
  const docs = useQuery(
    api.ovSearch.getContents,
    keys.length ? { keys: keys.slice(0, 60) } : "skip",
  );

  const tracks = useMemo(() => {
    if (!docs) return [];
    const byKey = new Map(docs.map((d) => [d.key, d]));
    return candidates
      .map((row) => (byKey.get(row.key) as unknown as Content) ?? row)
      .filter((c) => Boolean(c.streamUrl || c.previewUrl));
  }, [candidates, docs]);

  const [index, setIndex] = useState(0);
  const current = tracks.length ? tracks[Math.min(index, tracks.length - 1)] : null;

  if (!candidates.length) return null;

  if (!docs) {
    return (
      <div className="ln-card flex items-center gap-2 p-4 text-sm text-ink-3">
        <Loader2 className="size-4 animate-spin" /> Préparation de l'écoute…
      </div>
    );
  }

  if (!current) return null;

  return (
    <section className="ln-card mt-4 p-4">
      <p className="mb-3 flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-widest text-ink-3">
        <Heart className="size-3 text-gold" />
        Écouter tes favoris — {index + 1} sur {tracks.length}
      </p>
      <AudioPlayer
        key={current.key}
        content={current}
        onNext={tracks.length > 1 ? () => setIndex((i) => Math.min(tracks.length - 1, i + 1)) : undefined}
        onPrev={tracks.length > 1 ? () => setIndex((i) => Math.max(0, i - 1)) : undefined}
      />
    </section>
  );
}
