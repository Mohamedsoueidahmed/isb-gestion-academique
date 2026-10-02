import prisma from '../../shared/database/prismaClient';
import { ErreurConflit, ErreurDonneesInvalides, ErreurNonTrouve } from '../../shared/erreurs/ErreurMetier';
import { DonneesCreationAnneeUniversitaire } from './referentiel.validation';
import { activerAnneeUniversitaire } from '../classes/classes.service';

export async function listerAnneesUniversitaires() {
  return prisma.anneeUniversitaire.findMany({
    orderBy: { libelle: 'desc' },
  });
}

/**
 * Crée une nouvelle année universitaire ET ses 9 classes (3 parcours × 3
 * niveaux) en une seule action — plus de bouton "Activer" séparé, fusionné
 * ici pour ne jamais laisser une année exister sans ses classes.
 */
export async function creerAnneeUniversitaire(donnees: DonneesCreationAnneeUniversitaire) {
  const existante = await prisma.anneeUniversitaire.findUnique({ where: { libelle: donnees.libelle } });
  if (existante) {
    throw new ErreurConflit('Une année universitaire avec ce libellé existe déjà.');
  }

  const dateDebut = new Date(donnees.dateDebut);
  const dateFin = new Date(donnees.dateFin);
  if (dateFin <= dateDebut) {
    throw new ErreurDonneesInvalides('La date de fin doit être postérieure à la date de début.');
  }

  const annee = await prisma.anneeUniversitaire.create({
    data: {
      libelle: donnees.libelle,
      dateDebut,
      dateFin,
      estActive: donnees.estActive ?? false,
    },
  });

  const { classesCreees } = await activerAnneeUniversitaire(annee.id);

  return { annee, classesCreees };
}

/**
 * Marque UNE SEULE année universitaire comme active (celle que le
 * sélecteur en haut de chaque écran retrouve par défaut) — désactive
 * automatiquement toutes les autres, puisqu'une seule doit jamais l'être
 * à la fois. Nommée différemment de activerAnneeUniversitaire
 * (classes.service.ts), qui elle crée les classes standards d'une année
 * et ne touche jamais à ce champ — les deux noms coexistent, mais ne
 * font pas la même chose.
 */
export async function definirAnneeActive(anneeUniversitaireId: string) {
  const annee = await prisma.anneeUniversitaire.findUnique({ where: { id: anneeUniversitaireId } });
  if (!annee) {
    throw new ErreurNonTrouve('Année universitaire');
  }

  await prisma.$transaction([
    prisma.anneeUniversitaire.updateMany({ where: { estActive: true }, data: { estActive: false } }),
    prisma.anneeUniversitaire.update({ where: { id: anneeUniversitaireId }, data: { estActive: true } }),
  ]);

  return { ...annee, estActive: true };
}

/**
 * Supprime une année universitaire — et ses classes si elles sont vides
 * (créées automatiquement, elles ne doivent pas empêcher indéfiniment la
 * suppression d'une année qu'on ne veut plus). Bloqué uniquement si au
 * moins une classe a de vraies données (étudiants inscrits) : dans ce cas,
 * supprimer l'année perdrait un vrai historique, pas juste une structure
 * vide qu'on peut recréer sans conséquence.
 */
export async function supprimerAnneeUniversitaire(id: string) {
  const annee = await prisma.anneeUniversitaire.findUnique({
    where: { id },
    include: {
      classes: {
        include: { _count: { select: { inscriptions: true, affectationsEnseignant: true } } },
      },
    },
  });

  if (!annee) {
    throw new ErreurNonTrouve('Année universitaire');
  }

  const classesAvecDonnees = annee.classes.filter(
    (c: (typeof annee.classes)[number]) => c._count.inscriptions > 0 || c._count.affectationsEnseignant > 0
  );
  if (classesAvecDonnees.length > 0) {
    throw new ErreurDonneesInvalides(
      `Impossible de supprimer cette année : ${classesAvecDonnees.length} classe(s) ont des étudiants inscrits ou des enseignants affectés.`
    );
  }

  // Toutes les classes de cette année sont vides — on les supprime avec
  // l'année, dans une transaction (les deux réussissent ou aucune).
  await prisma.$transaction([
    prisma.classe.deleteMany({ where: { anneeUniversitaireId: id } }),
    prisma.anneeUniversitaire.delete({ where: { id } }),
  ]);
}

export async function listerParcours() {
  return prisma.parcours.findMany({
    where: { estActif: true },
    include: { formation: true },
    orderBy: { nom: 'asc' },
  });
}

export async function listerNiveauxParParcours(parcoursId: string) {
  return prisma.niveau.findMany({
    where: { parcoursId },
    orderBy: { ordre: 'asc' },
  });
}

export async function listerSemestresParNiveau(niveauId: string) {
  return prisma.semestre.findMany({
    where: { niveauId },
    orderBy: { ordre: 'asc' },
  });
}

/**
 * Liste les cours d'un semestre — pour peupler le sélecteur de saisie des
 * notes/absences (classe + cours choisis).
 *
 * Un cours n'apparaît que s'il a AU MOINS une vraie inscription dessus :
 * un cours électif, via un vrai choix (ChoixElectif) ; un cours normal,
 * via une vraie affectation du parcours flexible (AffectationCours).
 * Sans lot ouvert pour personne, un cours normal ne doit tout simplement
 * pas être proposé — exactement le même principe que les électifs,
 * étendu à tous les cours.
 */
export async function listerCoursParSemestre(semestreId: string) {
  return prisma.cours.findMany({
    where: {
      ue: { semestreId },
      OR: [
        { estElectif: false, affectationsCours: { some: {} } },
        { estElectif: true, choixElectifs: { some: {} } },
      ],
    },
    include: { ue: true },
    orderBy: [{ ue: { code: 'asc' } }, { code: 'asc' }],
  });
}
