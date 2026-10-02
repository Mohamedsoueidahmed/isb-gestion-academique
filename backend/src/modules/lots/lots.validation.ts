import { z } from 'zod';

export const schemaLotSouhaits = z.object({
  coursIds: z
    .array(z.string().uuid())
    .min(1, 'Un lot doit contenir au moins un cours.')
    .max(5, 'Un lot ne peut pas contenir plus de 5 cours.'),
});

export const schemaCreationLot = z.object({
  coursIds: z
    .array(z.string().uuid())
    .min(1, 'Un lot doit contenir au moins un cours.')
    .max(5, 'Un lot ne peut pas contenir plus de 5 cours.'),
  terme: z.enum(['AUTOMNE', 'PRINTEMPS', 'ETE']).optional(),
});

export const schemaUnCours = z.object({
  coursId: z.string().uuid(),
});

export type DonneesLotSouhaits = z.infer<typeof schemaLotSouhaits>;
export type DonneesCreationLot = z.infer<typeof schemaCreationLot>;
