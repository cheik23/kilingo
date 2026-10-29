/* Garde-fous purs : exécutés même sans bypass Vercel, sans aucune navigation. */

import { expect, test } from "@playwright/test";

import { PREVIEW_CONVEX_HOST, resolvePreviewTarget } from "./target";

test.describe("cible E2E", () => {
  test("accepte les hôtes de Preview autorisés", () => {
    for (const host of [
      "kilingo-50xuh7gpo-g-c35c.vercel.app",
      "kilingo-git-work-p034-shadow-privacy-g-c35c.vercel.app",
    ]) {
      const url = resolvePreviewTarget(`https://${host}/app`);
      expect(url.hostname).toBe(host);
      expect(url.origin).toBe(`https://${host}`);
    }
  });

  test("refuse le site de Production", () => {
    expect(() => resolvePreviewTarget("https://kilingo-ten.vercel.app/")).toThrow(
      /interdite/i,
    );
  });

  test("refuse un hôte inconnu et le HTTP", () => {
    expect(() => resolvePreviewTarget("https://kilingo.example.com/")).toThrow(
      /non autorisé/i,
    );
    expect(() => resolvePreviewTarget("http://kilingo-50xuh7gpo-g-c35c.vercel.app/")).toThrow(
      /HTTPS requis/i,
    );
  });

  test("le backend attendu est bien la Preview, jamais la Production", () => {
    expect(PREVIEW_CONVEX_HOST).toBe("neat-wombat-556.convex.cloud");
    expect(PREVIEW_CONVEX_HOST).not.toBe("formal-vulture-518.convex.cloud");
  });
});
