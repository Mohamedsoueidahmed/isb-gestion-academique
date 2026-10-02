import { Router, Response, NextFunction } from 'express';
import { authentifier, autoriser } from '../../shared/middlewares/authentification';
import { genererBulletinClasse, genererBulletinIndividuel } from './bulletins.service';
import { genererBulletinPdf } from './bulletins.pdf';
import { genererBulletinIndividuelPdf } from './bulletins-individuel.pdf';
import { ErreurNonTrouve } from '../../shared/erreurs/ErreurMetier';
import { extraireChaineUnique } from '../../shared/utils/extraireParametre';
import { RequeteAuthentifiee } from '../../types/auth.types';

const router = Router();

router.use(authentifier);
router.use(autoriser('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE'));

router.get('/classes/:classeId', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const bulletin = await genererBulletinClasse(extraireChaineUnique(req.params.classeId, 'classeId'));
    res.status(200).json({ succes: true, donnees: bulletin });
  } catch (erreur) {
    next(erreur);
  }
});

/**
 * PDF de la classe entière par défaut. Si ?matricule=X est fourni, le
 * tableau des bulletins est réduit à ce seul étudiant AVANT de passer au
 * générateur PDF — celui-ci ne sait faire qu'une chose (une page par
 * entrée du tableau qu'on lui donne), donc filtrer en amont évite de le
 * modifier lui-même, déjà vérifié visuellement plus tôt.
 */
router.get('/classes/:classeId/pdf', async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
  try {
    const bulletin = await genererBulletinClasse(extraireChaineUnique(req.params.classeId, 'classeId'));

    const matricule = typeof req.query.matricule === 'string' ? req.query.matricule : undefined;
    const bulletinAGenerer = matricule
      ? {
          ...bulletin,
          bulletins: bulletin.bulletins.filter(
            (b: (typeof bulletin.bulletins)[number]) => b.etudiant.matricule === matricule
          ),
        }
      : bulletin;

    if (matricule && bulletinAGenerer.bulletins.length === 0) {
      throw new ErreurNonTrouve('Étudiant (matricule introuvable dans cette classe)');
    }

    const doc = genererBulletinPdf(bulletinAGenerer);

    const nomFichier = matricule ? `bulletin-${matricule}.pdf` : `bulletin-${bulletin.classe.nom}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);

    doc.pipe(res);
    doc.end();
  } catch (erreur) {
    next(erreur);
  }
});

router.get(
  '/inscriptions/:inscriptionId/niveaux/:niveauId/individuel-pdf',
  async (req: RequeteAuthentifiee, res: Response, next: NextFunction) => {
    try {
      const inscriptionId = extraireChaineUnique(req.params.inscriptionId, 'inscriptionId');
      const niveauId = extraireChaineUnique(req.params.niveauId, 'niveauId');
      const bulletin = await genererBulletinIndividuel(inscriptionId, niveauId);
      const doc = genererBulletinIndividuelPdf(bulletin);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="bulletin-individuel-${bulletin.etudiant.matricule}-${bulletin.niveau}.pdf"`
      );
      doc.pipe(res);
      doc.end();
    } catch (erreur) {
      next(erreur);
    }
  }
);

export default router;
