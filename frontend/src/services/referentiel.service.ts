import clientApi from './apiClient';
import type { ReponseApi } from '../types/auth.types';
import type { AnneeUniversitaire, Parcours, Niveau, Semestre, Cours } from '../types/classes.types';

export async function listerAnneesUniversitaires(): Promise<AnneeUniversitaire[]> {
  const reponse = await clientApi.get<ReponseApi<AnneeUniversitaire[]>>('/referentiel/annees-universitaires');
  return reponse.data.donnees ?? [];
}

export interface DonneesCreationAnnee {
  libelle: string;
  dateDebut: string;
  dateFin: string;
  estActive?: boolean;
}

export interface ResultatCreationAnnee {
  annee: AnneeUniversitaire;
  classesCreees: string[];
}

/**
 * Crée une année universitaire ET ses 9 classes en une seule action — la
 * création et l'activation ne sont plus deux étapes séparées.
 */
export async function creerAnneeUniversitaire(donnees: DonneesCreationAnnee): Promise<ResultatCreationAnnee> {
  const reponse = await clientApi.post<ReponseApi<ResultatCreationAnnee>>(
    '/referentiel/annees-universitaires',
    donnees
  );
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

/**
 * Supprime une année universitaire, uniquement possible si aucune classe
 * n'existe pour elle.
 */
export async function supprimerAnneeUniversitaire(id: string): Promise<void> {
  await clientApi.delete(`/referentiel/annees-universitaires/${id}`);
}

/**
 * Marque cette année comme active — celle que le sélecteur retrouve par
 * défaut à chaque connexion. Désactive automatiquement l'ancienne.
 */
export async function definirAnneeActive(id: string): Promise<void> {
  await clientApi.patch(`/referentiel/annees-universitaires/${id}/activer`);
}

export async function listerParcours(): Promise<Parcours[]> {
  const reponse = await clientApi.get<ReponseApi<Parcours[]>>('/referentiel/parcours');
  return reponse.data.donnees ?? [];
}

export async function listerNiveauxParParcours(parcoursId: string): Promise<Niveau[]> {
  const reponse = await clientApi.get<ReponseApi<Niveau[]>>(`/referentiel/parcours/${parcoursId}/niveaux`);
  return reponse.data.donnees ?? [];
}

export async function listerSemestresParNiveau(niveauId: string): Promise<Semestre[]> {
  const reponse = await clientApi.get<ReponseApi<Semestre[]>>(`/referentiel/niveaux/${niveauId}/semestres`);
  return reponse.data.donnees ?? [];
}

export async function listerCoursParSemestre(semestreId: string): Promise<Cours[]> {
  const reponse = await clientApi.get<ReponseApi<Cours[]>>(`/referentiel/semestres/${semestreId}/cours`);
  return reponse.data.donnees ?? [];
}
