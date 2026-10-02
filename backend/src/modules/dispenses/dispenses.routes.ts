import { Router, Response, NextFunction } from 'express';
import { authentifier, autoriser } from '../../shared/middlewares/authentification';
import { schemaDispense } from './dispenses.validation';
import { listerMatieresParNiveau, marquerDispense, retirerDispense, obtenirParcoursDeLInscription } from './dispenses.service';
import { ErreurDonneesInvalides } from '../../shared/erreurs/ErreurMetier';
import { extraireChaineUnique } from '../../shared/utils/extraireParametre';
import { RequeteAuthentifiee } from '../../types/auth.types';

const router = Router();

router.use(authentifier);
router.use(autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'));

router.get(
  '/inscriptions/:inscriptionId/parcours',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const inscriptionId = extraireChaineUnique(req.params.inscriptionId, 'inscriptionId');
      const parcours = await obtenirParcoursDeLInscription(inscriptionId);
      res.status(200).json({ succes: true, donnees: parcours });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/inscriptions/:inscriptionId/matieres',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const inscriptionId = extraireChaineUnique(req.params.inscriptionId, 'inscriptionId');
      const niveauId = extraireChaineUnique(req.query.niveauId, 'niveauId');
      const matieres = await listerMatieresParNiveau(inscriptionId, niveauId);
      res.status(200).json({ succes: true, donnees: matieres });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.post(
  '/inscriptions/:inscriptionId/dispenser',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const inscriptionId = extraireChaineUnique(req.params.inscriptionId, 'inscriptionId');
      const resultatValidation = schemaDispense.safeParse(req.body);
      if (!resultatValidation.success) {
        throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
      }
      const affectation = await marquerDispense(
        inscriptionId,
        resultatValidation.data.coursId,
        resultatValidation.data.universiteOrigine,
        resultatValidation.data.noteRetenue,
        req.utilisateur!.utilisateurId
      );
      res.status(200).json({ succes: true, donnees: affectation });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.delete(
  '/inscriptions/:inscriptionId/dispenser/:coursId',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const inscriptionId = extraireChaineUnique(req.params.inscriptionId, 'inscriptionId');
      const coursId = extraireChaineUnique(req.params.coursId, 'coursId');
      await retirerDispense(inscriptionId, coursId);
      res.status(200).json({ succes: true });
    } catch (erreur) {
      next(erreur);
    }
  }
);

export default router;
