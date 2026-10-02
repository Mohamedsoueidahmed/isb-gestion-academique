export interface Utilisateur {
  id: string;
  nom: string;
  email: string;
  role: 'ADMINISTRATEUR' | 'RESPONSABLE_ACADEMIQUE';
}

export interface ReponseConnexion {
  tokenAcces: string;
  tokenRafraichissement: string;
  utilisateur: Utilisateur;
}

export interface ReponseApi<T> {
  succes: boolean;
  donnees?: T;
  code?: string;
  message?: string;
}
