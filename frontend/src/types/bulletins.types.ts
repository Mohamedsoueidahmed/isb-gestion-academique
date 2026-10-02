export interface LigneCoursBulletin {
  coursCode: string;
  coursTitre: string;
  composantes: Record<string, number | null>;
  moyenne: string | null;
  statutValidation: 'VALIDEE' | 'NON_VALIDEE' | 'EN_ATTENTE_SESSION_2' | null;
  nombreAbsences: number;
}

export interface GroupeUEBulletin {
  ueCode: string;
  ueCredits: number;
  ueNature: string;
  moyenneUE: number | null;
  statutUE: 'VALIDEE' | 'NON_VALIDEE' | null;
  cours: LigneCoursBulletin[];
}

export interface BulletinEtudiant {
  etudiant: { matricule: string; nom: string };
  ue: GroupeUEBulletin[];
  moyenneSemestre: number | null;
  statutSemestre: 'VALIDE' | 'NON_VALIDE' | null;
  moyenneAnnuelle: number | null;
  statutPassage: 'PASSAGE_ACCORDE' | 'PASSAGE_NON_ACCORDE' | null;
}

export interface BulletinClasse {
  cycle: 'LICENCE' | 'MASTER';
  estFinDeCycle: boolean;
  classe: {
    nom: string;
    parcours: string;
    niveau: string;
    semestre: string;
    anneeUniversitaire: string;
  };
  bulletins: BulletinEtudiant[];
}
