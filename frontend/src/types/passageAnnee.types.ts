export interface DetailSemestrePassage {
  libelle: string;
  moyenne: string | null;
}

export interface PassageAnnee {
  semestres: {
    s1: DetailSemestrePassage | null;
    s2: DetailSemestrePassage | null;
  };
  moyenneAnnuelle: string | null;
  statutPassage: 'PASSAGE_ACCORDE' | 'PASSAGE_NON_ACCORDE' | null;
}
