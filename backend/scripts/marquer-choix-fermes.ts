import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Marque choixExclusif=true sur les UE à choix fermé déjà en base — la
 * migration applique false par défaut partout (correct pour la grande
 * majorité), mais UE.24 (Licence, Stage/Mémoire) et UE.04/UE.11 (Master
 * Anglais, Arabe/Français) doivent être true, sans quoi elles continuent
 * de se comporter comme un créneau ouvert.
 */
async function marquerChoixFermes() {
  const resultatLicence = await prisma.uE.updateMany({
    where: { code: 'UE.24' },
    data: { choixExclusif: true },
  });
  console.log(`UE.24 (Licence) : ${resultatLicence.count} ligne(s) marquée(s) à choix fermé.`);

  const resultatAnglais = await prisma.uE.updateMany({
    where: { code: { in: ['UE.04', 'UE.11'] }, semestre: { niveau: { parcours: { codeCourt: 'ANGL' } } } },
    data: { choixExclusif: true },
  });
  console.log(`UE.04/UE.11 (Master Anglais) : ${resultatAnglais.count} ligne(s) marquée(s) à choix fermé.`);

  console.log('\nCorrection terminée.');
}

marquerChoixFermes()
  .catch((erreur) => {
    console.error('Erreur pendant la correction :', erreur);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
