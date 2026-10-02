import { z } from 'zod';

export const schemaConnexion = z.object({
  email: z.string().email({ message: 'Adresse email invalide.' }),
  motDePasse: z.string().min(1, { message: 'Le mot de passe est requis.' }),
});

export type DonneesConnexion = z.infer<typeof schemaConnexion>;

export const schemaChangementMotDePasse = z.object({
  motDePasseActuel: z.string().min(1, { message: 'Le mot de passe actuel est requis.' }),
  nouveauMotDePasse: z.string().min(12, { message: 'Le nouveau mot de passe doit contenir au moins 12 caractères.' }),
});

export type DonneesChangementMotDePasse = z.infer<typeof schemaChangementMotDePasse>;
