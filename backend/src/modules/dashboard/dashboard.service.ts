import prisma from '../../shared/database/prismaClient';

/**
 * Chiffres globaux simples — comptages directs, aucune interprétation.
 * Étudiants et classes sont comptés pour l'année sélectionnée (via les
 * inscriptions actives de cette année) ; formations et parcours restent
 * globaux, puisqu'ils ne sont pas propres à une année.
 */
export async function obtenirStatistiquesGlobales(anneeUniversitaireId?: string) {
  const [nombreEtudiants, nombreFormations, nombreParcours, nombreClasses] = await Promise.all([
    anneeUniversitaireId
      ? prisma.inscription
          .findMany({
            where: { statutInscription: 'ACTIVE', anneeUniversitaireId, etudiant: { statut: { not: 'BLOQUE' } } },
            select: { etudiantId: true },
            distinct: ['etudiantId'],
          })
          .then((r: { etudiantId: string }[]) => r.length)
      : prisma.etudiant.count({ where: { statut: 'ACTIF' } }),
    prisma.formation.count({ where: { estActive: true } }),
    prisma.parcours.count(),
    prisma.classe.count({ where: anneeUniversitaireId ? { anneeUniversitaireId } : undefined }),
  ]);

  return { nombreEtudiants, nombreFormations, nombreParcours, nombreClasses };
}

/**
 * Répartition des étudiants actifs par niveau (L1/L2/L3), via leurs
 * inscriptions actives — un étudiant qui a plusieurs inscriptions
 * historiques n'est compté qu'une fois, sur son inscription active actuelle.
 */
/**
 * Répartition des étudiants actifs par niveau (L1/L2/L3), TOUS PARCOURS
 * CONFONDUS — chaque parcours a ses propres lignes Niveau en base (L1-CCA,
 * L1-FBA, L1-GCI sont trois entités distinctes qui partagent juste le même
 * libellé), donc regrouper par niveauId donnerait neuf lignes au lieu de
 * trois. On regroupe ici par LIBELLÉ, en sommant les comptages des niveaux
 * qui le partagent — pour une vraie vue "par niveau", complémentaire de
 * "par parcours" ci-dessous, pas une répétition cachée de la même chose.
 */
export async function obtenirEtudiantsParNiveau(anneeUniversitaireId?: string) {
  const resultats = await prisma.inscription.groupBy({
    by: ['niveauId'],
    where: {
      statutInscription: 'ACTIVE',
      etudiant: { statut: { not: 'BLOQUE' } },
      ...(anneeUniversitaireId ? { anneeUniversitaireId } : {}),
    },
    _count: { _all: true },
  });

  const niveaux = await prisma.niveau.findMany({
    where: { id: { in: resultats.map((r: (typeof resultats)[number]) => r.niveauId) } },
  });

  const totauxParLibelle = new Map<string, number>();
  for (const r of resultats) {
    const niveau = niveaux.find((n: (typeof niveaux)[number]) => n.id === r.niveauId);
    if (!niveau) continue;
    totauxParLibelle.set(niveau.libelle, (totauxParLibelle.get(niveau.libelle) ?? 0) + r._count._all);
  }

  return Array.from(totauxParLibelle.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([libelle, nombreEtudiants]) => ({ niveau: { libelle }, nombreEtudiants }));
}

/**
 * Répartition des étudiants actifs par parcours.
 */
export async function obtenirEtudiantsParParcours(anneeUniversitaireId?: string) {
  const resultats = await prisma.inscription.groupBy({
    by: ['parcoursId'],
    where: {
      statutInscription: 'ACTIVE',
      etudiant: { statut: { not: 'BLOQUE' } },
      ...(anneeUniversitaireId ? { anneeUniversitaireId } : {}),
    },
    _count: { _all: true },
  });

  const parcours = await prisma.parcours.findMany({
    where: { id: { in: resultats.map((r: (typeof resultats)[number]) => r.parcoursId) } },
  });

  return resultats.map((r: (typeof resultats)[number]) => ({
    parcours: parcours.find((p: (typeof parcours)[number]) => p.id === r.parcoursId),
    nombreEtudiants: r._count._all,
  }));
}

/**
 * État de saisie par classe : pourcentage d'inscriptions actives ayant au
 * moins une note saisie, et au moins une absence enregistrée (présente ou
 * non). Une mesure simple et vérifiable, pas un seuil ou une pondération
 * inventée — juste "y a-t-il eu de la saisie ou non" pour cette classe.
 */
export async function obtenirEtatSaisieParClasse(anneeUniversitaireId?: string) {
  const classes = await prisma.classe.findMany({
    where: anneeUniversitaireId ? { anneeUniversitaireId } : undefined,
    include: {
      parcours: true,
      niveau: true,
      semestreActif: true,
      inscriptions: {
        where: { statutInscription: 'ACTIVE', etudiant: { statut: { not: 'BLOQUE' } } },
        include: {
          _count: { select: { notes: true, absences: true } },
        },
      },
    },
  });

  return classes.map((classe: (typeof classes)[number]) => {
    const totalInscriptions = classe.inscriptions.length;
    const inscriptionsAvecNote = classe.inscriptions.filter(
      (i: (typeof classe.inscriptions)[number]) => i._count.notes > 0
    ).length;
    const inscriptionsAvecAbsence = classe.inscriptions.filter(
      (i: (typeof classe.inscriptions)[number]) => i._count.absences > 0
    ).length;

    return {
      classeId: classe.id,
      nom: classe.nom,
      parcours: classe.parcours.codeCourt,
      niveau: classe.niveau.libelle,
      semestreActif: classe.semestreActif.libelle,
      totalInscriptions,
      pourcentageSaisieNotes: totalInscriptions > 0 ? Math.round((inscriptionsAvecNote / totalInscriptions) * 100) : 0,
      pourcentageSaisieAbsences:
        totalInscriptions > 0 ? Math.round((inscriptionsAvecAbsence / totalInscriptions) * 100) : 0,
    };
  });
}
