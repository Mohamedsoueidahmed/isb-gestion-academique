export interface AnneeUniversitaire {
  id: string;
  libelle: string;
  dateDebut: string;
  dateFin: string;
  estActive: boolean;
}

export interface Parcours {
  id: string;
  nom: string;
  codeCourt: string;
  formationId: string;
  formation: { nom: string; cycle: 'LICENCE' | 'MASTER' | null };
}

export interface Niveau {
  id: string;
  libelle: string;
  ordre: number;
  parcoursId: string;
}

export interface Semestre {
  id: string;
  libelle: string;
  ordre: number;
  credits: number;
  niveauId: string;
}

export interface Cours {
  id: string;
  code: string;
  titre: string;
  prerequisCode: string | null;
  heures: number | null;
  estElectif: boolean;
  ue: { id: string; code: string; nature: string; credits: number };
}

export interface Classe {
  id: string;
  nom: string;
  effectifMax: number | null;
  anneeUniversitaireId: string;
  parcoursId: string;
  niveauId: string;
  semestreActifId: string;
  anneeUniversitaire: AnneeUniversitaire;
  parcours: Parcours;
  niveau: Niveau;
  semestreActif: Semestre;
  _count?: { inscriptions: number };
}

export interface InscriptionAvecEtudiant {
  id: string;
  etudiant: { id: string; matricule: string; nom: string; statut: 'ACTIF' | 'ARCHIVE' | 'BLOQUE' };
  statutInscription: 'ACTIVE' | 'CLOTUREE';
}

export interface ClasseDetail extends Classe {
  inscriptions: InscriptionAvecEtudiant[];
}

export interface DonneesCreationClasse {
  anneeUniversitaireId: string;
  parcoursId: string;
  niveauId: string;
  nom: string;
  effectifMax?: number;
}

export interface ClasseOptionNiveauSuivant {
  id: string;
  nom: string;
  semestreActif: { libelle: string };
}

export interface OptionNiveauSuivant {
  niveau: { id: string; libelle: string; parcours: { nom: string } };
  classes: ClasseOptionNiveauSuivant[];
}

export interface OptionsInscriptionNiveauSuivant {
  options: OptionNiveauSuivant[];
  anneeSuivante: { id: string; libelle: string } | null;
}
