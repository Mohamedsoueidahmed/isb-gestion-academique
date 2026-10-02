export interface CoursEligible {
  id: string;
  code: string;
  titre: string;
  prerequisCode: string | null;
  heures: number | null;
  estElectif: boolean;
}

export interface StatistiqueDemandeCours {
  coursId: string;
  code: string;
  titre: string;
  ueCode: string;
  semestreLibelle: string;
  nombreSouhaits: number;
}

export interface CoursHorsDePortee extends CoursEligible {
  prerequisManquant: CoursEligible | null;
}

export interface EtatParcoursFlexible {
  valides: CoursEligible[];
  enAttente: CoursEligible[];
  echouesDefinitivement: CoursEligible[];
  horsDePortee: CoursHorsDePortee[];
  finDeCycleVerrouille: CoursEligible[];
  souhaites: CoursEligible[];
  eligiblesNouveaux: CoursEligible[];
}

export interface SouhaitEtudiant {
  id: string;
  inscriptionId: string;
  coursId: string;
  cours: CoursEligible;
}

export interface AffectationCours {
  id: string;
  inscriptionId: string;
  coursId: string;
  numeroLot: number;
  creeLe: string;
}

export interface CoursDuLot {
  coursId: string;
  cours: { code: string; titre: string };
}

export interface Lot {
  id: string;
  niveauId: string;
  numero: number;
  statut: 'OUVERT' | 'FERME';
  terme: 'AUTOMNE' | 'PRINTEMPS' | 'ETE' | null;
  dateOuverture: string;
  dateFermeture: string | null;
  cours: CoursDuLot[];
}

export interface CoursDuGroupeTerme {
  id: string;
  code: string;
  titre: string;
  ueCode: string;
}

export interface GroupeCoursTerme {
  terme: 'AUTOMNE' | 'PRINTEMPS' | 'ETE' | null;
  cours: CoursDuGroupeTerme[];
}

export interface EtudiantSurCours {
  matricule: string;
  nom: string;
}

export interface CoursAvecEtudiants extends CoursDuGroupeTerme {
  etudiants: EtudiantSurCours[];
}

export interface GroupeEtudiantsParCours {
  terme: 'AUTOMNE' | 'PRINTEMPS' | 'ETE' | null;
  cours: CoursAvecEtudiants[];
}

export interface ResultatOuverture {
  lot: Lot;
  convertis: { id: string; matricule: string; nom: string }[];
  laissesEnAttente: { id: string; matricule: string; nom: string }[];
}

export interface CoursNonValide {
  code: string;
  titre: string;
  statut: string | null;
}

export interface EtatTerme {
  terme: 'AUTOMNE' | 'PRINTEMPS' | 'ETE';
  touche: boolean;
  termine: boolean;
  coursNonValides: CoursNonValide[];
}

export interface EtatAnnee {
  termes: EtatTerme[];
  anneeTerminee: boolean;
  matieresNonValidees: CoursNonValide[];
  classeATermineTousSesTermes: boolean;
  anneeFermee: boolean;
}
