/**
 * Moteur de calcul académique — Licence et Master.
 *
 * Règles fournies explicitement (document de spécification) :
 * - Licence : Devoir1 (coef 1) + Devoir2 (coef 1) + Exposé (coef 0,75) + Examen (coef 2,25), total /5.
 * - Master  : Devoir (coef 1,5) + Exposé (coef 1) + Examen (coef 2,5), total /5.
 * - Session 2 : remplace UNIQUEMENT l'examen, jamais les autres composantes.
 *   Note d'examen retenue = MAX(session 1, session 2).
 * - Seuil de validation : 9,8/20, identique pour les deux cycles.
 *
 * Aucun de ces chiffres n'est une supposition — ils viennent tels quels du
 * document validé. Ce fichier ne fait que les appliquer.
 */

export const SEUIL_VALIDATION = 9.8;

export interface ComposantesLicence {
  devoir1: number | null;
  devoir2: number | null;
  expose: number | null;
  examenSession1: number | null;
  examenSession2: number | null;
}

export interface ComposantesMaster {
  devoir: number | null;
  expose: number | null;
  examenSession1: number | null;
  examenSession2: number | null;
}

export type StatutValidation = 'VALIDEE' | 'NON_VALIDEE' | 'EN_ATTENTE_SESSION_2';

/**
 * Retient la meilleure note d'examen entre les deux sessions. Si la session 2
 * n'a pas encore été saisie, on ne retient que la session 1 — aucune
 * pénalité implicite pour une session 2 non tentée.
 */
function examenRetenu(session1: number, session2: number | null): number {
  if (session2 == null) return session1;
  return Math.max(session1, session2);
}

/**
 * Moyenne d'une matière en Licence. Retourne null tant que les composantes
 * obligatoires (Devoir 1, Devoir 2, Exposé, Examen Session 1) ne sont pas
 * toutes saisies — jamais de moyenne partielle ou approximative.
 */
export function calculerMoyenneLicence(composantes: ComposantesLicence): number | null {
  const { devoir1, devoir2, expose, examenSession1, examenSession2 } = composantes;

  if (devoir1 == null || devoir2 == null || expose == null || examenSession1 == null) {
    return null;
  }

  const examen = examenRetenu(examenSession1, examenSession2);
  const moyenne = (devoir1 * 1 + devoir2 * 1 + expose * 0.75 + examen * 2.25) / 5;

  return Math.round(moyenne * 100) / 100; // arrondi à 2 décimales, cohérent avec Decimal(4,2)
}

/**
 * Moyenne d'une matière en Master. Même principe que pour la Licence, avec
 * les coefficients propres au Master (un seul devoir).
 */
export function calculerMoyenneMaster(composantes: ComposantesMaster): number | null {
  const { devoir, expose, examenSession1, examenSession2 } = composantes;

  if (devoir == null || expose == null || examenSession1 == null) {
    return null;
  }

  const examen = examenRetenu(examenSession1, examenSession2);
  const moyenne = (devoir * 1.5 + expose * 1 + examen * 2.5) / 5;

  return Math.round(moyenne * 100) / 100;
}

/**
 * Détermine le statut affiché, avec la nuance explicitement demandée :
 * "Non validée" seule ne suffit pas à l'affichage — il faut distinguer le
 * cas où une deuxième session reste possible (jamais encore tentée) du cas
 * où elle a déjà été tentée sans succès.
 */
export function determinerStatutValidation(
  moyenne: number | null,
  session2DejaSaisie: boolean
): StatutValidation | null {
  if (moyenne == null) return null;
  if (moyenne >= SEUIL_VALIDATION) return 'VALIDEE';
  return session2DejaSaisie ? 'NON_VALIDEE' : 'EN_ATTENTE_SESSION_2';
}

/**
 * Est-ce que la Session 2 doit être proposée/acceptée pour cette matière ?
 * Vrai uniquement si la moyenne calculée SANS tenir compte d'une éventuelle
 * session 2 est en dessous du seuil — appliqué autant côté affichage que
 * côté validation serveur, pour ne jamais dépendre uniquement du frontend.
 */
export function session2Necessaire(
  cycle: 'LICENCE' | 'MASTER',
  composantesSansSession2: Omit<ComposantesLicence, 'examenSession2'> | Omit<ComposantesMaster, 'examenSession2'>
): boolean {
  const moyenneSansSession2 =
    cycle === 'LICENCE'
      ? calculerMoyenneLicence({ ...(composantesSansSession2 as Omit<ComposantesLicence, 'examenSession2'>), examenSession2: null })
      : calculerMoyenneMaster({ ...(composantesSansSession2 as Omit<ComposantesMaster, 'examenSession2'>), examenSession2: null });

  if (moyenneSansSession2 == null) return false; // pas encore calculable, donc pas encore "nécessaire"
  return moyenneSansSession2 < SEUIL_VALIDATION;
}

/**
 * Moyenne et validation d'UE — deux documents combinés :
 * - Un seul cours : la moyenne de l'UE est celle du cours.
 * - Plusieurs cours : chaque cours pèse le même poids (le crédit total de
 *   l'UE) — la formule se simplifie donc mathématiquement à une moyenne
 *   simple entre les cours de l'UE. Confirmé explicitement ainsi.
 * - Règle directe : validée si CHAQUE cours ≥ 08/20 ET la moyenne de l'UE
 *   ≥ 10/20.
 * - Règle de compensation, si la règle directe échoue : validée quand même
 *   si la moyenne de l'UE ≥ 9,0 ET la moyenne du semestre ≥ 10 — plus de
 *   condition de plancher par cours dans ce cas, uniquement ces deux
 *   moyennes-là.
 *
 * Le passage d'année (L1→L2) reste hors périmètre, jamais construit ici.
 */
export const SEUIL_VALIDATION_UE = 10;
export const SEUIL_MINIMUM_COURS_DANS_UE = 8;
export const SEUIL_COMPENSATION_UE = 9.0;
export const SEUIL_VALIDATION_SEMESTRE = 10;

export type StatutValidationUE = 'VALIDEE' | 'NON_VALIDEE';
export type StatutValidationSemestre = 'VALIDE' | 'NON_VALIDE';

/**
 * Moyenne d'une UE à partir des moyennes de ses cours. Retourne null si un
 * seul cours n'a pas encore de moyenne calculable — jamais de moyenne
 * partielle, même principe que pour une matière.
 */
export function calculerMoyenneUE(moyennesCours: (number | null)[]): number | null {
  if (moyennesCours.length === 0) return null;
  if (moyennesCours.some((m) => m == null)) return null;

  const valeurs = moyennesCours as number[];
  const moyenne = valeurs.reduce((somme, m) => somme + m, 0) / valeurs.length;

  return Math.round(moyenne * 100) / 100;
}

/**
 * Statut d'une UE, règle directe puis compensation. La moyenne de semestre
 * utilisée pour la compensation doit être la moyenne PROVISOIRE (calculée à
 * partir des moyennes brutes de toutes les UE, avant tout statut) — sinon
 * on retombe dans un cycle où le statut d'une UE dépendrait du statut des
 * autres UE, qui dépendrait à son tour du statut de la première.
 */
/**
 * Statut d'une UE, règle directe puis compensation. La moyenne de semestre
 * utilisée pour la compensation doit être la moyenne PROVISOIRE (calculée à
 * partir des moyennes brutes de toutes les UE, avant tout statut) — sinon
 * on retombe dans un cycle où le statut d'une UE dépendrait du statut des
 * autres UE, qui dépendrait à son tour du statut de la première.
 *
 * Une matière dispensée (voir AffectationCours.dispense) est TOUJOURS
 * exclue de la vérification "tous les cours au minimum" — elle est déjà
 * validée par la dispense elle-même, quelle que soit sa note retenue ;
 * cette note entre quand même dans moyenneUE, pour que la moyenne
 * générale reste juste.
 */
export function determinerStatutUE(
  moyenneUE: number | null,
  moyennesCours: (number | null)[],
  moyenneSemestreProvisoire: number | null,
  estDispenseParCours: boolean[] = []
): StatutValidationUE | null {
  if (moyenneUE == null) return null;

  const tousLesCoursAuMinimum = moyennesCours.every(
    (m, i) => estDispenseParCours[i] === true || (m != null && m >= SEUIL_MINIMUM_COURS_DANS_UE)
  );
  const reussitRegleDirecte = moyenneUE >= SEUIL_VALIDATION_UE && tousLesCoursAuMinimum;

  if (reussitRegleDirecte) {
    return 'VALIDEE';
  }

  const reussitParCompensation =
    moyenneUE >= SEUIL_COMPENSATION_UE &&
    moyenneSemestreProvisoire != null &&
    moyenneSemestreProvisoire >= SEUIL_VALIDATION_SEMESTRE;

  return reussitParCompensation ? 'VALIDEE' : 'NON_VALIDEE';
}

export interface UEPourSemestre {
  moyenne: number | null;
  credits: number;
}

/**
 * Moyenne de semestre, pondérée par les crédits de chaque UE — pratique
 * standard, cohérente avec la logique déjà établie pour les UE. Retourne
 * null si une seule UE du semestre n'a pas encore de moyenne calculable.
 */
export function calculerMoyenneSemestre(uesDuSemestre: UEPourSemestre[]): number | null {
  if (uesDuSemestre.length === 0) return null;
  if (uesDuSemestre.some((ue) => ue.moyenne == null)) return null;

  const sommeCredits = uesDuSemestre.reduce((somme, ue) => somme + ue.credits, 0);
  if (sommeCredits === 0) return null;

  const sommePonderee = uesDuSemestre.reduce((somme, ue) => somme + (ue.moyenne as number) * ue.credits, 0);
  const moyenne = sommePonderee / sommeCredits;

  return Math.round(moyenne * 100) / 100;
}

/**
 * Statut du semestre — distinct de sa moyenne. Deux conditions, toutes deux
 * nécessaires : la moyenne de semestre ≥ 10, ET aucune UE n'a une moyenne
 * inférieure à 9,0 (même une UE validée par compensation ne doit jamais
 * être en dessous de ce plancher). "Capitaliser les 30 crédits" n'est pas
 * une troisième condition séparée : elle découle de ces deux-là.
 */
export function determinerStatutSemestre(
  moyenneSemestre: number | null,
  moyennesUE: (number | null)[]
): StatutValidationSemestre | null {
  if (moyenneSemestre == null) return null;
  if (moyennesUE.some((m) => m == null)) return null;

  const aucuneUESousLePlancher = moyennesUE.every((m) => (m as number) >= SEUIL_COMPENSATION_UE);

  return moyenneSemestre >= SEUIL_VALIDATION_SEMESTRE && aucuneUESousLePlancher ? 'VALIDE' : 'NON_VALIDE';
}

/**
 * Passage d'année (L1→L2, etc.) — deux voies, confirmées explicitement :
 * - Voie 1 : toutes les UE des deux semestres de l'année sont
 *   individuellement validées (statut déjà déterminé, compensation
 *   intra-semestre incluse).
 * - Voie 2, si la voie 1 échoue : la moyenne annuelle est ≥ 10, par
 *   compensation entre toutes les UE de l'année (S1 + S2 combinés).
 *
 * La moyenne annuelle est la moyenne simple des deux moyennes de semestre —
 * mathématiquement équivalent à une pondération par crédits de toutes les
 * UE des deux semestres combinés, puisque S1 et S2 valent chacun 30
 * crédits. Confirmé explicitement ainsi, pas une simplification de ma part.
 */
export const SEUIL_VALIDATION_ANNUELLE = 10;

export type StatutPassageAnnee = 'PASSAGE_ACCORDE' | 'PASSAGE_NON_ACCORDE';

export function calculerMoyenneAnnuelle(moyenneS1: number | null, moyenneS2: number | null): number | null {
  if (moyenneS1 == null || moyenneS2 == null) return null;
  const moyenne = (moyenneS1 + moyenneS2) / 2;
  return Math.round(moyenne * 100) / 100;
}

/**
 * Retourne null si une UE n'a pas encore de statut déterminé, ou si la
 * voie 1 échoue et que la moyenne annuelle n'est pas encore calculable —
 * dans ces cas, la décision ne peut tout simplement pas encore être prise.
 */
export function determinerPassageAnnee(
  statutsUE: (StatutValidationUE | null)[],
  moyenneAnnuelle: number | null
): StatutPassageAnnee | null {
  if (statutsUE.length === 0) return null;
  if (statutsUE.some((s) => s == null)) return null;

  const toutesLesUEValidees = statutsUE.every((s) => s === 'VALIDEE');
  if (toutesLesUEValidees) return 'PASSAGE_ACCORDE';

  if (moyenneAnnuelle == null) return null;

  return moyenneAnnuelle >= SEUIL_VALIDATION_ANNUELLE ? 'PASSAGE_ACCORDE' : 'PASSAGE_NON_ACCORDE';
}
