import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { proxy, proxyOptions } from "./ovProxy";

const http = httpRouter();

auth.addHttpRoutes(http);

// Proxy média OpenVerse : liste blanche d'hôtes + relais de l'en-tête Range.
http.route({ path: "/ov/proxy", method: "GET", handler: proxy });
http.route({ path: "/ov/proxy", method: "OPTIONS", handler: proxyOptions });

export default http;
