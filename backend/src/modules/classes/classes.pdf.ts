import PDFDocument from 'pdfkit';
import path from 'path';

const CHEMIN_LOGO = path.join(__dirname, '../../assets/logo.png');

interface EtudiantPourListe {
  matricule: string;
  nom: string;
  inn: string | null;
  dateNaissance: Date | null;
  typeBac: string | null;
  numeroBac: string | null;
}

/**
 * La liste des étudiants d'une classe, avec les informations prises
 * pendant l'inscription (INN, date de naissance, type et numéro de
 * Bac) — jamais les notes ni rien de pédagogique, uniquement ce qui a
 * été saisi à l'écran "Inscrire un étudiant". Une ligne par étudiant,
 * dans l'ordre où ils apparaissent déjà à l'écran.
 */
export function genererPdfListeEtudiantsClasse(classeNom: string, etudiants: EtudiantPourListe[]): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  try {
    doc.image(CHEMIN_LOGO, 40, 30, { width: 40 });
  } catch {
    // Le logo est un agrément visuel, jamais bloquant pour l'export.
  }

  doc.fontSize(15).font('Helvetica-Bold').text('ISB International School of Business', 90, 35);
  doc.fontSize(11).font('Helvetica').fillColor('#555555').text(`Liste des étudiants, ${classeNom}`, 90, 54);
  doc.fillColor('#000000');

  doc.moveDown(3);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.8);

  const colonnes = [
    { titre: 'Matricule', largeur: 75 },
    { titre: 'Nom', largeur: 130 },
    { titre: 'INN', largeur: 75 },
    { titre: 'Date de naissance', largeur: 90 },
    { titre: 'Type de Bac', largeur: 90 },
    { titre: 'Numéro de Bac', largeur: 55 },
  ];

  function ligneEnTete(y: number) {
    let x = 40;
    doc.font('Helvetica-Bold').fontSize(9);
    for (const colonne of colonnes) {
      doc.text(colonne.titre, x, y, { width: colonne.largeur });
      x += colonne.largeur;
    }
  }

  function ligneEtudiant(etudiant: EtudiantPourListe, y: number) {
    let x = 40;
    doc.font('Helvetica').fontSize(9);
    const valeurs = [
      etudiant.matricule,
      etudiant.nom,
      etudiant.inn ?? '—',
      etudiant.dateNaissance ? etudiant.dateNaissance.toLocaleDateString('fr-FR') : '—',
      etudiant.typeBac ?? '—',
      etudiant.numeroBac ?? '—',
    ];
    for (let i = 0; i < colonnes.length; i++) {
      doc.text(valeurs[i], x, y, { width: colonnes[i].largeur });
      x += colonnes[i].largeur;
    }
  }

  ligneEnTete(doc.y);
  doc.moveDown(1.2);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.5);

  for (const etudiant of etudiants) {
    if (doc.y > 760) {
      doc.addPage();
      ligneEnTete(doc.y);
      doc.moveDown(1.2);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#cccccc').stroke();
      doc.moveDown(0.5);
    }
    ligneEtudiant(etudiant, doc.y);
    doc.moveDown(1.1);
  }

  doc.moveDown(1);
  doc.fontSize(9).fillColor('#555555').text(`${etudiants.length} étudiant(s) au total.`, 40);

  return doc;
}
