export interface EtudiantRattrapage {
  inscriptionId: string;
  coursId: string;
  etudiant: { matricule: string; nom: string };
  parcours: string;
  niveau: string;
  classe: string;
  coursCode: string;
  coursTitre: string;
  moyenneSession1: string | null;
}
