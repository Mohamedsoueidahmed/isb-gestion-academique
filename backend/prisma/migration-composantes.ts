import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Migration ponctuelle, à exécuter UNE SEULE FOIS après la mise en place du
 * moteur de calcul (Section 9).
 *
 * Avant cette section, une Note était saisie comme une valeur unique — ces
 * valeurs existent déjà en base (ex. la note d'Algèbre d'un étudiant, 16/20).
 * Conformément à ce qui a été validé explicitement : chaque ancienne valeur
 * est reprise comme composante "Examen Session 1", les autres composantes
 * (Devoir 1, Devoir 2, Exposé) restent à saisir.
 *
 * Conséquence attendue et normale : la moyenne recalculée de ces matières
 * redeviendra NULL tant que les 3 autres composantes ne sont pas saisies —
 * ce n'est pas une perte de données, la valeur d'origine reste visible dans
 * la colonne "Examen S1" du nouvel écran de saisie.
 *
 * Sûr à relancer plusieurs fois : une composante déjà migrée n'est jamais
 * dupliquée (vérification avant création).
 */
async function migrer() {
  console.log('Migration des notes existantes vers le nouveau système de composantes...');

  const notesExistantes = await prisma.note.findMany({
    where: { valeur: { not: null } },
  });

  console.log(`${notesExistantes.length} note(s) brute(s) trouvée(s).`);

  let migrees = 0;
  let dejaMigrees = 0;

  for (const note of notesExistantes) {
    const composanteExistante = await prisma.evaluationComposante.findUnique({
      where: {
        inscriptionId_coursId_type: {
          inscriptionId: note.inscriptionId,
          coursId: note.coursId,
          type: 'EXAMEN_SESSION_1',
        },
      },
    });

    if (composanteExistante) {
      dejaMigrees++;
      continue;
    }

    await prisma.evaluationComposante.create({
      data: {
        inscriptionId: note.inscriptionId,
        coursId: note.coursId,
        type: 'EXAMEN_SESSION_1',
        valeur: note.valeur,
        dateSaisie: note.dateSaisie,
        saisieParId: note.saisieParId,
      },
    });

    migrees++;
    console.log(`  Migrée : inscription ${note.inscriptionId}, cours ${note.coursId}, valeur ${note.valeur}`);
  }

  console.log(`\nTerminé : ${migrees} composante(s) créée(s), ${dejaMigrees} déjà migrée(s) (ignorée(s)).`);
  console.log(
    "Les moyennes correspondantes redeviendront NULL tant que les autres composantes (Devoir 1, Devoir 2, Exposé) ne seront pas saisies — c'est le comportement attendu."
  );
}

migrer()
  .catch((erreur) => {
    console.error('Erreur pendant la migration :', erreur);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
