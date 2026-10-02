import prisma from '../../shared/database/prismaClient';
import { ErreurNonTrouve, ErreurDonneesInvalides } from '../../shared/erreurs/ErreurMetier';
import {
  calculerMoyenneUE,
  determinerStatutUE,
  calculerMoyenneSemestre,
  determinerStatutSemestre,
  calculerMoyenneAnnuelle,
  determinerPassageAnnee,
  StatutValidationUE,
} from '../notes/moteurCalcul.service';
import { calculerDetailInscription } from '../notes/notes.service';

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
 * Convertit une valeur Decimal (ou déjà number) en number simple, pour les
 * fonctions de calcul — distinct de la valeur affichée, qui garde son
 * format d'origine (Decimal/string) pour l'écran.
 */
function versNumeroSimple(valeur: unknown): number | null {
  if (valeur == null) return null;
  const brut = valeur as { toNumber?: () => number };
  return typeof brut.toNumber === 'function' ? brut.toNumber() : Number(valeur);
}

/**
 * Génère le bulletin de tous les étudiants d'une classe, les matières
 * regroupées par UE : pour chaque UE, sa moyenne et son statut de
 * validation, et pour chaque étudiant, sa moyenne de semestre pondérée par
 * les crédits des UE.
 *
 * Si le semestre actuellement actif de la classe est le SECOND de son
 * niveau (S2), le bulletin inclut aussi la moyenne annuelle et la décision
 * de passage — en réutilisant calculerDetailInscription (notes.service.ts)
 * pour S1, déjà vérifiée par le calcul de passage d'année. Absent tant que
 * la classe est encore sur S1 : l'année n'est pas encore terminée, une
 * moyenne annuelle n'aurait pas de sens.
 */
export async function genererBulletinClasse(classeId: string) {
  const classe = await prisma.classe.findUnique({
    where: { id: classeId },
    include: {
      parcours: { include: { formation: true } },
      niveau: true,
      semestreActif: true,
      anneeUniversitaire: true,
    },
  });

  if (!classe) {
    throw new ErreurNonTrouve('Classe');
  }

  if (!classe.parcours.formation.cycle) {
    throw new ErreurDonneesInvalides(
      `Le cycle (Licence/Master) n'est pas configuré pour la formation "${classe.parcours.formation.nom}".`
    );
  }
  const cycle = classe.parcours.formation.cycle;
  const typesAConsiderer = cycle === 'LICENCE' ? TYPES_VALIDES_LICENCE : TYPES_VALIDES_MASTER;

  // Sommes-nous sur le dernier semestre du niveau ? Si oui, on aura besoin
  // du premier semestre pour calculer la moyenne annuelle en complément.
  const estDernierSemestre = classe.semestreActif.ordre === 2;
  const semestreS1 = estDernierSemestre
    ? await prisma.semestre.findFirst({ where: { niveauId: classe.niveauId, ordre: 1 } })
    : null;

  // Fin de cycle (M2 en Master, L3 en Licence) : aucun niveau suivant
  // n'existe sous ce même parcours. Le libellé affiché au dernier
  // semestre en dépend ("Année validée" plutôt que "Passage accordé"),
  // même si la décision elle-même (déjà calculée ci-dessous) ne change
  // en rien.
  const estFinDeCycle = !(await prisma.niveau.findFirst({
    where: { parcoursId: classe.niveau.parcoursId, ordre: { gt: classe.niveau.ordre } },
  }));

  // Les UE du semestre ACTUELLEMENT ACTIF de la classe, pas de la classe
  // elle-même (qui couvre maintenant S1 et S2 ensemble) — le bulletin ne
  // montre que la phase en cours, jamais les deux mélangées.
  const uesDuSemestre = await prisma.uE.findMany({
    where: { semestreId: classe.semestreActifId },
    include: { cours: { orderBy: { code: 'asc' } } },
    orderBy: { code: 'asc' },
  });

  const inscriptions = await prisma.inscription.findMany({
    where: { classeId, statutInscription: 'ACTIVE', etudiant: { statut: { not: 'BLOQUE' } } },
    include: {
      etudiant: true,
      choixElectifs: { include: { cours: true } },
    },
    orderBy: { etudiant: { nom: 'asc' } },
  });

  // Une matière validée sous une inscription plus ancienne (un autre
  // niveau, une année précédente) reste connue comme validée ici, avec
  // TOUT son détail d'origine — composantes (y compris une Session 2 déjà
  // faite) et absences — le bulletin ne doit jamais redemander ce qui est
  // déjà acquis ailleurs. On retient donc, pour chaque (étudiant, cours),
  // non seulement le meilleur résultat, mais aussi DE QUELLE inscription
  // il vient, pour aller y chercher son détail complet plutôt que celui,
  // vide, de l'inscription courante.
  const formationId = classe.parcours.formationId;
  const inscriptionsSoeursToutes = await prisma.inscription.findMany({
    where: { etudiantId: { in: inscriptions.map((i: (typeof inscriptions)[number]) => i.etudiantId) }, niveau: { parcours: { formationId } } },
    select: { id: true, etudiantId: true },
  });
  const idsInscriptionsSoeurs = inscriptionsSoeursToutes.map((i: { id: string }) => i.id);
  const idInscriptionVersEtudiantId = new Map(
    inscriptionsSoeursToutes.map((i: { id: string; etudiantId: string }) => [i.id, i.etudiantId])
  );

  const [toutesLesNotesSoeurs, toutesLesComposantesSoeurs, toutesLesAbsencesSoeurs, toutesLesAffectationsSoeurs] =
    await Promise.all([
      prisma.note.findMany({ where: { inscriptionId: { in: idsInscriptionsSoeurs } } }),
      prisma.evaluationComposante.findMany({ where: { inscriptionId: { in: idsInscriptionsSoeurs } } }),
      prisma.absence.findMany({ where: { inscriptionId: { in: idsInscriptionsSoeurs }, estAbsent: true } }),
      prisma.affectationCours.findMany({ where: { inscriptionId: { in: idsInscriptionsSoeurs }, dispense: true } }),
    ]);

  const PRIORITE_STATUT: Record<string, number> = { VALIDEE: 3, EN_ATTENTE_SESSION_2: 2, NON_VALIDEE: 1 };
  const meilleureNoteParEtudiantEtCours = new Map<
    string,
    { note: (typeof toutesLesNotesSoeurs)[number]; inscriptionId: string }
  >();
  for (const note of toutesLesNotesSoeurs as (typeof toutesLesNotesSoeurs)[number][]) {
    const etudiantId = idInscriptionVersEtudiantId.get(note.inscriptionId);
    if (!etudiantId) continue;
    const cle = `${etudiantId}::${note.coursId}`;
    const actuelle = meilleureNoteParEtudiantEtCours.get(cle);
    const prioriteActuelle = actuelle?.note.statutValidation ? PRIORITE_STATUT[actuelle.note.statutValidation] ?? 0 : 0;
    const prioriteNouvelle = note.statutValidation ? PRIORITE_STATUT[note.statutValidation] ?? 0 : 0;
    if (!actuelle || prioriteNouvelle > prioriteActuelle) {
      meilleureNoteParEtudiantEtCours.set(cle, { note, inscriptionId: note.inscriptionId });
    }
  }

  const bulletins = await Promise.all(
    inscriptions.map(async (inscription: (typeof inscriptions)[number]) => {
    // --- Passe 1 : moyennes brutes de chaque UE, sans statut pour l'instant ---
    // Le statut d'une UE peut dépendre de la moyenne de semestre (compensation),
    // donc on doit d'abord connaître toutes les moyennes d'UE avant de
    // déterminer le statut de la moindre d'entre elles.
    const groupesUEBrut = uesDuSemestre.map((ue: (typeof uesDuSemestre)[number]) => {
      // Une UE optionnelle n'a, pour CET étudiant, que le cours qu'il a
      // choisi (voir ChoixElectif) — jamais tous les cours électifs qui
      // pourraient exister sous cette UE (d'autres étudiants ont pu choisir
      // différemment). Sans choix encore fait, la liste reste vide : la
      // moyenne de l'UE reste "non calculable" jusqu'à ce qu'un choix soit
      // assigné, exactement comme un cours obligatoire pas encore noté.
      const coursDeCetteUEPourCetEtudiant =
        ue.nature === 'OPTIONNELLE'
          ? (() => {
              const choix = inscription.choixElectifs.find(
                (c: (typeof inscription.choixElectifs)[number]) => c.ueId === ue.id
              );
              return choix ? [choix.cours] : [];
            })()
          : ue.cours;

      const lignesCours = coursDeCetteUEPourCetEtudiant.map((cours: (typeof ue.cours)[number]) => {
        const meilleureInfo = meilleureNoteParEtudiantEtCours.get(`${inscription.etudiantId}::${cours.id}`);
        const note = meilleureInfo?.note;
        // Le détail (composantes, absences) vient de LA MÊME inscription
        // que le résultat retenu — jamais de l'inscription courante si le
        // résultat, lui, vient d'ailleurs : les deux doivent rester
        // cohérents entre eux, jamais mélangés entre deux inscriptions
        // différentes.
        const inscriptionIdSource = meilleureInfo?.inscriptionId ?? inscription.id;
        const composantesDuCours = toutesLesComposantesSoeurs.filter(
          (c: (typeof toutesLesComposantesSoeurs)[number]) => c.inscriptionId === inscriptionIdSource && c.coursId === cours.id
        );
        const nombreAbsences = toutesLesAbsencesSoeurs.filter(
          (a: (typeof toutesLesAbsencesSoeurs)[number]) => a.inscriptionId === inscriptionIdSource && a.coursId === cours.id
        ).length;

        // Une dispense vient TOUJOURS de la même inscription que le
        // résultat retenu (jamais héritée d'ailleurs) — voir la même
        // règle dans notes.service.ts.
        const affectationDispensee = (
          toutesLesAffectationsSoeurs as { inscriptionId: string; coursId: string; universiteOrigine: string | null }[]
        ).find((a) => a.inscriptionId === inscriptionIdSource && a.coursId === cours.id);

        const composantes: Record<string, number | null> = {};
        for (const type of typesAConsiderer) {
          composantes[type] = extraireValeur(composantesDuCours, type);
        }

        return {
          coursCode: cours.code,
          coursTitre: cours.titre,
          composantes,
          moyenne: note?.valeur ?? null,
          statutValidation: note?.statutValidation ?? null,
          nombreAbsences,
          dispense: !!affectationDispensee,
          universiteOrigine: affectationDispensee?.universiteOrigine ?? null,
        };
      });

      const moyennesCoursNumeriques = lignesCours.map((l: (typeof lignesCours)[number]) =>
        versNumeroSimple(l.moyenne)
      );
      const moyenneUE = calculerMoyenneUE(moyennesCoursNumeriques);

      return {
        ueCode: ue.code,
        ueCredits: ue.credits,
        ueNature: ue.nature,
        moyenneUE,
        moyennesCoursNumeriques,
        cours: lignesCours,
      };
    });

    // --- Moyenne de semestre, à partir des moyennes brutes d'UE ---
    const moyenneSemestre = calculerMoyenneSemestre(
      groupesUEBrut.map((g: (typeof groupesUEBrut)[number]) => ({ moyenne: g.moyenneUE, credits: g.ueCredits }))
    );

    // --- Passe 2 : statut de chaque UE, maintenant que la moyenne de
    // semestre (nécessaire à la compensation) est connue ---
    const groupesUE = groupesUEBrut.map((g: (typeof groupesUEBrut)[number]) => ({
      ueCode: g.ueCode,
      ueCredits: g.ueCredits,
      ueNature: g.ueNature,
      moyenneUE: g.moyenneUE,
      statutUE: determinerStatutUE(g.moyenneUE, g.moyennesCoursNumeriques, moyenneSemestre),
      cours: g.cours,
    }));

    const statutSemestre = determinerStatutSemestre(
      moyenneSemestre,
      groupesUEBrut.map((g: (typeof groupesUEBrut)[number]) => g.moyenneUE)
    );

    // Moyenne annuelle et décision de passage, uniquement si on est sur le
    // dernier semestre (S2) — réutilise calculerDetailInscription pour S1,
    // déjà vérifiée par ailleurs pour le calcul de passage d'année.
    let moyenneAnnuelle: number | null = null;
    let statutPassage: 'PASSAGE_ACCORDE' | 'PASSAGE_NON_ACCORDE' | null = null;

    if (estDernierSemestre && semestreS1) {
      const detailS1 = await calculerDetailInscription(inscription.id, semestreS1.id);
      moyenneAnnuelle = calculerMoyenneAnnuelle(detailS1.moyenneSemestre, moyenneSemestre);

      const toutesLesUE: (StatutValidationUE | null)[] = [
        ...detailS1.statutsUE,
        ...groupesUE.map((g: (typeof groupesUE)[number]) => g.statutUE),
      ];
      statutPassage = determinerPassageAnnee(toutesLesUE, moyenneAnnuelle);
    }

    return {
      etudiant: {
        matricule: inscription.etudiant.matricule,
        nom: inscription.etudiant.nom,
      },
      ue: groupesUE,
      moyenneSemestre,
      statutSemestre,
      moyenneAnnuelle,
      statutPassage,
    };
  })
  );

  return {
    cycle,
    estFinDeCycle,
    classe: {
      nom: classe.nom,
      parcours: classe.parcours.nom,
      niveau: classe.niveau.libelle,
      semestreActif: classe.semestreActif.libelle,
      anneeUniversitaire: classe.anneeUniversitaire.libelle,
    },
    bulletins,
  };
}

/**
 * Le bulletin PROPRE d'un étudiant pour un niveau donné — jamais le
 * programme théorique complet de ce niveau, seulement les matières où
 * CET étudiant a un vrai résultat (dispensé ou non). Pensé pour un
 * étudiant transféré dont une dispense cible un niveau qu'il n'a
 * jamais réellement suivi (aucune inscription là-bas, aucune classe) :
 * générer "le bulletin de la classe" de ce niveau ne le trouverait
 * jamais, puisque cette génération parcourt les étudiants réellement
 * inscrits. Ici, on part de l'étudiant, pas de la classe — et on
 * n'affiche jamais une UE où il n'a rien, plutôt qu'une ligne vide.
 *
 * Aucune moyenne générale ni décision de passage : ce document
 * documente ce qui a été reconnu pour ce niveau, jamais un verdict sur
 * un programme que l'étudiant n'a pas suivi dans son ensemble.
 */
export async function genererBulletinIndividuel(inscriptionId: string, niveauId: string) {
  const inscription = await prisma.inscription.findUnique({
    where: { id: inscriptionId },
    include: { etudiant: true, anneeUniversitaire: true },
  });
  if (!inscription) {
    throw new ErreurNonTrouve('Inscription');
  }

  const niveau = await prisma.niveau.findUnique({
    where: { id: niveauId },
    include: { parcours: { include: { formation: true } } },
  });
  if (!niveau) {
    throw new ErreurNonTrouve('Niveau');
  }
  if (!niveau.parcours.formation.cycle) {
    throw new ErreurDonneesInvalides(
      `Le cycle (Licence/Master) n'est pas configuré pour la formation "${niveau.parcours.formation.nom}".`
    );
  }
  const cycle = niveau.parcours.formation.cycle;
  const typesAConsiderer = cycle === 'LICENCE' ? TYPES_VALIDES_LICENCE : TYPES_VALIDES_MASTER;

  const uesDuNiveau = await prisma.uE.findMany({
    where: { semestre: { niveauId } },
    include: { semestre: true, cours: true },
    orderBy: [{ semestre: { ordre: 'asc' } }, { code: 'asc' }],
  });

  const idsCoursDuNiveau = uesDuNiveau.flatMap((ue: (typeof uesDuNiveau)[number]) =>
    ue.cours.map((c: { id: string }) => c.id)
  );

  const affectations = await prisma.affectationCours.findMany({
    where: { inscriptionId, coursId: { in: idsCoursDuNiveau } },
  });
  const choixElectifs = await prisma.choixElectif.findMany({
    where: { inscriptionId, coursId: { in: idsCoursDuNiveau } },
  });
  const notes = await prisma.note.findMany({
    where: { inscriptionId, coursId: { in: idsCoursDuNiveau } },
  });
  const composantesToutes = await prisma.evaluationComposante.findMany({
    where: { inscriptionId, coursId: { in: idsCoursDuNiveau } },
  });

  const idsCoursAvecResultat = new Set([
    ...affectations.map((a: { coursId: string }) => a.coursId),
    ...choixElectifs.map((c: { coursId: string }) => c.coursId),
  ]);

  interface MatiereComposee {
    semestre: string;
    ueCode: string;
    coursCode: string;
    coursTitre: string;
    composantes: Record<string, number | null>;
    moyenne: string | null;
    statutValidation: string | null;
  }

  interface MatiereDispensee {
    semestre: string;
    ueCode: string;
    coursCode: string;
    coursTitre: string;
    universiteOrigine: string | null;
    statutValidation: string | null;
  }

  const matieresComposees: MatiereComposee[] = [];
  const matieresDispensees: MatiereDispensee[] = [];

  for (const ue of uesDuNiveau as (typeof uesDuNiveau)[number][]) {
    for (const cours of ue.cours as { id: string; code: string; titre: string }[]) {
      if (!idsCoursAvecResultat.has(cours.id)) continue;

      const affectation = affectations.find((a: { coursId: string }) => a.coursId === cours.id);
      const note = notes.find((n: { coursId: string }) => n.coursId === cours.id);

      if (affectation?.dispense) {
        matieresDispensees.push({
          semestre: ue.semestre.libelle,
          ueCode: ue.code,
          coursCode: cours.code,
          coursTitre: cours.titre,
          universiteOrigine: affectation.universiteOrigine,
          statutValidation: note?.statutValidation ?? null,
        });
        continue;
      }

      const composantesDuCours = composantesToutes.filter(
        (c: { coursId: string }) => c.coursId === cours.id
      );
      const composantes: Record<string, number | null> = {};
      for (const type of typesAConsiderer) {
        composantes[type] = extraireValeur(composantesDuCours, type);
      }

      matieresComposees.push({
        semestre: ue.semestre.libelle,
        ueCode: ue.code,
        coursCode: cours.code,
        coursTitre: cours.titre,
        composantes,
        moyenne: note?.valeur != null ? String(note.valeur) : null,
        statutValidation: note?.statutValidation ?? null,
      });
    }
  }

  return {
    etudiant: { matricule: inscription.etudiant.matricule, nom: inscription.etudiant.nom },
    niveau: niveau.libelle,
    parcours: niveau.parcours.nom,
    formation: niveau.parcours.formation.nom,
    anneeUniversitaire: inscription.anneeUniversitaire.libelle,
    cycle,
    matieresComposees,
    matieresDispensees,
  };
}
