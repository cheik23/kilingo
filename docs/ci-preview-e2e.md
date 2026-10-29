# CI Preview — tests automatiques après chaque déploiement Vercel

Workflow : [`.github/workflows/preview-e2e.yml`](../.github/workflows/preview-e2e.yml)

Il rejoue, sur le déploiement Preview **précis** annoncé par Vercel :

1. le garde-fou de cible ([`scripts/preview/guard-deployment.mjs`](../scripts/preview/guard-deployment.mjs)) ;
2. la recette API P0.3.9 (`bun run verify:preview -- --api-only`) ;
3. la recette navigateur P0.3.10 (`bun run test:e2e:preview`).

## Déclenchement

| Élément | Valeur |
|---|---|
| Événement | `deployment_status` (intégration GitHub de Vercel) |
| Statut | `success` uniquement |
| Environnement | `Preview` (ou `Preview – <projet>`), `Production` exclue deux fois |
| URL testée | `environment_url` de l'événement, sinon `target_url` |
| Branche | commit **propre** à `work/p034-shadow-privacy` : ancêtre de la branche et absent de `main` |
| Commit | `deployment.sha` (checkout exact du commit déployé) |

`deployment.ref` contient un **SHA**, pas un nom de branche : c'est pourquoi
l'appartenance est prouvée par `git merge-base --is-ancestor`, pas par un
filtre d'événement.

Un déploiement **Production** expose lui aussi une URL
`kilingo-<id>-g-c35c.vercel.app` (constaté le 29/10/2026). L'hôte seul ne
prouve donc rien : `environment` est le seul discriminant, et le garde-fou
refuse explicitement tout statut non `Preview`.

## Secrets à configurer

GitHub → dépôt `cheik23/kilingo` → **Settings → Secrets and variables →
Actions → New repository secret** :

| Nom | Rôle |
|---|---|
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Protection Bypass for Automation (Preview uniquement) |
| `PREVIEW_TEST_EMAIL` | compte de test dédié |
| `MAILTM_ADDRESS` | boîte mail.tm du compte de test |
| `MAILTM_PASSWORD` | mot de passe mail.tm |

Sans ces quatre secrets, l'étape navigateur **échoue** avec un statut
`BLOQUÉE` : ce n'est jamais un succès, et le résumé le dit explicitement.
Aucune valeur n'est journalisée ; seuls les **noms** manquants apparaissent.

`.env.preview.e2e.local` reste local : il est ignoré par Git et n'est jamais
transféré vers GitHub.

## Activation (à faire une fois, avec autorisation)

1. **Committer et pousser** les fichiers P0.3.9 → P0.3.11. Le workflow teste
   le commit **déployé** : si les scripts ou la dépendance
   `@playwright/test` n'y sont pas, il échoue avant les tests.
2. Vérifier Vercel → projet `kilingo` → **Settings → Git →
   Deployment Status Events** activé (les statuts observés le 29/10/2026
   montrent qu'il l'est déjà).
3. S'assurer que GitHub exécute bien `deployment_status` depuis cette
   branche. La documentation actuelle ne restreint pas cet événement à la
   branche par défaut, mais des comportements historiques l'ont fait :
   si aucun run n'apparaît après un déploiement, merger d'abord le workflow
   dans `main`.
4. Pousser un commit sur `work/p034-shadow-privacy` pour créer une nouvelle
   Preview, puis ouvrir **Actions → preview-e2e**.

Aucune permission d'écriture n'est demandée : `permissions: contents: read`.

## Lire le résultat

Le résumé du run sépare toujours les deux recettes :

| Statut | Signification |
|---|---|
| ✅ réussie | tous les tests exécutés ont abouti |
| ⚠️ partielle | code 0 mais des scénarios ignorés — **pas** une validation complète |
| ⏸️ bloquée | secrets absents ou Preview inaccessible (code 3) |
| ⛔ refusée | garde-fou : Production, hôte inconnu, HTTP, statut non réussi |
| ❌ échec | au moins un test a échoué |

Un test ignoré n'est jamais compté comme réussi.

## Reproduire localement

```bash
# 1. garde-fou, avec les valeurs d'un déploiement réel
GITHUB_EVENT_NAME=deployment_status \
DEPLOY_STATE=success \
DEPLOY_ENVIRONMENT=Preview \
DEPLOYMENT_ENVIRONMENT=Preview \
DEPLOY_URL=https://kilingo-50xuh7gpo-g-c35c.vercel.app \
DEPLOY_SHA=5c6a2ad725f80a29cfb8d65fbded58c1a52b4499 \
AUTHORIZED_BRANCH=work/p034-shadow-privacy \
GITHUB_OUTPUT=/tmp/guard.out \
node scripts/preview/guard-deployment.mjs

# 2. recette API sur l'hôte validé
PREVIEW_CI=1 \
PREVIEW_BASE_URL=https://kilingo-50xuh7gpo-g-c35c.vercel.app \
bun run verify:preview -- --api-only --json /tmp/api.json

# 3. navigateur (nécessite les 4 variables locales)
bun run test:e2e:preview

# 4. résumé Markdown
PREVIEW_RESULTS_DIR=/tmp PREVIEW_ON_BRANCH=true \
PREVIEW_TARGET_HOST=kilingo-50xuh7gpo-g-c35c.vercel.app \
node scripts/preview/summary.mjs
```

## Limites connues

- Le workflow dépend entièrement des événements Vercel : sans
  `deployment_status`, aucun run n'est créé.
- Vercel peut émettre **plusieurs** statuts `success` pour un même
  déploiement (URLs immuables différentes) : la concurrence par SHA annule
  alors l'exécution précédente.
- Si le déploiement est antérieur au commit des scripts de test, l'étape
  API échoue (« fichier introuvable ») : c'est attendu, pas un bug.
- Aucun artefact (trace, capture, vidéo) n'est publié : ils peuvent contenir
  une session.
- Aucun appel payant n'est déclenché (pas de transcription, pas de YouTube).
