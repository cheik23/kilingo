import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getPwaCopy } from "../src/lib/i18n.pwa";

/* ═══════════════════════════════════════════════════════════════════════
   PWA — garanties d'installation et de mise à jour.

   Classes de tests :
   · MANIFESTE / ICÔNES : lecture de fichiers réels + décodage PNG (sharp)
     — validation objective, pas un navigateur.
   · SW STATIQUE : lecture de `public/sw.js`, vérifie les INVariantS de
     sécurité du cycle de mise à jour (pas de skipWaiting auto, contrat de
     message, purge de cache).
   · CÂBLAGE COMPOSANT : lecture de `PwaRuntime.tsx` — les écouteurs du
     cycle de vie attendus sont réellement montés.
   · I18N : les 12 langues portent les chaînes de mise à jour.

   Aucun test ici n'exécute un navigateur : l'installation mobile réelle
   (iOS/Android) reste à valider sur appareil — voir le rapport.
   ═══════════════════════════════════════════════════════════════════════ */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const ICONS = path.join(ROOT, "public", "icons");

describe("PWA — manifeste", () => {
  const raw = read("public/manifest.webmanifest");
  const manifest = JSON.parse(raw) as {
    name: string; short_name: string; description: string;
    display: string; start_url: string; scope: string;
    theme_color: string; background_color: string;
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
    shortcuts: { url: string }[];
  };

  test("JSON valide + nom court Kɪ́LINGO demandé", () => {
    expect(manifest.name).toContain("Kɪ́LINGO");
    expect(manifest.short_name).toBe("Kɪ́LINGO");
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });

  test("description alignée sur le catalogue réel (30 langues)", () => {
    // Ancien texte « 11 langues » : faux depuis l'ajout des lots Phase 2.
    expect(manifest.description).not.toMatch(/\b11 langues\b/);
    expect(manifest.description).toMatch(/\b30 langues\b/);
  });

  test("propriétés d'installation", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    // Couleurs de l'identité visuelle (tokens nuit or/noir).
    expect(manifest.theme_color).toBe("#1A1F3A");
    expect(manifest.background_color).toBe("#1A1F3A");
  });

  test("icônes requises déclarées (192, 512, maskable)", () => {
    const has = (src: string, purpose?: string) =>
      manifest.icons.some((i) => i.src === src && (purpose === undefined || i.purpose === purpose));
    expect(has("/icons/icon-192.png")).toBe(true);
    expect(has("/icons/icon-512.png")).toBe(true);
    expect(has("/icons/maskable-512.png", "maskable")).toBe(true);
    // Chrome exige au minimum 192 + 512 pour le critère d'installation.
    expect(manifest.icons.some((i) => i.sizes === "192x192")).toBe(true);
    expect(manifest.icons.some((i) => i.sizes === "512x512")).toBe(true);
  });

  test("shortcuts pointent vers des routes RÉELLEMENT montées", () => {
    const routes = read("src/main.tsx");
    for (const sc of manifest.shortcuts) {
      expect(sc.url.startsWith("/app/")).toBe(true);
      const seg = sc.url.replace("/app/", "");
      // Route déclarée <Route path="seg" …> sous l'arbre /app.
      expect(routes).toMatch(new RegExp(`path="${seg}"`));
    }
  });
});

describe("PWA — fichiers d'icônes réels", () => {
  test("toutes les icônes existent et sont des PNG aux bonnes tailles", async () => {
    const expected: [string, number][] = [
      ["icon-192.png", 192],
      ["icon-512.png", 512],
      ["maskable-512.png", 512],
      ["apple-touch-icon-180.png", 180],
      ["favicon-32.png", 32],
    ];
    for (const [file, size] of expected) {
      const p = path.join(ICONS, file);
      expect(existsSync(p)).toBe(true);
      const meta = await sharp(p).metadata();
      expect(meta.format).toBe("png");
      expect(meta.width).toBe(size);
      expect(meta.height).toBe(size);
    }
  });

  test("index.html référence l'apple-touch-icon 180 attendu par iOS", () => {
    const html = read("index.html");
    expect(html).toMatch(/rel="apple-touch-icon"[^>]*href="\/icons\/apple-touch-icon-180\.png"/);
    expect(html).toMatch(/rel="manifest" href="\/manifest\.webmanifest"/);
    expect(html).toMatch(/name="theme-color" content="#1A1F3A"/);
  });
});

describe("PWA — service worker : sécurité de mise à jour (statique)", () => {
  const sw = read("public/sw.js");

  test("AUCUN skipWaiting() automatique à l'installation", () => {
    // Régression interdite : skipWaiting pendant install → le SW remplaçant
    // purge les anciens caches sous un onglet qui exécute l'ancien bundle.
    const installBlock = sw.slice(
      sw.indexOf('addEventListener("install"'),
      sw.indexOf('addEventListener("activate"'),
    );
    expect(installBlock).not.toContain("skipWaiting");
  });

  test("activation possible UNIQUEMENT par message explicite", () => {
    expect(sw).toMatch(/addEventListener\("message"/);
    expect(sw).toMatch(/event\.data === "SKIP_WAITING"/);
    // La porte d'activation doit exister (sinon la mise à jour est impossible).
    expect(sw).toContain("self.skipWaiting()");
  });

  test("purge des anciens caches par VERSION dérivée", () => {
    expect(sw).toMatch(/const VERSION = `\$\{CACHE_PREFIX\}[^`]+`/);
    expect(sw).toContain("caches.delete(name)");
    // Les anciens caches de marque restent purgés une fois.
    expect(sw).toContain("LEGACY_CACHE_PREFIXES");
  });

  test("les données vivantes (Convex) ne sont JAMAIS mises en cache", () => {
    expect(sw).toContain(".convex.cloud");
    // Un GET seulement : aucune mutation Convex interceptée.
    expect(sw).toMatch(/request\.method !== "GET"/);
  });

  test("navigation réseau d'abord (pas de shell périmé) + assets cache d'abord", () => {
    expect(sw).toMatch(/request\.mode === "navigate"/);
    expect(sw).toContain("networkFirst");
    expect(sw).toContain("cacheFirst");
  });
});

describe("PWA — câblage du cycle de mise à jour (statique)", () => {
  const src = read("src/components/PwaRuntime.tsx");

  test("SW enregistré en production uniquement", () => {
    expect(src).toContain("import.meta.env.PROD");
    expect(src).toMatch(/serviceWorker\.register\("\/sw\.js"/);
  });

  test("détection du SW en attente : updatefound + registration.waiting", () => {
    expect(src).toContain('addEventListener("updatefound"');
    expect(src).toContain("reg.waiting");
    expect(src).toMatch(/state === "installed"/);
  });

  test("rechargement UNIQUEMENT sur controllerchange accepté par l'utilisateur", () => {
    expect(src).toContain('addEventListener("controllerchange"');
    expect(src).toMatch(/window\.location\.reload\(\)/);
    // Le rechargement est conditionné par le clic utilisateur : sans ça,
    // le premier clients.claim() (visite initiale) rechargerait la page,
    // et un applyUpdate mal câblé annulerait son propre reload.
    expect(src).toMatch(/if \(!updateAccepted\.current\) return/);
    expect(src).toMatch(/updateAccepted\.current = true/);
    // Garde anti-boucle : un seul rechargement par cycle.
    expect(src).toMatch(/if \(refreshRequested\.current\) return/);
    // Aucun rechargement automatique sans action : pas de reload dans le
    // corps de l'effet d'enregistrement.
    expect(src).not.toMatch(/useEffect\(\(\) => \{[^}]*location\.reload/);
  });

  test("l'acceptation est posée AVANT postMessage (sinon le reload est annulé)", () => {
    const applyBlock = src.slice(src.indexOf("const applyUpdate"));
    const acceptIdx = applyBlock.indexOf("updateAccepted.current = true");
    const postIdx = applyBlock.indexOf('postMessage("SKIP_WAITING")');
    expect(acceptIdx).toBeGreaterThan(-1);
    expect(postIdx).toBeGreaterThan(acceptIdx);
  });

  test("contrat de message cohérent avec sw.js (CHAÎNE, pas objet)", () => {
    expect(src).toContain('postMessage("SKIP_WAITING")');
    expect(src).not.toContain('postMessage({ type: "SKIP_WAITING" })');
  });

  test("l'indicateur de mise à jour expose une action (bouton + clés i18n)", () => {
    expect(src).toContain('t("pwa.update.banner")');
    expect(src).toContain('t("pwa.update.button")');
    expect(src).toContain("onClick={applyUpdate}");
  });

  test("nette : l'écouteur visibilitychange est retiré avec la MÊME référence", () => {
    expect(src).toMatch(/removeEventListener\("visibilitychange", onVisibilityChange\)/);
    expect(src).not.toMatch(/removeEventListener\("visibilitychange", \(\) => undefined\)/);
  });
});

describe("PWA — i18n : chaînes de mise à jour sur les 12 langues", () => {
  const langs = ["fr", "en", "es", "zh", "ar", "ru", "sw", "ln", "ha", "yo", "zu", "wo"];

  test("chaque langue porte update.banner / button / applying non vides", () => {
    for (const lang of langs) {
      const copy = getPwaCopy(lang) as
        | { pwa: { update: { banner: string; button: string; applying: string } } }
        | undefined;
      expect(copy).toBeDefined();
      const u = copy!.pwa.update;
      expect(u.banner.length).toBeGreaterThan(0);
      expect(u.button.length).toBeGreaterThan(0);
      expect(u.applying.length).toBeGreaterThan(0);
    }
  });

  test("copie PWA complète (offline + install + update) sur chaque langue", () => {
    for (const lang of langs) {
      const copy = getPwaCopy(lang) as Record<string, Record<string, Record<string, string>>>;
      const pwa = copy.pwa;
      expect(Object.keys(pwa).sort()).toEqual(["install", "offline", "update"]);
    }
  });
});
