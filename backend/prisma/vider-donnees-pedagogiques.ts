import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Vide TOUTES les données scolaires, y compris les années universitaires
 * elles-mêmes — pour repartir d'une base totalement vierge et retester
 * depuis zéro. Ne touche JAMAIS à :
 * - L'université elle-même (l'entité, pas ses années)
 * - Le référentiel structurel (formation, parcours, niveaux, semestres, UE,
 *   cours, cours électifs) — ce qui ne change jamais indépendamment des tests
 * - Les utilisateurs et rôles (le compte administrateur reste utilisable)
 *
 * L'ordre de suppression respecte les dépendances (des tables les plus
 * dépendantes vers les moins dépendantes), pour ne jamais violer une
 * contrainte de clé étrangère en cours de route. Les années universitaires
 * sont supprimées en dernier, une fois que tout ce qui les référence
 * (classes, inscriptions, affectations enseignant) est déjà vide.
 */
async function viderDonneesPedagogiques() {
  console.log('Vidage complet des données scolaires (y compris les années universitaires)...\n');

  const compteurs: Record<string, number> = {};

  compteurs.evaluationsComposantesHistorique = (await prisma.evaluationComposanteHistorique.deleteMany()).count;
  compteurs.evaluationsComposantes = (await prisma.evaluationComposante.deleteMany()).count;
  compteurs.notesHistorique = (await prisma.noteHistorique.deleteMany()).count;
  compteurs.notes = (await prisma.note.deleteMany()).count;
  compteurs.absences = (await prisma.absence.deleteMany()).count;
  compteurs.affectationsEnseignant = (await prisma.affectationEnseignant.deleteMany()).count;
  compteurs.choixElectifs = (await prisma.choixElectif.deleteMany()).count;
  compteurs.deblocagesPrerequis = (await prisma.deblocagePrerequis.deleteMany()).count;
  compteurs.souhaitsCours = (await prisma.souhaitCours.deleteMany()).count;
  compteurs.affectationsCours = (await prisma.affectationCours.deleteMany()).count;
  compteurs.lotsCours = (await prisma.lotCours.deleteMany()).count;
  compteurs.lots = (await prisma.lot.deleteMany()).count;
  compteurs.inscriptions = (await prisma.inscription.deleteMany()).count;
  compteurs.etudiants = (await prisma.etudiant.deleteMany()).count;
  compteurs.classes = (await prisma.classe.deleteMany()).count;
  compteurs.anneesUniversitaires = (await prisma.anneeUniversitaire.deleteMany()).count;

  console.log('Terminé. Lignes supprimées :');
  for (const [table, nombre] of Object.entries(compteurs)) {
    console.log(`  ${table} : ${nombre}`);
  }

  console.log('\nConservés intacts : université, formation, parcours, niveaux, semestres, UE, cours, cours électifs, utilisateurs et rôles.');
  console.log("Aucune année universitaire ne subsiste. Recréez-en une (bouton \"+ Nouvelle année\" dans l'en-tête) avant de tester quoi que ce soit d'autre.");
}

viderDonneesPedagogiques()
  .catch((erreur) => {
    console.error('Erreur pendant le vidage :', erreur);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
