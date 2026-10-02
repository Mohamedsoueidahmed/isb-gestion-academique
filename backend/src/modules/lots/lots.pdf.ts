import PDFDocument from 'pdfkit';
import path from 'path';

const CHEMIN_LOGO = path.join(__dirname, '../../assets/logo.png');
const LIBELLE_TERME: Record<string, string> = { AUTOMNE: 'Automne', PRINTEMPS: 'Printemps', ETE: 'Été' };

interface EtudiantSurCours {
  matricule: string;
  nom: string;
}

interface CoursAvecEtudiants {
  code: string;
  titre: string;
  ueCode: string;
  etudiants: EtudiantSurCours[];
}

interface GroupeParTerme {
  terme: string | null;
  cours: CoursAvecEtudiants[];
}

function dessinerEnTete(doc: PDFKit.PDFDocument, sousTitre: string) {
  try {
    doc.image(CHEMIN_LOGO, 40, 30, { width: 40 });
  } catch {
    // Le logo est un agrément visuel, jamais bloquant pour l'export.
  }
  doc.fontSize(15).font('Helvetica-Bold').fillColor('#000000').text('ISB International School of Business', 90, 35);
  doc.fontSize(11).font('Helvetica').fillColor('#555555').text(sousTitre, 90, 54);
  doc.fillColor('#000000');
  doc.moveDown(3);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.8);
}

function dessinerTableauEtudiants(doc: PDFKit.PDFDocument, etudiants: EtudiantSurCours[]) {
  const colonnes = [
    { titre: 'Matricule', largeur: 150 },
    { titre: 'Nom', largeur: 300 },
  ];

  function ligneEnTete() {
    let x = 40;
    const positionY = doc.y;
    doc.font('Helvetica-Bold').fontSize(9);
    colonnes.forEach((colonne, i) => {
      const options: PDFKit.Mixins.TextOptions = { width: colonne.largeur };
      if (i < colonnes.length - 1) options.lineBreak = false;
      doc.text(colonne.titre, x, positionY, options);
      x += colonne.largeur;
    });
  }

  ligneEnTete();
  doc.moveDown(1.1);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#eeeeee').stroke();
  doc.moveDown(0.4);

  for (const etudiant of etudiants) {
    if (doc.y > 760) {
      doc.addPage();
      ligneEnTete();
      doc.moveDown(1.1);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#eeeeee').stroke();
      doc.moveDown(0.4);
    }
    let x = 40;
    const positionY = doc.y;
    doc.font('Helvetica').fontSize(9);
    // `lineBreak: false` sur cette première colonne — sinon elle fait
    // elle aussi avancer doc.y à elle seule, et la ligne suivante
    // (nom, sur la même position Y fixée explicitement) l'avance une
    // deuxième fois, avant même le moveDown final : trois avancées
    // pour une seule vraie ligne de tableau.
    doc.text(etudiant.matricule, x, positionY, { width: colonnes[0].largeur, lineBreak: false });
    x += colonnes[0].largeur;
    doc.text(etudiant.nom, x, positionY, { width: colonnes[1].largeur });
    doc.moveDown(0.6);
  }
}

/**
 * La liste des étudiants d'UN SEUL cours désigné, dans une classe —
 * jamais toute la classe : deux étudiants de la même classe peuvent
 * suivre des cours différents (système de lots flexibles), donc ce
 * cours-ci n'a pas forcément les mêmes étudiants qu'un autre cours de
 * la même classe.
 */
export function genererPdfEtudiantsUnCours(
  classeNom: string,
  terme: string | null,
  cours: CoursAvecEtudiants
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  const libelleTerme = terme ? LIBELLE_TERME[terme] ?? terme : 'Sans Terme précisé';
  dessinerEnTete(doc, `${cours.titre} (${cours.code}), UE ${cours.ueCode}, ${libelleTerme}, ${classeNom}`);

  dessinerTableauEtudiants(doc, cours.etudiants);

  doc.moveDown(1);
  doc.fontSize(9).fillColor('#555555').text(`${cours.etudiants.length} étudiant(s) au total.`, 40);

  return doc;
}

/**
 * Tous les cours d'une classe d'un coup, groupés par Terme puis par
 * cours — le même contenu que l'écran "Étudiants par cours", en un
 * seul document, plutôt que de télécharger chaque cours séparément.
 */
export function genererPdfEtudiantsTousCours(classeNom: string, groupes: GroupeParTerme[]): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  dessinerEnTete(doc, `Étudiants par cours, ${classeNom}`);

  let premierGroupe = true;
  for (const groupe of groupes) {
    if (!premierGroupe) doc.moveDown(1);
    premierGroupe = false;

    const libelleTerme = groupe.terme ? LIBELLE_TERME[groupe.terme] ?? groupe.terme : 'Sans Terme précisé';

    if (doc.y > 720) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(12).text(libelleTerme, 40, doc.y);
    doc.moveDown(0.6);

    for (const cours of groupe.cours) {
      if (doc.y > 700) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(10).text(`${cours.titre} (${cours.code}), UE ${cours.ueCode}`, 40, doc.y);
      doc.moveDown(0.4);
      dessinerTableauEtudiants(doc, cours.etudiants);
      doc.moveDown(0.8);
    }
  }

  return doc;
}
