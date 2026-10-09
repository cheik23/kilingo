/* ═══════════════════════════════════════════════════════════════════
   PRIX — SOURCE UNIQUE

   Le Module C du lot « refonte immersive » demande un ancrage honnête
   avant d'afficher le tarif. Un ancrage honnête ne peut pas contenir un
   chiffre écrit à la main : 9,99 € par jour arrondi à 0,33 €, et le
   mensuel doit rester vrai si le prix change.

   Donc : les montants vivent ICI, la copy les lit, et
   `scripts/verify-upgrade.mjs` échoue si la copy affichée (9,99 €,
   79,99 €/an, -33 %) diverge de ces constantes. Un prix qui bouge sans
   qu'on mette la copy à jour casse le contrôle au lieu de mentir en
   silence.

   Rien n'est encaissé : ce lot ne branche aucun prestataire de paiement
   (voir README § Paiement). Aucune clé, aucun appel, aucune caisse.
   ═══════════════════════════════════════════════════════════════════ */

export const PREMIUM = {
  /** €/mois, TTC. */
  monthlyEur: 9.99,
  /** €/an (l'équivalent annuel affiché sur la carte Premium). */
  annualEur: 79.99,
  /** Durée de l'essai gratuit, en jours. */
  trialDays: 7,
  /** Jours comptés pour l'ancrage « par jour » : un mois, pas une année. */
  anchorDays: 30,
} as const;

/** "0,33 €" — format français, deux décimales, espace insécable fine. */
export function formatEur(value: number): string {
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}\u202f€`;
}

/** Le prix par jour de l'ancrage, calculé — jamais recopié dans la copy. */
export function premiumPerDayEur(): string {
  return formatEur(PREMIUM.monthlyEur / PREMIUM.anchorDays);
}

/** La remise annuelle réellement obtenue, en pourcentage arrondi. */
export function premiumAnnualDiscountPct(): number {
  const full = PREMIUM.monthlyEur * 12;
  return Math.round((1 - PREMIUM.annualEur / full) * 100);
}
