import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Nettoyage ponctuel : avant la séparation tronc commun / spécialisations,
 * chaque parcours de spécialisation (Management Appliqué, CCA, Finance,
 * CDSI, IA) avait son propre M1, dupliqué. Le script seed.ts ne supprime
 * jamais ce qu'il ne décrit plus — il crée ou met à jour, jamais ne
 * retire — donc ces anciens M1 sont restés accrochés à ces parcours après
 * la restructuration, même si les fichiers de données ne les décrivent
 * plus. Ce script les retire, un par un, dans l'ordre exigé par les
 * contraintes (cours, puis UE, puis semestres, puis le niveau).
 *
 * Ne touche JAMAIS : le Tronc Commun lui-même (son propre M1 est correct
 * et voulu), ni aucun M2 (les spécialisations gardent leur M2 intact).
 */
const PARCOURS_A_NETTOYER = [
  { formationId: 'formation-master-aa', codeCourt: 'MGT' },
  { formationId: 'formation-master-aa', codeCourt: 'CCA' },
  { formationId: 'formation-master-aa', codeCourt: 'FIN' },
  { formationId: 'formation-master-informatique', codeCourt: 'CDSI' },
  { formationId: 'formation-master-informatique', codeCourt: 'IA' },
];

async function nettoyerAnciensM1() {
  console.log('Nettoyage des anciens niveaux M1 résiduels sur les parcours de spécialisation...\n');

  for (const cible of PARCOURS_A_NETTOYER) {
    const parcours = await prisma.parcours.findUnique({
      where: { formationId_codeCourt: { formationId: cible.formationId, codeCourt: cible.codeCourt } },
    });
    if (!parcours) {
      console.log(`Parcours ${cible.codeCourt} introuvable (formation ${cible.formationId}). Ignoré.`);
      continue;
    }

    const niveauM1 = await prisma.niveau.findFirst({
      where: { parcoursId: parcours.id, libelle: 'M1' },
    });
    if (!niveauM1) {
      console.log(`${parcours.nom} : aucun M1 résiduel trouvé, rien à faire.`);
      continue;
    }

    const semestres = await prisma.semestre.findMany({ where: { niveauId: niveauM1.id } });
    let coursSupprimes = 0;
    let uesSupprimees = 0;

    for (const semestre of semestres) {
      const ues = await prisma.uE.findMany({ where: { semestreId: semestre.id } });
      for (const ue of ues) {
        const resultatCours = await prisma.cours.deleteMany({ where: { ueId: ue.id } });
        coursSupprimes += resultatCours.count;
      }
      const resultatUE = await prisma.uE.deleteMany({ where: { semestreId: semestre.id } });
      uesSupprimees += resultatUE.count;
    }

    const resultatSemestres = await prisma.semestre.deleteMany({ where: { niveauId: niveauM1.id } });
    await prisma.niveau.delete({ where: { id: niveauM1.id } });

    console.log(
      `${parcours.nom} : M1 résiduel supprimé (${resultatSemestres.count} semestre(s), ${uesSupprimees} UE, ${coursSupprimes} cours).`
    );
  }

  console.log('\nNettoyage terminé.');
}

nettoyerAnciensM1()
  .catch((erreur) => {
    console.error('Erreur pendant le nettoyage :', erreur);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
