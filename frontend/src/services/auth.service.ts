import clientApi from './apiClient';
import type { ReponseApi, ReponseConnexion, Utilisateur } from '../types/auth.types';

export async function connecter(email: string, motDePasse: string): Promise<Utilisateur> {
  const reponse = await clientApi.post<ReponseApi<ReponseConnexion>>('/auth/connexion', {
    email,
    motDePasse,
  });

  if (!reponse.data.succes || !reponse.data.donnees) {
    throw new Error(reponse.data.message ?? 'Échec de la connexion.');
  }

  const { tokenAcces, tokenRafraichissement, utilisateur } = reponse.data.donnees;
  localStorage.setItem('tokenAcces', tokenAcces);
  localStorage.setItem('tokenRafraichissement', tokenRafraichissement);
  localStorage.setItem('utilisateur', JSON.stringify(utilisateur));

  return utilisateur;
}

export function deconnecter(): void {
  localStorage.removeItem('tokenAcces');
  localStorage.removeItem('tokenRafraichissement');
  localStorage.removeItem('utilisateur');
}

export function obtenirUtilisateurConnecte(): Utilisateur | null {
  const donnees = localStorage.getItem('utilisateur');
  if (!donnees) return null;

  try {
    return JSON.parse(donnees) as Utilisateur;
  } catch {
    // Donnée corrompue dans le stockage local — on la traite comme absente
    // plutôt que de faire planter l'application.
    return null;
  }
}

export function estConnecte(): boolean {
  return localStorage.getItem('tokenAcces') !== null;
}

export async function changerMotDePasse(motDePasseActuel: string, nouveauMotDePasse: string): Promise<void> {
  await clientApi.patch('/auth/mot-de-passe', { motDePasseActuel, nouveauMotDePasse });
}
