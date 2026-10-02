import { z } from 'zod';

/**
 * Saisie en lot : pour une classe, un cours et une date de séance donnés,
 * on ne transmet que les inscriptions des étudiants ABSENTS — cohérent avec
 * "par défaut, l'étudiant est présent" (règle explicite du projet). Les
 * étudiants non listés ici restent donc présents.
 */
export const schemaSaisieAbsences = z.object({
  classeId: z.string().uuid({ message: 'La classe est requise.' }),
  coursId: z.string().uuid({ message: 'Le cours est requis.' }),
  dateSeance: z.coerce.date({ message: 'La date de séance est requise et doit être valide.' }),
  inscriptionsAbsentes: z.array(z.string().uuid()).default([]),
});

export type DonneesSaisieAbsences = z.infer<typeof schemaSaisieAbsences>;
