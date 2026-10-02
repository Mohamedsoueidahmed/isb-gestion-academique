import { NatureUE } from '@prisma/client';
import { semestresM1PartagesAA } from './donnees.master-aa-m1-partage';

/**
 * Master Administration des Affaires, spécialisation Comptabilité,
 * Contrôle et Audit — parcours complet, autonome, de M1 à M2. Le M1
 * (S1+S2) vient de la source partagée donnees.master-aa-m1-partage.ts
 * (identique à celui de Management et Finance) ; le M2 (S3+S4) est propre
 * à cette spécialisation.
 */
export const donneesMasterAACCA = {
  codeCourt: 'CCA',
  nom: 'Comptabilité, Contrôle et Audit',
  semestres: [
    ...semestresM1PartagesAA,
    {
      libelle: 'S3', ordre: 1, niveauOrdre: 2, niveauLibelle: 'M2', credits: 30,
      ue: [
        { code: 'UE.09', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'ACCT610', titre: 'Normes et Difficultés Comptables Approfondies', prerequisCode: 'ACCT570', heures: 60 },
        ]},
        { code: 'UE.10', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'ACCT620', titre: 'Audit financière Approfondi', prerequisCode: 'ACCT570', heures: 60 },
        ]},
        { code: 'UE.11', nature: NatureUE.FONDAMENTALE, credits: 12, cours: [
          { code: 'ACCT640', titre: 'Droit approfondi des sociétés commerciales', prerequisCode: 'ACCT570', heures: 60 },
          { code: 'ACCT650', titre: 'Évaluation des entreprises et Opérations de fusion-acquisition', prerequisCode: 'ACCT570', heures: 60 },
        ]},
        { code: 'UE.12', nature: NatureUE.OPTIONNELLE, credits: 6, cours: [] }, // Créneau électif — catalogue Master AA
      ],
    },
    {
      libelle: 'S4', ordre: 2, niveauOrdre: 2, niveauLibelle: 'M2', credits: 30,
      ue: [
        { code: 'UE.13', nature: NatureUE.FONDAMENTALE, credits: 30, finDeCycle: true, cours: [
          { code: 'ACCT698', titre: 'Stage de Fin d\u2019études', prerequisCode: null, heures: 300 },
        ]},
      ],
    },
  ],
};
