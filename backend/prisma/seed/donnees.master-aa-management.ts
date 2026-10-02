import { NatureUE } from '@prisma/client';
import { semestresM1PartagesAA } from './donnees.master-aa-m1-partage';

/**
 * Master Administration des Affaires, spécialisation Management Appliqué
 * — parcours complet, autonome, de M1 à M2. Le M1 (S1+S2) vient de la
 * source partagée donnees.master-aa-m1-partage.ts (identique à celui de
 * CCA et Finance) ; le M2 (S3+S4) est propre à cette spécialisation.
 */
export const donneesMasterAAManagement = {
  codeCourt: 'MGT',
  nom: 'Management Appliqué',
  semestres: [
    ...semestresM1PartagesAA,
    {
      libelle: 'S3', ordre: 1, niveauOrdre: 2, niveauLibelle: 'M2', credits: 30,
      ue: [
        { code: 'UE.09', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'MNGT600', titre: 'Gestion approfondie de Ressources Humaines', prerequisCode: 'MNGT500', heures: 60 },
        ]},
        { code: 'UE.10', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'MPROJ550', titre: 'Conception des projets', prerequisCode: 'MNGT500', heures: 60 },
        ]},
        { code: 'UE.11', nature: NatureUE.FONDAMENTALE, credits: 12, cours: [
          { code: 'LOGI550', titre: 'Gestion avancée de Logistiques', prerequisCode: 'MNGT500', heures: 60 },
          { code: 'MNGT650', titre: 'Procédures de Passation des marchés publics', prerequisCode: 'MNGT500', heures: 60 },
        ]},
        { code: 'UE.12', nature: NatureUE.OPTIONNELLE, credits: 6, cours: [] }, // Créneau électif — catalogue Master AA
      ],
    },
    {
      libelle: 'S4', ordre: 2, niveauOrdre: 2, niveauLibelle: 'M2', credits: 30,
      ue: [
        { code: 'UE.13', nature: NatureUE.FONDAMENTALE, credits: 30, finDeCycle: true, cours: [
          { code: 'MNGT697', titre: 'Stage de Fin d\u2019études', prerequisCode: null, heures: 300 },
        ]},
      ],
    },
  ],
};
