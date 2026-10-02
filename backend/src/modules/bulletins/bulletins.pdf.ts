import PDFDocument from 'pdfkit';
import { genererBulletinClasse } from './bulletins.service';

type BulletinClasse = Awaited<ReturnType<typeof genererBulletinClasse>>;
type GroupeUE = BulletinClasse['bulletins'][number]['ue'][number];
type LigneCours = GroupeUE['cours'][number];

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

const LABELS_STATUT_UE: Record<string, string> = {
  VALIDEE: 'Validée',
  NON_VALIDEE: 'Non validée',
};

const LABELS_STATUT_SEMESTRE: Record<string, string> = {
  VALIDE: 'Semestre validé',
  NON_VALIDE: 'Semestre non validé',
};

const LABELS_STATUT_PASSAGE: Record<string, string> = {
  PASSAGE_ACCORDE: 'Passage accordé',
  PASSAGE_NON_ACCORDE: 'Passage non accordé',
};

// Couleurs de bande selon le statut — neutre tant que non calculable,
// vert/rouge une fois le statut réellement déterminé.
const COULEURS_UE = {
  NEUTRE: { fond: '#F4F3EF', texte: '#1C2B39' },
  VALIDEE: { fond: '#EAF3EC', texte: '#2E6B45' },
  NON_VALIDEE: { fond: '#FBEAE7', texte: '#B0392A' },
};

function couleursPourStatutUE(statut: string | null): { fond: string; texte: string } {
  if (statut === 'VALIDEE') return COULEURS_UE.VALIDEE;
  if (statut === 'NON_VALIDEE') return COULEURS_UE.NON_VALIDEE;
  return COULEURS_UE.NEUTRE;
}

/**
 * Transforme les données déjà calculées par genererBulletinClasse (JSON) en
 * document PDF — même source de vérité, seulement une présentation
 * différente. Un bulletin par étudiant, une nouvelle page par étudiant, les
 * matières regroupées visuellement par UE. Chaque bande d'UE est colorée
 * selon son statut (vert = validée, rouge = non validée, neutre = pas
 * encore calculable), pour une lecture immédiate.
 *
 * Format paysage : le nombre de colonnes (composantes détaillées + moyenne +
 * statut + absences) ne tient pas confortablement en portrait.
 *
 * La validation d'UE inclut la règle directe et la compensation ; la
 * validation de semestre inclut le seuil de moyenne et le plancher de 9,0
 * par UE. Volontairement absent : le passage d'année (L1→L2), qui reste
 * hors périmètre.
 */
export function genererBulletinPdf(bulletinClasse: BulletinClasse): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
  const { classe, cycle, bulletins } = bulletinClasse;

  const colonnesComposantesBase = cycle === 'LICENCE'
    ? ['DEVOIR_1', 'DEVOIR_2', 'EXPOSE', 'EXAMEN_SESSION_1']
    : ['DEVOIR', 'EXPOSE', 'EXAMEN_SESSION_1'];

  bulletins.forEach((bulletin: (typeof bulletins)[number], index: number) => {
    if (index > 0) {
      doc.addPage();
    }

    // Cette page a-t-elle besoin de la colonne Session 2 ? Vérifié sur
    // l'ensemble des UE de cet étudiant, pas globalement pour la classe.
    const toutesLesLignes = bulletin.ue.flatMap((groupe: GroupeUE) => groupe.cours);
    const aBesoinSession2 = toutesLesLignes.some(
      (ligne: LigneCours) => ligne.composantes.EXAMEN_SESSION_2 != null
    );
    const colonnes = aBesoinSession2 ? [...colonnesComposantesBase, 'EXAMEN_SESSION_2'] : colonnesComposantesBase;

    doc.fontSize(16).text('Bulletin de notes', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#555555');
    doc.text(`${classe.parcours} (${classe.niveau}, ${classe.semestreActif})`, { align: 'center' });
    doc.text(`Classe ${classe.nom}, année universitaire ${classe.anneeUniversitaire}`, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(1.2);

    doc.fontSize(12).text(`Étudiant : ${bulletin.etudiant.nom}`);
    doc.fontSize(10).fillColor('#555555').text(`Matricule : ${bulletin.etudiant.matricule}`);
    doc.fillColor('#000000');
    doc.moveDown(0.8);

    // --- Positions des colonnes, calculées une fois pour cette page ---
    const xDebut = 40;
    const largeurCours = 190;
    const largeurComposante = 52;
    const largeurMoyenne = 55;
    const largeurStatut = 75;
    const largeurAbsences = 55;

    const positionsX: Record<string, number> = { cours: xDebut };
    let curseur = xDebut + largeurCours;
    for (const type of colonnes) {
      positionsX[type] = curseur;
      curseur += largeurComposante;
    }
    positionsX.moyenne = curseur;
    curseur += largeurMoyenne;
    positionsX.statut = curseur;
    curseur += largeurStatut;
    positionsX.absences = curseur;
    const largeurTotale = curseur + largeurAbsences - xDebut;

    let positionY = doc.y;
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Cours', positionsX.cours, positionY, { width: largeurCours });
    for (const type of colonnes) {
      doc.text(LABELS_COMPOSANTES[type], positionsX[type], positionY, { width: largeurComposante, align: 'center' });
    }
    doc.text('Moyenne', positionsX.moyenne, positionY, { width: largeurMoyenne, align: 'center' });
    doc.text('Statut', positionsX.statut, positionY, { width: largeurStatut, align: 'center' });
    doc.text('Absences', positionsX.absences, positionY, { width: largeurAbsences, align: 'center' });

    doc.moveDown(0.4);
    doc.moveTo(xDebut, doc.y).lineTo(xDebut + largeurTotale, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica');
    bulletin.ue.forEach((groupe: GroupeUE) => {
      // En-tête de groupe UE — bande colorée selon le statut, avec le
      // code/crédits à gauche et la moyenne/statut de l'UE à droite.
      const couleurs = couleursPourStatutUE(groupe.statutUE);
      positionY = doc.y;
      doc
        .rect(xDebut, positionY - 2, largeurTotale, 14)
        .fillColor(couleurs.fond)
        .fill();
      doc.fillColor(couleurs.texte).fontSize(8).font('Helvetica-Bold');
      doc.text(`${groupe.ueCode} (${groupe.ueCredits} crédits)`, xDebut + 4, positionY, {
        width: largeurCours + 100,
      });

      const texteMoyenneUE = groupe.moyenneUE != null ? `Moyenne UE : ${groupe.moyenneUE}` : 'Moyenne UE : —';
      const texteStatutUE = groupe.statutUE ? LABELS_STATUT_UE[groupe.statutUE] : '—';
      doc.text(texteMoyenneUE, positionsX.moyenne - 60, positionY, { width: 110, align: 'right' });
      doc.text(texteStatutUE, positionsX.statut, positionY, { width: largeurStatut, align: 'center' });

      doc.fillColor('#000000').font('Helvetica');
      doc.moveDown(0.7);

      groupe.cours.forEach((ligne: LigneCours) => {
        positionY = doc.y;

        doc.fontSize(8);
        doc.text(`${ligne.coursTitre} (${ligne.coursCode})`, positionsX.cours + 8, positionY, {
          width: largeurCours - 8,
        });

        if (ligne.dispense) {
          doc.fontSize(8).fillColor('#555555');
          doc.text(
            `Dispensé(e), ${ligne.universiteOrigine ?? 'université non précisée'}`,
            positionsX[colonnes[0]],
            positionY,
            { width: positionsX.statut - positionsX[colonnes[0]], align: 'center' }
          );
          doc.fillColor('#000000');
        } else {
          for (const type of colonnes) {
            const valeur = ligne.composantes[type];
            doc.text(valeur != null ? String(valeur) : '—', positionsX[type], positionY, {
              width: largeurComposante,
              align: 'center',
            });
          }

          doc.text(ligne.moyenne != null ? String(ligne.moyenne) : '—', positionsX.moyenne, positionY, {
            width: largeurMoyenne,
            align: 'center',
          });
        }
        doc.text(
          ligne.statutValidation ? LABELS_STATUT[ligne.statutValidation] : '—',
          positionsX.statut,
          positionY,
          { width: largeurStatut, align: 'center' }
        );
        doc.text(String(ligne.nombreAbsences), positionsX.absences, positionY, {
          width: largeurAbsences,
          align: 'center',
        });

        doc.moveDown(0.7);
      });
    });

    // --- Moyenne et statut de semestre, mis en évidence et colorés ---
    const couleursSemestre =
      bulletin.statutSemestre === 'VALIDE'
        ? COULEURS_UE.VALIDEE
        : bulletin.statutSemestre === 'NON_VALIDE'
        ? COULEURS_UE.NON_VALIDEE
        : COULEURS_UE.NEUTRE;

    doc.moveDown(0.5);
    positionY = doc.y;
    doc.rect(xDebut, positionY - 2, largeurTotale, 20).fillColor(couleursSemestre.fond).fill();
    doc.fillColor(couleursSemestre.texte).fontSize(10).font('Helvetica-Bold');
    const texteMoyenneSemestre =
      bulletin.moyenneSemestre != null
        ? `Moyenne du semestre : ${bulletin.moyenneSemestre} / 20`
        : 'Moyenne du semestre : non calculable (une ou plusieurs UE incomplètes)';
    const texteStatutSemestre = bulletin.statutSemestre ? LABELS_STATUT_SEMESTRE[bulletin.statutSemestre] : '';
    doc.text(
      texteStatutSemestre ? `${texteMoyenneSemestre}    ${texteStatutSemestre}` : texteMoyenneSemestre,
      xDebut + 6,
      positionY + 2,
      { width: largeurTotale - 12 }
    );
    doc.fillColor('#000000').font('Helvetica');
    doc.moveDown(1.2);

    // --- Moyenne annuelle et décision de passage, uniquement sur le
    // bulletin du dernier semestre (S2) — absent tant que l'année n'est
    // pas terminée, une moyenne annuelle n'aurait alors pas de sens.
    if (bulletin.moyenneAnnuelle != null || bulletin.statutPassage != null) {
      const couleursAnnuelle =
        bulletin.statutPassage === 'PASSAGE_ACCORDE'
          ? COULEURS_UE.VALIDEE
          : bulletin.statutPassage === 'PASSAGE_NON_ACCORDE'
          ? COULEURS_UE.NON_VALIDEE
          : COULEURS_UE.NEUTRE;

      positionY = doc.y;
      doc.rect(xDebut, positionY - 2, largeurTotale, 20).fillColor(couleursAnnuelle.fond).fill();
      doc.fillColor(couleursAnnuelle.texte).fontSize(10).font('Helvetica-Bold');
      const texteMoyenneAnnuelle =
        bulletin.moyenneAnnuelle != null
          ? `Moyenne annuelle : ${bulletin.moyenneAnnuelle} / 20`
          : 'Moyenne annuelle : non calculable';
      const texteStatutPassage = bulletin.statutPassage
        ? bulletinClasse.estFinDeCycle
          ? bulletin.statutPassage === 'PASSAGE_ACCORDE'
            ? 'Année validée'
            : 'Année non validée'
          : LABELS_STATUT_PASSAGE[bulletin.statutPassage]
        : '';
      doc.text(
        texteStatutPassage ? `${texteMoyenneAnnuelle}    ${texteStatutPassage}` : texteMoyenneAnnuelle,
        xDebut + 6,
        positionY + 2,
        { width: largeurTotale - 12 }
      );
      doc.fillColor('#000000').font('Helvetica');
      doc.moveDown(1.2);
    }

    doc.fontSize(7).fillColor('#888888');
    doc.text(
      "Les moyennes et statuts affichés incluent la compensation entre UE (moyenne d'UE ≥ 9,0 et moyenne de semestre ≥ 10), la validation de semestre (moyenne ≥ 10 et aucune UE sous 9,0), et, sur le bulletin du dernier semestre, la décision de passage à l'année suivante.",
      xDebut,
      doc.y,
      { width: largeurTotale }
    );
    doc.fillColor('#000000');
  });

  return doc;
}
