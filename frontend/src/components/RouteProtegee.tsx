import { Navigate } from 'react-router-dom';
import { estConnecte } from '../services/auth.service';

interface Props {
  children: React.ReactNode;
}

/**
 * Enveloppe toute page nécessitant une authentification. Si aucun token
 * n'est présent localement, renvoie immédiatement vers la connexion — la
 * vraie vérification de validité du token se fait côté serveur à chaque
 * appel API (voir l'intercepteur 401 dans apiClient.ts).
 */
export default function RouteProtegee({ children }: Props) {
  if (!estConnecte()) {
    return <Navigate to="/connexion" replace />;
  }

  return <>{children}</>;
}
