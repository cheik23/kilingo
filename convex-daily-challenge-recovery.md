# Nettoyage doublons `dailyChallenges` — exécution post-push

## Ce qui vient d'être déployé

- **Commit** : `d73e0ec` — `fix: rend la requête dailyChallenge résiliente aux doublons et ajoute un script de nettoyage`
- **Push** : `origin/main` mis à jour depuis `6e60cc6` → `d73e0ec`
- **Typecheck** : `npx tsc -b --noEmit` → exit 0
- **Build** : `npm run build` → exit 0

### Changements de code

1. **`src/convex/dailyChallengeStore.ts`** — la fonction `getExisting` ne fait plus `.unique()`.
   - Elle utilise maintenant `.order("desc").take(1)` sur l'index pertinent.
   - Si plusieurs lignes existent pour la même clé, on prend la plus récente.
   - Cas anonyme : on ne retourne une ligne que si `userId == null`.

2. **`src/convex/schema.ts`** — ajout d'un index `by_day_language` sur `(dayKey, payload.language)`.
   - Ne pas en faire un index `unique` ici (la contrainte n'est pas encore supportée par le schéma dans cette version Convex du projet).
   - La prévention des doublons repose donc sur la résilience du code + le script de nettoyage ci-dessous.

3. **`scripts/dedup-daily-challenges.mjs`** — script de nettoyage des doublons existants.
   - Groupe par `(dayKey, language)`.
   - Garde le document le plus récent, supprime les autres.
   - Idempotent : peut être relancé sans risque.

## Comment nettoyer les doublons existants en base de production

Ce script utilise l'API REST Convex directement. Il ne nécessite pas `npx convex` ni d'install supplémentaire.

### 1. Récupérer la clé de déploiement

Ouvrir `.env.production` et copier la valeur de `CONVEX_DEPLOY_KEY`. Exemple (à ne jamais committer) :

```
CONVEX_DEPLOY_KEY=dev:formal-vulture-518|eyJ2MiI6...
```

### 2. Exécuter le script dans un terminal

PowerShell :

```powershell
$env:CONVEX_SITE_URL = "https://formal-vulture-518.convex.cloud"
$env:CONVEX_DEPLOY_KEY = (Get-Content .env.production -Raw).Split("`n")[0].Split("=")[1].Trim()
node scripts/dedup-daily-challenges.mjs
```

cmd.exe :

```cmd
for /f "delims=" %i in (.env.production) do set CONVEX_DEPLOY_KEY=%i
set CONVEX_SITE_URL=https://formal-vulture-518.convex.cloud
node scripts/dedup-daily-challenges.mjs
```

### 3. Interpréter la sortie

Le script affiche :

- `documents avant`
- `documents après`
- `groupes (dayKey, language)`
- `doublons supprimés`
- `lignes conservées (uniques)`

Si `doublons supprimés = 0`, la base est déjà propre.

## Vérification après déploiement

1. Déployer le frontend/build si nécessaire (ex. Vercel, voir `vercel.json`).
2. Ouvrir le dashboard en production.
3. Ouvrir la console du navigateur et confirmer qu'il n'y a plus l'erreur :
   `Uncaught Error: unique() query returned more than one result from table dailyChallenges`
4. Si l'erreur persiste, exécuter le script de nettoyage ci-dessus puis recharger.

## Référence

- Site Convex de production : `https://formal-vulture-518.convex.cloud`
- Dashboard Convex : `https://dashboard.convex.dev/`
