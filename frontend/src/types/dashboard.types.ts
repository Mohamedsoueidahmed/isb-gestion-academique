export interface StatistiquesGlobales {
  nombreEtudiants: number;
  nombreFormations: number;
  nombreParcours: number;
  nombreClasses: number;
}

export interface EtudiantsParNiveau {
  niveau: { libelle: string } | undefined;
  nombreEtudiants: number;
}

export interface EtudiantsParParcours {
  parcours: { id: string; nom: string; codeCourt: string } | undefined;
  nombreEtudiants: number;
}

export interface EtatSaisieClasse {
  classeId: string;
  nom: string;
  parcours: string;
  niveau: string;
  semestreActif: string;
  totalInscriptions: number;
  pourcentageSaisieNotes: number;
  pourcentageSaisieAbsences: number;
}
