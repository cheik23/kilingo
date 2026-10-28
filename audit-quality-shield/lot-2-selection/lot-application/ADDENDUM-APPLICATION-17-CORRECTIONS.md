# ADDENDUM — LOT PERSAN APPLIQUÉ (16 + 1 corrections)

**Dossier** : `audit-quality-shield/lot-2-selection/lot-application/`
**Date** : 24 octobre 2026 · **Statut** : ✅ **APPLIQUÉ ET VÉRIFIÉ LOCALEMENT**
Fait suite à `RAPPORT-LOT-APPLICATION.md` (préparation, **non écrasé**) et à `../validation-finale/revue-4-cas/RAPPORT-REVUE-4-CAS.md` (cas 2, **non écrasé**).

## 1. Autorisation humaine

L'utilisateur a explicitement répondu « go » au périmètre : (a) application des 16 corrections mécaniques sûres de `corrections-16-fa.json`, (b) correction de contexte d'exemple de `کِرم ریختن` (kerm rikhtan), (c) `دهن سرویس کردن` laissée intacte. Cette réponse constitue la validation humaine exigée comme prérequis d'application.

## 2. Réconciliation préalable (aucune contradiction constatée)

| Contrôle | Résultat |
|---|---|
| HEAD / branche | `a77e2335caee…` / `main` |
| Git status préexistant | 44 entrées (M + untracked) déjà signalées au rapport de préparation — inchangées |
| SHA-256 source avant application | `9afd9f66fb03456196ee196d17f3939f9ba9c17376e914d9ee4859174e366b71` — **identique** au SHA figé dans le JSON et au snapshot |
| Snapshot `snapshot-avant/slangSeedEnrichmentFa.ts` | SHA identique à la source → **réutilisé, non écrasé** |
| 16 fiches du JSON | lignes 17–21, 23–24, 26–34, toutes confirmées verbatim dans la source |
| Exclusions | `khâli bastan` (l.16) et `fâz` (l.35) absentes du JSON des 16 ✓ ; `dahan servis kardan` (l.25) exclue et intacte ✓ |
| `kerm rikhtan` | son `context_avant` réel correspond verbatim à la proposition `avant` de la revue humaine ✓ |

## 3. Application exécutée

1. **16 corrections** : `node aplique-corrections-16-fa.mjs --write` → garde SHA OK, **16 OK / 0 ABORT**, SHA après `e8d0ef60ddca…`, traçabilité `corrections-16-fa-applique.json` (nouveau fichier). Remplacement strict du gabarit `[Époque… | [Ex: …]` par le corps Ex seul, champ `context` uniquement.
2. **kerm rikhtan** : script dédié gardé `applique-kerm-rikhtan.mjs` (dry-run puis `--write`) → occurrence unique confirmée, remplacement strict de la sous-chaîne de traduction de l'exemple : `avant 'کرم نریز!' - Arrête de me chercher` → `après 'کرم نریز!' - Arrête de m'embêter` (formulation exacte retenue au §cas 2 du rapport de revue). Le gabarit de provenance de cette fiche est **conservé** (elle ne fait pas partie des 16). Traçabilité `kerm-rikhtan-applique.json` (nouveau fichier). SHA après `fca95f0c3e1d…`.

**Total : 17 fiches modifiées, champ `context` uniquement** (16 gabarits éliminés + 1 traduction d'exemple ajustée). Aucun autre champ touché ; `validated: false` préservé partout ; persan, ZWNJ, guillemets, traductions conservés verbatim.

## 4. Vérifications après application (toutes PASS)

| Contrôle | Résultat |
|---|---|
| `verifie-corrections-16-fa.mjs --post` | **128/128 contrôles PASS** : `context_apres` présent exactement 1×, `context_avant` absent, 0 gabarit résiduel sur les 16 lignes |
| ZWNJ (U+200C) | intégralement préservés (vérif par fiche : سه‌سوت 2/2, chaque ZWNJ relocalisé colonne par colonne) |
| Bouclier | `verifie-bouclier.mjs` → **6 601 vérifiées, 0 divergence** ; sonde d'autocontrôle : gabarit détecté / label-thématique préservé |
| Identités / doublons | `scripts/verify-seed-uniqueness.mjs` → **6 601 entrées, 6 601 slugs uniques, 0 doublon** |
| `dahan servis kardan` (l.25) | réimprimée sortie shell — **caractère à caractère intacte** |

## 5. Tests exécutés

| Suite | Résultat |
|---|---|
| Tests du lot ciblés (lotPiloteTl + pedagogicalContext + qualityShieldUr) | **29 pass / 0 fail** |
| Suite complète `bun test` | **344 pass / 2 skip / 0 fail** (183 326 expect, 26 fichiers) |
| `typecheck` (tsc -b --noEmit) | OK, aucune erreur |
| `lint` ciblé sur le fichier modifié (eslint) | 0 erreur, 0 warning |
| `build` (vite) | OK 14,5 s — warning « chunks > 1000 kB » réexistant, non lié au lot |

Aucune erreur nouvelle introduite ; les warnings cités sont préexistants et documentés.

## 6. État Git final

- HEAD inchangé `a77e2335`, branche `main`, **aucun commit, push, déploiement, semis** ;
- `git status` : 46 entrées (44 préexistantes + 2 artefacts d'application : `corrections-16-fa-applique.json`, `kerm-rikhtan-applique.json` et scripts/rapports antérieurs sous le dossier untracked `audit-quality-shield/`) ;
- Seul fichier source du dépôt touché : `src/convex/slangSeedEnrichmentFa.ts` — SHA final `fca95f0c3e1d0e7eef398e60b5d2f9d992660bc23588d95a3cb93f55a6f791ab`.

## 7. Limites restantes (inchangées, honnêteté)

1. Aucune fiche validée par un locuteur natif — les 17 corrections restent **documentaires et structurelles** (extraction verbatim + traduction confirmée par ≥ 5 sources lexicographiques pour kerm rikhtan).
2. Les 3 cas restants (`khâli bastan`, `fâz`, `dahan servis kardan`) exigent toujours une oreille native ; `dahan servis kardan` reste **intacte** conformément à l'autorisation (« go » sans elle).
3. Le diff de 2 fiches de `slangSeedEnrichmentUr2.ts` préexistant hors périmètre n'a pas été touché.
4. Aucun accès Convex distant, aucun recalcul d'agrégats, aucune suppression de fichier.

**Verdict : LOT PERSAN APPLIQUÉ ET VÉRIFIÉ LOCALEMENT.**
