import { Router, Response, NextFunction } from 'express';
import { authentifier, autoriser } from '../../shared/middlewares/authentification';
import {
  schemaCreationEtudiant,
  schemaModificationEtudiant,
  schemaCreationInscription,
  schemaChangementClasse,
  schemaRechercheEtudiant,
} from './etudiants.validation';
import {
  creerEtudiant,
  trouverEtudiantParMatricule,
  modifierEtudiant,
  supprimerEtudiant,
  bloquerEtudiant,
  debloquerEtudiant,
  obtenirEtudiantParId,
  rechercherEtudiants,
} from './etudiants.service';
import { creerInscription, changerClasseInscription, listerEtudiantsParClasse } from './inscriptions.service';
import { ErreurDonneesInvalides } from '../../shared/erreurs/ErreurMetier';
import { extraireChaineUnique } from '../../shared/utils/extraireParametre';
import { RequeteAuthentifiee } from '../../types/auth.types';

const router = Router();

router.use(authentifier);
router.use(autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'));

router.post('/', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const resultatValidation = schemaCreationEtudiant.safeParse(req.body);
    if (!resultatValidation.success) {
      throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
    }

    const etudiant = await creerEtudiant(resultatValidation.data);
    res.status(201).json({ succes: true, donnees: etudiant });
  } catch (erreur) {
    next(erreur);
  }
});

router.get('/', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const resultatValidation = schemaRechercheEtudiant.safeParse(req.query);
    if (!resultatValidation.success) {
      throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Filtres invalides.');
    }

    const etudiants = await rechercherEtudiants(resultatValidation.data.recherche, resultatValidation.data.anneeUniversitaireId);
    res.status(200).json({ succes: true, donnees: etudiants });
  } catch (erreur) {
    next(erreur);
  }
});

router.get('/par-matricule/:matricule', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const etudiant = await trouverEtudiantParMatricule(extraireChaineUnique(req.params.matricule, 'matricule'));
    res.status(200).json({ succes: true, donnees: etudiant });
  } catch (erreur) {
    next(erreur);
  }
});

router.get('/:id', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const etudiant = await obtenirEtudiantParId(extraireChaineUnique(req.params.id, 'id'));
    res.status(200).json({ succes: true, donnees: etudiant });
  } catch (erreur) {
    next(erreur);
  }
});

router.patch('/:id', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const resultatValidation = schemaModificationEtudiant.safeParse(req.body);
    if (!resultatValidation.success) {
      throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
    }

    const etudiant = await modifierEtudiant(extraireChaineUnique(req.params.id, 'id'), resultatValidation.data);
    res.status(200).json({ succes: true, donnees: etudiant });
  } catch (erreur) {
    next(erreur);
  }
});

router.delete('/:id', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    await supprimerEtudiant(extraireChaineUnique(req.params.id, 'id'));
    res.status(204).send();
  } catch (erreur) {
    next(erreur);
  }
});

router.patch('/:id/bloquer', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const etudiant = await bloquerEtudiant(extraireChaineUnique(req.params.id, 'id'));
    res.status(200).json({ succes: true, donnees: etudiant });
  } catch (erreur) {
    next(erreur);
  }
});

router.patch('/:id/debloquer', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const etudiant = await debloquerEtudiant(extraireChaineUnique(req.params.id, 'id'));
    res.status(200).json({ succes: true, donnees: etudiant });
  } catch (erreur) {
    next(erreur);
  }
});

router.post('/inscriptions', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const resultatValidation = schemaCreationInscription.safeParse(req.body);
    if (!resultatValidation.success) {
      throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
    }

    const inscription = await creerInscription(resultatValidation.data.etudiantId, resultatValidation.data.classeId);
    res.status(201).json({ succes: true, donnees: inscription });
  } catch (erreur) {
    next(erreur);
  }
});

router.patch(
  '/inscriptions/:inscriptionId/classe',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const resultatValidation = schemaChangementClasse.safeParse(req.body);
      if (!resultatValidation.success) {
        throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
      }

      const inscription = await changerClasseInscription(
        extraireChaineUnique(req.params.inscriptionId, 'inscriptionId'),
        resultatValidation.data.nouvelleClasseId
      );
      res.status(200).json({ succes: true, donnees: inscription });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get('/classes/:classeId', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const etudiants = await listerEtudiantsParClasse(extraireChaineUnique(req.params.classeId, 'classeId'));
    res.status(200).json({ succes: true, donnees: etudiants });
  } catch (erreur) {
    next(erreur);
  }
});

export default router;
