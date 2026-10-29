# Kɪ́LINGO — P0.3.10 : tests navigateur Playwright sur la Preview

**Date :** 29 octobre 2026
**Branche :** `work/p034-shadow-privacy` — commit `5c6a2ad725f80a29cfb8d65fbded58c1a52b4499` (inchangé, aucun commit)
**Verdict :** l'infrastructure Playwright est livrée, les garde-fous sont **exécutés et verts**, mais le scénario navigateur **n'a pas été exécuté** : la Preview est protégée par Vercel Authentication et aucun bypass n'a été fourni. **P0.3.10 n'est donc pas terminée** au sens de la mission. Aucun faux succès n'est compté.

---

## 1. Audit

| Élément | Constat |
|---|---|
| `scripts/verify-preview.mjs` | recette API P0.3.9 opérationnelle (11 PASS) |
| Playwright | **absent** avant cette mission |
| Gestionnaire | `bun` (`bun.lock` canonique ; `package-lock.json` historique non touché) |
| Preview | `https://kilingo-50xuh7gpo-g-c35c.vercel.app` → **302 vers `vercel.com/sso-api`** (protection active) |
| Backend | `neat-wombat-556.convex.cloud` (Preview), Production `formal-vulture-518` interdite |
| Bypass Vercel | **aucun secret disponible** (variable absente, `.env.preview.e2e.local` inexistant) |
| Session | aucun cookie Vercel extractible ; aucun compte de session exporté |
| Git | branche et HEAD conformes, aucun fichier suivi modifié avant travaux |

Playwright n'étant pas installé, la cible étant protégée et le bypass non fourni,
la décision a été prise avec l'utilisateur : **documenter le blocage** plutôt que
de naviguer sans autorisation.

## 2. Fichiers ajoutés / modifiés

| Fichier | Nature |
|---|---|
| `tests/e2e-preview/target.ts` | **nouveau** — résolveur de cible, liste blanche, refus Production, chargement du fichier local ignoré |
| `tests/e2e-preview/fixtures.ts` | **nouveau** — garde-fous réseau, bypass limité à l'origine Preview |
| `tests/e2e-preview/mail.ts` | **nouveau** — lecture OTP mail.tm, jamais journalisée |
| `tests/e2e-preview/guard.e2e.ts` | **nouveau** — 4 tests de garde-fou, sans navigateur (renommé en P0.3.11) |
| `tests/e2e-preview/preview.e2e.ts` | **nouveau** — scénario E2E (auth, découverte, favoris, SRS, Shadow) (renommé en P0.3.11) |
| `playwright.preview.config.ts` | **nouveau** — configuration dédiée Preview, artefacts désactivés |
| `docs/recette-preview-e2e.md` | **nouveau** — prérequis, bypass, commandes, erreurs, limites |
| `package.json` | **modifié** — `@playwright/test` (dev) + `test:e2e:preview` |
| `bun.lock` | **modifié** — résolution Playwright |
| `.gitignore` | **modifié** — `.env.preview.e2e.local`, `test-results/`, `playwright-report/`, `blob-report/` |

Aucun code métier modifié, aucun déploiement, aucun commit.

## 3. Commande de lancement

```bash
bun run test:e2e:preview
# équivalent : bunx playwright test --config=playwright.preview.config.ts
```

Préparation manuelle restante (détaillée dans `docs/recette-preview-e2e.md`) :

1. Vercel → projet `kilingo` → **Settings → Deployment Protection →
   Protection Bypass for Automation** → *Generate* ;
2. enregistrer dans `.env.preview.e2e.local` (ignoré par Git, chargé
   automatiquement) : `VERCEL_AUTOMATION_BYPASS_SECRET`, `PREVIEW_TEST_EMAIL`,
   `MAILTM_ADDRESS`, `MAILTM_PASSWORD` ;
3. relancer la commande.

## 4. Résultats réels

### Navigateur Playwright

| Suite | Résultat |
|---|---|
| `guard.e2e.ts` (4 tests, sans navigateur) | **4 réussis · 0 échoué · 0 ignoré** |
| `preview.e2e.ts` (1 scénario E2E) | **0 réussi · 0 échoué · 1 ignoré** |

Le scénario est ignoré **avant toute navigation protégée**, avec le message
`Bypass Vercel absent : définir VERCEL_AUTOMATION_BYPASS_SECRET`. Aucun
navigateur n'a été lancé contre la Preview ; aucun parcours visuel n'est
déclaré validé.

`bunx playwright test --config=playwright.preview.config.ts --list` confirme
5 tests dans 2 fichiers, et la suite complète s'exécute sans erreur de
compilation (4 passed, 1 skipped).

### Recette API P0.3.9 (rejouée après modifications)

**11 PASS · 0 FAIL · 1 SKIP — exit 0** : garde-fous, `/version`, OTP réel,
session, découverte, favoris, SRS (CAS périmé + session idempotente),
fonctions internes, catalogue anonyme, propriété d'un job média, quota Shadow.

### Tests unitaires, typecheck, build

| Commande | Résultat |
|---|---|
| `bun test tests/srs.test.ts tests/srs.integration.test.ts tests/favorites.test.ts tests/convexSecurity.integration.test.ts` | **136 pass · 0 fail** (589 assertions) |
| `bun run typecheck` | **exit 0** |
| `bun run build` | **exit 0** (54 s) |

## 5. Garde-fous vérifiés

- `resolvePreviewTarget` accepte uniquement les deux hôtes de Preview.
- `https://kilingo-ten.vercel.app` → refus **« cible interdite »** (test exécuté).
- Hôte inconnu et `http://` → refus (test exécuté).
- `PREVIEW_CONVEX_HOST` vérifié comme `neat-wombat-556.convex.cloud`, jamais la
  Production.
- Dans le navigateur, toute requête vers `formal-vulture-518`,
  `impartial-pony-692` ou un autre backend Convex est **abandonnée** et
  enregistrée comme violation.
- Le bypass (quand il existera) n'est injecté que sur `PREVIEW_ORIGIN`, jamais
  sur Convex, un domaine tiers, une URL, ni Production.

## 6. Préparation OTP

Aucune session n'est exportée : chaque exécution refait une connexion OTP
réelle via l'interface, avec le code lu sur la boîte mail.tm. Le code et le JWT
ne sont jamais journalisés ni écrits sur disque. L'adresse de test n'apparaît
que masquée (`ki***@…`).

## 7. Limites et points ouverts

- **Blocage principal :** pas de bypass Vercel → scénario navigateur non
  exécuté ; les sélecteurs et l'injection de bypass sont donc **non validés à
  l'exécution** (ils reprennent les sélecteurs vérifiés manuellement en P0.3.8).
- La protection Vercel n'a pas été désactivée, la Preview n'a pas été rendue
  publique.
- Aucune trace/capture/vidéo activée (risque de fuite de session) ; les
  artefacts sont ignorés par Git.
- Le scénario suppose le libellé français actuel de l'interface.
- Aucun appel payant déclenché.

## 8. Confirmations

- **Aucun déploiement, commit, push, merge ou rebase.**
- **Production Convex (`formal-vulture-518`) et site `kilingo-ten.vercel.app`
  intacts** ; aucune variable Production modifiée.
- **`freebuff-map` non touché.**
- Backend et Preview laissés en place ; aucune donnée existante supprimée.
- `P0.3.10` **non déclarée terminée** : le navigateur réel n'a pas été exécuté.
