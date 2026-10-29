# Recette E2E navigateur — `bun run test:e2e:preview`

Complète la recette API [recette-preview.md](recette-preview.md) par un vrai
navigateur Chromium piloté par Playwright sur la **Preview hébergée**.

- Configuration : `playwright.preview.config.ts`
- Specs : `tests/e2e-preview/` (`guard.e2e.ts` + `preview.e2e.ts`)
  — extension `.e2e.ts` pour que `bun test` (suite unitaire) ne les ramasse pas
- Cible validée à l'import : `tests/e2e-preview/target.ts`

## Cible

| | |
|---|---|
| Preview | `https://kilingo-50xuh7gpo-g-c35c.vercel.app` |
| Alias autorisé | `kilingo-git-work-p034-shadow-privacy-g-c35c.vercel.app` |
| Backend attendu | `neat-wombat-556.convex.cloud` |
| Refusés | `kilingo-ten.vercel.app`, `formal-vulture-518.convex.cloud`, `impartial-pony-692.convex.cloud`, tout hôte inconnu |

Toute autre URL fait **échouer la suite au chargement de la configuration**,
avant la moindre navigation. Aucun `--base-url` arbitraire n'est accepté.

## Prérequis

1. **Bypass Vercel** (Protection Bypass for Automation) :

   Vercel → projet `kilingo` → **Settings → Deployment Protection →
   Protection Bypass for Automation** → *Generate*.
   Ne pas désactiver la protection, ne pas rendre la Preview publique.

2. Enregistrer les variables dans `.env.preview.e2e.local`, **fichier ignoré
   par Git** (`.gitignore`) :

   ```dotenv
   VERCEL_AUTOMATION_BYPASS_SECRET=…
   PREVIEW_TEST_EMAIL=…@…
   MAILTM_ADDRESS=…@…
   MAILTM_PASSWORD=…
   ```

   Le fichier est chargé automatiquement par les deux recettes
   (`scripts/preview/load-local-env.mjs`) ; les variables déjà exportées
   restent prioritaires.
   Ne jamais coller le secret dans un ticket, un chat ou un rapport.

3. Chromium Playwright :

   ```bash
   bunx playwright install chromium
   ```

## Commandes

```bash
# garde-fous seuls (aucun navigateur, exécutables même sans bypass)
bunx playwright test --config=playwright.preview.config.ts guard.e2e.ts

# scénario complet sur la Preview hébergée
bun run test:e2e:preview
```

Sans `VERCEL_AUTOMATION_BYPASS_SECRET`, le scénario est **ignoré avant toute
navigation** (message explicite) : ce n'est jamais compté comme un succès.

## Portée du bypass

Le secret est injecté par `tests/e2e-preview/fixtures.ts` via l'interception
des requêtes :

- uniquement si `origin === PREVIEW_ORIGIN` ;
- `x-vercel-protection-bypass` n'est jamais envoyé à Convex, à un domaine tiers
  ni à Production ;
- `x-vercel-set-bypass-cookie: true` seulement sur les navigations Preview ;
- jamais dans une URL ;
- toute requête vers un hôte interdit est **abandonnée** et le test échoue.

## Ce que le scénario vérifie

| Étape | Attendu |
|---|---|
| Protection / rendu | page 200 sur l'hôte Preview, React hydraté (`#root` non vide), redirection SSO détectée et refusée |
| Backend | au moins une requête vers `neat-wombat-556.convex.cloud`, zéro vers Production |
| Authentification | formulaire réel, OTP réellement reçu (mail.tm), arrivée sur `/app`, compte de test persistant |
| Découverte / favoris | expression affichée, favori créé (toast), badge « ❤ FAVORI » visible dans Ma mémoire, retrait vérifié |
| SRS | carte créée depuis l'interface, révision « Acquis », écran de prochaine revue, XP **non doublé** par une session rejouée, cartes de test supprimées |
| Shadow | page + quota Preview affichés, aucun appel YouTube/Groq |
| Erreurs | aucune exception JS ni erreur console inattendue |

## Erreurs fréquentes

| Symptôme | Cause |
|---|---|
| `URL de Preview refusée : cible interdite` | `PREVIEW_E2E_BASE_URL` pointe la Production |
| `Vercel SSO : la Preview a redirigé…` | bypass absent, expiré, ou refusé par Vercel |
| `Aucun code OTP reçu` | boîte mail.tm inaccessible ou limite d'envoi Convex Auth atteinte |
| `aucune requête vers neat-wombat…` | frontend buildé avec une autre URL, ou bypass intercepté |
| `EN COURS` absent après « Apprendre » | expression déjà dans le deck : relancer après nettoyage du compte de test |

## Artefacts et secrets

`trace`, `screenshot` et `video` sont désactivés par défaut : ces artefacts
peuvent contenir une session. `test-results/`, `playwright-report/` et
`blob-report/` sont ignorés par Git. Aucun état de session n'est exporté :
chaque exécution refait une connexion OTP réelle.

## Limites

- La Preview doit rester protégée : le bypass est la seule porte d'entrée.
- Les sélecteurs suivent l'interface française actuelle ; une refonte visuelle
  doit mettre à jour `preview.e2e.ts`.
- Le compte de test est dédié ; le scénario nettoie uniquement les cartes SRS
  qu'il a créées et retire le favori qu'il a posé.
- Aucun appel payant (transcription, YouTube, traduction) n'est déclenché.
