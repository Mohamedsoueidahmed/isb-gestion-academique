import { Router, Response, NextFunction } from 'express';
import { authentifier, autoriser } from '../../shared/middlewares/authentification';
import {
  obtenirStatistiquesGlobales,
  obtenirEtudiantsParNiveau,
  obtenirEtudiantsParParcours,
  obtenirEtatSaisieParClasse,
} from './dashboard.service';
import { RequeteAuthentifiee } from '../../types/auth.types';

const router = Router();

router.use(authentifier);
router.use(autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'));

/**
 * Le filtre par année est optionnel côté validation (contrairement à
 * extraireChaineUnique, qui exige toujours une valeur) — chaque écran du
 * tableau de bord passe désormais l'année sélectionnée globalement, mais
 * on reste tolérant si elle est absente plutôt que de rejeter la requête.
 */
function extraireAnneeOptionnelle(valeur: unknown): string | undefined {
  return typeof valeur === 'string' ? valeur : undefined;
}

router.get('/statistiques-globales', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const statistiques = await obtenirStatistiquesGlobales(extraireAnneeOptionnelle(req.query.anneeUniversitaireId));
    res.status(200).json({ succes: true, donnees: statistiques });
  } catch (erreur) {
    next(erreur);
  }
});

router.get('/etudiants-par-niveau', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const donnees = await obtenirEtudiantsParNiveau(extraireAnneeOptionnelle(req.query.anneeUniversitaireId));
    res.status(200).json({ succes: true, donnees });
  } catch (erreur) {
    next(erreur);
  }
});

router.get('/etudiants-par-parcours', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const donnees = await obtenirEtudiantsParParcours(extraireAnneeOptionnelle(req.query.anneeUniversitaireId));
    res.status(200).json({ succes: true, donnees });
  } catch (erreur) {
    next(erreur);
  }
});

router.get('/etat-saisie-classes', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const donnees = await obtenirEtatSaisieParClasse(extraireAnneeOptionnelle(req.query.anneeUniversitaireId));
    res.status(200).json({ succes: true, donnees });
  } catch (erreur) {
    next(erreur);
  }
});

export default router;
