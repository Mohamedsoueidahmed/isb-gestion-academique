import clientApi from './apiClient';
import type { ReponseApi } from '../types/auth.types';
import type {
  StatistiquesGlobales,
  EtudiantsParNiveau,
  EtudiantsParParcours,
  EtatSaisieClasse,
} from '../types/dashboard.types';

export async function obtenirStatistiquesGlobales(anneeUniversitaireId?: string): Promise<StatistiquesGlobales> {
  const reponse = await clientApi.get<ReponseApi<StatistiquesGlobales>>('/dashboard/statistiques-globales', {
    params: anneeUniversitaireId ? { anneeUniversitaireId } : {},
  });
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

export async function obtenirEtudiantsParNiveau(anneeUniversitaireId?: string): Promise<EtudiantsParNiveau[]> {
  const reponse = await clientApi.get<ReponseApi<EtudiantsParNiveau[]>>('/dashboard/etudiants-par-niveau', {
    params: anneeUniversitaireId ? { anneeUniversitaireId } : {},
  });
  return reponse.data.donnees ?? [];
}

export async function obtenirEtudiantsParParcours(anneeUniversitaireId?: string): Promise<EtudiantsParParcours[]> {
  const reponse = await clientApi.get<ReponseApi<EtudiantsParParcours[]>>('/dashboard/etudiants-par-parcours', {
    params: anneeUniversitaireId ? { anneeUniversitaireId } : {},
  });
  return reponse.data.donnees ?? [];
}

export async function obtenirEtatSaisieClasses(anneeUniversitaireId?: string): Promise<EtatSaisieClasse[]> {
  const reponse = await clientApi.get<ReponseApi<EtatSaisieClasse[]>>('/dashboard/etat-saisie-classes', {
    params: anneeUniversitaireId ? { anneeUniversitaireId } : {},
  });
  return reponse.data.donnees ?? [];
}
