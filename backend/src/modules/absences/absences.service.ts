import prisma from '../../shared/database/prismaClient';
import { ErreurNonTrouve, ErreurDonneesInvalides } from '../../shared/erreurs/ErreurMetier';
import { DonneesSaisieAbsences } from './absences.validation';

/**
 * Enregistre la présence/absence de TOUS les étudiants actifs d'une classe,
 * pour un cours et une date de séance donnés. Chaque étudiant reçoit une
 * ligne explicite (présent ou absent) — voir note d'ingénierie : ceci permet
 * de reconstituer fiablement le nombre réel de séances tenues, pas seulement
 * le nombre d'absences.
 */
export async function saisirAbsences(donnees: DonneesSaisieAbsences, utilisateurId: string) {
  const classe = await prisma.classe.findUnique({ where: { id: donnees.classeId } });
  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }

  const cours = await prisma.cours.findUnique({ where: { id: donnees.coursId } });
  if (!cours) {
    throw new ErreurNonTrouve('Cours');
  }

  // Aucune vérification de semestre actif ici — le filtrage juste en
  // dessous (vraie affectation ou vrai choix électif) est la seule
  // vérification pertinente : un cours peut légitimement appartenir à un
  // autre semestre que celui actuellement actif de cette classe (anticipé
  // ou en retard), tant qu'une vraie affectation existe dessus.

  const inscriptions = await prisma.inscription.findMany({
    where: {
      classeId: donnees.classeId,
      statutInscription: 'ACTIVE',
      etudiant: { statut: { not: 'BLOQUE' } },
      ...(cours.estElectif
        ? { choixElectifs: { some: { coursId: donnees.coursId } } }
        : { affectationsCours: { some: { coursId: donnees.coursId } } }),
    },
  });

  const ensembleAbsents = new Set(donnees.inscriptionsAbsentes);

  const resultats = [];
  for (const inscription of inscriptions) {
    const estAbsent = ensembleAbsents.has(inscription.id);

    const absence = await prisma.absence.upsert({
      where: {
        inscriptionId_coursId_dateSeance: {
          inscriptionId: inscription.id,
          coursId: donnees.coursId,
          dateSeance: donnees.dateSeance,
        },
      },
      update: { estAbsent, saisieParId: utilisateurId },
      create: {
        inscriptionId: inscription.id,
        coursId: donnees.coursId,
        dateSeance: donnees.dateSeance,
        estAbsent,
        saisieParId: utilisateurId,
      },
    });
    resultats.push(absence);
  }

  return resultats;
}

/**
 * Retourne la feuille de présence d'une séance précise, avec un étudiant par
 * ligne. Si la séance n'a jamais été saisie, chacun apparaît "présent" par
 * défaut (aucune ligne n'existe encore en base pour cette date).
 */
export async function obtenirFeuilleSeance(classeId: string, coursId: string, dateSeance: Date) {
  const classe = await prisma.classe.findUnique({ where: { id: classeId } });
  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }

  const cours = await prisma.cours.findUnique({ where: { id: coursId } });
  if (!cours) {
    throw new ErreurNonTrouve('Cours');
  }

  const inscriptions = await prisma.inscription.findMany({
    where: {
      classeId,
      statutInscription: 'ACTIVE',
      etudiant: { statut: { not: 'BLOQUE' } },
      ...(cours.estElectif ? { choixElectifs: { some: { coursId } } } : { affectationsCours: { some: { coursId } } }),
    },
    include: {
      etudiant: true,
      absences: { where: { coursId, dateSeance } },
    },
    orderBy: { etudiant: { nom: 'asc' } },
  });

  return inscriptions.map((inscription: (typeof inscriptions)[number]) => ({
    inscriptionId: inscription.id,
    etudiant: inscription.etudiant,
    present: !(inscription.absences[0]?.estAbsent ?? false), // présent par défaut si aucune ligne
  }));
}

/**
 * Historique des absences d'un étudiant (via son inscription), avec filtres
 * optionnels par cours et par période — couvre "par étudiant", "par cours"
 * et "par période" avec une seule requête filtrable plutôt que des fonctions
 * dupliquées.
 */
export async function obtenirHistoriqueAbsencesEtudiant(
  inscriptionId: string,
  filtres?: { coursId?: string; dateDebut?: Date; dateFin?: Date }
) {
  const inscription = await prisma.inscription.findUnique({ where: { id: inscriptionId } });
  if (!inscription) {
    throw new ErreurNonTrouve('Inscription');
  }

  return prisma.absence.findMany({
    where: {
      inscriptionId,
      estAbsent: true,
      ...(filtres?.coursId ? { coursId: filtres.coursId } : {}),
      ...(filtres?.dateDebut || filtres?.dateFin
        ? {
            dateSeance: {
              ...(filtres.dateDebut ? { gte: filtres.dateDebut } : {}),
              ...(filtres.dateFin ? { lte: filtres.dateFin } : {}),
            },
          }
        : {}),
    },
    include: { cours: { include: { ue: { include: { semestre: true } } } } },
    orderBy: { dateSeance: 'desc' },
  });
}

/**
 * Statistiques d'absences pour une classe entière — nombre total d'absences
 * par étudiant, utile pour une vue d'ensemble rapide.
 */
export async function obtenirStatistiquesAbsencesClasse(classeId: string) {
  const classe = await prisma.classe.findUnique({ where: { id: classeId } });
  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }

  const inscriptions = await prisma.inscription.findMany({
    where: { classeId, statutInscription: 'ACTIVE', etudiant: { statut: { not: 'BLOQUE' } } },
    include: {
      etudiant: true,
      _count: { select: { absences: { where: { estAbsent: true } } } },
    },
    orderBy: { etudiant: { nom: 'asc' } },
  });

  return inscriptions.map((inscription: (typeof inscriptions)[number]) => ({
    inscriptionId: inscription.id,
    etudiant: inscription.etudiant,
    nombreAbsences: inscription._count.absences,
  }));
}

/**
 * Historique des séances d'un cours pour une classe, jour par jour — pour
 * consultation, jamais pour saisie (voir obtenirFeuilleSeance pour ça).
 *
 * Une séance est enregistrée pour TOUS les inscrits, présents ou absents
 * (règle du projet, pour connaître le nombre réel de séances tenues) — donc
 * regrouper uniquement les lignes "absent" ferait disparaître les séances à
 * 100% de présence, comme si elles n'avaient jamais eu lieu. On regroupe
 * ici par date à partir de TOUTES les lignes, puis on filtre les absents
 * SEULEMENT pour la liste des noms affichés dans chaque groupe.
 */
export async function obtenirHistoriqueSeancesParCours(classeId: string, coursId: string) {
  const classe = await prisma.classe.findUnique({ where: { id: classeId } });
  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }

  const cours = await prisma.cours.findUnique({ where: { id: coursId } });
  if (!cours) {
    throw new ErreurNonTrouve('Cours');
  }

  const toutesLesLignes = await prisma.absence.findMany({
    where: { coursId, inscription: { classeId, etudiant: { statut: { not: 'BLOQUE' } } } },
    include: { inscription: { include: { etudiant: true } } },
  });

  const parDate = new Map<
    string,
    { total: number; absents: { matricule: string; nom: string }[] }
  >();

  for (const ligne of toutesLesLignes) {
    const cle = ligne.dateSeance.toISOString().slice(0, 10);
    if (!parDate.has(cle)) {
      parDate.set(cle, { total: 0, absents: [] });
    }
    const groupe = parDate.get(cle)!;
    groupe.total += 1;
    if (ligne.estAbsent) {
      groupe.absents.push({
        matricule: ligne.inscription.etudiant.matricule,
        nom: ligne.inscription.etudiant.nom,
      });
    }
  }

  return Array.from(parDate.entries())
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([dateSeance, { total, absents }]) => ({ dateSeance, totalInscrits: total, absents }));
}

/**
 * Rassemble les données nécessaires au PDF d'un Terme — le nom de la
 * classe, et pour chaque cours réellement affecté, son titre, son code
 * et l'historique de ses séances (même détail que l'écran de
 * consultation). Séparé de la génération du PDF elle-même (voir
 * absences.pdf.ts), qui ne fait que mettre en page ce qui est déjà
 * calculé ici.
 */
export async function genererDonneesAbsencesTerme(classeId: string, terme: string | null) {
  const classe = await prisma.classe.findUnique({ where: { id: classeId } });
  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }

  const { listerCoursAffectesParTerme } = await import('../lots/lots.service');
  const groupes = await listerCoursAffectesParTerme(classeId);
  const groupe = groupes.find((g: (typeof groupes)[number]) => g.terme === terme);
  if (!groupe || groupe.cours.length === 0) {
    throw new ErreurDonneesInvalides("Aucun cours réellement affecté pour ce Terme dans cette classe.");
  }

  const cours = [];
  for (const coursResume of groupe.cours) {
    const seances = await obtenirHistoriqueSeancesParCours(classeId, coursResume.id);
    cours.push({ code: coursResume.code, titre: coursResume.titre, seances });
  }

  return { classeNom: classe.nom, cours };
}
