import { useQuery } from "convex/react";
import type { ReactNode } from "react";

import { api } from "@/convex/_generated/api";
import { resolveGate, type PremiumFeature } from "@/lib/premiumGates";

/* ═══════════════════════════════════════════════════════════════════════
   PORTE PREMIUM — MODULE E

   Rend ses enfants si l'accès est accordé, l'invite sinon.

   Elle ne décide RIEN par elle-même : elle demande à `resolveGate`, qui
   ne lit que la politique déclarée dans `lib/premiumGates.ts` et le
   résultat de `getMyPremiumStatus`. Deux raisons de passer par là plutôt
   que d'écrire un `if (isPremium)` sur place :

     · il n'y a qu'UN endroit où l'on décide d'un accès Premium, donc
       un seul endroit à relire quand la politique change ;
     · `getMyPremiumStatus` reste la source unique de vérité — un
       `localStorage` ou un booléon local ici réintroduirait exactement
       la seconde vérité que le Module A a précisément supprimée.

   L'invite n'est pas un écran plein : elle ACCOMPAGNE, elle ne
   remplace rien. Un utilisateur dont la query n'est pas encore revenue
   garde donc ses accès, au lieu de voir l'interface se refermer sur lui.
   ═══════════════════════════════════════════════════════════════════════ */

export function PremiumGate({
  feature,
  children,
  fallback,
}: {
  feature: PremiumFeature;
  children: ReactNode;
  /** Rendu quand l'accès est refusé. */
  fallback?: ReactNode;
}) {
  const status = useQuery(api.subscriptions.getMyPremiumStatus);
  const allowed = resolveGate(feature, status?.isPremium);
  if (allowed) return <>{children}</>;
  return <>{fallback ?? null}</>;
}
