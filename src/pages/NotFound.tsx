import { motion } from "framer-motion";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative flex min-h-screen flex-col overflow-hidden bg-noir text-ink"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 h-[320px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-[120px]" />
      </div>
      <div className="relative flex flex-1 flex-col items-center justify-center px-5 text-center">
        <p className="font-display text-7xl font-semibold text-gradient-gold italic">
          404
        </p>
        <p className="mt-4 font-display text-2xl">Cette rue n'existe pas.</p>
        <p className="mt-2 max-w-sm text-sm text-ink-2">
          La page que tu cherches a disparu dans la nuit urbaine.
        </p>
        <Link
          to="/"
          className="ln-glow mt-8 rounded-full bg-gradient-to-r from-gold to-gold-soft px-7 py-3 text-sm font-semibold text-noir transition-transform hover:-translate-y-0.5"
        >
          Retour au quartier
        </Link>
      </div>
    </motion.div>
  );
}
