export interface LignePresence {
  inscriptionId: string;
  etudiant: { id: string; matricule: string; nom: string };
  present: boolean;
}

export interface DonneesSaisieAbsences {
  classeId: string;
  coursId: string;
  dateSeance: string; // format AAAA-MM-JJ
  inscriptionsAbsentes: string[];
}

export interface SeanceHistorique {
  dateSeance: string;
  totalInscrits: number;
  absents: { matricule: string; nom: string }[];
}
