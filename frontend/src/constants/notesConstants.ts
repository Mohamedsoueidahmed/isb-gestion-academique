import type { TypeComposante } from '../types/notes.types';

export const LABELS_STATUT_VALIDATION: Record<string, string> = {
  VALIDEE: 'Validée',
  NON_VALIDEE: 'Non validée',
  EN_ATTENTE_SESSION_2: 'En attente S2',
};

export const CLASSES_STATUT_VALIDATION: Record<string, string> = {
  VALIDEE: 'badge-saisie',
  NON_VALIDEE: 'badge-non-validee',
  EN_ATTENTE_SESSION_2: 'badge-manquante',
};

export const LABELS_COMPOSANTES: Record<TypeComposante, string> = {
  DEVOIR_1: 'Devoir 1',
  DEVOIR_2: 'Devoir 2',
  EXPOSE: 'Exposé',
  EXAMEN_SESSION_1: 'Examen S1',
  EXAMEN_SESSION_2: 'Examen S2',
  DEVOIR: 'Devoir',
};

export const COLONNES_PAR_CYCLE: Record<'LICENCE' | 'MASTER', TypeComposante[]> = {
  LICENCE: ['DEVOIR_1', 'DEVOIR_2', 'EXPOSE', 'EXAMEN_SESSION_1'],
  MASTER: ['DEVOIR', 'EXPOSE', 'EXAMEN_SESSION_1'],
};
