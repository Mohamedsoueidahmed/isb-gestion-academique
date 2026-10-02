import type { ReactNode } from 'react';
import RouteProtegee from './RouteProtegee';
import { AnneeUniversitaireProvider } from '../contexts/AnneeUniversitaireContext';

interface Props {
  children: ReactNode;
}

/**
 * Combine RouteProtegee et AnneeUniversitaireProvider : le fournisseur
 * d'année ne monte qu'APRÈS que RouteProtegee ait confirmé la présence d'un
 * token, jamais sur une route publique comme /connexion.
 *
 * Pourquoi c'est important, pas juste une préférence d'organisation : le
 * fournisseur appelle l'API dès son montage. S'il enveloppait aussi la page
 * de connexion, un token expiré déclencherait un 401 → rechargement forcé
 * vers /connexion → le fournisseur remonte et retente sans token → nouveau
 * 401 → nouveau rechargement — une boucle infinie, jamais un simple retour
 * à l'écran de connexion.
 */
export default function RoutePrivee({ children }: Props) {
  return (
    <RouteProtegee>
      <AnneeUniversitaireProvider>{children}</AnneeUniversitaireProvider>
    </RouteProtegee>
  );
}
