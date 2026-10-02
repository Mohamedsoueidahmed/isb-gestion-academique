export interface CoursElectifCatalogue {
  id: string;
  code: string;
  titre: string;
  prerequisCode: string | null;
  heures: number | null;
  credits: number | null;
}

export interface DonneesAjoutCatalogueElectif {
  code: string;
  titre: string;
  prerequisCode?: string | null;
  heures?: number | null;
  credits?: number | null;
}

export interface CreneauElectif {
  id: string;
  code: string;
  nature: string;
  credits: number;
  choixExclusif: boolean;
  cours: { code: string; titre: string }[];
}

export interface ChoixElectifEtudiant {
  inscriptionId: string;
  etudiant: { matricule: string; nom: string };
  choixActuel: { code: string; titre: string; terme: 'AUTOMNE' | 'PRINTEMPS' | 'ETE' | null } | null;
}
