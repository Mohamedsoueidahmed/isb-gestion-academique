import { NatureUE } from '@prisma/client';

/**
 * Master Administration des Affaires, tronc commun (M1) — S1+S2, communs
 * aux trois options avant que l'étudiant ne choisisse sa spécialisation en
 * M2 (Management Appliqué, Comptabilité/Contrôle/Audit, ou Finance et
 * Banques). Un seul parcours, une seule classe créée par année, plutôt
 * que le même contenu dupliqué en trois classes identiques.
 */
export const donneesMasterAATroncCommun = {
  codeCourt: 'TCAA',
  nom: 'Tronc Commun (Master Administration des Affaires)',
  semestres: [
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
  ],
};
