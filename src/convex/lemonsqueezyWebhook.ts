import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

/* ═══════════════════════════════════════════════════════════════════════
   WEBHOOK LEMON SQUEEZY — ROUTE HTTP (Module C)

   Ce fichier ne fait QUE trois choses : lire le corps BRUT, lire
   l'en-tête `X-Signature`, et transmettre le tout à une action.

   Pourquoi cette indirection ? Parce que
   Convex n'autorise pas les `httpAction` dans un fichier `"use node"`
   (seules les actions y sont admises), alors que la vérification HMAC a
   besoin de `node:crypto`. On sépare donc les deux :

     · cette route — runtime Convex classique, aucun secret en mémoire ;
     · `lemonsqueezy.processWebhook` — runtime Node, seule à lire
       `LEMONSQUEEZY_WEBHOOK_SECRET` et à calculer le HMAC.
   ⚠ SÉPARATION DE SÉCURITÉ : cette route ne peut pas valider la
   signature (elle n'a pas la clé, et ne doit pas l'avoir). Elle se
   contente de transmettre le corps et l'en-tête ; TOUTE la décision
   appartient à l'action. Une route qui « déciderait » sans la clé
   reviendrait à déplacer la faille au lieu de la fermer.
   ═══════════════════════════════════════════════════════════════════════ */

export const webhook = httpAction(async (ctx, request) => {
  let payload: string;
  try {
    // Le corps BRUT, jamais un `request.json()` : la signature porte sur
    // les octets exacts envoyés, pas sur un objet re-sérialisé. Re-sérialiser
    // ferait échouer une signature valide.
    payload = await request.text();
  } catch {
    return Response.json(
      { ok: false, error: "corps de requête illisible" },
      { status: 400 },
    );
  }

  const signature = request.headers.get("X-Signature");

  // L'action lève si la signature est absente ou fausse : on traduit
  // l'échec en 401, sans jamais révéler WHICH partie a échoué au-delà du
  // nécessaire (le détail revient dans le corps, utile en debug).
  const result = await ctx.runAction(api.lemonsqueezy.processWebhook, {
    payload,
    signature: signature ?? "",
  });

  return Response.json(
    { ok: result.ok, result: result.code, detail: result.detail },
    { status: result.httpStatus },
  );
});
