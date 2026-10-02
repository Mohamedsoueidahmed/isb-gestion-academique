import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 exige un adaptateur de connexion explicite — PrismaClient ne devine
// plus tout seul comment parler à PostgreSQL, il faut le lui indiquer ici.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Une seule instance du client Prisma pour toute l'application.
// Créer une nouvelle instance par module ouvrirait une nouvelle connexion
// à chaque import, ce qui épuiserait rapidement le pool de connexions PostgreSQL.
const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;
