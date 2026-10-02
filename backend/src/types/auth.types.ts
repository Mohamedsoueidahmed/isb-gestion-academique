import { Request } from 'express';

export type LibelleRole = 'ADMINISTRATEUR' | 'RESPONSABLE_ACADEMIQUE';

export interface PayloadJWT {
  utilisateurId: string;
  role: LibelleRole;
}

/**
 * Requête Express enrichie avec les informations de l'utilisateur authentifié.
 * Remplie par le middleware `authentifier` après vérification du token.
 */
export interface RequeteAuthentifiee extends Request {
  utilisateur?: PayloadJWT;
}
