import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { donneesCCA } from './seed/donnees.cca';
import { donneesFBA } from './seed/donnees.fba';
import { donneesGCI } from './seed/donnees.gci';
import { donneesCoursElectifs } from './seed/donnees.electifs';

import { donneesLicenceInformatique } from './seed/donnees.licence-informatique';
import { donneesElectifsLicenceInformatique } from './seed/donnees.electifs.licence-informatique';

import { donneesLicenceCommunicationAnglais } from './seed/donnees.licence-communication-anglais';
import { donneesElectifsLicenceCommunicationAnglais } from './seed/donnees.electifs.licence-communication-anglais';

import { donneesMasterAAManagement } from './seed/donnees.master-aa-management';
import { donneesMasterAACCA } from './seed/donnees.master-aa-cca';
import { donneesMasterAAFinance } from './seed/donnees.master-aa-finance';
import { donneesElectifsMasterAA } from './seed/donnees.electifs.master-aa';

import { donneesMasterInfoCDSI } from './seed/donnees.master-info-cdsi';
import { donneesMasterInfoIA } from './seed/donnees.master-info-ia';
import { donneesElectifsMasterInfo } from './seed/donnees.electifs.master-info';

import { donneesMasterAnglais } from './seed/donnees.master-anglais';
import { donneesElectifsMasterAnglais } from './seed/donnees.electifs.master-anglais';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Chaque formation est traitée indépendamment : sa propre Formation, son
 * propre catalogue électif (jamais mélangé avec les autres, depuis la
 * séparation des catalogues), et ses propres parcours. Ajouter une
 * nouvelle formation plus tard ne demande qu'une entrée de plus ici,
 * jamais une réécriture de la boucle elle-même.
 */
const formations = [
  {
    id: 'formation-unique', // conservé tel quel : c'est l'id déjà utilisé en production pour la Licence
    nom: 'Licence Administration des Affaires',
    cycle: 'LICENCE' as const,
    nombreNiveaux: 3,
    creditsTotal: 180,
    heuresTotal: 1800,
    electifs: donneesCoursElectifs,
    parcoursListe: [donneesCCA, donneesFBA, donneesGCI],
  },
  {
    id: 'formation-licence-informatique',
    nom: 'Licence Sciences Informatiques',
    cycle: 'LICENCE' as const,
    nombreNiveaux: 3,
    creditsTotal: 180,
    heuresTotal: 1800,
    electifs: donneesElectifsLicenceInformatique,
    parcoursListe: [donneesLicenceInformatique],
  },
  {
    id: 'formation-licence-communication-anglais',
    nom: 'License of Arts in Communication and Business English',
    cycle: 'LICENCE' as const,
    nombreNiveaux: 3,
    creditsTotal: 180,
    heuresTotal: 1800,
    electifs: donneesElectifsLicenceCommunicationAnglais,
    parcoursListe: [donneesLicenceCommunicationAnglais],
  },
  {
    id: 'formation-master-aa',
    nom: 'Master Administration des Affaires',
    cycle: 'MASTER' as const,
    nombreNiveaux: 2,
    creditsTotal: 120,
    heuresTotal: 1200,
    electifs: donneesElectifsMasterAA,
    parcoursListe: [donneesMasterAAManagement, donneesMasterAACCA, donneesMasterAAFinance],
  },
  {
    id: 'formation-master-informatique',
    nom: 'Master Informatique Appliquée aux Entreprises',
    cycle: 'MASTER' as const,
    nombreNiveaux: 2,
    creditsTotal: 120,
    heuresTotal: 1200,
    electifs: donneesElectifsMasterInfo,
    parcoursListe: [donneesMasterInfoCDSI, donneesMasterInfoIA],
  },
  {
    id: 'formation-master-anglais',
    nom: 'Master Anglais',
    cycle: 'MASTER' as const,
    nombreNiveaux: 2,
    creditsTotal: 120,
    heuresTotal: 1200,
    electifs: donneesElectifsMasterAnglais,
    parcoursListe: [donneesMasterAnglais],
  },
];

async function inserer() {
  console.log('Début du remplissage du référentiel académique...');

  // --- Université (placeholder, à configurer plus tard par l'administration) ---
  const universite = await prisma.universite.upsert({
    where: { id: 'universite-unique' },
    update: {},
    create: {
      id: 'universite-unique',
      nom: '[NOM DE L\'UNIVERSITÉ]',
      nomCourt: '[NOM COURT]',
    },
  });
  console.log(`Université : ${universite.nom}`);

  // --- Année universitaire ---
  const anneeUniversitaire = await prisma.anneeUniversitaire.upsert({
    where: { libelle: '2026-2027' },
    update: {},
    create: {
      libelle: '2026-2027',
      dateDebut: new Date('2026-09-01'),
      dateFin: new Date('2027-07-31'),
      estActive: true,
    },
  });
  console.log(`Année universitaire : ${anneeUniversitaire.libelle}`);

  for (const donneesFormation of formations) {
    const formation = await prisma.formation.upsert({
      where: { id: donneesFormation.id },
      update: { cycle: donneesFormation.cycle },
      create: {
        id: donneesFormation.id,
        nom: donneesFormation.nom,
        cycle: donneesFormation.cycle,
        nombreNiveaux: donneesFormation.nombreNiveaux,
        creditsTotal: donneesFormation.creditsTotal,
        heuresTotal: donneesFormation.heuresTotal,
      },
    });
    console.log(`\n=== Formation : ${formation.nom} ===`);

    // --- Catalogue électif propre à CETTE formation ---
    for (const electif of donneesFormation.electifs) {
      await prisma.coursElectif.upsert({
        where: { code: electif.code },
        update: { formationId: formation.id },
        create: { ...electif, formationId: formation.id },
      });
    }
    console.log(`Catalogue électif : ${donneesFormation.electifs.length} cours insérés.`);

    for (const donneesParcours of donneesFormation.parcoursListe) {
      const parcours = await prisma.parcours.upsert({
        where: { formationId_codeCourt: { formationId: formation.id, codeCourt: donneesParcours.codeCourt } },
        update: {},
        create: {
          formationId: formation.id,
          nom: donneesParcours.nom,
          codeCourt: donneesParcours.codeCourt,
        },
      });
      console.log(`\nParcours : ${parcours.nom}`);

      // Regrouper les semestres par niveau pour créer chaque Niveau une seule fois
      const niveauxDejaCrees = new Map<string, string>(); // libelle -> id

      for (const donneesSemestre of donneesParcours.semestres) {
        let niveauId = niveauxDejaCrees.get(donneesSemestre.niveauLibelle);

        if (!niveauId) {
          const niveau = await prisma.niveau.upsert({
            where: { parcoursId_libelle: { parcoursId: parcours.id, libelle: donneesSemestre.niveauLibelle } },
            update: {},
            create: {
              parcoursId: parcours.id,
              libelle: donneesSemestre.niveauLibelle,
              ordre: donneesSemestre.niveauOrdre,
            },
          });
          niveauId = niveau.id;
          niveauxDejaCrees.set(donneesSemestre.niveauLibelle, niveauId);
        }

        const semestre = await prisma.semestre.upsert({
          where: { niveauId_libelle: { niveauId, libelle: donneesSemestre.libelle } },
          update: {},
          create: {
            niveauId,
            libelle: donneesSemestre.libelle,
            ordre: donneesSemestre.ordre,
            credits: donneesSemestre.credits,
          },
        });
        console.log(`  ${donneesSemestre.niveauLibelle} - ${semestre.libelle}`);

        for (const donneesUE of donneesSemestre.ue) {
          const ue = await prisma.uE.upsert({
            where: { semestreId_code: { semestreId: semestre.id, code: donneesUE.code } },
            update: {
              nature: donneesUE.nature,
              credits: donneesUE.credits ?? 0,
              choixExclusif: donneesUE.choixExclusif ?? false,
              finDeCycle: donneesUE.finDeCycle ?? false,
            },
            create: {
              semestreId: semestre.id,
              code: donneesUE.code,
              nature: donneesUE.nature,
              credits: donneesUE.credits ?? 0,
              choixExclusif: donneesUE.choixExclusif ?? false,
              finDeCycle: donneesUE.finDeCycle ?? false,
            },
          });

          for (const donneesCours of donneesUE.cours) {
            await prisma.cours.upsert({
              where: { ueId_code: { ueId: ue.id, code: donneesCours.code } },
              update: { estElectif: donneesUE.nature === 'OPTIONNELLE' },
              create: {
                ueId: ue.id,
                code: donneesCours.code,
                titre: donneesCours.titre,
                prerequisCode: donneesCours.prerequisCode,
                heures: donneesCours.heures,
                estElectif: donneesUE.nature === 'OPTIONNELLE',
              },
            });
          }
          console.log(`    ${ue.code} (${ue.credits} crédits), ${donneesUE.cours.length} cours`);
        }
      }
    }
  }

  console.log('\nRemplissage terminé avec succès.');
}

inserer()
  .catch((erreur) => {
    console.error('Erreur pendant le remplissage :', erreur);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
