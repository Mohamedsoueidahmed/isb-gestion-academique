import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Corrige les deux parcours "Tronc Commun" déjà en base, créés avec le
 * même code court 'TC' pour les deux Masters — ce qui produisait deux
 * classes au nom identique ("M1-TC-A"), impossibles à distinguer à
 * l'écran. Changer le fichier seed seul ne suffit pas : son "upsert"
 * cherche une correspondance par code court, donc un nouveau code court
 * dans le fichier ferait croire à la création d'un tout nouveau parcours,
 * laissant l'ancien orphelin. Ce script renomme directement les lignes
 * déjà existantes, sans en créer de nouvelles.
 */
async function corrigerCodesTroncCommun() {
  const corrections = [
    {
      formationId: 'formation-master-aa',
      nouveauCodeCourt: 'TCAA',
      nouveauNom: 'Tronc Commun (Master Administration des Affaires)',
    },
    {
      formationId: 'formation-master-informatique',
      nouveauCodeCourt: 'TCINFO',
      nouveauNom: 'Tronc Commun (Master Informatique)',
    },
  ];

  for (const correction of corrections) {
    const parcours = await prisma.parcours.findFirst({
      where: { formationId: correction.formationId, codeCourt: 'TC' },
    });
    if (!parcours) {
      console.log(`Aucun parcours 'TC' trouvé pour ${correction.formationId}. Déjà corrigé, ou jamais créé.`);
      continue;
    }

    await prisma.parcours.update({
      where: { id: parcours.id },
      data: { codeCourt: correction.nouveauCodeCourt, nom: correction.nouveauNom },
    });
    console.log(`${correction.formationId} : renommé en '${correction.nouveauCodeCourt}'.`);
  }

  console.log('\nCorrection terminée.');
}

corrigerCodesTroncCommun()
  .catch((erreur) => {
    console.error('Erreur pendant la correction :', erreur);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
