import clientApi from './apiClient';
import type { ReponseApi } from '../types/auth.types';
import type { MatiereAvecStatutDispense } from '../types/dispenses.types';

export interface ParcoursDeLInscription {
  parcoursId: string;
  parcoursNom: string;
  formationNom: string;
}

export async function obtenirParcoursDeLInscription(inscriptionId: string): Promise<ParcoursDeLInscription> {
  const reponse = await clientApi.get<ReponseApi<ParcoursDeLInscription>>(
    `/dispenses/inscriptions/${inscriptionId}/parcours`
  );
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

export async function listerMatieresParNiveau(inscriptionId: string, niveauId: string): Promise<MatiereAvecStatutDispense[]> {
  const reponse = await clientApi.get<ReponseApi<MatiereAvecStatutDispense[]>>(
    `/dispenses/inscriptions/${inscriptionId}/matieres`,
    { params: { niveauId } }
  );
  return reponse.data.donnees ?? [];
}

export async function marquerDispense(
  inscriptionId: string,
  coursId: string,
  universiteOrigine: string,
  noteRetenue: number
): Promise<void> {
  await clientApi.post(`/dispenses/inscriptions/${inscriptionId}/dispenser`, { coursId, universiteOrigine, noteRetenue });
}

export async function retirerDispense(inscriptionId: string, coursId: string): Promise<void> {
  await clientApi.delete(`/dispenses/inscriptions/${inscriptionId}/dispenser/${coursId}`);
}
