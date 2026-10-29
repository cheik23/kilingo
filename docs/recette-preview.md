# Recette Preview — `bun run verify:preview`

Recette automate de la Preview Convex isolée (P0.3.8 → P0.3.9). Elle rejoue
sans navigateur ce qui avait été validé à la main : garde-fous de destination,
authentification OTP réelle, découverte, favoris, SRS (révision, rejet d'un
`expectedLastReview` périmé, idempotence des sessions), verrouillage des
fonctions internes, propriété des jobs média et quota Shadow.

- Script : `scripts/verify-preview.mjs`
- Commande : `bun run verify:preview` (ou `node scripts/verify-preview.mjs`)
- Dépendances : Node ≥ 20 uniquement (fetch natif), rien à installer.

## Cibles

| | |
|---|---|
| Preview Vercel | `https://kilingo-50xuh7gpo-g-c35c.vercel.app` (alias `kilingo-git-work-p034-shadow-privacy-g-c35c.vercel.app`) |
| Backend Convex Preview | `https://neat-wombat-556.convex.cloud` |
| Production Convex (interdite) | `formal-vulture-518.convex.cloud` |
| Production Vercel (interdite) | `kilingo-ten.vercel.app` |

Le script refuse de démarrer si l'URL frontend n'est pas un hôte de Preview
connu, si le backend n'est pas `neat-wombat-556.convex.cloud`, ou si une cible
interdite est fournie (code de sortie `2`, aucune requête d'écriture).

## Variables

Aucune valeur n'est à committer : tout passe par l'environnement. Les deux
recettes chargent aussi `.env.preview.e2e.local` (ignoré par Git) via
`scripts/preview/load-local-env.mjs` ; les variables déjà exportées restent
prioritaires.

| Variable | Rôle | Obligatoire |
|---|---|---|
| `PREVIEW_BASE_URL` | URL de la Preview | non (défaut ci-dessus) |
| `PREVIEW_CONVEX_URL` | URL du backend Preview | non (défaut ci-dessus) |
| `PREVIEW_TEST_EMAIL` | compte de test pour l'OTP | oui pour les phases authentifiées |
| `MAILTM_API_TOKEN` **ou** `MAILTM_ADDRESS` + `MAILTM_PASSWORD` | boîte de test mail.tm pour lire l'OTP | oui avec `PREVIEW_TEST_EMAIL` |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | bypass Vercel (Protection Bypass for Automation) pour vérifier le frontend hébergé | non |
| `PREVIEW_ALLOW_LOCAL=1` | autorise explicitement `127.0.0.1`/`localhost` | non |

Exemple (les valeurs restent hors du dépôt, p. ex. dans un `.env.preview.local` ignoré) :

```bash
export PREVIEW_TEST_EMAIL="…@…"
export MAILTM_ADDRESS="…@…"
export MAILTM_PASSWORD="…"
bun run verify:preview -- --api-only
```

## Préparation de la boîte de test

1. Créer une adresse jetable sur un service compatible API (mail.tm) :
   `POST https://api.mail.tm/accounts` puis `POST /token`, ou via l'interface.
2. Renseigner `MAILTM_ADDRESS` / `MAILTM_PASSWORD` (ou un `MAILTM_API_TOKEN`).
   `PREVIEW_TEST_EMAIL` doit être **exactement la même adresse** : l'OTP est
   lu dans cette boîte.
3. Le premier passage crée le compte Kɪ́LINGO correspondant sur la Preview : le
   code OTP reçu est saisi automatiquement, aucune intervention manuelle.

**Renouvellement** : rien à renouveler côté compte Kɪ́LINGO (le script
redemande un code à chaque exécution). Si `MAILTM_API_TOKEN` a expiré,
repasser par `MAILTM_ADDRESS`/`MAILTM_PASSWORD`, qui en régénère un.

## Commandes

```bash
# recette backend/frontend complète (échoue en 3 si Vercel SSO bloque la page)
bun run verify:preview

# recette sans navigateur : recommandée en CI tant que le bypass Vercel n'est pas posé
bun run verify:preview -- --api-only

# reçu machine (sans secret) pour archivage local
bun run verify:preview -- --api-only --json /tmp/recette-preview.json

# contrôle partiel assumé : disponibilité + sécurité, sans authentification
bun run verify:preview -- --api-only --no-auth
```

## Étapes et résultats attendus

| Étape | Ce qui est vérifié |
|---|---|
| `gardes.cibles` | hôte frontend et backend autorisés, cibles interdites refusées |
| `backend.version` | `/version` répond sur le backend Preview |
| `auth.otp` | OTP réellement reçu puis validé (le code n'est jamais journalisé) |
| `auth.session` | session utilisable (`users:currentUser`) |
| `decouverte.deck` | `slang:discoveryDeck` renvoie de vraies expressions du Preview |
| `favoris.aller-retour` | ajout, jointure `mySlangFavorites`, retrait — état rendu à l'identique |
| `srs.carte-et-revue` | carte créée, révision (intervalle/statut/XP), refus d'un `expectedLastReview` périmé, session idempotente, carte supprimée |
| `securite.fonctions-internes` | `slang:seed`, `ovAdmin:bootstrapAdmin`, `aiCharacters:seedAiCharacters`, `crossSeed:seedCrossConcepts`, `achievements:seed` non publiques |
| `securite.catalogue-anonyme` | `customizationCatalog:seedCatalog` refuse un client anonyme |
| `securite.proprietaire-job` | job média vide : écriture propriétaire acceptée, écriture d'un autre compte refusée, job supprimé |
| `shadow.quota` | quota Shadow lu depuis le Preview |
| `ui.frontend-heberge` | page + bundle contiennent bien le backend Preview, `/auth` répond, aucune cible interdite |

## Codes de sortie

| Code | Sens |
|---|---|
| `0` | tout est passé |
| `1` | au moins une étape a échoué |
| `2` | garde-fou : cible invalide ou interdite, aucune écriture effectuée |
| `3` | bloqué : Preview protégée par Vercel SSO, ou `PREVIEW_TEST_EMAIL` manquant (sauf `--no-auth`) |

## Erreurs fréquentes

| Symptôme | Diagnostic |
|---|---|
| `FAIL · gardes.cibles` | URL ou backend inattendu : corriger `PREVIEW_BASE_URL` / `PREVIEW_CONVEX_URL` |
| `SKIP · auth.otp · PREVIEW_TEST_EMAIL absent` | variables de boîte manquantes |
| `aucun code OTP reçu dans le délai` | boîte mail.tm inaccessible, mot de passe changé, ou limite d'envoi Convex Auth atteinte (attendre puis relancer) |
| `exit=3` + `Vercel SSO (302)` | protection Vercel active : poser un bypass (ci-dessous) ou lancer `--api-only` |
| `mediaJobs:create` en échec | le compte de test a déjà trop de jobs actifs : supprimer les jobs `e2e-p039-*` restants |

## Protection Vercel (frontend hébergé)

La Preview est derrière **Vercel Authentication**. Pour vérifier la page et son
bundle sans désactiver la protection :

1. Vercel → projet `kilingo` → **Settings → Deployment Protection →
   Protection Bypass for Automation** → *Generate*.
2. Stocker la valeur **hors du dépôt** et l'exporter :
   `export VERCEL_AUTOMATION_BYPASS_SECRET="…"`.
3. Relancer `bun run verify:preview` (sans `--api-only`).

Sans ce secret, l'étape `ui.frontend-heberge` est signalée `SKIP` et la
recette se termine en `3` : c'est un blocage déclaré, jamais un faux succès.

## Limites connues

- Pas de navigateur : la recette ne clique pas dans l'interface. Elle prouve
  que la page servie référence bien le backend Preview, mais pas les parcours
  visuels (deck swipe, karaoké…), couverts par les scripts navigateur
  existants et par les tests d'intégration `bun test`.
- Le compte anonyme créé pour le test de propriété (`securite.proprietaire-job`)
  reste dans la base Preview : un par exécution, sans donnée métier.
- Le compte de test est **dédié** : la recette normalise l'état de l'expression
  témoin (favori et carte SRS) avant de mesurer, et le restaure ensuite. Les
  sessions `recordSession` s'accumulent (une par exécution, clé unique) sans
  jamais doubler l'XP.
- Aucun appel payant n'est déclenché : pas de téléchargement YouTube, pas de
  transcription, pas de traduction.
- La Preview et son backend doivent rester en place ; la recette ne déploie,
  ne seed et ne migre rien.
