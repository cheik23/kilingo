import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LenisProvider } from "@/components/LenisProvider";
import { AppShell } from "@/components/learner/AppShell";
import { DiscoverView } from "@/components/learner/DiscoverView";
import { MemoryView } from "@/components/learner/MemoryView";
import { ReviewView } from "@/components/learner/ReviewView";
import { ShadowView } from "@/components/learner/ShadowView";
import { SleepView } from "@/components/learner/SleepView";
import {
  ContentRoute,
  MediaHubRoute,
  MySpaceRoute,
  OvAdminRoute,
  OvExploreRoute,
  OvLibraryRoute,
  OvSettingsRoute,
  TodayRoute,
} from "@/pages/AppRoutes";
import { InstrumentationProvider } from "./instrumentation";
import { LanguageProvider } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useThemeMode } from "@/hooks/useThemeMode";
import { rememberReferral } from "@/lib/shareEngine";
import { migrerPreferences } from "@/lib/brandMigration";
import { PwaRuntime } from "@/components/PwaRuntime";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { MascotSprite } from "./components/three/MascotSprite";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const AnalyticsDashboard = lazy(
  () => import("@/components/learner/AnalyticsDashboard").then((m) => ({ default: m.AnalyticsDashboard })),
);
const QuizRoom = lazy(
  () => import("@/components/learner/QuizRoom").then((m) => ({ default: m.QuizRoom })),
);
const AIConversationRoom = lazy(
  () => import("@/components/learner/AIConversationRoom").then((m) => ({ default: m.AIConversationRoom })),
);
const Atlas = lazy(
  () => import("@/components/learner/Atlas").then((m) => ({ default: m.Atlas })),
);
const StoreView = lazy(
  () => import("@/components/learner/StoreView").then((m) => ({ default: m.StoreView })),
);
const LeaderboardView = lazy(
  () => import("@/components/learner/LeaderboardView").then((m) => ({ default: m.LeaderboardView })),
);
const AchievementsView = lazy(
  () => import("@/components/learner/AchievementsView").then((m) => ({ default: m.AchievementsView })),
);
const InviteView = lazy(
  () => import("@/components/learner/InviteView").then((m) => ({ default: m.InviteView })),
);
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      {/* Jabari danse pendant le chargement — pas de WebGL ici, on est
          déjà dans un fallback : le sprite 2D suffit et coûte rien. */}
      <MascotSprite state="dance" className="size-20" />
      <p className="animate-pulse text-sm text-ink-3">Un instant…</p>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[0.625rem] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Avant tout montage : les préférences vivent désormais sous le préfixe
// « kilingo. » (elles étaient sous un ancien préfixe à deux lettres, voir
// brandMigration.ts). Doit passer avant le premier rendu, sinon la première
// composant lit une clé encore vide.
migrerPreferences();

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


/** Redirection Atlas : les anciens chemins conservent leur ?q= (bookmarks). */
function RedirectToAtlas() {
  const [params] = useSearchParams();
  const qs = params.toString();
  return <Navigate to={qs ? `/app/atlas?${qs}` : "/app/atlas"} replace />;
}

function ThemeRuntime() {
  useThemeMode();
  return null;
}

/** Public viral entry point: keeps the referral code while crossing auth. */
function InviteEntry() {
  const { isLoading, isAuthenticated } = useAuth();
  const [params] = useSearchParams();
  const ref = params.get("ref");
  // Mémorise le code AVANT la redirection : le query string ne survit pas
  // toujours au aller-retour OAuth, le localStorage si. En effet, pas
  // pendant le rendu (le rendu doit rester sans effet de bord).
  useEffect(() => { rememberReferral(ref); }, [ref]);
  if (isLoading) return <RouteLoading />;
  if (isAuthenticated) return <Navigate to="/app/invite" replace />;
  const query = ref ? `&ref=${encodeURIComponent(ref)}` : "";
  return <Navigate to={`/auth?returnTo=${encodeURIComponent("/app/invite")}${query}`} replace />;
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Élément #root introuvable — vérifie index.html.");

createRoot(rootEl).render(
  <StrictMode>
    <RootErrorBoundary>
      {/* Capture TOUTE erreur runtime (rendu, promesse, événement global) :
          dialogue avec le message + la stack exacte — la cause racine devient
          visible au lieu d'être avalée. */}
      <InstrumentationProvider>
      <ErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <LanguageProvider>
          <ThemeRuntime />
          <PwaRuntime />
          <BrowserRouter>
            <LenisProvider>
            <RouteSyncer />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/invite" element={<InviteEntry />} />
                <Route
                  path="/auth"
                  element={<AuthPage redirectAfterAuth="/app" />}
                />

                {/* Coquille KILINGO : toutes les vues vivent ici. */}
                <Route
                  path="/app"
                  element={
                    <RequireAuth
                      redirectImmediately
                      title="Entre dans le mouvement"
                      description="Ta progression, ta mémoire et tes contenus t'attendent."
                    >
                      <AppShell />
                    </RequireAuth>
                  }
                >
                  <Route index element={<TodayRoute />} />

                  {/* MON ESPACE — profil, langues, progression, mémoire,
                      contenus sauvegardés : une seule section (§6). */}
                  <Route path="space" element={<MySpaceRoute />} />
                  {/* ANALYTICS — « Ta progression » : stats, insights, objectifs. */}
                  <Route
                    path="analytics"
                    element={
                      <Suspense fallback={<RouteLoading />}>
                        <AnalyticsDashboard />
                      </Suspense>
                    }
                  />
                  {/* QUIZ — « Défis » : QCM, fill-in-the-blank, reverse. */}
                  <Route
                    path="quiz"
                    element={
                      <Suspense fallback={<RouteLoading />}>
                        <QuizRoom />
                      </Suspense>
                    }
                  />
                  {/* ATLAS — recherche + ponts culturels (fusion des deux). */}
                  <Route
                    path="atlas"
                    element={
                      <Suspense fallback={<RouteLoading />}>
                        <Atlas />
                      </Suspense>
                    }
                  />
                  {/* Anciens chemins : Recherche et Ponts sont maintenant
                      fusionnés dans l'Atlas — redirection automatique. */}
                  <Route path="search" element={<RedirectToAtlas />} />
                  <Route path="bridges" element={<RedirectToAtlas />} />
                  {/* CONVERSATION — « Chat IA » : personnages + scénarios. */}
                  <Route
                    path="conversation"
                    element={
                      <Suspense fallback={<RouteLoading />}>
                        <AIConversationRoom />
                      </Suspense>
                    }
                  />

                  {/* BOUTIQUE (MOD 2) — gems, loot boxes, bonus. */}
                  <Route
                    path="store"
                    element={
                      <Suspense fallback={<RouteLoading />}>
                        <StoreView />
                      </Suspense>
                    }
                  />

                  {/* MOD 4 — classement hebdomadaire et ligues. */}
                  <Route
                    path="leaderboard"
                    element={
                      <Suspense fallback={<RouteLoading />}>
                        <LeaderboardView />
                      </Suspense>
                    }
                  />

                  <Route
                    path="achievements"
                    element={
                      <Suspense fallback={<RouteLoading />}>
                        <AchievementsView />
                      </Suspense>
                    }
                  />
                  <Route
                    path="invite"
                    element={
                      <Suspense fallback={<RouteLoading />}>
                        <InviteView />
                      </Suspense>
                    }
                  />

                  {/* Anciens chemins, conservés pour les liens existants. */}
                  <Route path="performance" element={<Navigate to="/app/space" replace />} />
                  <Route path="profile" element={<Navigate to="/app/space" replace />} />

                  <Route path="discover" element={<DiscoverView />} />
                  {/* MEMORY — vue dédiée (parcourt la mémoire + lance la révision) */}
                  <Route path="memory" element={<MemoryView />} />
                  <Route path="shadow" element={<ShadowView />} />
                  <Route path="sleep" element={<SleepView />} />

                  {/* Media Hub — un module par route. */}
                  <Route path="screen" element={<MediaHubRoute tab="screen" />} />
                  <Route path="music" element={<MediaHubRoute tab="music" />} />
                  <Route path="books" element={<MediaHubRoute tab="books" />} />
                  <Route path="talk" element={<MediaHubRoute tab="talk" />} />
                  <Route path="hub" element={<MediaHubRoute tab="music" />} />
                  {/* Fiche adressable : partage, rechargement, retour. */}
                  <Route path="content/:key" element={<ContentRoute />} />

                  {/* Moteur de contenus (module interne). */}
                  <Route path="explore" element={<OvExploreRoute />} />
                  <Route
                    path="library"
                    element={<OvLibraryRoute tab="library" />}
                  />
                  <Route
                    path="history"
                    element={<OvLibraryRoute tab="history" />}
                  />
                  <Route
                    path="favorites"
                    element={<OvLibraryRoute tab="favorites" />}
                  />
                  <Route path="settings" element={<OvSettingsRoute />} />
                  {/* Administration : route conservée, gardée par le rôle. */}
                  <Route path="admin" element={<OvAdminRoute />} />
                </Route>

                {/* Ancien chemin, conservé pour les liens existants. */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </LenisProvider>
          </BrowserRouter>
        </LanguageProvider>
        <Toaster />
      </ConvexAuthProvider>
      </ErrorBoundary>
      </InstrumentationProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
