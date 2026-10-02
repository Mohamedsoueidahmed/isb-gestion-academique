import { Router, Response, NextFunction } from 'express';
import { authentifier, autoriser } from '../../shared/middlewares/authentification';
import { schemaSaisieComposante } from './notes.validation';
import {
  saisirComposante,
  obtenirComposantesInscriptionCours,
  obtenirNotesCoursPourClasse,
  obtenirNotesInscription,
  obtenirEtudiantsRattrapage,
  obtenirPassageAnnee,
  genererDonneesNotesTerme,
  genererDonneesRattrapage,
} from './notes.service';
import { genererPdfNotesTerme, genererPdfRattrapage } from './notes.pdf';
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

    const resultatValidation = schemaSaisieComposante.safeParse(req.body);
    if (!resultatValidation.success) {
      throw new ErreurDonneesInvalides(resultatValidation.error.issues[0]?.message ?? 'Données invalides.');
    }

    const resultat = await saisirComposante(resultatValidation.data, req.utilisateur.utilisateurId);
    res.status(200).json({ succes: true, donnees: resultat });
  } catch (erreur) {
    next(erreur);
  }
});

router.get(
  '/classes/:classeId/cours/:coursId',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const notes = await obtenirNotesCoursPourClasse(
        extraireChaineUnique(req.params.classeId, 'classeId'),
        extraireChaineUnique(req.params.coursId, 'coursId')
      );
      res.status(200).json({ succes: true, donnees: notes });
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
      const { classeNom, cours } = await genererDonneesNotesTerme(classeId, terme);
      const doc = genererPdfNotesTerme(classeNom, terme, cours);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="notes-${terme ?? 'sans-terme'}.pdf"`);
      doc.pipe(res);
      doc.end();
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/inscriptions/:inscriptionId/cours/:coursId',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const composantes = await obtenirComposantesInscriptionCours(
        extraireChaineUnique(req.params.inscriptionId, 'inscriptionId'),
        extraireChaineUnique(req.params.coursId, 'coursId')
      );
      res.status(200).json({ succes: true, donnees: composantes });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get(
  '/inscriptions/:inscriptionId',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const notes = await obtenirNotesInscription(extraireChaineUnique(req.params.inscriptionId, 'inscriptionId'));
      res.status(200).json({ succes: true, donnees: notes });
    } catch (erreur) {
      next(erreur);
    }
  }
);

router.get('/rattrapage', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const anneeUniversitaireId = typeof req.query.anneeUniversitaireId === 'string' ? req.query.anneeUniversitaireId : undefined;
    const etudiants = await obtenirEtudiantsRattrapage(anneeUniversitaireId);
    res.status(200).json({ succes: true, donnees: etudiants });
  } catch (erreur) {
    next(erreur);
  }
});

router.get('/rattrapage/export-pdf', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const anneeUniversitaireId = typeof req.query.anneeUniversitaireId === 'string' ? req.query.anneeUniversitaireId : undefined;
    const { anneeLibelle, etudiants } = await genererDonneesRattrapage(anneeUniversitaireId);
    const doc = genererPdfRattrapage(anneeLibelle, etudiants);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rattrapage.pdf"');
    doc.pipe(res);
    doc.end();
  } catch (erreur) {
    next(erreur);
  }
});

router.get('/passage-annee', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const etudiantId = extraireChaineUnique(req.query.etudiantId, 'etudiantId');
    const anneeUniversitaireId = extraireChaineUnique(req.query.anneeUniversitaireId, 'anneeUniversitaireId');
    const niveauId = extraireChaineUnique(req.query.niveauId, 'niveauId');

    const resultat = await obtenirPassageAnnee(etudiantId, anneeUniversitaireId, niveauId);
    res.status(200).json({ succes: true, donnees: resultat });
  } catch (erreur) {
    next(erreur);
  }
});

export default router;
