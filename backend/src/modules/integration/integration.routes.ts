import { Router, Request, Response, NextFunction } from 'express';
import { authentifierParCle } from '../../shared/middlewares/authentifierParCle';
import { extraireChaineUnique } from '../../shared/utils/extraireParametre';
import {
  obtenirInfosTermePourMatricule,
  listerFormationsActives,
  listerEtudiantsParTerme,
  listerAnnees,
} from './integration.service';
import { trouverEtudiantParMatricule } from '../etudiants/etudiants.service';

const router = Router();

/**
 * Route réservée à un logiciel externe de confiance (voir
 * authentifierParCle) — jamais appelée par le navigateur d'un
 * administrateur, qui utilise le jeton de session habituel sur les
 * autres routes du système. Un pur ajout : aucune route existante n'est
 * modifiée, aucune logique métier académique n'est touchée.
 */
router.get(
  '/etudiants/:matricule/annees/:anneeUniversitaire/termes/:terme',
  authentifierParCle,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matricule = extraireChaineUnique(req.params.matricule, 'matricule');
      const anneeUniversitaire = extraireChaineUnique(req.params.anneeUniversitaire, 'anneeUniversitaire');
      const terme = extraireChaineUnique(req.params.terme, 'terme');
      const infos = await obtenirInfosTermePourMatricule(matricule, anneeUniversitaire, terme);
      res.status(200).json({ succes: true, donnees: infos });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/formations',
  authentifierParCle,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const formations = await listerFormationsActives();
      res.status(200).json({ succes: true, donnees: formations });
    } catch (erreur) {
      next(erreur);
    }
  }
);

/**
 * Les années universitaires existantes — pour que le financier propose
 * un vrai choix à l'écran (Caisse, Pas en règle) plutôt qu'un champ
 * texte libre. Protégée par la même clé d'intégration que le reste de
 * ce fichier, jamais une session administrateur.
 */
router.get(
  '/annees',
  authentifierParCle,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const annees = await listerAnnees();
      res.status(200).json({ succes: true, donnees: annees });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/annees/:anneeUniversitaire/termes/:terme/etudiants',
  authentifierParCle,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const anneeUniversitaire = extraireChaineUnique(req.params.anneeUniversitaire, 'anneeUniversitaire');
      const terme = extraireChaineUnique(req.params.terme, 'terme');
      const etudiants = await listerEtudiantsParTerme(anneeUniversitaire, terme);
      res.status(200).json({ succes: true, donnees: etudiants });
    } catch (erreur) {
      next(erreur);
    }
  }
);

/**
 * Retrouve un étudiant par matricule, pour un logiciel externe — jamais
 * la même route que /etudiants/par-matricule/:matricule (celle-là exige
 * une session administrateur, pensée pour le navigateur, jamais une clé
 * d'intégration). Réutilise la même fonction de service, juste exposée
 * sous une protection différente.
 */
router.get(
  '/etudiants/:matricule',
  authentifierParCle,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matricule = extraireChaineUnique(req.params.matricule, 'matricule');
      const etudiant = await trouverEtudiantParMatricule(matricule);
      res.status(200).json({ succes: true, donnees: etudiant });
    } catch (erreur) {
      next(erreur);
    }
  }
);

export default router;
