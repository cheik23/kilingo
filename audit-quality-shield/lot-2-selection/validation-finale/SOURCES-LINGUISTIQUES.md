# Rapport des sources et preuves linguistiques — lot 2 (20 candidates persanes)

Date : 24 octobre 2026 · Base : `main` @ `a77e2335` · Référence : [RAPPORT-VALIDATION-FINALE.md](RAPPORT-VALIDATION-FINALE.md)

## 1. Périmètre

Référentiel documentaire recueilli par recherche web **gratuite uniquement** le 24 octobre 2026, à partir des 20 fiches sources de `src/convex/slangSeedEnrichmentFa.ts` (lignes 16-35). Aucune source payante n'est citée. **Le statut de chaque fiche dans le CSV des décisions est associé à sa preuve.**

> ⚠️ Distinction permanente : il s'agit d'une **recherche documentaire**, pas d'une validation par une source natives. Aucun statut `validated: false` n'est modifié.

## 2. Les sources

Toutes gratuites, consultables sans identité ni compte actif.

| Source | Statut | Utilisé pour |
|---|---|---|
| [My Persian Corner — « 10 Persian Slang Words You Won't Learn In Class »](https://www.mypersiancorner.com/persian-slang-words-you-wont-learn-class/) | gratuit (blog linguistique perso ruegé persanol.) | fiches « khâli bastan », « pichundan », « seh soot », « tikeh andâkhtan », « âvizun », « sar-e kâr gozâshtan », « kerm rikhtan », « tâblo », « sooti », « dahan servis kardan » |
| [PersianPod101 — « What Is Persian Slang Like »](https://www.persianpod101.com/lesson/persian-teachers-answer-your-questions-17-what-is-persian-slang-like) | gratuit (presentation d'une leçon enseignée ; audio sup. payant uniquement) | fiches « pichundan », « tâblo », « seh soot », « âvizun », « sar-e kâr gozâshtan » |
| [Persian with El — « 10 Farsi Slang Words You Actually Need (2025) »](https://persianwithel.com/culture/10-farsi-slang-words-you-actually-need-the-2025-survival-kit/) | gratuit (blog pédagogique persan) | fiches « khafan », « pichundan », « oskol », « kaf kardam », « khaz », « sooti », « lash », « jo-gir », « dahan-servis », « fâz » |
| [Persian with El — « Persian Slang Guide »](https://persianwithel.com/culture/persian-slang-guide/) | gratuit | registre/ton des fiches « bâhâl », « khafan », « zâye », « khodemuni », « pichundan », « mokh zadan », « tike andâkhtan », « zedd-e hâl zadan », « kerinj », « samm » |
| Wiktionary (Persan) | gratuit / CC | fiches « khâli bastan », « bâhâl », « khafan », « zâye », « khaz » — statut colloquial/slang explicité |

## 3. Preuve par fiche — ce que chaque source confirme exactement

| # | Expression | Sens dans `meaning` | Ce que les sources confirment | Divergences signalées | Décision justifiée |
|---|---|---|---|---|---|
| 1 | خالی بستن (khâli bastan) | bluffer, raconter des salades | My Persian Corner : littéral « attacher du vide » / sens « to bluff, to exaggerate, to BS » ; [Wiktionary — خالی بستن](https://en.wiktionary.org/wiki/%D8%AE%D8%A7%D9%84%DB%8C_%D8%A8%D8%B3%D8%AA%D9%86) : « (colloquial, Iran) to lie, to deceive » | Wiktionary retient un sens **plus large que le simple bluff** (« mentir, tromper »). | **revue linguistique humaine** |
| 2 | پیچوندن (pichundan) | poser un lapin, esquiver quelqu'un | My Persian Corner : « tordre, tourner » → « poser un lapin » ; PersianPod101 : variante « laisser tomber quelqu'un » ; Persian with El : « ghosting/laisser tomber » québénant | aucune contradiction relevée, deux registres équivalents (« esquiver » ≈ « let down ») | **extraction sûre** |
| 3 | سه‌سوت (seh soot) | en un éclair, très vite | My Persian Corner : « trois sifflements » → « en un instant » ; PersianPod101 : immédiat | aucune | **extraction sûre** |
| 4 | تیکه انداختن (tike andâkhtan) | lancer une pique, faire une remarque sarcastique | My Persian Corner : « lancer des morceaux » → « remarque sarcastique » ; guide Persian with El : même sens ; littéral vérifié | aucune | **extraction sûre** |
| 5 | آویزون (âvizun) | collant, qui ne lâche pas quelqu'un | My Persian Corner : « suspendu » → « collant » ; PersianPod101 : « clingy » | aucune | **extraction sûre** |
| 6 | سرِ کار گذاشتن (sar-e kâr gozâshtan) | faire marcher quelqu'un, lui faire une blague | My Persian Corner + PersianPod101 : littéral « mettre au travail » → « faire marcher / duper » | aucune | **extraction sûre** |
| 7 | کِرم ریختن (kerm rikhtan) | taquiner ou embêter quelqu'un | My Persian Corner : littéral « renverser des vers » → « taquiner / embêter » | La traduction `context` « Arrête de me chercher » correspond plutôt à « verser des vers » qu'à « taquiner légèrement » — **nuance d'intensité à trancher** | **revue linguistique humaine** |
| 8 | تابلو (tâblo) | évident, visible comme un panneau | My Persian Corner + PersianPod101 : « tableau/panneau » → « évident » | aucune | **extraction sûre** |
| 9 | سوتی (sooti) | gaffe, bourde, indiscrétion | My Persian Corner : « un souffle/whistle » → « slip-up, faux pas » (aussi « ne pas griller quelqu'un ») ; Persian with El : « blunder/slip-up » | aucune | **extraction sûre** |
| 10 | دهن سرویس کردن (dahan servis kardan) | épuiser, agacer quelqu'un | My Persian Corner : littéral « servir la bouche » → « agacer très fort » ; usage jeuness/argot registre vulgaire | **regle street/vulgar**: la traduction figurative « Ce trafic m'a achevé » reste correcte mais « vulgaire/argot secondaire » doit être confirmée par un natif | **revue linguistique humaine** |
| 11 | باحال (bâhâl) | cool, sympa, amusant | Wiktionary : « cool (interesting) » ; Persian with El slang guide : « cool, awesome », indiqué informant partout | **Divergence de labellisation** : Wiktionary **ne marque pas** le mot comme slang/colloquial (sens standard); Persian with El le traite clairement comme informel | **extraction sûre** — registre `casual` de la fiche reste correct |
| 12 | خفن (khafan) | génial, impressionnant, « trop bien » | Persian with El (« sick/awesome/GOAT », littéral « asphyxiant/étouffant ») ; Wiktionary : « (slang) badass ; cool » | rien de contradictoire ; relation avec خفه (« suffocation ») reste étymologiquement **incertaine** | **extraction sûre** |
| 13 | ضایع (zâye) | gênant, embarrassant, ringard | Wiktionary : « spoiled/damaged », « wasted/futile » (sens litteraire/standard) ; Persian with El glossary : « socially embarrassing »/« cringeworthy » (slang) | **les deux coexistent** : sens standard (gâché/abîmé) et sens slang (cringe) — la fiche identifie clairement les deux | **extraction sûre** |
| 14 | خودمونی (khodemuni) | décontracté, intime, sans formalités | Persian with El slang guide : « informal, entre nous » | aucune | **extraction sûre** |
| 15 | خز (khaz) | ringard, kitsch, « cringe » | [Wiktionary — خز](https://en.wiktionary.org/wiki/%D8%AE%D8%B2) : nom = « fur (used for clothing) » ; l'adjectif a le sens « (slang) unfashionable » ; Persian with El glossary : « cringe/tacky/cheesy » | aucune contradiction, le nom littéral (fausse fourrure) est bien distinct du sens slang | **extraction sûre** |
| 16 | اسکل (oskol) | idiot, benêt | Persian with El : « idiot » (souvent taquin) | aucune | **extraction sûre** |
| 17 | کف کردم (kaf kardam) | j'étais sidéré, bouche bée | Persian with El : littéral « j'ai fait de la mousse » → « j'étais stupéfait » | aucune | **extraction sûre** |
| 18 | لش (lash) | vautré, en mode farniente | Persian with El glossary : « lazy / chilling / rotting », littéral « carcass/dead body » | Divergence mineure : la fiche dit « vautré/farniente », la source « lazy/chilling/rotting » — esprit équivalent, formulation française plus colorée | **extraction sûre** (nuance) |
| 19 | جوگیر (jo-gir) | emporté par l'excitation du moment | Persian with El : « pris par l'ambiance », « carried away » | aucune | **extraction sûre** |
| 20 | فاز (fâz) | humeur, délire, attitude | Persian with El glossary : « mood/energy/vibe/phase », emprunt à l'anglais/français « phase » ; registre « slang et internet » | « délire » ≈ vibe en français familier : la traduction « C'est quoi ce délire ? » est une **adaptation, pas une traduction directe** | **revue linguistique humaine** |

## 4. Les sources non retenues (et pourquoi)

- [Seattle Globalist — 5 Farsi phrases](https://seattleglobalist.com/2016/07/20/5-farsi-phrases-wish-english/54079) : utile pour le *ta'arof* et des principes d'emploi, mais ne couvre pas les fiches de ce lot (mots et usages distincts). Source **non retenue** pour les 20 candidates.
- [PersianWalk — Persian Slang](https://persianwalk.com/blog/persian-slang) : orienté vers les expressions idiomatiques et affectives plus que l'argot jeune ; le lexique de ce lot n'y est pas représenté (sauf於 ta'arof et registres image).

## 5. Traçabilité

- Chaque fiche citée ici a une **URL d'origine conservée** dans ce tableau.
- Statuts suivent la convention : « extraction sûre », « revue linguistique humaine », « exclusion ». Elles sont résumées et reprises ligne par ligne dans [verdicts-20-fa.csv](verdicts-20-fa.csv) (colonnes `decision` et `justification`).
- **Aucun chiffre produit par ce rapport n'est réputé definitive** — le statut `validated: false` des fiches est Inchangé, et la validation documentaire n'a jamais été présentée comme validation par une source natives.
