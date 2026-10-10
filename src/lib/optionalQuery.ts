import { useQuery_experimental } from "convex/react";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

/* ═══════════════════════════════════════════════════════════════════════
   LECTURE TOLÉRANTE D'UNE REQUÊTE CONVEX

   `useQuery` de Convex RELANCE l'erreur du serveur pendant le rendu
   (`convex/dist/esm/react/client.js` : `if (result instanceof Error) throw result`).
   Quand le front part avant le backend — le cas normal sur Vercel, où
   l'app est redéployée au push alors que les fonctions Convex se poussent
   à la main — une seule fonction absente suffit donc à faire tomber TOUT
   l'écran sur l'ErrorBoundary (« Une erreur est survenue »), alors que
   l'utilisateur n'a rien cassé. C'est exactement ce qui bloquait le
   démarrage des conversations en production.

   Ce hook lit la même requête, en réactivité, mais rend l'absence
   OBSERVABLE au lieu de la jeter :

     · `data`        : le résultat, ou `undefined` tant qu'il n'y en a pas ;
     · `unavailable` : vrai quand le serveur n'a pas pu répondre — fonction
                       pas (encore) déployée, ou erreur serveur. Au call-site
                       de décider quoi montrer.

   L'appelant DOIT prévoir une valeur de repli (avatar par défaut, étape
   ignorée) : une fonction manquante n'est jamais une raison de bloquer
   une conversation. Le détail technique reste en console, où le client
   Convex le journalise déjà lui-même — rien à afficher à l'écran.

   S'appuie sur `useQuery_experimental` (export public de `convex/react`,
   `throwOnError: false`), le seul point de contact de tout le projet : si
   Convex renomme un jour cette API, c'est ici, et nulle part ailleurs,
   qu'il faudra revenir — le build échouerait bruyamment, pas en silence.
   ═══════════════════════════════════════════════════════════════════════ */

export type OptionalQueryResult<Data> = {
  /** Résultat de la requête, `undefined` tant qu'il n'y en a pas. */
  data: Data | undefined;
  /** Vrai quand le serveur n'a pas pu répondre (fonction absente…). */
  unavailable: boolean;
};

export function useOptionalQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query>,
): OptionalQueryResult<FunctionReturnType<Query>> {
  const state = useQuery_experimental({ query, args, throwOnError: false });
  if (state.status === "success") {
    return { data: state.data, unavailable: false };
  }
  if (state.status === "error") {
    return { data: undefined, unavailable: true };
  }
  return { data: undefined, unavailable: false };
}
