import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "ln-cta ln-grad-gold ln-btn-3d bg-gold-deep text-noir font-semibold hover:brightness-105",
        destructive:
          "bg-destructive text-[#ffffff] hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "ln-grad-magenta ln-btn-3d-magenta bg-magenta-deep text-[#ffffff] font-semibold hover:brightness-105",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/** Un ripple vit 640 ms — au-delà, il est déjà invisible. */
const RIPPLE_MS = 640

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

/**
 * Bouton du design system. LOT H : chaque appui pose un ripple doré à
 * l'endroit exact du curseur (retour tactile sur tous les CTA de l'app,
 * sans toucher un seul appelant).
 *
 * Le ripple est un `<span>` décoratif `aria-hidden`, `pointer-events-none`,
 * retiré après son animation : il ne peut ni capturer un clic, ni être lu par
 * un lecteur d'écran, ni survivre à son effet. Mouvement réduit ⇒ aucun
 * ripple, aucune animation. `asChild` ⇒ pas de ripple : le composant enfant
 * garde la main sur ses propres enfants.
 */
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  children,
  onPointerDown,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"
  const [ripples, setRipples] = React.useState<
    { id: number; x: number; y: number; d: number }[]
  >([])

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    onPointerDown?.(event)
    if (asChild || prefersReducedMotion()) return
    const box = event.currentTarget.getBoundingClientRect()
    const diameter = Math.max(box.width, box.height) * 1.4
    const id = Date.now() + Math.random()
    setRipples((prev) => [
      // 4 ripples au maximum : un appui frénétique ne fait pas grossir le DOM.
      ...prev.slice(-3),
      {
        id,
        x: event.clientX - box.left - diameter / 2,
        y: event.clientY - box.top - diameter / 2,
        d: diameter,
      },
    ])
    window.setTimeout(
      () => setRipples((prev) => prev.filter((ripple) => ripple.id !== id)),
      RIPPLE_MS,
    )
  }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        buttonVariants({ variant, size, className }),
        !asChild && "relative overflow-hidden"
      )}
      onPointerDown={handlePointerDown}
      {...props}
    >
      {children}
      {!asChild &&
        ripples.map((ripple) => (
          <span
            key={ripple.id}
            aria-hidden="true"
            className="ln-ripple-ink"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.d,
              height: ripple.d,
            }}
          />
        ))}
    </Comp>
  )
}

export { Button, buttonVariants }
