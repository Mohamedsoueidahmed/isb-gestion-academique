import { Router, Response, NextFunction } from 'express';
import { authentifier, autoriser } from '../../shared/middlewares/authentification';
import { schemaLotSouhaits, schemaCreationLot, schemaUnCours } from './lots.validation';
import {
  listerCoursEligibles,
  obtenirEtatParcoursFlexible,
  obtenirStatistiquesDemandeParNiveau,
  exprimerLotSouhaits,
  retirerSouhait,
  listerSouhaitsEtudiant,
  creerEtOuvrirLot,
  fermerLot,
  ajouterCoursAuLot,
  retirerCoursDuLot,
  obtenirHistoriqueLots,
  listerCoursAffectesParTerme,
  listerEtudiantsParCours,  calculerEtatAnnee,
  debloquerPrerequis,
  retirerDeblocage,
} from './lots.service';
import { ErreurDonneesInvalides } from '../../shared/erreurs/ErreurMetier';
import { extraireChaineUnique } from '../../shared/utils/extraireParametre';
import { RequeteAuthentifiee } from '../../types/auth.types';
import { genererPdfEtudiantsUnCours, genererPdfEtudiantsTousCours } from './lots.pdf';
import { obtenirClasseParId } from '../classes/classes.service';

const router = Router();

router.use(authentifier);
router.use(autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'));

router.get(
  '/inscriptions/:inscriptionId/eligibles',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const inscriptionId = extraireChaineUnique(req.params.inscriptionId, 'inscriptionId');
      const cours = await listerCoursEligibles(inscriptionId);
      res.status(200).json({ succes: true, donnees: cours });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/inscriptions/:inscriptionId/etat',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const inscriptionId = extraireChaineUnique(req.params.inscriptionId, 'inscriptionId');
      const etat = await obtenirEtatParcoursFlexible(inscriptionId);
      res.status(200).json({ succes: true, donnees: etat });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/inscriptions/:inscriptionId/etat-annee',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const inscriptionId = extraireChaineUnique(req.params.inscriptionId, 'inscriptionId');
      const etatAnnee = await calculerEtatAnnee(inscriptionId);
      res.status(200).json({ succes: true, donnees: etatAnnee });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/niveaux/:niveauId/statistiques',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const niveauId = extraireChaineUnique(req.params.niveauId, 'niveauId');
      const statistiques = await obtenirStatistiquesDemandeParNiveau(niveauId);
      res.status(200).json({ succes: true, donnees: statistiques });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/classes/:classeId/cours-par-terme',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const classeId = extraireChaineUnique(req.params.classeId, 'classeId');
      const groupes = await listerCoursAffectesParTerme(classeId);
      res.status(200).json({ succes: true, donnees: groupes });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/classes/:classeId/etudiants-par-cours',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const classeId = extraireChaineUnique(req.params.classeId, 'classeId');
      const groupes = await listerEtudiantsParCours(classeId);
      res.status(200).json({ succes: true, donnees: groupes });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/classes/:classeId/etudiants-par-cours/:coursId/pdf',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const classeId = extraireChaineUnique(req.params.classeId, 'classeId');
      const coursId = extraireChaineUnique(req.params.coursId, 'coursId');
      const classe = await obtenirClasseParId(classeId);
      const groupes = await listerEtudiantsParCours(classeId);

      let coursTrouve: { code: string; titre: string; ueCode: string; etudiants: { matricule: string; nom: string }[] } | null = null;
      let termeTrouve: string | null = null;
      for (const groupe of groupes) {
        const c = groupe.cours.find((c) => c.id === coursId);
        if (c) {
          coursTrouve = c;
          termeTrouve = groupe.terme;
          break;
        }
      }
      if (!coursTrouve) {
        throw new ErreurDonneesInvalides('Ce cours ne fait pas partie des cours affectés de cette classe.');
      }

      const doc = genererPdfEtudiantsUnCours(classe.nom, termeTrouve, coursTrouve);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="etudiants-${coursTrouve.code}.pdf"`);
      doc.pipe(res);
      doc.end();
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/classes/:classeId/etudiants-par-cours-pdf',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const classeId = extraireChaineUnique(req.params.classeId, 'classeId');
      const classe = await obtenirClasseParId(classeId);
      const groupes = await listerEtudiantsParCours(classeId);

      const doc = genererPdfEtudiantsTousCours(classe.nom, groupes);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="etudiants-par-cours-${classe.nom}.pdf"`);
      doc.pipe(res);
      doc.end();
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/niveaux/:niveauId/lots',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const niveauId = extraireChaineUnique(req.params.niveauId, 'niveauId');
      const lots = await obtenirHistoriqueLots(niveauId);
      res.status(200).json({ succes: true, donnees: lots });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.post(
  '/niveaux/:niveauId/lots',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const niveauId = extraireChaineUnique(req.params.niveauId, 'niveauId');
      const resultatValidation = schemaCreationLot.safeParse(req.body);
      if (!resultatValidation.success) {
        throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
      }

      const resultat = await creerEtOuvrirLot(
        niveauId,
        resultatValidation.data.coursIds,
        resultatValidation.data.terme
      );
      res.status(201).json({ succes: true, donnees: resultat });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.post(
  '/lots/:lotId/fermer',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const lotId = extraireChaineUnique(req.params.lotId, 'lotId');
      const lot = await fermerLot(lotId);
      res.status(200).json({ succes: true, donnees: lot });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.post(
  '/lots/:lotId/cours',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const lotId = extraireChaineUnique(req.params.lotId, 'lotId');
      const resultatValidation = schemaUnCours.safeParse(req.body);
      if (!resultatValidation.success) {
        throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
      }
      const resultat = await ajouterCoursAuLot(lotId, resultatValidation.data.coursId);
      res.status(201).json({ succes: true, donnees: resultat });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.delete(
  '/lots/:lotId/cours/:coursId',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const lotId = extraireChaineUnique(req.params.lotId, 'lotId');
      const coursId = extraireChaineUnique(req.params.coursId, 'coursId');
      const lot = await retirerCoursDuLot(lotId, coursId);
      res.status(200).json({ succes: true, donnees: lot });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/inscriptions/:inscriptionId/souhaits',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const inscriptionId = extraireChaineUnique(req.params.inscriptionId, 'inscriptionId');
      const souhaits = await listerSouhaitsEtudiant(inscriptionId);
      res.status(200).json({ succes: true, donnees: souhaits });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.post(
  '/inscriptions/:inscriptionId/souhaits',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const inscriptionId = extraireChaineUnique(req.params.inscriptionId, 'inscriptionId');
      const resultatValidation = schemaLotSouhaits.safeParse(req.body);
      if (!resultatValidation.success) {
        throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
      }

      await exprimerLotSouhaits(inscriptionId, resultatValidation.data.coursIds);
      res.status(201).json({ succes: true, donnees: null });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.delete(
  '/inscriptions/:inscriptionId/souhaits/:coursId',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const inscriptionId = extraireChaineUnique(req.params.inscriptionId, 'inscriptionId');
      const coursId = extraireChaineUnique(req.params.coursId, 'coursId');
      await retirerSouhait(inscriptionId, coursId);
      res.status(200).json({ succes: true, donnees: null });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.post(
  '/inscriptions/:inscriptionId/debloquer',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const inscriptionId = extraireChaineUnique(req.params.inscriptionId, 'inscriptionId');
      const resultatValidation = schemaUnCours.safeParse(req.body);
      if (!resultatValidation.success) {
        throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
      }

      const deblocage = await debloquerPrerequis(inscriptionId, resultatValidation.data.coursId);
      res.status(201).json({ succes: true, donnees: deblocage });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.delete(
  '/inscriptions/:inscriptionId/debloquer/:coursId',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const inscriptionId = extraireChaineUnique(req.params.inscriptionId, 'inscriptionId');
      const coursId = extraireChaineUnique(req.params.coursId, 'coursId');
      await retirerDeblocage(inscriptionId, coursId);
      res.status(200).json({ succes: true, donnees: null });
    } catch (erreur) {
      next(erreur);
    }
  }
);

export default router;
