import { ErreurDonneesInvalides } from '../erreurs/ErreurMetier';

/**
 * Express 5 type req.params et req.query comme pouvant légitimement être
 * `string | string[]` (ex. un client envoyant `?date=a&date=b` deux fois).
 * Pour tout paramètre censé être unique dans notre API, on rejette
 * explicitement le cas tableau plutôt que de le contourner par un simple
 * transtypage — un tableau inattendu est un signe de requête malformée,
 * pas une valeur à accepter silencieusement.
 */
export function extraireChaineUnique(valeur: unknown, nomParametre: string): string {
  if (typeof valeur !== 'string') {
    throw new ErreurDonneesInvalides(`Le paramètre "${nomParametre}" doit être une valeur unique, pas une liste.`);
  }
  return valeur;
}
