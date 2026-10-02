import prisma from '../../shared/database/prismaClient';
import { ErreurNonTrouve, ErreurDonneesInvalides } from '../../shared/erreurs/ErreurMetier';
import type { Terme } from '@prisma/client';

const TERMES_VALIDES = ['AUTOMNE', 'PRINTEMPS', 'ETE'];

/**
 * Pour un matricule, une année universitaire et un Terme donnés, ce que
 * le logiciel d'inscription et paiement a besoin de savoir : combien de
 * matières cet étudiant a-t-il réellement, sous ce Terme, pour CETTE
 * année précise — jamais devinée depuis l'année actuellement active
 * côté académique, qui peut très bien être différente de celle que la
 * caisse traite (un paiement en retard pour une année déjà close, par
 * exemple). Réutilise les données déjà calculées par le système de lots
 * (affectations réelles + choix électifs, chacun avec son propre Terme)
 * — n'invente aucune nouvelle logique de comptage, se contente d'exposer
 * ce qui existe déjà sous une forme utile à un logiciel externe.
 */
export async function obtenirInfosTermePourMatricule(matricule: string, anneeUniversitaire: string, terme: string) {
  if (!TERMES_VALIDES.includes(terme)) {
    throw new ErreurDonneesInvalides(`Terme invalide : "${terme}". Attendu : AUTOMNE, PRINTEMPS ou ETE.`);
  }

  const etudiant = await prisma.etudiant.findUnique({ where: { matricule } });
  if (!etudiant) {
    throw new ErreurNonTrouve('Étudiant');
  }

  const annee = await prisma.anneeUniversitaire.findUnique({ where: { libelle: anneeUniversitaire } });
  if (!annee) {
    throw new ErreurNonTrouve(`Année universitaire "${anneeUniversitaire}"`);
  }

  const inscription = await prisma.inscription.findFirst({
    where: { etudiantId: etudiant.id, anneeUniversitaireId: annee.id },
    include: { niveau: { include: { parcours: { include: { formation: true } } } } },
  });
  if (!inscription) {
    throw new ErreurNonTrouve(`Inscription de cet étudiant pour l'année ${annee.libelle}`);
  }

  const [affectations, choixElectifs] = await Promise.all([
    prisma.affectationCours.findMany({
      where: { inscriptionId: inscription.id, terme: terme as Terme },
      include: { cours: true },
    }),
    prisma.choixElectif.findMany({
      where: { inscriptionId: inscription.id, terme: terme as Terme },
      include: { cours: true },
    }),
  ]);

  // Un même cours ne doit jamais être compté deux fois s'il apparaît par
  // les deux mécanismes à la fois — un Set par coursId garantit ça.
  const matieresUniques = new Map<string, { code: string; titre: string }>();
  for (const a of affectations as (typeof affectations)[number][]) {
    matieresUniques.set(a.coursId, { code: a.cours.code, titre: a.cours.titre });
  }
  for (const c of choixElectifs as (typeof choixElectifs)[number][]) {
    matieresUniques.set(c.coursId, { code: c.cours.code, titre: c.cours.titre });
  }

  return {
    matricule: etudiant.matricule,
    nom: etudiant.nom,
    anneeUniversitaire: annee.libelle,
    formation: inscription.niveau.parcours.formation.nom,
    cycle: inscription.niveau.parcours.formation.cycle,
    niveau: inscription.niveau.libelle,
    terme,
    nombreMatieres: matieresUniques.size,
    matieres: Array.from(matieresUniques.values()),
  };
}

/**
 * La liste des formations actives — pour que le logiciel d'inscription
 * et paiement propose un vrai choix, plutôt qu'un champ texte libre où
 * l'administratif pourrait taper n'importe quoi, différent de ce que
 * l'académique connaît réellement.
 */
export async function listerFormationsActives() {
  return prisma.formation.findMany({
    where: { estActive: true },
    select: { nom: true, cycle: true },
    orderBy: { nom: 'asc' },
  });
}

/**
 * Les années universitaires existantes, les plus récentes d'abord — pour
 * proposer un vrai choix à l'écran du financier, plutôt qu'un champ texte
 * libre où une faute de frappe ("2026-2027 " avec un espace, par exemple)
 * ne donnerait jamais aucun résultat.
 */
export async function listerAnnees() {
  return prisma.anneeUniversitaire.findMany({
    select: { libelle: true, estActive: true },
    orderBy: { dateDebut: 'desc' },
  });
}

/**
 * Tous les étudiants ayant des cours réellement affectés (ou des choix
 * électifs) sous un Terme donné, pour UNE année universitaire précise —
 * jamais devinée depuis l'année active, symétrique à
 * obtenirInfosTermePourMatricule. Utilisé par le logiciel de paiement
 * pour croiser "qui devrait payer pour ce Terme, cette année-là" avec
 * ses propres paiements enregistrés — l'académique ne connaît jamais les
 * paiements eux-mêmes, seulement qui est concerné par quel Terme.
 */
export async function listerEtudiantsParTerme(anneeUniversitaire: string, terme: string) {
  if (!TERMES_VALIDES.includes(terme)) {
    throw new ErreurDonneesInvalides(`Terme invalide : "${terme}". Attendu : AUTOMNE, PRINTEMPS ou ETE.`);
  }

  const annee = await prisma.anneeUniversitaire.findUnique({ where: { libelle: anneeUniversitaire } });
  if (!annee) {
    throw new ErreurNonTrouve(`Année universitaire "${anneeUniversitaire}"`);
  }

  const inclusionInscription = {
    inscription: {
      include: { etudiant: true, niveau: { include: { parcours: { include: { formation: true } } } } },
    },
  };

  const [affectations, choixElectifs] = await Promise.all([
    prisma.affectationCours.findMany({
      where: { terme: terme as Terme, inscription: { anneeUniversitaireId: annee.id } },
      include: inclusionInscription,
    }),
    prisma.choixElectif.findMany({
      where: { terme: terme as Terme, inscription: { anneeUniversitaireId: annee.id } },
      include: inclusionInscription,
    }),
  ]);

  // Un même étudiant ne doit apparaître qu'une fois, avec le compte total
  // de ses matières distinctes sous ce Terme (affectations réelles et
  // électifs confondus, jamais comptés deux fois si les deux existent).
  const parInscription = new Map<
    string,
    { matricule: string; nom: string; formation: string; cycle: string | null; niveau: string; coursIds: Set<string> }
  >();

  function ajouter(ligne: (typeof affectations)[number] | (typeof choixElectifs)[number]) {
    const insc = ligne.inscription;
    if (!parInscription.has(insc.id)) {
      parInscription.set(insc.id, {
        matricule: insc.etudiant.matricule,
        nom: insc.etudiant.nom,
        formation: insc.niveau.parcours.formation.nom,
        cycle: insc.niveau.parcours.formation.cycle,
        niveau: insc.niveau.libelle,
        coursIds: new Set(),
      });
    }
    parInscription.get(insc.id)!.coursIds.add(ligne.coursId);
  }

  for (const a of affectations as (typeof affectations)[number][]) ajouter(a);
  for (const c of choixElectifs as (typeof choixElectifs)[number][]) ajouter(c);

  return Array.from(parInscription.values()).map((e) => ({
    matricule: e.matricule,
    nom: e.nom,
    formation: e.formation,
    cycle: e.cycle,
    niveau: e.niveau,
    nombreMatieres: e.coursIds.size,
  }));
}
