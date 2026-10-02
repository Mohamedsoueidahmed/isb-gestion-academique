import 'dotenv/config';
import { PrismaClient, NatureUE } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function corrigerNatureUE24() {
  console.log('Correction de la nature de UE.24 (FONDAMENTALE → OPTIONNELLE)...\n');
  const resultat = await prisma.uE.updateMany({
    where: { code: 'UE.24' },
    data: { nature: NatureUE.OPTIONNELLE },
  });
  console.log(`${resultat.count} ligne(s) UE.24 corrigée(s).`);
}

corrigerNatureUE24()
  .catch((erreur) => {
    console.error('Erreur pendant la correction :', erreur);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
