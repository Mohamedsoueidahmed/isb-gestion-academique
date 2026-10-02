import PDFDocument from 'pdfkit';
import path from 'path';

const CHEMIN_LOGO = path.join(__dirname, '../../assets/logo.png');

const LIBELLE_COMPOSANTE: Record<string, string> = {
  DEVOIR_1: 'Devoir 1',
  DEVOIR_2: 'Devoir 2',
  DEVOIR: 'Devoir',
  EXPOSE: 'Exposé',
  EXAMEN_SESSION_1: 'Examen S1',
  EXAMEN_SESSION_2: 'Examen S2',
};

const LIBELLE_STATUT: Record<string, string> = {
  VALIDEE: 'Validée',
  NON_VALIDEE: 'Non validée',
  EN_ATTENTE_SESSION_2: 'En attente S2',
};

const LIBELLE_TERME: Record<string, string> = { AUTOMNE: 'Automne', PRINTEMPS: 'Printemps', ETE: 'Été' };

interface EtudiantPourPdf {
  etudiant: { matricule: string; nom: string };
  composantes: Record<string, number | null>;
  session2Visible: boolean;
  moyenne: { toString(): string } | null;
  statutValidation: string | null;
}

interface CoursPourPdf {
  code: string;
  titre: string;
  cycle: 'LICENCE' | 'MASTER';
  etudiants: EtudiantPourPdf[];
}

/**
 * PDF de l'export d'un Terme, pour Notes — même style que les bulletins
 * (mise en page paysage, palette de couleurs, logo ISB), mais une page par
 * cours plutôt que par étudiant : chaque page liste tous les étudiants
 * réellement affectés à ce cours précis, avec leurs composantes, moyenne
 * et statut.
 */
export function genererPdfNotesTerme(classeNom: string, terme: string | null, cours: CoursPourPdf[]): PDFKit.PDFDocument {
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

    doc.fontSize(16).text(`Relevé de notes du Terme ${libelleTerme}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#555555');
    doc.text(`${coursActuel.titre} (${coursActuel.code})`, { align: 'center' });
    doc.text(`Classe ${classeNom}`, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1);

    const colonnesComposantes = coursActuel.cycle === 'LICENCE'
      ? ['DEVOIR_1', 'DEVOIR_2', 'EXPOSE', 'EXAMEN_SESSION_1']
      : ['DEVOIR', 'EXPOSE', 'EXAMEN_SESSION_1'];
    const aBesoinSession2 = coursActuel.etudiants.some((e) => e.session2Visible);
    const colonnes = aBesoinSession2 ? [...colonnesComposantes, 'EXAMEN_SESSION_2'] : colonnesComposantes;

    const xDebut = 40;
    const largeurEtudiant = 220;
    const largeurComposante = 60;
    const largeurMoyenne = 60;
    const largeurStatut = 100;

    const positionsX: Record<string, number> = { etudiant: xDebut };
    let curseur = xDebut + largeurEtudiant;
    for (const type of colonnes) {
      positionsX[type] = curseur;
      curseur += largeurComposante;
    }
    positionsX.moyenne = curseur;
    curseur += largeurMoyenne;
    positionsX.statut = curseur;
    const largeurTotale = curseur + largeurStatut - xDebut;

    let positionY = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Étudiant', positionsX.etudiant, positionY, { width: largeurEtudiant });
    for (const type of colonnes) {
      doc.text(LIBELLE_COMPOSANTE[type] ?? type, positionsX[type], positionY, {
        width: largeurComposante,
        align: 'center',
      });
    }
    doc.text('Moyenne', positionsX.moyenne, positionY, { width: largeurMoyenne, align: 'center' });
    doc.text('Statut', positionsX.statut, positionY, { width: largeurStatut, align: 'center' });

    doc.moveDown(0.4);
    doc.moveTo(xDebut, doc.y).lineTo(xDebut + largeurTotale, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica');

    coursActuel.etudiants.forEach((etu) => {
      positionY = doc.y;
      doc.fontSize(8);
      doc.text(`${etu.etudiant.matricule} · ${etu.etudiant.nom}`, positionsX.etudiant, positionY, {
        width: largeurEtudiant,
      });

      for (const type of colonnes) {
        const estSession2NonNecessaire = type === 'EXAMEN_SESSION_2' && !etu.session2Visible;
        const valeur = estSession2NonNecessaire ? null : etu.composantes[type];
        doc.text(valeur != null ? String(valeur) : '—', positionsX[type], positionY, {
          width: largeurComposante,
          align: 'center',
        });
      }

      doc.text(etu.moyenne ? etu.moyenne.toString() : '—', positionsX.moyenne, positionY, { width: largeurMoyenne, align: 'center' });
      doc.text(etu.statutValidation ? LIBELLE_STATUT[etu.statutValidation] ?? etu.statutValidation : '—', positionsX.statut, positionY, {
        width: largeurStatut,
        align: 'center',
      });

      doc.moveDown(0.6);
    });

    doc.fontSize(7).fillColor('#888888');
    doc.text(`${coursActuel.etudiants.length} étudiant${coursActuel.etudiants.length > 1 ? 's' : ''}`, xDebut, doc.y + 6);
    doc.fillColor('#000000');
  });

  return doc;
}

interface EtudiantRattrapagePourPdf {
  etudiant: { matricule: string; nom: string };
  parcours: string;
  niveau: string;
  classe: string;
  coursCode: string;
  coursTitre: string;
  moyenneSession1: { toString(): string } | null;
}

const MARGE_BAS_PAGE = 60;

/**
 * PDF de la liste de rattrapage — toutes classes confondues, groupée par
 * Parcours puis Niveau puis Classe puis Cours, dans cet ordre, exactement
 * comme l'écran. Gère elle-même le saut de page (contrairement aux
 * exports par Terme, une liste de rattrapage peut être longue et
 * imprévisible en taille) : chaque section vérifie l'espace restant
 * avant de s'imprimer, plutôt que de laisser PDFKit couper une ligne au
 * milieu.
 */
export function genererPdfRattrapage(anneeLibelle: string, etudiants: EtudiantRattrapagePourPdf[]): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });

  function dessinerEntete() {
    try {
      doc.image(CHEMIN_LOGO, 40, 30, { width: 44 });
    } catch {
      // Le logo est un agrément visuel, jamais bloquant pour l'export.
    }
    doc.fontSize(14).text('ISB International School of Business', 95, 36, { align: 'left' });
    doc.moveDown(1.6);
    doc.fontSize(16).text(`Liste de rattrapage de l'année ${anneeLibelle}`, { align: 'center' });
    doc.moveDown(1);
  }

  function sauterSiNecessaire(hauteurNecessaire: number) {
    if (doc.y + hauteurNecessaire > doc.page.height - MARGE_BAS_PAGE) {
      doc.addPage();
      dessinerEntete();
    }
  }

  dessinerEntete();

  if (etudiants.length === 0) {
    doc.fontSize(11).fillColor('#888888').text('Aucun étudiant en attente de Session 2.', { align: 'center' });
    return doc;
  }

  let parcoursActuel: string | null = null;
  let niveauActuel: string | null = null;
  let classeActuelle: string | null = null;
  let coursActuel: string | null = null;

  for (const etu of etudiants) {
    const cleCours = `${etu.coursCode}-${etu.coursTitre}`;

    if (etu.parcours !== parcoursActuel || etu.niveau !== niveauActuel || etu.classe !== classeActuelle) {
      sauterSiNecessaire(40);
      parcoursActuel = etu.parcours;
      niveauActuel = etu.niveau;
      classeActuelle = etu.classe;
      coursActuel = null;

      doc.moveDown(0.6);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1C2B39');
      doc.text(`${etu.parcours} · ${etu.niveau} · ${etu.classe}`);
      doc.fillColor('#000000').font('Helvetica');
      doc.moveDown(0.3);
    }

    if (cleCours !== coursActuel) {
      sauterSiNecessaire(24);
      coursActuel = cleCours;

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`${etu.coursTitre} (${etu.coursCode})`, { indent: 15 });
      doc.font('Helvetica');
    }

    sauterSiNecessaire(16);
    doc.fontSize(9);
    doc.text(
      `${etu.etudiant.matricule} · ${etu.etudiant.nom} (Moyenne S1 : ${etu.moyenneSession1 ? etu.moyenneSession1.toString() : 'N/A'})`,
      { indent: 30 }
    );
  }

  return doc;
}
