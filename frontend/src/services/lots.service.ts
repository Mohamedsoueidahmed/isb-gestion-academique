import clientApi from './apiClient';
import type { ReponseApi } from '../types/auth.types';
import type {
  CoursEligible,
  StatistiqueDemandeCours,
  EtatParcoursFlexible,
  SouhaitEtudiant,
  ResultatOuverture,
  Lot,
  GroupeCoursTerme,
  GroupeEtudiantsParCours,
  EtatAnnee,
} from '../types/lots.types';

export async function listerCoursEligibles(inscriptionId: string): Promise<CoursEligible[]> {
  const reponse = await clientApi.get<ReponseApi<CoursEligible[]>>(
    `/lots/inscriptions/${inscriptionId}/eligibles`
  );
  return reponse.data.donnees ?? [];
}

export async function obtenirEtatParcoursFlexible(inscriptionId: string): Promise<EtatParcoursFlexible> {
  const reponse = await clientApi.get<ReponseApi<EtatParcoursFlexible>>(
    `/lots/inscriptions/${inscriptionId}/etat`
  );
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

export async function obtenirStatistiquesDemande(niveauId: string): Promise<StatistiqueDemandeCours[]> {
  const reponse = await clientApi.get<ReponseApi<StatistiqueDemandeCours[]>>(
    `/lots/niveaux/${niveauId}/statistiques`
  );
  return reponse.data.donnees ?? [];
}

export async function obtenirHistoriqueLots(niveauId: string): Promise<Lot[]> {
  const reponse = await clientApi.get<ReponseApi<Lot[]>>(`/lots/niveaux/${niveauId}/lots`);
  return reponse.data.donnees ?? [];
}

export async function creerEtOuvrirLot(
  niveauId: string,
  coursIds: string[],
  terme?: 'AUTOMNE' | 'PRINTEMPS' | 'ETE'
): Promise<ResultatOuverture> {
  const reponse = await clientApi.post<ReponseApi<ResultatOuverture>>(`/lots/niveaux/${niveauId}/lots`, {
    coursIds,
    terme,
  });
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

export async function fermerLot(lotId: string): Promise<Lot> {
  const reponse = await clientApi.post<ReponseApi<Lot>>(`/lots/lots/${lotId}/fermer`);
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

export async function listerSouhaitsEtudiant(inscriptionId: string): Promise<SouhaitEtudiant[]> {
  const reponse = await clientApi.get<ReponseApi<SouhaitEtudiant[]>>(
    `/lots/inscriptions/${inscriptionId}/souhaits`
  );
  return reponse.data.donnees ?? [];
}

export async function exprimerLotSouhaits(inscriptionId: string, coursIds: string[]): Promise<void> {
  await clientApi.post(`/lots/inscriptions/${inscriptionId}/souhaits`, { coursIds });
}

export async function retirerSouhait(inscriptionId: string, coursId: string): Promise<void> {
  await clientApi.delete(`/lots/inscriptions/${inscriptionId}/souhaits/${coursId}`);
}

export async function debloquerPrerequis(inscriptionId: string, coursId: string): Promise<void> {
  await clientApi.post(`/lots/inscriptions/${inscriptionId}/debloquer`, { coursId });
}

export async function retirerDeblocage(inscriptionId: string, coursId: string): Promise<void> {
  await clientApi.delete(`/lots/inscriptions/${inscriptionId}/debloquer/${coursId}`);
}

export async function calculerEtatAnnee(inscriptionId: string): Promise<EtatAnnee> {
  const reponse = await clientApi.get<ReponseApi<EtatAnnee>>(`/lots/inscriptions/${inscriptionId}/etat-annee`);
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}

export async function listerCoursAffectesParTerme(classeId: string): Promise<GroupeCoursTerme[]> {
  const reponse = await clientApi.get<ReponseApi<GroupeCoursTerme[]>>(`/lots/classes/${classeId}/cours-par-terme`);
  return reponse.data.donnees ?? [];
}

export async function listerEtudiantsParCours(classeId: string): Promise<GroupeEtudiantsParCours[]> {
  const reponse = await clientApi.get<ReponseApi<GroupeEtudiantsParCours[]>>(`/lots/classes/${classeId}/etudiants-par-cours`);
  return reponse.data.donnees ?? [];
}

async function telechargerBlobPdf(url: string, nomFichier: string): Promise<void> {
  const reponse = await clientApi.get(url, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(new Blob([reponse.data]));
  const lien = document.createElement('a');
  lien.href = blobUrl;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export async function telechargerEtudiantsUnCoursPdf(classeId: string, coursId: string, coursCode: string): Promise<void> {
  await telechargerBlobPdf(
    `/lots/classes/${classeId}/etudiants-par-cours/${coursId}/pdf`,
    `etudiants-${coursCode}.pdf`
  );
}

export async function telechargerEtudiantsTousCoursPdf(classeId: string, classeNom: string): Promise<void> {
  await telechargerBlobPdf(
    `/lots/classes/${classeId}/etudiants-par-cours-pdf`,
    `etudiants-par-cours-${classeNom}.pdf`
  );
}

export async function ajouterCoursAuLot(lotId: string, coursId: string): Promise<Lot> {
  const reponse = await clientApi.post<ReponseApi<{ lot: Lot }>>(`/lots/lots/${lotId}/cours`, { coursId });
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees.lot;
}

export async function retirerCoursDuLot(lotId: string, coursId: string): Promise<Lot> {
  const reponse = await clientApi.delete<ReponseApi<Lot>>(`/lots/lots/${lotId}/cours/${coursId}`);
  if (!reponse.data.donnees) throw new Error('Réponse invalide du serveur.');
  return reponse.data.donnees;
}
