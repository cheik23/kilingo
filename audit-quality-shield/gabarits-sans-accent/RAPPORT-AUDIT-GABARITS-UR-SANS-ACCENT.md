# AUDIT QUALITY SHIELD — gabarits ourdous avec/sans diacritique

Date : 24 octobre 2026 · Base : `main` @ `a77e2335` · Branche : `main`
Dossier : `audit-quality-shield/gabarits-sans-accent/`
Périmètre : [pedagogicalContext.ts](./../../src/lib/pedagogicalContext.ts) + [tests/qualityShieldUrSansAccent.test.ts](./../../tests/qualityShieldUrSansAccent.test.ts) + scripts d'audit. **Aucune donnée du catalogue modifiée.** Aucun commit, push, déploiement, semis, accès Convex.

## 1. Audit préalable — signatures réelles confirmées (§1 de la mission)

La sonde [sonde-urdu.mjs](../sonde-urdu.mjs) a extrait les **198 contextes des 5 fichiers urdu** (Ur 50, Ur2 60, Ur3 48, Ur4 40) et les a soumis au détecteur réel ([sonde-urdu-bilan.json](../sonde-urdu-bilan.json)) :

| Famille de signature (réelle) | Fiches | Détection bouclier | Verdict |
|---|---|---|---|
| `[Époque: …] \| [Niveau: VÉRIFIÉ] \| [Source: …] \| [Ex: '…' - …]` (Ur, Ur3) | 98 | ✅ 98/98 | MIXED, Ex extrait |
| `[Epoque: …] \| [Niveau: VERIFIE] \| [Source: …] \| [Ex: …]` sans accent (Ur2) | 58 | ✅ 58/58 | MIXED, Ex extrait |
| Contextes libres « citation — explication » (Ur2 l.10, l.43) | 2 | ✅ non-détectés (correct) | affichés intacts |
| Gabarit **lexique culturel** Ur4 `[Label] | description. Ex: … Note: …` | 40 | ✅ non-détectés (correct) | affichés intacts — note culturelle préservée |

**Fuite de métadonnées : 0/198. Masquage injustifié : 0/198.**

Constat honnête : le détecteur d'exécution ET le classificateur d'audit ([signatures.mjs](../signatures.mjs)) listent déjà les clés `Époque`/`Epoque` et `Période`/`Periode`, insensibles à la casse, avec détection **structurelle** (≥ 2 segments `[Clé: …]` en tête, pas un mot-clé isolé). L'écart « 156 MIXED vs 97 gabarits » cité au rapport lot 2 provient d'un comptage grep limité à l'accentué, pas d'une lacune du bouclier. Ce lot durcit donc les deux variantes résiduelles documentées et **verrouille le comportement par des tests**.

## 2. Implémentation limitée (§2)

| Changement | Fichier | Motif documenté |
|---|---|---|
| Les deux-points pleine-largeur `:` (CJK) reconnus dans `SEGMENT_FULL_RE`, alignés sur `EX_EXTRACT_RE` | [pedagogicalContext.ts](./../../src/lib/pedagogicalContext.ts) | variante Unicode standard du deux-points de provenance, déjà acceptée par le segment Ex du même module |
| Correction du contrôle autonome de [verifie-bouclier.mjs](../verifie-bouclier.mjs) (sélecteur d'échantillon `label-thématique` ne trouvait jamais de fixture → « ? ») | script d'audit | diagnostic propre : renvoie désormais false comme attendu |

Rien d'autre : la détection reste **structurelle** (« tête de découpe : ≥ 2 segments `[Clé: …]` »), jamais un mot-clé isolé ; les labels sans deux-points de provenance (`[Télétravail] | …`, `[Sens littéral] | [Sens réel] | [Ex] | [Note]`), les gabarits lexiques culturels et les notes cultures ne sont pas affectés — ils sont tous **sans clés de provenance** et tombent hors règle.

## 3. Tests de non-régression (§3) — les 7 cas exigés

[tests/qualityShieldUrSansAccent.test.ts](./../../tests/qualityShieldUrSansAccent.test.ts) (7 tests, exécutés avec la suite) :

1. ✅ gabarit ourdou **avec** `Époque` (extrait réel Ur3) → détection + extraction de l'Ex verbatim ;
2. ✅ gabarit ourdou **sans accent** `Epoque` (extrait réel Ur2) → détection identique ;
3. ✅ une chaîne contenant seulement « époque » dans un vrai contexte (2 variantes, avec et sans crochets) → pas un gabarit, intact ;
4. ✅ label pédagogique valide `[Télétravail] | …` → intact ;
5. ✅ format structuré `[Sens littéral] | [Sens réel] | [Ex] | [Note]` → intact (pas de deux-points de provenance) ;
6. ✅ métadonnées mêlées à l'exemple (gabarit réel fa) → l'exemple seul est affiché ;
7. ✅ conservation Unicode : phrase en graphie arabo-ourde + ponctuation native intacte rune à rune ; Ex extrait = contenu exact sans normalisation ; deux-points pleine-largeur reconnus.

## 4. Vérification complète sur les 6 601 fiches (pas quelques fixtures)

| Contrôle | Résultat |
|---|---|
| [verifie-bouclier.mjs](../verifie-bouclier.mjs) — bouclier (esbuild du TS réel) × classification-v3.csv sur les **6 601** fiches | ✅ « Vérifiées : 6601 ; divergences : 0 » |
| Contrôle autonome | ✅ `pt-gabarit=true (attendu true) ; label-thématique=false (attendu false)` |
| Sonde 198 contextes ur (rééchelonnée après modification) | ✅ 156 détectés / 42 légitimes intacts / **0 fuite / 0 masquage** |

## 5. Résultats des commandes (erreurs réellement exécutées vs préexistants)

| Commande | Résultat |
|---|---|
| `bun test tests/qualityShieldUrSansAccent.test.ts tests/pedagogicalContext.test.ts` | ✅ 21 pass / 0 fail (introduites : 7) |
| `npx bun test` (suite complète) | ✅ **344 pass, 2 skip, 0 fail** (337+7 par rapport à la baseline préparée ; les 2 skip sont préexistants, MISSION 8 ASR) |
| `npm run typecheck` | ✅ OK, 0 erreur |
| `npx eslint src/lib/pedagogicalContext.ts tests/qualityShieldUrSansAccent.test.ts` (lint pertinent) | ✅ 0 erreur |
| `npm run build` | ✅ OK (14,08 s) — warning préexistant « chunks > 1000 kB », inchangé, non lié à ce lot |

Aucune erreur introduite par cette mission ; les seuls mentions résiduelles (skip MISSION 8, chunk size) préexistaient à l'ouverture.

## 6. Faux positifs contrôlés

- **Ur2 l.10 & l.43** (« Scene on hai », « Boss ») : début « `«` » + citation — pas des crochets de gabarit → non-détectés correctement, affichés intacts ;
- **40 fiches Ur4** (lexique culturel : PSL, Coke Studio, Rap, Beat…) : le premier `[Label]` ne porte pas de deux-points → non-gabarit, la note culturelle reste visible (contrainte §2 : « préserver les notes culturelles utiles ») ;
- mot « époque » isolé en prose, labels sans colon, formats 4-structurés sans clés : tests dédiés §3.

**Fiches urdu affectées par le durcissement : 0** (aucune modification du rendu des 198 ; le changement ne couvre que la variante deux-points pleine-largeur, aujourd'hui absente du catalogue mais documentée comme standard CJK).

## 7. Marquage de la mécanique et de la conservation

- Garde anti-régression : les extraits de gabarits dans les tests sont repris **verbatim** des sources (l. 62 Ur3, l. 12 Ur2) ; toute future reconstruction du persan (par translittération) ou altération d'Ex ferait échouer les comparaisons à l'identique ;
- Les corrections tagalog (`Guize`, `Sana all`…), persanes préparées et le diff ourdou `Ur2` préexistant : 0 touche.

## 8. Limites restantes

1. **Aucune écriture ourde native dans le champ `context`** des 198 fiches urdu (script révélé par [contextes-urdu-script.mjs](../contextes-urdu-script.mjs) : 0 contextes à graphie arabo-ourde) — si un futur semis introduit ces graphies directement dans `context`, le passage libre/l'Ex sont déjà consommés par Unicode (`\p{L}/\p{M}`), mais les mots-clés de provenance en ourdou (`دور`, etc.) ne sont PAS reconnus — revue humaine à ce jour, jamais inventée ;
2. La fusion de `const (` (l'Ex de Ur2 sans guillemets ni traduction FR) est extraite telle quelle : le contenu affiché pour les 58 fiches Ur2 reste romanisé sans traduction — c'est la limite documentaire (lot ur de correction de contenu, à venir séparément, **non démarré dans cette mission**) ;
3. Les gabarits avec clés de provenance **autres** que les 12 listées (`Époque/Epoque/Periode/Période/Niveau/Source/Ex/Exemple/Registre/Origin/Langue/Note`) ne sont pas gabarits pour le bouclier — si un nouveau semis en introduit (`[Genre: …]`, `[Milieu: …]`…), une extension de `PROVENANCE_KEYS` sera requise, avec la même méthode « audit → signatures réelles → tests » ;
4. Le métadonnage général `[{clé}: …]` intégré **au milieu** d'une phrase reste hors gabarit par conception (un seul `[Clé: …]` en tête exigé) — un futur audit peut l'étendre si les sources le justifient ;
5. Les scripts d'audit (`signatures.mjs`) et le bouclier partagent désormais leurs clés de provenance mais restent **deux implémentations** : toute évolution de l'une devra être répliquée dans l'autre pour maintenir la règle « zéro divergence audit↔bouclier » (vérifiée aujourd'hui à 0 sur 6 601).

## 9. Fonction statut

- Fichiers modifiés : [pedagogicalContext.ts](./../../src/lib/pedagogicalContext.ts) (`SEGMENT_FULL_RE` + commentaire), [verifie-bouclier.mjs](../verifie-bouclier.mjs) (sélecteur d'échantillon) ;
- Fichiers créés : [tests/qualityShieldUrSansAccent.test.ts](./../../tests/qualityShieldUrSansAccent.test.ts), [sonde-urdu.mjs](../sonde-urdu.mjs) + sorties [sonde-urdu-bilan.json](../sonde-urdu-bilan.json), [sonde-urdu-cases.json](../sonde-urdu-cases.json), [analyse-42-non-detectes.mjs](../analyse-42-non-detectes.mjs), [contextes-urdu-script.mjs](../contextes-urdu-script.mjs), le présent rapport ;
- Aucune donnée source touchée, aucun commit, push, déploiement, semis, aucun accès Convex ni environnement distant.

**Lot ourdou de correction de contenu : non lancé, conformément à la clause d'arrêt de la mission.**
