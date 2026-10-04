import { useCallback } from "react";
import { useQuery } from "convex/react";
import { Link, useNavigate, useParams } from "react-router";

import { api } from "@/convex/_generated/api";
import { HomeView } from "@/components/learner/HomeView";
import { MediaHubRoot } from "@/components/learner/MediaHubRoot";
import { MySpaceView } from "@/components/learner/MySpaceView";
import { AdminView } from "@/components/openverse/AdminView";
import { ContentDetail } from "@/components/openverse/ContentDetail";
import { OpenVerseApp } from "@/components/openverse/OpenVerseApp";
import { Rayon } from "@/components/openverse/Rayon";
import {
  LibraryView,
  SettingsView,
} from "@/components/openverse/views";
import type { Content } from "@/openverse/model";

/* ═══════════════════════════════════════════════════════════════════
   Éléments de route de la coquille MOOVY.

   Les vues historiques naviguaient par chaînes de caractères
   ("review", "shadow"…) : on traduit ces clés en routes réelles ici,
   ce qui évite de réécrire chaque vue. Aucune vue n'est dupliquée.

   Le moteur de contenus OpenVerse est embarqué comme module interne :
   il apporte son moteur de recherche et son Rights Engine, la coquille
   apporte la navigation et l'identité MOOVY.
   ═══════════════════════════════════════════════════════════════════ */

const VIEW_ROUTES: Record<string, string> = {
  home: "/app",
  dashboard: "/app/space",
  review: "/app/memory",
  discover: "/app/discover",
  shadow: "/app/shadow",
  hub: "/app/hub",
  sleep: "/app/sleep",
  // « Profil » n'est plus un écran séparé : tout est dans Mon espace.
  profile: "/app/space",
  space: "/app/space",
};

/** Adapte l'ancienne navigation par chaînes aux routes réelles. */
function useViewNav() {
  const navigate = useNavigate();
  return useCallback(
    (view: string) => navigate(VIEW_ROUTES[view] ?? "/app"),
    [navigate],
  );
}

/** ACCUEIL — « Aujourd'hui » : mission du jour, daily drop, raccourcis (§6). */
export function TodayRoute() {
  const onNavigate = useViewNav();
  return <HomeView onNavigate={onNavigate} />;
}

/**
 * MON ESPACE — section unique (§6) : profil, langues, niveau, progression,
 * statistiques, vocabulaire, expressions, contenus sauvegardés, objectifs.
 */
export function MySpaceRoute() {
  const onNavigate = useViewNav();
  return <MySpaceView onNavigate={onNavigate} />;
}

/** Media Hub — une route par module, un seul composant réutilisé. */
export function MediaHubRoute({ tab }: { tab: string }) {
  // `key` force le remontage : sans lui, passer de /app/music à /app/books
  // réutiliserait l'état d'onglet précédent (même type de composant).
  return <MediaHubRoot key={tab} language="en" initialTab={tab} />;
}

/** Bibliothèque / Historique / Favoris — même vue, onglet différent. */
export function OvLibraryRoute({
  tab,
}: {
  tab: "library" | "history" | "favorites";
}) {
  const navigate = useNavigate();
  const openDetail = useCallback(
    (c: Content) => navigate(`/app/content/${encodeURIComponent(c.key)}`),
    [navigate],
  );
  return <LibraryView tab={tab} onOpen={openDetail} />;
}

/**
 * FICHE — route profonde `/app/content/:key`.
 * Rend la même fiche que le panneau, mais adressable et partageable :
 * retour navigateur, rechargement et liens directs fonctionnent.
 */
export function ContentRoute() {
  // React Router décode déjà le segment : la clé peut contenir « / » ou « : »
  // sans casser la route (elle est encodée au moment du lien).
  const { key = "" } = useParams();
  const content = useQuery(api.ovSearch.getContent, key ? { key } : "skip");

  if (!key) return <p className="text-sm text-ink-2">Contenu introuvable.</p>;
  if (content === undefined) {
    return <p className="animate-pulse text-sm text-ink-2">Chargement de la fiche…</p>;
  }
  if (content === null) {
    return (
      <div className="ln-card p-6">
        <p className="font-display text-lg text-ink">Ce contenu n'est pas (encore) indexé.</p>
        <p className="mt-2 text-sm text-ink-2">
          Relance une recherche ou ouvre le rayon correspondant : la fiche sera créée au premier affichage.
        </p>
        <Link to="/app" className="mt-4 inline-block text-sm text-gold hover:underline">
          Retour à l'accueil
        </Link>
      </div>
    );
  }
  return <ContentDetail content={content as unknown as Content} onClose={() => window.history.back()} />;
}

/** EXPLORER — le moteur de contenus, embarqué (chrome global masqué). */
export function OvExploreRoute() {
  return <OpenVerseApp embedded />;
}

/** PARAMÈTRES — préférences, connecteurs, état des moteurs. */
export function OvSettingsRoute() {
  return <SettingsView />;
}

/**
 * ADMINISTRATION — hors navigation utilisateur.
 * La route existe toujours pour les comptes administrateurs, mais elle
 * n'est atteignable par personne d'autre : le rôle est vérifié côté serveur
 * (`ovAdmin.amIAdmin`) avant qu'un seul écran d'administration soit monté.
 */
export function OvAdminRoute() {
  const access = useQuery(api.ovAdmin.amIAdmin);

  if (access === undefined) {
    return <p className="animate-pulse text-sm text-ink-2">Chargement…</p>;
  }
  if (!access.admin) {
    return (
      <div className="ln-card p-6">
        <p className="font-display text-lg text-ink">Espace réservé</p>
        <p className="mt-2 text-sm text-ink-2">
          Cette section n'est pas accessible depuis ton compte.
        </p>
        <Link to="/app" className="mt-4 inline-block text-sm text-gold hover:underline">
          Retour à l'accueil
        </Link>
      </div>
    );
  }
  return <AdminView />;
}
