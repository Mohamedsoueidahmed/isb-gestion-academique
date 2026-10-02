import clientApi from './apiClient';
import type { ReponseApi } from '../types/auth.types';
import type { NotesClasseCours, DonneesSaisieComposante, EtudiantAvecComposantes } from '../types/notes.types';

export async function obtenirNotesCoursPourClasse(classeId: string, coursId: string): Promise<NotesClasseCours> {
  const reponse = await clientApi.get<ReponseApi<NotesClasseCours>>(`/notes/classes/${classeId}/cours/${coursId}`);
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

export async function saisirComposante(donnees: DonneesSaisieComposante): Promise<void> {
  await clientApi.post('/notes', donnees);
}

/**
 * Télécharge le PDF des notes d'un Terme pour une classe — une page par
 * cours réellement affecté, même style que les bulletins.
 */
export async function telechargerExportNotesPdf(classeId: string, terme: string | null): Promise<void> {
  const reponse = await clientApi.get(`/notes/classes/${classeId}/export-pdf`, {
    params: terme ? { terme } : {},
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([reponse.data]));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `notes-${terme ?? 'sans-terme'}.pdf`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Récupère l'état à jour d'un seul étudiant après la sauvegarde d'une
 * composante — plutôt que de recalculer la moyenne/statut/session2Visible
 * côté frontend (ce qui dupliquerait le moteur de calcul et risquerait de
 * diverger du backend), on redemande la vérité au serveur pour cette seule
 * ligne, sans recharger toute la classe.
 */
export async function obtenirComposantesInscriptionCours(
  inscriptionId: string,
  coursId: string
): Promise<Omit<EtudiantAvecComposantes, 'inscriptionId' | 'etudiant'>> {
  const reponse = await clientApi.get<ReponseApi<Omit<EtudiantAvecComposantes, 'inscriptionId' | 'etudiant'>>>(
    `/notes/inscriptions/${inscriptionId}/cours/${coursId}`
  );
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}
