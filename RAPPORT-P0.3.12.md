# RAPPORT P0.3.12 — compte de test et premier E2E réel

| | |
|---|---|
| Date | 29/10/2026 |
| Branche | `work/p034-shadow-privacy` @ `5c6a2ad` |
| Preview | `https://kilingo-50xuh7gpo-g-c35c.vercel.app` |
| Backend | `neat-wombat-556.convex.cloud` uniquement |
| Statut | **TERMINÉ — scénario authentifié exécuté et réussi** |

## 1. Résumé

La boîte mail.tm dédiée a été créée via l'API officielle, ses accès ont été
enregistrés dans `.env.preview.e2e.local` (ignoré par Git) avec le bypass
existant, puis le scénario Playwright authentifié a été exécuté **pour de
vrai** : OTP reçu et validé, découverte, favori, SRS avec idempotence de
l'XP, Shadow. Les 5 tests navigateur passent.

## 2. Boîte mail.tm

| | |
|---|---|
| Création | `POST https://api.mail.tm/accounts` → **201** |
| Domaine actif | `maxxspace.com` (seul domaine public actif retourné) |
| Authentification | `POST /token` → **200** |
| Vérification | `GET /me` → **200**, adresse identique |
| Adresse | jamais affichée (longueur contrôlée) |
| Mot de passe | aléatoire, jamais affiché |

`PREVIEW_TEST_EMAIL` et `MAILTM_ADDRESS` portent **la même adresse** : le code
envoie l'OTP à la première et lit la boîte avec la seconde.

## 3. Fichier local

`.env.preview.e2e.local` contient les **4 variables** requises, dans cet
ordre : bypass Vercel (conservé, non régénéré), `PREVIEW_TEST_EMAIL`,
`MAILTM_ADDRESS`, `MAILTM_PASSWORD`.

- ignoré par Git (`.gitignore:5`) ;
- non indexé (`git ls-files` ne le connaît pas) ;
- aucune valeur affichée dans les logs, le rapport ou les commandes.

Le bypass reste validé : sans en-tête la Preview répond **302** vers le SSO
Vercel, avec l'en-tête **200**, uniquement sur l'origine autorisée.

## 4. Scénario navigateur — exécuté

`bun run test:e2e:preview` → **5 réussis · 0 échoué · 0 ignoré** (39 s).

| Parcours | Résultat |
|---|---|
| Protection + rendu | 200, React hydraté, aucun SSO |
| Réseau | WebSocket Convex vers `neat-wombat-556` uniquement, 0 violation |
| Authentification | OTP réellement reçu dans la boîte, validé, arrivée sur `/app` |
| Onboarding | focus « Anglais » + lifestyle terminés, pseudo enregistré |
| Découverte | deck affiché, favori ajouté (toast) |
| Ma mémoire | badge « ❤ FAVORI » visible, retrait confirmé, badge disparu |
| SRS | carte créée, « Réviser maintenant », « Révéler » + « Acquis » |
| XP | session rejouée : même `xpGain`, total **inchangé** |
| Nettoyage | deck vidé avant le test, carte créée puis supprimée |
| Shadow | page « LA SCÈNE » + quota « analyses Shadow restantes » |
| Erreurs console | aucune erreur inattendue |

Aucun paiement, aucune transcription, aucun appel YouTube/Groq.

## 5. Recette API

`bun run verify:preview -- --api-only` → **exit 0**

| Résultat | Nombre |
|---|---|
| PASS | **11** |
| FAIL | **0** |
| SKIP | **1** (`ui.frontend-heberge`, volontairement exclu par `--api-only`) |

Y compris `auth.otp`, favoris aller-retour, SRS (CAS périmé + session
idempotente), verrous internes, propriété des jobs média et quota Shadow
(`reste 5/5`).

## 6. Bugs corrigés (révélés par l'exécution réelle)

| Problème | Correction |
|---|---|
| L'API mail.tm renvoie un **tableau brut**, pas `hydra:member` | `mailList()` tolère les deux formes dans `mail.ts` et `verify-preview.mjs` |
| Le logo n'est pas un lien nommé « KILINGO » (accent combiné) | assertion sur le titre réel « Les langues du monde… » |
| L'onboarding « Choisis ton focus » n'était pas détecté (course au chargement) | attente explicite focus **ou** navigation |
| Le dialogue de pseudo apparaît après le profil | attente bornée dédiée avant de poursuivre |
| Retirer un favori pur le fait disparaître de Ma mémoire | assertion sur le toast + absence du badge |
| Badge rendu en minuscules (majuscules via CSS) | regex insensible à la casse |
| « Apprendre » lance la mutation en arrière-plan | `expect.poll` sur `myDeck` avant navigation |
| La révision crédite de l'XP après la mesure | total stabilisé, delta mesuré autour du seul doublon |
| Erreur d'enregistrement du Service Worker (bloqué par Playwright) | filtrée avec justification (pas un défaut applicatif) |
| Convex ne fait aucun HTTP au chargement | interception `routeWebSocket` (déjà livrée) |

## 7. Vérifications

| Commande | Résultat |
|---|---|
| `bun run test:e2e:preview` | 5 / 5 |
| `bun run verify:preview -- --api-only` | 11 PASS, 0 FAIL, exit 0 |
| `bun test` | 578 réussis · 2 ignorés · 0 échec |
| `bun run typecheck` | exit 0 |
| `bun run build` | exit 0 |
| ESLint (fichiers touchés) | 0 erreur |

## 8. Limites

- Le bypass est un secret **de projet** Vercel : le code ne l'envoie qu'à
  l'origine Preview, mais sa portée technique dépasse les Previews.
- Les Service Workers sont volontairement bloqués dans les tests (isolation
  du cache), donc le parcours PWA n'est pas couvert ici.
- Le compte de test est dédié ; le scénario vide son deck SRS avant de
  mesurer, ce qui ne touche aucune donnée réelle.
- Les sélecteurs suivent l'interface française actuelle.

## 9. Confirmations

- **Aucun** commit, push, merge, déploiement ou modification Production.
- Configuration de protection Vercel inchangée ; aucun accès public créé.
- Aucun secret affiché, journalisé ou commité.
- `freebuff-map` non touché.
- **Mission terminée** : le scénario authentifié a réellement été exécuté
  dans le navigateur, sur la Preview autorisée.
