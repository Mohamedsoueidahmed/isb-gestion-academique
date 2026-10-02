import { NatureUE } from '@prisma/client';
import { semestresM1PartagesInfo } from './donnees.master-info-m1-partage';

/**
 * Master Informatique Appliquée aux Entreprises, parcours Conception et
 * Développement des Systèmes d'Information — parcours complet, autonome,
 * de M1 à M2. Le M1 (S1+S2) vient de la source partagée
 * donnees.master-info-m1-partage.ts (identique à celui d'IA) ; le M2
 * (S3+S4) est propre à cette spécialisation.
 */
export const donneesMasterInfoCDSI = {
  codeCourt: 'CDSI',
  nom: 'Conception et Développement des Systèmes d\u2019Information',
  semestres: [
    ...semestresM1PartagesInfo,
    {
      libelle: 'S3', ordre: 1, niveauOrdre: 2, niveauLibelle: 'M2', credits: 30,
      ue: [
        { code: 'UE.09', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'MCSCS610', titre: 'Génie Logiciel Avancé, Agilité et DevOps', prerequisCode: 'MCSC570', heures: 60 },
        ]},
        { code: 'UE.10', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'MCSCS630', titre: 'Développement Web Avancé et IoT', prerequisCode: 'MCSC560', heures: 60 },
        ]},
        { code: 'UE.11', nature: NatureUE.FONDAMENTALE, credits: 12, cours: [
          { code: 'MCSCS650', titre: 'Protocoles Réseau Avancés et Sécurité des IoT', prerequisCode: 'MCSC540', heures: 60 },
          { code: 'MCSCS660', titre: 'Programmation parallèle et architecture distribuées', prerequisCode: 'MCSC570', heures: 60 },
        ]},
        { code: 'UE.12', nature: NatureUE.OPTIONNELLE, credits: 6, cours: [] }, // Créneau électif — catalogue Master Informatique
      ],
    },
    {
      libelle: 'S4', ordre: 2, niveauOrdre: 2, niveauLibelle: 'M2', credits: 30,
      ue: [
        { code: 'UE.13', nature: NatureUE.FONDAMENTALE, credits: 30, finDeCycle: true, cours: [
          { code: 'MCSCS697', titre: 'Stage de Fin d\u2019études', prerequisCode: null, heures: 300 },
        ]},
      ],
    },
  ],
};
