/* ═══════════════════════════════════════════════════════════════════════
   Lecteurs embarqués — Dailymotion (iframe officielle) + média direct
   (Archive.org / fichiers <video>/<audio> sans redirection).

   Dailymotion : l'iframe dailymotion.com/embed joue DANS l'app. La
   plateforme n'expose pas d'API de contrôle postMessage documentée :
   pas de karaoké ici — le panneau Shadow l'annonce honnêtement.

   Média direct : un élément <video>/<audio> natif sur l'URL résolue
   (archive.org/download/...) — aucun proxy, aucune redirection, et la
   barre de transport Shadow complète (±5/10 s, segments, vitesse).
   ═══════════════════════════════════════════════════════════════════════ */

export function DailymotionEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
      <iframe
        src={`https://www.dailymotion.com/embed/video/${videoId}`}
        title="Dailymotion"
        className="aspect-video w-full"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
