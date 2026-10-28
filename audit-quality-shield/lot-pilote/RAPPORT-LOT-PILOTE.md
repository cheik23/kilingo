# LOT PILOTE — Correction pédagogique (Prompt 2)

Date : 24 octobre 2026 · Base : `main` @ `a77e233` (état de référence du Prompt 1, aucun commit de plus) · Réf. : `RAPPORT-CLOTURE.md`, `../RAPPORT-FINAL.md`

## 1. Choix de la langue : tagalog (`tl`)

Comptage, sur la classification exhaustive v3 (`../classification-v3.csv`, 6 601 fiches), des fiches `MIXED` dont l'exemple est réellement extractible sans ambiguïté :

| Langue | MIXED à exemple extractible | Forme du segment `Ex` | Verdict |
|---|---|---|---|
| fa | 203 | gabarits variés, avec 8 écritures originales non latines | volume élevé, mais segmentation moins uniforme |
| bn | 156 | signatures mixtes, gabarits multiples | uniformité moindre |
| ur | 156 | exemple + commentaire méta mélangés | risque de perte d'information à l'extraction |
| **tl** | 155 | **signature la plus uniforme : `'…' « traduction »`, rien d'autre dans le segment Ex** | **choisi** |

Le tagalog est retenu **sur les données** : le segment `Ex` y est autolimité (exemple entre apostrophes d'origine, traduction entre guillemets français, rien d'autre), le gabarit de provenance `[Époque: …] | [Niveau: …] | [Source: …] | [Ex: …]` est identique fiche après fiche, et la règle d'audit v3 (corps ≥ 5 points de code, ≥ 2 tokens) valide tous les candidats. C'est la langue où l'extraction mécanique peut être prouvée sans interprétation linguistique — exactement l'objectif d'un lot pilote.

## 2. Fiches du lot (155 candidats → 29 canoniques → 20 audités → 19 corrigées)

Source du lot : `src/convex/slangSeedEnrichmentTl.ts` (une fiche = une ligne, format `{ language, expression, literal, meaning, context, register, region, popularity, validated }`).

### 2a. Exclusions AVANT l'audit détaillé

- **Les 6 cas `AMBIGUOUS`** (masqués depuis le Prompt 1, revue humaine en attente) : jamais touchés par un script.
- **Les directives** demandant une composition humaine de l'exemple (`non fourni`, `à compléter`…) : masquées, non parseables.
- **Exemples trop courts** : `Besh` (`'Hi, besh!'`), `GBU` (`'Ingat. GBU.'`) — pas de contexte utile.
- **8 fiches à forme Ex atypique** (`Estetik`, `Eme`, `Amaccana accla`, `Titikman`, `Shot puno`, `Dogshow`, `Boogsh`, `Awit` + `Dot-dot`) : leur segment `Ex` contient d'autres éléments que `'…'` `« … »` (notes hors guillemets, `[sic]`, chaînes enrichies) — l'extraction générique risquerait de rompre des notes ; réservées à une revue humaine.

Restent 29 fiches à forme canonique stricte ; les 20 premières, à phrase complète manifestement illustrative, forment le lot budgété audités ci-dessous (les 9 autres, plus courtes/atypiques, restent pour la suite).

### 2b. Audit fiché par fiche (Prompt 2 §3)

Le tableau complet (contexte source complet, métadonnées identifiées, exemple candidat, méthode d'extraction, traduction/explication existante, risque de perte, décision) est dans **[audit-lot-tl.csv](audit-lot-tl.csv)** — colonnes : `langue, expression, slug, fichier, ligne, contexte_avant, contexte_après, métadonnées_identifiées, exemple_candidat, méthode_d_extraction, risque_de_perte, décision`.

**Résultat : 19 RETENUES / 1 EXCLUE.**

- **`tl:Rapsi` — EXCLUE (ligne 58)** : la traduction source « Mon nouveau bmw est trop bon ! » contredit l'exemple `'Rapsi nitong bagong armor ko!'` (qui parle d'une armure). Corriger la fiche aurait **exporté cette incohérence** dans le contexte nettoyé ; corriger la traduction serait inventer un sens. La fiche reste inchangée (gabarit intact, bouclier déjà masquant) — revue humaine requise.

### 2c. Les 19 fiches corrigées

`Teks`, `Wer na u?`, `Hir na me`, `Guize`, `OTW / OMW`, `OL ka ba?`, `SLR`, `Kyah`, `PM is the key`, `LP`, `SKL`, `FKL`, `Ge`, `Kati`, `Sharks`, `Sags`, `Scoobs`, `Forda ang ferson`, `Sana all` (lignes 43-70, une ligne chacune).

Exemple d'avant/après (toutes les fiches : [corrections-tl.json](corrections-tl.json)) :

```json
{
  "key": "tl:Teks",
  "line": 43,
  "before": "[Époque: 2010-2026+] | [Niveau: VÉRIFIÉ] | [Source: Réseaux sociaux (FilipinoPod101, 2019)] | [Ex: 'Teks mo ako pag nakauwi ka na' « Envoie-moi un texto quand tu seras rentré »] ",
  "after":  "'Teks mo ako pag nakauwi ka na' « Envoie-moi un texto quand tu seras rentré »"
}
```

**Zéro changement d'affichage pour l'apprenant** : le bouclier (`displayContext`) extrait déjà exactement ce corps des fiches `MIXED` ; la correction assainit la *source* pour que le rendu ne dépende plus de l'extraction au runtime. Les guillemets, apostrophes, `/` (mini-dialogues), ponctuation et espaces intramots sont conservés au caractère près ; la seule différence est le retrait du gabarit (crochets de provenance + une espace décorative finale).

## 3. Méthode d'extraction (traçabilité mécanique)

Une seule fonction (`corpsEx` dans `corrige-tl.mjs`, répliquée telle quelle dans le test) a produit `after` pour les 19 fiches et l'audit CSV :

```
old    = valeur EXACTE du champ `context` de la ligne
anchor = "| [Ex:"                      // présent une seule fois dans le gabarit
body   = old.slice( idx + anchor.length )
tail   = /\](\s*)$/                    // retire le « ] » final + l'espace (≤1) après lui
if (body.startsWith(" ")) body = body.slice(1)   // l'unique espace suivant « Ex: »
after  = body
```

- Copie **du premier `| [Ex:` au `]` final** — aucune regex sémantique sur le contenu, donc aucune interprétation de `'`, `« », `/`, emojis ou diacritiques.
- `Rapsi` (et toute fiche hors lot) : jamais passée dans la fonction de remplacement — le script aborte avant toute écriture si le lot ne fait pas exactement 19 fiches ou si le SHA du snapshot ne correspond pas.

## 4. Contrôles exécutés (avant → après)

| Contrôle | Résultat |
|---|---|
| Snapshot du fichier avant modification (SHA-256) | `7ea1f28f…8b` (`lot-pilote/avant/slangSeedEnrichmentTl.ts`) |
| Fichier après modification (SHA-256) | `ddf1c631…39` — écrit une seule fois, réglé par le script |
| Diff bit-à-bit snapshot → fichier vivant (`verifie-lot-tl.mjs`) | **19 lignes modifiées/19 attendues — uniquement le champ `context`** ; préfixe (`expression…literal…meaning`) et suffixe (`register, region, popularity, validated`) identiques octet pour octet |
| Corpus global bundle esbuild (`SLANG_SEED`) | **6 601 fiches, 6 601 clés uniques** — aucune autre fiche taillée |
| Vérification croisée bouclier ↔ audit v3 (`../verifie-bouclier.mjs`) | **6 601 vérifiées, 0 divergence** |
| Nouveau test de non-régression `tests/lotPiloteTl.test.ts` | **7/7 pass** (354 assertions) |
| Suite complète (`npx -y bun test`, 25 fichiers) | **336 pass / 2 skip volontaires / 0 fail** (baseline 329 + les 7 nouveaux) |
| Typecheck (`tsc -b --noEmit`) | **OK, exit 0** |
| Lint (`npx eslint` sur les 2 fichiers du lot) | 1 erreur **préexistante** : `[Estetik], ligne 71:323, no-useless-escape (\|)` — reproduite à l'identique sur le snapshot `avant/` (fiche hors lot, jamais touchée) ; hors périmètre, documentée |
| Build (`npm run build` = `tsc -b && vite build`) | **OK** (15,7 s, même avertissement de chunks qu'à la baseline) |
| Git | `status` inchangé hors : `src/convex/slangSeedEnrichmentTl.ts` (modifié), `tests/lotPiloteTl.test.ts` (nouveau), `audit-quality-shield/lot-pilote/*` (nouveaux). Aucun commit, push, déploiement, mutation Convex, semis ou recalcul |

Détail des 7 tests de non-régression :

1. les 19 clés existent, dans le fichier vivant ET dans le snapshot 29 fiches ;
2. aucun gabarit technique ne reste (`[Époque`, `[Niveau`, `[Source`, aucun démarrage par `[` ni `Ex:`) ;
3. l'exemple extrait correspond **exactement** au contenu source autorisé : `corpsEx(snapshot)` === `vivant`, recalculé à partir du snapshot, pas d'une fixture figée ;
4. aucune traduction/note n'a disparu : invariants verbatim (`Teks`, `PM is the key`, `Ge` avec son `/`, `Sana all`) ;
5. le bouclier renvoie les 19 contextes corrigés **intacts** (contenus libres) ;
6. les 10 fiches hors lot du fichier sont strictement identiques (tous champs, JSON.stringify comparé) ;
7. `Rapsi` (exclue) : gabarit intact ET le bouclier l'extrait toujours à l'identique — aucun défaut de l'existant.

## 5. Les trois statuts, séparément (Prompt 2 §5)

1. **Validation structurelle** — OK. Métadonnées séparées du contenu, preuve : diff octet à octet + tests.
2. **Fidélité** — OK. Aucun texte utile perdu ou inventé (seule variation : une espace décorative finale + le `]` du gabarit). Preuve : tests 3-4-7.
3. **Qualité linguistique** — **NON VÉRIFIÉE** pour les 19 fiches : aucune validation native, aucun corpus externe, aucun statut faux revendiqué. Les fiches restent `validated: false` et aucune mention de validation par natif n'a été ajoutée. Deux traductions à *examiner* (signalées dans l'audit CSV, non retenues comme défaut bloquant) :
   - `tl:Guize` : « Les gars, on va à Rain ! » — « Rain » et le sens de `pasyal` (balade) à confirmer ;
   - `tl:Kati` : « Ce type est coriace ! » — `'Ang kati naman nito'` (litt. « ceci est [dur] à gratter ») ; « nito » rendu « ce type », à confirmer.

La fiche `Rapsi` reste **EXCLUE** pour sa contradiction exemple/traduction — revue humaine avant tout rendu.

## 6. Ce qui n'a PAS été fait

- Aucun commit, push, déploiement ; aucune écriture Convex, semis, recalcul d'agrégats ; aucun backend distant touché (`formal-vulture-518`, `impartial-pony-692`).
- Les autres langues (`ur`, `fa`, `bn`) ne sont pas corrigées : d'après les données, leur extraction mécanique risque de perdre des commentaires méta — elles attendent un avis humain. Aucun semis d'aucune autre langue.
- Aucun test navigateur physique (React preview) — identique à la limite §7.2 du Prompt 1.

## 7. Prochain lot recommandé (non exécuté — arrêt demandé par le prompt)

1. **Lot suivant = `ur`** avec la même fonction `corpsEx` (156 fiches extractibles uniformes), MAIS avec une passe d'extraction étendue : segmenter `« traduction » — commentaire` séparément pour ne pas amputer le commentaire méta intégrer à la suite (notes du type « - [lemme] = … »). Un gel de qualif (`fidélité`/`à examiner`) par fiche, comme sur ce lot, reste prudent.
2. Puis `fa` (203, plus gros volume, requiert les mêmes précautions d'échappement des écritures originales).
3. Fiches à enrichissement humain (`Besh`, `GBU`… et les 8 atypiques `tl`) : ne jamais les injecter mécaniquement ; rédaction par humain seulement.
4. Les 6 `AMBIGUOUS` + `Rapsi` : revue humaine unique, en amont de tout traitement automatique.

## 8. Artefacts

- [RAPPORT-LOT-PILOTE.md](RAPPORT-LOT-PILOTE.md) — ce rapport
- [audit-lot-tl.csv](audit-lot-tl.csv) — tableau d'audit fiché par fiche (20 auditées incl. Rapsi)
- [corrections-tl.json](corrections-tl.json) — avant/après verbatim des 19 fiches corrigées
- [avant/slangSeedEnrichmentTl.ts](avant/slangSeedEnrichmentTl.ts) — snapshot SHA-256 pré-modification
- [corrige-tl.mjs](corrige-tl.mjs) — script de correction (abort avant écriture ; rejouable)
- [verifie-lot-tl.mjs](verifie-lot-tl.mjs) — vérification bit-à-bit + intégrité corpus + clés uniques
- [tests/lotPiloteTl.test.ts](../../tests/lotPiloteTl.test.ts) — 7 tests de non-régression

**Critère de réussite (§7 du prompt) : atteint pour 19 / 20 fiches audités — chaque fiche modifiée est traçable, aucun sens n'a été inventé, aucune donnée distante touchée, aucun défaut introduit, les checks passent. Le lot livré fait 19 fiches (pas 20 : Rapsi exclue, quota non complété artificiellement).**
