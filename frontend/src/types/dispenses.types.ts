export interface MatiereAvecStatutDispense {
  coursId: string;
  code: string;
  titre: string;
  semestre: string;
  ordreSemestre: number;
  dejaAffecte: boolean;
  dispense: boolean;
  universiteOrigine: string | null;
  noteRetenue: string | null;
}
