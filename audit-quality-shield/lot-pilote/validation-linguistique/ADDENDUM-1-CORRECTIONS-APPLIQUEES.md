# ADDENDUM 1 — Corrections linguistiques approuvées appliquées (lot pilote tagalog)

Date : 24 octobre 2026 · Base : `main` @ `a77e233` · Réf. : [`RAPPORT-VALIDATION-LINGUISTIQUE.md`](RAPPORT-VALIDATION-LINGUISTIQUE.md)

Les deux corrections classées **CORRECTION À PROPOSER** (§4.1 et §4.2 du rapport de validation) ont été **appliquées verbatim** aux fiches `tl:Guize` et `tl:Sana all`, champ `context` uniquement. Rien d'autre n'a été modifié.

## 1. Corrections appliquées — diff exact avant/après

Ligne du fichier `src/convex/slangSeedEnrichmentTl.ts` au HEAD `a77e233` → fichier vivant :

| Fiche | Ligne | AVANT | APRÈS |
|---|---|---|---|
| `tl:Guize` | 46 | `expression: "Guize", literal: "graphie stylisée de « guys » (sociolecte Jejenese)", meaning: "les gars, la bande", context: "'Guize, pasyal tayo' « Les gars, on va à Rain ! »", register: "internet", region: "Philippines", popularity: 52, validated: false` | `expression: "Guize", literal: "graphie stylisée de « guys » (sociolecte Jejenese)", meaning: "les gars, la bande", context: "'Guize, pasyal tayo kina Rain!' « Les gars, on va chez Rain ! »", register: "internet", region: "Philippines", popularity: 52, validated: false` |
| `tl:Sana all` | 70 | `expression: "Sana all", literal: "« j'aimerais ça pour tous »", meaning: "envie de vivre la même chose que quelqu'un", context: "'May boyfriend na siya, sana all!' « Il a un copain, tout le monde ! »", register: "internet", region: "Philippines", popularity: 82, validated: false` | `expression: "Sana all", literal: "« j'aimerais ça pour tous »", meaning: "envie de vivre la même chose que quelqu'un", context: "'May boyfriend na siya, sana all!' « Elle a un copain, la chance ! »", register: "internet", region: "Philippines", popularity: 82, validated: false` |

- Champ modifié : **`context` uniquement** dans les deux cas. `literal`, `meaning`, `register`, `region`, `popularity`, `validated` : identiques. Le sens de l'expression n'a pas changé.
- SHA-256 du fichier vivant : `7853b091028e2f8429c96b1194b074510e9ababb80d5abec711134f3e70f488d` (snapshot `avant/` vierge : `7ea1f28f…`, **inchangé**).
- Trace machine : [`corrections-linguistiques-tl.json`](corrections-linguistiques-tl.json) (format aligné sur `corrections-tl.json` : `key`, `before`, `after`, champ, motif, fondement).

## 2. Fichiers touchés et non touchés

| Fichier | Changement |
|---|---|
| `src/convex/slangSeedEnrichmentTl.ts` | Champs `context` des 2 seules fiches `tl:Guize` et `tl:Sana all` (2 lignes) |
| `tests/lotPiloteTl.test.ts` | 2 assertions verbatim mises à jour vers la valeur approuvée ; whitelist de 2 fiches dans le test « corps Ex exact » ; **test dédié ajouté** (« 2 corrections linguistiques approuvées appliquées verbatim ») qui épingle les nouvelles valeurs |
| `audit-quality-shield/lot-pilote/verifie-lot-tl.mjs` | Étendu : charge `corrections-linguistiques-tl.json` ; le diff attendu reste **19 fiches** (une fiche = une ligne — Guize et Sana all portent une correction mécanique ET linguistique sur la même ligne) ; les 2 fiches surchargées sont vérifiées contre la valeur linguistique |
| `audit-quality-shield/lot-pilote/validation-linguistique/corrections-linguistiques-tl.json` | **Nouveau** (trace des corrections) |
| `audit-quality-shield/lot-pilote/validation-linguistique/ADDENDUM-1-CORRECTIONS-APPLIQUEES.md` | **Nouveau** (ce rapport) |
| Les 17 autres fiches du lot, les 7 nuances secondaires du §4.3, tous les statuts `validated` | **Rien** — intacts |
| Snapshot `avant/`, `corrections-tl.json`, `audit-lot-tl.csv`, `RAPPORT-LOT-PILOTE.md`, `RAPPORT-VALIDATION-LINGUISTIQUE.md` (`verdicts-validation.csv`) | **Aucun écrasement**, aucun changement |

## 3. Vérifications exécutées (toutes passées)

| Vérification | Commande | Résultat |
|---|---|---|
| Diff bit-à-bit + corpus | `node audit-quality-shield/lot-pilote/verifie-lot-tl.mjs` | **19/19 fiches** modifiées au champ `context` uniquement ; 6 601 fiches, 6 601 clés uniques, aucun gabarit résiduel |
| Intégrité du corpus | idem (bundle esbuild de `slangSeed.ts`) | **6 601 / 6 601** identités, clés uniques |
| Quality Shield | `node audit-quality-shield/verifie-bouclier.mjs` | **6 601 vérifiées ; 0 divergence** — comportement conservé |
| Tests du lot | `bun test tests/lotPiloteTl.test.ts` | **8/8 pass** (354 expect) |
| Suite complète | `bun test` | **337 pass / 2 skip / 0 fail** (183 307 expect, 25 fichiers) |
| Typecheck | `npm run typecheck` (`tsc -b --noEmit`) | **0 erreur** |
| Build | `npm run build` (`tsc -b && vite build`) | **succès** (⚠ avertissement préexistant : chunk > 1000 kB — non lié aux fiches) |
| Git | `git diff` | Seule la ligne des 2 fiches diffère dans `slangSeedEnrichmentTl.ts` ; aucun autre fichier au-delà de ceux listés au §2 |

Notes d'exécution neutres : `bun` n'était pas dans le PATH de ce shell ; les tests ont été exécutés via le binaire `bun` récupéré dans le cache npm local (`npx -y bun test`, aucune installation globale, aucune écriture distante).

## 4. Limites restantes

1. **Validation documentaire ≠ validation native** : les 19 fiches restent à `validated: false` ; aucune revue par un locuteur tagalog n'a eu lieu.
2. Les **7 nuances secondaires** du rapport §4.3 (SLR, SKL + coquille « préention », Kati, Forda, Hir na me, Ge, FKL) restent **en revue humaine, non appliquées**.
3. La fiche exclue `tl:Rapsi` (contradiction « armor »/« bmw ») reste inchangée, gabarit intact, réclamant une revue humaine.
4. Perçus uniquement par l'échantillon documentaire (Source primaire 2019 ; corroboration ~2016) : la pérennité de l'usage actuel n'est pas prouvée.

**Aucun commit, push, déploiement, semis ou mutation Convex. Le lot suivant n'a pas été lancé.**
