# Limites 3D et plan de passage aux assets générés

## État vérifié (18 octobre 2026)

- **Tripo 3D existe et correspond au besoin** : API text-to-3D et
  image-to-3D avec export GLB/FBX/OBJ/USDZ. L'abonnement payant
  (crédits ≈ 1 $ / 100) couvre l'usage commercial des assets générés ;
  le palier gratuit (≈ 300 crédits/mois) est limité à un usage NON
  commercial. Sources : tripo3d.ai (pages « commercial-use-ai-3d-models »
  et « 3d-assets-license-game-development », consultées le 18/10/2026).
- **Aucun asset n'a été généré** : le projet n'a aucune clé d'API
  Tripo (`TRIPO_API_KEY` absente de `.env.example` et de l'environnement),
  et aucun connecteur d'intégration n'expose ce service ici. Générer un
  `.glb` « pour faire semblant » et le présenter comme réel serait
  interdit par les règles d'honnêteté du projet (scripts verify-*).
- **Décision assumée** : les monuments des prototypes (fr, zh, sw) sont
  100 % procéduraux (three.js, `src/components/three/diorama/`),
  remplaçables un par un — chacun vit dans son propre `<group>`.

## Pourquoi les monuments restent des composants séparés

Le prompt maître exige des positions animables : aucun monument n'est
fusionné dans une image ou un mesh unique. La scène
(`DioramaScene.tsx`) place chaque monument sur ses coordonnées
géographiques réelles, l'oriente selon la normale du globe, et lui
donne une boîte de clic indépendante (survol, sélection).

## Plan de bascule vers Tripo (quand la clé existera)

1. Poser `TRIPO_API_KEY` dans l'environnement de build (jamais dans le
   code ni un fichier versionné).
2. Générer monument par monument (une requête par asset) à partir des
   références artistiques du prompt : tour Eiffel, Arc de triomphe,
   château, Temple du Ciel, tour de muraille, pagode, Kilimandjaro,
   dhow, acacia.
3. Vérifier PONDÉREMENT chaque `.glb` avant intégration : poids cible
   ≤ 300 Ko (décimation + textures 1024 max), polygones ≤ 20 000.
4. Remplacer le composant procédural par un `<useGLTF>` équivalent dans
   `monuments.tsx` — la signature du composant ne change pas, la scène
   n'a pas à être touchée.
5. Documenter la source et la licence de chaque asset ici (licence API
   Tripo payante = usage commercial couvert ; référencer le crédit de
   génération dans le manifeste du fichier `public/diorama/manifest.json`).

## Repli et accessibilité (déjà en place)

- `prefers-reduced-motion`, device low-end, absence de WebGL, mode
  « lite » du watchdog FPS → repli statique CSS (`StaticHero.tsx`),
  jamais un canvas figé.
- L'interactivité clavier reste assurée par le panneau HTML du hero
  (chips et boutons de monuments) : le canvas 3D n'est qu'un complément.
