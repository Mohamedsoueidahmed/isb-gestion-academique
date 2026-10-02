import { NatureUE } from '@prisma/client';
import { semestresM1PartagesAA } from './donnees.master-aa-m1-partage';

/**
 * Master Administration des Affaires, spécialisation Finance et Banques
 * — parcours complet, autonome, de M1 à M2. Le M1 (S1+S2) vient de la
 * source partagée donnees.master-aa-m1-partage.ts (identique à celui de
 * Management et CCA) ; le M2 (S3+S4) est propre à cette spécialisation.
 */
export const donneesMasterAAFinance = {
  codeCourt: 'FIN',
  nom: 'Finance et Banques',
  semestres: [
    ...semestresM1PartagesAA,
    {
      libelle: 'S3', ordre: 1, niveauOrdre: 2, niveauLibelle: 'M2', credits: 30,
      ue: [
        { code: 'UE.09', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'FINA600', titre: 'Ingénierie Financière', prerequisCode: 'FINA550', heures: 60 },
        ]},
        { code: 'UE.10', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'FINA650', titre: 'Marchés financiers et Evaluation des actifs', prerequisCode: 'FINA550', heures: 60 },
        ]},
        { code: 'UE.11', nature: NatureUE.FONDAMENTALE, credits: 12, cours: [
          { code: 'FINA620', titre: 'Gestion bancaire approfondie', prerequisCode: 'FINA550', heures: 60 },
          { code: 'FINA630', titre: 'Gestion Approfondie de Risque Financier', prerequisCode: 'FINA550', heures: 60 },
        ]},
        { code: 'UE.12', nature: NatureUE.OPTIONNELLE, credits: 6, cours: [] }, // Créneau électif — catalogue Master AA
      ],
    },
    {
      libelle: 'S4', ordre: 2, niveauOrdre: 2, niveauLibelle: 'M2', credits: 30,
      ue: [
        { code: 'UE.13', nature: NatureUE.FONDAMENTALE, credits: 30, finDeCycle: true, cours: [
          { code: 'FINA698', titre: 'Stage de Fin d\u2019études', prerequisCode: null, heures: 300 },
        ]},
      ],
    },
  ],
};
