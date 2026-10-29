# RAPPORT P0.3.13 — audit final avant activation de la CI

Branche : `work/p034-shadow-privacy` · Commit de référence : `5c6a2ad725f80a29cfb8d65fbded58c1a52b4499`
Date d'audit : 29 octobre 2026.

**Aucune opération distante n'a été effectuée** : aucun commit, aucun `git add`, aucun push,
aucun merge, aucun déploiement, aucune modification de Production, aucune écriture sur
`freebuff-map`. L'index Git est vide (`git diff --cached` : rien).

Périmètre audité : l'intégration des missions P0.3.9 (recette API), P0.3.10 (scénario navigateur),
P0.3.11 (workflow `deployment_status` + garde-fous) et P0.3.12 (compte de test et premier E2E réel).

---

## 1. État Git précis

| Élément | Valeur |
|---|---|
| Branche active | `work/p034-shadow-privacy` |
| HEAD | `5c6a2ad725f80a29cfb8d65fbded58c1a52b4499` |
| Upstream | `origin/work/p034-shadow-privacy` |
| Écart avec origin | **0 commit d'avance · 0 de retard** (branche strictement synchrone) |
| Commits locaux non poussés | aucun |
| Remisage (`git stash`) | aucun |
| Index (staged) | vide |
| Arbre de travail | **51 entrées** à l'ouverture de l'audit (52 après création de ce rapport) : 4 fichiers suivis modifiés (`M`) + 47 non suivis (`??`) |
| Dépôt distant | `https://github.com/cheik23/kilingo.git` — **public**, branche par défaut `main` |
| Workflow sur `origin/main` | **absent** |
| Workflow sur `origin/work/p034-shadow-privacy` | absent (normal : non commité) |

Fichiers suivis modifiés (uniquement la chaîne de recette) :

| Fichier | Lignes |
|---|---|
| `.gitignore` | +6 |
| `bun.lock` | +54 / −3 |
| `eslint.config.js` | +6 |
| `package.json` | +3 |

Les quatre modifications sont **strictement** liées aux recettes : exclusion du fichier local
et des artefacts Playwright, dérogation ESLint pour les fixtures Playwright, scripts
`verify:preview` / `test:e2e:preview`, dépendance `@playwright/test` (et son verrouillage dans
`bun.lock`).

Fichiers de P0.3.9 → P0.3.12 présents dans le dépôt : **tous présents, tous non suivis**
(`.github/workflows/preview-e2e.yml`, `playwright.preview.config.ts`, `scripts/preview/*`,
`scripts/verify-preview.mjs`, `tests/e2e-preview/*`, `tests/previewHosts.test.ts`,
`tests/previewWorkflow.test.ts`, `docs/ci-preview-e2e.md`, `docs/recette-preview*.md`,
`RAPPORT-P0.3.9.md` → `RAPPORT-P0.3.12.md`). Aucun n'est partiellement indexé.

**Le workflow figure bien dans le diff qui serait publié** (fichier nouveau, 233 lignes).

---

## 2. Diff qui serait publié

Base : `5c6a2ad` · branche de destination : `work/p034-shadow-privacy` · 26 fichiers,
≈ 3 400 lignes ajoutées.

### Nouveaux fichiers (21 + ce rapport)

| Fichier | Lignes | Mission |
|---|---|---|
| `.github/workflows/preview-e2e.yml` | 233 | P0.3.11 |
| `playwright.preview.config.ts` | 41 | P0.3.10 |
| `scripts/preview/guard-deployment.mjs` | 123 | P0.3.11 |
| `scripts/preview/load-local-env.mjs` | 24 | P0.3.9 |
| `scripts/preview/preview-hosts.mjs` | 141 | P0.3.9/10/11 |
| `scripts/preview/summary.mjs` | 244 | P0.3.11 |
| `scripts/verify-preview.mjs` | 646 | P0.3.9 |
| `tests/e2e-preview/fixtures.ts` | 115 | P0.3.10/12 |
| `tests/e2e-preview/guard.e2e.ts` | 38 | P0.3.10 |
| `tests/e2e-preview/mail.ts` | 89 | P0.3.10/12 |
| `tests/e2e-preview/preview.e2e.ts` | 302 | P0.3.10/12 |
| `tests/e2e-preview/target.ts` | 61 | P0.3.10 |
| `tests/previewHosts.test.ts` | 161 | P0.3.11 |
| `tests/previewWorkflow.test.ts` | 153 | P0.3.11 |
| `docs/ci-preview-e2e.md` | 121 | P0.3.11 |
| `docs/recette-preview-e2e.md` | 113 | P0.3.10 |
| `docs/recette-preview.md` | 146 | P0.3.9 |
| `RAPPORT-P0.3.9.md` | 135 | P0.3.9 |
| `RAPPORT-P0.3.10.md` | 130 | P0.3.10 |
| `RAPPORT-P0.3.11.md` | 194 | P0.3.11 |
| `RAPPORT-P0.3.12.md` | 123 | P0.3.12 |

### Modifications suivies

`.gitignore` (+6), `bun.lock` (+54/−3), `eslint.config.js` (+6), `package.json` (+3).

---

## 3. Vérification des secrets et des artefacts

Méthode : script d'audit exécuté **hors du dépôt** (`C:/tmp/kilingo-p0313/scan.mjs`), qui lit les
valeurs du fichier local et les recherche dans les fichiers candidats. Il n'affiche jamais une
valeur — uniquement `fichier :: catégorie`.

| Contrôle | Résultat |
|---|---|
| `.env.preview.e2e.local` ignoré par Git | **oui** (règle `.gitignore:5`) |
| `.env.preview.e2e.local` indexé | **non** |
| Clés présentes dans le fichier local | 4/4 : `VERCEL_AUTOMATION_BYPASS_SECRET`, `PREVIEW_TEST_EMAIL`, `MAILTM_ADDRESS`, `MAILTM_PASSWORD` |
| Valeurs secrètes trouvées dans les 25 fichiers candidats | **0** |
| Valeurs secrètes trouvées dans les **589 fichiers suivis** du dépôt | **0** |
| Motifs structurels dans les candidats | 1 faux positif (`docs/recette-preview-e2e.md` : gabarit `…@…`) |
| Motifs structurels dans tout le dépôt | 2, analysés et écartés (voir ci-dessous) |
| Dossiers d'artefacts Playwright (`test-results/`, `playwright-report/`, `blob-report/`) | existants → **ignorés** ; `test-results/` ne contient que `.last-run.json` |
| Traces / vidéos / captures de session publiables | **aucune** (config : `trace/screenshot/video: off`, rapport JSON uniquement si `PREVIEW_E2E_JSON_OUT`) |
| Journaux de recette (E2E + API) scannés | **0 valeur secrète**, 0 motif suspect |
| Journaux ou rapports contenant l'adresse ou le mot de passe | **aucun** (l'adresse n'apparaît que masquée : `ki***@…`) |

Motifs structurels analysés et écartés :

- `scripts/dedup-daily-challenges.mjs` (`CONVEX_DEPLOY_KEY`) : prose et commandes d'usage,
  aucune valeur ; fichier **non modifié** par cette mission.
- `tests/convexSecurity.integration.test.ts` (motif JWT) : jeton d'exemple public de jwt.io
  (`sub: 1234567890`), utilisé pour vérifier le masquage des secrets dans les journaux ;
  fichier **non modifié** par cette mission.

Conclusion : **aucune fuite de secret détectée**. Si un secret apparaissait dans le diff, la
préparation devrait s'arrêter ; ce n'est pas le cas.

---

## 4. Tests réellement exécutés

Tous les résultats ci-dessous proviennent de commandes lancées pendant cet audit, avec code de
sortie conservé (`PIPESTATUS` / `pipefail`).

| Recette | Commande | Résultat | Code |
|---|---|---|---|
| Navigateur | `bun run test:e2e:preview` | **5 réussis · 0 échoué · 0 ignoré** (44,3 s) | 0 |
| Navigateur (2ᵉ passage, journalisé) | `bun run test:e2e:preview` | **5 réussis · 0 échoué · 0 ignoré** (43,7 s) | 0 |
| API | `bun run verify:preview -- --api-only` | **11 PASS · 0 FAIL · 1 SKIP** | 0 |
| API (2ᵉ passage, journalisé) | `bun run verify:preview -- --api-only` | **11 PASS · 0 FAIL · 1 SKIP** | 0 |
| Tests ciblés CI | `bun test tests/previewWorkflow.test.ts tests/previewHosts.test.ts` | **21 réussis · 0 échoué** | 0 |
| Suite unitaire | `bun test` | **578 réussis · 2 ignorés · 0 échoué** (580 tests, 34 fichiers) | 0 |
| Typecheck | `bun run typecheck` | aucune erreur | 0 |
| Build | `bun run build` | construit en 57,6 s | 0 |
| Installation CI | `bun install --frozen-lockfile` | aucune modification, **`bun.lock` inchangé** | 0 |
| Lint | `bun run lint` | **289 erreurs préexistantes** (voir §5) | 1 |

Le seul SKIP de la recette API est `ui.frontend-heberge`, explicitement écarté par `--api-only` :
il est **compté comme ignoré**, jamais comme réussi.

Le scénario navigateur a réellement exercé : ouverture de la Preview protégée, vérification que
le seul backend contacté est `neat-wombat-556.convex.cloud`, inscription et connexion avec un
**OTP effectivement reçu** sur la boîte mail.tm, découverte et ajout/retrait d'un favori, révision
SRS avec **idempotence de l'XP**, chargement de Shadow et lecture du quota.

### Garde-fou du workflow, exercé aussi hors CI

| Simulation | Résultat | Code |
|---|---|---|
| Événement Preview réussie | `OK | … | environnement=Preview | commit=5c6a2ad` | 0 |
| Événement Production | `REFUS | environnement « Production » : seule une Preview est autorisée` | 2 |
| Ancestralité du commit | ancêtre de `origin/work/p034-shadow-privacy`, **absent de `main`** | — |

Analyse YAML : déclencheurs = `["deployment_status"]` uniquement · `permissions = {contents: read}` ·
9 étapes (checkout, guard, branch, bun, deps, api, secrets, e2e, résumé).

### Revue du workflow (Phase C)

| Exigence | État | Preuve |
|---|---|---|
| Déclenchement sur une vraie Preview autorisée | ✅ | `if` du job : statut `success` + environnement `Preview*` + `deployment.environment != 'Production'` |
| Association SHA déployé / branche / environnement | ✅ | checkout de `deployment.sha`, `git merge-base --is-ancestor` vers `work/p034-shadow-privacy`, refus si le commit est déjà sur `main` |
| Refus Production / hôtes inconnus avant toute requête | ✅ | `guard-deployment.mjs`, sortie **2** sans requête ; liste blanche partagée |
| Permissions minimales | ✅ | `contents: read` seul, `persist-credentials: false` |
| Aucun bypass envoyé à un tiers | ✅ | en-tête posé **uniquement** si `url.origin === PREVIEW_ORIGIN` (fixtures) et sur l'origine validée (recette API) ; le workflow ne contient aucune trace de l'en-tête |
| Aucun secret dans un `run:` ou une URL | ✅ | test `previewWorkflow.test.ts` : chaque ligne contenant `secrets.` doit être un simple `NOM: ${{ secrets.NOM }}` |
| Pas d'exécution privilégiée depuis un fork | ✅ (avec réserve §Risques R2) | aucun déclencheur `pull_request` / `pull_request_target` ; secrets injectés **après** la porte de branche |
| Réussis / échoués / ignorés / bloqués distingués | ✅ | `scripts/preview/summary.mjs` : « ✅ réussie », « ⚠️ partielle (scénarios ignorés) », « ⏸️ bloquée », « ⛔ refusée », « ❌ échec » ; un test ignoré n'est jamais un succès |
| Ne déploie rien, ne publie aucun artefact | ✅ | test : aucun `vercel deploy`, `convex deploy`, `git push`, `upload-artifact` |
| Scripts et dépendances disponibles dans le commit testé | ✅ localement | `bun.lock` gelé, `@playwright/test` 1.64.1 installé, `bunx playwright --version` OK |

**La CI n'est pas « activée »** : aucun événement `deployment_status` réel ne l'a encore déclenchée.
Seul le déclencheur peut le prouver.

---

## 5. Blocages et points non conformes

| # | Point | Nature | Impact |
|---|---|---|---|
| 1 | `bun run lint` échoue : 289 erreurs | **préexistant** | Aucun. Les 25 fichiers candidats produisent **0** problème ; 283 erreurs viennent de fichiers suivis non modifiés (`LevelUp3D.tsx`, `LootChest3D.tsx`, `ShadowView.tsx`, `lemonsqueezy.ts`, `i18n.tsx`…), 6 de fichiers non suivis hors publication (`classify-es.mjs`, `scripts/tmp-audit-*.ts`, `verify-display-context.mjs`…). Le lint n'est pas exécuté par le workflow. |
| 2 | Aucune garantie documentée que `deployment_status` déclenche un workflow absent de la branche par défaut | **incertitude externe** | Si aucun run n'apparaît au premier push, il faudra merger le workflow dans `main` (autorisation explicite requise) — voir §7. |
| 3 | `screenshots/` et `dist-probe-prod/` ne sont pas ignorés | risque hygiène | Un `git add -A` embarquerait 28 Mo de WASM et des captures. **Ne jamais utiliser `git add -A`** : les commandes du §7 listent les chemins un par un. |
| 4 | `ui.frontend-heberge` non exécuté | attendu | Écarté par `--api-only` en local et en CI ; il est compté « ignoré ». |
| 5 | Aucun blocage réel | — | La Preview de référence répond, la boîte de test fonctionne, les 4 secrets locaux sont présents. |

---

## 6. Secrets CI restant à configurer (noms uniquement)

GitHub → dépôt `cheik23/kilingo` → **Settings → Secrets and variables → Actions** :

| Nom | Rôle | Obligatoire |
|---|---|---|
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Protection Bypass for Automation (Preview) | oui |
| `PREVIEW_TEST_EMAIL` | adresse du compte de test | oui |
| `MAILTM_ADDRESS` | boîte mail.tm | oui |
| `MAILTM_PASSWORD` | mot de passe mail.tm | oui |
| `MAILTM_API_TOKEN` | jeton mail.tm (alternative aux identifiants) | facultatif |

Sans les quatre premiers, l'étape navigateur **échoue** avec un statut « BLOCKED » : jamais un
succès silencieux. Aucune valeur n'est journalisée, seuls les **noms** manquants apparaissent.
Les valeurs ne doivent pas transiter par le chat : elles se posent directement dans l'interface
GitHub ou via `gh secret set <NOM>`.

---

## 7. Plan de publication recommandé

**Recommandation : un commit unique**, pour que l'arbre soit cohérent à chaque commit (le test
`previewWorkflow.test.ts` lit le YAML du workflow : un découpage en plusieurs commits créerait des
commits intermédiaires rouges).

1. **Base** : `5c6a2ad` (HEAD actuel = `origin/work/p034-shadow-privacy`).
2. **Destination** : `work/p034-shadow-privacy` (même branche, pas de merge dans `main`).
3. **Indexation explicite** (jamais `git add -A`) :
   ```bash
   git add -- .gitignore bun.lock eslint.config.js package.json \
     .github/workflows/preview-e2e.yml playwright.preview.config.ts \
     scripts/preview/guard-deployment.mjs scripts/preview/load-local-env.mjs \
     scripts/preview/preview-hosts.mjs scripts/preview/summary.mjs scripts/verify-preview.mjs \
     tests/e2e-preview/fixtures.ts tests/e2e-preview/guard.e2e.ts tests/e2e-preview/mail.ts \
     tests/e2e-preview/preview.e2e.ts tests/e2e-preview/target.ts \
     tests/previewHosts.test.ts tests/previewWorkflow.test.ts \
     docs/ci-preview-e2e.md docs/recette-preview-e2e.md docs/recette-preview.md \
     RAPPORT-P0.3.9.md RAPPORT-P0.3.10.md RAPPORT-P0.3.11.md RAPPORT-P0.3.12.md \
     RAPPORT-P0.3.13.md
   git diff --cached --stat   # doit lister exactement 26 fichiers
   ```
4. **Commit** :
   ```bash
   git commit -m "test(preview): recette API + navigateur authentifiée et workflow CI post-déploiement"
   ```
5. **Publication** (après autorisation) :
   ```bash
   git push origin work/p034-shadow-privacy
   ```
6. **Premier run réel** :
   - le push déclenche un nouveau déploiement Preview Vercel de la branche ;
   - attendre le statut `success`, puis **Actions → preview-e2e** ;
   - contrôler : étape `guard` → `OK | https://kilingo-<id>-g-c35c.vercel.app | environnement=Preview` ;
     étape `branch` → `OK | <sha>:7 est propre à work/p034-shadow-privacy` ;
     résumé → API « ✅ réussie » (12 contrôles) et navigateur « ✅ réussie » (5 tests) ;
   - un run **vert** ne suffit pas : vérifier que le nombre de tests exécutés est non nul et que
     « ignorés » vaut 0.
7. **Si aucun run n'apparaît** (5–10 min) : vérifier Vercel → *Deployment Status Events* activé,
   puis GitHub → Actions activé sur le dépôt. Si ces deux points sont OK et qu'aucun run ne
   démarre, l'hypothèse restante est l'exigence non documentée de la branche par défaut :
   il faudra **merger le workflow dans `main`** — décision à prendre explicitement, elle sort du
   périmètre de cette mission.

### Modifications locales à conserver hors publication (26 entrées)

Rapports antérieurs `RAPPORT-P0.3.4.md` → `RAPPORT-P0.3.8.md` · scripts d'analyse ponctuels
(`candidate-analysis.mjs`, `classify-es*.mjs`, `count-hi.mjs`, `debug-*.mjs`, `tmp-dedup*.mjs`,
`tmp-simple.mjs`, `verify-display-context.mjs`, `verify-hi-classif.mjs`, `summary-candidates.md`,
`scripts/tmp-audit-*.ts`, `scripts/tmp-recon*.mjs`, `scripts/tmp-recon-report.json`,
`scripts/seed-dry-run-report.json`) · sondes TTS (`tts-probe.html`, `tts-probe.vite.config.ts`) ·
artefacts de build de sonde (`dist-probe-prod/`) · captures (`screenshots/`) · fixture audio non
référencée (`tests/fixtures/tone-440.mp3`) · fichier accidentel `h origin main`.

### Risques identifiés

- **R1 — Déclenchement** : comportement non garanti pour un workflow absent de la branche par
  défaut (voir §5.2). Mitigation : observation du premier run, repli documenté.
- **R2 — Code non fiable exécuté avant la porte de branche** : `guard-deployment.mjs` est un script
  du commit déployé, exécuté avant la vérification d'ancestralité. À cet instant l'étape n'a
  **aucun secret** dans son environnement, le jeton Git n'est pas persisté et les permissions sont
  en lecture seule : la portée d'une exécution hostile se limite au runner éphémère. Risque
  résiduel faible, à garder en tête si le workflow gagne des permissions d'écriture.
- **R3 — Dépôt public** : les quatre secrets restent des secrets de dépôt, jamais des variables
  en clair ; toute rotation du bypass Vercel impose de mettre à jour le secret.
- **R4 — URL de Preview figée** : `kilingo-50xuh7gpo-g-c35c.vercel.app` sert de cible par défaut en
  local (`target.ts`, `verify-preview.mjs`). Si Vercel supprime ce déploiement, les recettes
  locales devront recevoir `PREVIEW_BASE_URL` explicitement. La CI n'est pas concernée.
- **R5 — OTP** : `retries: 0` sur la suite Playwright ; un dépassement de limite d'envoi Convex Auth
  fera échouer le run. Limite connue, documentée, pas corrigée ici.
- **R6 — Lint** : rouge avant et après (289 erreurs préexistantes) ; hors périmètre du workflow.
- **R7 — Hygiène** : `screenshots/` et `dist-probe-prod/` non ignorés (§5.3). Aucune correction
  appliquée : elle ne serait pas nécessaire au bon fonctionnement de la CI.
- **R8 — Observé, non corrigé** : l'étape `api` précède l'étape `secrets`. Avec zéro secret, le job
  échoue dès l'API (code 3) et l'annotation « E2E BLOQUÉE » n'apparaît pas — le résumé reste juste
  (« ⏸️ bloquée » d'un côté, « non exécutée » de l'autre). De même, `summary.mjs` lit
  `AUTHORIZED_BRANCH` sans qu'elle lui soit transmise et retombe sur la constante identique.
  Impact cosmétique uniquement.

---

## 8. Fichiers prêts à publier — autorisation demandée

| # | Chemin | État local |
|---|---|---|
| 1 | `.gitignore` | modifié (+6) |
| 2 | `bun.lock` | modifié (+54/−3) |
| 3 | `eslint.config.js` | modifié (+6) |
| 4 | `package.json` | modifié (+3) |
| 5 | `.github/workflows/preview-e2e.yml` | nouveau |
| 6 | `playwright.preview.config.ts` | nouveau |
| 7 | `scripts/preview/guard-deployment.mjs` | nouveau |
| 8 | `scripts/preview/load-local-env.mjs` | nouveau |
| 9 | `scripts/preview/preview-hosts.mjs` | nouveau |
| 10 | `scripts/preview/summary.mjs` | nouveau |
| 11 | `scripts/verify-preview.mjs` | nouveau |
| 12 | `tests/e2e-preview/fixtures.ts` | nouveau |
| 13 | `tests/e2e-preview/guard.e2e.ts` | nouveau |
| 14 | `tests/e2e-preview/mail.ts` | nouveau |
| 15 | `tests/e2e-preview/preview.e2e.ts` | nouveau |
| 16 | `tests/e2e-preview/target.ts` | nouveau |
| 17 | `tests/previewHosts.test.ts` | nouveau |
| 18 | `tests/previewWorkflow.test.ts` | nouveau |
| 19 | `docs/ci-preview-e2e.md` | nouveau |
| 20 | `docs/recette-preview-e2e.md` | nouveau |
| 21 | `docs/recette-preview.md` | nouveau |
| 22 | `RAPPORT-P0.3.9.md` | nouveau |
| 23 | `RAPPORT-P0.3.10.md` | nouveau |
| 24 | `RAPPORT-P0.3.11.md` | nouveau |
| 25 | `RAPPORT-P0.3.12.md` | nouveau |
| 26 | `RAPPORT-P0.3.13.md` | ce rapport |

**Aucune opération Git distante n'a été effectuée. Autorisation explicite requise** pour :
(a) indexer et commiter ces 26 fichiers sur `work/p034-shadow-privacy` ;
(b) pousser la branche vers `origin`, ce qui créera un nouveau déploiement Preview Vercel et
devrait déclencher le premier run réel du workflow `preview-e2e`.
