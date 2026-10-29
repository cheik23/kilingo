/* Fixture E2E : garde-fous réseau + injection du bypass Vercel UNIQUEMENT
   vers l'origine de la Preview.

   - Toute requête vers Production (Vercel ou Convex) est abandonnée et
     enregistrée comme violation : le test échoue.
   - Toute requête vers un backend Convex autre que la Preview est abandonnée.
   - Le secret de bypass n'est jamais ajouté aux requêtes Convex, ni à un
     autre domaine, ni à une URL. Il ne sort pas de l'origine Preview. */

import { test as base, expect, type Page } from "@playwright/test";

import {
  BYPASS_SECRET,
  FORBIDDEN_HOSTS,
  PREVIEW_CONVEX_HOST,
  PREVIEW_ORIGIN,
} from "./target";

export type NetworkGuard = {
  convexHosts: Set<string>;
  violations: string[];
  consoleErrors: string[];
  pageErrors: string[];
};

export const test = base.extend<{ net: NetworkGuard }>({
  net: async ({ context, page }, use) => {
    const net: NetworkGuard = {
      convexHosts: new Set(),
      violations: [],
      consoleErrors: [],
      pageErrors: [],
    };

    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());

      if (FORBIDDEN_HOSTS.has(url.hostname)) {
        net.violations.push(`requête interdite vers ${url.hostname}${url.pathname}`);
        return route.abort("blockedbyclient");
      }
      if (url.hostname.endsWith(".convex.cloud")) {
        net.convexHosts.add(url.hostname);
        if (url.hostname !== PREVIEW_CONVEX_HOST) {
          net.violations.push(`backend Convex non autorisé : ${url.hostname}`);
          return route.abort("blockedbyclient");
        }
      }

      if (url.origin !== PREVIEW_ORIGIN || !BYPASS_SECRET) {
        // Aucun secret envoyé hors de l'origine Preview.
        return route.continue();
      }

      const headers: Record<string, string> = {
        ...route.request().headers(),
        "x-vercel-protection-bypass": BYPASS_SECRET,
      };
      // Cookie de bypass posé uniquement sur les navigations de la Preview.
      if (route.request().isNavigationRequest()) {
        headers["x-vercel-set-bypass-cookie"] = "true";
      }
      return route.continue({ headers });
    });

    // Convex synchronise par WebSocket : `context.route` ne voit pas ce
    // trafic (constaté en P0.3.12 : la page d'accueil n'émet aucune requête
    // HTTP vers Convex). Sans cette interception, `convexHosts` resterait
    // vide et `expectCleanNetwork` échouerait à tort.
    await context.routeWebSocket(/\.convex\.cloud/, (ws) => {
      const host = new URL(ws.url()).hostname;
      net.convexHosts.add(host);
      if (host !== PREVIEW_CONVEX_HOST) {
        net.violations.push(`WebSocket Convex non autorisé : ${host}`);
        void ws.close();
        return;
      }
      ws.connectToServer();
    });

    page.on("console", (message) => {
      if (message.type() === "error") net.consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => net.pageErrors.push(error.message));

    await use(net);
  },
});

export { expect };

/** Réseau conforme : aucun hôte interdit, backend Preview réellement contacté. */
export function expectCleanNetwork(net: NetworkGuard): void {
  expect(net.violations, `violations réseau : ${net.violations.join(" · ")}`).toEqual([]);
  expect(
    net.convexHosts.has(PREVIEW_CONVEX_HOST),
    `aucune requête vers ${PREVIEW_CONVEX_HOST} (vu : ${[...net.convexHosts].join(", ") || "aucun"})`,
  ).toBe(true);
}

/** Erreurs navigateur réellement inattendues (bruit réseau ignoré). */
export function expectNoBrowserErrors(net: NetworkGuard): void {
  expect(net.pageErrors, `exceptions JS : ${net.pageErrors.join(" · ")}`).toEqual([]);
  const unexpected = net.consoleErrors.filter(
    (text) =>
      !/Failed to load resource|ResizeObserver loop/i.test(text) &&
      // Playwright bloque volontairement les Service Workers
      // (`serviceWorkers: "block"`) : l'app journalise l'échec
      // d'enregistrement, ce n'est pas un défaut applicatif.
      !/Service worker\s*:\s*enregistrement impossible/i.test(text),
  );
  expect(unexpected, `erreurs console : ${unexpected.join(" · ")}`).toEqual([]);
}

export type PageLike = Page;
