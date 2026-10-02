import prisma from '../../shared/database/prismaClient';
import { ErreurNonTrouve, ErreurDonneesInvalides } from '../../shared/erreurs/ErreurMetier';
import { DonneesSaisieComposante } from './notes.validation';
import { trouverInscriptionsSoeurs } from '../lots/lots.service';
import {
  calculerMoyenneLicence,
  calculerMoyenneMaster,
  determinerStatutValidation,
  session2Necessaire,
  calculerMoyenneUE,
  determinerStatutUE,
  calculerMoyenneSemestre,
  calculerMoyenneAnnuelle,
  determinerPassageAnnee,
  StatutValidationUE,
} from './moteurCalcul.service';

type TypeComposanteValide =
  | 'DEVOIR_1'
  | 'DEVOIR_2'
  | 'EXPOSE'
  | 'EXAMEN_SESSION_1'
  | 'EXAMEN_SESSION_2'
  | 'DEVOIR';

const TYPES_VALIDES_LICENCE: TypeComposanteValide[] = [
  'DEVOIR_1',
  'DEVOIR_2',
  'EXPOSE',
  'EXAMEN_SESSION_1',
  'EXAMEN_SESSION_2',
];
const TYPES_VALIDES_MASTER: TypeComposanteValide[] = ['DEVOIR', 'EXPOSE', 'EXAMEN_SESSION_1', 'EXAMEN_SESSION_2'];

/**
 * Convertit une valeur Decimal (Prisma/decimal.js) en number simple. Utilise
 * .toNumber() explicitement quand disponible, plutôt que de compter sur une
 * coercion implicite qu'on ne peut pas vérifier sans le client généré.
 */
function extraireValeur(
  composantes: { type: string; valeur: unknown }[],
  type: TypeComposanteValide
): number | null {
  const trouvee = composantes.find((c) => c.type === type);
  if (!trouvee || trouvee.valeur == null) return null;
  const brut = trouvee.valeur as { toNumber?: () => number };
  return typeof brut.toNumber === 'function' ? brut.toNumber() : Number(trouvee.valeur);
}

/**
 * Remonte la chaîne Inscription → Parcours → Formation pour connaître le
 * cycle (Licence/Master), qui détermine les composantes et coefficients
 * applicables à cette inscription.
 */
async function obtenirInscriptionAvecCycle(inscriptionId: string) {
  const inscription = await prisma.inscription.findUnique({
    where: { id: inscriptionId },
    include: {
      parcours: { include: { formation: true } },
      classe: true,
    },
  });
  if (!inscription) {
    throw new ErreurNonTrouve('Inscription');
  }
  if (!inscription.parcours.formation.cycle) {
    throw new ErreurDonneesInvalides(
      `Le cycle (Licence/Master) n'est pas configuré pour la formation "${inscription.parcours.formation.nom}".`
    );
  }
  return inscription as typeof inscription & { parcours: { formation: { cycle: 'LICENCE' | 'MASTER' } } };
}

/**
 * Recalcule la moyenne et le statut d'une matière à partir de ses
 * composantes actuelles, et met à jour Note en conséquence. Appelé
 * automatiquement après chaque sauvegarde de composante — jamais déclenché
 * manuellement par l'administration.
 */
export async function recalculerNoteEtStatut(inscriptionId: string, coursId: string, utilisateurId: string) {
  const inscription = await obtenirInscriptionAvecCycle(inscriptionId);
  const cycle = inscription.parcours.formation.cycle;

  const composantes = await prisma.evaluationComposante.findMany({
    where: { inscriptionId, coursId },
  });

  let moyenne: number | null;
  let session2DejaSaisie: boolean;

  if (cycle === 'LICENCE') {
    const devoir1 = extraireValeur(composantes, 'DEVOIR_1');
    const devoir2 = extraireValeur(composantes, 'DEVOIR_2');
    const expose = extraireValeur(composantes, 'EXPOSE');
    const examenSession1 = extraireValeur(composantes, 'EXAMEN_SESSION_1');
    const examenSession2 = extraireValeur(composantes, 'EXAMEN_SESSION_2');

    moyenne = calculerMoyenneLicence({ devoir1, devoir2, expose, examenSession1, examenSession2 });
    session2DejaSaisie = examenSession2 != null;
  } else {
    const devoir = extraireValeur(composantes, 'DEVOIR');
    const expose = extraireValeur(composantes, 'EXPOSE');
    const examenSession1 = extraireValeur(composantes, 'EXAMEN_SESSION_1');
    const examenSession2 = extraireValeur(composantes, 'EXAMEN_SESSION_2');

    moyenne = calculerMoyenneMaster({ devoir, expose, examenSession1, examenSession2 });
    session2DejaSaisie = examenSession2 != null;
  }

  const statut = determinerStatutValidation(moyenne, session2DejaSaisie);

  const noteExistante = await prisma.note.findUnique({
    where: { inscriptionId_coursId: { inscriptionId, coursId } },
  });

  if (noteExistante) {
    const ancienneValeurNum = noteExistante.valeur != null ? Number(noteExistante.valeur) : null;
    // On n'archive que si la moyenne change réellement — évite de polluer
    // l'historique avec des recalculs qui ne modifient rien.
    if (ancienneValeurNum !== moyenne) {
      await prisma.noteHistorique.create({
        data: {
          noteId: noteExistante.id,
          ancienneValeur: noteExistante.valeur,
          modifieParId: utilisateurId,
        },
      });
    }

    return prisma.note.update({
      where: { id: noteExistante.id },
      data: { valeur: moyenne, statutValidation: statut, dateSaisie: new Date(), saisieParId: utilisateurId },
    });
  }

  return prisma.note.create({
    data: {
      inscriptionId,
      coursId,
      valeur: moyenne,
      statutValidation: statut,
      dateSaisie: new Date(),
      saisieParId: utilisateurId,
    },
  });
}

/**
 * Saisit ou modifie une composante d'évaluation (Devoir 1, Exposé, Examen
 * Session 1...), puis recalcule automatiquement la moyenne de la matière.
 *
 * Deux vérifications de cohérence, en plus de la vérification habituelle
 * cours/semestre :
 * - Le type de composante doit être valide pour le cycle de la formation
 *   (ex. DEVOIR_2 n'existe pas en Master).
 * - La Session 2 ne peut être saisie que si elle est réellement nécessaire
 *   (moyenne de session 1 en dessous du seuil) — appliqué ici, pas
 *   seulement caché côté interface, pour ne jamais dépendre uniquement
 *   d'un client qui pourrait contourner l'affichage.
 */
export async function saisirComposante(donnees: DonneesSaisieComposante, utilisateurId: string) {
  const inscription = await obtenirInscriptionAvecCycle(donnees.inscriptionId);
  const cycle = inscription.parcours.formation.cycle;

  const cours = await prisma.cours.findUnique({ where: { id: donnees.coursId } });
  if (!cours) {
    throw new ErreurNonTrouve('Cours');
  }

  // La saisie n'est autorisée que si cet étudiant est réellement inscrit à
  // ce cours précis — une vraie affectation (parcours flexible, peu
  // importe le semestre officiel du cours, anticipé ou en retard compris)
  // ou un vrai choix électif. Jamais une comparaison avec le semestre
  // actif de la classe, qui ne reflète plus l'ordre réel de progression.
  const [affectation, choixElectif] = await Promise.all([
    prisma.affectationCours.findUnique({
      where: { inscriptionId_coursId: { inscriptionId: donnees.inscriptionId, coursId: donnees.coursId } },
    }),
    prisma.choixElectif.findFirst({
      where: { inscriptionId: donnees.inscriptionId, coursId: donnees.coursId },
    }),
  ]);
  if (!affectation && !choixElectif) {
    throw new ErreurDonneesInvalides("Cet étudiant n'est pas réellement inscrit à ce cours.");
  }

  const typesValides = cycle === 'LICENCE' ? TYPES_VALIDES_LICENCE : TYPES_VALIDES_MASTER;
  if (!typesValides.includes(donnees.type as TypeComposanteValide)) {
    throw new ErreurDonneesInvalides(
      `Le type de composante "${donnees.type}" n'est pas valide pour une formation de ${
        cycle === 'LICENCE' ? 'Licence' : 'Master'
      }.`
    );
  }

  if (donnees.type === 'EXAMEN_SESSION_2' && donnees.valeur != null) {
    const composantesActuelles = await prisma.evaluationComposante.findMany({
      where: { inscriptionId: donnees.inscriptionId, coursId: donnees.coursId },
    });

    const necessaire =
      cycle === 'LICENCE'
        ? session2Necessaire('LICENCE', {
            devoir1: extraireValeur(composantesActuelles, 'DEVOIR_1'),
            devoir2: extraireValeur(composantesActuelles, 'DEVOIR_2'),
            expose: extraireValeur(composantesActuelles, 'EXPOSE'),
            examenSession1: extraireValeur(composantesActuelles, 'EXAMEN_SESSION_1'),
          })
        : session2Necessaire('MASTER', {
            devoir: extraireValeur(composantesActuelles, 'DEVOIR'),
            expose: extraireValeur(composantesActuelles, 'EXPOSE'),
            examenSession1: extraireValeur(composantesActuelles, 'EXAMEN_SESSION_1'),
          });

    if (!necessaire) {
      throw new ErreurDonneesInvalides(
        "La session 2 n'est pas nécessaire pour cette matière (session 1 déjà validée, ou pas encore complète)."
      );
    }
  }

  const composanteExistante = await prisma.evaluationComposante.findUnique({
    where: {
      inscriptionId_coursId_type: {
        inscriptionId: donnees.inscriptionId,
        coursId: donnees.coursId,
        type: donnees.type,
      },
    },
  });

  let composante;
  if (composanteExistante) {
    await prisma.evaluationComposanteHistorique.create({
      data: {
        evaluationComposanteId: composanteExistante.id,
        ancienneValeur: composanteExistante.valeur,
        modifieParId: utilisateurId,
      },
    });

    composante = await prisma.evaluationComposante.update({
      where: { id: composanteExistante.id },
      data: { valeur: donnees.valeur, dateSaisie: new Date(), saisieParId: utilisateurId },
    });
  } else {
    composante = await prisma.evaluationComposante.create({
      data: {
        inscriptionId: donnees.inscriptionId,
        coursId: donnees.coursId,
        type: donnees.type,
        valeur: donnees.valeur,
        dateSaisie: new Date(),
        saisieParId: utilisateurId,
      },
    });
  }

  const note = await recalculerNoteEtStatut(donnees.inscriptionId, donnees.coursId, utilisateurId);

  return { composante, note };
}

/**
 * Retourne, pour une inscription et un cours donnés, toutes les composantes
 * actuelles, la moyenne calculée, le statut, et si la Session 2 doit être
 * proposée — la forme complète nécessaire à un écran de saisie détaillé
 * pour un seul étudiant.
 */
export async function obtenirComposantesInscriptionCours(inscriptionId: string, coursId: string) {
  const inscription = await obtenirInscriptionAvecCycle(inscriptionId);
  const cycle = inscription.parcours.formation.cycle;

  const composantes = await prisma.evaluationComposante.findMany({ where: { inscriptionId, coursId } });
  const note = await prisma.note.findUnique({ where: { inscriptionId_coursId: { inscriptionId, coursId } } });

  const typesAConsiderer = cycle === 'LICENCE' ? TYPES_VALIDES_LICENCE : TYPES_VALIDES_MASTER;
  const valeurs: Record<string, number | null> = {};
  for (const type of typesAConsiderer) {
    valeurs[type] = extraireValeur(composantes, type);
  }

  const session2Visible =
    cycle === 'LICENCE'
      ? session2Necessaire('LICENCE', {
          devoir1: valeurs.DEVOIR_1,
          devoir2: valeurs.DEVOIR_2,
          expose: valeurs.EXPOSE,
          examenSession1: valeurs.EXAMEN_SESSION_1,
        })
      : session2Necessaire('MASTER', {
          devoir: valeurs.DEVOIR,
          expose: valeurs.EXPOSE,
          examenSession1: valeurs.EXAMEN_SESSION_1,
        });

  return {
    cycle,
    composantes: valeurs,
    session2Visible,
    moyenne: note?.valeur ?? null,
    statutValidation: note?.statutValidation ?? null,
  };
}

/**
 * Retourne, pour une inscription précise, tous les cours des DEUX
 * semestres du niveau (S1 et S2), avec la moyenne et le statut de
 * validation de chacun — utilisé par la fiche étudiant pour afficher son
 * relevé de notes complet de l'année, l'inscription couvrant maintenant
 * l'année entière plutôt qu'un seul semestre.
 */
/**
 * Les cours réellement suivis par un étudiant sur une inscription
 * précise — jamais le programme théorique du niveau. Interroge
 * directement les vraies affectations (parcours flexible) et les choix
 * électifs, sans jamais passer par la liste des cours du niveau : un
 * étudiant peut avoir une affectation sur un cours d'un autre niveau du
 * même parcours (anticipé ou en retard), qui doit apparaître ici tout
 * autant qu'un cours de son propre niveau.
 *
 * Chaque ligne porte son Terme (Automne/Printemps/Été) plutôt que le
 * semestre officiel du cours, qui ne reflète plus l'ordre réel de
 * progression de l'étudiant dans un parcours flexible. Un choix électif
 * porte lui aussi son propre Terme (optionnel, choisi à l'assignation) ;
 * sans Terme précisé, sa ligne l'indique par une valeur vide plutôt que
 * d'inventer un semestre.
 *
 * Chaque ligne non dispensée porte aussi le détail de ses composantes
 * (Devoir, Exposé, Examen...) — jamais juste la moyenne finale, pour que
 * la fiche étudiant montre le même niveau de détail qu'un vrai bulletin.
 * Une matière dispensée n'en a aucune par définition (`{}`) : sa ligne va
 * de toute façon dans la section "Dispensé(s)" de l'écran, jamais celle-ci.
 */
export async function obtenirNotesInscription(inscriptionId: string) {
  const inscription = await prisma.inscription.findUnique({
    where: { id: inscriptionId },
    include: { parcours: { include: { formation: true } } },
  });
  if (!inscription) {
    throw new ErreurNonTrouve('Inscription');
  }
  // Le cycle est une propriété de la formation, constante pour TOUTE
  // l'inscription — même un cours anticipé ou en retard reste dans le
  // même parcours, donc la même formation, donc le même cycle.
  const cycle = inscription.parcours.formation.cycle;
  const typesAConsiderer = cycle === 'LICENCE' ? TYPES_VALIDES_LICENCE : TYPES_VALIDES_MASTER;

  const inclusionCoursComplete = {
    cours: { include: { ue: { include: { semestre: { include: { niveau: true } } } } } },
  };

  const affectationsCours = await prisma.affectationCours.findMany({
    where: { inscriptionId },
    include: inclusionCoursComplete,
    orderBy: { creeLe: 'asc' },
  });

  const choixElectifs = await prisma.choixElectif.findMany({
    where: { inscriptionId },
    include: inclusionCoursComplete,
  });

  const notes = await prisma.note.findMany({ where: { inscriptionId } });

  // Toutes les composantes de TOUS les cours de cette inscription, en une
  // seule requête groupée — jamais une requête par cours (même principe
  // que le reste de ce fichier).
  const toutesLesComposantes = await prisma.evaluationComposante.findMany({ where: { inscriptionId } });

  function composantesDuCours(coursId: string): Record<string, number | null> {
    const composantesDeCeCours = toutesLesComposantes.filter(
      (c: { coursId: string }) => c.coursId === coursId
    );
    const valeurs: Record<string, number | null> = {};
    for (const type of typesAConsiderer) {
      valeurs[type] = extraireValeur(composantesDeCeCours, type);
    }
    return valeurs;
  }

  const lignesAffectations = affectationsCours.map((affectation: (typeof affectationsCours)[number]) => {
    const note = notes.find((n: (typeof notes)[number]) => n.coursId === affectation.coursId);
    return {
      coursId: affectation.coursId,
      coursCode: affectation.cours.code,
      coursTitre: affectation.cours.titre,
      ueCode: affectation.cours.ue.code,
      niveauId: affectation.cours.ue.semestre.niveau.id,
      niveau: affectation.cours.ue.semestre.niveau.libelle,
      semestre: affectation.cours.ue.semestre.libelle,
      terme: affectation.terme,
      typeSuivi: affectation.typeSuivi,
      composantes: affectation.dispense ? {} : composantesDuCours(affectation.coursId),
      moyenne: note?.valeur ?? null,
      statutValidation: note?.statutValidation ?? null,
      dispense: affectation.dispense,
      universiteOrigine: affectation.universiteOrigine,
    };
  });

  // Un choix électif classique n'est jamais aussi une affectation — sauf
  // pour une matière dispensée (voir dispenses.service.ts), où les deux
  // sont créés ensemble pour le même cours, délibérément. Un Set évite
  // de le compter deux fois ici.
  const idsCoursDejaListes = new Set(lignesAffectations.map((l: { coursId: string }) => l.coursId));

  // Il a en revanche bien son propre Terme (choisi à l'assignation), mais
  // jamais de type de suivi — toujours "normal", jamais anticipé ni en
  // retard, puisqu'il ne passe jamais par une vraie affectation. Jamais
  // une dispense non plus (filtré ci-dessus) — toujours false ici.
  const lignesElectifs = choixElectifs
    .filter((choix: (typeof choixElectifs)[number]) => !idsCoursDejaListes.has(choix.coursId))
    .map((choix: (typeof choixElectifs)[number]) => {
      const note = notes.find((n: (typeof notes)[number]) => n.coursId === choix.coursId);
      return {
        coursId: choix.coursId,
        coursCode: choix.cours.code,
        coursTitre: choix.cours.titre,
        ueCode: choix.cours.ue.code,
        niveauId: choix.cours.ue.semestre.niveau.id,
        niveau: choix.cours.ue.semestre.niveau.libelle,
        semestre: choix.cours.ue.semestre.libelle,
        terme: choix.terme,
        typeSuivi: null,
        composantes: composantesDuCours(choix.coursId),
        moyenne: note?.valeur ?? null,
        statutValidation: note?.statutValidation ?? null,
        dispense: false,
        universiteOrigine: null,
      };
    });

  return [...lignesAffectations, ...lignesElectifs];
}

/**
 * Liste, toutes classes confondues, chaque matière où un étudiant est en
 * attente de session 2 — avec son contexte complet (parcours, niveau,
 * classe) pour que l'écran de rattrapage puisse regrouper par parcours
 * puis par niveau. La moyenne renvoyée est celle de la session 1 seule,
 * utile pour voir à quel point l'étudiant était proche du seuil.
 */
export async function obtenirEtudiantsRattrapage(anneeUniversitaireId?: string) {
  const notes = await prisma.note.findMany({
    where: {
      statutValidation: 'EN_ATTENTE_SESSION_2',
      inscription: {
        etudiant: { statut: { not: 'BLOQUE' } },
        ...(anneeUniversitaireId ? { anneeUniversitaireId } : {}),
      },
    },
    include: {
      inscription: {
        include: {
          etudiant: true,
          parcours: true,
          niveau: true,
          classe: true,
        },
      },
      cours: true,
    },
    orderBy: [
      { inscription: { parcours: { nom: 'asc' } } },
      { inscription: { niveau: { ordre: 'asc' } } },
      { inscription: { etudiant: { nom: 'asc' } } },
    ],
  });

  return notes.map((note: (typeof notes)[number]) => ({
    inscriptionId: note.inscriptionId,
    coursId: note.coursId,
    etudiant: {
      matricule: note.inscription.etudiant.matricule,
      nom: note.inscription.etudiant.nom,
    },
    parcours: note.inscription.parcours.nom,
    niveau: note.inscription.niveau.libelle,
    classe: note.inscription.classe.nom,
    coursCode: note.cours.code,
    coursTitre: note.cours.titre,
    moyenneSession1: note.valeur,
  }));
}

/**
 * Rassemble les données nécessaires au PDF de rattrapage — le libellé de
 * l'année (ou "Toutes années" si aucune n'est précisée) et la liste
 * complète des étudiants en attente de Session 2, déjà triée comme
 * l'écran l'exige (Parcours, Niveau, Nom).
 */
export async function genererDonneesRattrapage(anneeUniversitaireId?: string) {
  const etudiants = await obtenirEtudiantsRattrapage(anneeUniversitaireId);

  let anneeLibelle = 'toutes années confondues';
  if (anneeUniversitaireId) {
    const annee = await prisma.anneeUniversitaire.findUnique({ where: { id: anneeUniversitaireId } });
    anneeLibelle = annee?.libelle ?? anneeLibelle;
  }

  return { anneeLibelle, etudiants };
}

/**
 * Retourne, pour un cours et une classe donnés, la liste de tous les
 * étudiants inscrits avec toutes leurs composantes actuelles, leur moyenne
 * et leur statut — la forme nécessaire à une saisie en tableau, plusieurs
 * composantes par étudiant, pour une classe entière.
 */
export async function obtenirNotesCoursPourClasse(classeId: string, coursId: string) {
  const classe = await prisma.classe.findUnique({
    where: { id: classeId },
    include: { parcours: { include: { formation: true } } },
  });
  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }

  const cours = await prisma.cours.findUnique({ where: { id: coursId } });
  if (!cours) {
    throw new ErreurNonTrouve('Cours');
  }

  if (!classe.parcours.formation.cycle) {
    throw new ErreurDonneesInvalides(
      `Le cycle (Licence/Master) n'est pas configuré pour la formation "${classe.parcours.formation.nom}".`
    );
  }
  const cycle = classe.parcours.formation.cycle;
  const typesAConsiderer = cycle === 'LICENCE' ? TYPES_VALIDES_LICENCE : TYPES_VALIDES_MASTER;

  const inscriptions = await prisma.inscription.findMany({
    where: {
      classeId,
      statutInscription: 'ACTIVE',
      etudiant: { statut: { not: 'BLOQUE' } },
      // Pour un cours électif, seuls les étudiants ayant choisi CE cours
      // précis apparaissent. Pour un cours normal, seuls ceux ayant une
      // vraie affectation dessus (parcours flexible) — jamais toute la
      // classe par défaut, même pour un cours obligatoire.
      ...(cours.estElectif
        ? { choixElectifs: { some: { coursId } } }
        : { affectationsCours: { some: { coursId } } }),
    },
    include: {
      etudiant: true,
      notes: { where: { coursId } },
      composantesEvaluation: { where: { coursId } },
    },
    orderBy: { etudiant: { nom: 'asc' } },
  });

  return {
    cycle,
    etudiants: inscriptions.map((inscription: (typeof inscriptions)[number]) => {
      const valeurs: Record<string, number | null> = {};
      for (const type of typesAConsiderer) {
        valeurs[type] = extraireValeur(inscription.composantesEvaluation, type);
      }

      const session2Visible =
        cycle === 'LICENCE'
          ? session2Necessaire('LICENCE', {
              devoir1: valeurs.DEVOIR_1,
              devoir2: valeurs.DEVOIR_2,
              expose: valeurs.EXPOSE,
              examenSession1: valeurs.EXAMEN_SESSION_1,
            })
          : session2Necessaire('MASTER', {
              devoir: valeurs.DEVOIR,
              expose: valeurs.EXPOSE,
              examenSession1: valeurs.EXAMEN_SESSION_1,
            });

      return {
        inscriptionId: inscription.id,
        etudiant: inscription.etudiant,
        composantes: valeurs,
        session2Visible,
        moyenne: inscription.notes[0]?.valeur ?? null,
        statutValidation: inscription.notes[0]?.statutValidation ?? null,
      };
    }),
  };
}

/**
 * Calcule, pour UNE inscription donnée, la moyenne et le statut de chacune
 * de ses UE ainsi que la moyenne et le statut du semestre correspondant.
 * Utilisé par obtenirPassageAnnee pour évaluer S1 et S2 séparément, avant
 * de les combiner en une décision annuelle.
 *
 * Duplique volontairement une partie de la logique déjà présente dans
 * bulletins.service.ts (par souci de ne pas risquer de régression sur le
 * bulletin déjà vérifié en fin de session) — à factoriser proprement dans
 * un futur chantier de refactoring dédié et re-testé pour lui-même.
 */
/**
 * Calcule, pour UNE inscription et UN semestre donnés, la moyenne et le
 * statut de chacune des UE de ce semestre, ainsi que la moyenne du
 * semestre. Prend maintenant le semestre en paramètre explicite (S1 ou S2)
 * plutôt que de le déduire de l'inscription — une inscription couvre
 * désormais l'année entière, donc ses notes se répartissent naturellement
 * entre S1 et S2 selon le cours concerné, sans avoir besoin de deux
 * inscriptions séparées.
 *
 * Duplique volontairement une partie de la logique déjà présente dans
 * bulletins.service.ts (par souci de ne pas risquer de régression sur le
 * bulletin déjà vérifié) — à factoriser proprement dans un futur chantier
 * de refactoring dédié et re-testé pour lui-même.
 */
export async function calculerDetailInscription(inscriptionId: string, semestreId: string) {
  const inscription = await prisma.inscription.findUnique({
    where: { id: inscriptionId },
    include: { niveau: { include: { parcours: true } } },
  });
  if (!inscription) {
    throw new ErreurNonTrouve('Inscription');
  }

  const semestre = await prisma.semestre.findUnique({ where: { id: semestreId } });
  if (!semestre) {
    throw new ErreurNonTrouve('Semestre');
  }

  const uesDuSemestre = await prisma.uE.findMany({
    where: { semestreId },
    include: { cours: true },
  });

  const choixElectifs = await prisma.choixElectif.findMany({
    where: { inscriptionId, ueId: { in: uesDuSemestre.map((ue: (typeof uesDuSemestre)[number]) => ue.id) } },
    include: { cours: true },
  });

  // Une UE optionnelle n'a, pour CETTE inscription, que le cours choisi
  // (voir ChoixElectif) — jamais tous les cours électifs qui pourraient
  // exister sous cette UE pour d'autres étudiants. Sans choix encore fait,
  // la liste reste vide.
  function coursPourCetteInscription(ue: (typeof uesDuSemestre)[number]) {
    if (ue.nature !== 'OPTIONNELLE') return ue.cours;
    const choix = choixElectifs.find((c: (typeof choixElectifs)[number]) => c.ueId === ue.id);
    return choix ? [choix.cours] : [];
  }

  const idsCoursDuSemestre = uesDuSemestre.flatMap((ue: (typeof uesDuSemestre)[number]) =>
    coursPourCetteInscription(ue).map((c: { id: string }) => c.id)
  );

  // Une dispense est propre à CETTE inscription précise (jamais héritée
  // d'une inscription sœur, contrairement au résultat lui-même) — c'est
  // une décision administrative prise ici, pas un résultat académique
  // qui voyagerait d'une année à l'autre.
  const affectationsDispensees = await prisma.affectationCours.findMany({
    where: { inscriptionId, coursId: { in: idsCoursDuSemestre }, dispense: true },
    select: { coursId: true },
  });
  const idsCoursDispenses = new Set(
    (affectationsDispensees as { coursId: string }[]).map((a) => a.coursId)
  );

  // Le RÉSULTAT de chaque cours regarde à travers TOUTES les inscriptions
  // sœurs (même formation, n'importe quelle année) — un cours de ce
  // semestre, repris et validé plus tard sous une inscription différente
  // (le niveau suivant, par exemple), reste définitif ici, jamais ignoré
  // au profit d'une note vide sous l'inscription d'origine. La liste des
  // cours elle-même (quelle UE, quel semestre) reste, elle, propre à
  // cette inscription précise — seul le résultat traverse les sœurs.
  const inscriptionsSoeurs = await trouverInscriptionsSoeurs(
    inscription.etudiantId,
    inscription.niveau.parcours.formationId
  );
  const idsInscriptionsSoeurs = inscriptionsSoeurs.map((i: { id: string }) => i.id);

  const notesBrutes = await prisma.note.findMany({
    where: { inscriptionId: { in: idsInscriptionsSoeurs }, coursId: { in: idsCoursDuSemestre } },
  });

  const PRIORITE_STATUT: Record<string, number> = { VALIDEE: 3, EN_ATTENTE_SESSION_2: 2, NON_VALIDEE: 1 };
  const meilleureNoteParCours = new Map<string, (typeof notesBrutes)[number]>();
  for (const n of notesBrutes as (typeof notesBrutes)[number][]) {
    const actuelle = meilleureNoteParCours.get(n.coursId);
    const prioriteActuelle = actuelle?.statutValidation ? PRIORITE_STATUT[actuelle.statutValidation] ?? 0 : 0;
    const prioriteNouvelle = n.statutValidation ? PRIORITE_STATUT[n.statutValidation] ?? 0 : 0;
    if (!actuelle || prioriteNouvelle > prioriteActuelle) {
      meilleureNoteParCours.set(n.coursId, n);
    }
  }

  const groupesUEBrut = uesDuSemestre.map((ue: (typeof uesDuSemestre)[number]) => {
    const coursDeCetteUE = coursPourCetteInscription(ue);
    const moyennesCoursNumeriques = coursDeCetteUE.map((cours: { id: string }) => {
      const note = meilleureNoteParCours.get(cours.id);
      if (note?.valeur == null) return null;
      const brut = note.valeur as unknown as { toNumber?: () => number };
      return typeof brut.toNumber === 'function' ? brut.toNumber() : Number(note.valeur);
    });
    const estDispenseParCours = coursDeCetteUE.map((cours: { id: string }) => idsCoursDispenses.has(cours.id));
    const moyenneUE = calculerMoyenneUE(moyennesCoursNumeriques);
    return { ueId: ue.id, ueCredits: ue.credits, moyenneUE, moyennesCoursNumeriques, estDispenseParCours };
  });

  const moyenneSemestre = calculerMoyenneSemestre(
    groupesUEBrut.map((g: (typeof groupesUEBrut)[number]) => ({ moyenne: g.moyenneUE, credits: g.ueCredits }))
  );

  const statutsUE: (StatutValidationUE | null)[] = groupesUEBrut.map((g: (typeof groupesUEBrut)[number]) =>
    determinerStatutUE(g.moyenneUE, g.moyennesCoursNumeriques, moyenneSemestre, g.estDispenseParCours)
  );

  return {
    semestreOrdre: semestre.ordre,
    semestreLibelle: semestre.libelle,
    moyenneSemestre,
    statutsUE,
  };
}

/**
 * Décision de passage à l'année suivante pour un étudiant, un niveau et une
 * année universitaire donnés. Une seule inscription couvre maintenant toute
 * l'année (S1 et S2 ensemble) — on la retrouve une fois, puis on calcule
 * son détail pour chacun des deux semestres du niveau séparément, en
 * filtrant ses notes par les cours de chaque semestre.
 */
export async function obtenirPassageAnnee(etudiantId: string, anneeUniversitaireId: string, niveauId: string) {
  const inscription = await prisma.inscription.findFirst({
    where: { etudiantId, anneeUniversitaireId, niveauId },
  });

  if (!inscription) {
    throw new ErreurNonTrouve('Inscription pour ce niveau et cette année');
  }

  const semestresDuNiveau = await prisma.semestre.findMany({
    where: { niveauId },
    orderBy: { ordre: 'asc' },
  });

  const semestreS1 = semestresDuNiveau.find((s: (typeof semestresDuNiveau)[number]) => s.ordre === 1) ?? null;
  const semestreS2 = semestresDuNiveau.find((s: (typeof semestresDuNiveau)[number]) => s.ordre === 2) ?? null;

  const detailS1 = semestreS1 ? await calculerDetailInscription(inscription.id, semestreS1.id) : null;
  const detailS2 = semestreS2 ? await calculerDetailInscription(inscription.id, semestreS2.id) : null;

  const moyenneAnnuelle = calculerMoyenneAnnuelle(
    detailS1?.moyenneSemestre ?? null,
    detailS2?.moyenneSemestre ?? null
  );

  const toutesLesUE = [...(detailS1?.statutsUE ?? []), ...(detailS2?.statutsUE ?? [])];
  const statutPassage = determinerPassageAnnee(toutesLesUE, moyenneAnnuelle);

  return {
    semestres: {
      s1: detailS1 ? { libelle: detailS1.semestreLibelle, moyenne: detailS1.moyenneSemestre } : null,
      s2: detailS2 ? { libelle: detailS2.semestreLibelle, moyenne: detailS2.moyenneSemestre } : null,
    },
    moyenneAnnuelle,
    statutPassage,
  };
}

/**
 * Rassemble les données nécessaires au PDF d'un Terme — le nom de la
 * classe, et pour chaque cours réellement affecté, son titre, son code,
 * le cycle et la liste des étudiants (même détail que l'écran de saisie).
 * Séparé de la génération du PDF elle-même (voir notes.pdf.ts), qui ne
 * fait que mettre en page ce qui est déjà calculé ici.
 */
export async function genererDonneesNotesTerme(classeId: string, terme: string | null) {
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
    const { cycle, etudiants } = await obtenirNotesCoursPourClasse(classeId, coursResume.id);
    cours.push({ code: coursResume.code, titre: coursResume.titre, cycle, etudiants });
  }

  return { classeNom: classe.nom, cours };
}
