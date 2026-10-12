import { vlyPlugin } from "@vly-ai/integrations";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

import { SLANG_SEED } from "./src/convex/slangSeed";

/* ═══════════════════════════════════════════════════════════════════════
   « CETTE LANGUE A-T-ELLE DU CONTENU ? » — dérivée des seeds AU BUILD.

   C'est la question que posent les badges « Bientôt » (sélecteurs, mur de la
   landing, bannière de langue vide). La réponse est écrite UNE fois, dans les
   seeds, et calculée ici : aucune liste de langues recopiée à la main, donc
   rien qui puisse diverger des expressions réellement présentes.

   Pourquoi au build et pas via une requête Convex : les fonctions Convex se
   poussent à la main, alors que le front part au push. Une requête aurait
   laissé les badges INVISIBLES jusqu'à ce déploiement manuel, sans aucun
   signe d'erreur — l'interface aurait semblé ignorer la consigne. Ici, un
   ajout de contenu dans un seed suffit : le prochain build enlève les badges.
   (Redémarrer le serveur de dev après un ajout : ce calcul tourne au
   démarrage de Vite, pas à chaud.)

   Le backend fait la MÊME dérivation à chaud (`convex/slang.ts`, ALL_LANGS),
   à partir du même tableau : les deux ne peuvent pas se contredire.
   ═══════════════════════════════════════════════════════════════════════ */
const CONTENT_LANGUAGES = [...new Set<string>(SLANG_SEED.map((entry) => entry.language))];

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), vlyPlugin(), tailwindcss()],
  define: {
    __CONTENT_LANGUAGES__: JSON.stringify(CONTENT_LANGUAGES),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Force a single copy of React across all packages (including vlyPlugin).
    // Without this, @vly-ai/integrations can resolve its own React copy, which
    // triggers "Invalid hook call" errors at runtime.
    dedupe: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  },
  build: {
    // Enable source maps for better debugging (disable in production if needed)
    sourcemap: false,
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching and lazy loading
        manualChunks: {
          // Vendor chunks for large libraries
          'react-vendor': ['react', 'react-dom', 'react-router'],
          'convex-vendor': ['convex'],
          // Large UI library chunks
          'radix-ui': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],
          // Heavy optional libraries - separate chunks for better lazy loading
          'framer-motion': ['framer-motion'],
          'charts': ['recharts'],
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
        // Optimize chunk size
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit for better chunking
    chunkSizeWarningLimit: 1000,
    // Target modern browsers for better optimization
    target: 'esnext',
    // Minify options - using esbuild (faster than terser)
    minify: 'esbuild',
  },
  // Optimize dependencies
  optimizeDeps: {
    // Only scan the app entry HTML; avoids crawling unrelated *.html files
    // if a legacy snapshot accidentally contains leaked package folders.
    entries: ['index.html'],
    include: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      'react-router',
      '@convex-dev/auth/react',
      'framer-motion',
    ],
  },
  // Performance hints
  server: { allowedHosts: true,
    // Bind to all interfaces so WebContainer's server-ready event fires.
    host: true,
    port: 5173,
    // Keep HMR on, but disable full-screen error overlay
    hmr: {
      overlay: false,
    },
  },
});
