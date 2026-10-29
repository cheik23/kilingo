# RAPPORT P0.3.11 — Tests automatiques après déploiement Preview

| | |
|---|---|
| Date | 29/10/2026 |
| Dépôt | `cheik23/kilingo` (public, branche par défaut `main`) |
| Branche locale | `work/p034-shadow-privacy` |
| Commit de référence | `5c6a2ad725f80a29cfb8d65fbded58c1a52b4499` |
| Preview de référence | `https://kilingo-50xuh7gpo-g-c35c.vercel.app` |
| Backend Preview | `neat-wombat-556.convex.cloud` |
| Statut | **Infrastructure livrée et testée localement — workflow NON activé** |

## 1. Résumé exécutif

Le workflow `.github/workflows/preview-e2e.yml` est écrit, parsé et couvert
par 21 tests d'invariants. Il ne peut pas encore s'exécuter sur GitHub :
rien n'a été poussé (interdiction explicite), `gh` n'est pas installé, aucun
secret CI n'existe, et le commit déployé de référence précède les scripts
de test.

**Aucun événement `deployment_status` réel n'a déclenché ce workflow.** La
recette navigateur de parcours réel reste donc non exécutée, comme en
P0.3.10.

## 2. Fichiers

### Ajoutés

| Fichier | Rôle |
|---|---|
| `.github/workflows/preview-e2e.yml` | workflow `deployment_status` (API + navigateur) |
| `scripts/preview/preview-hosts.mjs` | liste blanche **unique** des cibles Preview |
| `scripts/preview/guard-deployment.mjs` | garde-fou CLI avant la moindre requête |
| `scripts/preview/summary.mjs` | résumé GitHub Actions, comptages séparés |
| `tests/previewHosts.test.ts` | 10 tests : liste blanche + refus du garde-fou (codes de sortie réels) |
| `tests/previewWorkflow.test.ts` | 11 tests : invariants lus dans le YAML |
| `docs/ci-preview-e2e.md` | déclenchement, secrets, activation, limites |
| `RAPPORT-P0.3.11.md` | ce rapport |

### Modifiés

| Fichier | Changement |
|---|---|
| `scripts/verify-preview.mjs` | utilise la liste blanche partagée ; `PREVIEW_CI=1` autorise l'hôte du déploiement |
| `tests/e2e-preview/target.ts` | idem, même règle, même message d'erreur |
| `playwright.preview.config.ts` | `testMatch: **/*.e2e.ts`, rapport JSON seulement si `PREVIEW_E2E_JSON_OUT`, `forbidOnly` en CI |
| `tests/e2e-preview/guard.spec.ts` → `guard.e2e.ts` | renommé |
| `tests/e2e-preview/preview.spec.ts` → `preview.e2e.ts` | renommé |
| `docs/recette-preview-e2e.md` | noms de specs à jour |
| `RAPPORT-P0.3.10.md` | noms de fichiers à jour (résultats inchangés) |

`package.json`, `bun.lock` et `.gitignore` n'ont **pas** été retouchés dans
cette passe : ils portent déjà les changements P0.3.10.

## 3. Condition exacte de déclenchement

```yaml
on:
  deployment_status:
```

```yaml
if: >-
  github.event.deployment_status.state == 'success' &&
  startsWith(github.event.deployment_status.environment, 'Preview') &&
  github.event.deployment.environment != 'Production' &&
  github.event.deployment_status.environment != 'Production'
```

Aucun `pull_request`, `pull_request_target`, `push` ni `workflow_dispatch` :
un fork ou une branche arbitraire ne peut pas déclencher les tests.

## 4. Filtres réels (constatés sur l'API GitHub, pas supposés)

| Filtre | Implémentation | Preuve |
|---|---|---|
| Branche | `git merge-base --is-ancestor <sha> origin/work/p034-shadow-privacy` **et** commit absent de `origin/main` | `deployment.ref` = SHA sur 40/40 déploiements : un filtre par nom de branche n'aurait jamais matché |
| Statut | `state == 'success'` | indispensable : Vercel émet aussi `pending`/`failure` |
| Environnement | `Preview` (job) + garde-fou qui refuse tout autre libellé | statuts observés : `Preview` et `Production` |
| URL | HTTPS, sans identifiants, hôte `^kilingo-[a-z0-9]{7,16}-g-c35c\.vercel\.app$` ou alias de branche figé | `environment_url` observé = `https://kilingo-50xuh7gpo-g-c35c.vercel.app` |
| Production | liste noire explicite (`kilingo-ten`, `kilingo.app`, backends `formal-vulture-518` / `impartial-pony-692`) **et** environnement | un déploiement Production expose `https://kilingo-58irr8olm-g-c35c.vercel.app` : l'hôte seul ne suffit pas |
| Commit | checkout de `deployment.sha`, pas de la tête de branche | conforme à la demande |

## 5. Commandes exécutées par le workflow

```bash
node scripts/preview/guard-deployment.mjs
bun install --frozen-lockfile
bunx playwright install --with-deps chromium
bun run verify:preview -- --api-only --json "$RUNNER_TEMP/api.json"
bun run test:e2e:preview
node scripts/preview/summary.mjs
```

Un seul worker Playwright (déjà dans la config), aucune trace/capture/vidéo,
aucun artefact publié.

## 6. Validations réellement effectuées

| Validation | Résultat |
|---|---|
| API GitHub : 40 déploiements, refs, environnements, URLs | `deployment.ref` = SHA ; Preview et Production partagent la forme d'hôte |
| Garde-fou, événement Preview réel | **exit 0**, sorties `base_url`/`host`/`sha`/`environment` correctes |
| Garde-fou, Production | **exit 2**, aucune sortie écrite |
| Garde-fou, URL Production étiquetée Preview | **exit 2** |
| Garde-fou, hôte inconnu / HTTP / statut `failure` / SHA invalide / mauvais événement | **exit 2** à chaque fois |
| Logique de branche | `5c6a2ad` → `on_branch=true` ; `6693e6a` (tête de `main`) → `on_branch=false` |
| Recette API sur la Preview réelle | **4 PASS · 0 FAIL · 7 SKIP**, exit **3** (bloquée : pas de compte de test) |
| Recette API avec URL Production | **exit 2**, 0 PASS, aucune requête |
| Playwright | **4 réussis · 0 échoué · 1 ignoré** (scénario principal ignoré faute de bypass) |
| Résumé, 3 scénarios simulés (bloqué / partiel / hors branche) | Markdown correct, ignorés jamais comptés comme réussis |
| YAML | parsé par `Bun.YAML` **et** `js-yaml` ; 11 assertions de structure |
| ESLint (fichiers touchés) | 0 erreur |
| Typecheck | exit 0 |
| Build | exit 0 |
| Suite complète `bun test` | **579 réussis · 2 ignorés · 0 échec** (dont 21 nouveaux) |

## 7. Chiffres des recettes

| Recette | Réussis | Échoués | Ignorés | Bloqués |
|---|---|---|---|---|
| API `--api-only` | **4** | **0** | **7** | étape (code 3) |
| Navigateur (garde-fous) | **4** | **0** | **0** | — |
| Navigateur (parcours réel) | **0** | **0** | **1** | bypass absent |
| Suite unitaire du dépôt | 579 | 0 | 2 | — |

Les 7 SKIP API et le SKIP navigateur ne sont **pas** comptés comme succès :
le résumé les liste explicitement.

## 8. Secrets

| Secret | Présence locale | Présence GitHub |
|---|---|---|
| `VERCEL_AUTOMATION_BYPASS_SECRET` | absent | inconnue (non vérifiable sans `gh`/jeton) |
| `PREVIEW_TEST_EMAIL` | absent | inconnue |
| `MAILTM_ADDRESS` | absent | inconnue |
| `MAILTM_PASSWORD` | absent | inconnue |

`.env.preview.e2e.local` **n'existe pas** sur cette machine et est ignoré par
Git (`.gitignore:5`, vérifié par `git check-ignore`). Aucune valeur n'a été
lue, affichée ou transmise.

Comportement sans secrets : l'étape navigateur écrit `BLOQUÉE`, sort en
erreur 1 et le résumé l'affiche comme bloquée — jamais comme un succès.

## 9. Conditions d'activation (non réalisées)

1. Committer puis pousser les fichiers P0.3.9 → P0.3.11 sur
   `work/p034-shadow-privacy`. **Le commit `5c6a2ad` déployé ne contient ni
   les scripts ni `@playwright/test`** : un run sur cette Preview échouerait
   avant les tests.
2. Créer les 4 secrets dans **Settings → Secrets and variables → Actions**.
3. Vérifier Vercel → Settings → Git → **Deployment Status Events** (les
   statuts observés prouvent qu'il est actif).
4. Si GitHub exige le workflow sur la branche par défaut, merger `main`.
5. Provoquer un nouveau déploiement Preview, puis lire **Actions →
   preview-e2e** et son résumé.

## 10. Modifications distantes encore nécessaires

- push de la branche (aucune autorisation demandée) ;
- éventuel merge vers `main` ;
- création des 4 secrets Actions.

Rien de tout cela n'a été effectué.

## 11. Limites et bugs identifiés

- **Aucune exécution réelle sur GitHub** : `gh` absent, aucune authentification
  API (401 sur `/actions/permissions`), aucun push. Le déclenchement
  `deployment_status` depuis une branche non par défaut reste à confirmer.
- Vercel émet **deux statuts `success`** pour un même déploiement (URLs
  `kilingo-h121fd1fl…` puis `kilingo-50xuh7gpo…`) : la concurrence par SHA
  annule l'exécution précédente.
- **Bug corrigé** : `bun test` ramassait `guard.spec.ts` / `preview.spec.ts`
  (2 erreurs « Playwright Test did not expect… »). Les specs sont renommées
  en `.e2e.ts` et la config Playwright les cible explicitement ; la suite
  complète repasse à 0 échec.
- **Piège évité** : `runner.temp` dans `jobs.<id>.env` serait vide ; il n'est
  utilisé qu'au niveau des étapes (assertion dédiée).
- Le garde-fou ne peut pas distinguer une Preview d'une Production par l'hôte
  seul : c'est l'environnement de l'événement qui tranche, et il est vérifié
  deux fois.

## 12. Confirmations

- Aucun commit, push, merge, déploiement ou publication.
- Aucun changement sur Vercel, Convex Production (`formal-vulture-518`) ou
  `https://kilingo-ten.vercel.app`.
- Aucun secret écrit dans un fichier suivi par Git.
- `freebuff-map` n'a fait l'objet d'aucun accès ni modification de cette
  passe.
- **P0.3.11 n'est pas « activée »** : l'infrastructure est prête, mais aucun
  événement réel ne l'a encore déclenchée.
