import { Response, NextFunction } from 'express';
import { verifierToken } from '../../modules/auth/auth.service';
import { ErreurAuthentification, ErreurNonAutorise } from '../erreurs/ErreurMetier';
import { RequeteAuthentifiee, LibelleRole } from '../../types/auth.types';

/**
 * Vérifie qu'un token JWT valide est présent dans l'en-tête Authorization.
 * Doit être placé avant tout middleware `autoriser` sur une route protégée.
 */
export function authentifier(
  req: RequeteAuthentifiee,
  _res: Response,
  next: NextFunction
): void {
  const enTeteAuth = req.headers.authorization;

  if (!enTeteAuth || !enTeteAuth.startsWith('Bearer ')) {
    throw new ErreurAuthentification('Token manquant.');
  }

  const token = enTeteAuth.substring('Bearer '.length);
  req.utilisateur = verifierToken(token);
  next();
}

/**
 * Vérifie que l'utilisateur authentifié a l'un des rôles autorisés.
 * Utilisation : router.post('/classes', authentifier, autoriser('ADMINISTRATEUR'), ...)
 *
 * Aucun rôle "ENSEIGNANT" n'existe dans ce système — le professeur n'a
 * strictement aucune route qui lui soit accessible (confirmé explicitement).
 */
export function autoriser(...rolesAutorises: LibelleRole[]) {
  return (req: RequeteAuthentifiee, _res: Response, next: NextFunction): void => {
    if (!req.utilisateur) {
      // Ne devrait jamais arriver si `authentifier` a été appelé avant —
      // mais on protège quand même contre un mauvais ordre de middlewares.
      throw new ErreurAuthentification();
    }

    if (!rolesAutorises.includes(req.utilisateur.role)) {
      throw new ErreurNonAutorise();
    }

    next();
  };
}
