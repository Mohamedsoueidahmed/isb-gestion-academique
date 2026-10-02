import PDFDocument from 'pdfkit';
import path from 'path';
import { genererBulletinIndividuel } from './bulletins.service';

type BulletinIndividuel = Awaited<ReturnType<typeof genererBulletinIndividuel>>;

const CHEMIN_LOGO = path.join(__dirname, '../../assets/logo.png');

const LABELS_COMPOSANTES: Record<string, string> = {
  DEVOIR_1: 'Devoir 1',
  DEVOIR_2: 'Devoir 2',
  EXPOSE: 'Exposé',
  EXAMEN_SESSION_1: 'Examen S1',
  EXAMEN_SESSION_2: 'Examen S2',
  DEVOIR: 'Devoir',
};

const LABELS_STATUT: Record<string, string> = {
  VALIDEE: 'Validée',
  NON_VALIDEE: 'Non validée',
  EN_ATTENTE_SESSION_2: 'En attente S2',
};

/**
 * Le bulletin PROPRE d'un étudiant pour un niveau donné — jamais le
 * programme théorique complet, seulement ce que CET étudiant a
 * réellement (composé ou dispensé). Deux sections toujours séparées,
 * jamais mélangées dans un seul tableau : une matière composée a un
 * vrai détail de composantes (Devoir 1, Exposé...) à montrer, une
 * matière dispensée n'en a aucun — les fondre ensemble ferait
 * disparaître ce détail ou l'inventerait à tort pour l'autre cas.
 */
export function genererBulletinIndividuelPdf(bulletin: BulletinIndividuel): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  try {
    doc.image(CHEMIN_LOGO, 40, 30, { width: 40 });
  } catch {
    // Le logo est un agrément visuel, jamais bloquant pour l'export.
  }

  doc.fontSize(15).font('Helvetica-Bold').fillColor('#000000').text('ISB International School of Business', 90, 35);
  doc.fontSize(11).font('Helvetica').fillColor('#555555').text('Bulletin individuel', 90, 54);
  doc.fillColor('#000000');
  doc.moveDown(3);

  doc.fontSize(10).fillColor('#555555');
  doc.text(`${bulletin.formation}, ${bulletin.parcours} (${bulletin.niveau})`);
  doc.text(`Année universitaire ${bulletin.anneeUniversitaire}`);
  doc.fillColor('#000000');
  doc.moveDown(0.8);

  doc.fontSize(12).font('Helvetica-Bold').text(`Étudiant : ${bulletin.etudiant.nom}`);
  doc.fontSize(10).font('Helvetica').fillColor('#555555').text(`Matricule : ${bulletin.etudiant.matricule}`);
  doc.fillColor('#000000');
  doc.moveDown(1);

  const colonnesComposantes =
    bulletin.cycle === 'LICENCE' ? ['DEVOIR_1', 'DEVOIR_2', 'EXPOSE', 'EXAMEN_SESSION_1'] : ['DEVOIR', 'EXPOSE', 'EXAMEN_SESSION_1'];
  const aBesoinSession2 = bulletin.matieresComposees.some((m) => m.composantes.EXAMEN_SESSION_2 != null);
  const colonnes = aBesoinSession2 ? [...colonnesComposantes, 'EXAMEN_SESSION_2'] : colonnesComposantes;

  // --- Section 1 : Matières composées ---
  doc.fontSize(12).font('Helvetica-Bold').text('Matières composées');
  doc.moveDown(0.4);

  if (bulletin.matieresComposees.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor('#555555').text('Aucune matière composée pour ce niveau.');
    doc.fillColor('#000000');
    doc.moveDown(1);
  } else {
    const xDebut = 40;
    const largeurCours = 190;
    const largeurComposante = 52;
    const largeurMoyenne = 55;
    const largeurStatut = 75;

    const positionsX: Record<string, number> = { cours: xDebut };
    let curseur = xDebut + largeurCours;
    for (const type of colonnes) {
      positionsX[type] = curseur;
      curseur += largeurComposante;
    }
    positionsX.moyenne = curseur;
    curseur += largeurMoyenne;
    positionsX.statut = curseur;

    let positionY = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Cours', positionsX.cours, positionY, { width: largeurCours });
    for (const type of colonnes) {
      doc.text(LABELS_COMPOSANTES[type], positionsX[type], positionY, { width: largeurComposante, align: 'center' });
    }
    doc.text('Moyenne', positionsX.moyenne, positionY, { width: largeurMoyenne, align: 'center' });
    doc.text('Statut', positionsX.statut, positionY, { width: largeurStatut, align: 'center' });

    doc.moveDown(0.5);
    doc.moveTo(xDebut, doc.y).lineTo(positionsX.statut + largeurStatut, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.4);

    doc.font('Helvetica');
    for (const m of bulletin.matieresComposees) {
      positionY = doc.y;
      doc.fontSize(8);
      doc.text(`${m.coursTitre} (${m.coursCode})`, positionsX.cours, positionY, { width: largeurCours });
      for (const type of colonnes) {
        const valeur = m.composantes[type];
        doc.text(valeur != null ? String(valeur) : '—', positionsX[type], positionY, {
          width: largeurComposante,
          align: 'center',
        });
      }
      doc.text(m.moyenne ?? '—', positionsX.moyenne, positionY, { width: largeurMoyenne, align: 'center' });
      doc.text(
        m.statutValidation ? LABELS_STATUT[m.statutValidation] : '—',
        positionsX.statut,
        positionY,
        { width: largeurStatut, align: 'center' }
      );
      doc.moveDown(0.8);
    }
  }

  doc.moveDown(1);

  // --- Section 2 : Matières dispensées ---
  doc.fontSize(12).font('Helvetica-Bold').text('Matières dispensées');
  doc.moveDown(0.4);

  if (bulletin.matieresDispensees.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor('#555555').text('Aucune matière dispensée pour ce niveau.');
    doc.fillColor('#000000');
  } else {
    const xDebut = 40;
    const largeurCours = 220;
    const largeurUniversite = 200;
    const largeurStatut = 90;

    let positionY = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Cours', xDebut, positionY, { width: largeurCours });
    doc.text("Université d'origine", xDebut + largeurCours, positionY, { width: largeurUniversite });
    doc.text('Statut', xDebut + largeurCours + largeurUniversite, positionY, { width: largeurStatut, align: 'center' });

    doc.moveDown(0.5);
    doc
      .moveTo(xDebut, doc.y)
      .lineTo(xDebut + largeurCours + largeurUniversite + largeurStatut, doc.y)
      .strokeColor('#cccccc')
      .stroke();
    doc.moveDown(0.4);

    doc.font('Helvetica');
    for (const m of bulletin.matieresDispensees) {
      positionY = doc.y;
      doc.fontSize(8);
      doc.text(`${m.coursTitre} (${m.coursCode})`, xDebut, positionY, { width: largeurCours });
      doc.text(m.universiteOrigine ?? '—', xDebut + largeurCours, positionY, { width: largeurUniversite });
      doc.text(
        m.statutValidation ? LABELS_STATUT[m.statutValidation] : '—',
        xDebut + largeurCours + largeurUniversite,
        positionY,
        { width: largeurStatut, align: 'center' }
      );
      doc.moveDown(0.8);
    }
  }

  doc.moveDown(1.5);
  doc.fontSize(7).fillColor('#888888');
  doc.text(
    "Ce document liste les matières où cet étudiant a un résultat pour ce niveau précis, jamais le programme complet du niveau. Aucune moyenne générale ni décision de passage n'est calculée ici.",
    40,
    doc.y,
    { width: 500 }
  );
  doc.fillColor('#000000');

  return doc;
}
