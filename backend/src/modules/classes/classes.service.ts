import prisma from '../../shared/database/prismaClient';
import { ErreurNonTrouve, ErreurConflit, ErreurDonneesInvalides } from '../../shared/erreurs/ErreurMetier';
import { DonneesCreationClasse, DonneesModificationClasse, FiltresClasse } from './classes.validation';

const INCLUSION_COMPLETE = {
  anneeUniversitaire: true,
  parcours: true,
  niveau: true,
  semestreActif: true,
} as const;

/**
 * Vérifie que le niveau appartient bien au parcours donné — la validation
 * Zod seule ne peut pas vérifier des relations entre tables. Ne vérifie
 * plus de semestre : une classe n'en a plus qu'un "actif", dérivé
 * automatiquement, jamais fourni par l'appelant à la création.
 */
async function verifierCoherenceHierarchie(parcoursId: string, niveauId: string): Promise<void> {
  const niveau = await prisma.niveau.findUnique({ where: { id: niveauId } });
  if (!niveau) {
    throw new ErreurNonTrouve('Niveau');
  }
  if (niveau.parcoursId !== parcoursId) {
    throw new ErreurDonneesInvalides("Ce niveau n'appartient pas au parcours sélectionné.");
  }
}

export async function creerClasse(donnees: DonneesCreationClasse) {
  const anneeUniversitaire = await prisma.anneeUniversitaire.findUnique({
    where: { id: donnees.anneeUniversitaireId },
  });
  if (!anneeUniversitaire) {
    throw new ErreurNonTrouve('Année universitaire');
  }

  const parcours = await prisma.parcours.findUnique({ where: { id: donnees.parcoursId } });
  if (!parcours) {
    throw new ErreurNonTrouve('Parcours');
  }

  await verifierCoherenceHierarchie(donnees.parcoursId, donnees.niveauId);

  // Une classe démarre toujours sur le premier semestre de son niveau —
  // la bascule vers le second se fait ensuite via basculerSemestreActif,
  // une action explicite et séparée de l'administration.
  const premierSemestre = await prisma.semestre.findFirst({
    where: { niveauId: donnees.niveauId, ordre: 1 },
  });
  if (!premierSemestre) {
    throw new ErreurDonneesInvalides('Aucun premier semestre trouvé pour ce niveau.');
  }

  // La contrainte d'unicité existe déjà en base, mais on vérifie ici pour
  // renvoyer un message clair plutôt qu'une erreur SQL brute au client.
  const classeExistante = await prisma.classe.findFirst({
    where: {
      anneeUniversitaireId: donnees.anneeUniversitaireId,
      parcoursId: donnees.parcoursId,
      niveauId: donnees.niveauId,
      nom: donnees.nom,
    },
  });
  if (classeExistante) {
    throw new ErreurConflit('Une classe avec ce nom existe déjà pour ce parcours, ce niveau et cette année.');
  }

  return prisma.classe.create({
    data: {
      anneeUniversitaireId: donnees.anneeUniversitaireId,
      parcoursId: donnees.parcoursId,
      niveauId: donnees.niveauId,
      semestreActifId: premierSemestre.id,
      nom: donnees.nom,
      effectifMax: donnees.effectifMax ?? null,
    },
    include: INCLUSION_COMPLETE,
  });
}

export async function obtenirClasseParId(id: string) {
  const classe = await prisma.classe.findUnique({
    where: { id },
    include: {
      ...INCLUSION_COMPLETE,
      inscriptions: {
        include: { etudiant: true },
      },
    },
  });

  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }

  return classe;
}

export async function listerClasses(filtres: FiltresClasse) {
  return prisma.classe.findMany({
    where: {
      anneeUniversitaireId: filtres.anneeUniversitaireId,
      parcoursId: filtres.parcoursId,
      niveauId: filtres.niveauId,
      semestreActifId: filtres.semestreActifId,
    },
    include: {
      ...INCLUSION_COMPLETE,
      _count: { select: { inscriptions: true } },
    },
    orderBy: [{ anneeUniversitaire: { libelle: 'desc' } }, { nom: 'asc' }],
  });
}

/**
 * Corrige une classe créée par erreur. Le contexte (parcours/niveau/année)
 * n'est modifiable que si la classe n'a encore aucune inscription — sinon,
 * les inscriptions déjà liées garderaient leur propre copie de l'ancien
 * contexte, devenue incohérente avec la classe modifiée. semestreActifId
 * n'est jamais modifiable ici : voir basculerSemestreActif.
 */
export async function modifierClasse(id: string, donnees: DonneesModificationClasse) {
  const classe = await prisma.classe.findUnique({
    where: { id },
    include: { _count: { select: { inscriptions: true } } },
  });
  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }

  const modifieLeContexte =
    donnees.anneeUniversitaireId !== undefined ||
    donnees.parcoursId !== undefined ||
    donnees.niveauId !== undefined;

  if (modifieLeContexte && classe._count.inscriptions > 0) {
    throw new ErreurDonneesInvalides(
      "Le contexte (parcours, niveau, année) ne peut plus être modifié : cette classe a déjà des étudiants inscrits, dont les inscriptions garderaient une copie de l'ancien contexte."
    );
  }

  if (modifieLeContexte) {
    const parcoursId = donnees.parcoursId ?? classe.parcoursId;
    const niveauId = donnees.niveauId ?? classe.niveauId;
    await verifierCoherenceHierarchie(parcoursId, niveauId);
  }

  const nomAVerifier = donnees.nom ?? classe.nom;
  const anneeAVerifier = donnees.anneeUniversitaireId ?? classe.anneeUniversitaireId;
  const parcoursAVerifier = donnees.parcoursId ?? classe.parcoursId;
  const niveauAVerifier = donnees.niveauId ?? classe.niveauId;

  const conflit = await prisma.classe.findFirst({
    where: {
      id: { not: id },
      anneeUniversitaireId: anneeAVerifier,
      parcoursId: parcoursAVerifier,
      niveauId: niveauAVerifier,
      nom: nomAVerifier,
    },
  });
  if (conflit) {
    throw new ErreurConflit('Une classe avec ce nom existe déjà pour ce parcours, ce niveau et cette année.');
  }

  return prisma.classe.update({
    where: { id },
    data: donnees,
    include: INCLUSION_COMPLETE,
  });
}

/**
 * Active une année universitaire : crée automatiquement une classe pour
 * chaque combinaison parcours × niveau (3 parcours × 3 niveaux = 9 classes),
 * chacune nommée "{niveau}-{codeParcours}-A" (ex. "L1-CCA-A"), démarrant
 * sur le premier semestre de son niveau.
 *
 * Idempotente : utilise upsert sur la contrainte d'unicité existante, donc
 * relancer cette fonction pour une année déjà activée ne recrée rien et ne
 * plante pas — les classes déjà là restent inchangées, seules les
 * manquantes sont créées.
 */
export async function activerAnneeUniversitaire(anneeUniversitaireId: string) {
  const anneeUniversitaire = await prisma.anneeUniversitaire.findUnique({
    where: { id: anneeUniversitaireId },
  });
  if (!anneeUniversitaire) {
    throw new ErreurNonTrouve('Année universitaire');
  }

  const parcoursListe = await prisma.parcours.findMany({
    include: { niveaux: true },
  });

  const classesCreees: string[] = [];
  const classesDejaExistantes: string[] = [];

  for (const parcours of parcoursListe) {
    for (const niveau of parcours.niveaux) {
      const nom = `${niveau.libelle}-${parcours.codeCourt}-A`;

      const premierSemestre = await prisma.semestre.findFirst({
        where: { niveauId: niveau.id, ordre: 1 },
      });
      if (!premierSemestre) {
        // Ne devrait jamais arriver si le référentiel est complet, mais on
        // ne veut jamais planter tout le lot pour un seul niveau mal formé.
        continue;
      }

      const classeExistante = await prisma.classe.findFirst({
        where: {
          anneeUniversitaireId,
          parcoursId: parcours.id,
          niveauId: niveau.id,
          nom,
        },
      });

      if (classeExistante) {
        classesDejaExistantes.push(nom);
        continue;
      }

      await prisma.classe.create({
        data: {
          anneeUniversitaireId,
          parcoursId: parcours.id,
          niveauId: niveau.id,
          semestreActifId: premierSemestre.id,
          nom,
        },
      });
      classesCreees.push(nom);
    }
  }

  return { classesCreees, classesDejaExistantes };
}

/**
 * Retourne les options d'inscription au niveau suivant, pour un niveau et
 * une année donnés — utilisé par le bouton "Inscrire au niveau suivant" sur
 * la fiche étudiant, visible uniquement quand le passage a été accordé.
 *
 * "Niveau suivant" implique aussi l'année universitaire SUIVANTE, pas la
 * même année : un étudiant qui valide L1 en 2026-2027 doit passer en L2 en
 * 2027-2028, jamais rester dans l'année où il vient de valider L1.
 *
 * Deux façons de trouver le niveau suivant :
 * - D'ABORD dans le MÊME parcours (Licence : L1→L2→L3, un seul chemin
 *   possible, toujours exactement une option).
 * - SINON, parmi les parcours FRÈRES de la même formation (Master : un
 *   tronc commun mène vers plusieurs spécialisations distinctes, chacune
 *   son propre parcours — plusieurs options possibles, à choisir).
 *
 * D'où le retour en `options` (jamais un seul niveauSuivant) : la Licence
 * n'aura toujours qu'une option dedans, mais la forme reste la même pour
 * les deux cas plutôt que deux chemins de code différents.
 */
export async function obtenirOptionsInscriptionNiveauSuivant(niveauActuelId: string, anneeActuelleId: string) {
  const niveauActuel = await prisma.niveau.findUnique({
    where: { id: niveauActuelId },
    include: { parcours: true },
  });
  if (!niveauActuel) {
    throw new ErreurNonTrouve('Niveau');
  }

  let niveauxSuivants = await prisma.niveau.findMany({
    where: { parcoursId: niveauActuel.parcoursId, ordre: niveauActuel.ordre + 1 },
    include: { parcours: true },
  });

  if (niveauxSuivants.length === 0) {
    niveauxSuivants = await prisma.niveau.findMany({
      where: {
        ordre: niveauActuel.ordre + 1,
        parcours: { formationId: niveauActuel.parcours.formationId, id: { not: niveauActuel.parcoursId } },
      },
      include: { parcours: true },
    });
  }

  if (niveauxSuivants.length === 0) {
    return { options: [], anneeSuivante: null };
  }

  const anneeActuelle = await prisma.anneeUniversitaire.findUnique({ where: { id: anneeActuelleId } });
  if (!anneeActuelle) {
    throw new ErreurNonTrouve('Année universitaire');
  }

  // La prochaine année chronologiquement, via les vraies dates plutôt que
  // de tenter de déduire "l'année suivante" depuis le libellé (fragile).
  const anneeSuivante = await prisma.anneeUniversitaire.findFirst({
    where: { dateDebut: { gt: anneeActuelle.dateDebut } },
    orderBy: { dateDebut: 'asc' },
  });

  if (!anneeSuivante) {
    return {
      options: niveauxSuivants.map((niveau: (typeof niveauxSuivants)[number]) => ({ niveau, classes: [] })),
      anneeSuivante: null,
    };
  }

  const options = await Promise.all(
    niveauxSuivants.map(async (niveau: (typeof niveauxSuivants)[number]) => ({
      niveau,
      classes: await prisma.classe.findMany({
        where: { niveauId: niveau.id, anneeUniversitaireId: anneeSuivante.id },
        include: { semestreActif: true },
        orderBy: { nom: 'asc' },
      }),
    }))
  );

  return { options, anneeSuivante };
}

/**
 * Bascule le semestre actif d'une classe (S1 → S2, jamais l'inverse pour
 * l'instant). Action explicite et délibérée de l'administration : rien
 * n'est vérifié automatiquement avant de basculer (ni "toutes les notes
 * sont saisies", ni aucune autre condition) — c'est un choix confirmé,
 * pas une omission.
 */
export async function basculerSemestreActif(classeId: string) {
  const classe = await prisma.classe.findUnique({
    where: { id: classeId },
    include: { semestreActif: true },
  });
  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }

  const autreSemestre = await prisma.semestre.findFirst({
    where: { niveauId: classe.niveauId, ordre: { not: classe.semestreActif.ordre } },
  });
  if (!autreSemestre) {
    throw new ErreurDonneesInvalides("Aucun autre semestre trouvé pour ce niveau.");
  }

  return prisma.classe.update({
    where: { id: classeId },
    data: { semestreActifId: autreSemestre.id },
    include: INCLUSION_COMPLETE,
  });
}

/**
 * Supprime une classe, uniquement si elle n'a plus aucune inscription liée
 * — même principe de protection que la contrainte onDelete: Restrict déjà
 * en place, mais avec un message clair plutôt qu'une erreur SQL brute.
 */
export async function supprimerClasse(id: string) {
  const classe = await prisma.classe.findUnique({
    where: { id },
    include: { _count: { select: { inscriptions: true } } },
  });
  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }

  if (classe._count.inscriptions > 0) {
    throw new ErreurDonneesInvalides(
      `Impossible de supprimer cette classe : ${classe._count.inscriptions} étudiant(s) y sont inscrits.`
    );
  }

  await prisma.classe.delete({ where: { id } });
}
