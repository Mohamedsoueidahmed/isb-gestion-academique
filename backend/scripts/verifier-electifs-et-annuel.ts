/**
 * Script de VÉRIFICATION, pas de remplissage massif — un petit nombre
 * d'étudiants, chacun avec un rôle précis et déchiffrable, pour confirmer
 * que tout fonctionne ensemble avant de continuer :
 *
 * - Sur L2-CCA-A : trois étudiants couvrant le créneau UE.16 (S4) — deux
 *   choisissent des électifs différents, un ne choisit rien du tout — puis
 *   la moyenne annuelle sur le bulletin de S4 (dernier semestre de L2).
 * - Sur L3-CCA-A : deux étudiants couvrant UE.20 (S5) et UE.23 (S6), avec
 *   des choix différents entre les deux créneaux — puis la moyenne
 *   annuelle sur le bulletin de S6 (dernier semestre de L3).
 *
 * Passe entièrement par l'API réelle. Auto-suffisant : découvre l'état
 * réel de la base plutôt que de le supposer.
 *
 * Usage : npx tsx scripts/verifier-electifs-et-annuel.ts
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
    throw new Error(`${methode} ${chemin} → ${reponse.status} : ${donnees?.message ?? 'erreur inconnue'}`);
  }

  return donnees.donnees as T;
}

type Annee = { id: string; libelle: string };
type Classe = { id: string; nom: string; niveauId: string; semestreActifId: string };
type UEDecouverte = { id: string; code: string; credits: number; cours: { id: string; code: string }[] };
type CatalogueEntree = { code: string; titre: string };

/**
 * Découvre les UE d'un semestre à partir de ses cours — MAIS un créneau
 * électif sans encore aucun choix assigné n'a ZÉRO cours réel, donc reste
 * invisible via cette seule méthode (elle part des cours, pas des UE). On
 * le récupère séparément, par la classe, pour ne jamais le manquer.
 */
async function decouvrirUEs(semestreId: string, classeId: string): Promise<UEDecouverte[]> {
  const coursDuSemestre = await appelApi<
    { id: string; code: string; ue: { id: string; code: string; credits: number } }[]
  >('GET', `/referentiel/semestres/${semestreId}/cours`);

  const uesMap = new Map<string, UEDecouverte>();
  for (const cours of coursDuSemestre) {
    if (!uesMap.has(cours.ue.id)) {
      uesMap.set(cours.ue.id, { id: cours.ue.id, code: cours.ue.code, credits: cours.ue.credits, cours: [] });
    }
    uesMap.get(cours.ue.id)!.cours.push({ id: cours.id, code: cours.code });
  }

  const creneauxElectifs = await appelApi<{ id: string; code: string; credits: number }[]>(
    'GET',
    `/electifs/classes/${classeId}/creneaux`
  );
  for (const creneau of creneauxElectifs) {
    if (!uesMap.has(creneau.id)) {
      uesMap.set(creneau.id, { id: creneau.id, code: creneau.code, credits: creneau.credits, cours: [] });
    }
  }

  return Array.from(uesMap.values());
}

async function creerOuTrouverEtudiant(prenom: string, nom: string, matricule: string): Promise<string> {
  const resultats = await appelApi<{ id: string; matricule: string }[]>(
    'GET',
    `/etudiants?recherche=${encodeURIComponent(matricule)}`
  );
  const existant = resultats.find((e) => e.matricule === matricule);
  if (existant) return existant.id;

  const etudiant = await appelApi<{ id: string }>('POST', '/etudiants', { prenom, nom, matricule });
  return etudiant.id;
}

async function trouverOuCreerInscription(etudiantId: string, classeId: string): Promise<string> {
  const etudiantDetail = await appelApi<{
    inscriptions: { id: string; classe: { id: string }; statutInscription: string }[];
  }>('GET', `/etudiants/${etudiantId}`);

  const inscriptionExistante = etudiantDetail.inscriptions.find(
    (i) => i.classe.id === classeId && i.statutInscription === 'ACTIVE'
  );
  if (inscriptionExistante) return inscriptionExistante.id;

  const inscription = await appelApi<{ id: string }>('POST', '/etudiants/inscriptions', { etudiantId, classeId });
  return inscription.id;
}

/**
 * Réutilise l'étudiant et l'inscription s'ils existent déjà — nécessaire
 * pour que ce script reste rejouable après un échec partiel, puisqu'aucune
 * suppression d'étudiant n'existe dans l'application pour nettoyer un essai
 * précédent avant d'en relancer un nouveau.
 */
async function creerEtInscrire(prenom: string, nom: string, matricule: string, classeId: string) {
  const etudiantId = await creerOuTrouverEtudiant(prenom, nom, matricule);
  return trouverOuCreerInscription(etudiantId, classeId);
}

async function saisirComposante(inscriptionId: string, coursId: string, type: string, valeur: number) {
  await appelApi('POST', '/notes', { inscriptionId, coursId, type, valeur });
}

/**
 * Note confortable (14 partout) pour un cours — D1=D2=Exposé=ExamS1=14
 * donne exactement 14 comme moyenne (formule Licence, poids 1+1+0,75+2,25=5).
 */
async function noterConfortablement(inscriptionId: string, coursId: string, valeur = 14) {
  await saisirComposante(inscriptionId, coursId, 'DEVOIR_1', valeur);
  await saisirComposante(inscriptionId, coursId, 'DEVOIR_2', valeur);
  await saisirComposante(inscriptionId, coursId, 'EXPOSE', valeur);
  await saisirComposante(inscriptionId, coursId, 'EXAMEN_SESSION_1', valeur);
}

async function noterTousLesCoursSauf(inscriptionId: string, ues: UEDecouverte[], ueACarterCode: string) {
  for (const ue of ues) {
    if (ue.code === ueACarterCode) continue; // créneau électif, pas de cours structurel à noter directement
    for (const cours of ue.cours) {
      await noterConfortablement(inscriptionId, cours.id);
    }
  }
}

async function assignerEtNoterElectif(
  inscriptionId: string,
  ueId: string,
  codeCatalogue: string,
  valeur = 14
) {
  const choix = await appelApi<{ coursId: string }>('POST', '/electifs/choix', {
    inscriptionId,
    ueId,
    codeCoursElectif: codeCatalogue,
  });
  await noterConfortablement(inscriptionId, choix.coursId, valeur);
}

async function main() {
  console.log('=== Vérification complète : connexion ===');
  const connexion = await appelApi<{ tokenAcces: string }>('POST', '/auth/connexion', {
    email: ADMIN_EMAIL,
    motDePasse: ADMIN_MOT_DE_PASSE,
  });
  token = connexion.tokenAcces;
  console.log('Connecté.\n');

  const annees = await appelApi<Annee[]>('GET', '/referentiel/annees-universitaires');
  if (annees.length === 0) {
    throw new Error("Aucune année trouvée. Créez-en une (bouton \"+ Nouvelle année\") avant de relancer ce script.");
  }

  // Cherche, parmi TOUTES les années existantes, celle qui a réellement les
  // deux classes nécessaires — jamais deviner avec la première trouvée.
  let classeL2: Classe | undefined;
  let classeL3: Classe | undefined;
  let anneeUtilisee: Annee | undefined;

  for (const annee of annees) {
    const classes = await appelApi<Classe[]>('GET', `/classes?anneeUniversitaireId=${annee.id}`);
    const l2 = classes.find((c) => c.nom.startsWith('L2-CCA'));
    const l3 = classes.find((c) => c.nom.startsWith('L3-CCA'));
    if (l2 && l3) {
      classeL2 = l2;
      classeL3 = l3;
      anneeUtilisee = annee;
      break;
    }
  }

  if (!classeL2 || !classeL3 || !anneeUtilisee) {
    throw new Error(
      'Impossible de trouver à la fois une classe L2-CCA et L3-CCA pour une même année. Vérifiez que cette année a bien été activée (9 classes créées).'
    );
  }
  console.log(`Année utilisée : ${anneeUtilisee.libelle}`);
  console.log(`Classes : ${classeL2.nom}, ${classeL3.nom}\n`);

  const catalogue = await appelApi<CatalogueEntree[]>('GET', '/electifs/catalogue');
  if (catalogue.length < 2) {
    throw new Error('Le catalogue électif a besoin d\'au moins deux entrées pour ce test. Ajoutez-en une deuxième.');
  }
  const [electifA, electifB] = catalogue;
  console.log(`Deux entrées du catalogue utilisées pour les choix : ${electifA.code}, ${electifB.code}\n`);

  // ========== L2-CCA-A : créneau UE.16 (S4), puis annuel ==========
  console.log('########## L2-CCA-A ##########');

  const classeL2Actuelle = await appelApi<Classe>('GET', `/classes/${classeL2.id}`);
  const uesActuellesL2 = await decouvrirUEs(classeL2Actuelle.semestreActifId, classeL2.id);
  const estDejaSurS4 = uesActuellesL2.some((ue) => ue.code === 'UE.16');

  if (!estDejaSurS4) {
    console.log('Classe encore sur S3. Saisie de S3 pour trois nouveaux étudiants...');
    const inscL2_1 = await creerEtInscrire('Verif', 'ElectifUn', 'VERIF-201', classeL2.id);
    const inscL2_2 = await creerEtInscrire('Verif', 'ElectifDeux', 'VERIF-202', classeL2.id);
    const inscL2_3 = await creerEtInscrire('Verif', 'SansElectif', 'VERIF-203', classeL2.id);

    for (const insc of [inscL2_1, inscL2_2, inscL2_3]) {
      for (const ue of uesActuellesL2) {
        for (const cours of ue.cours) {
          await noterConfortablement(insc, cours.id);
        }
      }
    }
    console.log('S3 saisi pour les trois étudiants.');

    console.log('Bascule vers S4...');
    const classeApresBascule = await appelApi<Classe>('PATCH', `/classes/${classeL2.id}/basculer-semestre`);

    console.log('Saisie de S4 (hors créneau électif)...');
    const uesS4 = await decouvrirUEs(classeApresBascule.semestreActifId, classeL2.id);
    for (const insc of [inscL2_1, inscL2_2, inscL2_3]) {
      await noterTousLesCoursSauf(insc, uesS4, 'UE.16');
    }

    const creneauUE16 = uesS4.find((ue) => ue.code === 'UE.16');
    if (!creneauUE16) {
      throw new Error("UE.16 introuvable sur S4. Vérifiez que la correction de nature a bien été appliquée.");
    }

    console.log(`Assignation des électifs UE.16 : ${electifA.code} et ${electifB.code}, un étudiant sans choix...`);
    await assignerEtNoterElectif(inscL2_1, creneauUE16.id, electifA.code);
    await assignerEtNoterElectif(inscL2_2, creneauUE16.id, electifB.code);
    // inscL2_3 : volontairement AUCUN choix électif — pour vérifier que son
    // bulletin affiche "non calculable" sur UE.16, jamais une erreur.

    console.log('L2-CCA-A terminé : S3 et S4 saisis, électifs assignés, semestre actif désormais S4.\n');
  } else {
    console.log('Classe déjà sur S4 (créneau UE.16 déjà visible). Aucune nouvelle saisie, pour ne pas dupliquer un test précédent.\n');
  }

  // ========== L3-CCA-A : créneaux UE.20 (S5) et UE.23 (S6), puis annuel ==========
  console.log('########## L3-CCA-A ##########');

  const classeL3Actuelle = await appelApi<Classe>('GET', `/classes/${classeL3.id}`);
  const uesActuellesL3 = await decouvrirUEs(classeL3Actuelle.semestreActifId, classeL3.id);
  const estDejaSurS6 = uesActuellesL3.some((ue) => ue.code === 'UE.23');

  if (!estDejaSurS6) {
    console.log('Saisie de S5 (avec UE.20) pour deux nouveaux étudiants...');
    const inscL3_1 = await creerEtInscrire('Verif', 'L3Complet', 'VERIF-301', classeL3.id);
    const inscL3_2 = await creerEtInscrire('Verif', 'L3Annuel', 'VERIF-302', classeL3.id);

    for (const insc of [inscL3_1, inscL3_2]) {
      await noterTousLesCoursSauf(insc, uesActuellesL3, 'UE.20');
    }

    const creneauUE20 = uesActuellesL3.find((ue) => ue.code === 'UE.20');
    if (!creneauUE20) {
      throw new Error("UE.20 introuvable sur S5. Vérifiez que la correction de nature a bien été appliquée.");
    }

    console.log(`Assignation UE.20 : les deux étudiants choisissent ${electifA.code}...`);
    await assignerEtNoterElectif(inscL3_1, creneauUE20.id, electifA.code);
    await assignerEtNoterElectif(inscL3_2, creneauUE20.id, electifA.code);
    console.log('S5 terminé.');

    console.log('Bascule vers S6...');
    const classeApresBasculeL3 = await appelApi<Classe>('PATCH', `/classes/${classeL3.id}/basculer-semestre`);

    console.log('Saisie de S6 (avec UE.23)...');
    const uesS6 = await decouvrirUEs(classeApresBasculeL3.semestreActifId, classeL3.id);
    for (const insc of [inscL3_1, inscL3_2]) {
      await noterTousLesCoursSauf(insc, uesS6, 'UE.23');
    }

    const creneauUE23 = uesS6.find((ue) => ue.code === 'UE.23');
    if (!creneauUE23) {
      throw new Error("UE.23 introuvable sur S6. Vérifiez que le créneau existe bien pour ce parcours.");
    }

    console.log(`Assignation UE.23 : les deux étudiants choisissent ${electifB.code} cette fois (différent de S5)...`);
    await assignerEtNoterElectif(inscL3_1, creneauUE23.id, electifB.code);
    await assignerEtNoterElectif(inscL3_2, creneauUE23.id, electifB.code);

    console.log('L3-CCA-A terminé : S5 et S6 saisis, électifs assignés, semestre actif désormais S6.\n');
  } else {
    console.log('Classe déjà sur S6 (créneau UE.23 déjà visible). Aucune nouvelle saisie, pour ne pas dupliquer un test précédent.\n');
  }

  console.log('=== Terminé ===\n');
  console.log("Ce qu'il faut vérifier maintenant, dans le navigateur :");
  console.log('');
  console.log('1. Classes, L2-CCA-A, Bulletins : le bulletin de VerifElectifUn et VerifElectifDeux');
  console.log('   doit montrer UE.16 avec des cours différents (leurs choix respectifs). VerifSansElectif');
  console.log('   doit montrer UE.16 "non calculable" et son bulletin entier "non calculable" (une UE incomplète).');
  console.log('   Les deux autres doivent montrer une moyenne annuelle et une décision de passage (S4 = dernier semestre de L2).');
  console.log('');
  console.log('2. Classes, L3-CCA-A, Bulletins : VerifL3Complet et VerifL3Annuel doivent montrer');
  console.log('   UE.20 et UE.23 avec des cours différents entre les deux créneaux (électifs différents choisis),');
  console.log('   et une moyenne annuelle avec décision de passage (S6 = dernier semestre de L3).');
}

main().catch((erreur) => {
  console.error('\nÉchec du script :', erreur.message);
  process.exit(1);
});
