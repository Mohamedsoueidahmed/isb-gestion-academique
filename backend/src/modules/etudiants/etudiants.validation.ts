import { z } from 'zod';

export const schemaCreationEtudiant = z.object({
  matricule: z.string().min(1, { message: 'Le matricule est requis.' }).max(30),
  nom: z.string().min(1, { message: 'Le nom est requis.' }).max(150),
  inn: z.string().max(50).optional(),
  dateNaissance: z.string().optional(),
  typeBac: z.string().max(100).optional(),
  numeroBac: z.string().max(50).optional(),
});

export type DonneesCreationEtudiant = z.infer<typeof schemaCreationEtudiant>;

/**
 * Modification de la fiche — tous les champs optionnels, pour permettre de
 * ne corriger qu'un seul champ (ex. juste le matricule) sans devoir renvoyer
 * les autres inchangés.
 */
export const schemaModificationEtudiant = z.object({
  matricule: z.string().min(1).max(30).optional(),
  nom: z.string().min(1).max(150).optional(),
  inn: z.string().max(50).optional(),
  dateNaissance: z.string().optional(),
  typeBac: z.string().max(100).optional(),
  numeroBac: z.string().max(50).optional(),
});

export type DonneesModificationEtudiant = z.infer<typeof schemaModificationEtudiant>;

export const schemaChangementClasse = z.object({
  nouvelleClasseId: z.string().uuid({ message: 'La nouvelle classe est requise.' }),
});

export type DonneesChangementClasse = z.infer<typeof schemaChangementClasse>;

/**
 * Une classe couvrant maintenant tout un niveau (S1 et S2 ensemble), une
 * inscription ne nécessite plus que l'étudiant et la classe — tout le reste
 * (parcours, niveau, année) est dérivé depuis la classe elle-même.
 */
export const schemaCreationInscription = z.object({
  etudiantId: z.string().uuid({ message: "L'étudiant est requis." }),
  classeId: z.string().uuid({ message: 'La classe est requise.' }),
});

export type DonneesCreationInscription = z.infer<typeof schemaCreationInscription>;

export const schemaRechercheEtudiant = z.object({
  recherche: z.string().optional(), // recherche libre sur nom ou matricule
  anneeUniversitaireId: z.string().uuid().optional(),
});

export type DonneesRechercheEtudiant = z.infer<typeof schemaRechercheEtudiant>;
