# Kɪ́LINGO — PWA : installation mobile et mises à jour fiables

> Mission du 24 octobre 2026. Rapport d'audit avant/après, fichiers modifiés,
> instructions d'installation, procédures de test et de publication.
> **Aucune publication effectuée.** Aucun secret ni environnement de production
> modifié. Le backend actif `formal-vulture-518` n'a pas été touché ;
> le clone `impartial-pony-692` reste une cible de test.

---

## 1. Audit — état avant / après

### Avant la mission

| Zone | État constaté |
| --- | --- |
| Framework | Vite 7 + React 19 + React Router, SPA, build `npm run build` → `dist/` |
| Vercel | `vercel.json` présent : framework vite, rewrite SPA `/(.*) → /index.html`, header `nosniff` |
| Manifeste | Présent mais obsolète : `name: "Kilingo — Argot Africain"`, `short_name: "Kilingo"`, description « 11 langues », pas de `display_override` |
| Icônes | `icon-192.png`, `icon-512.png`, `maskable-512.png`, `favicon-32.png` existaient (marque) ; **pas d'icône 180×180 dédiée iOS** — `apple-touch-icon` pointait vers `icon-192.png` sans attribut `sizes` |
| Service worker | Présent mais **dangereux** : `await self.skipWaiting()` à l'installation → le SW remplaçant prenait le contrôle et **purgeait les caches pendant qu'un onglet exécutait encore l'ancien bundle** → chunks paresseux absents du cache, serveur ne sert plus les hash anciens → **écran blanc pendant une mise à jour** |
| Version de cache | `VERSION = kilingo-v1-2026-09-26` (jamais purgé depuis sept.) |
| Détection de mise à jour côté app | Aucune : aucun bandeau, aucun `updatefound`, aucun `registration.waiting` |
| Dépendances PWA | Aucune (`vite-plugin-pwa` absent) — le SW est vanilla, zéro dépendance, c'est resté ainsi |
| i18n | Fichier `i18n.pwa.ts` partiel (offline/install, pas de clés de mise à jour) |

### Après la mission

- **Manifeste conforme** : `name: "Kɪ́LINGO — Les langues du monde, comme elles se parlent"`,
  `short_name: "Kɪ́LINGO"`, description 30 langues, `display_override: ["standalone", "minimal-ui"]`,
  `display: standalone`, `theme_color/background_color: #1A1F3A` (identité visuelle existante),
  icônes 192 / 512 / maskable-512 / SVG + raccourcis.
- **iOS** : `apple-touch-icon-180.png` **généré à partir de la ressource de marque**
  (180×180 attendu par iOS), référencé par deux balises dont `sizes="180x180"` ;
  `apple-mobile-web-app-title` aligné sur `Kɪ́LINGO` ; `theme-color` présent.
- **SW sûr** : plus de `skipWaiting()` automatique. Le remplaçant reste **en attente**,
  l'ancien continue de servir un cache cohérent (même `VERSION`) indéfiniment.
  Activation **uniquement** par message `SKIP_WAITING` émis après clic utilisateur,
  suivi d'**un** rechargement sur `controllerchange`.
- **Purge par VERSION** : `kilingo-v1-2026-10-24-{assets,pages}` ; l'`activate` supprime
  tous les caches `kilingo-*` (et l'ancien préfixe `linguanoir-*`) sauf les siens.
  Nom de cache et filtre de purge dérivent de la même constante : impossible de diverger.
- **Règles de cache** : navigations `network-first` (jamais de shell périmé),
  assets hashés `cache-first`, **jamais de cache** pour Convex (`*.convex.cloud`), les CDNs,
  les médias et les `POST` (mutations Convex intactes). Les données vivantes ne sont
  **jamais** mises en cache → aucune donnée utilisateur perdue au remplacement des ressources statiques.
- **Détection + indicateur** (`PwaRuntime`) : `updatefound` + `registration.waiting`
  (y compris un onglet longue durée qui relève la main au retour au premier plan),
  bandeau « Une nouvelle version est disponible » avec bouton **Mettre à jour**,
  traduit sur les 12 langues. **Aucun rechargement sans action explicite** :
  le rechargement est conditionné par le clic (`updateAccepted`) puis anti-boucle
  (`refreshRequested`) — le premier `clients.claim()` (visite initiale) ne recharge pas.
- **Hors ligne** : bandeau discret `OfflineBanner`, precache de coquille
  (`/offline.html`, manifeste, mascotte, icône), fallback page → `offline.html`.
- **Tests** : `tests/pwa.test.ts` — 21 tests (manifeste, icônes, règles statiques du SW,
  câblage du cycle de mise à jour, i18n 12 langues).

### Défaut trouvé puis corrigé pendant les tests navigateur

La validation en conditions réelles a montré que mon premier câblage **annulait son propre
rechargement** : `applyUpdate` positionnait la garde *avant* le `postMessage`, et
`if (refreshRequested.current) return` l'interprétait comme « déjà rechargé » → le SW
remplaçant s'activait et purgait les caches **sans** rechargement (bundle périmé servi
sur caches neufs = écran blanc au prochain lazy-load). Corrigé avec deux drapeaux
distincts : `updateAccepted` (clic, autorise le reload) et `refreshRequested` (une seule
occurrence). Verrouillé par 2 tests statiques + validé en navigateur.

---

## 2. Fichiers modifiés (mission PWA)

| Fichier | Changement |
| --- | --- |
| `public/manifest.webmanifest` | Nom Kɪ́LINGO, description 30 langues, `display_override` |
| `public/sw.js` | `skipWaiting()` automatique supprimé, `VERSION` à jour, commentaires de contrat, purge |
| `index.html` | Apple-touch-icon 180 (+ `sizes`), `apple-mobile-web-app-title` Kɪ́LINGO |
| `public/icons/apple-touch-icon-180.png` | **Nouveau** — icône iOS générée depuis la marque |
| `src/components/PwaRuntime.tsx` | Détection de mise à jour, bandeau + clic, garde `updateAccepted`/`refreshRequested`, bandeau hors ligne |
| `src/lib/i18n.pwa.ts` | Clés `pwa.update.{banner,button,applying}` sur les 12 langues |
| `tests/pwa.test.ts` | **Nouveau** — 21 tests statiques de non-régression |

Les modifications préexistantes (SRS/Discover, seeds, `reviewSessionTracker`, etc.)
sont **préservées, non touchées**. Aucun fichier supprimé, aucun commit.

---

## 3. Installer Kɪ́LINGO sur iPhone

Safari > iOS 16.4+ recommandé (avant 16.4, pas de support manifeste : l'app utilise
le titre de la page et l'icône `apple-touch-icon`, mais l'installation PWA complète
n'est pas garantie).

1. Ouvrir **Safari** sur l'URL de production (HTTPS obligatoire).
2. Appuyer sur le bouton **Partager** (carré avec la flèche vers le haut).
3. Dans la liste, choisir **Sur l'écran d'accueil**.
4. Confirmer le nom **Kɪ́LINGO** puis **Ajouter**.
5. L'icône apparaît sur l'écran d'accueil ; l'app s'ouvre en plein écran
   (`standalone`, sans barre Safari).

Remarques iOS :
- **Sur iPhone uniquement** (iPadOS ne présente pas toujours l'action : basculer
  Safari en « Site web complet » dans Réglages › Safari).
- iOS gère lui-même le cache du SW ; le bandeau de mise à jour reste fonctionnel
  dès iOS 16.4 (SW + manifeste pris en charge).

## 4. Installer Kɪ́LINGO sur Android

**Chrome / Edge / Samsung Internet 80+** (installabilité automatique du manifeste) :

1. Ouvrir l'URL de production dans Chrome.
2. Si le bandeau d'installation natif apparaît : **Installer l'application**
   / **Ajouter à l'écran d'accueil**.
3. Sinon : menu ⋮ → **Installer l'application** / **Ajouter à l'écran d'accueil**
   (parfois « Ajouter au menu principal »).
4. Confirmer : l'icône Kɪ́LINGO est posée sur l'écran d'accueil.

**Firefox Android** : menu ⋮ → **Installer**.

Dans les deux cas, l'app s'ouvre en `standalone` avec le thème `#1A1F3A`.

---

## 5. Procédure — tester une nouvelle version sur téléphone

Prérequis : une version déployée sur l'URL testée (voir §7 pour la publication).

1. **Ouvrir l'app** installée (ou dans l'onglet du navigateur) et rester sur un écran
   quelconque — un onglet longue durée relève aussi la mise à jour au retour au
   premier plan de l'app.
2. **Déployer la nouvelle version** (§7).
3. Dans l'app : revenir au premier plan (fermer/revenir) ou recharger **une fois** :
   le SW contrôle une nouvelle version.
4. **Attendre le bandeau** « ✨ Une nouvelle version est disponible » en haut.
   Il peut falloir une navigation ou un retour au premier plan ; ne rien purger
   manuellement.
5. Cliquer **Mettre à jour** → « Mise à jour… » → la page se recharge **une seule fois**.
6. **Vérifier** :
   - le bandeau a disparu ;
   - l'app fonctionne (aucun écran blanc) ;
   - côté technique (optionnel) : DevTools Chrome (chrome://inspect) →
     Application → Service Workers : l'état est `activated`, les caches portent
     la nouvelle `VERSION` et l'ancien cache a disparu.
7. **Rejet** : tant que l'utilisateur ne clique pas, l'ancienne version continue
   de fonctionner normalement — aucun blocage, aucun purge, aucune session
   interrompue. Onglet ignoré = ancienne version, sans effet sur les autres.

---

## 6. Résultats des tests et limites

### Réalisés

| Test | Résultat |
| --- | --- |
| Build de production (`npm run build`) | ✅ exit 0, artefacts dans `dist/` |
| Suite complète (`bun test`) | ✅ **329 pass, 2 skip, 0 fail** (182 953 assertions) |
| Tests PWA dédiés (`tests/pwa.test.ts`) | ✅ **21 pass** (manifeste JSON, existence/chargement des icônes, règles statiques SW, câblage update, i18n 12 langues) |
| Typecheck (`tsc -b`) | ✅ 0 erreur |
| Lint des fichiers touchés | ✅ 0 problème |
| Manifeste servi | ✅ HTTP 200, `Content-Type: application/manifest+json` |
| Icônes servies | ✅ 200, `image/png` (192/512/maskable/180) |
| SW servi | ✅ 200, `text/javascript` (condition d'installation) |
| **Montage initial** (navigateur réel, `vite preview` sur build de prod) | ✅ SW `activated`, page contrôlée, **`navigation.type = "navigate"` stable sur 10 s** → aucun rechargement parasite au premier `clients.claim()` |
| **Détection de nouvelle version** (déploiement simulé en éditant `dist/sw.js`) | ✅ remplaçant `waiting`/`installed`, ancien toujours contrôleur, bandeau affiché en état « Mettre à jour » (pas « en cours ») |
| **Application de la mise à jour** (clic sur le bandeau) | ✅ `SKIP_WAITING` → activation → purge des anciens caches → **exactement un rechargement** (`navigation.type = "reload"`, marqueur de document réinitialisé) → bandeau disparaît → seuls les caches de la nouvelle `VERSION` subsistent → 10 assets du nouveau bundle chargés (pas d'écran blanc) |
| **Rafraîchissement de route profonde** (`/auth` avec SW contrôleur) | ✅ rendu correct, pas de 404 |
| Données sensibles dans le bundle public | ✅ `sourcemap: false` ; les variables Convex publiques (`VITE_CONVEX_URL`) sont par conception publiques ; aucun secret dans `dist/` |

### Limites — ce qui n'a PAS été validé

- **Aucun iPhone ni Android physique n'est disponible** : l'installation mobile
  réelle (partage iOS, pose d'icône Android, rendu de l'icône en conditions réelles,
  comportement hors ligne du système) **n'a pas été testée** — validation par
  analyse statique + navigateur de bureau uniquement.
- Le cycle de mise à jour a été validé sur **`vite preview` (localhost)** ;
  le comportement sur l'URL de production Vercel (CDN, en-têtes, propagation)
  reste à confirmer après déploiement.
- La vérification « iOS/Safari » (bfcache, relances du SW par le système) est
  théorique ici : seule la spec et les tests statiques la couvrent.
- 2 tests de la suite sont `skip` (préexistants, hors périmètre PWA).

### Limites PWA vs. application native (à connaître)

- Pas d'accès complet appareil : notifications riches limitées (iOS : seulement
  depuis l'app ouverte, sans notifications localisées/programmées comme natif),
  pas de widget, pas de raccourcis Siri avancés, pas de partage système complet.
- iOS peut **mettre en veille profonde** le SW après ~2 semaines d'inutilisation :
  au prochain lancement, l'app se réenregistre et se met à jour normalement.
- Pas de publication sur les stores (sauf TWA sur Android via un wrapper, hors périmètre).
- Le quota de cache et la stratégie restent gérés par le navigateur ; hors ligne,
  seuls la coquille, les assets déjà vus et les pages déjà visitées sont disponibles
  (les données Convex restent réseau).

---

## 7. Procédure de publication manuelle (après validation)

Aucune publication n'a été faite. Quand le téléphone sera validé (§6), publier **à la main** :

1. **Avant tout** : vérifier `git status` — s'assurer que seuls les fichiers voulus
   sont concernés ; **ne pas** committer les artefacts non voulus
   (`dist/`, `scripts/tmp-*`, `*probe*`… sont à exclure ou à nettoyer selon vos règles ;
   rien n'a été supprimé pendant la mission).
2. Relancer la validation : `npx bun test` + `npx tsc -b` + `npm run build`.
3. **Fixer la version** : dans `public/sw.js`, changer `VERSION`
   (ex. `v1-2026-10-24` → `v1-2026-10-25`) : c'est **ce qui déclenche la purge**
   des anciens caches à la prochaine activation.
4. Commit des fichiers de la §2 + pull/push (ou `vercel --prod` selon votre flux) —
   **déploiement manuel uniquement, jamais automatique**.
5. Vérifier sur l'URL de production : manifeste 200 + bon content-type, `sw.js` 200,
   ancienne `VERSION` absente des caches après application du bandeau.
6. Le clone de test `impartial-pony-692` et le backend actif `formal-vulture-518`
   ne sont pas concernés : aucun changement d'environnement, aucun secret touché,
   aucun semis, aucune table distante modifiée.
