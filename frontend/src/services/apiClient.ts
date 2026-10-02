import axios from 'axios';

/**
 * Une seule instance Axios pour toute l'application — même principe que le
 * client Prisma unique côté backend. L'URL de base vient d'une variable
 * d'environnement pour ne jamais coder en dur l'adresse du serveur.
 */
const clientApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
});

/**
 * Injecte automatiquement le token d'accès dans chaque requête sortante,
 * s'il existe — aucun composant n'a besoin de gérer ça individuellement.
 */
clientApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('tokenAcces');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Si le serveur répond 401 (token invalide/expiré), on nettoie la session
 * et on renvoie vers la connexion — jamais laisser l'utilisateur face à un
 * état incohérent où le token stocké ne fonctionne plus silencieusement.
 *
 * On ne redirige que si on n'est pas déjà sur /connexion : sans cette
 * garde, un appel qui échouerait depuis la page de connexion elle-même
 * (aucun cas normal aujourd'hui, mais une vraie protection si ça changeait)
 * redéclencherait une navigation vers la même page, sans jamais s'arrêter.
 */
clientApi.interceptors.response.use(
  (reponse) => reponse,
  (erreur) => {
    if (erreur.response?.status === 401 && window.location.pathname !== '/connexion') {
      localStorage.removeItem('tokenAcces');
      localStorage.removeItem('utilisateur');
      window.location.href = '/connexion';
    }
    return Promise.reject(erreur);
  }
);

export default clientApi;
