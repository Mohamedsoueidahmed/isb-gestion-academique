import { Router, Response, NextFunction } from 'express';
import { authentifier, autoriser } from '../../shared/middlewares/authentification';
import { schemaCreationClasse, schemaModificationClasse, schemaFiltresClasse } from './classes.validation';
import { creerClasse, modifierClasse, supprimerClasse, basculerSemestreActif, obtenirOptionsInscriptionNiveauSuivant, obtenirClasseParId, listerClasses } from './classes.service';
import { genererPdfListeEtudiantsClasse } from './classes.pdf';
import { ErreurDonneesInvalides } from '../../shared/erreurs/ErreurMetier';
import { extraireChaineUnique } from '../../shared/utils/extraireParametre';
import { RequeteAuthentifiee } from '../../types/auth.types';

const router = Router();

// Toutes les routes de ce module exigent une authentification.
router.use(authentifier);

router.post(
  '/',
  autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'),
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const resultatValidation = schemaCreationClasse.safeParse(req.body);
      if (!resultatValidation.success) {
        throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
      }

      const classe = await creerClasse(resultatValidation.data);
      res.status(201).json({ succes: true, donnees: classe });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/',
  autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'),
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const resultatValidation = schemaFiltresClasse.safeParse(req.query);
      if (!resultatValidation.success) {
        throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Filtres invalides.');
      }

      const classes = await listerClasses(resultatValidation.data);
      res.status(200).json({ succes: true, donnees: classes });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/niveau-suivant',
  autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'),
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const niveauId = extraireChaineUnique(req.query.niveauId, 'niveauId');
      const anneeId = extraireChaineUnique(req.query.anneeId, 'anneeId');
      const options = await obtenirOptionsInscriptionNiveauSuivant(niveauId, anneeId);
      res.status(200).json({ succes: true, donnees: options });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/:id',
  autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'),
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const classe = await obtenirClasseParId(extraireChaineUnique(req.params.id, 'id'));
      res.status(200).json({ succes: true, donnees: classe });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.patch(
  '/:id',
  autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'),
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const resultatValidation = schemaModificationClasse.safeParse(req.body);
      if (!resultatValidation.success) {
        throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
      }

      const classe = await modifierClasse(extraireChaineUnique(req.params.id, 'id'), resultatValidation.data);
      res.status(200).json({ succes: true, donnees: classe });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.patch(
  '/:id/basculer-semestre',
  autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'),
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const classe = await basculerSemestreActif(extraireChaineUnique(req.params.id, 'id'));
      res.status(200).json({ succes: true, donnees: classe });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.delete(
  '/:id',
  autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'),
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      await supprimerClasse(extraireChaineUnique(req.params.id, 'id'));
      res.status(200).json({ succes: true, donnees: null });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/:id/liste-etudiants-pdf',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const classe = await obtenirClasseParId(extraireChaineUnique(req.params.id, 'id'));
      const inscriptionsActives = classe.inscriptions.filter((i: { statutInscription: string }) => i.statutInscription === 'ACTIVE');
      const etudiants = inscriptionsActives.map((i: { etudiant: { matricule: string; nom: string; inn: string | null; dateNaissance: Date | null; typeBac: string | null; numeroBac: string | null } }) => ({
        matricule: i.etudiant.matricule,
        nom: i.etudiant.nom,
        inn: i.etudiant.inn,
        dateNaissance: i.etudiant.dateNaissance,
        typeBac: i.etudiant.typeBac,
        numeroBac: i.etudiant.numeroBac,
      }));

      const doc = genererPdfListeEtudiantsClasse(classe.nom, etudiants);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="liste-etudiants-${classe.nom}.pdf"`);
      doc.pipe(res);
      doc.end();
    } catch (erreur) {
      next(erreur);
    }
  }
);

export default router;
