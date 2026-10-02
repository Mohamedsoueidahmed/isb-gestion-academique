import 'dotenv/config';
import { PrismaClient, NatureUE } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Correction ponctuelle : UE.20, dans les trois parcours, était marquée
 * FONDAMENTALE au lieu de OPTIONNELLE — une erreur dans les données de
 * référence elles-mêmes (le commentaire du fichier seed disait déjà
 * "Cours électif 2", la nature ne correspondait simplement pas). Corriger
 * le fichier seed ne change rien aux lignes déjà créées en base : ce
 * script corrige les lignes existantes directement.
 *
 * Ne touche qu'au champ nature de UE.20 — rien d'autre n'est modifié.
 */
async function corrigerNatureUE20() {
  console.log('Correction de la nature de UE.20 (FONDAMENTALE → OPTIONNELLE)...\n');

  const resultat = await prisma.uE.updateMany({
    where: { code: 'UE.20' },
    data: { nature: NatureUE.OPTIONNELLE },
  });

  console.log(`${resultat.count} ligne(s) UE.20 corrigée(s).`);

  if (resultat.count === 0) {
    console.log("Aucune ligne trouvée. Soit UE.20 n'existe pas encore dans votre base, soit elle a déjà été corrigée.");
  }
}

corrigerNatureUE20()
  .catch((erreur) => {
    console.error('Erreur pendant la correction :', erreur);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
