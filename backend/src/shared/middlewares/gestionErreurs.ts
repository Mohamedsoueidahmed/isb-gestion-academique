import { Request, Response, NextFunction } from 'express';
import { ErreurMetier } from '../erreurs/ErreurMetier';

/**
 * Middleware final de gestion des erreurs.
 * Doit être enregistré en dernier dans la chaîne de middlewares Express.
 * Toute erreur levée dans une route ou un service (via next(erreur))
 * passe par ici — aucune route ne doit gérer ses propres erreurs individuellement.
 */
export function gestionErreurs(
  erreur: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (erreur instanceof ErreurMetier) {
    res.status(erreur.codeHttp).json({
      succes: false,
      code: erreur.codeErreur,
      message: erreur.message,
    });
    return;
  }

  // Erreur inattendue, non prévue par le code métier.
  // On ne renvoie jamais le détail technique brut au client (fuite d'information).
  console.error('Erreur non gérée :', erreur);
  res.status(500).json({
    succes: false,
    code: 'ERREUR_INTERNE',
    message: "Une erreur interne est survenue.",
  });
}
