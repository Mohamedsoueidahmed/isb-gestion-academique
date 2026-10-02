import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Même coût que celui utilisé par l'application elle-même pour la
// connexion (auth.service.ts) — jamais improvisé séparément.
const NOMBRE_TOURS_BCRYPT = 12;
const EMAIL_ADMIN = 'admin@universite.local';

async function changerMotDePasseAdmin() {
  const nouveauMotDePasse = process.argv[2];

  if (!nouveauMotDePasse) {
    console.error('Usage : npx tsx scripts/changer-mot-de-passe-admin.ts "VotreNouveauMotDePasse"');
    process.exit(1);
  }

  if (nouveauMotDePasse.length < 12) {
    console.error('Le nouveau mot de passe doit contenir au moins 12 caractères.');
    process.exit(1);
  }

  if (nouveauMotDePasse === 'ChangezMoi123!') {
    console.error("C'est encore l'ancien mot de passe par défaut. Choisissez-en un vraiment différent.");
    process.exit(1);
  }

  const utilisateur = await prisma.utilisateur.findUnique({ where: { email: EMAIL_ADMIN } });
  if (!utilisateur) {
    console.error(`Aucun utilisateur trouvé avec l'adresse ${EMAIL_ADMIN}.`);
    process.exit(1);
  }

  const hachage = await bcrypt.hash(nouveauMotDePasse, NOMBRE_TOURS_BCRYPT);

  await prisma.utilisateur.update({
    where: { email: EMAIL_ADMIN },
    data: { motDePasseHash: hachage },
  });

  console.log(`Mot de passe mis à jour pour ${EMAIL_ADMIN}.`);
  console.log('Reconnectez-vous avec le nouveau mot de passe pour confirmer que ça fonctionne.');
}

changerMotDePasseAdmin()
  .catch((erreur) => {
    console.error('Erreur pendant le changement de mot de passe :', erreur);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
