/**
 * Remplit les 9 classes d'une année universitaire avec 40 étudiants chacune
 * (360 au total), des notes et absences variées et réalistes, pour LES
 * DEUX SEMESTRES — en passant entièrement par l'API réelle, jamais
 * d'écriture directe en base.
 *
 * Auto-suffisant : si aucune année n'existe, en crée une (ce qui crée
 * automatiquement les 9 classes). Découvre la structure UE/cours de
 * chaque classe indépendamment — jamais supposée identique d'une classe à
 * l'autre.
 *
 * AVERTISSEMENT DE VOLUME : environ 15 000 à 20 000 requêtes individuelles
 * au total. Les requêtes sont envoyées par lots limités (voir
 * CONCURRENCE_MAX) pour ne pas surcharger le serveur local, mais
 * l'exécution complète prendra probablement plusieurs minutes — ce n'est
 * pas un signe de blocage.
 *
 * Usage : npx tsx scripts/remplir-annee-complete.ts
 * (depuis le dossier backend, serveur déjà lancé sur localhost:3000)
 */

const BASE_URL = 'http://localhost:3000/api';
const ADMIN_EMAIL = 'admin@universite.local';
const ADMIN_MOT_DE_PASSE = 'ChangezMoi123!';
const ELEVES_PAR_CLASSE = 40;
const CONCURRENCE_MAX = 12;

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
    throw new Error(`${methode} ${chemin} → ${reponse.status} : ${donnees?.message ?? 'erreur inconnue'}`);
  }

  return donnees.donnees as T;
}

/**
 * Exécute un ensemble de tâches asynchrones par lots limités, plutôt que
 * toutes en même temps (qui surchargerait le serveur et la connexion à la
 * base) ou une par une (beaucoup trop lent à ce volume).
 */
async function executerParLots<T>(taches: (() => Promise<T>)[], tailleLot: number): Promise<T[]> {
  const resultats: T[] = [];
  for (let i = 0; i < taches.length; i += tailleLot) {
    const lot = taches.slice(i, i + tailleLot);
    resultats.push(...(await Promise.all(lot.map((tache) => tache()))));
  }
  return resultats;
}

function choisirAleatoirement<T>(liste: T[]): T {
  return liste[Math.floor(Math.random() * liste.length)];
}

function entierAleatoireEntre(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function melangerTableau<T>(liste: T[]): T[] {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

const PRENOMS = [
  'Aissatou', 'Moussa', 'Fatoumata', 'Ibrahima', 'Mariam', 'Ousmane', 'Aminata', 'Boubacar',
  'Khadija', 'Mamadou', 'Awa', 'Sekou', 'Bineta', 'Cheikh', 'Ndeye', 'Amadou', 'Fanta', 'Alassane',
  'Rokhaya', 'Souleymane', 'Coumba', 'Modibo', 'Adama', 'Kadiatou', 'Yacouba', 'Mame', 'Lamine',
  'Sokhna', 'Bakary', 'Aicha', 'Idrissa', 'Marieme', 'Youssouf', 'Fatim', 'Abdoulaye', 'Salimata',
  'Cheikhna', 'Diaraye', 'Malick', 'Oumou',
];
const NOMS = [
  'Diallo', 'Ba', 'Sy', 'Diop', 'Toure', 'Ndiaye', 'Cisse', 'Sow', 'Kane', 'Sarr', 'Fall', 'Gueye',
  'Sane', 'Diagne', 'Camara', 'Balde', 'Barry', 'Sylla', 'Kone', 'Traore',
];

interface UEDecouverte {
  id: string;
  code: string;
  credits: number;
  cours: { id: string; code: string; titre: string }[];
}

async function decouvrirUEs(semestreId: string): Promise<UEDecouverte[]> {
  const coursDuSemestre = await appelApi<
    { id: string; code: string; titre: string; ue: { id: string; code: string; credits: number } }[]
  >('GET', `/referentiel/semestres/${semestreId}/cours`);

  const uesMap = new Map<string, UEDecouverte>();
  for (const cours of coursDuSemestre) {
    if (!uesMap.has(cours.ue.id)) {
      uesMap.set(cours.ue.id, { id: cours.ue.id, code: cours.ue.code, credits: cours.ue.credits, cours: [] });
    }
    uesMap.get(cours.ue.id)!.cours.push({ id: cours.id, code: cours.code, titre: cours.titre });
  }
  return Array.from(uesMap.values());
}

type Profil = 'CONFORTABLE' | 'SESSION2_REUSSIE' | 'SESSION2_ECHOUEE' | 'COMPENSATION';

/**
 * Tire un profil réaliste : environ 70% confortables, 17,5% rattrapés en
 * session 2, 7,5% échouent même après la session 2, 5% proches des seuils
 * de compensation — sur 40 élèves, ça donne à peu près 28/7/3/2.
 */
function tirerProfil(): Profil {
  const tirage = Math.random();
  if (tirage < 0.70) return 'CONFORTABLE';
  if (tirage < 0.875) return 'SESSION2_REUSSIE';
  if (tirage < 0.95) return 'SESSION2_ECHOUEE';
  return 'COMPENSATION';
}

/**
 * Composantes brutes pour un cours donné, selon le profil de l'étudiant.
 * D1=D2=Exposé=ExamS1=valeur donne exactement "valeur" comme moyenne
 * (formule Licence vérifiée : poids 1+1+0,75+2,25 = 5), ce qui permet de
 * viser une moyenne précise sans avoir à résoudre l'équation à chaque fois.
 */
function composantesPourProfil(profil: Profil): { d1: number; d2: number; expose: number; examS1: number; examS2?: number } {
  switch (profil) {
    case 'CONFORTABLE': {
      const v = entierAleatoireEntre(12, 17);
      return { d1: v, d2: v, expose: v, examS1: v };
    }
    case 'SESSION2_REUSSIE': {
      const echec = entierAleatoireEntre(5, 8);
      const rattrapage = entierAleatoireEntre(13, 17);
      return { d1: echec, d2: echec, expose: echec, examS1: echec, examS2: rattrapage };
    }
    case 'SESSION2_ECHOUEE': {
      const echec = entierAleatoireEntre(3, 6);
      const rattrapageInsuffisant = entierAleatoireEntre(4, 7);
      return { d1: echec, d2: echec, expose: echec, examS1: echec, examS2: rattrapageInsuffisant };
    }
    case 'COMPENSATION': {
      // Traité à part : voir remplirSemestrePourClasse, qui a besoin de
      // connaître les crédits de TOUTES les UE pour viser un semestre ≥10.
      return { d1: 9.3, d2: 9.3, expose: 9.3, examS1: 9.3 };
    }
  }
}

async function creerEtudiant(prenom: string, nom: string, matricule: string): Promise<{ id: string }> {
  return appelApi<{ id: string }>('POST', '/etudiants', { prenom, nom, matricule });
}

async function inscrire(etudiantId: string, classeId: string): Promise<{ id: string }> {
  return appelApi<{ id: string }>('POST', '/etudiants/inscriptions', { etudiantId, classeId });
}

async function saisirComposante(inscriptionId: string, coursId: string, type: string, valeur: number): Promise<void> {
  await appelApi('POST', '/notes', { inscriptionId, coursId, type, valeur });
}

/**
 * Remplit un semestre complet (composantes + absences) pour 40 inscriptions
 * déjà créées, sur une classe dont le semestre actif correspond aux UE
 * fournies. Le profil de compensation est calculé ICI, pas dans
 * composantesPourProfil, car il a besoin des crédits réels des UE de CE
 * semestre précis pour viser un semestre ≥10 malgré une UE basse.
 */
async function remplirSemestrePourClasse(
  classeId: string,
  ues: UEDecouverte[],
  inscriptions: { id: string }[],
  libelleSemestrePourDates: 'S1' | 'S2'
): Promise<void> {
  if (ues.length === 0) {
    console.log('    Aucune UE trouvée pour ce semestre. Rien à saisir.');
    return;
  }

  const ueCible = ues[0];
  const autresUEs = ues.slice(1);
  const creditsCible = ueCible.credits;
  const creditsAutres = autresUEs.reduce((s, u) => s + u.credits, 0);

  function moyenneAutresPourCompensation(): number {
    const moyenneCible = 9.3;
    const seuil = 10;
    if (creditsAutres === 0) return seuil;
    const brut = (seuil * (creditsCible + creditsAutres) - moyenneCible * creditsCible) / creditsAutres;
    return Math.min(20, brut + 1);
  }
  const moyenneAutresCompensation = moyenneAutresPourCompensation();

  const taches: (() => Promise<void>)[] = [];

  for (const inscription of inscriptions) {
    const profil = tirerProfil();

    if (profil === 'COMPENSATION') {
      // UE cible à 9.3 (échoue la règle directe), les autres assez hautes
      // pour que le semestre reste ≥10 malgré ça — la compensation doit
      // alors sauver cette UE précise.
      for (const cours of ueCible.cours) {
        taches.push(async () => {
          await saisirComposante(inscription.id, cours.id, 'DEVOIR_1', 9.3);
          await saisirComposante(inscription.id, cours.id, 'DEVOIR_2', 9.3);
          await saisirComposante(inscription.id, cours.id, 'EXPOSE', 9.3);
          await saisirComposante(inscription.id, cours.id, 'EXAMEN_SESSION_1', 9.3);
        });
      }
      for (const ue of autresUEs) {
        for (const cours of ue.cours) {
          taches.push(async () => {
            await saisirComposante(inscription.id, cours.id, 'DEVOIR_1', moyenneAutresCompensation);
            await saisirComposante(inscription.id, cours.id, 'DEVOIR_2', moyenneAutresCompensation);
            await saisirComposante(inscription.id, cours.id, 'EXPOSE', moyenneAutresCompensation);
            await saisirComposante(inscription.id, cours.id, 'EXAMEN_SESSION_1', moyenneAutresCompensation);
          });
        }
      }
      continue;
    }

    // Pour les trois autres profils : un cours "cible" (le premier de la
    // première UE) porte le profil, tous les autres cours restent
    // confortables — évite que TOUT le bulletin d'un même étudiant
    // échoue d'un coup, ce qui ne serait pas réaliste.
    const composantesCible = composantesPourProfil(profil);
    const coursCible = ueCible.cours[0];

    // Une seule tâche pour TOUT le cours cible : les composantes doivent
    // être enregistrées dans l'ordre (D1, D2, Exposé, ExamS1 avant
    // ExamS2), sinon le serveur refuse la session 2 en la jugeant "pas
    // encore nécessaire" faute de voir la session 1 déjà complète.
    taches.push(async () => {
      await saisirComposante(inscription.id, coursCible.id, 'DEVOIR_1', composantesCible.d1);
      await saisirComposante(inscription.id, coursCible.id, 'DEVOIR_2', composantesCible.d2);
      await saisirComposante(inscription.id, coursCible.id, 'EXPOSE', composantesCible.expose);
      await saisirComposante(inscription.id, coursCible.id, 'EXAMEN_SESSION_1', composantesCible.examS1);
      if (composantesCible.examS2 != null) {
        await saisirComposante(inscription.id, coursCible.id, 'EXAMEN_SESSION_2', composantesCible.examS2!);
      }
    });

    const autresCoursDeCetteUE = ueCible.cours.slice(1);
    for (const cours of [...autresCoursDeCetteUE, ...autresUEs.flatMap((u) => u.cours)]) {
      const v = entierAleatoireEntre(12, 17);
      taches.push(async () => {
        await saisirComposante(inscription.id, cours.id, 'DEVOIR_1', v);
        await saisirComposante(inscription.id, cours.id, 'DEVOIR_2', v);
        await saisirComposante(inscription.id, cours.id, 'EXPOSE', v);
        await saisirComposante(inscription.id, cours.id, 'EXAMEN_SESSION_1', v);
      });
    }
  }

  console.log(`    Envoi de ${taches.length} tâches de saisie (chacune couvrant un cours complet)...`);
  await executerParLots(taches, CONCURRENCE_MAX);

  // --- Absences : quelques séances par cours, un sous-ensemble aléatoire
  // d'inscriptions marqué absent à chaque fois — variation réaliste par
  // étudiant sans un appel par étudiant.
  const datesParSemestre: Record<'S1' | 'S2', string[]> = {
    S1: ['2026-09-15', '2026-09-29', '2026-10-13', '2026-10-27'],
    S2: ['2027-02-09', '2027-02-23', '2027-03-09', '2027-03-23'],
  };
  const dates = datesParSemestre[libelleSemestrePourDates];
  const coursPourAbsences = ues.flatMap((u) => u.cours).slice(0, 3);

  const tachesAbsences: (() => Promise<void>)[] = [];
  for (const cours of coursPourAbsences) {
    for (const date of dates) {
      const nombreAbsents = entierAleatoireEntre(1, 6);
      const absents = melangerTableau(inscriptions).slice(0, nombreAbsents).map((i) => i.id);
      tachesAbsences.push(() =>
        appelApi('POST', '/absences', {
          classeId,
          coursId: cours.id,
          dateSeance: date,
          inscriptionsAbsentes: absents,
        }).then(() => undefined)
      );
    }
  }
  console.log(`    Envoi de ${tachesAbsences.length} feuilles de présence...`);
  await executerParLots(tachesAbsences, CONCURRENCE_MAX);
}

async function main() {
  console.log('=== Remplissage complet, connexion ===');
  const connexion = await appelApi<{ tokenAcces: string }>('POST', '/auth/connexion', {
    email: ADMIN_EMAIL,
    motDePasse: ADMIN_MOT_DE_PASSE,
  });
  token = connexion.tokenAcces;
  console.log('Connecté.\n');

  console.log('=== Découverte ou création de l\'année universitaire ===');
  type Annee = { id: string; libelle: string };
  type Classe = { id: string; nom: string; niveauId: string; semestreActifId: string };

  let annees = await appelApi<Annee[]>('GET', '/referentiel/annees-universitaires');
  let annee: Annee;
  let classes: Classe[];

  if (annees.length === 0) {
    console.log('Aucune année trouvée. Création de 2026-2027...');
    const resultat = await appelApi<{ annee: Annee; classesCreees: string[] }>(
      'POST',
      '/referentiel/annees-universitaires',
      { libelle: '2026-2027', dateDebut: '2026-09-01', dateFin: '2027-07-31' }
    );
    annee = resultat.annee;
    console.log(`Année créée avec ${resultat.classesCreees.length} classes.\n`);
  } else {
    annee = annees[0];
    console.log(`Année existante utilisée : ${annee.libelle}\n`);
  }

  classes = await appelApi<Classe[]>('GET', `/classes?anneeUniversitaireId=${annee.id}`);
  if (classes.length === 0) {
    throw new Error("Aucune classe trouvée pour cette année, même après vérification. Abandon.");
  }
  console.log(`${classes.length} classe(s) trouvée(s) : ${classes.map((c) => c.nom).join(', ')}\n`);

  let compteurGlobalMatricule = 1;

  for (const classe of classes) {
    console.log(`\n########## Classe ${classe.nom} ##########`);

    // --- Créer les 40 étudiants et les inscrire dans cette classe ---
    console.log(`  Création de ${ELEVES_PAR_CLASSE} étudiants...`);
    const inscriptions: { id: string }[] = [];
    // Séquentiel, pas par lots : compteurGlobalMatricule doit rester
    // strictement croissant sans collision, un incrément concurrent
    // pourrait produire deux fois le même matricule.
    for (let i = 0; i < ELEVES_PAR_CLASSE; i++) {
      const prenom = choisirAleatoirement(PRENOMS);
      const nom = choisirAleatoirement(NOMS);
      const matricule = `2026-${String(compteurGlobalMatricule++).padStart(4, '0')}`;
      const etudiant = await creerEtudiant(prenom, nom, matricule);
      const inscription = await inscrire(etudiant.id, classe.id);
      inscriptions.push(inscription);
    }
    console.log('  Étudiants créés et inscrits.');

    // --- Semestre 1 ---
    console.log('  --- Semestre 1 ---');
    const uesS1 = await decouvrirUEs(classe.semestreActifId);
    console.log(`  ${uesS1.length} UE découvertes pour S1.`);
    await remplirSemestrePourClasse(classe.id, uesS1, inscriptions, 'S1');

    // --- Bascule vers le semestre 2 ---
    console.log('  Bascule vers le semestre 2...');
    const classeApresBascule = await appelApi<Classe>('PATCH', `/classes/${classe.id}/basculer-semestre`);
    console.log('  Bascule effectuée.');

    // --- Semestre 2 ---
    console.log('  --- Semestre 2 ---');
    const uesS2 = await decouvrirUEs(classeApresBascule.semestreActifId);
    console.log(`  ${uesS2.length} UE découvertes pour S2.`);
    await remplirSemestrePourClasse(classe.id, uesS2, inscriptions, 'S2');

    console.log(`  Classe ${classe.nom} terminée.`);
  }

  console.log('\n=== Terminé ===');
  console.log(`${classes.length} classes remplies, ${classes.length * ELEVES_PAR_CLASSE} étudiants au total.`);
  console.log("Chaque classe a été basculée sur S2. Pensez-y si vous vouliez tester l'écran depuis S1 sur ces classes.");
}

main().catch((erreur) => {
  console.error('\nÉchec du script :', erreur.message);
  process.exit(1);
});
