import { Component, type ErrorInfo, type ReactNode } from "react";
import { MascotSprite } from "@/components/three/MascotSprite";

/* ═══════════════════════════════════════════════════════════════════
   ErrorBoundary — jamais d'écran blanc, jamais d'erreur technique.
   Attrape toute erreur de rendu et affiche un message lisible sur fond
   brun profond (#2C1810) avec accents or terre (#D4A574). Les détails réels (message,
   stack) restent en console — jamais affichés (règle R4).
   ═══════════════════════════════════════════════════════════════════ */

type Props = { children: ReactNode };

type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Crash attrapé :", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-noir p-6 text-ink-2">
        <div className="mx-auto max-w-xl pt-[12vh]">
          {/* Jabari cherche pourquoi ça coince (sprite 2D : zéro WebGL
              dans un écran d'erreur, c'est le moment le moins adapted. */}
          <MascotSprite state="think" className="mb-6 size-16" />
          <p className="font-display text-2xl font-semibold text-gold">
            Une erreur est survenue
          </p>
          <p className="mt-3 break-words text-sm text-ink">
            Indisponible pour le moment. Recharge la page pour réessayer.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-full bg-gradient-to-r from-gold to-gold-soft px-6 py-2.5 text-sm font-semibold text-black transition-transform active:scale-[0.97]"
          >
            Recharger
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
