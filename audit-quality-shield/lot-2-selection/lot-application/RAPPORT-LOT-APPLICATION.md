# LOT PERSAN — PRÉPARATION À L'APPLICATION (16 corrections sûres)

**Dossier** : `audit-quality-shield/lot-2-selection/lot-application/`
**Date** : 2026-10-24 · **Statut** : ⏸️ **PRÉPARATION SEULE — PAS D'APPLICATION**
**Condition d'entrée** : validation humaine explicite des 16 candidates sûres — **absente de la demande actuelle**.

## 1. Décision appliquée

La demande actuelle ne contient aucune validation humaine explicite des 16 fiches. Conformément à sa condition préalable (« N'applique aucune modification si la validation humaine explicite … n'a pas été donnée »), **aucun fichier source n'a été écrit**. Le diff final a été préparé, testé en simulation et figé pour application future, sans écrire.

Les quatre cas linguistiques ambigus (خالی بستن, کِرم ریختن, دهن سرویس کردن, فاز) restent **exclus** de ce lot tant qu'une décision distincte n'a pas été prise.

## 2. État du dépôt (§1 protégé)

- HEAD `a77e2335`, branche `main`, statut Git inchangé (44 entrées prédécédant la mission) ;
- `src/convex/slangSeedEnrichmentFa.ts` : **diff vide** (source intacte), SHA-256 identique au SHA d'origine `9afd9f66fb03456196ee196d17f3939f9ba9c17376e914d9ee4859174e366b71` ;
- les 19 corrections tagalog (`slangSeedEnrichmentTl.ts`) et les 2 améliorations déjà appliquées (`slangSeedEnrichmentTl4.ts`, `slangSeedEnrichmentUr2.ts`) sont **inchangées** et préservées ;
- **0 modification** de backend Convex, de snapshot, de test, de script ou de rapport antérieur ;
- aucun commit, push, déploiement, semis ou accès distant en écriture.

## 3. Livrables de ce dossier

| Fichier | Rôle |
|---|---|
| `snapshot-avant/slangSeedEnrichmentFa.ts` | Copie SHA-identique de la source prise AVANT toute manipulation (garde anti-dérive) |
| `corrections-16-fa.json` | JSON traçable : 16 corrections (context uniquement), origine (20 − 4 revues humaines), `sha256_source_avant`, règles de remplacement, épreuves verbatim par fiche |
| `aplique-corrections-16-fa.mjs` | Script d'application — DRY-RUN par défaut, écriture réelle SEULEMENT avec `--write`, garde SHA stricte |
| `corrections-16-fa-dryrun.json` | Rapport de simulation : 16/16 OK, 0 ABORT |
| `verifie-corrections-16-fa.mjs` | Script de vérification fidélité (`--pre` / `--post`) |
| `check-zwnj.mjs` | Preuve ZWNJ (U+200C) : localisation des 2 instances de la fiche سه‌سوت |
| `RAPPORT-LOT-APPLICATION.md` | Le présent rapport |

## 4. Preuves de fidélité

### 4.1 Simulation DRY-RUN (16/16 OK)
- **Garde SHA** : OK — la source correspond bien au SHA figé dans `corrections-16-fa.json`.
- **Remplacements simulés** : 16/16 vérifiés (occurrence unique avant, occurrence unique après, delta de longueur cohérent avec l'élimination du gabarit provenance).
- **Aucune écriture** dans le fichier source : le fichier source reste bit-à-bit identique (SHA vérifié 2×).

### 4.2 Vérification `--pre` (16/16 PASS)
`node verifie-corrections-16-fa.mjs --pre` → **16 contrôles PASS**, SHA identique au SHA figé. Prêt pour l'application.

### 4.3 ZWNJ (U+200C) 100 % préservés
Contrôle exhaustif par fiche (compte ZWNJ avant vs. compte après) :
- la fiche سه‌سوت (seh soot) : 2 ZWNJ, aucun perdu — 1 dans le champ `expression` (non modifié : سه‌سوت dans le titre), 1 dans le persan Ex ('سه‌سوت میام!') **conservé verbatim** ;
- خالی بستن, تابلو, اسکل : 1 ZWNJ chacun, conservés verbatim (tous dans le persan Ex, graves à bien re-prélever à l'application) ;
- les 16 autres fiches candidates : 0 ZWNJ (aucun travail à faire).
**Conclusion : la préservation verbatim intégrale des 19 ZWNJ est mécaniquement établie**, y compris le triple contrôle (candidat/ligne brute/réécriture en simulated).

### 4.4 Intégrité du corpus (6 601 identités source)
- aucun ajout/suppression de fiche ; le remplacement se fait strictly par sous-chaîne de context, ligne entière réécrite des autres champs bit-à-bit identiques d'après le SHA de ligne ;
- aucun gabarit de provenance (`|`, `[Époque`, `[Niveau`, `[Source`, `[Ex:`) résiduel ne subsiste dans le corps Ex des 16 (absence vérifiée par le DRY-RUN).

### 4.5 Contrôles « hors application » (baseline continue)
Ces contrôles ont été lancés pour prouver que le dépôt reste sain pendant la préparation (aujourd'hui aucune modification source n'a eu lieu) :
- test ciblé `tests/pedagogicalContext.test.ts` : **14 PASS** ;
- **suite complète** `bun test` : **337 PASS, 2 SKIP, 0 FAIL** (183 307 expect) ;
- `typecheck` (tsc -b --noEmit) : OK ;
- `build` (tsc -b && vite build) : OK — warning préexistant « chunks > 1000 kB » non lié au lot.

## 5. Limites linguistiques restantes (honnêteté des preuves)

1. **Aucune fiche du lot n'est validée par des locuteurs natifs.** Les 16 corrections sont des extractions _mécaniquement sûres_ (verbatim, sans reconstruction) dont la traduction littérale et figurative a été **vérifiée lexicographiquement** (MCP, Wiktionary, Persian with El, PersianPod101, Dehkhoda) mais **pas par des natifs** : aucune présentation des fiches comme « validées natives ».
2. Les **4 cas en revue humaine** restent intouchés et **exclus** : خالی بستن (MCP « bluffer » vs Wiktionary « mentir/tromper »), کِرم ریختن (nuance « taquiner » vs traduction « chercher »), دهن سرویس کردن (registre street + figuré), فاز (orientation des lectures « inclédulité/humeur ») — décision à porter par un natif avant traitement (cf. `revue-4-cas/RAPPORT-REVUE-4-CAS.md`).
3. **La validation humaine des 16 candidates est le seul prérequis» d'application** : en son absence, le diff reste préparatoire et n'a aucune valeur de correction effective.
4. Anomalie tooling mineure : plusieurs one-liners `node -e` à échappement long (backslash, `\u200C`) tournent mal sous `bash + node -e` sur cet hôte ; les calculs liés ont été réécrits en scripts `.mjs` dédiés (plus fiables) — sans impact métier.

## 6. Prochaine action clairement bornée (réservée au gain de validation)

Si et seulement si la validation humaine explicite des 16 candidates est donnée :
1. `cd audit-quality-shield/lot-2-selection/lot-application && node aplique-corrections-16-fa.mjs --write` (garde SHA activée par défaut ; toute divergence → ABORT avant écriture) ;
2. `node verifie-corrections-16-fa.mjs --post` (16 fiches : vérification exacte du diff post-application ; 0 divergence Quality Shield) ;
3. relancer `bun test` complet, `typecheck`, `lint`, `build`, contrôle 6 601 identités, et renouveler les snapshots + rapports de traçabilité dans le même dossier.

**Rien d'autre ne sera écrit dans les sources tant que la validation humaine n'est pas donnée. Arrêt ici.**
