import { Router, Response, NextFunction } from 'express';
import { authentifier, autoriser } from '../../shared/middlewares/authentification';
import {
  listerAnneesUniversitaires,
  creerAnneeUniversitaire,
  supprimerAnneeUniversitaire,
  definirAnneeActive,
  listerParcours,
  listerNiveauxParParcours,
  listerSemestresParNiveau,
  listerCoursParSemestre,
} from './referentiel.service';
import { schemaCreationAnneeUniversitaire } from './referentiel.validation';
import { ErreurDonneesInvalides } from '../../shared/erreurs/ErreurMetier';
import { extraireChaineUnique } from '../../shared/utils/extraireParametre';
import { RequeteAuthentifiee } from '../../types/auth.types';

const router = Router();

router.use(authentifier);
router.use(autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'));

router.get('/annees-universitaires', async (_req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const annees = await listerAnneesUniversitaires();
    res.status(200).json({ succes: true, donnees: annees });
  } catch (erreur) {
    next(erreur);
  }
});

router.post('/annees-universitaires', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const resultatValidation = schemaCreationAnneeUniversitaire.safeParse(req.body);
    if (!resultatValidation.success) {
      throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
    }

    const resultat = await creerAnneeUniversitaire(resultatValidation.data);
    res.status(201).json({ succes: true, donnees: resultat });
  } catch (erreur) {
    next(erreur);
  }
});

router.patch(
  '/annees-universitaires/:id/activer',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const id = extraireChaineUnique(req.params.id, 'id');
      const annee = await definirAnneeActive(id);
      res.status(200).json({ succes: true, donnees: annee });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.delete(
  '/annees-universitaires/:id',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      await supprimerAnneeUniversitaire(extraireChaineUnique(req.params.id, 'id'));
      res.status(200).json({ succes: true, donnees: null });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get('/parcours', async (_req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const parcours = await listerParcours();
    res.status(200).json({ succes: true, donnees: parcours });
  } catch (erreur) {
    next(erreur);
  }
});

// Cascade : les niveaux dépendent du parcours choisi
router.get('/parcours/:parcoursId/niveaux', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const niveaux = await listerNiveauxParParcours(extraireChaineUnique(req.params.parcoursId, 'parcoursId'));
    res.status(200).json({ succes: true, donnees: niveaux });
  } catch (erreur) {
    next(erreur);
  }
});

// Cascade : les semestres dépendent du niveau choisi
router.get('/niveaux/:niveauId/semestres', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const semestres = await listerSemestresParNiveau(extraireChaineUnique(req.params.niveauId, 'niveauId'));
    res.status(200).json({ succes: true, donnees: semestres });
  } catch (erreur) {
    next(erreur);
  }
});

// Les cours d'un semestre — nécessaire pour la saisie des notes/absences,
// une fois la classe (donc le semestre) choisie.
router.get('/semestres/:semestreId/cours', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const cours = await listerCoursParSemestre(extraireChaineUnique(req.params.semestreId, 'semestreId'));
    res.status(200).json({ succes: true, donnees: cours });
  } catch (erreur) {
    next(erreur);
  }
});

export default router;
