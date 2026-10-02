import prisma from '../../shared/database/prismaClient';
import { ErreurNonTrouve, ErreurConflit, ErreurDonneesInvalides } from '../../shared/erreurs/ErreurMetier';
import { DonneesCreationEtudiant, DonneesModificationEtudiant } from './etudiants.validation';

/**
 * Retrouve un étudiant par son matricule — la clé de continuité de tout
 * son parcours académique. Utilisé au moment de l'inscription, avant
 * toute création : si ce matricule existe déjà, c'est le MÊME étudiant
 * qui continue son parcours (nouvelle année, nouveau niveau), jamais une
 * nouvelle fiche à créer. Renvoie null si aucun étudiant ne porte ce
 * matricule, plutôt qu'une erreur — l'appelant décide alors de créer.
 */
export async function trouverEtudiantParMatricule(matricule: string) {
  return prisma.etudiant.findUnique({ where: { matricule } });
}

export async function creerEtudiant(donnees: DonneesCreationEtudiant) {
  const matriculeExistant = await prisma.etudiant.findUnique({
    where: { matricule: donnees.matricule },
  });
  if (matriculeExistant) {
    throw new ErreurConflit('Un étudiant avec ce matricule existe déjà.');
  }

  return prisma.etudiant.create({
    data: {
      matricule: donnees.matricule,
      nom: donnees.nom,
      inn: donnees.inn,
      dateNaissance: donnees.dateNaissance ? new Date(donnees.dateNaissance) : undefined,
      typeBac: donnees.typeBac,
      numeroBac: donnees.numeroBac,
    },
  });
}

/**
 * Corrige les informations de base d'un étudiant (nom, prénom, matricule).
 * Ne touche jamais à son affectation académique — voir changerClasseInscription
 * pour ça, qui a une logique de préservation d'historique bien plus délicate.
 */
export async function modifierEtudiant(id: string, donnees: DonneesModificationEtudiant) {
  const etudiant = await prisma.etudiant.findUnique({ where: { id } });
  if (!etudiant) {
    throw new ErreurNonTrouve('Étudiant');
  }

  if (donnees.matricule && donnees.matricule !== etudiant.matricule) {
    const matriculeExistant = await prisma.etudiant.findUnique({ where: { matricule: donnees.matricule } });
    if (matriculeExistant) {
      throw new ErreurConflit('Un étudiant avec ce matricule existe déjà.');
    }
  }

  return prisma.etudiant.update({
    where: { id },
    data: {
      ...donnees,
      dateNaissance: donnees.dateNaissance ? new Date(donnees.dateNaissance) : undefined,
    },
  });
}

export async function obtenirEtudiantParId(id: string) {
  const etudiant = await prisma.etudiant.findUnique({
    where: { id },
    include: {
      // Historique académique complet — toutes les inscriptions passées et présentes,
      // pas seulement la classe actuelle, pour ne jamais perdre le parcours de l'étudiant.
      inscriptions: {
        include: {
          anneeUniversitaire: true,
          parcours: true,
          niveau: true,
          classe: true,
          _count: {
            select: {
              notes: true,
              composantesEvaluation: true,
              absences: true,
              choixElectifs: true,
              affectationsCours: true,
            },
          },
        },
        orderBy: { dateInscription: 'desc' },
      },
    },
  });

  if (!etudiant) {
    throw new ErreurNonTrouve('Étudiant');
  }

  return etudiant;
}

export async function rechercherEtudiants(recherche?: string, anneeUniversitaireId?: string) {
  // On inclut l'inscription active (une seule normalement, PAR année) pour
  // permettre d'afficher le parcours et la classe actuels directement dans
  // la liste, sans obliger l'administration à ouvrir chaque fiche
  // individuellement. Si une année est fournie, l'inscription incluse est
  // précisément celle de cette année-là — jamais une inscription active
  // d'une autre année choisie arbitrairement.
  const inclusionInscriptionActive = {
    inscriptions: {
      where: {
        statutInscription: 'ACTIVE' as const,
        ...(anneeUniversitaireId ? { anneeUniversitaireId } : {}),
      },
      include: { parcours: true, classe: true },
      take: 1,
    },
  };

  // Si une année est sélectionnée : on montre les étudiants inscrits pour
  // cette année précise, ET ceux qui n'ont encore AUCUNE inscription (sinon
  // ces derniers deviendraient invisibles dès qu'un filtre s'applique,
  // alors que "Affecter à une classe" existe justement pour les retrouver).
  const filtreAnnee = anneeUniversitaireId
    ? {
        OR: [
          { inscriptions: { some: { anneeUniversitaireId, statutInscription: 'ACTIVE' as const } } },
          { inscriptions: { none: {} } },
        ],
      }
    : {};

  if (!recherche) {
    return prisma.etudiant.findMany({
      where: { ...filtreAnnee, statut: { not: 'BLOQUE' } },
      orderBy: { nom: 'asc' },
      take: 50, // limite raisonnable par défaut, pas de vue "tous les étudiants" sans filtre
      include: inclusionInscriptionActive,
    });
  }

  // AND explicite plutôt qu'un simple spread : filtreAnnee a lui-même une
  // clé OR, et l'étaler directement ici écraserait silencieusement le OR
  // de la recherche (matricule/nom/prénom), qui porte le même nom de clé.
  return prisma.etudiant.findMany({
    where: {
      AND: [
        {
          OR: [
            { matricule: { contains: recherche, mode: 'insensitive' } },
            { nom: { contains: recherche, mode: 'insensitive' } },
          ],
        },
        filtreAnnee,
        { statut: { not: 'BLOQUE' } },
      ],
    },
    orderBy: { nom: 'asc' },
    take: 50,
    include: inclusionInscriptionActive,
  });
}

/**
 * Supprime un étudiant, uniquement si AUCUNE de ses inscriptions ne porte
 * de données réelles — notes, composantes de notes, absences, ou choix
 * électifs. Une inscription vide (créée par erreur, jamais utilisée) est
 * supprimée avec l'étudiant plutôt que de bloquer indéfiniment : rien à
 * préserver dans ce cas, contrairement à une inscription qui porte un vrai
 * historique académique.
 *
 * La relation Inscription → Etudiant est en onDelete: Restrict (vérifié
 * dans le schéma), donc une inscription vide bloquerait quand même la
 * suppression si elle n'était pas explicitement supprimée en premier — ce
 * qui se fait ici en transaction, pour ne jamais laisser l'un des deux
 * supprimé sans l'autre en cas d'échec partiel.
 */
export async function supprimerEtudiant(id: string) {
  const etudiant = await prisma.etudiant.findUnique({
    where: { id },
    include: {
      inscriptions: {
        include: {
          _count: {
            select: {
              notes: true,
              composantesEvaluation: true,
              absences: true,
              choixElectifs: true,
              affectationsCours: true,
            },
          },
        },
      },
    },
  });
  if (!etudiant) {
    throw new ErreurNonTrouve('Étudiant');
  }

  const inscriptionsAvecDonnees = etudiant.inscriptions.filter(
    (i: (typeof etudiant.inscriptions)[number]) =>
      i._count.notes > 0 ||
      i._count.composantesEvaluation > 0 ||
      i._count.absences > 0 ||
      i._count.choixElectifs > 0 ||
      i._count.affectationsCours > 0
  );

  if (inscriptionsAvecDonnees.length > 0) {
    throw new ErreurDonneesInvalides(
      `Impossible de supprimer cet étudiant : des notes, absences, choix électifs ou affectations de cours existent déjà pour ${inscriptionsAvecDonnees.length} de ses inscription(s).`
    );
  }

  const idsInscriptions = etudiant.inscriptions.map((i: (typeof etudiant.inscriptions)[number]) => i.id);

  await prisma.$transaction([
    // Un souhait ou un déblocage n'est qu'une intention ou une permission,
    // jamais un vrai travail académique — jamais bloquant, toujours
    // effacé tranquillement avec l'étudiant.
    prisma.souhaitCours.deleteMany({ where: { inscriptionId: { in: idsInscriptions } } }),
    prisma.deblocagePrerequis.deleteMany({ where: { inscriptionId: { in: idsInscriptions } } }),
    prisma.inscription.deleteMany({ where: { etudiantId: id } }),
    prisma.etudiant.delete({ where: { id } }),
  ]);
}

/**
 * Bloque un étudiant : il disparaît de toutes les listes (recherche,
 * saisie de notes/absences, électifs, bulletins, rattrapage, tableau de
 * bord), SAUF la liste des étudiants de sa classe (listerEtudiantsParClasse)
 * — le seul endroit où il reste volontairement visible, précisément pour
 * pouvoir le débloquer. Rien n'est supprimé : inscriptions, notes,
 * absences, choix électifs restent intacts, juste invisibles ailleurs.
 */
export async function bloquerEtudiant(id: string) {
  const etudiant = await prisma.etudiant.findUnique({ where: { id } });
  if (!etudiant) {
    throw new ErreurNonTrouve('Étudiant');
  }

  return prisma.etudiant.update({ where: { id }, data: { statut: 'BLOQUE' } });
}

/**
 * Débloque un étudiant, le ramenant à ACTIF — le seul état "débloqué"
 * fonctionnel aujourd'hui, ARCHIVE n'étant jamais utilisé ailleurs dans
 * le code.
 */
export async function debloquerEtudiant(id: string) {
  const etudiant = await prisma.etudiant.findUnique({ where: { id } });
  if (!etudiant) {
    throw new ErreurNonTrouve('Étudiant');
  }

  return prisma.etudiant.update({ where: { id }, data: { statut: 'ACTIF' } });
}
