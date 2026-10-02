import { z } from 'zod';

/**
 * Une classe est créée pour un niveau entier (S1 et S2 ensemble), plus par
 * semestre séparément — semestreActifId est dérivé automatiquement (le
 * premier semestre du niveau) au moment de la création, jamais choisi ici.
 */
export const schemaCreationClasse = z.object({
  anneeUniversitaireId: z.string().uuid({ message: "L'année universitaire est requise." }),
  parcoursId: z.string().uuid({ message: 'Le parcours est requis.' }),
  niveauId: z.string().uuid({ message: 'Le niveau est requis.' }),
  nom: z.string().min(1, { message: 'Le nom de la classe est requis.' }).max(100),
  effectifMax: z.number().int().positive().nullable().optional(),
});

export type DonneesCreationClasse = z.infer<typeof schemaCreationClasse>;

/**
 * Tous les champs sont optionnels. Le contexte (parcours/niveau/année)
 * n'est modifiable que si la classe n'a encore aucune inscription — vérifié
 * côté service. semestreActifId n'apparaît volontairement pas ici : la
 * bascule S1→S2 est une action explicite et délibérée de l'administration
 * (son propre bouton, sa propre route), jamais un champ modifiable parmi
 * d'autres dans un formulaire générique.
 */
export const schemaModificationClasse = z.object({
  nom: z.string().min(1).max(100).optional(),
  effectifMax: z.number().int().positive().nullable().optional(),
  anneeUniversitaireId: z.string().uuid().optional(),
  parcoursId: z.string().uuid().optional(),
  niveauId: z.string().uuid().optional(),
});

export type DonneesModificationClasse = z.infer<typeof schemaModificationClasse>;

export const schemaFiltresClasse = z.object({
  anneeUniversitaireId: z.string().uuid().optional(),
  parcoursId: z.string().uuid().optional(),
  niveauId: z.string().uuid().optional(),
  semestreActifId: z.string().uuid().optional(),
});

export type FiltresClasse = z.infer<typeof schemaFiltresClasse>;
