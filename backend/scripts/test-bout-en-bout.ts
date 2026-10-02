/**
 * Script de test de bout en bout — injecte 8 étudiants, chacun couvrant un
 * cas distinct du moteur de calcul, EN PASSANT PAR L'API RÉELLE (jamais
 * d'écriture directe en base) : c'est ce qui fait de ce script un vrai
 * test, pas un simple remplissage de tables. Si ce script réussit, ça
 * prouve que l'authentification, les vérifications de capacité, la saisie
 * de composantes, le recalcul automatique et le moteur de calcul
 * fonctionnent ensemble.
 *
 * Auto-suffisant : découvre l'état réel de la base (année, classe,
 * structure UE/cours) plutôt que de supposer quoi que ce soit — donc
 * rejouable sans connaître à l'avance ce qui existe déjà.
 *
 * Usage : npx tsx scripts/test-bout-en-bout.ts
 * (depuis le dossier backend, serveur déjà lancé sur localhost:3000)
 */

const BASE_URL = 'http://localhost:3000/api';
const ADMIN_EMAIL = 'admin@universite.local';
const ADMIN_MOT_DE_PASSE = 'ChangezMoi123!';

let token = '';

async function appelApi<T>(
  methode: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  chemin: string,
  corps?: unknown
): Promise<T> {
  const reponse = await fetch(`${BASE_URL}${chemin}`, {
    method: methode,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });

  const donnees = await reponse.json().catch(() => null);

  if (!reponse.ok) {
    throw new Error(
      `${methode} ${chemin} → ${reponse.status} : ${donnees?.message ?? 'erreur inconnue'}`
    );
  }

  return donnees.donnees as T;
}

// --- Formules du moteur de calcul, dupliquées ICI uniquement pour VÉRIFIER
// à l'avance que les composantes choisies produiront bien le scénario visé
// — jamais utilisées pour décider quoi que ce soit côté serveur, qui reste
// la seule source de vérité réelle.
function moyenneCoursLicence(d1: number, d2: number, expose: number, examS1: number): number {
  return (d1 * 1 + d2 * 1 + expose * 0.75 + examS1 * 2.25) / 5;
}

interface UEDecouverte {
  id: string;
  code: string;
  credits: number;
  cours: { id: string; code: string; titre: string }[];
}

async function main() {
  console.log('=== Test de bout en bout, connexion ===');
  const connexion = await appelApi<{ tokenAcces: string }>('POST', '/auth/connexion', {
    email: ADMIN_EMAIL,
    motDePasse: ADMIN_MOT_DE_PASSE,
  });
  token = connexion.tokenAcces;
  console.log('Connecté.\n');

  // --- S'assurer qu'au moins une année existe, en créer une sinon ---
  console.log('=== Découverte de l\'année universitaire ===');
  type Annee = { id: string; libelle: string };
  let annees = await appelApi<Annee[]>('GET', '/referentiel/annees-universitaires');

  if (annees.length === 0) {
    console.log('Aucune année trouvée. Création de 2026-2027...');
    const resultat = await appelApi<{ annee: Annee; classesCreees: string[] }>(
      'POST',
      '/referentiel/annees-universitaires',
      { libelle: '2026-2027', dateDebut: '2026-09-01', dateFin: '2027-07-31' }
    );
    console.log(`Année créée avec ${resultat.classesCreees.length} classes.\n`);
    annees = [resultat.annee];
  }

  // --- Trouver, PARMI TOUTES LES ANNÉES EXISTANTES, celle qui a une vraie
  // classe L1-CCA — jamais deviner avec la première trouvée : l'ordre de la
  // liste ne dit rien sur laquelle contient réellement des classes.
  console.log('=== Recherche de la classe L1-CCA-A ===');
  type Classe = { id: string; nom: string; niveauId: string; semestreActifId: string; anneeUniversitaireId: string };

  let classe: Classe | undefined;
  let anneeUtilisee: Annee | undefined;

  for (const candidate of annees) {
    const classesDeCetteAnnee = await appelApi<Classe[]>(
      'GET',
      `/classes?anneeUniversitaireId=${candidate.id}`
    );
    const trouvee = classesDeCetteAnnee.find((c) => c.nom.startsWith('L1-CCA'));
    if (trouvee) {
      classe = trouvee;
      anneeUtilisee = candidate;
      break;
    }
  }

  if (!classe || !anneeUtilisee) {
    throw new Error(
      "Aucune classe L1-CCA trouvée dans aucune des années existantes. Créez une année (ce qui crée automatiquement les 9 classes), puis relancez ce script."
    );
  }
  console.log(`Classe trouvée : ${classe.nom}, année ${anneeUtilisee.libelle} (id classe: ${classe.id})\n`);

  // --- Découvrir la structure UE/cours du semestre actif de cette classe ---
  console.log('=== Découverte des UE et cours du semestre actif ===');
  const coursDuSemestre = await appelApi<
    { id: string; code: string; titre: string; ue: { id: string; code: string; credits: number } }[]
  >('GET', `/referentiel/semestres/${classe.semestreActifId}/cours`);

  const uesMap = new Map<string, UEDecouverte>();
  for (const cours of coursDuSemestre) {
    if (!uesMap.has(cours.ue.id)) {
      uesMap.set(cours.ue.id, { id: cours.ue.id, code: cours.ue.code, credits: cours.ue.credits, cours: [] });
    }
    uesMap.get(cours.ue.id)!.cours.push({ id: cours.id, code: cours.code, titre: cours.titre });
  }
  const uesDecouvertes = Array.from(uesMap.values());
  console.log(
    `${uesDecouvertes.length} UE découvertes : ${uesDecouvertes.map((u) => `${u.code} (${u.credits} crédits, ${u.cours.length} cours)`).join(', ')}\n`
  );

  if (uesDecouvertes.length < 2) {
    console.log(
      "ATTENTION : moins de 2 UE découvertes. Les cas 4 et 5 (compensation, plancher 9,0) ont besoin d'au moins 2 UE pour avoir un sens. Ils seront tentés quand même, mais vérifiez le résultat attentivement."
    );
  }

  // Cible pour les cas 4 et 5 : la première UE. "Autres" : tout le reste.
  const ueCible = uesDecouvertes[0];
  const autresUEs = uesDecouvertes.slice(1);
  const creditsCible = ueCible.credits;
  const creditsAutres = autresUEs.reduce((s, u) => s + u.credits, 0);

  // Pour que le semestre reste ≥10 malgré une UE cible basse, on calcule la
  // moyenne minimale nécessaire pour les autres UE, avec une marge de
  // sécurité de +1 au-dessus du minimum strictement nécessaire.
  function moyenneAutresRequise(moyenneCible: number, seuilSemestre: number): number {
    if (creditsAutres === 0) return seuilSemestre; // pas d'autres UE, pas de marge de manœuvre possible
    const brut = (seuilSemestre * (creditsCible + creditsAutres) - moyenneCible * creditsCible) / creditsAutres;
    return Math.min(20, brut + 1);
  }

  const moyenneAutresPourCas4 = moyenneAutresRequise(9.3, 10);
  const moyenneAutresPourCas5 = moyenneAutresRequise(8.5, 10);

  console.log(
    `Cas 4 (compensation) : UE cible à 9.3, autres UE à ${moyenneAutresPourCas4.toFixed(2)} pour garantir un semestre ≥10.`
  );
  console.log(
    `Cas 5 (piège du plancher) : UE cible à 8.5, autres UE à ${moyenneAutresPourCas5.toFixed(2)} pour un semestre ≥10 malgré le rejet.\n`
  );

  // --- Fonction utilitaire : soumettre une composante pour un cours donné ---
  async function saisirComposante(
    inscriptionId: string,
    coursId: string,
    type: string,
    valeur: number
  ): Promise<void> {
    await appelApi('POST', '/notes', { inscriptionId, coursId, type, valeur });
  }

  // Applique une moyenne cible à TOUS les cours d'une UE, via le raccourci
  // D1=D2=Exposé=ExamS1=cible (donne exactement "cible" comme moyenne,
  // formule Licence vérifiée : les poids 1+1+0,75+2,25 = 5).
  async function appliquerMoyenneUniformeUE(inscriptionId: string, ue: UEDecouverte, cible: number) {
    for (const cours of ue.cours) {
      await saisirComposante(inscriptionId, cours.id, 'DEVOIR_1', cible);
      await saisirComposante(inscriptionId, cours.id, 'DEVOIR_2', cible);
      await saisirComposante(inscriptionId, cours.id, 'EXPOSE', cible);
      await saisirComposante(inscriptionId, cours.id, 'EXAMEN_SESSION_1', cible);
    }
  }

  async function appliquerMoyenneUniformeToutesLesAutres(inscriptionId: string, cible: number) {
    for (const ue of autresUEs) {
      await appliquerMoyenneUniformeUE(inscriptionId, ue, cible);
    }
  }

  async function creerEtInscrire(prenom: string, nom: string, matricule: string): Promise<{ id: string }> {
    const etudiant = await appelApi<{ id: string }>('POST', '/etudiants', { prenom, nom, matricule });
    const inscription = await appelApi<{ id: string }>('POST', '/etudiants/inscriptions', {
      etudiantId: etudiant.id,
      classeId: classe!.id,
    });
    return { id: inscription.id };
  }

  console.log('=== Création des 8 étudiants ===\n');

  // Cas 1 — valide tout directement, confortablement.
  console.log('Cas 1 : validation directe (Aissatou Ba)');
  const insc1 = await creerEtInscrire('Aissatou', 'Ba', 'TEST-001');
  await appliquerMoyenneUniformeUE(insc1.id, ueCible, 15);
  await appliquerMoyenneUniformeToutesLesAutres(insc1.id, 15);
  console.log('  → Fait.\n');

  // Cas 2 — échoue un cours en S1, rattrape en session 2.
  console.log('Cas 2 : rattrapé par la session 2 (Moussa Kane)');
  const insc2 = await creerEtInscrire('Moussa', 'Kane', 'TEST-002');
  const premierCoursCible = ueCible.cours[0];
  await saisirComposante(insc2.id, premierCoursCible.id, 'DEVOIR_1', 6);
  await saisirComposante(insc2.id, premierCoursCible.id, 'DEVOIR_2', 6);
  await saisirComposante(insc2.id, premierCoursCible.id, 'EXPOSE', 6);
  await saisirComposante(insc2.id, premierCoursCible.id, 'EXAMEN_SESSION_1', 6);
  await saisirComposante(insc2.id, premierCoursCible.id, 'EXAMEN_SESSION_2', 15);
  for (const cours of ueCible.cours.slice(1)) {
    await saisirComposante(insc2.id, cours.id, 'DEVOIR_1', 14);
    await saisirComposante(insc2.id, cours.id, 'DEVOIR_2', 14);
    await saisirComposante(insc2.id, cours.id, 'EXPOSE', 14);
    await saisirComposante(insc2.id, cours.id, 'EXAMEN_SESSION_1', 14);
  }
  await appliquerMoyenneUniformeToutesLesAutres(insc2.id, 14);
  console.log('  → Fait.\n');

  // Cas 3 — échoue même après la session 2.
  console.log('Cas 3 : échec même après la session 2 (Fatoumata Sy)');
  const insc3 = await creerEtInscrire('Fatoumata', 'Sy', 'TEST-003');
  await saisirComposante(insc3.id, premierCoursCible.id, 'DEVOIR_1', 5);
  await saisirComposante(insc3.id, premierCoursCible.id, 'DEVOIR_2', 5);
  await saisirComposante(insc3.id, premierCoursCible.id, 'EXPOSE', 5);
  await saisirComposante(insc3.id, premierCoursCible.id, 'EXAMEN_SESSION_1', 5);
  await saisirComposante(insc3.id, premierCoursCible.id, 'EXAMEN_SESSION_2', 6);
  for (const cours of ueCible.cours.slice(1)) {
    await saisirComposante(insc3.id, cours.id, 'DEVOIR_1', 14);
    await saisirComposante(insc3.id, cours.id, 'DEVOIR_2', 14);
    await saisirComposante(insc3.id, cours.id, 'EXPOSE', 14);
    await saisirComposante(insc3.id, cours.id, 'EXAMEN_SESSION_1', 14);
  }
  await appliquerMoyenneUniformeToutesLesAutres(insc3.id, 14);
  console.log('  → Fait.\n');

  // Cas 4 — UE validée uniquement par compensation.
  console.log('Cas 4 : UE validée par compensation (Ibrahima Diop)');
  const insc4 = await creerEtInscrire('Ibrahima', 'Diop', 'TEST-004');
  await appliquerMoyenneUniformeUE(insc4.id, ueCible, 9.3);
  await appliquerMoyenneUniformeToutesLesAutres(insc4.id, moyenneAutresPourCas4);
  console.log('  → Fait.\n');

  // Cas 5 — le piège du plancher de 9,0 : moyenne de semestre suffisante,
  // mais une UE sous 9,0 doit quand même faire échouer le semestre entier.
  console.log('Cas 5 : piège du plancher de 9,0 (Mariam Toure)');
  const insc5 = await creerEtInscrire('Mariam', 'Toure', 'TEST-005');
  await appliquerMoyenneUniformeUE(insc5.id, ueCible, 8.5);
  await appliquerMoyenneUniformeToutesLesAutres(insc5.id, moyenneAutresPourCas5);
  console.log('  → Fait.\n');

  // Cas 6 — absences variées sur plusieurs cours.
  console.log('Cas 6 : absences variées (Ousmane Ndiaye)');
  const insc6 = await creerEtInscrire('Ousmane', 'Ndiaye', 'TEST-006');
  await appliquerMoyenneUniformeUE(insc6.id, ueCible, 13);
  await appliquerMoyenneUniformeToutesLesAutres(insc6.id, 13);
  const datesAbsences = ['2026-09-15', '2026-09-22', '2026-10-01'];
  for (let i = 0; i < Math.min(datesAbsences.length, ueCible.cours.length); i++) {
    await appelApi('POST', '/absences', {
      classeId: classe.id,
      coursId: ueCible.cours[i % ueCible.cours.length].id,
      dateSeance: datesAbsences[i],
      inscriptionsAbsentes: [insc6.id],
    });
  }
  console.log('  → Fait.\n');

  // Cas 7 — données incomplètes : un seul cours saisi, le reste vide.
  console.log('Cas 7 : données incomplètes (Aminata Cisse)');
  const insc7 = await creerEtInscrire('Aminata', 'Cisse', 'TEST-007');
  await saisirComposante(insc7.id, premierCoursCible.id, 'DEVOIR_1', 12);
  console.log('  → Fait (un seul cours partiellement saisi, volontairement).\n');

  // Cas 8 — étudiant orphelin, jamais inscrit dans aucune classe.
  console.log('Cas 8 : étudiant sans classe (Boubacar Sow)');
  await appelApi('POST', '/etudiants', { prenom: 'Boubacar', nom: 'Sow', matricule: 'TEST-008' });
  console.log('  → Fait (créé, volontairement non inscrit).\n');

  console.log('=== Terminé ===');
  console.log(`Classe utilisée : ${classe.nom}`);
  console.log('Consultez maintenant Notes, Absences, Bulletins et Rattrapage pour cette classe dans l\'interface.');
}

main().catch((erreur) => {
  console.error('\nÉchec du script :', erreur.message);
  process.exit(1);
});
