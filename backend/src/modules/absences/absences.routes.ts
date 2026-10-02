import { Router, Response, NextFunction } from 'express';
import { authentifier, autoriser } from '../../shared/middlewares/authentification';
import { schemaSaisieAbsences } from './absences.validation';
import {
  saisirAbsences,
  obtenirFeuilleSeance,
  obtenirHistoriqueAbsencesEtudiant,
  obtenirStatistiquesAbsencesClasse,
  obtenirHistoriqueSeancesParCours,
  genererDonneesAbsencesTerme,
} from './absences.service';
import { genererPdfAbsencesTerme } from './absences.pdf';
import { ErreurDonneesInvalides, ErreurAuthentification } from '../../shared/erreurs/ErreurMetier';
import { extraireChaineUnique } from '../../shared/utils/extraireParametre';
import { RequeteAuthentifiee } from '../../types/auth.types';

const router = Router();

router.use(authentifier);
router.use(autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'));

router.post('/', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    if (!req.utilisateur) {
      throw new ErreurAuthentification();
    }

    const resultatValidation = schemaSaisieAbsences.safeParse(req.body);
    if (!resultatValidation.success) {
      throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
    }

    const absences = await saisirAbsences(resultatValidation.data, req.utilisateur.utilisateurId);
    res.status(200).json({ succes: true, donnees: absences });
  } catch (erreur) {
    next(erreur);
  }
});

router.get(
  '/classes/:classeId/cours/:coursId/seance',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const dateSeanceBrute = req.query.date;
      if (typeof dateSeanceBrute !== 'string') {
        throw new ErreurDonneesInvalides('Le paramètre "date" est requis (format AAAA-MM-JJ).');
      }
      const dateSeance = new Date(dateSeanceBrute);
      if (Number.isNaN(dateSeance.getTime())) {
        throw new ErreurDonneesInvalides('Le paramètre "date" est invalide.');
      }

      const feuille = await obtenirFeuilleSeance(
        extraireChaineUnique(req.params.classeId, 'classeId'),
        extraireChaineUnique(req.params.coursId, 'coursId'),
        dateSeance
      );
      res.status(200).json({ succes: true, donnees: feuille });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/inscriptions/:inscriptionId/historique',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const { coursId, dateDebut, dateFin } = req.query;
      const historique = await obtenirHistoriqueAbsencesEtudiant(
        extraireChaineUnique(req.params.inscriptionId, 'inscriptionId'),
        {
        coursId: typeof coursId === 'string' ? coursId : undefined,
        dateDebut: typeof dateDebut === 'string' ? new Date(dateDebut) : undefined,
        dateFin: typeof dateFin === 'string' ? new Date(dateFin) : undefined,
      });
      res.status(200).json({ succes: true, donnees: historique });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/classes/:classeId/statistiques',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const statistiques = await obtenirStatistiquesAbsencesClasse(
        extraireChaineUnique(req.params.classeId, 'classeId')
      );
      res.status(200).json({ succes: true, donnees: statistiques });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/classes/:classeId/cours/:coursId/historique',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const historique = await obtenirHistoriqueSeancesParCours(
        extraireChaineUnique(req.params.classeId, 'classeId'),
        extraireChaineUnique(req.params.coursId, 'coursId')
      );
      res.status(200).json({ succes: true, donnees: historique });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/classes/:classeId/export-pdf',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const classeId = extraireChaineUnique(req.params.classeId, 'classeId');
      const terme = typeof req.query.terme === 'string' ? req.query.terme : null;
      const { classeNom, cours } = await genererDonneesAbsencesTerme(classeId, terme);
      const doc = genererPdfAbsencesTerme(classeNom, terme, cours);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="absences-${terme ?? 'sans-terme'}.pdf"`);
      doc.pipe(res);
      doc.end();
    } catch (erreur) {
      next(erreur);
    }
  }
);

export default router;
