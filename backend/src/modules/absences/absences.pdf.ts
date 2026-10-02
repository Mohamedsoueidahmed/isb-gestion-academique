import PDFDocument from 'pdfkit';
import path from 'path';

const CHEMIN_LOGO = path.join(__dirname, '../../assets/logo.png');

const LIBELLE_TERME: Record<string, string> = { AUTOMNE: 'Automne', PRINTEMPS: 'Printemps', ETE: 'Été' };

interface SeancePourPdf {
  dateSeance: string;
  totalInscrits: number;
  absents: { matricule: string; nom: string }[];
}

interface CoursPourPdf {
  code: string;
  titre: string;
  seances: SeancePourPdf[];
}

/**
 * PDF de l'export d'un Terme, pour Absences — même style que les
 * bulletins et l'export de notes (logo ISB, mise en page paysage), une
 * page par cours réellement affecté, listant chaque séance déjà
 * enregistrée avec ses absents.
 */
export function genererPdfAbsencesTerme(classeNom: string, terme: string | null, cours: CoursPourPdf[]): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
  const libelleTerme = terme ? LIBELLE_TERME[terme] ?? terme : 'Non précisé';

  cours.forEach((coursActuel, index) => {
    if (index > 0) {
      doc.addPage();
    }

    try {
      doc.image(CHEMIN_LOGO, 40, 30, { width: 44 });
    } catch {
      // Le logo est un agrément visuel, jamais bloquant pour l'export —
      // s'il est introuvable, le PDF continue sans lui plutôt que d'échouer.
    }

    doc.fontSize(14).text('ISB International School of Business', 95, 36, { align: 'left' });
    doc.moveDown(1.6);

    doc.fontSize(16).text(`Relevé d'absences du Terme ${libelleTerme}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#555555');
    doc.text(`${coursActuel.titre} (${coursActuel.code})`, { align: 'center' });
    doc.text(`Classe ${classeNom}`, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1);

    const xDebut = 40;
    const largeurDate = 90;
    const largeurTotal = 90;
    const largeurAbsents = 500;

    let positionY = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Date de séance', xDebut, positionY, { width: largeurDate });
    doc.text('Total inscrits', xDebut + largeurDate, positionY, { width: largeurTotal, align: 'center' });
    doc.text('Absents', xDebut + largeurDate + largeurTotal, positionY, { width: largeurAbsents });

    doc.moveDown(0.4);
    doc.moveTo(xDebut, doc.y).lineTo(xDebut + largeurDate + largeurTotal + largeurAbsents, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica');

    if (coursActuel.seances.length === 0) {
      doc.fontSize(9).fillColor('#888888').text('Aucune séance enregistrée pour ce cours.', xDebut, doc.y);
      doc.fillColor('#000000');
    }

    coursActuel.seances.forEach((seance) => {
      positionY = doc.y;
      const listeAbsents = seance.absents.length === 0
        ? 'Tout le monde présent'
        : seance.absents.map((a) => `${a.matricule} · ${a.nom}`).join(', ');

      doc.fontSize(8);
      doc.text(seance.dateSeance, xDebut, positionY, { width: largeurDate });
      doc.text(String(seance.totalInscrits), xDebut + largeurDate, positionY, { width: largeurTotal, align: 'center' });
      doc.text(listeAbsents, xDebut + largeurDate + largeurTotal, positionY, { width: largeurAbsents });

      doc.moveDown(0.6);
    });

    doc.fontSize(7).fillColor('#888888');
    doc.text(`${coursActuel.seances.length} séance${coursActuel.seances.length > 1 ? 's' : ''} enregistrée${coursActuel.seances.length > 1 ? 's' : ''}`, xDebut, doc.y + 6);
    doc.fillColor('#000000');
  });

  return doc;
}
