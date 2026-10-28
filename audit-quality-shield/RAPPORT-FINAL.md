# QUALITY SHIELD — Rapport final (PROMPT 1)

**Date : 24 octobre 2026 · Base : `main` @ `a77e233` (16 commits locaux, aucun push)**

## 1. Classification fiable (classification-v3.csv — 6 601 fiches)

Reclassification exhaustive par signature et par langue sur les sources
actuelles (`src/convex/slangSeed.ts` + `slangSeedEnrichment*`). Chiffres
**validés** (remplacent les 253/826/0/125 provisoires, dont les détecteurs
comptaient un seul mot entre guillemets comme « exemple complet ») :

| Catégorie | Définition (règle explicite) | Nombre |
|---|---|---|
| LABEL | Label pédagogique ou contenu libre légitime → affiché **intact** (ex. `[Télétravail] | Travail depuis son domicile. Ex: '…'`) | 5 397 |
| MIXED | Gabarit de provenance `[Époque:…]\|[Niveau:…]\|[Source:…]` **avec** un segment `Ex` portant un **exemple complet** → l'exemple seul est affiché, sans le gabarit | 1 184 |
| DIRECTIVE | Segment `Ex` = consigne interne (`à compléter`, `non fourni`, `n/a`, `TODO`, `phrase-exemple à valider`…) → masqué | 13 |
| AMBIGUOUS | `Ex` douteux (token isolé sans ponctuation, < 5 points de code) → masqué, **aucune invention, aucun tronquage silencieux** | 6 |
| PURE | Gabarit sans contenu exploitable → masqué | 1 |

Répartition dans `repartition-v3.json` ; ligne par ligne dans
`classification-v3.csv` (`unique_key, language, expression, category,
signature, ex_extracted, ex_complete, context`).

**Définition « exemple complet » (indices structurels mesurés, aucune
validation linguistique)** : après retrait des guillemets décoratifs,
longueur ≥ 5 points de code ET (≥ 2 tokens Unicode `\p{L}\p{N}` OU 1 token
avec ponctuation finale). Les cas douteux vont en revue humaine (AMBIGUOUS
→ masqué, jamais rendu).

## 2. Divergences audit ↔ bouclier, assumées et documentées (2)

- `tl:Ghosted` — faux positif de l'ancien audit (ancre `n/a` laxiste qui
  capturait « Na-… ») ; « Na-ghosted ako » = 2 tokens → exemple réellement
  affichable. L'ancre du bouclier est resserrée (`n/a` seul ou suivi d'un
  signe).
- `ig:Oringo` — le bouclier cache aussi le commentaire « définition du fil
  » (source de fil, pas un exemple pédagogique) ; convention d'extraction
  élargie, documentée.

## 3. Cas ambigus (7) — masqués par prudence, revue humaine recommandée

`tl:Estetik` (traduction tronquée dans la source), `bn:Tomader` (citation
d'un seul mot `'Tomader'`), `tl:Lag` (`Nakaka-lag`), `tl:GG`, `tl:Teaser`,
`tl:Behind-the-scenes` (acronymes/réductions isolés), `bn:ছাপড়ি` (gabarit
sans contenu exploitable). Aucun de ces contenus n'est montré à
l'apprenant ; aucune donnée source n'est réécrite.

## 4. Chemins de rendu — tous les sites `context` protégés

Point partagé : `displayContext(src/lib/pedagogicalContext.ts)`.
`ContextParser` applique d'abord le bouclier, puis le parse du format
pédagogique structuré `[Sens littéral] | [Sens réel] | [Ex] | [Note]` ;
fallback = chaîne **protégée** (jamais la brute).
Raccordements (bouclier au point d'affichage) :

- Atlas, DailySlangCard, DiscoverView, ExpressionDetailCard (exemple +
  bloc culturel), MemoryView, ReviewView, SearchBar — déjà faits ;
- **ContextParser** — délègue à `displayContext` puis parse structuré ;
- ShadowView — campus « argot détecté » (`displayContext(hit.context)`)
  et fiche enrichie via `ExpressionDetailCard` (protégé en amont) ;
- SubtitlePanel — `entry.context` (ligne méta) et `ContextAccordion`
  (bouton + contenu masqués ensemble si `displayContext` renvoie null) ;
- SubtitleImportPanel — hits de sous-titres importés ;
- MediaRoomView — onglet « argot » des médias.

Aucune voie d'affichage direct de `context` brut ne subsiste
(`grep` de contrôle effectué sur `src/components/learner` et
`src/components/media`). La logique SRS/Discover existante est préservée
(`srs.test.ts`, `discoverDeckState.test.ts` etc. intacts).

## 5. Fichiers modifiés pour le Shield uniquement

- `src/lib/pedagogicalContext.ts` — bouclier final (transitif, Unicode
  `\p{L}\p{M}\p{N}`, pur : ne mute ni le seed ni les objets Convex) ;
- `tests/pedagogicalContext.test.ts` — 14 tests : gabarits purs,
  provenance + exemple, expression unique citée, labels légitimes,
  format structuré, vide, Unicode (arabe, chinois, thaï, bengali,
  vietnamien), repli ambigu, pureté ;
- `src/components/learner/ContextParser.tsx` — bouclier en tête, parse
  structuré conservé, fallback protégé ;
- les 5 sites de fuite listés au §4 (ShadowView, SubtitlePanel,
  SubtitleImportPanel, MediaRoomView) ;
- `slangSeedEnrichmentTl4.ts` / `Ur2.ts` ouverts en lecture seule
  seulement (aucune réécriture massive des 6 601 fiches).

## 6. Résultats de tests (statiques ; aucun test navigateur physique)

- suite complète : **329 passés, 2 ignorés volontairement, 0 échec**
  (24 fichiers) — identique à la baseline connue ;
- tests du bouclier : 14/14 ;
- vérification croisée bouclier ↔ audit sur les 6 601 fiches
  (`verifie-bouclier.mjs`, esbuild bundle réel du TS, comparaison
  classification-v3) : **0 divergence** ;
- typecheck `tsc -b --noEmit` : OK ;
- lint ESlint sur les fichiers touchés : 0 erreur nouvelle (les erreurs
  préexistantes du dépôt — imports inutilisés, `setState`-in-effect,
  deps `useEffect` — sont hors des lignes modifiées et sont inchangées) ;
- build `vite build` : OK (avertissements de chunk préexistants).

## 7. Limites restantes

1. Les 7 fiches AMBIGUOUS/PURE attendent une revue humaine (§3).
2. Test navigateur React (clic réel sur Discover, Shadow, sous-titres)
   non exécuté — possibilité de recette manuelle sur Preview.
3. Deux divergences assumées documentées (§2) : décision humaine de les
   garder / aligner sur l'audit.
4. Rien n'est committé, poussé, déployé ; aucune écriture Convex.

# QUALITY SHIELD VALIDÉ
