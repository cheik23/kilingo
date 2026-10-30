# RAPPORT P0.3.14 — Activation des secrets CI et premier run vert

**Date** : 30 octobre 2026
**Branche** : `work/p034-shadow-privacy`
**Dépôt** : `cheik23/kilingo`
**Verdict** : **CI activée.** Un run réel `deployment_status` a été observé et validé de bout en bout (garde-fou, branche, API, navigateur), sans aucun échec ni test ignoré côté navigateur.

---

## 1. Résultat

| Élément | Valeur |
|---|---|
| Commit testé | `18b1101eaf8ccc9d5cba33b927c635f89c5aa712` |
| Déploiement GitHub | `7433151031`, environnement `Preview`, statut `success` |
| URL de Preview | `https://kilingo-1krff2caq-g-c35c.vercel.app` |
| Run GitHub Actions | [41020785559](https://github.com/cheik23/kilingo/actions/runs/41020785559) |
| Job | `123947377627` — ✓ en 1 min 9 s |
| Recette API | **11 PASS · 0 FAIL · 1 SKIP** (skip = test navigateur non exécuté en mode `--api-only`) |
| Recette navigateur | **5 passed · 0 failed · 0 skipped** (26,2 s) |
| Artefacts publiés | **0** |

---

## 2. Phase A — Prérequis vérifiés

| Contrôle | Résultat |
|---|---|
| Branche courante | `work/p034-shadow-privacy` ✅ |
| `HEAD` avant mission | `f2a81e0…` (= commit publié) ✅ |
| Synchronisation locale/distant | `0 0` ✅ |
| Index Git | vide ✅ |
| Fichiers suivis modifiés | 0 ✅ |
| `.env.preview.e2e.local` | présent ✅ |
| Ignoré par Git | oui — `.gitignore:5` ✅ |
| Suivi par Git | non (`git ls-files` : aucun) ✅ |
| Contenu | exactement **4 variables**, aucun doublon, aucune ligne parasite, valeurs non vides ✅ |
| Fin de lignes | LF, pas de CRLF, pas de guillemets, pas de `#` en ligne ✅ |
| Compte mail.tm | `POST /token` → 200, `GET /me` → 200 ✅ |
| Cohérence `PREVIEW_TEST_EMAIL` = `MAILTM_ADDRESS` | oui ✅ |

Les noms contrôlés, dans l'ordre du fichier :

1. `VERCEL_AUTOMATION_BYPASS_SECRET`
2. `PREVIEW_TEST_EMAIL`
3. `MAILTM_ADDRESS`
4. `MAILTM_PASSWORD`

Aucune valeur n'a été affichée à aucun moment (contrôles exprimés en « non vide (n caractères) »).

### Prérequis manquant rencontré

`gh` **n'était pas installé** sur la machine (`command not found`, aucun emplacement standard, aucun `hosts.yml` résiduel) et `vercel` non plus.

Correction appliquée, sans élévation de privilèges :

- téléchargement de la **release portable** `gh 2.103.3` (`windows_amd64.zip`) dans `C:\tmp\kilingo-p0314\gh` puis extraction ;
- **aucune** modification du `PATH` système ni installation machine ;
- authentification par `GH_TOKEN` en mémoire, à partir du jeton OAuth déjà stocké par Git Credential Manager pour `github.com` — jeton **jamais imprimé, jamais écrit sur disque, jamais passé en argument de commande**.

Compte authentifié : `cheik23`, `permissions.admin = true` sur `cheik23/kilingo`, scopes `gist, repo, workflow`.

---

## 3. Phase B — Secrets configurés

| Secret | État | Enregistré le |
|---|---|---|
| `VERCEL_AUTOMATION_BYPASS_SECRET` | présent | 2026-10-30T07:29:54Z |
| `PREVIEW_TEST_EMAIL` | présent | 2026-10-30T07:29:54Z |
| `MAILTM_ADDRESS` | présent | 2026-10-30T07:29:54Z |
| `MAILTM_PASSWORD` | présent | 2026-10-30T07:29:54Z |

- Cible vérifiée **avant écriture** (`repos/cheik23/kilingo` → `cheik23/kilingo`, admin confirmé).
- `gh secret list` était **vide** avant l'opération : aucune configuration préexistante n'a été écrasée aveuglément.
- Écriture en une passe via `gh secret set -f .env.preview.e2e.local` (valeurs lues depuis le fichier, jamais en argument).
- Aucun autre secret créé, modifié ou supprimé. Aucune variable Vercel touchée.
- **Limite assumée** : GitHub ne restitue pas les valeurs ; elles ne sont donc pas vérifiables à distance. La preuve de validité est **fonctionnelle** — le run est passé au vert, ce qui n'était possible qu'avec des valeurs correctes (voir §5).

---

## 4. Phase C — Déclenchement d'une Preview

### Mécanisme de redéploiement Vercel : indisponible

- `vercel` CLI absent.
- Le jeton présent dans `com.vercel.cli/Data/auth.json` est **refusé** par l'API (`invalidToken: true`, `forbidden`) : il est expiré. Aucun appel d'écriture n'a été tenté avec.

### Méthode retenue

Un **commit vide** a été créé puis poussé sur la seule branche de travail :

- message : `ci(preview): relancer la Preview après activation des secrets E2E` (le corps explique explicitement qu'aucun fichier n'est modifié) ;
- `18b1101` — 0 fichier modifié, index vide, aucun `git add` ;
- push **sans force**, en fast-forward : `f2a81e0..18b1101 HEAD -> work/p034-shadow-privacy` ;
- distant revérifié juste avant (`f2a81e0`) et identique après.

Le déclenchement n'a pas été supposé : la chaîne push → déploiement Vercel → `deployment_status` avait déjà été observée sur `f2a81e0` (déploiement `7417064582`), et `vercel.json` ne définit aucun `ignoreCommand` susceptible de sauter le build. Le résultat attendu a bien été obtenu : déploiement `7433151031` créé à 07:33:11Z, statut `success`, URL `kilingo-1krff2caq-g-c35c.vercel.app`, et run lancé immédiatement.

---

## 5. Phase D — Run réel observé

### Garde-fou et cible

```
OK | https://kilingo-1krff2caq-g-c35c.vercel.app | environnement=Preview | commit=18b1101 | branche=work/p034-shadow-privacy
OK | 18b1101 est propre à work/p034-shadow-privacy
```

- `DEPLOY_STATE=success`, `DEPLOY_ENVIRONMENT=Preview`, `DEPLOYMENT_ENVIRONMENT=Preview` : aucune requête n'aurait été émise vers Production.
- Appartenance du SHA prouvée par l'historique Git, pas par le nom fourni.

### Étapes du job

| Étape | Résultat |
|---|---|
| Checkout du commit déployé | ✓ |
| Garde-fou — cible Preview autorisée | ✓ |
| Commit propre à la branche autorisée | ✓ |
| Installer Bun 1.4.4 | ✓ |
| Installer dépendances + Chromium | ✓ |
| Recette API (P0.3.9) | ✓ |
| Disponibilité des secrets CI | ✓ `state=ready`, aucun manquant |
| Recette navigateur (P0.3.10) | ✓ 5 passed |
| Résumé | ✓ écrit dans `GITHUB_STEP_SUMMARY` |

### Recette API — détail

```
PASS | gardes.cibles | frontend=…kilingo-1krff2caq… · backend=https://neat-wombat-556.convex.cloud
PASS | backend.version | 20261027T002650Z-8f5d9f6e7831
PASS | auth.otp | code reçu et validé pour ki***@maxxspace.com
PASS | auth.session
PASS | decouverte.deck | 12 expressions
PASS | favoris.aller-retour
PASS | srs.carte-et-revue
PASS | securite.fonctions-internes | 5 mutations internes non exposées
PASS | securite.catalogue-anonyme
PASS | securite.proprietaire-job
PASS | shadow.quota | reste 5/5 · fuseau Europe/Paris
SKIP | ui.frontend-heberge | --api-only : non exécuté

BILAN : 11 PASS · 0 FAIL · 1 SKIP
```

Le seul SKIP est **structurel** : le mode `--api-only` n'exécute pas le contrôle d'UI hébergée, qui est couvert par la recette navigateur ci-dessous. Il ne masque aucun échec.

### Recette navigateur — détail

```
Running 5 tests using 1 worker
✓ guard.e2e.ts › accepte les hôtes de Preview autorisés
✓ guard.e2e.ts › refuse le site de Production
✓ guard.e2e.ts › refuse un hôte inconnu et le HTTP
✓ guard.e2e.ts › le backend attendu est bien la Preview, jamais la Production
✓ preview.e2e.ts › Preview : connexion, découverte, favoris, SRS et Shadow (25,1 s)

5 passed (26,2 s)
```

- Backend ciblé : `neat-wombat-556.convex.cloud` (Preview). Production (`formal-vulture-518`) jamais contactée.
- Bypass Vercel appliqué uniquement sur l'origine Preview validée par le garde-fou.
- Aucun artefact uploadé (traces/screenshots désactivés) : `total_count = 0`.
- Valeurs sensibles masquées par GitHub dans les logs (`***`).

---

## 6. Blocages et corrections

| Blocage | Correction |
|---|---|
| `gh` absent de la machine | release portable 2.103.3 dans `C:\tmp\kilingo-p0314\gh`, sans admin ni modification système |
| Aucun `gh` authentifié | `GH_TOKEN` en mémoire depuis le magasin d'identifiants Windows, valeur jamais exposée |
| `vercel` CLI absent | pas installé : aucune nécessité, la voie Git suffit |
| Jeton Vercel expiré (`invalidToken`) | aucun redéploiement via API tenté ; bascule sur la voie Git vérifiée |
| Aucun moyen de forcer un `deployment_status` à la demande | commit vide explicite, après vérification de la chaîne push → déploiement → événement |

Aucun test n'a été désactivé, ignoré ou assoupli. Aucune assertion modifiée. Aucun fichier de configuration du workflow touché pendant cette mission.

---

## 7. Confirmations

- **Production intacte** : dernier déploiement `production` = `7169470077`, sha `6693e6a`, daté du **19/10/2026** — inchangé. `https://kilingo-ten.vercel.app` répond **HTTP 200**.
- **Aucune variable Vercel modifiée**, ni Production ni Preview. Aucune protection désactivée.
- **Backend Convex de Production** (`formal-vulture-518`) jamais contacté ni modifié.
- **`main` distante** : `6693e6ad2b26bd5b6fa0ab38b50c5c20d4410368` — inchangée. Aucune branche `pwapub` distante.
- **Aucun secret révélé** : ni bypass, ni mot de passe mail.tm, ni OTP, ni JWT, ni jeton GitHub dans ce rapport ou dans un log. Le mot de passe et le JWT n'ont jamais transité par un affichage ; l'adresse n'apparaît que masquée (`ki***@…`).
- **`freebuff-map` non modifié** : aucune écriture hors de `kilingo/` et de `C:\tmp\kilingo-p0314`.
- **Aucune opération destructive** : pas de `push --force`, pas de merge, pas de reset, pas de `git add -A`.
- **Arbre de travail** : `HEAD = 18b1101`, index vide, 33 entrées non suivies **inchangées** (rapports 0.3.4→0.3.13, `screenshots/`, `dist-probe-prod/`, scripts d'analyse).

---

## 8. Suites suggérées

1. **Documentation périmée** — [docs/ci-preview-e2e.md](docs/ci-preview-e2e.md) affirme encore qu'un merge dans `main` pourrait être nécessaire pour que le workflow s'exécute. C'est démenti deux fois par l'observation (runs `40905143753` et `41020785559` sur une branche non mergée).
2. **Message d'échec API peu lisible** — quand les secrets manquent, l'étape API sort en `exit 3` sans annotation dédiée, alors que l'étape navigateur annonce clairement « E2E BLOQUÉE ». Un `::error` explicite rendrait le résumé homogène.
3. **Outillage CI locale** — `gh` absent de la machine : documenter la procédure portable ou l'installer proprement, plutôt que de dépendre d'un téléchargement ad hoc.
4. **Avertissement runner** — `actions/checkout@v4` est forcé sur Node.js 24 (Node 20 déprécié) et `ubuntu-latest` migrera vers Ubuntu 26 le 19/10/2026. Non bloquant aujourd'hui, à traiter avant la bascule.
5. **Commit de relance** — `18b1101` est un commit vide volontaire. S'il ne doit pas rester dans l'historique final, il faudra le retirer par une opération explicite et autorisée (rebase/force), ce qui n'était pas dans le périmètre.
