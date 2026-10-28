# Limites et bilan de sûreté — validation finale des 20 candidates persanes (lot 2)

Date : 24 octobre 2026 · Réf. : [RAPPORT-VALIDATION-FINALE.md](RAPPORT-VALIDATION-FINALE.md) · [SOURCES-LINGUISTIQUES.md](SOURCES-LINGUISTIQUES.md)

## 1. Nombre de fiches réellement sûres pour une correction mécanique

| Sous-ensemble | Nb | Définition |
|---|---|---|
| **Extraction mécaniquement sûre** | **20/20** | la règle fa identifie la provenance sans ambiguïté, le persan et la traduction sont conservés verbatim, aucun résidu de gabarit (preuves dans `avant-apres-20-fa.json`) |
| **Sûres + contenu linguistique confirmé par ≥ 1 source** | **16/20** | sens et usage recoupés par une source gratuite d'argot persan (majoritairement 2 sources) |
| **Extraction sûre mais revue linguistique humaine requise avant application** | **4/20** | `khâli bastan`, `kerm rikhtan`, `dahan servis kardan`, `fâz` — divergence de sens ou adaptation de traduction à trancher par un natif |
| Exclues de ce lot | 0/20 | aucune |

**Bilan** : *16 fiches* peuvent recevoir le retrait du gabarit dès le sign-off humain sans réécriture de contenu ; *4 fiches* exigent d'abord une confirmation bilingue (leur retrait mécanique reste inchangé et documenté, mais la décision de les inclure dans le lot appliqué dépend de la revue).

## 2. Limites de la validation

1. **Aucune validation par locuteur natif.** Les sources sont toutes des ressources documentaires gratuites (blogs pédagogiques, dictionnaires en ligne, Wiktionary). La distinction persan standard / registre familier / slang repose sur les libellés explicites des sources, pas sur l'oreille d'un natif. Le statut `validated: false` des 20 fiches reste inchangé.
2. **Divergences documentées, jamais arbitrairement tranchées** (§4 du rapport) : `khâli bastan` (bluffer vs mentir), `kerm rikhtan` (taquiner vs « me chercher »), `dahan servis kardan` (registre potentiellement vulgaire), `fâz` (mood/vibe vs « délire »), `zâye` (sens standard « gâché » coexistant avec le slang « cringe » — la fiche est correcte mais mérite d'être lue en connaissance de cause), `bâhâl`/`khafan` (étiquette slang/colloquial variable selon la source).
3. **Étymologies actives non tranchées.** La relation `khafan` ↔ `khafe` (« suffocation ») est donnée comme hypothèse par deux sources, pas comme une étymologie établie ; le littéral « étouffant » de la fiche peut être reformulé si le natif tranche autrement.
4. **Régionalisme** : plusieurs sources décrivent le parler de Téhéran ; les usages afghan (dari) et tadjik, et l'argot de la diaspora, peuvent diverger. La colonne `region` des fiches dit « Iran » (4 fiches « Monde persanophone » hors lot) — correct au regard des sources, mais à relativiser pour un public plus large.
5. **Répartition de popularité obsolète.** Le CSV d'audit initial (`../audit-lot2-fa.csv`) laissait la colonne `popularity` vide (bug mineur du script d'analyse d'origine : valeur non procédée au tri). Les valeurs fiables sont celles de la source (`slangSeedEnrichmentFa.ts`, reprises dans `verdicts-20-fa.csv`) et équivaux aussi au tableau du rapport d'origine. Par ailleurs, l'ordre du CSV d'audit est l'ordre du fichier (lignes 16-35), pas un tri par popularity décroissante — sans effet sur le contenu audité, mais à connaître pour la traçabilité.
6. **Diff préexistant hors périmètre** : `src/convex/slangSeedEnrichmentUr2.ts` porte un diff de 2 fiches déjà présent à l'ouverture de la session de travail (documenté au rapport lot 2 §5) ; il n'a pas été touché par cette mission et reste à traiter séparément.
7. **Format ur sans accent non concerné ici** : le second gabarit ourdou `[Epoque…` (sans accent) reste invisible du Quality Shield ; c'est un chantier distinct (fix du détecteur), qui ne bloque pas ce lot fa.

## 3. Contrôles d'intégrité exécutés (aucune donnée modifiée)

- Lecture seule des 4 fichiers fa/bn/ur : **aucun diff détecté sur `slangSeedEnrichmentFa.ts`** ni sur les autres fichiers de la langue fa.
- Corpus complet : `verifie-bouclier.mjs` → **6 601 fiches vérifiées, 0 divergence**, greffe du bouclier intacte.
- 20/20 candidates passent la règle fa dans `dump-candidats-fa.mjs` (le script **aborte avant toute écriture** si une fiche ne s'aligne pas ; aucune anomalie constatée).
- Aucun commit, aucun push, aucun déploiement, aucun semis, aucun accès distant en écriture.
