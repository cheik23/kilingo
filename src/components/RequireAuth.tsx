import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BackendDown } from "@/components/BackendDown";
import { useAuth } from "@/hooks/use-auth";
import { useConvexConnectionState } from "convex/react";
import { Loader2, Lock } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

/** Délai accordé au premier WebSocket avant de déclarer le backend absent. */
const BACKEND_GRACE_MS = 4000;

/**
 * Wraps a route that requires a signed-in user.
 *
 * Signed-out visitors used to be bounced straight to `/auth`, which left them
 * on a bare sign-in form with no idea which page they had asked for or why they
 * were moved. The block is now stated on the page they landed on, and sign-in
 * still returns them to it via `returnTo`. Pass `redirectImmediately` for a
 * route where the bounce really is the better experience.
 */
export function RequireAuth({
  children,
  title = "Sign in to continue",
  description = "This page is only available to signed-in users.",
  redirectImmediately = false,
}: {
  children: ReactNode;
  /** Headline on the blocked screen. */
  title?: string;
  /** Says what the visitor gets by signing in. */
  description?: string;
  /** Skip the explanation and go straight to `/auth`. */
  redirectImmediately?: boolean;
}) {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /* Le chargement éternel a une cause fréquente en local : le backend Convex
     n'est pas lancé. `useConvexAuth()` n'a alors jamais de réponse, et cette
     page restait un fond vide avec un spinner seul — un écran blanc, pour qui
     regarde. On laisse une poignée de secondes au premier WebSocket, puis on
     nomme la panne au lieu de tourner indéfiniment. */
  const connection = useConvexConnectionState();
  const [gracePassed, setGracePassed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setGracePassed(true), BACKEND_GRACE_MS);
    return () => clearTimeout(id);
  }, []);
  const backendDown =
    gracePassed && !connection.isWebSocketConnected && !connection.hasEverConnected;

  if (isLoading) {
    if (backendDown) {
      return (
        <BackendDown
          heading="Serveur injoignable"
          message="KILINGO n'arrive pas à joindre son backend Convex. C'est le cas quand `npx convex dev` n'est pas lancé : sans lui, aucun compte, aucune progression et aucun contenu ne peuvent être chargés."
          url={(import.meta.env.VITE_CONVEX_URL as string | undefined)?.trim()}
        />
      );
    }
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        {/* Le texte n'est pas décoratif : sans lui, un chargement bloqué est
            indiscernable d'une page cassée. */}
        <p className="text-sm text-muted-foreground">Connexion au serveur…</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    const signInHref = `/auth?returnTo=${encodeURIComponent(returnTo)}`;

    if (redirectImmediately) {
      return <Navigate to={signInHref} replace />;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                <Lock className="size-5 text-muted-foreground" />
              </div>
            </div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            You'll come straight back to this page once you're signed in.
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => navigate(signInHref)}>
              Sign in
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/")}
            >
              Back to home
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return children;
}
