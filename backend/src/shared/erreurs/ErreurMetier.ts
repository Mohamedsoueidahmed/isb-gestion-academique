/**
 * Erreur métier centralisée.
 * Tous les services lèvent cette classe (ou une sous-classe) plutôt que des
 * erreurs génériques, pour que le middleware de gestion d'erreurs puisse
 * toujours produire une réponse HTTP cohérente et prévisible.
 */
export class ErreurMetier extends Error {
  public readonly codeHttp: number;
  public readonly codeErreur: string;

  constructor(message: string, codeHttp: number, codeErreur: string) {
    super(message);
    this.codeHttp = codeHttp;
    this.codeErreur = codeErreur;
    this.name = 'ErreurMetier';
  }
}

export class ErreurNonTrouve extends ErreurMetier {
  constructor(ressource: string) {
    super(`${ressource} introuvable.`, 404, 'RESSOURCE_NON_TROUVEE');
  }
}

export class ErreurDonneesInvalides extends ErreurMetier {
  constructor(message: string) {
    super(message, 400, 'DONNEES_INVALIDES');
  }
}

export class ErreurConflit extends ErreurMetier {
  constructor(message: string) {
    super(message, 409, 'CONFLIT');
  }
}

export class ErreurNonAutorise extends ErreurMetier {
  constructor(message = 'Action non autorisée pour ce rôle.') {
    super(message, 403, 'NON_AUTORISE');
  }
}

export class ErreurAuthentification extends ErreurMetier {
  constructor(message = 'Authentification requise ou invalide.') {
    super(message, 401, 'NON_AUTHENTIFIE');
  }
}
