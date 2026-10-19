import { CONTENT_LANGUAGES } from "@/data/contentLanguages";

/* ═══════════════════════════════════════════════════════════════════
   MONDES MINIATURES — configuration des prototypes (fr · zh · sw)

   Trois prototypes, pas une hiérarchie. Chaque monde décrit :
     · les monuments CULTURELS réels de la langue (procéduraux pour
       l'instant — voir docs/limites-3d.md pour Tripo) ;
     · leur position géographique RÉELLE (lat/lon), sensée sur un globe ;
     · les masses de terre visibles depuis la caméra de mise en avant.

   L'HONNÊTETÉ (non négociable) :
     · `worldHasContent()` lit la liste INJECTÉE AU BUILD
       (contentLanguages) : le badge « bientôt » n'est jamais décidé à
       la main.
     · Aucun monde ne prétend offrir un « cours » : le panneau du hero
       renvoie vers le parcours réel de l'app (Auth → focus de langues).
   ═══════════════════════════════════════════════════════════════════ */

export type WorldCode = "fr" | "zh" | "sw";

export type MonumentSpec = {
  /** Clé du composant procédural (monuments.tsx). */
  kind:
    | "eiffelTower"
    | "arcDeTriomphe"
    | "loireCastle"
    | "templeOfHeaven"
    | "greatWallTower"
    | "pagoda"
    | "kilimanjaro"
    | "dhow"
    | "acacia";
  /** Placé à l'endroit réel (lat/lon) sur le globe. */
  lat: number;
  lon: number;
  /** Taille relative au globe (rayon = 1). */
  scale: number;
  /** Libellé accessible (aria-label du panneau, bouton du hero). */
  label: string;
  /** Casse décorative associée (pastille, accent). */
  accent: "rose" | "turquoise" | "menthe";
};

export type LandBlobSpec = {
  lat: number;
  lon: number;
  radius: number;
  squash: number;
};

export type WorldConfig = {
  code: WorldCode;
  /** Nom natif — jamais traduit. */
  native: string;
  flag: string;
  regionLabel: string;
  /** Décalage initial du globe pour amener cette région face caméra. */
  introLon: number;
  monuments: MonumentSpec[];
  lands: LandBlobSpec[];
};

export const WORLDS: Record<WorldCode, WorldConfig> = {
  fr: {
    code: "fr",
    native: "Français",
    flag: "🇫🇷",
    regionLabel: "Monuments et patrimoine francophone",
    introLon: -2.35,
    monuments: [
      { kind: "eiffelTower", lat: 48.86, lon: 2.35, scale: 0.26, label: "Tour Eiffel", accent: "rose" },
      { kind: "arcDeTriomphe", lat: 48.95, lon: -1.3, scale: 0.2, label: "Arc de triomphe", accent: "turquoise" },
      { kind: "loireCastle", lat: 46.5, lon: 1.2, scale: 0.2, label: "Château de la Loire", accent: "menthe" },
    ],
    lands: [
      { lat: 48, lon: 2, radius: 0.56, squash: 0.42 },
      { lat: 20, lon: -15, radius: 0.42, squash: 0.3 },
      { lat: -8, lon: 20, radius: 0.48, squash: 0.34 },
    ],
  },
  zh: {
    code: "zh",
    native: "Mandarin",
    flag: "🇨🇳",
    regionLabel: "Architecture et culture chinoises",
    introLon: -116.4,
    monuments: [
      { kind: "templeOfHeaven", lat: 39.88, lon: 116.41, scale: 0.28, label: "Temple du Ciel", accent: "turquoise" },
      { kind: "greatWallTower", lat: 40.43, lon: 116.57, scale: 0.22, label: "Muraille de Chine", accent: "rose" },
      { kind: "pagoda", lat: 30.25, lon: 120.16, scale: 0.26, label: "Pagode du Sud", accent: "menthe" },
    ],
    lands: [
      { lat: 33, lon: 112, radius: 0.66, squash: 0.46 },
      { lat: -5, lon: 110, radius: 0.4, squash: 0.3 },
    ],
  },
  sw: {
    code: "sw",
    native: "Kiswahili",
    flag: "🇰🇪",
    regionLabel: "Afrique de l'Est : savane, côte, sommets",
    introLon: -36,
    monuments: [
      { kind: "kilimanjaro", lat: -3.07, lon: 37.35, scale: 0.3, label: "Kilimandjaro", accent: "menthe" },
      { kind: "dhow", lat: -6.16, lon: 39.19, scale: 0.2, label: "Dhow de Zanzibar", accent: "turquoise" },
      { kind: "acacia", lat: -2.5, lon: 36.2, scale: 0.2, label: "Acacia de la savane", accent: "rose" },
    ],
    lands: [
      { lat: -3, lon: 36, radius: 0.62, squash: 0.44 },
      { lat: 12, lon: 36, radius: 0.4, squash: 0.3 },
      { lat: -20, lon: 34, radius: 0.44, squash: 0.34 },
    ],
  },
};

export const WORLD_CODES = Object.keys(WORLDS) as WorldCode[];

/**
 * Vrai UNIQUEMENT si la langue a du contenu réel (fr = interface, ou
 * langue injectée au build via slangSeed). Rien n'est décidé ici.
 */
export function worldHasContent(code: WorldCode): boolean {
  if (code === "fr") return true;
  return CONTENT_LANGUAGES.includes(code);
}

/* Palette diorama partagée (menthe / turquoise / rose / ivoire).
   Pastel et satiné volontairement, cohérent avec la nouvelle identité. */
export const DIORAMA = {
  ocean: "#5FD9C7",
  oceanDeep: "#2FA396",
  land: "#A7E8D6",
  landAlt: "#8ADCC6",
  stone: "#FFF8EF",
  stoneWarm: "#F3DCC3",
  rose: "#F3A9C8",
  roseSoft: "#F9D9E7",
  turquoise: "#42CDBA",
  ink: "#17484A",
  snow: "#FFF8EF",
  flora: "#42CDBA",
} as const;
