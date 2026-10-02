import clientApi from './apiClient';
import type { ReponseApi } from '../types/auth.types';
import type { Classe, ClasseDetail, DonneesCreationClasse, OptionsInscriptionNiveauSuivant } from '../types/classes.types';

export interface FiltresClasse {
  anneeUniversitaireId?: string;
  parcoursId?: string;
  niveauId?: string;
  semestreActifId?: string;
}

export async function listerClasses(filtres?: FiltresClasse): Promise<Classe[]> {
  const reponse = await clientApi.get<ReponseApi<Classe[]>>('/classes', { params: filtres });
  return reponse.data.donnees ?? [];
}

export async function creerClasse(donnees: DonneesCreationClasse): Promise<Classe> {
  const reponse = await clientApi.post<ReponseApi<Classe>>('/classes', donnees);
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

export async function obtenirClasseParId(id: string): Promise<ClasseDetail> {
  const reponse = await clientApi.get<ReponseApi<ClasseDetail>>(`/classes/${id}`);
  if (!reponse.data.donnees) throw new Error('Classe introuvable.');
  return reponse.data.donnees;
}

export interface DonneesModificationClasse {
  nom?: string;
  effectifMax?: number | null;
}

export async function modifierClasse(id: string, donnees: DonneesModificationClasse): Promise<Classe> {
  const reponse = await clientApi.patch<ReponseApi<Classe>>(`/classes/${id}`, donnees);
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

export async function supprimerClasse(id: string): Promise<void> {
  await clientApi.delete(`/classes/${id}`);
}

/**
 * Bascule le semestre actif d'une classe (S1 → S2, jamais l'inverse) —
 * action explicite et délibérée, jamais automatique.
 */
export async function basculerSemestreActif(id: string): Promise<Classe> {
  const reponse = await clientApi.patch<ReponseApi<Classe>>(`/classes/${id}/basculer-semestre`);
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

/**
 * Retourne les classes disponibles au niveau suivant (et à l'année
 * universitaire suivante), pour le bouton "Inscrire au niveau suivant" —
 * visible uniquement quand le passage a été accordé.
 */
export async function obtenirOptionsInscriptionNiveauSuivant(
  niveauId: string,
  anneeId: string
): Promise<OptionsInscriptionNiveauSuivant> {
  const reponse = await clientApi.get<ReponseApi<OptionsInscriptionNiveauSuivant>>('/classes/niveau-suivant', {
    params: { niveauId, anneeId },
  });
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

/**
 * Télécharge la liste des étudiants d'une classe (informations prises à
 * l'inscription) en passant par notre client Axios, pour que le jeton
 * d'authentification soit bien joint à la requête.
 */
export async function telechargerListeEtudiantsPdf(classeId: string, nomClasse: string): Promise<void> {
  const reponse = await clientApi.get(`/classes/${classeId}/liste-etudiants-pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([reponse.data]));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `liste-etudiants-${nomClasse}.pdf`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.URL.revokeObjectURL(url);
}
