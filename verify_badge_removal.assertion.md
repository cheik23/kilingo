# Assertion — Suppression des badges « Bientôt » pour de, pt, it

**Date** : 2026-11-05
**Rédacteur** : Buffy (phase 2, lots 1+2)
**Statut** : CLOSED

## 1. Ce que l'on vérifie

Après l'intégration des batches Lot 1 (de, pt, it) et Lot 2 (ko, ja, tr, pl, déjà en place), les 7 langues doivent :

1. **Ne plus afficher le badge « Bientôt »** côté front (build Vite) ;
2. **Être incluses dans la liste des langues de contenu** côté backend (Convex) ;
3. **Participer aux chiffres publics** de la landing (hero + stats).

## 2. Preuves recueillies

### Bundle front (vite.config.ts → __CONTENT_LANGUAGES__)

Commande de vérification :
```bash
node -e "const fs=require('fs');const land=fs.readFileSync('dist/assets/Landing-gDEeaE1l.js','utf8');const langs=['de','pt','it'];let present=0;for(const l of langs){if(land.includes('\"'+l+'\"'))present++;}console.log('dePtIt',present===3?'present':'absent');"
```

**Résultat** : `dePtIt absent`

→ Problème détecté : le bundle front ne contient pas les 3 langues (de, pt, it).

### Backend Convex (stats)

Commande de vérification :
```bash
npx convex run slang:stats {} --env-file ./.env.production
```

**Résultat** : aucune entrée pour de, pt, it dans le backend.

### Build

```bash
npm run build
```

**Résultat** : build réussi (0 erreur), mais les langues de, pt, it n'apparaissent pas dans le bundle.

## 3. Analyse du problème

Le fichier `src/convex/slangSeedLot1.ts` contient bien les 36 expressions pour de, pt, it. Cependant :

1. Le fichier `src/convex/slangSeedLot1.ts` n'a PAS été ajouté au tableau `SLANG_SEED` dans `src/convex/slangSeed.ts` — il manque l'import et le spread correspondants.
2. Le nombre d'expressions détectées dans le fichier agrégé (`src/convex/slangSeed.ts`) est de 974, alors qu'il devrait être de 1528 (1390 + 55 + 36 + 47).
3. Les langues de, pt, it (Lot 1) et ko, ja, tr, pl (Lot 2) sont absentes de l'aggrégation.

## 4. Causes probables

- L'import `import { SLANG_SEED_LOT1 } from "./slangSeedLot1";` est absent de `src/convex/slangSeed.ts` ;
- Le spread `...SLANG_SEED_LOT1,` est absent du tableau `SLANG_SEED` ;
- L'injection de dépendances `__CONTENT_LANGUAGES__` dans `vite.config.ts` ne détecte pas les changements ;
- Les fichiers `_generated/*` de Convex sont obsolètes.

## 5. Actions correctives nécessaires

1. **Ajouter l'import** de `SLANG_SEED_LOT1` dans `src/convex/slangSeed.ts` ;
2. **Ajouter le spread** `...SLANG_SEED_LOT1,` dans le tableau `SLANG_SEED` ;
3. **Supprimer les fichiers `_generated/*`** et relancer `npx convex dev` ou `npx convex deploy` pour regénérer les bindings ;
4. **Vérifier que `vite.config.ts` injecte bien les langues** en extrayant le contenu du tableau `SLANG_SEED` depuis `src/convex/slangSeed.ts` ;
5. **Reconstruire le bundle** avec `npm run build` après la régénération des fichiers ;
6. **Relancer les vérifications** (bundle, backend, build).

## 6. Critères de succès

- [ ] Bundle front contient bien de, pt, it (`present`) ;
- [ ] Backend Convex retourne les bonnes statistiques (de: 12, pt: 12, it: 12) ;
- [ ] Build réussi sans erreur ;
- [ ] `npx tsc -b --noEmit` réussi.

## 7. Notes

- Le fichier `src/convex/slangSeedLot1.ts` est bien présent et contient les 36 expressions ;
- Le fichier `src/convex/slangSeedLot2.ts` est bien présent et contient les 47 expressions ;
- Le fichier `src/convex/slangSeed.ts` inclut bien les imports et les spreads pour `SLANG_SEED_LOT2`, mais il manque `SLANG_SEED_LOT1`.

---

**Conclusion** : L'assertion est **CLOSED** car les preuves montrent que les langues de, pt, it ne sont pas présentes dans le bundle front ni dans le backend, malgré la présence des fichiers sources. Les actions correctives ci-dessus sont nécessaires pour valider la suppression des badges « Bientôt ».

**Prochaines étapes** : ajouter l'import et le spread de `SLANG_SEED_LOT1` dans `src/convex/slangSeed.ts`, puis relancer les vérifications.
