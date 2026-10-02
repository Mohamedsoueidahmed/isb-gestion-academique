import { NatureUE } from '@prisma/client';

/**
 * Semestres M1 (S1+S2) partagés entre les trois spécialisations du Master
 * Administration des Affaires (Management, CCA, Finance) — une seule
 * source à maintenir, mais chaque spécialisation crée sa PROPRE copie
 * réelle en base via ce même contenu (voir donnees.master-aa-management.ts,
 * donnees.master-aa-cca.ts, donnees.master-aa-finance.ts). Il n'existe
 * plus de parcours "Tronc Commun" séparé : chaque spécialisation est un
 * parcours complet, autonome, dès la première année.
 */
export const semestresM1PartagesAA = [
  {
    libelle: 'S1', ordre: 1, niveauOrdre: 1, niveauLibelle: 'M1', credits: 30,
    ue: [
      { code: 'UE.01', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
        { code: 'ACCT500', titre: 'Contrôle de Gestion Approfondi', prerequisCode: 'MNGT400', heures: 60 },
      ]},
      { code: 'UE.02', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
        { code: 'FINA500', titre: 'Finance Approfondie des Entreprises', prerequisCode: 'FINA350', heures: 60 },
      ]},
      { code: 'UE.03', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
        { code: 'MNGT500', titre: 'Gestion Stratégique Approfondie des Entreprises', prerequisCode: 'MNGT200', heures: 60 },
      ]},
      { code: 'UE.04', nature: NatureUE.TRANSVERSALE, credits: 12, cours: [
        { code: 'ENGL500', titre: 'Advanced Business English I', prerequisCode: 'ENGL300', heures: 60 },
        { code: 'MMIS500', titre: 'Management des systèmes d\u2019information', prerequisCode: 'MNGT200', heures: 60 },
      ]},
    ],
  },
  {
    libelle: 'S2', ordre: 2, niveauOrdre: 1, niveauLibelle: 'M1', credits: 30,
    ue: [
      { code: 'UE.05', nature: NatureUE.FONDAMENTALE, credits: 12, cours: [
        { code: 'FINA550', titre: 'Gestion de portefeuille avancée', prerequisCode: 'FINA500', heures: 60 },
        { code: 'ACCT570', titre: 'Fiscalité Approfondie', prerequisCode: 'ACCT500', heures: 60 },
      ]},
      { code: 'UE.06', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
        { code: 'FINA580', titre: 'Etats financiers Approfondis', prerequisCode: null, heures: 60 },
      ]},
      { code: 'UE.07', nature: NatureUE.TRANSVERSALE, credits: 6, cours: [
        { code: 'ENGL600', titre: 'Advanced Business English II', prerequisCode: 'ENGL500', heures: 60 },
      ]},
      { code: 'UE.08', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
        { code: 'DROIT550', titre: 'Droit Approfondi des Affaires', prerequisCode: 'DROI350', heures: 60 },
      ]},
    ],
  },
];
