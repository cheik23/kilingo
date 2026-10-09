# 🔒 Verrous Premium — langues actives, quota Shadow, personnages IA

Cette page est le complément du § **Audit Premium** du `README.md`. Elle
documente les trois portes `premium` effectivement appliquées, leur
migration **sans perte**, et le texte exact des messages de blocage.

> ⚠️ Pendant la rédaction de ce lot, l'outil d'édition de fichiers de
> l'environnement n'était plus en mesure de modifier la fin du `README.md`
> (la copie qu'il voyait s'arrêtait au début de la section Paiement,
> alors que le fichier réel faisait 91 Ko). Le contenu a donc été écrit
> ici, et le `README.md` pointe vers cette page. Dès que l'outil repasse
> au-delà de cette limite, cette section doit être remontée dans le
> `README.md` et le tableau « Audit Premium » doit passer `languages`,
> `shadowing` et `aiCharacters` de `free` à `premium`.

---

## Pourquoi ces trois portes

Le premier audit (module E) avait conclu, à juste titre, qu'**aucun**
avantage annoncé par la page des tarifs n'était réellement réservé :
« 2 langues en parallèle », « shadowing illimité » et « 8 personnages »
étaient offerts à tout le monde. Promettre gratuitement est le premier
visage d'un dark pattern — l'utilisateur paie, ou se plaint, sans avoir
jamais reçu la chose promise.

Ce lot corrige cela avec **trois portes seulement**, chacune adossée à
une migration sans perte, et **jamais** sur la boucle d'apprentissage :
argot, quiz, SRS, XP, niveaux, badges, streaks, ambitions et export
Anki/CSV restent gratuits, sans exception.

| Verrou | Gratuit | Premium | Où il est appliqué |
|---|---|---|---|
| **A · Langues actives** | 1 langue active | 2 langues en parallèle | `learning.setFocus` / `learning.switchFocus` (→ `applyFocus`) |
| **B · Quota Shadow** | 5 analyses / jour | illimité | `media.createLinkMedia` / `createMedia` / `createTextMedia` |
| **C · Personnages IA** | 2 personnages ouverts | les 8 | `aiConversation.startConversation` |

La politique déclarative reste dans `src/lib/premiumGates.ts` (`GATES`) :
`languages`, `shadowing` et `aiCharacters` passent à `premium`, avec leur
raison écrite à côté. `bun run payments:verify` échoue si une porte
passe à `premium` sans être assumée.

## La règle commune : annoncer le GAIN, jamais la perte

Un blocage qui dit « tu ne peux plus » est un rapport de force ; un
blocage qui dit « voilà ce que tu obtiens » est une explication. Les
trois messages sont traduits dans les **12 langues** de l'application
(`src/lib/i18n.premium.ts`), et `locks:verify` échoue si l'un d'eux ne
nomme pas le gain obtenu, s'il est trop court pour être une explication,
s'il contient une urgence fabriquée, ou s'il promet une perte fictive.

---

## A · Une langue active à la fois — sans retirer ce qui existe

**La règle.** Une 2ᵉ langue active demande Premium. La langue déjà active
**n'est jamais désactivée, déplacée ni effacée** : elle bascule en *mode
révision*, avec son XP intact. Le refus est calculé **avant toute
écriture** (`{ ok: false, reason: "language_cap", cap, wanted }`), donc
le serveur ne retire rien au compte.

**La migration.** `activeLanguageCap` (dans `src/lib/premiumLimits.ts`)
compte les lignes actives **sans** `activatedAt`. Un utilisateur gratuit
qui avait déjà 3 langues actives conserve un plafond de 3 : le verrou
ne s'applique qu'à l'ajout d'une langue supplémentaire. Les lignes
créées à partir de ce lot portent `activatedAt` et comptent contre le
plafond. C'est le seul mécanisme de *grandfathering* du dépôt, et il
est testé par `locks:verify` (section « non-rétroactivité »).

**Le message (FR).** « Tu peux suivre une langue active à la fois, et
elle ne disparaît jamais : Premium ouvre deux langues en parallèle,
sans compteur, ou bien tu passes l'autre en mode révision. Rien n'est
effacé — l'ancienne langue et son XP restent là, en attente. »
CTA : « Suivre deux langues à la fois ».

**L'onboarding n'est jamais bloqué.** Il conserve la 1ʳᵉ langue et
explique pourquoi, avec un lien vers la suite. Un utilisateur ne doit pas
terminer son inscription sur un écran de refus.

---

## B · Cinq analyses Shadow par jour, compteur visible

**La règle.** 5 **nouvelles** analyses par jour en formule gratuite,
illimité en Premium.

**Rien n'est surprised.** Le compteur est affiché en permanence dans
`ShadowView` (pastille `ShadowQuotaBadge`) : la rencontre du plafond
n'est jamais une surprise, elle est annoncée avant.

**La remise à zéro est réelle, pas décorative.** Elle suit le **fuseau
de l'utilisateur**, transmis par `registerTimezone` au montage (donc
jamais un minuit UTC présenté comme le sien), et l'heure affichée est
calculée côté serveur par `nextLocalMidnight`. Aucun compte à rebours,
aucune date limite, aucun mot d'urgence.

**La migration.** Le quota ne porte que sur les **nouvelles** analyses :
les médias déjà analysés, leurs transcriptions, et les re-shadows
(`kickPipeline`, `retranslate`) sur un média existant ne consomment rien.
Aucun contenu généré n'est retiré.

**Le message (FR).** « Tu as utilisé tes 5 analyses Shadow du jour. Le
compteur repart à minuit chez toi. Premium, c'est un nombre illimité de
shadowings, sans compteur et sans plafond. »
CTA : « Shadowing illimité ».

---

## C · Deux personnages ouverts, six visibles

**Le choix, et son honnêteté.** Le brief demandait les 2 personnages
« les plus populaires selon les données d'usage ». **Cette mesure
n'existe pas** : la base compte 2 conversations et 1 utilisateur distinct
— un classement issu de là serait une invention. Le repli annoncé par le
brief est donc appliqué : les 2 personnages les plus mis en avant par le
produit lui-même.

- **Baba Street** — seul personnage ayant une conversation réellement
  enregistrée dans la base, et le plus cité dans la copy produit.
- **Mama Wisdom** — présenté comme « Mama Africa » sur la page
  d'accueil.

`locks:verify` recompte cette justification à chaque exécution (29
occurrences de « Baba Street » et 8 de « Mama Africa » dans la copy
`src/lib` / `components` / `pages`) : le jour où la donnée d'usage
existe, elle remplacera le récit.

**La visibilité prime sur la troncature.** Les 6 autres sont listés avec
leur description et une pastille `Premium` : on sait ce qu'on
n'aurait pas. `listCharacters` renvoie les 8, marqués `locked`, et ne
filtre rien.

**La porte est étroite.** Seul `startConversation` refuse. Envoyer un
message ou terminer une conversation déjà commencée reste possible : on
ne bloque personne au milieu d'un échange.

**Le message (FR).** « Baba Street et Mama Wisdom sont déjà à toi, avec
tous leurs scénarios. Premium ouvre les six autres — chacun avec sa
voix, son registre et son argot. Tu gardes les conversations que tu as
déjà eues. » CTA : « Ouvrir les 8 personnages ».

---

## Le test qui garantit tout cela

```bash
bun run locks:verify   # scripts/verify-premium-locks.mjs
```

Huit familles de règles, toutes vérifiées à chaque exécution :

1. les plafonds annoncés ;
2. la **non-rétroactivité** (grandfathering) ;
3. l'intégrité de la boucle d'apprentissage ;
4. l'absence de dark pattern dans la copy des 12 langues ;
5. la visibilité des 6 personnages verrouillés ;
6. le jour local (fuseau) contre le jour UTC ;
7. les codes d'erreur des trois verrous ;
8. le fait que **le plafond vient du serveur** — le client ne recalcule
   rien, et aucun `isPremium` local ne traîne dans les surfaces de
   verrou.
