# ARRÊT CONTRÔLÉ — Écart de réconciliation détecté avant toute écriture

Date : 24 octobre 2026 · Base : `main` @ `a77e2335` · Branche : `main`
Dossier : `audit-quality-shield/lot-2-selection/application-controlee/`
**Aucune source modifiée. Aucun commit, push, déploiement, semis.**

## 1. Déclencheur de l'arrêt (clause §2.5 de la mission)

La mission conditionne l'application à la réconciliation des listes (§2) et ordonne : « Si les listes ou les nombres se contredisent, arrête-toi sans modifier la moindre source et documente l'écart. »

L'écart est constaté :

- **Énoncé de mission** : « 17 fiches sûres = 14 extractions mécaniques + 3 cas résolus documentairement » ;
- **Rapports faisant autorité** (source : [reconciliation-20-fa.csv](reconciliation-20-fa.csv), produite mécaniquement par [reconcilie-listes-fa.mjs](reconcilie-listes-fa.mjs) à partir des quatre artefacts d'autorité) : **19 fiches applicables = 16 extractions mécaniques (« extraction sûre » du verdicts-20-fa.csv, confirmées par le bilan LIMITES.md) + 3 cas résolus par la revue-4-cas** (khâli bastan, kerm rikhtan, fâz) ; **1 exclusion définitive** (dahan servis kardan, verdict « REVUE HUMAINE TOUJOURS NÉCESSAIRE ») ;
- **Aucun rapport ne nomme une liste de 14 fiches.** Le chiffre « 14 » n'apparaît que dans le §4 de RAPPORT-VALIDATION-FINALE comme un décompte de *confirmation par source dédiée au slang* — jamais comme une liste de sélection. Reconstruire arbitrairement quelles 2 fiches écarter des 16 reviendrait à **inventer des exclusions** — ce que la mission interdit expressément (« Ne considère pas le nombre 17 comme une autorisation d'ajouter arbitrairement des fiches : la sélection doit découler des rapports existants »).

## 2. Réconciliation mécanique (preuve traçable)

Livrables du dossier (les seuls écrits de cette session) :

| Fichier | Contenu |
|---|---|
| [reconcilie-listes-fa.mjs](reconcilie-listes-fa.mjs) | script lecture-seule : croise verdicts-20-fa.csv, avant-apres-20-fa.json, LIMITES.md (bilan 16/20) et verdicts-4-cas.csv ; aborte en cas d'incohérence |
| [reconciliation-20-fa.csv](reconciliation-20-fa.csv) | les 20 fiches : statut de réconciliation, inclus/exclue, correction spécifique (kerm rikhtan documentée) |
| [reconciliation-resume.json](reconciliation-resume.json) | bilan chiffré + écart mission↔rapports |

Résultat : **16 mécaniques + 3 cas résolus = 19 inclus · 1 exclue (dahan servis) · total 20 ✓** cohérent entre CSV, JSON, LIMITES.md et revue-4-cas. L'incohérence ne porte que sur l'énoncé de mission (17 ≠ 19).

## 3. Contrôles réalisés malgré l'arrêt

- **dahan servis kardan** : exclusion confirmée — aucun champ ne serait modifié (clause §2.3 respectée par défaut, n'ayant rien écrit).
- **kerm rikhtan** : la proposition exacte et non ambiguë existe bel et bien dans le rapport approuvé (verdicts-4-cas.csv colonne `traduction_proposee` : « Arrête de me chercher » → « **Arrête de m'embêter** », champ `context` uniquement ; `meaning` confirmé inchangé par ≥ 5 sources). Clause §2.5 (4) **satisfaite**.
- **État du dépôt avant écriture** : HEAD `a77e2335caeeb51d504223fff4dabec9daa715a6`, branche `main`, 44 entrées git status prédécessantes préservées ; `git diff` **vide** sur `slangSeedEnrichmentFa.ts`.
- **SHA-256 pré-application figés** (Phase §3 de la mission) :
  - `src/convex/slangSeedEnrichmentFa.ts` : `9afd9f66fb03456196ee196d17f3939f9ba9c17376e914d9ee4859174e366b71` (identique au SHA du snapshot de la mission de préparation ; le lot préparatoire `lot-application/` — snapshot, corrections-16, scripts DRY-RUN/vérification — reste intact et réutilisable tel quel pour 16 des 19 fiches) ;
  - `slangSeedEnrichmentTl.ts` : `7853b091…f488d` · `slangSeedEnrichmentTl4.ts` : `013837b3…6cbecb8` · `slangSeedEnrichmentUr2.ts` : `d1929932…9699a2a` — corrections tagalog et diff ourdou préexistants intacts.

## 4. Points restant à la décision humaine (blocage unique)

Deux options, la première conforme aux rapports, la deuxième à l'énoncé :

1. **Appliquer les 19 fiches dérivées des rapports** (16 mécaniques + khâli bastan sans changement de traduction + kerm rikhtan avec la correction de traduction documentée + fâz sans changement de traduction ; dahan servis, fiche exclue, n'est jamais touchée). Toutes les traces avant/après existent déjà : 16 dans `lot-application/corrections-16-fa.json`, 3 dans `avant-apres-20-fa.json` + `verdicts-4-cas.csv` (1 avec ajustement de traduction).
2. **Confirmer 17 fiches en nommant explicitement les 2 fiches mécaniques à écarter** des 16 (source écrite, par exemple : zâye et bâhâl/khafan — les seules avec réserves documentaires mineures citées dans LIMITES.md §2.2, mais que LIMITES classe néanmoins « correctes »), ou toute autre délimitation explicite.

Aucune écriture aux sources tant que ce choix n'est pas confirmé. Le lot préparatoire est prêt pour l'option 1 (ajouter à `corrections-16-fa.json` les 3 fiches supplémentaires issues du JSON avant/après et du CSV des 4 cas, avec la garde SHA refigée, puis `aplique-corrections-16-fa.mjs --write` étendu à 19).

## 5. Statut des points de la mission

| Point | Statut |
|---|---|
| §1 références relues | ✅ |
| §2 réconciliation | ⚠️ écart documenté (17 énoncé vs 19 dérivé) → arrêt §2.5 |
| §3 protection du dépôt | ✅ SHA/git capturés, rien de modifié |
| §4 application | ⛔ suspendue — décision humaine requise |
| §5 traçabilité | ✅ CSV/JSON de reconciliation produits (dossier seul) |
| §6–7 vérifications et livrables finaux | ⛔ suivront l'application, après décision |

**Livrables généraux non créés** (pas de snapshot applicatif nouveau ni de JSON d'application à 19 fiches) : l'arrêt §2.5 commande de ne pas préparer des artefacts plus avancés avant choix de liste. Les artefacts de la mission préparatoire (snapshot `9afd9f66…`, JSON 16 corrections, scripts) restent valides et ne sont pas écrasés.
