import { Navigate } from "react-router";

/**
 * Ancienne route protégée. MOOVY vit désormais sous `/app` :
 * on redirige pour ne casser aucun lien existant. L'authentification
 * est gérée par la coquille (`<AppShell>` derrière `<RequireAuth>`),
 * qui préserve le chemin demandé dans `/auth?returnTo=…`.
 */
export default function Dashboard() {
  return <Navigate to="/app" replace />;
}
