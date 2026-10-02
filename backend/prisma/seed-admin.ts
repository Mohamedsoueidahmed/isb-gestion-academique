import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hasherMotDePasse } from '../src/modules/auth/auth.service';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function inserer() {
  console.log('Création des rôles et du premier utilisateur administrateur...');

  const roleAdmin = await prisma.role.upsert({
    where: { libelle: 'ADMINISTRATEUR' },
    update: {},
    create: { libelle: 'ADMINISTRATEUR' },
  });

  await prisma.role.upsert({
    where: { libelle: 'RESPONSABLE_ACADEMIQUE' },
    update: {},
    create: { libelle: 'RESPONSABLE_ACADEMIQUE' },
  });

  console.log('Rôles créés : ADMINISTRATEUR, RESPONSABLE_ACADEMIQUE');

  // Mot de passe temporaire — à changer après la première connexion.
  const motDePasseTemporaire = 'ChangezMoi123!';
  const motDePasseHash = await hasherMotDePasse(motDePasseTemporaire);

  const admin = await prisma.utilisateur.upsert({
    where: { email: 'admin@universite.local' },
    update: {},
    create: {
      nom: 'Administrateur Principal',
      email: 'admin@universite.local',
      motDePasseHash,
      roleId: roleAdmin.id,
    },
  });

  console.log(`\nUtilisateur créé :`);
  console.log(`  Email : ${admin.email}`);
  console.log(`  Mot de passe temporaire : ${motDePasseTemporaire}`);
  console.log(`  (À changer dès que possible — aucune fonctionnalité de changement de mot de passe n'existe encore, elle viendra plus tard.)`);
}

inserer()
  .catch((erreur) => {
    console.error('Erreur :', erreur);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
