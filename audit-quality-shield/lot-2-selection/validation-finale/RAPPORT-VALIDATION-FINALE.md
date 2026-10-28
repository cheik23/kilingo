# RAPPORT — Validation finale des 20 candidates persanes (Lot 2)

Date : 24 octobre 2026 · Base : `main` @ `a77e2335` · Branche : `main`
Réf. dossier source : [../RAPPORT-LOT2-SELECTION.md](../RAPPORT-LOT2-SELECTION.md) · Réf. lot pilote : [../../lot-pilote/RAPPORT-LOT-PILOTE.md](../../lot-pilote/RAPPORT-LOT-PILOTE.md)
Périmètre : `src/convex/slangSeedEnrichmentFa.ts`, lignes 16-35 · **Aucune fiche modifiée** · Aucun commit, push, déploiement, semis, écriture distante.

## 1. Procédure exécutée (§1 mission)

- HEAD confirmé : `a77e2335caeeb51d504223fff4dabec9daa715a6` sur la branche `main`.
- `git status` inchangé depuis l'ouverture (travail existant préservé : corrections tagalog + snapshots + tests + Quality Shield + SRS/Discover + PWA + fichiers non suivis + le diff préexistant `slangSeedEnrichmentUr2.ts`, documenté au rapport lot 2 §5, jamais touché ici).
- **Aucun fichier source, aucun champ `validated`, aucun autre champ de fiche n'a été modifié.** Les anciens livrables (`RAPPORT-LOT2-SELECTION.md`, `audit-lot2-fa.csv`, `analyse-langues.csv`, `metrics-langues.json`, `analyse-trois-langues.mjs`) sont intacts, non écrasés.

Livrables créés dans `audit-quality-shield/lot-2-selection/validation-finale/` :

| Livrable | Contenu |
|---|---|
| [RAPPORT-VALIDATION-FINALE.md](RAPPORT-VALIDATION-FINALE.md) | ce rapport |
| [verdicts-20-fa.csv](verdicts-20-fa.csv) | décisions fiche par fiche (20 lignes) : expression, translittération, sens FR, registre/région, exemple persan exact, traduction FR, contexte source, résultat proposé, cohérence, décision, justification |
| [avant-apres-20-fa.json](avant-apres-20-fa.json) | valeur exacte avant/après pour chaque candidate + segments et caractères éliminés + preuves de préservation |
| [SOURCES-LINGUISTIQUES.md](SOURCES-LINGUISTIQUES.md) | sources consultées (URLs conservées), ce que chaque source confirme, divergences signalées |
| [LIMITES.md](LIMITES.md) | limites linguistiques + bilan « fiches réellement sûres » |
| [dump-candidats-fa.mjs](dump-candidats-fa.mjs) | script de lecture seule (traçabilité) qui a extrait les 20 fiches, appliqué la règle fa, produit JSON+CSV — aborte si une fiche ne s'aligne pas |

## 2. Les 20 candidates, fiche par fiche (extrait : intégralité dans CSV)

Les 20 fiches proviennent des lignes 16-35 de `src/convex/slangSeedEnrichmentFa.ts`. Toutes partagent un même format strict :

```text
[Époque: <date>] | [Niveau: VÉRIFIÉ] | [Source: <provenance>] | [Ex: '<persan>' - <trad. fr>]
```

Exemple (fiche n°1, « خالی بستن ») :

- **Contexte source** complet : `[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Dictionnaire] | [Ex: 'این‌قدر خالی نبند!' - Arrête de bluffer autant]`
- **Résultat prévu** (retrait des seules métadonnées, exemple et traduction gardés VERBATIM) : `'این‌قدر خالی نبند!' - Arrête de bluffer autant`
- **Persan exact conservé** : `این‌قدر خالی نبند!` (pas une reconstruction depuis `khâli bastan`) · **Trad. FR** : `Arrête de bluffer autant` · **Registre/Région** : `internet`/`Iran` · **popularity 82**
- **Cohérence expression ↔ exemple ↔ trad.** : ✓, confirmée par [My Persian Corner](https://www.mypersiancorner.com/persian-slang-words-you-wont-learn-class/) (« attacher du vide » → bluff/exagération) ; divergence Wiktionary (« mentir, tromper » plus large) signalée.
- **Décision** : **revue linguistique humaine** (divergence de sens à trancher).

Les 20 lignes intégrales (contexte source complet, persan exact, résultat proposé, cohérence, registre, décision, justification) sont dans [verdicts-20-fa.csv](verdicts-20-fa.csv) et les valeurs avant/après exactes octet pour octet dans [avant-apres-20-fa.json](avant-apres-20-fa.json).

## 3. Validation de la règle d'extraction propre au persan (§3)

La règle fa **n'est pas le parseur tagalog** : elle est dérivée du gabarit fa réel et comprend quatre contraintes (documentées dans le script) :

1. **4 segments** séparés par « | », dont les 3 premiers cachent exactement `[Époque: …]`, `[Niveau: …]`, `[Source: …]` et le dernier `[Ex: …]` → la provenance est identifiable sans ambiguïté. Vérifié sur les 20/20.
2. **Le persan complet est conservé** : le corps proposé commence par l'apostrophe `'` et l'écriture persane est copiée **verbatim**, y compris les 4 ZWNJ (U+200C, aussi appelé « ½ espace persane ») présents dans les fiches 16, 18, 23, 31 (`این‌قدر`, `سه‌سوت`, `خسته‌ای`, `اسکل‌بازی`) — contrôlé dans le JSON (`preuve_persan_preserve = true` sur 20/20).
3. **La traduction reste rattachée au bon exemple** : c'est l'unique séparateur `' - '` (tiret U+002D) du corps, avec ancrage regex sur `^'<persan>' - <trad>$`; **0 corps** sur les 20 ne contient un second ` - ` susceptible de créer une ambiguïté de coupe (contrôle effectué).
4. **Aucune note culturelle ou instruction utile n'est supprimée** : les 20 gabarits fa sont un gabarit provenance pur ; l'information culturelle n'apparaît pas dans le corps Ex (celles qui en ont, le gabarit lexical culturel `Fa4`, ont déjà été exclues du lot au §4 du [../RAPPORT-LOT2-SELECTION.md](../RAPPORT-LOT2-SELECTION.md)). Le seul caractère « information » retiré est le marqueur de niveau `[Niveau: VÉRIFIÉ]` — une métadonnée de gouvernance, jamais partie de l'apprenant. Les guillemets `'` autour de l'exemple persan et la ponctuation persane (`!`, `؟`, `…`) sont conservés à l'identique.

**Tirets, guillemets, Unicode et ponctuation** : aucun caractère de gabarit `[`, `]`, `|`, `Époque` ne subsiste dans le corps proposé (`residusGabaritDansCorps = []` sur 20/20) ; les crochets du gabarit supprimés sont exactement `[Époque: …]`, `[Niveau: …]`, `[Source: …]`, `[Ex:` et le `]` final (documentés `prefixe_elimine` + `suffixe_elimine` dans le JSON).

## 4. Preuves linguistiques (§4) — synthèse

Sources gratuites : My Persian Corner, PersianPod101, Persian with El, Wiktionary (Persan). Détail complet + URLs conservées dans [SOURCES-LINGUISTIQUES.md](SOURCES-LINGUISTIQUES.md).

- **14 fiches** : sens confirmé par au moins une source gratuite dédiée au slang persan (blog linguistique ou dictionnaire) ; pour la majorité, **confirmation par 2 sources indépendantes**.
- **4 fiches** reconnues **« revue linguistique humaine »** — l'extraction mécanique est sûre, mais la cohérence de la traduction nécessite un natif :
  1. `خالی بستن (khâli bastan)` — divergence MCP (bluffer) / Wiktionary (mentir/tromper).
  1. `خالی بستن (khâli bastan)` — divergence MCP (bluffer) / Wiktionary (mentir/tromper).
  2. `کِرم ریختن (kerm rikhtan)` — la traduction « Arrête de me chercher » nuance plus légère que la source « taquiner/embêter ».
  3. `دهن سرویس کردن (dahan servis kardan)` — registre `street` à connotation potentiellement vulgaire + trad. figurative à valider.
  4. `فاز (fâz)` — traduction « C'est quoi ce délire ? » adaptée du sens « mood/vibe » à valider.
- **Rien d'autre n'a été retenu comme validation** : aucune source « natives » dans l'écosystème gratuit du Web documentaire — le statut `validated: false` reste inchangé sur les 20.

## 5. Diff avant/après exact (§5) — non appliqué

Chaque candidate dispose :
- de la **valeur originale exacte** du champ `context` (champ `context_source` du JSON / colonne `context_source` du CSV) ;
- de la **valeur proposée après** retrait des seules métadonnées provenance (champ `context_propose`) ;
- des **caractères/segments qui seraient supprimés** : préfixe `"<Époque: …> | <Niveau: …> | <Source: …> | <Ex: "` et suffixe `"]"` (colonnes `prefixe_elimine`, `suffixe_elimine`, `caracteres_supprimes` du JSON) ;
- de la **preuve** qu'exemple persan et traduction FR sont intégrés dans le contexte source (champs `preuve_persan_preserve`, `preuve_trad_preservee`, `residusGabaritDansCorps`) — **20/20 OK**.

**Rien n'est appliqué** : il n'y a aucune écriture au fichier source (`slangSeedEnrichmentFa.ts` inchangé octet pour octet). Les 4 fiches « revue humaine » ne proposent **aucune transformation automatique** au-delà du retrait du gabarit (qui reste documenté mais sans validation des sources).

## 6. Contrôles finaux (§6) — statut exécuté

| Contrôle | Résultat |
|---|---|
| Les 20 candidates ont toutes été examinées | ✅ 20/20 (verdicts-20-fa.csv, 20 lignes de décision) |
| Chaque décision est justifiée | ✅ colonne `justification` remplie sur 20/20 |
| Aucun fichier source modifié | ✅ `slangSeedEnrichmentFa.ts` et les 3 autres fichiers fa/bn/ur restent hors diff git (inchangés depuis l'ouverture) |
| Les 6 601 identités sources restent intactes | ✅ `node audit-quality-shield/verifie-bouclier.mjs` : « Vérifiées : 6601 ; divergences : 0 » |
| Quality Shield classe correctement exemples et labels légitimes | ✅ vérification positive invariante : `isProvenanceTemplate` reconnaît bien le gabarit et les labels thématiques légitimes sont hors périmètre des métadonnées |

## 7. Décision de suivi recommandée

- **16 fiches** prêtes pour correction mécanique (retrait gabarit, corps Ex, contenu NON modifié) après **sign-off humain du contenu linguistique** (champ `context` inchangé, gabarit retiré).
- **4 fiches** : même retrait mécanique possible, mais **uniquement après revue linguistique humaine** : la traduction est parfois nuancée/divergente ; le retrait du gabarit ne préjuge pas de la décision linguistique.
- Une application mécanique du lot 2 suivra la méthode éprouvée du lot pilote (snapshot avant + script de vérification bit-à-bit dédié au gabarit fa + tests de non-régression). Décision distincte requise : **cette mission ne corrige aucune fiche**.
