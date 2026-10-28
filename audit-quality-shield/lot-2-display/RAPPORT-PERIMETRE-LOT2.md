# Kɪ́LINGO — RÉCONCILIATION FINALE DU PÉRIMÈTRE DU LOT 2 (rapport, aucune modification)

Date : 2026-10-25 · Mode : lecture seule (aucune écriture source, aucun commit, aucun déploiement).

---

## 1. État actuel vérifié (examen du code, pas des rapports)

### 1.1 Git

- Racine du repo : `kilingo/` (détaché du workspace général).
- Branche : `main`.
- HEAD : `a77e2335caeeb51d504223fff4dabec9daa715a6` — « feat(seed): ponts culturels désactivés par défaut — opt-in strict --include-cross-concepts ». Dernier commit sur les seeds FA/TL : `4693586` (2026-10-15, « Phase 5 & 6 complete … Urban Dictionary Pro context formatting »).

### 1.2 `git status --short` (fichiers source uniquement)

```
 M src/components/learner/ContextParser.tsx   ← lot 1, non commité
 M src/convex/slangSeedEnrichmentFa.ts        ← corrections FA (34 l. ±)
 M src/convex/slangSeedEnrichmentTl.ts        ← corrections TL (38 l. ±)
 M src/pages/Landing.tsx                      ← lot 1, non commité
?? src/lib/discoverDeckState.ts
?? src/lib/pedagogicalContext.ts              ← bouclier v3 (lot 1)
?? src/lib/reviewSessionTracker.ts
```

### 1.3 Conformité des lots persan / tagalog

- Les corrections FA/TL sont **toujours présentes en working tree** (non committées) au-dessus de `4693586` : le diff montre la conversion des gabarits `[Époque…|Niveau…|Source…|Ex…]` verso l'exemple nu `'…' - traduction` pour les fiches corrigées, avec conservations attendues (ex. `کِرم ریختن` toujours en gabarit). Conforme aux références documentées dans `audit-quality-shield/lot-2-selection/lot-application/`.
- Aucun SHA n'a régressé depuis le dernier état documenté (HEAD inchangé, corrections encore en place).

### 1.4 `src/lib/pedagogicalContext.ts` (relecture intégrale, 185 l.)

Comportement confirmé, inchangé par rapport au lot 1 validé :

- `displayContext(text)` : `null` si vide ; **rendu intact** si le texte ne commence pas par `[` (libre / label sans crochet en tête) ou si < 2 segments `[Clé: …]` de provenance pleins en tête (LABEL légitime) ;
- gabarit confirmé (`lead ≥ 2`) : PURE → `null` ; MIXED → le contenu du segment `[Ex: …]` ou de la partie libre finale (es/pt), **sans le gabarit**, uniquement si « exemple complet » (≥ 5 pts de code, ≥ 2 tokens Unicode ou token + ponctuation finale) et pas consigne ; DIRECTIVE / AMBIGUOUS / EMPTY → `null` ; structure inattendue (≥ 2 parties libres) → `null`.- Clés de provenance reconnues : `Époque, Epoque, Niveau, Source, Ex, Exemple, Période, Periode, Registre, Origin, Langue, Note` (casse+diacritiques insensibles, `:` et `：` équivalents). Tokenization `\p{L}\p{M}\p{N}` → Unicode complet garanti.
- Le module ne fait que de la PRÉSENTATION : il ne touche jamais la donnée stockée ni les objets Convex, et renvoie la valeur filtrée — jamais la chaîne brute dans un fallback.
- `isProvenanceTemplate()` est exporté et utilisé par les tests de non-régression.

Points d'entrée qui consomment déjà le bouclier (lot 1) :

| Point d'entrée | Mécanisme |
|---|---|
| `src/components/learner/ContextParser.tsx` (l. 90) | `const shown = displayContext(context)` → parse de `shown`, jamais de `context` brut |
| `src/pages/Landing.tsx` (l. 423, 605) | `displayContext(active.context)` / `displayContext(card.context)` |
| Tests : `tests/pedagogicalContext.test.ts`, `tests/shieldDisplayLot1.test.ts`, `tests/lotPiloteTl.test.ts` | verdicts sur `displayContext()` |

### 1.5 Chemins indirects déjà protégés — à NE PAS doubler

| Fichier | Ligne | Justification |
|---|---|---|
| `ConceptDetailView.tsx` | 80-82 | `{entry.context && (<ContextParser context={entry.context} />)}` — le composant applique le bouclier en interne. Doublon inutile. |
| `DiscoverView.tsx` | 123 | `<ContextParser context={item.context} …/>` — idem (carte de découverte). |
| `Landing.tsx` | 423, 605 | `displayContext()` direct — déjà protégé. |

---

## 2. Inventaire exhaustif des occurrences `context` dans `src/` (recherche greppée, fichiers .ts/.tsx deux fois vérifiés)

### 2.1 Occurrences de rendu DIRECT NON PROTÉGÉ (à protéger — périmètre lot 2)

| # | Fichier | Ligne(s) | Ce qui est rendu | Catégorie |
|---|---|---|---|---|
| R1 | `src/components/learner/Atlas.tsx` | 177-178 | `row.context` dans une carte de résultat d'argot (`line-clamp-2`) | Affichage visible de contexte brut |
| R2 | `src/components/learner/Atlas.tsx` | 1055-1066 | `head.context` passé à `<ExpressionCultureBlock>` (section « Contexte culturel » de la vue dico) | Affichage visible via composant tiers |
| R3 | `src/components/learner/ExpressionDetailCard.tsx` | 107 (`const example = culture?.example ?? context`), rendu vers l. 141-149 | `context` affiché sous l'étiquette « Contexte » dans la fiche enrichie | Affichage visible de contexte brut |
| R4 | `src/components/learner/ShadowView.tsx` | 1791-1793 | `hit.context` dans la mini-carte d'expression détectée en video | Affichage visible de contexte brut |
| R5 | `src/components/media/MediaRoomView.tsx` | 1330-1331 | `h.context` dans l'onglet « argot détecté » des media | Affichage visible de contexte brut |
| R6 | `src/components/learner/SubtitleImportPanel.tsx` | 420-421 | `hit.context` après import de sous-titres | Affichage visible de contexte brut |
| R7 | `src/components/learner/SubtitlePanel.tsx` | 77 | `entry.context` en grande ligne mono (méta « définition » du dictionnaire contextuel) | Affichage visible de contexte brut |
| R8 | `src/components/learner/SubtitlePanel.tsx` | 162-178 (composant interne `ContextAccordion`), appelé à 355 | `active.context` rendu en plein dans l'accordéon « Définition » | Affichage visible de contexte brut |
| R9 | `src/components/learner/DailySlangCard.tsx` | 143-145 | `card.context` en italique « « … » » sous le sens | Affichage visible de contexte brut |
| R10 | `src/components/learner/DiscoverView.tsx` | 783 | `e.context` dans la liste « base » scrollable (onglet base de découverte) | Affichage visible de contexte brut |
| R11 | `src/components/learner/MemoryView.tsx` | 527-529 | `slang.context` dans la grille de cartes mémoire | Affichage visible de contexte brut |
| R12 | `src/components/learner/ReviewView.tsx` | 313 | `current!.slang.context` intégré dans `t("review.hintAssisted")` (« 💡 Indice : {c} ») AVANT réponse, mode assisté | Affichage visible de contexte brut |
| R13 | `src/components/learner/ReviewView.tsx` | 357 | `current!.slang.context` après révélation | Affichage visible de contexte brut |
| R14 | `src/components/learner/SearchBar.tsx` | 427 | `row.context` dans le panneau déplié de résultat de recherche | Affichage visible de contexte brut |

### 2.2 Occurrences de logique, données ou exports — À PRÉSERVER TELLES QUELLES

| Fichier | Ligne(s) | Usage | Catégorie |
|---|---|---|---|
| `DiscoverView.tsx` | 47 | `context: string` (type de la carte) | Signature de type |
| `MemoryView.tsx` | 271 | filtre recherche locale : `(slang.context ?? "").toLowerCase().includes(q)` | Recherche/filtrage interne |
| `MemoryView.tsx` | 335 | export CSV : `example: slang.context ?? ""` | Export |
| `SearchBar.tsx` | 190, 206, 433 | mapping des rows depuis Convex + condition `(row.example || row.context)` pour afficher la ligne méta | Logique de mapping / condition |
| `Atlas.tsx` | 97 | type `context: string` du row slang | Signature de type |
| `Atlas.tsx` | 492-530 | `isRealSentence(first.context)` — garde métier contre les libellés d'import à l'écriture du dictionnaire | Logique métier (écriture) |
| `Atlas.tsx` | 545, 560-571 | `context: dict.entry.context`, `contextRaw`, autos `useLocalizedText(...)` pour la traduction dynamique A2 | Logique de localisation || `SubtitlePanel.tsx` | 75, 78 | condition d'affichage et séparateur `·` | Logique de condition | `ShadowView.tsx` | 1835 | `context={hit.context}` passé à `<ExpressionDetailCard>` | Pass-through (rendu réel chez ExpressionDetailCard = R3) |
| `SearchBar.tsx` / `lib/dictionary.ts` | 62, 80, 138 | mapping des résultats de dictionnaire (données client) | Données |
| `lib/dailySlang.ts` | 33, 45, 116 | mapping du calendrier du slang du jour (données) | Données |
| `convex/*` (`slang.ts` 283/401/417 ; `learning.ts` 82/433 ; `subtitles.ts` 43/48/52/59 ; `media.ts` 93/325/355/611 ; `youtubePipeline.ts` 586-622/751/1025 ; `aiConversation*` ; `dynamicDict.ts` 112/167 ; `dynamicMemory.ts` 77-78 ; `crossSeed.ts` 883 ; `textTranslate.ts` 158 ; `dailySlang.ts`) | — | handlers serveur : stockage, fetch, correction, pipelines | Logique métier serveur |

### 2.3 Usage volontairement brut, justifié

- `youtubePipeline.ts` l. 586-622 : `context` stocké par le pipeline Node pour les `_src` locaux, non stratégique pédagogiquement, servant de « langue source interne », jamais rendu côté client sans passer par un des rendus listés en §2.1.

---

## 3. Périmètre définitif du lot 2

### 3.1 Composants à modifier (6, pour 14 emplacements)

| Composant | Emplacement | Changement minimal | Test ciblé |
|---|---|---|---|
| `Atlas.tsx` | l. 177-178 | filtrer uniquement la valeur rendue : `{row.context && displayContext(row.context) && (<p …>{displayContext(row.context)}</p>)}` ou via une variable `const shown = displayContext(row.context)` | rendu de gabarit PURE/DIRECTIVE/AMBIGUOUS masqué, MIXED → exemple seul, LABEL/libre → intact |
| `Atlas.tsx` | l. 1055-1066 + `ExpressionDetailCard.tsx` l. 105-107 | appliquer le bouclier **chez le consommateur final** (`ExpressionCultureBlock` : `const example = culture?.example ?? displayContext(context)`), de sorte que **les 3 passeurs** (Atlas 1066, ShadowView 1835, ShadowView direct) soient couverts d'un coup | gabarit P/D/A → aucun bloc « Contexte » ; MIXED → exemple seul ; Blur/LIBRE intact |
| `ShadowView.tsx` | l. 1791-1793 | `const shown = displayContext(hit.context)` avant le `{shown && …}` | idem, essais sur les enregistrements ig/am |
| `MediaRoomView.tsx` | l. 1330-1331 | idem, sur `h.context` | gabarits internes (lots es/pt) — vérifier qu'aucun gabarit n'apparait |
| `SubtitleImportPanel.tsx` | l. 420-421 | idem, sur `hit.context` | gabarits ig « phrase-exemple non fournie » |
| `SubtitlePanel.tsx` | l. 77 + l. 162-178 | `ContextAccordion` : appliquer `displayContext` à `context` en tête du composant ; l. 77 : filtrer la ligne mono avec `displayContext(entry.context) ?? ""` (la donnée sert d'accroche visuelle, masquer le gabarit) | accordéon inert sur gabarit PURE ; exemple seul sur MIXED |
| `DailySlangCard.tsx` | l. 143-145 | `const shown = displayContext(card.context)` et wrapper le span | énigme du jour : aucun gabarit ficelé |
| `DiscoverView.tsx` | l. 783 | `const shown = displayContext(e.context)` dans la liste base | gabarits fa « Niveau: VÉRIFIÉ » masqués |
| `MemoryView.tsx` | l. 527-529 | `const shown = displayContext(slang.context)` (le filtre de recherche l. 271 et l'export l. 335 restent bruts) | cartes mémoire : jamais de `[Époque` |
| `ReviewView.tsx` | l. 313 + l. 357 | `const shown = displayContext(current!.slang.context)` calculé une fois par carte ; `t("review.hintAssisted", { c: shown ?? "" })` et `<p>{shown}</p>` (si `shown === null` : pas de hint, pas de ligne) | mode assisté : gabarit → aucun indice, cadre purement en cas MP |
| `SearchBar.tsx` | l. 427 | `const shown = displayContext(row.context)` dans le panneau déplié | recherche : gabarits jamais visibles, exemple seul pour MIXED |

### 3.2 Problème structurel réglé d'un coup en modifiant `ExpressionCultureBlock`

- `ExpressionDetailCard.tsx` reçoit `context` depuis 3 appels distincts (Atlas 1066, ShadowView 1835, ShadowView direct liste). Placer le bouclier chez `ExpressionCultureBlock` (ligne 107), i.e. au point où `context` devient `example` rendu, règle d'un seul geste les 3 chaînes sans modifier les 3 appelants ni dupliquer la logique.
- Preuve que `ExpressionDetailCard.tsx` **nécessite bien une modification aujourd'hui** (contrairement à son absence de la dernière liste) :
  - l. 107 : `const example = culture?.example ?? context;` — la valeur brute est wrappée telle quelle dans l'affichage (l. 141-149 : `<p …>{example}</p>`);
  - aucun import de `displayContext` dans ce fichier (`grep -n "displayContext" → 0 hits`);
  - les gabarits fa (ex. `[Époque: classique] | [Niveau: VÉRIFIÉ] | [Source: Dictionnaire]`) et leurs répétions provenant des seeds pas encore corrigés, plus les fiches « _src: local » du pipeline vidéo, remontent intacts jusqu'à ce rendu.
- `ConceptDetailView.tsx` : **aucune modification** — doublement démontré inutile (§1.5).

### 3.3 Usages internes qui restent volontairement bruts (non à protéger)

1. `MemoryView.tsx` l. 271 — recherche locale de l'apprenant (string-matching dans le champ de l'apprenant). Ne pas filtrer, sinon des fiches deviennent introuvables.
2. `MemoryView.tsx` l. 335 — export CSV : appliquer le bouclier ici écraserait l'export avec des données masquées (`null → ""`). Exporteur = source de vérité brute assumée.
3. `SearchBar.tsx` l. 190/206/433 — données de mapping et conditions de méta (présence de region/register).
4. `Atlas.tsx` l. 492-530 (`isRealSentence`), l. 545, l. 560-571 (localisation A2) — logique métier : le filtrage ne doit JAMAIS être appliqué à la variable à plusieurs fins ; uniquement à la valeur destinée au rendu.
5. Tous les fichiers `src/convex/*` — serveur uniquement, jamais rendu HTML.
6. Test **non-modifiés** à conserver tels quels : `tests/pedagogicalContext.test.ts`, `tests/shieldDisplayLot1.test.ts`, `tests/lotPiloteTl.test.ts` — ils testent le module, pas le rendu.

### 3.4 Risques de régression (par famille)

| Risque | Origine | Mitigation |
|---|---|---|
| Perte d'affichage légitime | `displayContext()` masque tous les contextes qui commencent par un crochet simple non reconnu comme provenance (`[Foo] texte`, sans `:` en tête) | le guard `lead < 2 → raw` existe déjà et retourne intact ; rejouer les 3 suites de tests du bouclier (lot 1) avant/après |
| Double wrap | filtrer deux fois via pass-through (ex. `Atlas.tsx` l. 1066 ET `ExpressionCultureBlock` l. 107) | ne filtrer qu'**au point de rendu final** (ExpressionCultureBlock) ; laisser le pass-through brut |
| Différence pédagogique silencieuse | un contexte dispose d'un exemple éditorial (`culture.example`) : le bouclier s'applique alors à un contenu non affiché | tester explicitement : gabarit + `culture` → exemple éditorial intact (le `??` protège déjà) ; les fiches éditorialisées fragilisées restent rendues |
| Texte bilingue / localisation A2 dans Atlas | `contextRaw` → traduction (`useLocalizedText`) : le bouclier ne doit couvrir que le **contexte affiché ET non traduit** (l. 1066), pas la traduction (l. 569) qui est déjà du texte transcrit | tests de revue manuelle sur la vue dico A2 |
| Enfants non remontés dans DiscoverView l. 783 (`e.context`) | liste « base » (data brutes de l'argot de bound `slang`), format de gabarits fa/es/pt — risque de regression visuelle si l'on oublie | retest sur 3 langues (fa « VÉRIFIÉ », es « Ex: '…' », tl) |
| Régression visuelle du card MemoryView | la carte est contrainte `line-clamp-2` : gabarit masqué = carte plus courte | copie visuelle, non bloquant |

---

## 4. Tests prévus (à écrire dans un lot suivant, aucun écrit aujourd'hui)

- **Suite module** (existe déjà, à rejouer) : `tests/pedagogicalContext.test.ts`, `tests/shieldDisplayLot1.test.ts`, `tests/lotPiloteTl.test.ts` — verdissement attendu en l'état.
- **Suite de composants** (à écrire, lot 2) : un test par famille de gabarit (PURE / MIXED / DIRECTIVE / AMBIGUOUS / LABEL / LIBRE) sur chaque composant §3.1, via bun test + React testing runtime réel comme le lot 1 a déjà le pattern.
- **Suite d'intégration data** : conserver l'invariant `MemoryView` l. 271/335 — la base interne reste brute.
- **Screenshot / recette CDP** sur : DiscoverView « base » (fa), ReviewView assisté (es), MediaRoomView onglet argot (ig), Atlas fiche enrichie / view dico (fr) — même protocole que le lot 1.

---

## 5. Incertitudes restantes

1. **`SubtitlePanel.tsx` l. 77 / l. 162-178** : les entrées proviennent de trois sources ; seules les entrées issues de la base d'argot peuvent porter un gabarit de provenance, mais rien n'empêche l'utilisateur d'avoir aussi un `context` dictionnaire libre contenant « | ». Décision prise : bouclier activé (catégorie « affichage visible »). Revue visuelle à faire sur la 3/4 lignes méta (impact : disparition éventuelle de la ligne mono si la source n'était qu'un gabarit).
2. **`ReviewView.tsx` l. 313 (hint assisté)** : si le bouclier renvoie `null`, l'indice assisté devient indiscernable du mode auto (l'utilisateur passe d'un mode avec indice à un mode sans) — c'est cohérent avec la mission (aucun gabarit), mais peut changer la mécanique d'apprentissage. Alternative possible : afficher un placeholder neutre — non retenu (mission interdit l'invention).
3. **`ExpressionCultureBlock` example slot** : si une fiche a un gabarit AMBIGUOUS mais aussi une `culture` éditoriale, `culture.example` prime — aucun changement visuel. Confirmé par le `??`.
4. **Étendue de `displayContext`** : les fiches « _src: local » (dictionnaire dynamique) ne sont pas réellement des gabarits de provenance, mais elles peuvent contenir des « | » libres. Le guard «lead < 2 → raw» les rend intactes — conformité OK mais revue manuelle recommandée sur la vue dico.
5. **Chevauchement entre R2 (Atlas / vue dico) et R3** : ces deux emplacements passent par le même rendu final (`ExpressionCultureBlock`) ; une seule modification couvre les deux, aucun masque supplémentaire requis.

---

## 6. Arrêt

Le rapport est déposé à `audit-quality-shield/lot-2-display/RAPPORT-PERIMETRE-LOT2.md`.
**Aucune modification source n'a été appliquée.** En attente d'instruction pour implémenter le lot 2.
