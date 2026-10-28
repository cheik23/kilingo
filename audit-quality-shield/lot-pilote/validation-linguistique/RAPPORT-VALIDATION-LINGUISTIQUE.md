# Validation linguistique du lot pilote tagalog (Prompt 3)

Date : 24 octobre 2026 · Base : `main` @ `a77e233` · Réf. : [`../RAPPORT-LOT-PILOTE.md`](../RAPPORT-LOT-PILOTE.md)

Périmètre : les **19 fiches corrigées** du lot pilote (`src/convex/slangSeedEnrichmentTl.ts`, lignes 43-70). Objectif : valider le **contenu pédagogique**, pas refaire l'extraction.

## 1. Méthode

- Relecture de chaque fiche dans la source corrigée (expression, `literal`, `meaning`, `context` corrigé, `register`, `region`, `popularity`, `validated: false` inchangé).
- Trois recherches externes parallèles (ressources gratuites uniquement) ; pour chaque fiche : URL conservée + ce que la source confirme **exactement** ; aucun résultat isolé n'est traité comme une validation définitive d'argot contemporain.
- **Distinction permanente** : « validation documentaire » (une source publiée confirme la définition/l'exemple) ≠ « validation par un locuteur compétent » (non réalisée ici — aucune fiche n'est déclarée validée par un natif).

## 2. Sources consultées (URLs)

| Source | Utilisée pour |
|---|---|
| [FilipinoPod101 — Internet Slang Words in Filipino That Pinoy Millennials Use (23/07/2019)](https://www.filipinopod101.com/blog/2019/07/23/filipino-text-slang/) | source primaire du lot : Teks, Wer na u?, Hir na me, Guize (exemple complet « pasyal tayo kina Rain! »), OTW/OMW, OL, SLR, Besh, Kyah, PM is the key, LP, SKL, FKL, Kati (« Ang kati naman nito » = « This guy's tough! »), Sharks, Sags, Scoobs, Ge, Forda (« forda Drag Race ang ferson ») |
| [TagalogLang — kati](https://www.tagaloglang.com/kati/) · [sige](https://www.tagaloglang.com/sige/) · [cge](https://www.tagaloglang.com/cge/) | sens dictionnaire « kati » = démanger ; « ge » abréviation de « sige » |
| [Tagalog-Dictionary — pasyal](https://www.tagalog-dictionary.com/search?word=pasyal) | « pasyal » = promenade/visite ; magpasyal = sortir en promenade |
| [Ling-App — Tagalog Internet Slang Words](https://ling-app.com/blog/tagalog-internet-slang-words/) | corroboration secondaire : besh/beshie, SKL (« Share Ko Lang » = « I just want to share ») |
| [Pinoy Teen Words — 10 WEIRD Words Filipino Teens Use Today](https://pinoyteenwords.wordpress.com/2016/07/19/10-weird-words-filipino-teens-use-today/) · [Top Conyo Words Used in PH](https://slangwebblog.wordpress.com/2016/07/19/top-conyo-words-used-in-ph/) | corroboration : sharks (« can I see? »), sags (= pilit), scoobs (chemin Scooby-Doo → dehin → non), « Sags yung tawa mo » |
| [Inquirer USA — Trendy Filipino slang every Fil-Am should know](https://usa.inquirer.net/135048/trendy-filipino-slang-every-fil-am-should-know) | Ge, Forda (exemple exact « forda Drag Race ang ferson »), sanaol |
| [PhilSTAR Life — What do 'forda' and 'ferson' mean?](https://philstarlife.com/geeky/145943-forda-and-ferson-meaning-meme) · [GMA — Words we enjoyed using this 2022](https://www.gmanetwork.com/news/hashtag/content/855606/words-we-enjoyed-using-this-2022/story/) | origine du mème : TikTok, Chrishanna Austria (≠ « vlog » et ≠ Drag Race/Sassa Gurl) |
| [Inquirer Lifestyle — 'Sana all'](https://lifestyle.inquirer.net/404824/sana-all-realigning-my-existence-with-its-true-purpose/) · [Rappler — OPINYON SABAOK](https://www.rappler.com/voices/thought-leaders/opinion-sabaok-national-reading-month-language/) · [Wiktionary — sana all](https://en.wiktionary.org/wiki/sana_all) | « sana all/sanaol/naol » = envie/souhait de vivre la même chose que l'autre |

## 3. Verdicts — tableau des 19 fiches

Légende : **VPS** = `VALIDÉE PAR LES SOURCES` · **CAP** = `CORRECTION À PROPOSER`. Les sous-points qui relèvent d'une revue humaine apparaissent dans la colonne Justification (→ §4.3).

| # | Expression | Signification enregistrée | Contexte corrigé (exemple) | Sens de l'exemple dans son contexte | Registre/Région | Cohérence | Verdict | Justification précise |
|---|---|---|---|---|---|---|---|---|
| 1 | Teks | le SMS, texto | `'Teks mo ako pag nakauwi ka na' « Envoie-moi un texto quand tu seras rentré »` | « envoie-moi un SMS quand tu seras rentré » | internet / Philippines | ✔ cohérente | **VPS** (source unique, confiance élevée) | FilipinoPod101 : « Teks is the Filipinized form of 'text' », exemple **exact identique**. Traduction française naturelle de `pag nakauwi ka na` (= quand tu seras rentré). |
| 2 | Wer na u? | t'es où ? | `'Guys, wer na u? Hir na me' « Vous êtes où les gars ? Moi je suis en place »` | question « where are you » + réponse « ici » | internet / Philippines | ✔ cohérente | **VPS** (source unique, élevée) | Exemple **exact** dans FilipinoPod101 ; « Hir na me » = « I'm here already » ; la fiche dérive aussi « Hir na me » (cf. #3). |
| 3 | Hir na me | je suis arrivé, me voilà | `'Hir na me. Bakit ang tagal ninyo?' « Je suis arrivé. Vous prenez votre temps ! »` | « me voilà, pourquoi tous le monde tarde ? » | internet / Philippines | ✔ cohérente (nuance de ton, sans action) | **VPS** (source unique, élevée) | Source : « Guize, hir na me. Bakit ang tagal ninyo? » — la fiche ne garde que la partie consacrée à « Hir na me » (« Guize, » retiré, car la fiche existe aussi). Nuance de ton en §4.3. |
| 4 | Guize | les gars, la bande | `'Guize, pasyal tayo' « Les gars, on va à Rain ! »` | « les gars, on va chez Rain » | internet / Philippines | ✖ traduction à préciser | **CAP** (avant/après §4.1) | L'exemple de la fiche est **tronqué** avant « kina Rain » mais la traduction a conservé « Rain » : l'exemple **complet** de la source est « Guize, pasyal tayo kina Rain! » que la source traduit « Guys, let's go to Rain's place! ». « Rain » est un **prénom**, pas une destination ; `kina` = « chez ». |
| 5 | OTW / OMW | j'arrive, je suis en route | `'Wait lang ha. OTW na' « Attendez s'il vous plaît, j'arrive »` | « attendez, en route » | internet / Philippines | ✔ cohérente | **VPS** (source unique, élevée) | Source : « Guize, wait lang ha. OTW/OMW na. » — adaptation documentée (la fiche retire « Guize, », garde OTW seul) ; sens identique. |
| 6 | OL ka ba? | t'es connecté ? | `'Oo, OL ako' « Oui, je suis en ligne »` | « oui, en ligne » | internet / Philippines | ✔ cohérente | **VPS** (source unique, élevée) | Q&R **exactes** dans FilipinoPod101 (« OL ka ba? » / « Oo, OL ako »). |
| 7 | SLR | désolé pour la réponse tardive (souvent : téléphone à plat) | `'Besh, SLR. Na-empty bat ako kanina' « Besh, désolé, mon tel a déchargé »` | « désolé pour la réponse tardive, batterie à plat » | internet / Philippines | ✔ cohérente (nuance, sans action) | **VPS** (source unique, élevée ; nuance → §4.3) | Exemple **exact** (source : « Na-empty bat ako kanina. » = « My phone died earlier. »). **Nuance** : les sources n'attestent qu'un seul cas de batterie à plat ; « souvent : téléphone à plat » dans le champ `meaning` est une extension non attestée (§4.3). |
| 8 | Kyah | « frérot » respectueux (adresse au vendeur, au serveur) | `'Kyah, magkano po ang smartwatch?' « Monsieur, l'smartwatch, combien ? »` | « sir, combien la montre ? » | casual / Philippines | ✔ cohérente | **VPS** (source unique, élevée) | Exemple **exact** ; FilipinoPod101 : argot dérivé de « kuya », usage « sir », s'adresse au vendeur. |
| 9 | PM is the key | « continue en privé » (message du vendeur) | `'Buyer: HM po ang sweater? / You: PM is the key' « Le prix ? / Envoie-moi un DM pour les détails »` | échange acheteur/vendeur en ligne | internet / Philippines | ✔ cohérente | **VPS** (source unique, élevée) | Exemple quasi exact (« Hi po. HM po ang sweater? » — le `Hi po` initial est absent de la fiche, mais l'échange reste complet au sens). HM = how much ; PM = personal message ; formule = transaction en privé. |
| 10 | LP | prix le plus bas (négociation en ligne) | `'Hi po. LP po ng boots?' « Prix bas pour ces bottes ? »` | « lowest price? » | internet / Philippines | ✔ cohérente | **VPS** (source unique, élevée) | Exemple **exact** ; LP = lowest price, contexte marchandage en ligne. |
| 11 | SKL | petit partage gratuit (post), sans prétention | `'SKL bago kong halaman' « Je vous montre juste ma nouvelle plante »` | « juste pour partager : ma nouvelle plante » | internet / Philippines | ✔ cohérente (nuance, sans action) | **VPS** (2 sources : FilipinoPod101 + Ling-App, élevée) | Exemple source raccourci (fin « ...na binili ko kahapon » coupée) ; sens identique. L'appendice « sans prétention » n'est **pas** attesté tel quel dans les sources croisées (§4.3), et le mot est orthographié « préention » dans la fiche (coquille). |
| 12 | FKL | je flexe juste ... (machin) | `'FKL itong bago kong Jordan shoes' « Jme flex mon nouveau Jordan shoes»` | « je flexe juste mes Jordan » | internet / Philippines | ✔ cohérente | **VPS** (source unique, élevée) | Source : « Flex ko lang itong bago kong Jordan shoes. » — la fiche utilise l'acronyme FKL (même objet : les baskets Jordan). Remarque : espace manquant avant `»` dans le contexte (fidélité mécanique préservée, non normalisée) → §4.3. |
| 13 | Ge | d'accord, vas-y | `'Tol, teammates tayo. / Ge.' « On co-op ? / Ok vas-y ! »` | échange « on joue ensemble ? / vas-y » | casual / Philippines | ✔ cohérente | **VPS** (≈ 4 sources : FilipinoPod101, Inquirer, TagalogLang, Tagalog.com, élevée) | « ge » abréviation de « sige » (« sure / go ahead ») documentée ; contexte « teammates » gaming naturel. La question « On co-op ? » est une glose interprétée de « Tol, teammates tayo » (littéralement « dude, on est coéquipiers ») — acceptable, à confirmer (§4.3). |
| 14 | Kati | l'adversaire coriace, le boss difficile | `'Ang kati naman nito' « Ce type est coriace ! »` | « c'est coriace, ça » | street / Philippines | ✔ cohérente (1 nuance) | **VPS** (2 sources : FilipinoPod101 + TagalogLang, confiance moyenne-élevée) | La suspicion « nito ≠ ce type » est **levée** : la source elle-même traduit `Ang kati naman nito` par **« This guy's tough! »** — la fiche est fidèle. **Nuances** : « boss difficile » est une extension (la source dit « adversaire/quête difficile », contexte gaming) et le `register` « street » serait probablement « internet » → §4.3. |
| 15 | Sharks | montre-moi ça, laisse-moi voir ! | `'Ang bagong phone mo, sharks!' « Ton nouveau téléphone, montre-moi ! »` | « je peux voir ton nouveau téléphone ? » | internet / Philippines | ✔ cohérente | **VPS** (2 sources : FilipinoPod101 + Pinoy Teen Words, moyenne) | Jeu de mots documenté (pating = requin / patingin = let me see ; exemple cousin « Bro, nice phone you got there, sharks? » publié). Sources = listes d'argot ; diffusion réelle au-delà des sources non prouvée. |
| 16 | Sags | l'artificiel, le forcé (un sourire posé de façade) | `'Huwag naman masyadong sags ang ngiti mo' « Pas trop d'sourire forcé »` | « ne force pas ton sourire » | internet / Philippines | ✔ cohérente | **VPS** (≈ 3 sources : FilipinoPod101 + 2 blogs, moyenne) | Exemple **exact** + traduction publiée « You don't need to force your smile. » ; jeu saging(banane)/pilit(forcé) dans les deux blogs. |
| 17 | Scoobs | impossible, absolument pas | `'Scoobs, bro! Alaws arep' « Impossible bro, budget nul »` | « impossible mec, j'ai pas les moyens » | internet / Philippines | ✔ cohérente | **VPS** (2 sources : FilipinoPod101 + Pinoy Teen Words, moyenne) | Exemple **exact** + traduction publiée « I can't, man. My budget isn't enough. » ; analyse alaws=wala, arep=pera dans les deux sources. Étymologie « Scooby-Doo → dehin → non » documentée comme convention stylistique de la source. |
| 18 | Forda ang ferson | ce que la perso aime ou fait de sa vie (formule de vlog) | `'forda Drag Race ang ferson' « Il est fan de Drag Race Philippines »` | « la ferson est très fan de Drag Race PH » | internet / Philippines | ✔ cohérente (1 nuance d'origine) | **VPS** (≈ 3 sources : Inquirer USA, PhilSTAR Life, GMA, élevée) | Exemple **exact cité par Inquirer USA** avec ce sens. **Nuance** : les sources donnent une **origine mème TikTok (2022, Chrishanna Austria)**, pas « formule de vlog » ni Drag Race/Sassa Gurl — révision du champ `literal`/`meaning` proposée en §4.3. |
| 19 | Sana all | envie de vivre la même chose que quelqu'un | `'May boyfriend na siya, sana all!' « Il a un copain, tout le monde ! »` | « elle a un copain, la chance ! (j'aimerais pareil) » | internet / Philippines | ✖ traduction trompeuse | **CAP** (avant/après §4.2) | Usage abondamment documenté (Inquirer, Rappler, Wiktionary : réaction d'envie — « sanaol » compressé, « naol » encore plus court). La traduction « tout le monde ! » est **trompeuse** : « all » n'y est pas un vocatif, c'est le destinataire de l'envie (« pour tous soi »). Proposition de traduction : « la chance ! » ou « j'aimerais pareil ! » (§4.2). |

**Bilan : 17 VPS / 2 CAP / 0 REVUE HUMAINE REQUISE / 0 fiche attribuée à un locuteur natif.** Aucune fiche ne reste au statut « À VÉRIFIER » ; les sous-points relevant d'une revue humaine sont listés en §4.3.

## 4. Corrections à proposer (non appliquées — proposition, pas de modification de données)

Aucun fichier source n'a été modifié. Deux corrections sont proposées ci-dessous, chacune avec son avant/après et son fondement ; leur application attend un sign-off humain.

### 4.1 `Guize` — traduction : « on va à Rain ! » → « on va chez Rain ! »

- Fondement : l'exemple source complet est `Guize, pasyal tayo kina Rain!`, que FilipinoPod101 traduit lui-même « Guys, let's go to Rain's place! ». **« Rain » est un prénom** (pas une destination) ; `kina` = « chez » (direction vers une personne). « à Rain » est donc fautif en français, et l'exemple tagalog de la fiche a été tronqué avant `kina Rain` alors que la traduction, elle, a conservé « Rain ».
- Avant : `'Guize, pasyal tayo' « Les gars, on va à Rain ! »`
- Après (proposition) : `'Guize, pasyal tayo kina Rain!' « Les gars, on va chez Rain ! »`
- Alternative si l'exemple doit rester court : conserver `'Guize, pasyal tayo'` et traduire « Les gars, on va se balader ! » (`pasyal` = promenade/visite ; cf. Tagalog-Dictionary, §2).
- La fiche actuelle est doublement tronquée (exemple coupé avant `kina Rain`, traduction coupée avant « chez ») ; la révision complète est préférée à l'alternative.

### 4.2 `Sana all` — réaction : « tout le monde ! » → « la chance ! »

- Fondement : les sources documentent une réaction d'**envie et de souhait** (« sana all/sanaol/naol » = « j'aimerais vivre la même chose »), pas une adresse à la foule. Le champ `meaning` de la fiche est correct ; seul le rendu de la réaction « tout le monde ! » est trompeur.
- Avant : `'May boyfriend na siya, sana all!' « Il a un copain, tout le monde ! »`
- Après (proposition) : `'May boyfriend na siya, sana all!' « Elle a un copain, la chance ! »`
- `siya` est neutre en tagalog ; « Elle » est le plus naturel ici (l'exemple) mais « Il » reste grammaticalement correct.

### 4.3 Révisions secondaires proposées (hors périmètre contexte — rien n'a été modifié)

À passer en revue humaine (ré-attribution d'origine ou révision de `meaning`/`register`) :

- `SLR` : le `meaning` dit « (souvent : téléphone à plat) » — les sources n'attestent qu'un seul cas de batterie à plat, aucune généralité.
- `SKL` : « (sans prétention) » n'est pas attesté tel quel dans les sources croisées ; de plus, le mot est orthographié **« préention »** dans la fiche (coquille).
- `Kati` : « boss difficile » — la source dit « adversaire ou quête difficile (contexte gaming) » ; `register` « street » → « internet » probable.
- `Forda ang ferson` : « formule de vlog » → « mème TikTok (2022, Chrishanna Austria) » selon PhilSTAR Life/GMA ; Sassa Gurl est documentée pour « dogshow », pas « forda ».
- `Hir na me` : « Vous prenez votre temps ! » est une libre relecture (la source signifie « pourquoi vous êtes si longs ? ») — ton sarcastique implicite.
- `Ge` : « On co-op ? » est une glose interprétée de « Tol, teammates tayo » (« bro, on est coéquipiers ») — acceptable, à confirmer.
- `FKL` : espace manquant avant `»` dans le contexte (« ...Jordan shoes» ») — fidélité mécanique préservée ; à normaliser si un humain le souhaite.

## 5. Contrôles d'intégrité (aucune donnée modifiée)

| Contrôle | Résultat |
|---|---|
| `git rev-parse HEAD` | `a77e233` — inchangé |
| Statut Git | 44 entrées, identiques à l'ouverture du tour (aucun fichier de plus) |
| SHA `src/convex/slangSeedEnrichmentTl.ts` | `ddf1c63c9c682a62…` — les 19 corrections mécaniques intactes |
| SHA snapshot `avant/` | `7ea1f28f1c23f2a6…` — pristine préservé |
| SHA `tests/lotPiloteTl.test.ts` | `76c49ec8cbd93705…` — code de test inchangé |
| `bun test tests/lotPiloteTl.test.ts` | **7/7 pass** |
| `verifie-lot-tl.mjs` (diff bit-à-bit + corpus) | **19/19, OK ; 6 601 fiches, 6 601 clés uniques** |
| Accès distant en écriture | **Aucun** (aucun commit, push, déploiement, mutation Convex, semis) |
| Autres langues | **Aucun changement** (seuls les artefacts du Prompt 2 existent hors dossier) |

## 6. Incertitudes et limites

1. **Validation documentaire ≠ validation native.** Toutes les confirmations proviennent de ressources écrites (la source primaire du lot — FilipinoPod101 2019 —, des dictionnaires en ligne, des articles de presse PH et des blogs de lexique juvénile). Aucune fiche n'a été vérifiée par un locuteur tagalog compétent, et `validated: false` reste en place pour toutes.
2. **Argot daté.** La source majeure sur les textos date de 2019 ; les listes corroborantes pour « sharks », « sags », « scoobs » datent de ~2016. La pérennité de la diffusion actuelle n'est pas prouvée — une revue humaine par échantillon est recommandée après acceptation des corrections proposées.
3. **Exemples adaptés.** Pour 5 fiches (Hir na me, OTW/OMW, PM is the key, SKL, FKL), l'exemple d'origine de la source a été adapté par le lot (le plus souvent en retirant le « Guize, » initial ou en raccourcissant la fin). Ce sont des adaptations volontairement documentées par le lot, pas des intrusions ; leur détail figure dans `corrections-tl.json` et `audit-lot-tl.csv`.
4. **Aucune correction appliquée.** Les deux corrections proposées (§4.1 et §4.2) attendent un sign-off humain avant d'être appliquées par un éventuel lot de suivi.

## 7. Recommandation sur l'extension du catalogue

- **Poursuivre l'extension : OUI**, avec deux garde-fous.
  - La chaîne d'extraction est **confirmée par le lot** : 19/19 fiches retrouvent leur source une à une ; caractères, exemples et gabarits vérifiés pas à pas. Le risque mécanique est faible.
  - La chaîne linguistique exige une **passe humaine en aval** : une fiche peut être documentable et pourtant datée ou mal calibrée (« Kati » : registre gaming réel, champ `street` douteux ; « Forda » : origine TikTok, « vlog » faux). La poursuite doit : (a) partir des langues dont la source primaire est identifiable (ur, fa, bn), (b) insérer une passe humaine entre l'extraction et la clôture de chaque lot.
- **Avant le lancement du lot suivant** : appliquer (ou rejeter) les deux corrections de §4.1-§4.2, statuer sur les 7 révisions secondaires de §4.3, et mener la revue humaine de `Rapsi` (fiche exclue du lot, ligne 58 — la traduction « bmw » contredit l'exemple « armor » ; voir [`../RAPPORT-LOT-PILOTE.md`](../RAPPORT-LOT-PILOTE.md) §3).

## 8. Artefacts

- [RAPPORT-VALIDATION-LINGUISTIQUE.md](RAPPORT-VALIDATION-LINGUISTIQUE.md) — ce rapport
- [verdicts-validation.csv](verdicts-validation.csv) — le tableau de verdicts (19 lignes), version exportable CSV

**Fin de la validation (Prompt 3 §6) : ce rapport est la dernière écriture. Aucun autre fichier, fiche ou langue modifié, aucune correction appliquée automatiquement, aucun lot lancé.**
