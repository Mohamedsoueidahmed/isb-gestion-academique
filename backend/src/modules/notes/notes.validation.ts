import { z } from 'zod';

/**
 * Les six types de composantes possibles, toutes formations confondues.
 * La cohérence avec le cycle (Licence vs Master) est vérifiée côté service,
 * pas ici — ce schéma valide seulement la forme, pas la logique métier.
 */
export const schemaTypeComposante = z.enum([
  'DEVOIR_1',
  'DEVOIR_2',
  'EXPOSE',
  'EXAMEN_SESSION_1',
  'EXAMEN_SESSION_2',
  'DEVOIR',
]);

/**
 * Une composante est comprise entre 0 et 20, avec au plus deux décimales —
 * cohérent avec le champ Decimal(4,2) du schéma.
 */
export const schemaSaisieComposante = z.object({
  inscriptionId: z.string().uuid({ message: "L'inscription est requise." }),
  coursId: z.string().uuid({ message: 'Le cours est requis.' }),
  type: schemaTypeComposante,
  valeur: z
    .number()
    .min(0, { message: 'La note ne peut pas être négative.' })
    .max(20, { message: 'La note ne peut pas dépasser 20.' })
    .nullable(), // null = effacer une composante déjà saisie
});

export type DonneesSaisieComposante = z.infer<typeof schemaSaisieComposante>;

export const schemaConsultationNotesCours = z.object({
  classeId: z.string().uuid({ message: 'La classe est requise.' }),
  coursId: z.string().uuid({ message: 'Le cours est requis.' }),
});

export type DonneesConsultationNotesCours = z.infer<typeof schemaConsultationNotesCours>;
