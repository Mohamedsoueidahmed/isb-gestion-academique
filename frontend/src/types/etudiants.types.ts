export interface InscriptionActiveResumee {
  parcours: { nom: string; codeCourt: string };
  classe: { nom: string };
}

export interface Etudiant {
  id: string;
  matricule: string;
  nom: string;
  inn?: string | null;
  dateNaissance?: string | null;
  typeBac?: string | null;
  numeroBac?: string | null;
  statut: 'ACTIF' | 'ARCHIVE' | 'BLOQUE';
  creeLe: string;
  inscriptions?: InscriptionActiveResumee[];
}

export interface InscriptionResumee {
  id: string;
  dateInscription: string;
  statutInscription: 'ACTIVE' | 'CLOTUREE';
  parcours: { nom: string; codeCourt: string };
  niveau: { id: string; libelle: string; ordre: number };
  classe: { nom: string };
  anneeUniversitaire: { id: string; libelle: string };
  _count: { notes: number; composantesEvaluation: number; absences: number; choixElectifs: number; affectationsCours: number };
}

export interface EtudiantAvecHistorique extends Etudiant {
  inscriptions: InscriptionResumee[];
}

export interface NoteInscription {
  inscriptionId: string;
  coursId: string;
  coursCode: string;
  coursTitre: string;
  ueCode: string;
  niveauId: string;
  niveau: string;
  semestre: string;
  terme: 'AUTOMNE' | 'PRINTEMPS' | 'ETE' | null;
  typeSuivi: 'NORMAL' | 'ANTICIPE' | 'EN_RETARD' | null;
  // Le détail des composantes (Devoir, Exposé, Examen...) d'une matière
  // composée — vide ({}) pour une matière dispensée, qui n'en a par
  // définition aucune. Les clés exactes dépendent du cycle (Licence ou
  // Master), jamais fixes d'une inscription à l'autre.
  composantes: Record<string, number | null>;
  moyenne: string | null;
  statutValidation: 'VALIDEE' | 'NON_VALIDEE' | 'EN_ATTENTE_SESSION_2' | null;
  dispense: boolean;
  universiteOrigine: string | null;
}

export interface AbsenceHistorique {
  id: string;
  dateSeance: string;
  cours: { code: string; titre: string; ue: { semestre: { libelle: string } } };
}

export interface DonneesCreationEtudiant {
  matricule: string;
  nom: string;
  inn?: string;
  dateNaissance?: string;
  typeBac?: string;
  numeroBac?: string;
}

export interface DonneesModificationEtudiant {
  matricule?: string;
  nom?: string;
  inn?: string;
  dateNaissance?: string;
  typeBac?: string;
  numeroBac?: string;
}
