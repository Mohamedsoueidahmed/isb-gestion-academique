import { z } from 'zod';

export const schemaCreationAnneeUniversitaire = z.object({
  libelle: z
    .string()
    .regex(/^\d{4}-\d{4}$/, { message: 'Le libellé doit être au format AAAA-AAAA (ex. 2027-2028).' }),
  dateDebut: z.string().min(1, { message: 'La date de début est requise.' }),
  dateFin: z.string().min(1, { message: 'La date de fin est requise.' }),
  estActive: z.boolean().optional(),
});

export type DonneesCreationAnneeUniversitaire = z.infer<typeof schemaCreationAnneeUniversitaire>;
