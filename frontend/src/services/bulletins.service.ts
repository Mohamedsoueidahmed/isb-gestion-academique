import clientApi from './apiClient';
import type { ReponseApi } from '../types/auth.types';
import type { BulletinClasse } from '../types/bulletins.types';

export async function obtenirBulletinClasse(classeId: string): Promise<BulletinClasse> {
  const reponse = await clientApi.get<ReponseApi<BulletinClasse>>(`/bulletins/classes/${classeId}`);
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

/**
 * Télécharge le PDF en passant par notre client Axios (donc avec le token
 * d'authentification automatiquement attaché) plutôt qu'un simple lien
 * <a href>, qui n'enverrait pas l'en-tête Authorization requis par la route.
 */
export async function telechargerBulletinPdf(classeId: string, nomClasse: string): Promise<void> {
  const reponse = await clientApi.get(`/bulletins/classes/${classeId}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([reponse.data]));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `bulletin-${nomClasse}.pdf`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Télécharge le bulletin d'un seul étudiant, identifié par son matricule
 * (transmis en paramètre de requête) — le serveur réduit alors le PDF à
 * cette seule page, plutôt que d'envoyer toute la classe.
 */
export async function telechargerBulletinPdfEtudiant(
  classeId: string,
  matricule: string
): Promise<void> {
  const reponse = await clientApi.get(`/bulletins/classes/${classeId}/pdf`, {
    responseType: 'blob',
    params: { matricule },
  });
  const url = window.URL.createObjectURL(new Blob([reponse.data]));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `bulletin-${matricule}.pdf`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Le bulletin PROPRE d'un étudiant pour un niveau donné — jamais celui
 * de sa classe (qui suppose une vraie inscription là-bas). Pensé pour
 * les dispenses touchant un niveau que l'étudiant n'a jamais réellement
 * suivi.
 */
export async function telechargerBulletinIndividuelPdf(
  inscriptionId: string,
  niveauId: string,
  matricule: string,
  niveauLibelle: string
): Promise<void> {
  const reponse = await clientApi.get(
    `/bulletins/inscriptions/${inscriptionId}/niveaux/${niveauId}/individuel-pdf`,
    { responseType: 'blob' }
  );
  const url = window.URL.createObjectURL(new Blob([reponse.data]));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `bulletin-individuel-${matricule}-${niveauLibelle}.pdf`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.URL.revokeObjectURL(url);
}
