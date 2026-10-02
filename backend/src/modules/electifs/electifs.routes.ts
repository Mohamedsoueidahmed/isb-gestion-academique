import { Router, Response, NextFunction } from 'express';
import { authentifier, autoriser } from '../../shared/middlewares/authentification';
import { schemaAssignationElectif, schemaAjoutCatalogueElectif } from './electifs.validation';
import {
  listerCatalogueElectifs,
  ajouterCoursElectifCatalogue,
  listerCreneauxElectifsPourClasse,
  listerChoixPourCreneauEtClasse,
  assignerChoixElectif,
  retirerChoixElectif,
} from './electifs.service';
import { ErreurDonneesInvalides } from '../../shared/erreurs/ErreurMetier';
import { extraireChaineUnique } from '../../shared/utils/extraireParametre';
import { RequeteAuthentifiee } from '../../types/auth.types';

const router = Router();

router.use(authentifier);
router.use(autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'));

router.get(
  '/classes/:classeId/catalogue',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const classeId = extraireChaineUnique(req.params.classeId, 'classeId');
      const catalogue = await listerCatalogueElectifs(classeId);
      res.status(200).json({ succes: true, donnees: catalogue });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.post(
  '/classes/:classeId/catalogue',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const classeId = extraireChaineUnique(req.params.classeId, 'classeId');
      const resultatValidation = schemaAjoutCatalogueElectif.safeParse(req.body);
      if (!resultatValidation.success) {
        throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
      }

      const nouveauCours = await ajouterCoursElectifCatalogue(classeId, resultatValidation.data);
      res.status(201).json({ succes: true, donnees: nouveauCours });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/classes/:classeId/creneaux',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const classeId = extraireChaineUnique(req.params.classeId, 'classeId');
      const creneaux = await listerCreneauxElectifsPourClasse(classeId);
      res.status(200).json({ succes: true, donnees: creneaux });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/classes/:classeId/creneaux/:ueId/choix',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const classeId = extraireChaineUnique(req.params.classeId, 'classeId');
      const ueId = extraireChaineUnique(req.params.ueId, 'ueId');
      const choix = await listerChoixPourCreneauEtClasse(classeId, ueId);
      res.status(200).json({ succes: true, donnees: choix });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.post('/choix', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const resultatValidation = schemaAssignationElectif.safeParse(req.body);
    if (!resultatValidation.success) {
      throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
    }

    const choix = await assignerChoixElectif(
      resultatValidation.data.inscriptionId,
      resultatValidation.data.ueId,
      resultatValidation.data.codeCoursElectif,
      resultatValidation.data.terme
    );
    res.status(200).json({ succes: true, donnees: choix });
  } catch (erreur) {
    next(erreur);
  }
});

router.delete(
  '/choix/:inscriptionId/:ueId',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const inscriptionId = extraireChaineUnique(req.params.inscriptionId, 'inscriptionId');
      const ueId = extraireChaineUnique(req.params.ueId, 'ueId');
      await retirerChoixElectif(inscriptionId, ueId);
      res.status(200).json({ succes: true });
    } catch (erreur) {
      next(erreur);
    }
  }
);

export default router;
