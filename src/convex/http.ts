import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { proxy, proxyOptions } from "./ovProxy";
import { webhook as lemonSqueezyWebhook } from "./lemonsqueezyWebhook";

const http = httpRouter();

auth.addHttpRoutes(http);

// Proxy média OpenVerse : liste blanche d'hôtes + relais de l'en-tête Range.
http.route({ path: "/ov/proxy", method: "GET", handler: proxy });
http.route({ path: "/ov/proxy", method: "OPTIONS", handler: proxyOptions });

// Lemon Squeezy — notifications d'abonnement (Module C du lot « paiement »).
// La route vit dans son PROPRE fichier (`lemonsqueezyWebhook.ts`) et non ici :
// elle ne fait que transmettre le corps brut et l'en-tête `X-Signature` à
// l'action `lemonsqueezy.processWebhook`, qui est la seule à détenir le
// secret de signature (runtime Node). Importer ici un module `"use node"`
// forcerait le bundler à le compiler pour le navigateur, et le `node:crypto`
// qu'il utilise deviendrait introuvable.
http.route({
  path: "/lemonsqueezy/webhook",
  method: "POST",
  handler: lemonSqueezyWebhook,
});

export default http;
