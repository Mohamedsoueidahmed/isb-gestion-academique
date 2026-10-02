import prisma from '../../shared/database/prismaClient';
import type { Terme } from '@prisma/client';
import { ErreurNonTrouve, ErreurDonneesInvalides, ErreurConflit } from '../../shared/erreurs/ErreurMetier';
import { DonneesAjoutCatalogueElectif } from './electifs.validation';

/**
 * Résout la formation d'une classe (via son parcours) — chaque programme
 * (Licence, chaque Master) a son propre catalogue électif, jamais partagé
 * avec les autres, pour qu'un étudiant de Licence ne voie jamais les
 * électifs propres à un Master, et inversement.
 */
async function resoudreFormationDepuisClasse(classeId: string): Promise<string> {
  const classe = await prisma.classe.findUnique({
    where: { id: classeId },
    include: { parcours: true },
  });
  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }
  return classe.parcours.formationId;
}

/**
 * Liste le catalogue des cours électifs d'UNE formation précise (celle de
 * la classe donnée) — jamais le catalogue entier tous programmes
 * confondus, pour ne jamais mélanger les électifs de Licence et de Master.
 */
export async function listerCatalogueElectifs(classeId: string) {
  const formationId = await resoudreFormationDepuisClasse(classeId);
  return prisma.coursElectif.findMany({ where: { formationId }, orderBy: { code: 'asc' } });
}

/**
 * Ajoute un nouveau cours au catalogue électif d'UNE formation précise (la
 * catalogue fourni au départ n'est jamais exhaustif ; l'administration doit
 * pouvoir l'étendre à tout moment). Une fois ajouté, immédiatement
 * disponible pour n'importe quel étudiant de CETTE formation, sur
 * n'importe lequel de ses créneaux — jamais visible depuis une autre
 * formation.
 */
export async function ajouterCoursElectifCatalogue(classeId: string, donnees: DonneesAjoutCatalogueElectif) {
  const formationId = await resoudreFormationDepuisClasse(classeId);

  const existant = await prisma.coursElectif.findUnique({ where: { code: donnees.code } });
  if (existant) {
    throw new ErreurConflit(`Un cours électif avec le code "${donnees.code}" existe déjà dans le catalogue.`);
  }

  return prisma.coursElectif.create({
    data: {
      code: donnees.code,
      titre: donnees.titre,
      prerequisCode: donnees.prerequisCode ?? null,
      heures: donnees.heures ?? null,
      credits: donnees.credits ?? null,
      formationId,
    },
  });
}

/**
 * Les créneaux électifs (UE de nature OPTIONNELLE) du semestre ACTUELLEMENT
 * ACTIF d'une classe — jamais tous les créneaux du niveau entier, cohérent
 * avec le fonctionnement par phase déjà établi pour Notes et Absences : un
 * créneau de S4 n'a pas de sens à assigner tant que la classe est sur S3.
 */
export async function listerCreneauxElectifsPourClasse(classeId: string) {
  const classe = await prisma.classe.findUnique({ where: { id: classeId } });
  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }

  return prisma.uE.findMany({
    where: { semestreId: classe.semestreActifId, nature: 'OPTIONNELLE' },
    include: { cours: true },
    orderBy: { code: 'asc' },
  });
}

/**
 * Les étudiants actifs d'une classe et leur choix actuel (s'il existe déjà)
 * pour un créneau électif donné — utilisé pour préremplir l'écran
 * d'assignation avant toute modification.
 */
export async function listerChoixPourCreneauEtClasse(classeId: string, ueId: string) {
  const ue = await prisma.uE.findUnique({ where: { id: ueId } });
  if (!ue) {
    throw new ErreurNonTrouve('UE');
  }
  if (ue.nature !== 'OPTIONNELLE') {
    throw new ErreurDonneesInvalides("Cette UE n'est pas un créneau électif.");
  }

  const inscriptions = await prisma.inscription.findMany({
    where: { classeId, statutInscription: 'ACTIVE', etudiant: { statut: { not: 'BLOQUE' } } },
    include: {
      etudiant: true,
      choixElectifs: { where: { ueId }, include: { cours: true } },
    },
    orderBy: { etudiant: { nom: 'asc' } },
  });

  return inscriptions.map((inscription: (typeof inscriptions)[number]) => ({
    inscriptionId: inscription.id,
    etudiant: {
      matricule: inscription.etudiant.matricule,
      nom: inscription.etudiant.nom,
    },
    choixActuel: inscription.choixElectifs[0]
      ? {
          code: inscription.choixElectifs[0].cours.code,
          titre: inscription.choixElectifs[0].cours.titre,
          terme: inscription.choixElectifs[0].terme,
        }
      : null,
  }));
}

/**
 * Assigne (ou change) le choix d'un étudiant pour un créneau OPTIONNELLE.
 *
 * Deux cas, gérés par la même fonction :
 * - Le cours existe déjà directement sous cette UE (ex. Stage/Mémoire,
 *   nommés dès la maquette) : utilisé tel quel, jamais recréé.
 * - Le cours n'existe pas encore (électif générique du catalogue) : créé
 *   à la volée depuis CoursElectif, les crédits restant portés par l'UE.
 *
 * Le cours est toujours PARTAGÉ : si un autre étudiant choisit le même,
 * il pointe vers ce même cours, jamais un doublon.
 */
export async function assignerChoixElectif(
  inscriptionId: string,
  ueId: string,
  codeCoursElectif: string,
  terme?: Terme
) {
  const inscription = await prisma.inscription.findUnique({ where: { id: inscriptionId } });
  if (!inscription) {
    throw new ErreurNonTrouve('Inscription');
  }

  const ue = await prisma.uE.findUnique({ where: { id: ueId } });
  if (!ue) {
    throw new ErreurNonTrouve('UE');
  }
  if (ue.nature !== 'OPTIONNELLE') {
    throw new ErreurDonneesInvalides("Cette UE n'est pas un créneau électif.");
  }

  let cours = await prisma.cours.findFirst({ where: { ueId, code: codeCoursElectif } });

  if (!cours) {
    const formationId = await resoudreFormationDepuisClasse(inscription.classeId);
    const catalogue = await prisma.coursElectif.findUnique({ where: { code: codeCoursElectif } });
    if (!catalogue || catalogue.formationId !== formationId) {
      throw new ErreurNonTrouve('Cours électif (catalogue)');
    }

    cours = await prisma.cours.create({
      data: {
        ueId,
        code: catalogue.code,
        titre: catalogue.titre,
        prerequisCode: catalogue.prerequisCode,
        heures: catalogue.heures,
        estElectif: true,
      },
    });
  }

  const choixExistant = await prisma.choixElectif.findFirst({ where: { inscriptionId, ueId } });

  // Si l'étudiant change réellement de cours (pas juste reconfirme le même
  // choix), les notes, composantes et absences déjà saisies sous l'ANCIEN
  // cours n'ont plus de sens : il n'y est plus inscrit. Sans ce nettoyage,
  // ces lignes resteraient orphelines en base — invisibles nulle part,
  // mais jamais réellement supprimées.
  if (choixExistant && choixExistant.coursId !== cours.id) {
    await prisma.note.deleteMany({ where: { inscriptionId, coursId: choixExistant.coursId } });
    await prisma.evaluationComposante.deleteMany({ where: { inscriptionId, coursId: choixExistant.coursId } });
    await prisma.absence.deleteMany({ where: { inscriptionId, coursId: choixExistant.coursId } });
  }

  const choix = choixExistant
    ? await prisma.choixElectif.update({
        where: { id: choixExistant.id },
        data: { coursId: cours.id, terme: terme ?? null },
        include: { cours: true },
      })
    : await prisma.choixElectif.create({
        data: { inscriptionId, ueId, coursId: cours.id, terme: terme ?? null },
        include: { cours: true },
      });

  return choix;
}

/**
 * Annule le choix électif d'un étudiant pour une UE précise — il
 * redevient simplement "pas encore choisi" (null), libre de choisir à
 * nouveau plus tard. Bloqué si une composante de note existe déjà pour
 * ce cours, exactement comme retirerCoursDuLot et retirerDispense
 * refusent d'écraser un vrai travail de notation.
 */
export async function retirerChoixElectif(inscriptionId: string, ueId: string) {
  const choix = await prisma.choixElectif.findFirst({ where: { inscriptionId, ueId } });
  if (!choix) {
    throw new ErreurNonTrouve('Choix électif pour cette UE');
  }

  const composanteSaisie = await prisma.evaluationComposante.findFirst({
    where: { inscriptionId, coursId: choix.coursId, valeur: { not: null } },
  });
  if (composanteSaisie) {
    throw new ErreurDonneesInvalides(
      'Impossible d\'annuler ce choix : une note y est déjà saisie pour cet étudiant.'
    );
  }

  await prisma.choixElectif.delete({ where: { id: choix.id } });
}
