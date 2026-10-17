import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlugZap } from "lucide-react";
import type { ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════
   ÉCHEC DU BACKEND — un seul écran pour les deux cas qui laissaient une
   page blanche en local :

     1. `VITE_CONVEX_URL` absente ou invalide : le client Convex lève
        AVANT `createRoot(...).render(...)`, donc aucune frontière
        d'erreur n'est montée et React ne rend rien du tout ;
     2. backend arrêté (URL présente, `npx convex dev` non lancé) :
        l'authentification n'aboutit jamais, la route protégée restait
        un fond vide avec un spinner seul — blanc pour qui regarde.

   Aucun provider n'est requis ici : ni i18n, ni routeur, ni Convex —
   il doit pouvoir s'afficher précisément quand rien de tout cela n'est
   disponible. D'où le lien « Retour à l'accueil » en `<a href>` nu.
   ═══════════════════════════════════════════════════════════════════ */

export function BackendDown({
  heading,
  message,
  url,
}: {
  /** Titre de l'encart, au cas par cas (config absente vs backend arrêté). */
  heading: string;
  message: ReactNode;
  /** URL réellement tentée, affichée en clair pour éviter la chasse au port. */
  url?: string | null;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <PlugZap className="size-5 text-muted-foreground" />
            </div>
          </div>
          <CardTitle className="text-xl">{heading}</CardTitle>
          <CardDescription>{message}</CardDescription>
          {url ? (
            <p className="pt-2 font-mono text-[0.6875rem] break-all text-muted-foreground">
              {url}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
            {"npx convex dev"}
          </pre>
          <p>
            Le terminal affiche ensuite l'URL du backend : elle va dans{" "}
            <code>.env.local</code>, sous le nom <code>VITE_CONVEX_URL</code>.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button className="w-full" onClick={() => window.location.reload()}>
            Réessayer
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Retour à l'accueil
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
