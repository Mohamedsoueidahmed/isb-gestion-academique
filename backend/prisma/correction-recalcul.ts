import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { recalculerNoteEtStatut } from '../src/modules/notes/notes.service';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Correctif ponctuel, à exécuter UNE SEULE FOIS juste après
 * migration-composantes.ts.
 *
 * Ce script précédent a créé les composantes EvaluationComposante à partir
 * des anciennes notes brutes, mais n'a jamais déclenché le recalcul de
 * Note.valeur en conséquence — laissant l'ancienne valeur brute affichée
 * comme si elle était la vraie moyenne calculée par le nouveau système
 * (elle ne l'est pas). Ce script corrige cela : chaque Note concernée est
 * recalculée pour de vrai, ce qui la fera très probablement redevenir NULL
 * tant que les autres composantes ne sont pas saisies — comportement
 * attendu, pas une perte de données (la valeur reste visible dans la
 * composante Examen Session 1).
 */
async function corriger() {
  console.log('Recalcul des moyennes existantes après migration...');

  const admin = await prisma.utilisateur.findUnique({ where: { email: 'admin@universite.local' } });
  if (!admin) {
    throw new Error("Utilisateur admin@universite.local introuvable — impossible d'attribuer le recalcul.");
  }

  // Toutes les paires (inscription, cours) qui ont au moins une composante —
  // ce sont les seules matières concernées par un recalcul.
  const composantes = await prisma.evaluationComposante.findMany({
    select: { inscriptionId: true, coursId: true },
    distinct: ['inscriptionId', 'coursId'],
  });

  console.log(`${composantes.length} matière(s) à recalculer.`);

  for (const { inscriptionId, coursId } of composantes) {
    const note = await recalculerNoteEtStatut(inscriptionId, coursId, admin.id);
    console.log(
      `  Recalculée : inscription ${inscriptionId}, cours ${coursId} → moyenne = ${note.valeur ?? 'NULL'}, statut = ${note.statutValidation ?? 'NULL'}`
    );
  }

  console.log('\nTerminé.');
}

corriger()
  .catch((erreur) => {
    console.error('Erreur pendant le recalcul :', erreur);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
