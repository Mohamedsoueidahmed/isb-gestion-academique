import clientApi from './apiClient';
import type { ReponseApi } from '../types/auth.types';
import type {
  CoursElectifCatalogue,
  CreneauElectif,
  ChoixElectifEtudiant,
  DonneesAjoutCatalogueElectif,
} from '../types/electifs.types';

export async function listerCatalogueElectifs(classeId: string): Promise<CoursElectifCatalogue[]> {
  const reponse = await clientApi.get<ReponseApi<CoursElectifCatalogue[]>>(
    `/electifs/classes/${classeId}/catalogue`
  );
  return reponse.data.donnees ?? [];
}

/**
 * Ajoute un nouveau cours au catalogue électif de la formation de cette
 * classe — le catalogue fourni au départ n'est jamais exhaustif,
 * l'administration peut l'étendre. Le nouveau cours devient immédiatement
 * choisissable pour tout étudiant de CETTE formation, jamais visible
 * depuis une autre.
 */
export async function ajouterCoursElectifCatalogue(
  classeId: string,
  donnees: DonneesAjoutCatalogueElectif
): Promise<CoursElectifCatalogue> {
  const reponse = await clientApi.post<ReponseApi<CoursElectifCatalogue>>(
    `/electifs/classes/${classeId}/catalogue`,
    donnees
  );
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

export async function listerCreneauxElectifsPourClasse(classeId: string): Promise<CreneauElectif[]> {
  const reponse = await clientApi.get<ReponseApi<CreneauElectif[]>>(`/electifs/classes/${classeId}/creneaux`);
  return reponse.data.donnees ?? [];
}

export async function listerChoixPourCreneauEtClasse(
  classeId: string,
  ueId: string
): Promise<ChoixElectifEtudiant[]> {
  const reponse = await clientApi.get<ReponseApi<ChoixElectifEtudiant[]>>(
    `/electifs/classes/${classeId}/creneaux/${ueId}/choix`
  );
  return reponse.data.donnees ?? [];
}

export async function assignerChoixElectif(
  inscriptionId: string,
  ueId: string,
  codeCoursElectif: string,
  terme?: 'AUTOMNE' | 'PRINTEMPS' | 'ETE'
): Promise<void> {
  await clientApi.post('/electifs/choix', { inscriptionId, ueId, codeCoursElectif, terme });
}

export async function retirerChoixElectif(inscriptionId: string, ueId: string): Promise<void> {
  await clientApi.delete(`/electifs/choix/${inscriptionId}/${ueId}`);
}
