import clientApi from './apiClient';
import type { ReponseApi } from '../types/auth.types';
import type { LignePresence, DonneesSaisieAbsences, SeanceHistorique } from '../types/absences.types';

export async function obtenirFeuilleSeance(
  classeId: string,
  coursId: string,
  date: string
): Promise<LignePresence[]> {
  const reponse = await clientApi.get<ReponseApi<LignePresence[]>>(
    `/absences/classes/${classeId}/cours/${coursId}/seance`,
    { params: { date } }
  );
  return reponse.data.donnees ?? [];
}

export async function saisirAbsences(donnees: DonneesSaisieAbsences): Promise<void> {
  await clientApi.post('/absences', donnees);
}

/**
 * Historique de toutes les séances enregistrées pour un cours, dans une
 * classe donnée — pour consultation, pas pour saisie.
 */
export async function obtenirHistoriqueSeancesParCours(
  classeId: string,
  coursId: string
): Promise<SeanceHistorique[]> {
  const reponse = await clientApi.get<ReponseApi<SeanceHistorique[]>>(
    `/absences/classes/${classeId}/cours/${coursId}/historique`
  );
  return reponse.data.donnees ?? [];
}

/**
 * Télécharge le PDF des absences d'un Terme pour une classe — une page
 * par cours réellement affecté, même style que les bulletins et l'export
 * de notes.
 */
export async function telechargerExportAbsencesPdf(classeId: string, terme: string | null): Promise<void> {
  const reponse = await clientApi.get(`/absences/classes/${classeId}/export-pdf`, {
    params: terme ? { terme } : {},
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([reponse.data]));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `absences-${terme ?? 'sans-terme'}.pdf`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.URL.revokeObjectURL(url);
}
