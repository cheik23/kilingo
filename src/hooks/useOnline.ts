import { useCallback, useEffect, useState } from "react";

/**
 * État réseau de l'application.
 *
 * Convex exige le réseau : hors ligne, les queries renvoient `undefined` et
 * les écrans doivent le dire plutôt que d'afficher un état vide trompeur
 * (« tu n'as aucune carte » alors qu'on ne sait pas).
 *
 * `wasOffline` sert à n'afficher la bannière qu'une fois par coupure, puis à
 * la retirer : la laisser clignoter à chaque bascule `online`/`offline` de
 * l'onglet (que le mode avion déclenche sans arrêt) est pénible.
 */
export function useOnline() {
  // `navigator` n'existe pas au rendu serveur : on lit l'état au montage
  // plutôt qu'au premier rendu pour ne pas supposer le client.
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const update = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (!online) setWasOffline(true);
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  /** Permet à l'appelant de réinitialiser le flag (bouton « Réessayer »). */
  const acknowledgeOffline = useCallback(() => setWasOffline(false), []);

  return { isOnline, wasOffline, acknowledgeOffline };
}
