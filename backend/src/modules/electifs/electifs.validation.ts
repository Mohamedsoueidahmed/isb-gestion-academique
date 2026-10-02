import { z } from 'zod';

export const schemaAssignationElectif = z.object({
  inscriptionId: z.string().uuid({ message: "L'inscription est requise." }),
  ueId: z.string().uuid({ message: 'Le créneau électif (UE) est requis.' }),
  codeCoursElectif: z.string().min(1, { message: 'Le cours électif choisi est requis.' }),
  terme: z.enum(['AUTOMNE', 'PRINTEMPS', 'ETE']).optional(),
});

export type DonneesAssignationElectif = z.infer<typeof schemaAssignationElectif>;

/**
 * Ajout d'un nouveau cours au catalogue électif — le catalogue fourni au
 * départ n'est jamais exhaustif, l'administration doit pouvoir l'étendre.
 * Une fois ajouté ici, il devient immédiatement choisissable pour tout
 * étudiant, exactement comme les entrées d'origine.
 */
export const schemaAjoutCatalogueElectif = z.object({
  code: z.string().min(1, { message: 'Le code du cours est requis.' }).max(30),
  titre: z.string().min(1, { message: 'Le titre du cours est requis.' }).max(200),
  prerequisCode: z.string().max(30).nullable().optional(),
  heures: z.number().int().positive().nullable().optional(),
  credits: z.number().int().positive().nullable().optional(),
});

export type DonneesAjoutCatalogueElectif = z.infer<typeof schemaAjoutCatalogueElectif>;
