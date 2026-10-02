import prisma from '../../shared/database/prismaClient';
import { ErreurNonTrouve, ErreurDonneesInvalides } from '../../shared/erreurs/ErreurMetier';

/**
 * Le parcours propre à une inscription précise — pour que l'écran des
 * dispenses ne propose jamais les six formations de l'école, seulement
 * celle qui concerne réellement cet étudiant. Le sélecteur de niveau,
 * lui, reste libre à l'intérieur de CE parcours (un étudiant transféré
 * peut avoir des équivalences touchant plusieurs niveaux à la fois).
 */
export async function obtenirParcoursDeLInscription(inscriptionId: string) {
  const inscription = await prisma.inscription.findUnique({
    where: { id: inscriptionId },
    include: { parcours: { include: { formation: true } } },
  });
  if (!inscription) {
    throw new ErreurNonTrouve('Inscription');
  }
  return {
    parcoursId: inscription.parcours.id,
    parcoursNom: inscription.parcours.nom,
    formationNom: inscription.parcours.formation.nom,
  };
}

/**
 * Toutes les matières OBLIGATOIRES d'UN NIVEAU CHOISI — jamais les
 * électifs : un électif reste toujours "un choix parmi plusieurs
 * options", jamais une matière unique et fixe qu'on pourrait dispenser
 * directement, contrairement à une matière obligatoire (un seul cours
 * fixe par UE). Jamais limité au niveau où l'étudiant est actuellement
 * inscrit : ses équivalences peuvent toucher plusieurs niveaux à la
 * fois. Le statut "déjà affecté/dispensé" reste, lui, toujours vérifié
 * sur l'inscription réelle de l'étudiant, quel que soit le niveau
 * choisi dans le sélecteur.
 */
export async function listerMatieresParNiveau(inscriptionId: string, niveauId: string) {
  const inscription = await prisma.inscription.findUnique({ where: { id: inscriptionId } });
  if (!inscription) {
    throw new ErreurNonTrouve('Inscription');
  }

  const cours = await prisma.cours.findMany({
    where: { estElectif: false, ue: { semestre: { niveauId } } },
    include: { ue: { include: { semestre: true } } },
  });

  const affectationsExistantes = await prisma.affectationCours.findMany({ where: { inscriptionId } });
  const parCoursId = new Map(
    (
      affectationsExistantes as {
        coursId: string;
        dispense: boolean;
        universiteOrigine: string | null;
        noteRetenue: unknown;
      }[]
    ).map((a) => [a.coursId, a])
  );

  interface MatiereAvecStatut {
    coursId: string;
    code: string;
    titre: string;
    semestre: string;
    ordreSemestre: number;
    dejaAffecte: boolean;
    dispense: boolean;
    universiteOrigine: string | null;
    noteRetenue: string | null;
  }

  return cours
    .map((c: { id: string; code: string; titre: string; ue: { semestre: { libelle: string; ordre: number } } }): MatiereAvecStatut => {
      const affectation = parCoursId.get(c.id);
      return {
        coursId: c.id,
        code: c.code,
        titre: c.titre,
        semestre: c.ue.semestre.libelle,
        ordreSemestre: c.ue.semestre.ordre,
        dejaAffecte: !!affectation,
        dispense: affectation?.dispense ?? false,
        universiteOrigine: affectation?.universiteOrigine ?? null,
        noteRetenue: affectation?.noteRetenue != null ? String(affectation.noteRetenue) : null,
      };
    })
    .sort((a: MatiereAvecStatut, b: MatiereAvecStatut) => a.ordreSemestre - b.ordreSemestre || a.code.localeCompare(b.code));
}

/**
 * Marque une matière comme dispensée — jamais affectée à un lot ni un
 * Terme précis (elle n'appartient à aucun découpage de l'année en
 * cours), donc jamais comptée dans le nombre de matières d'un Terme
 * côté financier. Refuse d'écraser une affectation qui a déjà une
 * composante de note saisie, exactement comme retirerCoursDuLot refuse
 * d'écraser un vrai travail de notation.
 *
 * `noteRetenue` (sur 20) sert UNIQUEMENT à ce que la moyenne générale
 * reste juste — jamais affichée comme une vraie note (le bulletin
 * montre "Dispensé(e), Université X" à la place), jamais utilisée pour
 * décider si CETTE matière est validée (elle l'est déjà, par la
 * dispense elle-même — voir determinerStatutUE, qui l'exclut
 * explicitement de la règle "tous les cours au minimum"). Une vraie
 * ligne Note est créée avec cette valeur, statut VALIDEE d'office :
 * c'est elle que le reste du système (moyenne d'UE, de semestre) lit
 * déjà, sans qu'aucun autre calcul n'ait besoin d'être modifié.
 */
export async function marquerDispense(
  inscriptionId: string,
  coursId: string,
  universiteOrigine: string,
  noteRetenue: number,
  utilisateurId: string
) {
  const inscription = await prisma.inscription.findUnique({ where: { id: inscriptionId }, include: { niveau: true } });
  if (!inscription) {
    throw new ErreurNonTrouve('Inscription');
  }
  if (inscription.niveau.ordre === 1) {
    throw new ErreurDonneesInvalides(
      `Aucune dispense possible : ${inscription.niveau.libelle} est le tout début du cycle, rien à dispenser avant.`
    );
  }
  const cours = await prisma.cours.findUnique({ where: { id: coursId } });
  if (!cours) {
    throw new ErreurNonTrouve('Cours');
  }
  if (!universiteOrigine.trim()) {
    throw new ErreurDonneesInvalides("L'université d'origine est requise pour marquer une dispense.");
  }
  if (noteRetenue < 0 || noteRetenue > 20) {
    throw new ErreurDonneesInvalides('La note retenue doit être comprise entre 0 et 20.');
  }

  const composanteSaisie = await prisma.evaluationComposante.findFirst({
    where: { inscriptionId, coursId, valeur: { not: null } },
  });
  if (composanteSaisie) {
    throw new ErreurDonneesInvalides(
      'Impossible de dispenser cette matière : une note y est déjà saisie pour cet étudiant.'
    );
  }

  const [affectation] = await prisma.$transaction([
    prisma.affectationCours.upsert({
      where: { inscriptionId_coursId: { inscriptionId, coursId } },
      update: {
        dispense: true,
        universiteOrigine: universiteOrigine.trim(),
        noteRetenue,
        lotId: null,
        numeroLot: null,
        terme: null,
      },
      create: {
        inscriptionId,
        coursId,
        dispense: true,
        universiteOrigine: universiteOrigine.trim(),
        noteRetenue,
        numeroLot: null,
      },
    }),
    prisma.note.upsert({
      where: { inscriptionId_coursId: { inscriptionId, coursId } },
      update: { valeur: noteRetenue, statutValidation: 'VALIDEE', dateSaisie: new Date(), saisieParId: utilisateurId },
      create: {
        inscriptionId,
        coursId,
        valeur: noteRetenue,
        statutValidation: 'VALIDEE',
        dateSaisie: new Date(),
        saisieParId: utilisateurId,
      },
    }),
  ]);

  return affectation;
}

/**
 * Retire une dispense — l'étudiant redevient simplement "pas encore
 * affecté" à cette matière, libre d'y être affecté normalement plus
 * tard (lot...) si besoin. La ligne Note créée pour la dispense
 * disparaît avec elle.
 */
export async function retirerDispense(inscriptionId: string, coursId: string) {
  const affectation = await prisma.affectationCours.findUnique({
    where: { inscriptionId_coursId: { inscriptionId, coursId } },
  });
  if (!affectation || !affectation.dispense) {
    throw new ErreurNonTrouve('Dispense pour cette matière');
  }

  await prisma.$transaction([
    prisma.affectationCours.delete({ where: { id: affectation.id } }),
    prisma.note.deleteMany({ where: { inscriptionId, coursId } }),
  ]);
}
