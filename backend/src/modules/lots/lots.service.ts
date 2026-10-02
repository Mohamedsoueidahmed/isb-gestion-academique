import prisma from '../../shared/database/prismaClient';
import type { Terme } from '@prisma/client';
import { ErreurNonTrouve, ErreurDonneesInvalides } from '../../shared/erreurs/ErreurMetier';

const PLAFOND_COURS_ACTIFS = 5;
const TAILLE_LOT_SOUHAITS_MIN = 2;
const TAILLE_LOT_SOUHAITS_MAX = 5;

type CoursAvecPosition = {
  id: string;
  code: string;
  titre: string;
  prerequisCode: string | null;
  heures: number | null;
  estElectif: boolean;
  ue: { id: string; code: string; finDeCycle: boolean; semestre: { libelle: string; ordre: number; niveau: { ordre: number } } };
};

/**
 * Toutes les inscriptions d'un étudiant sous une même formation — jamais
 * Licence et Master mélangés, puisque ce sont deux formations distinctes.
 * Un étudiant en L2 peut avoir une inscription L1 (précédente) et une
 * inscription L2 (actuelle) sous la MÊME formation Licence — les deux
 * comptent comme sœurs l'une de l'autre. Partagé par tout calcul qui doit
 * voir l'historique complet d'un étudiant, pas seulement son inscription
 * du moment.
 */
export async function trouverInscriptionsSoeurs(etudiantId: string, formationId: string) {
  return prisma.inscription.findMany({
    where: { etudiantId, niveau: { parcours: { formationId } } },
    include: { niveau: true },
  });
}

/**
 * Toutes les données réelles d'une inscription, pour un ensemble de cours
 * donné, récupérées en quatre requêtes group ées — jamais une requête par
 * cours. C'est le cœur de la correction de performance : tout le reste de
 * ce fichier calcule en mémoire à partir de ces quatre collections, sans
 * plus jamais retourner vers la base pour une vérification isolée.
 */
interface DonneesInscription {
  notes: Map<string, string | null>; // coursId -> statutValidation
  affectations: Set<string>; // coursId affecté (réel)
  deblocages: Set<string>; // coursId débloqué manuellement
  souhaits: Set<string>; // coursId souhaité
}

// Une matière validée une fois, sous n'importe quelle inscription sœur,
// reste validée pour toujours — jamais écrasée par un autre résultat
// trouvé ailleurs. En attente de Session 2 passe avant "non validée sans
// rien d'autre", puisque le résultat n'est simplement pas encore fixé.
const PRIORITE_STATUT: Record<string, number> = { VALIDEE: 3, EN_ATTENTE_SESSION_2: 2, NON_VALIDEE: 1 };

function meilleurStatut(actuel: string | null | undefined, nouveau: string | null): string | null {
  if (!nouveau) return actuel ?? null;
  if (!actuel) return nouveau;
  return (PRIORITE_STATUT[nouveau] ?? 0) > (PRIORITE_STATUT[actuel] ?? 0) ? nouveau : actuel;
}

/**
 * Charge les données réelles à travers TOUTES les inscriptions sœurs
 * fournies, pas une seule — une matière validée en L1 doit rester connue
 * comme validée une fois l'étudiant en L2, sous une inscription
 * différente. Les affectations/souhaits/déblocages sont une simple union
 * (un cours touché sous n'importe quelle inscription sœur compte) ; les
 * notes suivent la priorité de meilleurStatut plutôt qu'une union brute,
 * puisqu'un même cours peut avoir un résultat différent selon la reprise.
 */
async function chargerDonneesInscription(inscriptionIds: string[], coursIds: string[]): Promise<DonneesInscription> {
  const [notes, affectations, deblocages, souhaits] = await Promise.all([
    prisma.note.findMany({ where: { inscriptionId: { in: inscriptionIds }, coursId: { in: coursIds } } }),
    prisma.affectationCours.findMany({ where: { inscriptionId: { in: inscriptionIds }, coursId: { in: coursIds } } }),
    prisma.deblocagePrerequis.findMany({ where: { inscriptionId: { in: inscriptionIds }, coursId: { in: coursIds } } }),
    prisma.souhaitCours.findMany({ where: { inscriptionId: { in: inscriptionIds }, coursId: { in: coursIds } } }),
  ]);

  const notesMap = new Map<string, string | null>();
  for (const n of notes as { coursId: string; statutValidation: string | null }[]) {
    notesMap.set(n.coursId, meilleurStatut(notesMap.get(n.coursId), n.statutValidation));
  }

  return {
    notes: notesMap,
    affectations: new Set(affectations.map((a: { coursId: string }) => a.coursId)),
    deblocages: new Set(deblocages.map((d: { coursId: string }) => d.coursId)),
    souhaits: new Set(souhaits.map((s: { coursId: string }) => s.coursId)),
  };
}

function estValideSync(donnees: DonneesInscription, coursId: string): boolean {
  return donnees.notes.get(coursId) === 'VALIDEE';
}

function estEnAttenteSync(donnees: DonneesInscription, coursId: string): boolean {
  if (!donnees.affectations.has(coursId)) return false;
  const statut = donnees.notes.get(coursId);
  if (!statut) return true; // affecté, mais rien saisi encore
  return statut === 'EN_ATTENTE_SESSION_2';
}

function estEchoueSync(donnees: DonneesInscription, coursId: string): boolean {
  return donnees.notes.get(coursId) === 'NON_VALIDEE';
}

function estDebloqueSync(donnees: DonneesInscription, coursId: string): boolean {
  return donnees.deblocages.has(coursId);
}

/**
 * Le prérequis d'un cours (un simple code texte, ex. "MATH200") résolu en
 * un vrai Cours — entièrement en mémoire, à partir de la carte code→cours
 * déjà construite pour ce parcours. Jamais de requête à la base ici.
 */
function resoudrePrerequisSync(coursParCode: Map<string, CoursAvecPosition>, cours: CoursAvecPosition) {
  if (!cours.prerequisCode) return null;
  return coursParCode.get(cours.prerequisCode) ?? null;
}

function estPrerequisSatisfaitSync(
  donnees: DonneesInscription,
  coursParCode: Map<string, CoursAvecPosition>,
  cours: CoursAvecPosition
): boolean {
  const prerequis = resoudrePrerequisSync(coursParCode, cours);
  if (!prerequis) return true;
  return estValideSync(donnees, prerequis.id);
}

/**
 * Tous les cours NON électifs du parcours d'une inscription — le système
 * de lots flexibles ne concerne que les cours "normaux" ; les électifs
 * gardent leur propre mécanisme de choix (ChoixElectif), inchangé.
 */
async function listerCoursDuParcours(parcoursId: string): Promise<CoursAvecPosition[]> {
  return prisma.cours.findMany({
    where: {
      estElectif: false,
      ue: { semestre: { niveau: { parcoursId } } },
    },
    include: { ue: { include: { semestre: { include: { niveau: true } } } } },
  });
}

/**
 * Une UE de fin de cycle (Stage, ou Stage/Mémoire) ne devient disponible
 * qu'une fois TOUT le reste du cycle validé — pas seulement dans
 * l'inscription actuelle, mais à travers TOUTES les inscriptions de cet
 * étudiant sous la même formation. Un Master a deux inscriptions
 * séparées pour le même programme (le tronc commun, puis la
 * spécialisation) : ignorer l'une des deux laisserait le stage se
 * débloquer sans que le tronc commun soit réellement fini.
 *
 * Group é par inscription (typiquement 1 à 2 pour un même étudiant) —
 * chaque inscription ne coûte qu'une poignée de requêtes, jamais une par
 * cours.
 */
async function resteDuCycleEstValide(etudiantId: string, formationId: string): Promise<boolean> {
  const inscriptions = await trouverInscriptionsSoeurs(etudiantId, formationId);

  for (const inscription of inscriptions) {
    const coursDuParcours = await listerCoursDuParcours(inscription.niveau.parcoursId);
    const coursNonFinDeCycle = coursDuParcours.filter((c) => !c.ue.finDeCycle);
    if (coursNonFinDeCycle.length === 0) continue;

    const notesValidees = await prisma.note.findMany({
      where: {
        inscriptionId: inscription.id,
        coursId: { in: coursNonFinDeCycle.map((c) => c.id) },
        statutValidation: 'VALIDEE',
      },
      select: { coursId: true },
    });
    const idsValides = new Set(notesValidees.map((n: { coursId: string }) => n.coursId));

    for (const cours of coursNonFinDeCycle) {
      if (!idsValides.has(cours.id)) return false;
    }
  }
  return true;
}

/**
 * Combien de cours cet étudiant a-t-il RÉELLEMENT en cours, sans résultat
 * final — le plafond de 5 se vérifie toujours contre ce nombre, jamais
 * contre les souhaits, qui eux ne coûtent aucune place.
 */
/**
 * Combien de cours cet étudiant a-t-il RÉELLEMENT en cours, sans résultat
 * final — à travers TOUTES ses inscriptions sœurs, pas seulement celle du
 * moment : le plafond de 5 est une limite sur l'étudiant lui-même, pas
 * remise à zéro à chaque nouveau niveau. Un même cours affecté sous deux
 * inscriptions sœurs différentes (repris après un échec) ne compte
 * qu'une fois. Le plafond se vérifie toujours contre ce nombre, jamais
 * contre les souhaits, qui eux ne coûtent aucune place.
 */
async function compterCoursActifs(inscriptionIds: string[]): Promise<number> {
  const affectations = await prisma.affectationCours.findMany({ where: { inscriptionId: { in: inscriptionIds } } });
  if (affectations.length === 0) return 0;

  const coursIdsUniques: string[] = Array.from(new Set(affectations.map((a: { coursId: string }) => a.coursId)));
  const notes = await prisma.note.findMany({
    where: { inscriptionId: { in: inscriptionIds }, coursId: { in: coursIdsUniques } },
  });

  const statutParCours = new Map<string, string | null>();
  for (const n of notes as { coursId: string; statutValidation: string | null }[]) {
    statutParCours.set(n.coursId, meilleurStatut(statutParCours.get(n.coursId), n.statutValidation));
  }

  let compte = 0;
  for (const coursId of coursIdsUniques) {
    const statut = statutParCours.get(coursId);
    if (!statut || statut === 'EN_ATTENTE_SESSION_2') {
      compte += 1;
    }
  }
  return compte;
}

/**
 * Rassemble tout ce qu'il faut pour calculer l'éligibilité ou l'état
 * complet d'une inscription, en une seule fois : le parcours, tous ses
 * cours, la carte code→cours pour les prérequis, la fenêtre
 * d'élargissement, l'état de fin de cycle, et les données réelles de
 * l'inscription. Partagé entre listerCoursEligibles et
 * obtenirEtatParcoursFlexible pour ne jamais calculer deux fois la même
 * chose.
 */
async function rassemblerContexteInscription(inscriptionId: string) {
  const inscription = await prisma.inscription.findUnique({
    where: { id: inscriptionId },
    include: { niveau: { include: { parcours: true } } },
  });
  if (!inscription) {
    throw new ErreurNonTrouve('Inscription');
  }

  const parcoursId = inscription.niveau.parcoursId;
  const formationId = inscription.niveau.parcours.formationId;
  const tousLesCours = await listerCoursDuParcours(parcoursId);
  const coursParCode = new Map(tousLesCours.map((c) => [c.code, c]));

  const inscriptionsSoeurs = await trouverInscriptionsSoeurs(inscription.etudiantId, formationId);
  const idsInscriptionsSoeurs = inscriptionsSoeurs.map((i: { id: string }) => i.id);

  const donnees = await chargerDonneesInscription(
    idsInscriptionsSoeurs,
    tousLesCours.map((c) => c.id)
  );

  const cycleTermine = await resteDuCycleEstValide(inscription.etudiantId, formationId);

  return { inscription, parcoursId, tousLesCours, coursParCode, donnees, cycleTermine, idsInscriptionsSoeurs };
}

/**
 * Les cours qu'un étudiant pourrait souhaiter ou se voir affecter
 * directement : ni déjà validés, ni déjà réellement en cours, et dont le
 * prérequis (s'il y en a un) est satisfait. Le plafond de 5 ne s'applique
 * PAS ici — souhaiter ne coûte rien ; il s'applique au moment où le
 * souhait devient réel (ouverture).
 */
export async function listerCoursEligibles(inscriptionId: string) {
  const { tousLesCours, coursParCode, donnees, cycleTermine } = await rassemblerContexteInscription(inscriptionId);

  const eligibles = [];
  for (const cours of tousLesCours) {
    const valide = estValideSync(donnees, cours.id);
    const enAttente = estEnAttenteSync(donnees, cours.id);
    const debloqueManuel = estDebloqueSync(donnees, cours.id);
    const prerequisOk = debloqueManuel || estPrerequisSatisfaitSync(donnees, coursParCode, cours);
    const finDeCycleOk = debloqueManuel || !cours.ue.finDeCycle || cycleTermine;

    if (!valide && !enAttente && prerequisOk && finDeCycleOk) {
      eligibles.push(cours);
    }
  }

  return eligibles;
}

/**
 * Valide qu'un lot de coursIds est bien formé pour cet étudiant : taille
 * entre 2 et 5 (ou moins si vraiment peu de cours restent à souhaiter),
 * et chaque cours réellement éligible.
 */
async function validerLot(inscriptionId: string, coursIds: string[]): Promise<Set<string>> {
  const eligibles = await listerCoursEligibles(inscriptionId);
  const idsEligibles = new Set(eligibles.map((c) => c.id));

  const dejaSouhaites = await prisma.souhaitCours.findMany({ where: { inscriptionId } });
  const idsDejaSouhaites = new Set(dejaSouhaites.map((s: { coursId: string }) => s.coursId));
  const nombrePasEncoreSouhaites = eligibles.filter((c) => !idsDejaSouhaites.has(c.id)).length;

  const tailleMinReelle = Math.min(TAILLE_LOT_SOUHAITS_MIN, nombrePasEncoreSouhaites);
  if (coursIds.length < tailleMinReelle || coursIds.length > TAILLE_LOT_SOUHAITS_MAX) {
    throw new ErreurDonneesInvalides(
      `Un lot doit contenir entre ${tailleMinReelle} et ${TAILLE_LOT_SOUHAITS_MAX} cours (${coursIds.length} fourni(s)).`
    );
  }

  const nonEligibles = coursIds.filter((id) => !idsEligibles.has(id));
  if (nonEligibles.length > 0) {
    throw new ErreurDonneesInvalides(
      `${nonEligibles.length} cours demandé(s) ne sont pas (ou plus) éligibles pour cet étudiant.`
    );
  }

  return idsEligibles;
}

/**
 * Exprime un lot de souhaits pour un étudiant — jamais réel tant que
 * l'administration n'a pas ouvert le cours correspondant (voir
 * creerEtOuvrirLot), SAUF si un lot est déjà OUVERT sur ce cours précis :
 * dans ce cas, le souhait s'inscrit immédiatement, sans nouvelle
 * confirmation — le lot ouvert agit comme une porte restée ouverte.
 */
export async function exprimerLotSouhaits(inscriptionId: string, coursIds: string[]) {
  await validerLot(inscriptionId, coursIds);

  await prisma.$transaction(
    coursIds.map((coursId) =>
      prisma.souhaitCours.upsert({
        where: { inscriptionId_coursId: { inscriptionId, coursId } },
        update: {},
        create: { inscriptionId, coursId },
      })
    )
  );

  // Un cours déjà couvert par un lot OUVERT s'inscrit tout de suite, sans
  // attendre une nouvelle confirmation — sauf si l'étudiant est déjà au
  // plafond de 5, auquel cas le souhait reste simplement en attente.
  const inscription = await prisma.inscription.findUnique({
    where: { id: inscriptionId },
    include: { niveau: { include: { parcours: true } } },
  });
  if (!inscription) {
    throw new ErreurNonTrouve('Inscription');
  }
  const inscriptionsSoeurs = await trouverInscriptionsSoeurs(inscription.etudiantId, inscription.niveau.parcours.formationId);
  const idsInscriptionsSoeurs = inscriptionsSoeurs.map((i: { id: string }) => i.id);

  for (const coursId of coursIds) {
    const lotCoursOuvert = await prisma.lotCours.findFirst({
      where: { coursId, lot: { statut: 'OUVERT' } },
      include: { lot: true },
    });
    if (!lotCoursOuvert) continue;

    const nombreActifs = await compterCoursActifs(idsInscriptionsSoeurs);
    if (nombreActifs >= PLAFOND_COURS_ACTIFS) continue;

    const cours = await prisma.cours.findUnique({
      where: { id: coursId },
      include: { ue: { include: { semestre: { include: { niveau: true } } } } },
    });
    if (!cours) continue;
    const typeSuivi = determinerTypeSuivi(cours.ue.semestre.niveau.ordre, inscription.niveau.ordre);

    await prisma.$transaction([
      prisma.affectationCours.upsert({
        where: { inscriptionId_coursId: { inscriptionId, coursId } },
        update: {
          numeroLot: lotCoursOuvert.lot.numero,
          lotId: lotCoursOuvert.lotId,
          typeSuivi,
          terme: lotCoursOuvert.lot.terme,
        },
        create: {
          inscriptionId,
          coursId,
          numeroLot: lotCoursOuvert.lot.numero,
          lotId: lotCoursOuvert.lotId,
          typeSuivi,
          terme: lotCoursOuvert.lot.terme,
        },
      }),
      prisma.souhaitCours.deleteMany({ where: { inscriptionId, coursId } }),
    ]);
  }
}

export async function retirerSouhait(inscriptionId: string, coursId: string) {
  await prisma.souhaitCours.deleteMany({ where: { inscriptionId, coursId } });
}

export async function listerSouhaitsEtudiant(inscriptionId: string) {
  return prisma.souhaitCours.findMany({
    where: { inscriptionId },
    include: { cours: true },
  });
}

/**
 * Statistique de demande pour un groupe d'étudiants (typiquement, tous
 * ceux d'un même niveau) : pour chaque cours souhaité par AU MOINS un
 * étudiant du groupe, compte combien de VRAIS souhaits existent
 * actuellement.
 */
export async function obtenirStatistiquesDemande(inscriptionIds: string[]) {
  const souhaits = await prisma.souhaitCours.findMany({
    where: { inscriptionId: { in: inscriptionIds } },
    include: { cours: { include: { ue: { include: { semestre: true } } } } },
  });

  const compteurs = new Map<string, { cours: (typeof souhaits)[number]['cours']; nombre: number }>();
  for (const souhait of souhaits) {
    const existant = compteurs.get(souhait.coursId);
    if (existant) {
      existant.nombre += 1;
    } else {
      compteurs.set(souhait.coursId, { cours: souhait.cours, nombre: 1 });
    }
  }

  return Array.from(compteurs.values())
    .sort((a, b) => b.nombre - a.nombre)
    .map(({ cours, nombre }) => ({
      coursId: cours.id,
      code: cours.code,
      titre: cours.titre,
      ueCode: cours.ue.code,
      semestreLibelle: cours.ue.semestre.libelle,
      nombreSouhaits: nombre,
    }));
}

export async function obtenirStatistiquesDemandeParNiveau(niveauId: string) {
  const inscriptions = await prisma.inscription.findMany({
    where: { niveauId, statutInscription: 'ACTIVE', etudiant: { statut: { not: 'BLOQUE' } } },
    select: { id: true },
  });
  return obtenirStatistiquesDemande(inscriptions.map((i: { id: string }) => i.id));
}

/**
 * Détermine le type de suivi en comparant le niveau propre du cours à
 * celui de l'inscription qui le reçoit — jamais recalculé après coup,
 * une vraie photographie du moment où l'affectation est créée.
 */
function determinerTypeSuivi(ordreCours: number, ordreInscription: number): 'NORMAL' | 'ANTICIPE' | 'EN_RETARD' {
  if (ordreCours === ordreInscription) return 'NORMAL';
  return ordreCours > ordreInscription ? 'ANTICIPE' : 'EN_RETARD';
}

/**
 * Convertit tous les souhaits EXISTANTS sur un cours précis en vraies
 * affectations, pour un lot donné déjà créé — brique partagée entre la
 * création d'un lot (souhaits déjà là au moment de l'ouverture) et
 * l'auto-inscription dans exprimerLotSouhaits (souhaits arrivant APRÈS
 * que le lot soit déjà ouvert). SAUF pour un étudiant déjà au plafond de
 * 5, dont le souhait reste inchangé, en attente d'une place.
 */
async function convertirSouhaitsExistants(
  coursId: string,
  parcoursId: string,
  lot: { id: string; numero: number; terme: Terme | null }
) {
  const cours = await prisma.cours.findUnique({
    where: { id: coursId },
    include: { ue: { include: { semestre: { include: { niveau: true } } } } },
  });
  if (!cours) {
    throw new ErreurNonTrouve('Cours');
  }
  const ordreCours = cours.ue.semestre.niveau.ordre;

  const souhaits = await prisma.souhaitCours.findMany({
    where: { coursId, inscription: { niveau: { parcoursId } } },
    include: { inscription: { include: { etudiant: true, niveau: { include: { parcours: true } } } } },
  });

  const convertis = [];
  const laissesEnAttente = [];

  for (const souhait of souhaits) {
    const inscriptionsSoeurs = await trouverInscriptionsSoeurs(
      souhait.inscription.etudiantId,
      souhait.inscription.niveau.parcours.formationId
    );
    const nombreActifs = await compterCoursActifs(inscriptionsSoeurs.map((i: { id: string }) => i.id));
    if (nombreActifs >= PLAFOND_COURS_ACTIFS) {
      laissesEnAttente.push(souhait.inscription.etudiant);
      continue;
    }

    const typeSuivi = determinerTypeSuivi(ordreCours, souhait.inscription.niveau.ordre);

    await prisma.$transaction([
      prisma.affectationCours.upsert({
        where: { inscriptionId_coursId: { inscriptionId: souhait.inscriptionId, coursId } },
        update: { numeroLot: lot.numero, lotId: lot.id, typeSuivi, terme: lot.terme },
        create: {
          inscriptionId: souhait.inscriptionId,
          coursId,
          numeroLot: lot.numero,
          lotId: lot.id,
          typeSuivi,
          terme: lot.terme,
        },
      }),
      prisma.souhaitCours.delete({ where: { id: souhait.id } }),
    ]);
    convertis.push(souhait.inscription.etudiant);
  }

  return { convertis, laissesEnAttente };
}

/**
 * Crée un vrai lot, OUVERT, pour un ensemble précis de cours — remplace
 * l'ancien "confirmer le lot" ponctuel. Tant qu'il reste ouvert (voir
 * fermerLot), tout nouveau souhait sur un de ses cours s'inscrit
 * immédiatement (voir exprimerLotSouhaits) ; à sa création, les souhaits
 * déjà existants sur ces cours sont eux aussi convertis tout de suite.
 */
export async function creerEtOuvrirLot(niveauId: string, coursIds: string[], terme?: Terme) {
  const niveau = await prisma.niveau.findUnique({ where: { id: niveauId } });
  if (!niveau) {
    throw new ErreurNonTrouve('Niveau');
  }

  const dernierLot = await prisma.lot.findFirst({ where: { niveauId }, orderBy: { numero: 'desc' } });
  const numero = (dernierLot?.numero ?? 0) + 1;

  const lot = await prisma.lot.create({
    data: {
      niveauId,
      numero,
      terme: terme ?? null,
      cours: { create: coursIds.map((coursId) => ({ coursId })) },
    },
  });

  let convertis: { id: string; matricule: string; nom: string }[] = [];
  let laissesEnAttente: { id: string; matricule: string; nom: string }[] = [];

  for (const coursId of coursIds) {
    const resultat = await convertirSouhaitsExistants(coursId, niveau.parcoursId, lot);
    convertis = convertis.concat(resultat.convertis);
    laissesEnAttente = laissesEnAttente.concat(resultat.laissesEnAttente);
  }

  return { lot, convertis, laissesEnAttente };
}

/**
 * Ferme un lot — arrête les inscriptions automatiques FUTURES sur ses
 * cours, jamais rétroactif sur les étudiants déjà inscrits via ce lot.
 */
export async function fermerLot(lotId: string) {
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) {
    throw new ErreurNonTrouve('Lot');
  }
  return prisma.lot.update({
    where: { id: lotId },
    data: { statut: 'FERME', dateFermeture: new Date() },
  });
}

/**
 * Ajoute un cours à un lot déjà ouvert — sans repasser par la création
 * d'un nouveau lot. Les souhaits déjà exprimés sur ce cours sont
 * convertis tout de suite en vraies affectations, exactement comme à
 * la création du lot (voir creerEtOuvrirLot).
 */
export async function ajouterCoursAuLot(lotId: string, coursId: string) {
  const lot = await prisma.lot.findUnique({ where: { id: lotId }, include: { niveau: true } });
  if (!lot) {
    throw new ErreurNonTrouve('Lot');
  }
  if (lot.statut === 'FERME') {
    throw new ErreurDonneesInvalides('Ce lot est fermé. Impossible d\'y ajouter un cours.');
  }

  const dejaPresent = await prisma.lotCours.findUnique({ where: { lotId_coursId: { lotId, coursId } } });
  if (dejaPresent) {
    throw new ErreurDonneesInvalides('Ce cours fait déjà partie de ce lot.');
  }

  await prisma.lotCours.create({ data: { lotId, coursId } });

  const resultat = await convertirSouhaitsExistants(coursId, lot.niveau.parcoursId, lot);
  return { lot, ...resultat };
}

/**
 * Retire un cours d'un lot déjà ouvert. Bloque UNIQUEMENT si un
 * étudiant affecté par ce lot a déjà une composante de note saisie sur
 * ce cours (un vrai travail de notation existe déjà, jamais perdu
 * silencieusement). Sinon, le retrait est réel : chaque affectation
 * créée depuis ce lot est défaite, et le souhait d'origine de
 * l'étudiant redevient en attente (recréé, puisque la conversion
 * initiale avait supprimé l'ancien — voir convertirSouhaitsExistants) —
 * exactement comme s'il n'avait jamais été confirmé.
 */
export async function retirerCoursDuLot(lotId: string, coursId: string) {
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) {
    throw new ErreurNonTrouve('Lot');
  }
  if (lot.statut === 'FERME') {
    throw new ErreurDonneesInvalides('Ce lot est fermé. Impossible d\'y retirer un cours.');
  }

  const lotCours = await prisma.lotCours.findUnique({ where: { lotId_coursId: { lotId, coursId } } });
  if (!lotCours) {
    throw new ErreurNonTrouve('Ce cours dans ce lot');
  }

  const affectations = await prisma.affectationCours.findMany({ where: { lotId, coursId } });

  for (const affectation of affectations) {
    const composanteSaisie = await prisma.evaluationComposante.findFirst({
      where: { inscriptionId: affectation.inscriptionId, coursId, valeur: { not: null } },
    });
    if (composanteSaisie) {
      throw new ErreurDonneesInvalides(
        'Impossible de retirer ce cours : au moins un étudiant y a déjà une note saisie.'
      );
    }
  }

  for (const affectation of affectations) {
    await prisma.$transaction([
      prisma.affectationCours.delete({ where: { id: affectation.id } }),
      prisma.souhaitCours.upsert({
        where: { inscriptionId_coursId: { inscriptionId: affectation.inscriptionId, coursId } },
        update: {},
        create: { inscriptionId: affectation.inscriptionId, coursId },
      }),
    ]);
  }

  await prisma.lotCours.delete({ where: { id: lotCours.id } });
  return lot;
}

/**
 * Les cours réellement suivis par au moins un étudiant actif d'une
 * classe, groupés par Terme — remplace la navigation par semestre actif
 * pour la saisie des notes, des absences et le rattrapage. Un cours
 * électif choisi (ChoixElectif) porte son propre Terme (optionnel, choisi
 * à l'assignation) — regroupé exactement comme une vraie affectation.
 * Sans Terme précisé pour l'un ou l'autre, le cours apparaît dans le
 * groupe "sans terme".
 *
 * Jamais un cours dispensé ici : cette fonction sert à afficher ce qu'un
 * étudiant suit RÉELLEMENT (Notes, Absences, Rattrapage), jamais une
 * équivalence accordée par ailleurs. Cette information reste propre à la
 * fiche de l'étudiant (section "Dispensé(s)").
 */
export async function listerCoursAffectesParTerme(classeId: string) {
  const inscriptions = await prisma.inscription.findMany({
    where: { classeId, statutInscription: 'ACTIVE', etudiant: { statut: { not: 'BLOQUE' } } },
    select: { id: true },
  });
  const inscriptionIds = inscriptions.map((i: { id: string }) => i.id);

  const affectations = await prisma.affectationCours.findMany({
    where: { inscriptionId: { in: inscriptionIds } },
    include: { cours: { include: { ue: true } } },
  });
  const choixElectifs = await prisma.choixElectif.findMany({
    where: { inscriptionId: { in: inscriptionIds } },
    include: { cours: { include: { ue: true } } },
  });

  const groupes = new Map<string, Map<string, { id: string; code: string; titre: string; ueCode: string }>>();

  function ajouter(cle: string, cours: { id: string; code: string; titre: string; ue: { code: string } }) {
    if (!groupes.has(cle)) groupes.set(cle, new Map());
    groupes.get(cle)!.set(cours.id, { id: cours.id, code: cours.code, titre: cours.titre, ueCode: cours.ue.code });
  }

  for (const a of affectations) {
    if (a.dispense) continue;
    ajouter(a.terme ?? 'SANS_TERME', a.cours);
  }
  for (const c of choixElectifs) ajouter(c.terme ?? 'SANS_TERME', c.cours);

  return Array.from(groupes.entries())
    .map(([cle, coursMap]) => ({
      terme: cle === 'SANS_TERME' ? null : (cle as Terme),
      cours: Array.from(coursMap.values()).sort((a, b) => a.code.localeCompare(b.code)),
    }))
    .sort((a, b) => (a.terme ?? 'zzz').localeCompare(b.terme ?? 'zzz'));
}

/**
 * Pour une classe, tous les étudiants regroupés par cours (eux-mêmes
 * groupés par Terme) — utile précisément parce que le système de lots
 * flexibles fait qu'une même classe n'a jamais forcément les mêmes
 * cours pour tout le monde : deux étudiants d'une même classe peuvent
 * suivre des cours différents. "Qui est dans MON cours" est donc une
 * question différente de "qui est dans cette classe", que la fiche
 * classe seule ne peut pas montrer.
 */
export async function listerEtudiantsParCours(classeId: string) {
  const inscriptions = await prisma.inscription.findMany({
    where: { classeId, statutInscription: 'ACTIVE', etudiant: { statut: { not: 'BLOQUE' } } },
    select: { id: true, etudiant: { select: { matricule: true, nom: true } } },
  });
  const parInscriptionId = new Map<string, { matricule: string; nom: string }>(
    (inscriptions as { id: string; etudiant: { matricule: string; nom: string } }[]).map((i) => [i.id, i.etudiant])
  );
  const inscriptionIds = inscriptions.map((i: { id: string }) => i.id);

  const affectations = await prisma.affectationCours.findMany({
    where: { inscriptionId: { in: inscriptionIds } },
    include: { cours: { include: { ue: true } } },
  });
  const choixElectifs = await prisma.choixElectif.findMany({
    where: { inscriptionId: { in: inscriptionIds } },
    include: { cours: { include: { ue: true } } },
  });

  const groupes = new Map<
    string,
    Map<string, { id: string; code: string; titre: string; ueCode: string; etudiants: Map<string, { matricule: string; nom: string }> }>
  >();

  function ajouter(
    cle: string,
    cours: { id: string; code: string; titre: string; ue: { code: string } },
    inscriptionId: string
  ) {
    const etudiant = parInscriptionId.get(inscriptionId);
    if (!etudiant) return;
    if (!groupes.has(cle)) groupes.set(cle, new Map());
    const coursMap = groupes.get(cle)!;
    if (!coursMap.has(cours.id)) {
      coursMap.set(cours.id, { id: cours.id, code: cours.code, titre: cours.titre, ueCode: cours.ue.code, etudiants: new Map() });
    }
    coursMap.get(cours.id)!.etudiants.set(etudiant.matricule, etudiant);
  }

  // Cet écran montre qui suit RÉELLEMENT chaque cours — jamais une
  // dispense ici : un étudiant dispensé n'assiste pas au cours, il en
  // est excusé par équivalence. Cette information reste propre à la
  // fiche de l'étudiant (section "Dispensé(s)"), jamais mélangée à un
  // écran pensé pour de vrais effectifs de classe.
  for (const a of affectations) {
    if (a.dispense) continue;
    ajouter(a.terme ?? 'SANS_TERME', a.cours, a.inscriptionId);
  }
  for (const c of choixElectifs) ajouter(c.terme ?? 'SANS_TERME', c.cours, c.inscriptionId);

  return Array.from(groupes.entries())
    .map(([cle, coursMap]) => ({
      terme: cle === 'SANS_TERME' ? null : (cle as Terme),
      cours: Array.from(coursMap.values())
        .map((c) => ({
          id: c.id,
          code: c.code,
          titre: c.titre,
          ueCode: c.ueCode,
          etudiants: Array.from(c.etudiants.values()).sort((a, b) => a.nom.localeCompare(b.nom)),
        }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    }))
    .sort((a, b) => (a.terme ?? 'zzz').localeCompare(b.terme ?? 'zzz'));
}

/**
 * L'historique complet des lots d'un niveau, du plus récent au plus
 * ancien, avec leurs cours — pour l'écran de gestion.
 */
export async function obtenirHistoriqueLots(niveauId: string) {
  return prisma.lot.findMany({
    where: { niveauId },
    include: { cours: { include: { cours: true } } },
    orderBy: { numero: 'desc' },
  });
}

export async function debloquerPrerequis(inscriptionId: string, coursId: string) {
  return prisma.deblocagePrerequis.upsert({
    where: { inscriptionId_coursId: { inscriptionId, coursId } },
    update: {},
    create: { inscriptionId, coursId },
  });
}

export async function retirerDeblocage(inscriptionId: string, coursId: string) {
  await prisma.deblocagePrerequis.deleteMany({ where: { inscriptionId, coursId } });
}

/**
 * L'état complet du parcours flexible d'un étudiant : validés, en
 * attente de résultat, définitivement échoués, hors de portée (prérequis
 * non satisfait), verrouillé fin de cycle, souhaités, et nouvellement
 * éligibles — six catégories qui se partagent la totalité des cours du
 * parcours, aucune omise. Un cours n'est jamais verrouillé QUE par un
 * prérequis manquant ou par la fin de cycle — aucune règle d'ordre par
 * semestre.
 *
 * Entièrement calculé à partir de rassemblerContexteInscription — une
 * poignée de requêtes group ées, jamais une par cours.
 */
export async function obtenirEtatParcoursFlexible(inscriptionId: string) {
  const { tousLesCours, coursParCode, donnees, cycleTermine } = await rassemblerContexteInscription(inscriptionId);

  const valides = [];
  const enAttente = [];
  const echouesDefinitivement = [];
  const horsDePortee = [];
  const finDeCycleVerrouille = [];
  const souhaites = [];
  const eligiblesNouveaux = [];

  for (const cours of tousLesCours) {
    if (estValideSync(donnees, cours.id)) {
      valides.push(cours);
      continue;
    }
    if (estEnAttenteSync(donnees, cours.id)) {
      enAttente.push(cours);
      continue;
    }
    if (donnees.souhaits.has(cours.id)) {
      souhaites.push(cours);
      continue;
    }

    const estEchoue = estEchoueSync(donnees, cours.id);
    const debloqueManuel = estDebloqueSync(donnees, cours.id);
    const prerequisOk = debloqueManuel || estPrerequisSatisfaitSync(donnees, coursParCode, cours);

    if (estEchoue) {
      echouesDefinitivement.push(cours);
    } else if (cours.ue.finDeCycle && !cycleTermine && !debloqueManuel) {
      finDeCycleVerrouille.push(cours);
    } else if (!prerequisOk) {
      const prerequis = resoudrePrerequisSync(coursParCode, cours);
      horsDePortee.push({ ...cours, prerequisManquant: prerequis });
    } else {
      eligiblesNouveaux.push(cours);
    }
  }

  return {
    valides,
    enAttente,
    echouesDefinitivement,
    horsDePortee,
    finDeCycleVerrouille,
    souhaites,
    eligiblesNouveaux,
  };
}

interface CoursNonValide {
  code: string;
  titre: string;
  statut: string | null;
}

interface EtatTerme {
  terme: 'AUTOMNE' | 'PRINTEMPS' | 'ETE';
  touche: boolean;
  termine: boolean;
  coursNonValides: CoursNonValide[];
}

/**
 * L'état académique complet d'un étudiant, par Terme et pour l'année — le
 * calcul se limite à l'ANNÉE UNIVERSITAIRE de cette inscription précise
 * (jamais mélangé avec une autre année du même parcours), mais le
 * résultat de chaque cours regarde à travers toutes les inscriptions
 * sœurs (même formation, n'importe quelle année) — une matière de cette
 * année, reprise et validée plus tard ailleurs, reste définitive pour
 * l'année d'origine. Calculé à chaque consultation, jamais stocké en
 * base, exactement comme "validé" l'est déjà.
 *
 * Un cours électif choisi (ChoixElectif) compte exactement comme une
 * vraie affectation, avec son propre Terme (optionnel, choisi au moment
 * de l'assignation) — les deux sources fusionnées partout dans ce calcul,
 * jamais l'une sans l'autre.
 *
 * Un Terme jamais touché (aucune affectation dessus, pour cette année)
 * ne compte ni pour, ni contre — il est "non touché". Un Terme touché
 * est "terminé" quand TOUS les cours qui lui appartiennent (par leur
 * AffectationCours.terme) ont, au global, un résultat définitif (validé
 * ou non validé — jamais "en attente" ni sans note du tout).
 *
 * L'année est terminée si l'étudiant a touché au moins un Terme de cette
 * année, et que TOUS les Termes touchés sont eux-mêmes terminés — un
 * étudiant qui n'a simplement encore rien fait n'a pas non plus une
 * année "terminée".
 *
 * "Fermé" est un statut distinct, plus strict que "terminée" : une vraie
 * décision de l'administration (fermer chaque lot du Terme, pour toute
 * la classe — jamais un bouton séparé), combinée au fait que CET
 * étudiant précis ait TOUT validé, sans aucune matière non validée. Les
 * deux conditions ensemble, jamais l'une sans l'autre.
 */
export async function calculerEtatAnnee(inscriptionId: string) {
  const inscription = await prisma.inscription.findUnique({
    where: { id: inscriptionId },
    include: { niveau: { include: { parcours: true } } },
  });
  if (!inscription) {
    throw new ErreurNonTrouve('Inscription');
  }

  const formationId = inscription.niveau.parcours.formationId;
  const inscriptionsSoeurs = await trouverInscriptionsSoeurs(inscription.etudiantId, formationId);
  const idsInscriptionsSoeurs = inscriptionsSoeurs.map((i: { id: string }) => i.id);

  // Les affectations de CETTE inscription précise seulement — donc de
  // CETTE année universitaire précise. Un cours d'une autre année du même
  // parcours ne doit jamais compter dans les Termes de celle-ci ; chaque
  // année a ses propres Termes, jamais mélangés entre elles.
  const affectations = await prisma.affectationCours.findMany({
    where: { inscriptionId },
    include: { cours: true },
  });

  // Un choix électif compte lui aussi, avec SON PROPRE terme (optionnel,
  // choisi au moment de l'assignation) — même principe qu'une vraie
  // affectation, jamais mélangé ni oublié.
  const choixElectifs = await prisma.choixElectif.findMany({
    where: { inscriptionId },
    include: { cours: true },
  });

  // Mais le RÉSULTAT de chaque cours regarde, lui, à travers TOUTES les
  // inscriptions sœurs (même une autre année) — un cours de cette année,
  // repris et validé plus tard ailleurs, reste définitif pour l'année
  // d'origine, exactement comme confirmé.
  const coursIdsUniques: string[] = Array.from(
    new Set([
      ...affectations.map((a: { coursId: string }) => a.coursId),
      ...choixElectifs.map((c: { coursId: string }) => c.coursId),
    ])
  );
  const notes = await prisma.note.findMany({
    where: { inscriptionId: { in: idsInscriptionsSoeurs }, coursId: { in: coursIdsUniques } },
  });

  const meilleurStatutParCours = new Map<string, string | null>();
  for (const n of notes as { coursId: string; statutValidation: string | null }[]) {
    meilleurStatutParCours.set(n.coursId, meilleurStatut(meilleurStatutParCours.get(n.coursId), n.statutValidation));
  }

  // Un même cours peut, en théorie, avoir été affecté sous plusieurs
  // Termes différents (repris plus tard) — il compte alors dans chacun.
  const coursIdsParTerme = new Map<string, Set<string>>();
  const coursParId = new Map<string, { code: string; titre: string }>([
    ...affectations.map(
      (a: { coursId: string; cours: { code: string; titre: string } }): [string, { code: string; titre: string }] => [
        a.coursId,
        a.cours,
      ]
    ),
    ...choixElectifs.map(
      (c: { coursId: string; cours: { code: string; titre: string } }): [string, { code: string; titre: string }] => [
        c.coursId,
        c.cours,
      ]
    ),
  ]);
  for (const a of affectations as { terme: string | null; coursId: string }[]) {
    if (!a.terme) continue;
    if (!coursIdsParTerme.has(a.terme)) coursIdsParTerme.set(a.terme, new Set());
    coursIdsParTerme.get(a.terme)!.add(a.coursId);
  }
  for (const c of choixElectifs as { terme: string | null; coursId: string }[]) {
    if (!c.terme) continue;
    if (!coursIdsParTerme.has(c.terme)) coursIdsParTerme.set(c.terme, new Set());
    coursIdsParTerme.get(c.terme)!.add(c.coursId);
  }

  const termes: EtatTerme[] = (['AUTOMNE', 'PRINTEMPS', 'ETE'] as const).map((terme) => {
    const coursIdsDeCeTerme = coursIdsParTerme.get(terme);
    if (!coursIdsDeCeTerme || coursIdsDeCeTerme.size === 0) {
      return { terme, touche: false, termine: false, coursNonValides: [] };
    }

    const coursNonValides: CoursNonValide[] = [];
    for (const coursId of coursIdsDeCeTerme) {
      const statut = meilleurStatutParCours.get(coursId) ?? null;
      if (statut !== 'VALIDEE' && statut !== 'NON_VALIDEE') {
        const cours = coursParId.get(coursId);
        coursNonValides.push({ code: cours?.code ?? '', titre: cours?.titre ?? '', statut });
      }
    }

    return { terme, touche: true, termine: coursNonValides.length === 0, coursNonValides };
  });

  const termesToucher = termes.filter((t) => t.touche);
  const anneeTerminee = termesToucher.length > 0 && termesToucher.every((t) => t.termine);

  // Ce qui reste non validé au global, peu importe son Terme — pour
  // répondre à "année terminée, mais telle matière reste à faire".
  const matieresNonValidees: CoursNonValide[] = [];
  for (const [coursId, statut] of meilleurStatutParCours.entries()) {
    if (statut === 'NON_VALIDEE') {
      const cours = coursParId.get(coursId);
      if (cours) matieresNonValidees.push({ code: cours.code, titre: cours.titre, statut });
    }
  }

  // "Fermé" est une vraie décision de l'administration, distincte du
  // calcul "terminé" — un Terme est fermé POUR LA CLASSE (ce niveau) une
  // fois que TOUS ses lots le sont ; jamais un bouton séparé, juste le
  // même "Fermer un lot" déjà construit, regardé au niveau de la classe
  // entière. Un Terme jamais utilisé (aucun lot dessus) ne compte ni
  // pour, ni contre — même principe que "touché" plus haut.
  const lotsDuNiveau = await prisma.lot.findMany({ where: { niveauId: inscription.niveauId } });
  const termesToucherParClasse = new Set(
    lotsDuNiveau.filter((l: { terme: string | null }) => l.terme).map((l: { terme: string | null }) => l.terme as string)
  );
  const classeATermineTousSesTermes =
    termesToucherParClasse.size > 0 &&
    Array.from(termesToucherParClasse).every((terme) =>
      lotsDuNiveau.filter((l: { terme: string | null }) => l.terme === terme).every((l: { statut: string }) => l.statut === 'FERME')
    );

  // L'année est "Fermée" seulement si la classe a fermé tous ses Termes
  // ET que CET étudiant précis a tout validé (aucune matière non
  // validée) — les deux ensemble, jamais l'un sans l'autre.
  const anneeFermee = classeATermineTousSesTermes && anneeTerminee && matieresNonValidees.length === 0;

  return { termes, anneeTerminee, matieresNonValidees, classeATermineTousSesTermes, anneeFermee };
}
