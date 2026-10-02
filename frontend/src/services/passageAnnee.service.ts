import clientApi from './apiClient';
import type { ReponseApi } from '../types/auth.types';
import type { PassageAnnee } from '../types/passageAnnee.types';

export async function obtenirPassageAnnee(
  etudiantId: string,
  anneeUniversitaireId: string,
  niveauId: string
): Promise<PassageAnnee> {
  const reponse = await clientApi.get<ReponseApi<PassageAnnee>>('/notes/passage-annee', {
    params: { etudiantId, anneeUniversitaireId, niveauId },
  });
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}
