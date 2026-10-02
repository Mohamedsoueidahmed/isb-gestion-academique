import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Corrige une vraie erreur mécanique de seed.ts : jusqu'ici, un cours déjà
 * créé ne voyait jamais son propre estElectif mis à jour, même après avoir
 * corrigé la nature de son UE (ex. UE.24, passée de FONDAMENTALE à
 * OPTIONNELLE). Résultat concret : Stage et Mémoire gardaient
 * estElectif=false depuis leur toute première création, empêchant le
 * filtrage "un seul étudiant par choix" de jamais s'activer pour eux — les
 * deux montraient tous les étudiants de la classe, sans distinction.
 *
 * Ce script remet estElectif en phase avec la vraie nature actuelle de
 * l'UE, pour chaque cours déjà en base, une bonne fois pour toutes.
 */
async function corrigerEstElectifPartout() {
  const cours = await prisma.cours.findMany({ include: { ue: true } });

  let corriges = 0;
  for (const c of cours) {
    const valeurCorrecte = c.ue.nature === 'OPTIONNELLE';
    if (c.estElectif !== valeurCorrecte) {
      await prisma.cours.update({ where: { id: c.id }, data: { estElectif: valeurCorrecte } });
      corriges += 1;
      console.log(`${c.code} (${c.titre}) : estElectif ${c.estElectif} → ${valeurCorrecte}`);
    }
  }

  console.log(`\n${corriges} cours corrigé(s) sur ${cours.length} au total.`);
}

corrigerEstElectifPartout()
  .catch((erreur) => {
    console.error('Erreur pendant la correction :', erreur);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
