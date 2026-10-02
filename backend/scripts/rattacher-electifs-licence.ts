import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Rattache tous les cours électifs déjà en base (sans formationId, créés
 * avant la séparation des catalogues par programme) à la formation
 * Licence — la seule qui existait au moment de leur création. Sans ce
 * rattachement, ils deviendraient invisibles dans le catalogue filtré par
 * formation, même si les choix déjà faits par les étudiants restent
 * intacts (ChoixElectif pointe directement vers un Cours, jamais vers
 * CoursElectif).
 */
async function rattacherElectifsExistantsALaLicence() {
  const formationLicence = await prisma.formation.findFirst({ where: { id: 'formation-unique' } });
  if (!formationLicence) {
    console.error("Formation Licence introuvable (id 'formation-unique'). Rien à faire.");
    process.exit(1);
  }

  const resultat = await prisma.coursElectif.updateMany({
    where: { formationId: null },
    data: { formationId: formationLicence.id },
  });

  console.log(`${resultat.count} cours électif(s) rattaché(s) à ${formationLicence.nom}.`);
}

rattacherElectifsExistantsALaLicence()
  .catch((erreur) => {
    console.error('Erreur pendant le rattachement :', erreur);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
