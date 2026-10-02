import { Request, Response, NextFunction } from 'express';
import { ErreurAuthentification } from '../erreurs/ErreurMetier';

/**
 * Vérifie une clé API secrète, partagée à l'avance avec un logiciel
 * externe de confiance (ex. le logiciel d'inscription et paiement) —
 * jamais vue par un navigateur, distincte du jeton de session des
 * administrateurs (`authentifier`, dans authentification.ts), qui
 * expire en 15 minutes et suppose un humain connecté. Une communication
 * entre deux serveurs n'a pas de session à faire expirer : la clé est
 * fixe, configurée une fois dans le fichier .env des deux côtés.
 *
 * Utilisation : router.get('/route', authentifierParCle, ...)
 */
export function authentifierParCle(req: Request, _res: Response, next: NextFunction): void {
  const cleRecue = req.headers['x-api-key'];
  const cleAttendue = process.env.CLE_API_INTEGRATION;

  if (!cleAttendue) {
    // Aucune clé configurée côté serveur : refuser plutôt que d'accepter
    // silencieusement n'importe quel appel — une intégration mal
    // configurée doit échouer bruyamment, jamais s'ouvrir par défaut.
    throw new ErreurAuthentification("La clé d'intégration n'est pas configurée sur ce serveur.");
  }

  if (!cleRecue || cleRecue !== cleAttendue) {
    throw new ErreurAuthentification("Clé d'intégration manquante ou invalide.");
  }

  next();
}
