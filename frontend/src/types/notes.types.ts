export type TypeComposante = 'DEVOIR_1' | 'DEVOIR_2' | 'EXPOSE' | 'EXAMEN_SESSION_1' | 'EXAMEN_SESSION_2' | 'DEVOIR';
export type CycleFormation = 'LICENCE' | 'MASTER';
export type StatutValidation = 'VALIDEE' | 'NON_VALIDEE' | 'EN_ATTENTE_SESSION_2';

export interface EtudiantAvecComposantes {
  inscriptionId: string;
  etudiant: { id: string; matricule: string; nom: string };
  composantes: Partial<Record<TypeComposante, number | null>>;
  session2Visible: boolean;
  moyenne: string | null;
  statutValidation: StatutValidation | null;
}

export interface NotesClasseCours {
  cycle: CycleFormation;
  etudiants: EtudiantAvecComposantes[];
}

export interface DonneesSaisieComposante {
  inscriptionId: string;
  coursId: string;
  type: TypeComposante;
  valeur: number | null;
}
