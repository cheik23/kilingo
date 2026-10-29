# Kɪ́LINGO — P0.3.9 : recette automatisée de la Preview

**Date :** 29 octobre 2026
**Branche :** `work/p034-shadow-privacy` — commit `5c6a2ad725f80a29cfb8d65fbded58c1a52b4499` (inchangé, aucun commit créé)
**Verdict :** recette automatisée livrée et **exécutée pour de vrai sur la Preview** (`neat-wombat-556`) : **11 PASS · 0 FAIL** en mode `--api-only`. La vérification du frontend hébergé reste **bloquée par la protection Vercel** (SSO) et se termine alors en code `3`, jamais en faux succès.

---

## 1. Audit préalable

| Élément | Constat |
|---|---|
| Tests existants | `bun test` (tests `tests/*.test.ts`, `convex-test`), scripts `scripts/verify-*.mjs` |
| Playwright | **absent** du projet (aucun paquet, aucun navigateur Playwright installé) |
| Verrou | `bun.lock` (+ `package-lock.json` historique) |
| Preview | `https://kilingo-50xuh7gpo-g-c35c.vercel.app`, protégée par Vercel Authentication (302 → `vercel.com/sso-api`) |
| Backend | `https://neat-wombat-556.convex.cloud` (Preview), Production `formal-vulture-518` interdite |
| Config frontend | `VITE_CONVEX_URL` figée au build par Vercel (Preview) |

Playwright n'étant pas installé et la cible étant derrière une authentification Vercel, la recette a été écrite en **Node ≥ 20 sans dépendance** (fetch natif), dans la convention des scripts `verify:*` du dépôt.

## 2. Fichiers modifiés / ajoutés

| Fichier | Nature |
|---|---|
| `scripts/verify-preview.mjs` | **nouveau** — recette complète (garde-fous, OTP, favoris, SRS, sécurité, quota) |
| `docs/recette-preview.md` | **nouveau** — prérequis, variables, commandes, erreurs, limites |
| `package.json` | **modifié** — une ligne : `"verify:preview": "node scripts/verify-preview.mjs"` |

Aucun code métier touché. Aucun commit, push, merge ou déploiement.

## 3. Commande exacte

```bash
# recette backend (CI, sans navigateur) — celle exécutée ci-dessous
PREVIEW_TEST_EMAIL=… MAILTM_ADDRESS=… MAILTM_PASSWORD=… \
  bun run verify:preview -- --api-only

# recette complète (page + bundle) — nécessite le bypass Vercel
VERCEL_AUTOMATION_BYPASS_SECRET=… bun run verify:preview
```

Variables (aucune valeur dans le dépôt) : `PREVIEW_BASE_URL`, `PREVIEW_CONVEX_URL`,
`PREVIEW_TEST_EMAIL`, `MAILTM_API_TOKEN` ou `MAILTM_ADDRESS`/`MAILTM_PASSWORD`,
`VERCEL_AUTOMATION_BYPASS_SECRET`, `PREVIEW_ALLOW_LOCAL=1` (local uniquement).

Sans `PREVIEW_TEST_EMAIL`, la recette se termine en `3` (auth indisponible) ;
`--no-auth` permet un contrôle partiel assumé (disponibilité + sécurité).

## 4. Résultats de l'exécution

### Mode `--api-only` (exécuté le 29/10, rejoué après chaque modification)

| Étape | Résultat |
|---|---|
| `gardes.cibles` | **PASS** — frontend et backend Preview autorisés |
| `backend.version` | **PASS** — `20261027T002650Z-8f5d9f6e7831` |
| `auth.otp` | **PASS** — OTP réellement reçu puis validé (code jamais journalisé) |
| `auth.session` | **PASS** — `users:currentUser` sur le compte de test |
| `decouverte.deck` | **PASS** — 12 expressions réelles, témoin « rizz » |
| `favoris.aller-retour` | **PASS** — ajout, jointure `mySlangFavorites`, retrait |
| `srs.carte-et-revue` | **PASS** — intervalle 2 j, statut `confirming`, XP 5, session dédupliquée |
| `securite.fonctions-internes` | **PASS** — 5 mutations internes non publiques |
| `securite.catalogue-anonyme` | **PASS** — `seedCatalog` refuse un client anonyme |
| `securite.proprietaire-job` | **PASS** — écriture propriétaire acceptée, écriture étrangère refusée |
| `shadow.quota` | **PASS** — reste 5/5, fuseau Europe/Paris |
| `ui.frontend-heberge` | **SKIP** — `--api-only` |

**Bilan : 11 PASS · 0 FAIL · 1 SKIP — code de sortie 0.**

### Mode complet (sans bypass, sans OTP)

`bun run verify:preview` → 4 PASS · 0 FAIL · 7 SKIP, **code de sortie 3** :
`Vercel SSO (302) — définir VERCEL_AUTOMATION_BYPASS_SECRET`. La page et le
bundle ne sont **pas** déclarés vérifiés. Sans `PREVIEW_TEST_EMAIL`, le code
est également `3` avec un motif explicite (sauf `--no-auth`).

### Garde-fous (vérifiés en pratique)

| Cible fournie | Résultat |
|---|---|
| `PREVIEW_BASE_URL=https://kilingo-ten.vercel.app` | refus avant toute requête, **exit 2** |
| `PREVIEW_CONVEX_URL=https://formal-vulture-518.convex.cloud` | refus avant toute requête, **exit 2** |
| hôte inconnu (`PREVIEW_ALLOW_LOCAL` absent) | refus, **exit 2** |

Aucune requête d'écriture n'est émise quand un garde-fou échoue.

## 5. Preuve du backend Preview

- Les garde-fous imposent `neat-wombat-556.convex.cloud` ; toute autre cible est refusée.
- Chaque étape passe par cette URL : `/version`, `/api/action` (OTP), `/api/query`, `/api/mutation`.
- Le témoin de découverte, les favoris et les cartes SRS proviennent du catalogue du Preview (310 expressions EN, données de test).
- Aucune requête vers `formal-vulture-518` ni `impartial-pony-692` (interdites par les garde-fous et absentes de la configuration du script).

## 6. Préparation manuelle restante

| Sujet | Statut |
|---|---|
| OTP | **automatisé** — boîte mail.tm lue par API, aucun code saisi à la main |
| Session de test | **aucun export de session** : le script obtient un JWT en mémoire à chaque exécution et ne l'écrit jamais sur disque |
| Frontend hébergé | **manuel** : générer un *Protection Bypass for Automation* dans Vercel → Settings → Deployment Protection, puis exporter `VERCEL_AUTOMATION_BYPASS_SECRET` (hors dépôt). Sans lui, étape `SKIP` + exit 3 |

## 7. Tests unitaires, typecheck et build

| Commande | Résultat |
|---|---|
| `bun test tests/srs.test.ts tests/srs.integration.test.ts tests/favorites.test.ts tests/convexSecurity.integration.test.ts` | **136 pass · 0 fail** (589 assertions) |
| `bun run typecheck` | **exit 0** |
| `bun run build` | **exit 0** (build Vite 22,6 s) |

## 8. Limites connues

- **Pas de navigateur** : la recette ne clique pas dans l'interface. Elle vérifie
  les mutations et requêtes réellement appelées par l'UI (favoris, SRS, quota),
  et — quand le bypass est fourni — que la page et le bundle hébergés pointent
  bien vers le backend Preview. Les parcours visuels restent couverts par les
  scripts navigateur existants et les tests d'intégration.
- **Protection Vercel** : la page hébergée n'est pas accessible sans bypass ; la
  protection n'a pas été désactivée (interdit par la mission).
- `securite.proprietaire-job` crée un **compte anonyme jetable** par exécution
  (aucune donnée métier) : il reste dans la base Preview.
- Le compte de test est dédié ; la recette normalise puis restaure l'état de
  l'expression témoin. Les sessions `recordSession` s'accumulent sans double XP.
- Limite d'envoi d'OTP côté Convex Auth : des exécutions trop rapprochées
  peuvent être temporisées (attendre puis relancer).
- Aucun appel payant (YouTube, transcription, traduction) n'est déclenché.

## 9. Confirmations

- **Backend Production (`formal-vulture-518`) intact** : aucune écriture, aucun déploiement, aucune fonction appelée par la recette.
- **Site Production (`kilingo-ten.vercel.app`) intact** : aucun déploiement, aucune variable Production modifiée.
- **`freebuff-map` non touché.**
- **Aucun backend Preview supprimé, recréé ou réinitialisé** ; la Preview reste disponible.
- **Aucun commit, push, merge, rebase ou déploiement** ; HEAD = `5c6a2ad`.
- Seuls `package.json` (une ligne de script) et deux nouveaux fichiers sont concernés.
