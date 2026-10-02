import clientApi from './apiClient';
import type { ReponseApi } from '../types/auth.types';
import type { EtudiantRattrapage } from '../types/rattrapage.types';

export async function obtenirEtudiantsRattrapage(anneeUniversitaireId?: string): Promise<EtudiantRattrapage[]> {
  const reponse = await clientApi.get<ReponseApi<EtudiantRattrapage[]>>('/notes/rattrapage', {
    params: anneeUniversitaireId ? { anneeUniversitaireId } : {},
  });
  return reponse.data.donnees ?? [];
}

/**
 * Télécharge le PDF de la liste de rattrapage — même style que les
 * bulletins et les autres exports, groupé par Parcours puis Niveau puis
 * Classe puis Cours.
 */
export async function telechargerExportRattrapagePdf(anneeUniversitaireId?: string): Promise<void> {
  const reponse = await clientApi.get('/notes/rattrapage/export-pdf', {
    params: anneeUniversitaireId ? { anneeUniversitaireId } : {},
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([reponse.data]));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = 'rattrapage.pdf';
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.URL.revokeObjectURL(url);
}
