import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      eslintConfigPrettier,
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  // Fixtures Playwright : le second paramètre de `test.extend` s'appelle
  // `use` par convention — ce n'est pas un Hook React.
  {
    files: ["tests/e2e-preview/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  // Fixture d'archive historique (copie octet-pour-octet du snapshot
  // audit-quality-shield/lot-pilote/avant/, SHA 7ea1f28f…). Les données
  // ne doivent pas être retouchées, donc la fiche [Estetik] (71:323,
  // fiche hors lot) porte un \| hérité du gabarit source. Dérogation
  // placée APRÈS le bloc général, limitée à ce fichier et à cette seule
  // règle.
  {
    files: ["tests/fixtures/slangSeedEnrichmentTl.before-pilot.ts"],
    rules: { "no-useless-escape": "off" },
  },
);
