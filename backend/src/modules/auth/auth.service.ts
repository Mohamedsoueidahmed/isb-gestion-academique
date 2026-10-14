import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../../shared/database/prismaClient';
import { ErreurAuthentification } from '../../shared/erreurs/ErreurMetier';
import { PayloadJWT } from '../../types/auth.types';

const NOMBRE_TOURS_BCRYPT = 12;
const DUREE_TOKEN_ACCES = '1h';
const DUREE_TOKEN_RAFRAICHISSEMENT = '7d';

function obtenirSecretJWT(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Erreur de configuration serveur, pas une erreur métier utilisateur.
    throw new Error('JWT_SECRET n\'est pas défini dans les variables d\'environnement.');
  }
  return secret;
}

export async function hasherMotDePasse(motDePasseClair: string): Promise<string> {
  return bcrypt.hash(motDePasseClair, NOMBRE_TOURS_BCRYPT);
}

export async function verifierMotDePasse(motDePasseClair: string, hash: string): Promise<boolean> {
  return bcrypt.compare(motDePasseClair, hash);
}

export function genererTokenAcces(payload: PayloadJWT): string {
  return jwt.sign(payload, obtenirSecretJWT(), { expiresIn: DUREE_TOKEN_ACCES });
}

export function genererTokenRafraichissement(payload: PayloadJWT): string {
  return jwt.sign(payload, obtenirSecretJWT(), { expiresIn: DUREE_TOKEN_RAFRAICHISSEMENT });
}

export function verifierToken(token: string): PayloadJWT {
  try {
    return jwt.verify(token, obtenirSecretJWT()) as PayloadJWT;
  } catch {
    throw new ErreurAuthentification('Token invalide ou expiré.');
  }
}

/**
 * Vérifie les identifiants et retourne les tokens si valides.
 * Ne révèle jamais si c'est l'email ou le mot de passe qui est incorrect —
 * un message générique évite de confirmer à un attaquant qu'un email existe.
 */
export async function connecter(email: string, motDePasseClair: string) {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!utilisateur || !utilisateur.estActif) {
    throw new ErreurAuthentification('Identifiants incorrects.');
  }

  const motDePasseValide = await verifierMotDePasse(motDePasseClair, utilisateur.motDePasseHash);
  if (!motDePasseValide) {
    throw new ErreurAuthentification('Identifiants incorrects.');
  }

  const payload: PayloadJWT = {
    utilisateurId: utilisateur.id,
    role: utilisateur.role.libelle,
  };

  return {
    tokenAcces: genererTokenAcces(payload),
    tokenRafraichissement: genererTokenRafraichissement(payload),
    utilisateur: {
      id: utilisateur.id,
      nom: utilisateur.nom,
      email: utilisateur.email,
      role: utilisateur.role.libelle,
    },
  };
}

/**
 * Change le mot de passe de l'utilisateur actuellement connecté — jamais
 * celui d'un autre, jamais sans connaître l'actuel : exige que l'actuel
 * soit vérifié en premier, pour qu'un jeton volé ou une session laissée
 * ouverte ne suffise pas à elle seule à verrouiller le vrai propriétaire
 * du compte hors de son propre compte.
 */
export async function changerMotDePassePropre(
  utilisateurId: string,
  motDePasseActuel: string,
  nouveauMotDePasse: string
) {
  const utilisateur = await prisma.utilisateur.findUnique({ where: { id: utilisateurId } });
  if (!utilisateur) {
    throw new ErreurAuthentification();
  }

  const motDePasseActuelValide = await verifierMotDePasse(motDePasseActuel, utilisateur.motDePasseHash);
  if (!motDePasseActuelValide) {
    throw new ErreurAuthentification('Le mot de passe actuel est incorrect.');
  }

  const nouveauHash = await hasherMotDePasse(nouveauMotDePasse);
  await prisma.utilisateur.update({ where: { id: utilisateurId }, data: { motDePasseHash: nouveauHash } });
}
