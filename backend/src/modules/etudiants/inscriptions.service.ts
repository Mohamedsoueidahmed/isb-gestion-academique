import prisma from '../../shared/database/prismaClient';
import { ErreurNonTrouve, ErreurDonneesInvalides, ErreurConflit } from '../../shared/erreurs/ErreurMetier';

const INCLUSION_COMPLETE = {
  etudiant: true,
  anneeUniversitaire: true,
  parcours: true,
  niveau: true,
  classe: true,
} as const;

/**
 * Inscrit un étudiant dans une classe pour l'année entière (S1 et S2
 * ensemble, une classe ne représentant plus qu'un seul semestre à la fois).
 * Bien plus simple que l'ancienne double-création : une seule classe à
 * vérifier, une seule inscription à créer.
 */
export async function creerInscription(etudiantId: string, classeId: string) {
  const etudiant = await prisma.etudiant.findUnique({ where: { id: etudiantId } });
  if (!etudiant) {
    throw new ErreurNonTrouve('Étudiant');
  }

  const classe = await prisma.classe.findUnique({ where: { id: classeId } });
  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }

  if (classe.effectifMax != null) {
    const nombreInscrits = await prisma.inscription.count({
      where: { classeId, statutInscription: 'ACTIVE' },
    });
    if (nombreInscrits >= classe.effectifMax) {
      throw new ErreurDonneesInvalides(
        `La classe "${classe.nom}" a atteint sa limite de ${classe.effectifMax} étudiants.`
      );
    }
  }

  // Un étudiant a une seule inscription active par niveau par année
  // (contrainte du schéma), vérifié ici pour un message clair plutôt
  // qu'une erreur SQL brute.
  const inscriptionExistante = await prisma.inscription.findFirst({
    where: {
      etudiantId,
      niveauId: classe.niveauId,
      anneeUniversitaireId: classe.anneeUniversitaireId,
    },
  });
  if (inscriptionExistante) {
    throw new ErreurConflit('Cet étudiant est déjà inscrit pour ce niveau et cette année universitaire.');
  }

  return prisma.inscription.create({
    data: {
      etudiantId,
      anneeUniversitaireId: classe.anneeUniversitaireId,
      parcoursId: classe.parcoursId,
      niveauId: classe.niveauId,
      classeId: classe.id,
    },
    include: INCLUSION_COMPLETE,
  });
}

/**
 * Liste les étudiants d'une classe précise — via leurs inscriptions actives,
 * jamais via un champ classeId direct sur l'étudiant, qui n'existe pas.
 *
 * Volontairement SANS filtre sur le statut de l'étudiant : c'est le seul
 * endroit où un étudiant bloqué doit rester visible, précisément pour
 * pouvoir le débloquer depuis la fiche de sa classe. Toutes les autres
 * listes d'étudiants du projet excluent BLOQUE ; celle-ci ne doit jamais
 * le faire.
 */
export async function listerEtudiantsParClasse(classeId: string) {
  const classe = await prisma.classe.findUnique({ where: { id: classeId } });
  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }

  return prisma.inscription.findMany({
    where: { classeId, statutInscription: 'ACTIVE' },
    include: { etudiant: true },
    orderBy: { etudiant: { nom: 'asc' } },
  });
}

/**
 * Change la classe d'un étudiant, avec une règle de préservation
 * d'historique explicitement validée :
 * - Si l'inscription actuelle n'a AUCUNE note ni absence liée, on la modifie
 *   directement — rien à préserver, inutile de dupliquer une inscription vide.
 * - Si des notes ou absences existent déjà, on clôture l'inscription actuelle
 *   (statut CLOTUREE, jamais supprimée) et on en crée une nouvelle vers la
 *   nouvelle classe — l'historique de l'ancienne classe reste intact et
 *   consultable, exactement comme un vrai changement de classe en cours
 *   d'année.
 */
export async function changerClasseInscription(inscriptionId: string, nouvelleClasseId: string) {
  const inscription = await prisma.inscription.findUnique({ where: { id: inscriptionId } });
  if (!inscription) {
    throw new ErreurNonTrouve('Inscription');
  }

  const nouvelleClasse = await prisma.classe.findUnique({ where: { id: nouvelleClasseId } });
  if (!nouvelleClasse) {
    throw new ErreurNonTrouve('Classe');
  }

  if (nouvelleClasse.id === inscription.classeId) {
    throw new ErreurDonneesInvalides("L'étudiant est déjà affecté à cette classe.");
  }

  const nombreNotes = await prisma.note.count({ where: { inscriptionId } });
  const nombreAbsences = await prisma.absence.count({ where: { inscriptionId } });
  const aDejaDesDonnees = nombreNotes > 0 || nombreAbsences > 0;

  if (!aDejaDesDonnees) {
    return prisma.inscription.update({
      where: { id: inscriptionId },
      data: {
        classeId: nouvelleClasse.id,
        anneeUniversitaireId: nouvelleClasse.anneeUniversitaireId,
        parcoursId: nouvelleClasse.parcoursId,
        niveauId: nouvelleClasse.niveauId,
      },
      include: INCLUSION_COMPLETE,
    });
  }

  // Des données existent déjà — même contrainte que pour une nouvelle
  // inscription : impossible d'avoir deux inscriptions pour le même
  // niveau et la même année universitaire.
  const inscriptionConflictuelle = await prisma.inscription.findFirst({
    where: {
      etudiantId: inscription.etudiantId,
      niveauId: nouvelleClasse.niveauId,
      anneeUniversitaireId: nouvelleClasse.anneeUniversitaireId,
      id: { not: inscriptionId },
    },
  });
  if (inscriptionConflictuelle) {
    throw new ErreurConflit('Cet étudiant a déjà une inscription pour ce niveau et cette année universitaire.');
  }

  await prisma.inscription.update({
    where: { id: inscriptionId },
    data: { statutInscription: 'CLOTUREE' },
  });

  return prisma.inscription.create({
    data: {
      etudiantId: inscription.etudiantId,
      anneeUniversitaireId: nouvelleClasse.anneeUniversitaireId,
      parcoursId: nouvelleClasse.parcoursId,
      niveauId: nouvelleClasse.niveauId,
      classeId: nouvelleClasse.id,
    },
    include: INCLUSION_COMPLETE,
  });
}
