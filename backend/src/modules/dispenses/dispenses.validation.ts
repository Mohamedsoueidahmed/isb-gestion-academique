import { z } from 'zod';

export const schemaDispense = z.object({
  coursId: z.string().min(1, { message: 'Le cours est requis.' }),
  universiteOrigine: z.string().min(1, { message: "L'université d'origine est requise." }),
  noteRetenue: z
    .number()
    .min(0, { message: 'La note retenue doit être comprise entre 0 et 20.' })
    .max(20, { message: 'La note retenue doit être comprise entre 0 et 20.' }),
});
