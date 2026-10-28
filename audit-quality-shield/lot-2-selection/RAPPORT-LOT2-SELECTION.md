# LOT 2 — Sélection de la langue pilote fondée sur la qualité des exemples (fa / bn / ur)

Date : 24 octobre 2026 · Base : `main` @ `a77e233` · Réf. : [`../lot-pilote/RAPPORT-LOT-PILOTE.md`](../lot-pilote/RAPPORT-LOT-PILOTE.md) et [`../lot-pilote/validation-linguistique/ADDENDUM-1-CORRECTIONS-APPLIQUEES.md`](../lot-pilote/validation-linguistique/ADDENDUM-1-CORRECTIONS-APPLIQUEES.md)

Périmètre : **comparaison fa (221 fiches) / bn (235) / ur (197)** — 653 fiches analysées mécaniquement, **0 fiche modifiée**, aucun accès distant en écriture, aucun lancement de correction.

## 1. Méthode

- Analyse par un script dédié ([`analyse-trois-langues.mjs`](analyse-trois-langues.mjs)) sur les **données source réelles** (`src/convex/slangSeedEnrichment{Fa,Bn,Ur}*.ts`), lecture seule.
- Détection du gabarit technique=`[Époque…| [Niveau…| [Source…| [Ex: …]` (même règle d'ancrage que le lot pilote tl et le bouclier), extraction du **corps Ex verbatim** (du marqueur `[Ex:` jusqu'au `]` terminal), mesure de qualité :
  - phrase complete (heuristique : l'exemple est une chaîne citée entre `'…'` avec traduction) ;
  - traduction présente (deux formats reconnus : guillemets `« …»` — tagalog/ur — et **tiret `'…' - traduction`** fa/bn) ;
  - absence de commentaire méta mêlé à l'exemple (note après une traduction guillemetée) ;
  - provenance identifiable (segment `[Source: …]` conservé comme information, jamais produit dans le contexte nettoyé).
- Croisement avec la classification du Quality Shield (`classification-v3.csv`) : 203 fa / 156-bn / 156 ur MIXED.
- Échantillonnage et lecture post-métriques de 30+ fiches déjà candidates pour contrôler les faux positifs.
- **Distinction permanente** : les mesures mécaniques sont scripts ; les usages linguistiques fa/bn/ur exigent une validation humaine (aucune fiche n'est déclarée validée).

## 2. Comparaison fa / bn / ur

| Mesure (détectée mécaniquement) | fa | bn | ur |
|---|---|---|---|
| Fiches seed analysées | 221 | 235 | 197 |
| Fiches avec gabarit `[Époque…` | 203 | 158 | 97 |
| Corps Ex extractibles sans ambiguïté | **203 / 203** | 156 / 158 | 97 / 97 |
| Exemples avec traduction (guillemets `«…»`) | 1 | 2 | 10 |
| Exemples avec traduction (tiret `'…' - …`) | 173 | 32 | 47 |
| Exemples **sans traduction** (perte nette si extraction) | 47 (29 + 18 non extractibles) | **122** sans traduction + 79 non extractibles | 140 sans traduction + 100 non extractibles |
| Notes méta mêlées à l'exemple | 1 | 0 | 4 |
| Ensembles à tours multiples | 1 | 0 | 0 |
| **Candidates (corps Ex complet example + trad, verbatim)** | **172** | 34 | 53 |
| Taux de convertibilité (candidates / gabarit) | **85 %** | 22 % | 55 % (sur gabarit accentué) |
| Ecart avec le bouclier (MIXED) | 0 | +2 | −59 (voir §3) |

### Formats propres à chaque langue et exceptions

- **fa** : format dominant homogène `[Ex: 'exemple' - traduction française]`, la traduction après tiret **sans guillemets** — pas la règle du tl (guillemets), à conserver telle quelle après nettoyage (aucune perte). Une fiche à note méta, une à trad guillemetée, une multitours ; 29 sans traduction ; 18 non extractibles. Un sous-corpus lexical (`slangSeedEnrichmentFa4.ts` – igazatos « olduğu»... contient « culture ») avec gabarit **lexical** `[Label] | description. Ex: …` **sans segment [Époque] et avec une note culturelle riche** — **hors périmètre automatique** (l'extraction supprimerait une note culturelle solide type taarof).
- **bn** : mélange de formats ; 63 % des gabarits non extractibles ; 122 fiches sans traduction (les exemples bilingues bengali-anglais restent dans le champ `meaning` mais pas dans l'Ex) ; un gabarit lexical culturel riche dans `slangSeedEnrichmentBn4.ts` (recettes) — hors périmètre.
- **ur** : deux gabarits : **accentué** (le même que le tl, 97 fiches, la moitié à note méta + trad guillemets) et **deuxième format sans accent** `[Epoque: …] | [Source: …] | [Ex: texte translittéré]` — **sans guillemets ni traduction française**, invisible pour le bouclier (`Epoque` sans `É`) : c'est la source de l'écart 156 vs 97 du §2. Ce format est peu sûr pour l'extraction automatique (100 non extractibles détectés sur la base du gabarit accentué).

## 3. Langue recommandée : **fa (persan)**

Justification :

1. **Faible risque : 172 candidates incontestables (85 % des fiches à gabarit)**, format `'exemple' - traduction` très homogène, l'échantillon de 30 vérifiées sans faux positif.
2. **Bénéfice pédagogique le plus haut** : registre `casual/internet` cohérent, exemples naturels courts (une phrase), traduction idiomatic fr, provenance `[Source: Dictionnaire]` ou `% réseau`, popularity 62–94.
3. **bn est non-concurrent pour ce lot** : 34 candidates seulement (12 % du corpus auditable), formats incohérents, la plus grande partie sans traduction extractible + gabarit lexical culturel combré.
4. **ur est prometteur mais plus risqué** : le format accentué est solide, mais **l'écart inexpliqué avec le bouclier (156 MIXED vs 97 gabarits)** exige d'abord un décourage du « format sans accents » qui livre 100 non extractibles et 4 notes méta — un lot d'avance à préparer séparément (fix du protector critère, puis lot).

## 4. Audit des 20 candidates max (fa) — aucune modification appliquée

CSV complet : [`audit-lot2-fa.csv`](audit-lot2-fa.csv). Les 20 candidates, triées par popularity, toutes provenant de `slangSeedEnrichmentFa.ts` (16-35) — champ à modifier pour chacune : **`context` uniquement** (corps Ex verbatim : exemple + traduction conservés), le gabarit multi-segments retiré comme le lot tl :

| # | key (slug) | Ligne | Exemple proposé (Ex verbatim) | Popul. | Registre/Région | Décision |
|---|---|---|---|---|---|---|
| 1 | `fa:خالی بستن (khâli bastan)` | 16 | `'این‌قدر خالی نبند!' - Arrête de bluffer autant` | 82 | internet/Iran | candidate |
| 2 | `fa:پیچوندن (pichundan)` | 17 | `'منو پیچوند و نیومد' - Il m'a posé un lapin` | 84 | casual/Iran | candidate |
| 3 | `fa:سه‌سوت (seh soot)` | 18 | `'سه‌سوت میام!' - J'arrive en deux secondes` | 78 | casual/Iran | candidate |
| 4 | `fa:تیکه انداختن (tike andâkhtan)` | 19 | `'باز بهم تیکه انداخت' - Il m'a encore lancé une pique` | 80 | casual/Iran | candidate |
| 5 | `fa:آویزون (âvizun)` | 20 | `'خیلی آویزون شده' - Il est devenu très collant` | 74 | casual/Iran | candidate |
| 6 | `fa:سرِ کار گذاشتن (sar-e kâr gozâshtan)` | 21 | `'منو سرِ کار گذاشتی؟' - Tu me fais marcher ?` | 77 | casual/Iran | candidate |
| 7 | `fa:کِرم ریختن (kerm rikhtan)` | 22 | `'کرم نریز!' - Arrête de me chercher` | 73 | casual/Iran | candidate |
| 8 | `fa:تابلو (tâblo)` | 23 | `'تابلوئه که خسته‌ای' - Ça se voit que tu es fatigué` | 76 | casual/Iran | candidate |
| 9 | `fa:سوتی (sooti)` | 24 | `'یه سوتی دادم' - J'ai fait une gaffe` | 71 | casual/Iran | candidate |
| 10 | `fa:دهن سرویس کردن (dahan servis kardan)` | 25 | `'این ترافیک دهنمو سرویس کرد' - Ce trafic m'a achevé` | 69 | casual/Iran | candidate |
| 11 | `fa:باحال (bâhâl)` | 26 | `'این کافه خیلی باحاله' - Ce café est vraiment sympa` | 75 | casual/Iran | candidate |
| 12 | `fa:خفن (khafan)` | 27 | `'این آهنگ خفنه' - Ce morceau est génial` | 72 | casual/Iran | candidate |
| 13 | `fa:ضایع (zâye)` | 28 | `'خیلی ضایع شد' - C'était super gênant` | 70 | casual/Iran | candidate |
| 14 | `fa:خودمونی (khodemuni)` | 29 | `'خودمونی حرف بزن' - Parle sans chichis` | 68 | casual/Iran | candidate |
| 15 | `fa:خز (khaz)` | 30 | `'این لباس یکم خزه' - Cette tenue est un peu ringarde` | 67 | casual/Iran | candidate |
| 16 | `fa:اسکل (oskol)` | 31 | `'اسکل‌بازی درنیار' - Ne fais pas l'idiot` | 66 | casual/Iran | candidate |
| 17 | `fa:کف کردم (kaf kardam)` | 32 | `'قیمتشو دیدم، کف کردم' - J'ai vu son prix, j'étais sidéré` | 65 | casual/Iran | candidate |
| 18 | `fa:لش (lash)` | 33 | `'امروز فقط لش کردم' - Aujourd'hui j'ai juste végété` | 64 | casual/Iran | candidate |
| 19 | `fa:جوگیر (jo-gir)` | 34 | `'جوگیر نشو' - Ne t'emballe pas` | 63 | casual/Iran | candidate |
| 20 | `fa:فاز (fâz)` | 35 | `'چه فازیه؟' - C'est quoi ce délire ?` | 62 | casual/Iran | candidate |

Risque identique pour les 20 : **faible — corps Ex (exemple + traduction) copié verbatim, gabarit retiré (règle tl validée)**, aucun motif d'exclusion ne s'applique (aucune note méta, traduction présente, phrase unique).

### Exclusions (blocs hors périmètre de ce lot, à plus tard ou à revue humaine)

- **fa sans traduction** (29 + 18 non extractibles) : extraction risquée de perte de contenu utile.
- **fa lexical culturel Fa4** (taarof, befarma, mobarak, eshan…) : le contexte déroule une note culturelle détaillée après « `Ex: …`. » — toute extraction la briserait ; revue humaine requise pour le format.
- **fa note méta** (1) et **multitours** (1) : perte/incohérence possible.
- **bn** : 122 fiches sans traduction, 79 non extractibles et le gabarit lexical culturel `Bn4` — le lot de 34 candidates est décidable ultérieurement, mais il ne rivalise pas avec fa sur ce cycle.
- **ur** : 53 candidates au format accentué mécaniquement sûres, MAIS 4 notes méta (revue humaine obligatoire), ~100 fiches du format `[Epoque…` sans accent non extractibles sans perte (guillemets et traduction absents de la source), et ce second gabarit est **invisible du Quality Shield** (il cherche `Époque` avec accent) — d'où l'écart 156 MIXED vs 97 gabarits détectés.
  ➜ **Lot séparé recommandé, après correction du détecteur** : aligner le bouclier sur le format sans accent, puis préparer un lot ur sur le gabarit accentué uniquement.

## 5. Contrôles de structure réalisés (script + observation)

1. Extraction `corpsEx` identique au lot tl (anchor `| [Ex:` + jusqu'au `]` final), appliquée aux 653 fiches ; 0 perte pour les 172 candidates fa (la traduction est incluse).
2. Classification par format (guillemets / tiret / sans traduction / note méta / multitours), détection faux positifs échantillonnée à la main (30+ fiches).
3. Croisement avec `classification-v3.csv` (tables MIXED), écarts expliqués (gabarit non accentué ur, gabarit lexical fa/bn).
4. Contrôle faisabilité : **aucune fiche modifiée**, lecture seule.
5. Intégrité du dépôt : `git status` identique à l'ouverture de la session (aucune donnée source modifiée) ; les 4 fichiers fa/bn/ur de seed sont bit-à-bit inchangés (aucun diff).

## 6. Limites linguistiques

1. **Validation documentaire uniquement** : aucune fiche fa/bn/ur n'a été validée par un locuteur compétent ; `validated: false` reste en place.
2. **Traduction au format « tiret »** (`'…' - trad`) : style différent du tagalog (`'…' « trad »`) mais sans perte ; à valider pédagogiquement par le humain avant d'appliquer.
3. **Sources d'exemples** : `[Source: Dictionnaire]` — la fiche fait confiance à une source locale diffuse, la « validation documentaire » externe (comme le tl) devra re-list.
4. **Bouclier ur insensible au gabarit sans accent** : le format `[Epoque…` sans accent n'est pas détecté par le bouclier (il cherche `Époque`) ; une correction de ce détecteur sera nécessaire si ur passe au lot 3.

## 7. Prochaine action recommandée

1. **Sign-off humain pour les 20 candidates fa**, puis application mécanique : retrait du gabarit multi-segment dans champ `context` (corps Ex verbatim), avec (a) `corrections-lot2-fa.json` (traces before/after), (b) tests de non-régression tl/fa, (c) verification bouclier + corpus 6 601 (idem lot tl).
2. **Validation linguistique** des fiches fa corrigées (méthode du rapport tl : sources gratuites, bilingual, local) et revue humaine du sous-ensemble selon nuances.
3. **ur avant bn** : lisser l'écart bouclier (`É Epoque` — inspecter le bouclier source), préparer le lot 3 sur le format accentué (53 candidates confirmées) seulement après.
4. **bn** : attendre que le format des 122 sans traduction soit coupé.

**Aucune fiche modifiée. Aucun commit, push, déploiement, semis ou accès distant en écriture pour ce lot 2 — audit et rapport uniquement.**
