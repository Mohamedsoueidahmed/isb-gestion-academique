import { NatureUE } from '@prisma/client';
import { semestresM1PartagesInfo } from './donnees.master-info-m1-partage';

/**
 * Master Informatique Appliquée aux Entreprises, parcours Intelligence
 * Artificielle — parcours complet, autonome, de M1 à M2. Le M1 (S1+S2)
 * vient de la source partagée donnees.master-info-m1-partage.ts
 * (identique à celui de CDSI) ; le M2 (S3+S4) est propre à cette
 * spécialisation.
 */
export const donneesMasterInfoIA = {
  codeCourt: 'IA',
  nom: 'Intelligence Artificielle',
  semestres: [
    ...semestresM1PartagesInfo,
    {
      libelle: 'S3', ordre: 1, niveauOrdre: 2, niveauLibelle: 'M2', credits: 30,
      ue: [
        { code: 'UE.09', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'MCSIA620', titre: 'Business Intelligence', prerequisCode: 'MCSC560', heures: 60 },
        ]},
        { code: 'UE.10', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'MCSIA640', titre: 'Machine Learning et Deep Learning', prerequisCode: 'MCSC560', heures: 60 },
        ]},
        { code: 'UE.11', nature: NatureUE.FONDAMENTALE, credits: 12, cours: [
          { code: 'MCSIA670', titre: 'Traitement du Langage Naturel (NLP)', prerequisCode: 'MCSC560', heures: 60 },
          { code: 'MCSIA680', titre: 'Vision par Ordinateur', prerequisCode: 'MCSC560', heures: 60 },
        ]},
        { code: 'UE.12', nature: NatureUE.OPTIONNELLE, credits: 6, cours: [] }, // Créneau électif — catalogue Master Informatique
      ],
    },
    {
      libelle: 'S4', ordre: 2, niveauOrdre: 2, niveauLibelle: 'M2', credits: 30,
      ue: [
        { code: 'UE.13', nature: NatureUE.FONDAMENTALE, credits: 30, finDeCycle: true, cours: [
          { code: 'MCIA697', titre: 'Stage de Fin d\u2019études', prerequisCode: null, heures: 300 },
        ]},
      ],
    },
  ],
};
