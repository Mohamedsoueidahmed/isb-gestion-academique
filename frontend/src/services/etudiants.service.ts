import clientApi from './apiClient';
import type { ReponseApi } from '../types/auth.types';
import type {
  Etudiant,
  EtudiantAvecHistorique,
  AbsenceHistorique,
  NoteInscription,
  DonneesCreationEtudiant,
  DonneesModificationEtudiant,
} from '../types/etudiants.types';

export async function rechercherEtudiants(recherche?: string, anneeUniversitaireId?: string): Promise<Etudiant[]> {
  const reponse = await clientApi.get<ReponseApi<Etudiant[]>>('/etudiants', {
    params: {
      ...(recherche ? { recherche } : {}),
      ...(anneeUniversitaireId ? { anneeUniversitaireId } : {}),
    },
  });
  return reponse.data.donnees ?? [];
}

export async function creerEtudiant(donnees: DonneesCreationEtudiant): Promise<Etudiant> {
  const reponse = await clientApi.post<ReponseApi<Etudiant>>('/etudiants', donnees);
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

/**
 * Retrouve un étudiant par son matricule, ou null s'il n'en existe aucun
 * — utilisé avant toute création, pour reprendre le parcours d'un
 * étudiant déjà connu plutôt que d'échouer sur un doublon.
 */
export async function trouverEtudiantParMatricule(matricule: string): Promise<Etudiant | null> {
  const reponse = await clientApi.get<ReponseApi<Etudiant | null>>(`/etudiants/par-matricule/${matricule}`);
  return reponse.data.donnees ?? null;
}

export async function modifierEtudiant(id: string, donnees: DonneesModificationEtudiant): Promise<Etudiant> {
  const reponse = await clientApi.patch<ReponseApi<Etudiant>>(`/etudiants/${id}`, donnees);
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

export async function supprimerEtudiant(id: string): Promise<void> {
  await clientApi.delete(`/etudiants/${id}`);
}

/**
 * Bloque un étudiant : il disparaît de toutes les listes sauf celle de sa
 * classe, où il reste visible pour permettre de le débloquer. Rien n'est
 * supprimé — inscriptions, notes, absences restent intactes.
 */
export async function bloquerEtudiant(id: string): Promise<Etudiant> {
  const reponse = await clientApi.patch<ReponseApi<Etudiant>>(`/etudiants/${id}/bloquer`);
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

export async function debloquerEtudiant(id: string): Promise<Etudiant> {
  const reponse = await clientApi.patch<ReponseApi<Etudiant>>(`/etudiants/${id}/debloquer`);
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

export async function obtenirEtudiantParId(id: string): Promise<EtudiantAvecHistorique> {
  const reponse = await clientApi.get<ReponseApi<EtudiantAvecHistorique>>(`/etudiants/${id}`);
  if (!reponse.data.donnees) throw new Error('Étudiant introuvable.');
  return reponse.data.donnees;
}

/**
 * Inscrit un étudiant simultanément dans les deux semestres (S1 et S2) du
 * niveau correspondant à la classe choisie — le backend retrouve seul la
 * classe sœur de l'autre semestre, aucun autre champ à fournir.
 */
export async function creerInscription(etudiantId: string, classeId: string): Promise<void> {
  await clientApi.post('/etudiants/inscriptions', { etudiantId, classeId });
}

/**
 * Change la classe d'un étudiant. Le backend décide seul (et de façon
 * transparente pour l'écran) s'il modifie l'inscription existante ou en
 * crée une nouvelle — selon que des notes/absences existent déjà.
 */
export async function changerClasseInscription(inscriptionId: string, nouvelleClasseId: string): Promise<void> {
  await clientApi.patch(`/etudiants/inscriptions/${inscriptionId}/classe`, { nouvelleClasseId });
}

export async function obtenirHistoriqueAbsences(inscriptionId: string): Promise<AbsenceHistorique[]> {
  const reponse = await clientApi.get<ReponseApi<AbsenceHistorique[]>>(
    `/absences/inscriptions/${inscriptionId}/historique`
  );
  return reponse.data.donnees ?? [];
}

export async function obtenirNotesInscription(inscriptionId: string): Promise<NoteInscription[]> {
  const reponse = await clientApi.get<ReponseApi<NoteInscription[]>>(`/notes/inscriptions/${inscriptionId}`);
  return reponse.data.donnees ?? [];
}
