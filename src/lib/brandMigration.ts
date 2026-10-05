/**
 * Migration des préférences au changement de marque.
 *
 * Les préférences utilisateur vivaient sous le préfixe `ln.` :
 * thème, volume, son coupé, bandeaux masqués, install prompt, et surtout
 * `ln.ref` — le code de parrainage, qui doit survivre au rechargement comme au
 * renommage. Un simple remplacement de chaîne les aurait tous effacés : le
 * compte aurait perdu son thème et son volume, et un parrainage en cours aurait
 * été perdu pour de bon.
 *
 * On recopie donc chaque ancienne clé sous le nouveau préfixe avant de
 * supprimer l'ancienne, et une seule fois par session. La migration est
 * idempotente : si la nouvelle clé existe déjà, elle gagne (c'est la version la
 * plus récente que l'app a écrite).
 */

const ANCIEN_PREFIXE = "ln.";
const NOUVEAU_PREFIXE = "kilingo.";

/** Recopie `ln.*` vers `kilingo.*`, puis purge l'ancien préfixe. */
export function migrerPreferences(): void {
  try {
    const anciennes: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const cle = localStorage.key(i);
      if (!cle || !cle.startsWith(ANCIEN_PREFIXE)) continue;
      const cible = NOUVEAU_PREFIXE + cle.slice(ANCIEN_PREFIXE.length);
      const valeur = localStorage.getItem(cle);
      if (valeur !== null && localStorage.getItem(cible) === null) {
        localStorage.setItem(cible, valeur);
      }
      anciennes.push(cle);
    }
    for (const cle of anciennes) localStorage.removeItem(cle);
  } catch {
    /* sans localStorage (navigation privée stricte) : rien à migrer */
  }
}
