import { NatureUE } from '@prisma/client';

export const donneesCCA = {
  codeCourt: 'CCA',
  nom: 'Comptabilité, Contrôle et Audit',
  semestres: [
    {
      libelle: 'S1', ordre: 1, niveauOrdre: 1, niveauLibelle: 'L1', credits: 30,
      ue: [
        { code: 'UE.01', nature: NatureUE.TRANSVERSALE, credits: 10, cours: [
          { code: 'MATH200', titre: 'Algèbre', prerequisCode: 'MATH100', heures: 50 },
          { code: 'CSCI200', titre: "Introduction à l'Informatique", prerequisCode: 'FRAN100', heures: 50 },
        ]},
        { code: 'UE.02', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'ACCT200', titre: 'Comptabilité Financière I', prerequisCode: 'FRAN100', heures: 50 },
        ]},
        { code: 'UE.03', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'MNGT200', titre: 'Introduction à la Gestion des Affaires', prerequisCode: 'FRAN100', heures: 50 },
        ]},
        { code: 'UE.04', nature: NatureUE.TRANSVERSALE, credits: 10, cours: [
          { code: 'ENGL200', titre: 'Listening and Speaking Skills I', prerequisCode: 'ENGL100', heures: 50 },
          { code: 'FRAN200', titre: 'Techniques de communication en Français', prerequisCode: 'FRAN100', heures: 50 },
        ]},
      ],
    },
    {
      libelle: 'S2', ordre: 2, niveauOrdre: 1, niveauLibelle: 'L1', credits: 30,
      ue: [
        { code: 'UE.05', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'ACCT250', titre: 'Comptabilité Financière II', prerequisCode: 'ACCT200', heures: 50 },
        ]},
        { code: 'UE.06', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'ECON250', titre: 'Microéconomie', prerequisCode: 'MNGT200', heures: 50 },
        ]},
        { code: 'UE.07', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'STAT250', titre: 'Statistique Descriptive et Calculs de Probabilité', prerequisCode: 'STAT100', heures: 50 },
          { code: 'MATH250', titre: 'Mathématiques Financières', prerequisCode: null, heures: 50 },
        ]},
        { code: 'UE.08', nature: NatureUE.TRANSVERSALE, credits: 10, cours: [
          { code: 'ENGL250', titre: 'Listening and Speaking Skills II', prerequisCode: 'ENGL200', heures: 50 },
          { code: 'FRAN250', titre: 'Techniques de communication en Français II', prerequisCode: 'FRAN200', heures: 50 },
        ]},
      ],
    },
    {
      libelle: 'S3', ordre: 1, niveauOrdre: 2, niveauLibelle: 'L2', credits: 30,
      ue: [
        { code: 'UE.09', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'ECON300', titre: 'Macroéconomie', prerequisCode: 'ECON250', heures: 50 },
        ]},
        { code: 'UE.10', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'FINA300', titre: 'Analyse Financière', prerequisCode: 'ACCT250', heures: 50 },
        ]},
        { code: 'UE.11', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'MNGT300', titre: 'Gestion des Ressources Humaines', prerequisCode: 'MNGT200', heures: 50 },
          { code: 'MRKT300', titre: 'Principes de Marketing', prerequisCode: null, heures: 50 },
        ]},
        { code: 'UE.12', nature: NatureUE.TRANSVERSALE, credits: 10, cours: [
          { code: 'ENGL300', titre: 'English for Business', prerequisCode: 'ENGL250', heures: 50 },
          { code: 'FRAN300', titre: 'Français des Affaires', prerequisCode: 'FRAN250', heures: 50 },
        ]},
      ],
    },
    {
      libelle: 'S4', ordre: 2, niveauOrdre: 2, niveauLibelle: 'L2', credits: 30,
      ue: [
        { code: 'UE.13', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'ACCT360', titre: 'Contrôle Interne', prerequisCode: 'FINA300', heures: 50 },
          { code: 'ACCT370', titre: 'Audit Financier', prerequisCode: 'ACCT250', heures: 50 },
        ]},
        { code: 'UE.14', nature: NatureUE.TRANSVERSALE, credits: 5, cours: [
          { code: 'DROI350', titre: 'Droit des affaires', prerequisCode: 'FRAN250', heures: 50 },
        ]},
        { code: 'UE.15', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'ACCT380', titre: 'Comptabilité Intermédiaire', prerequisCode: 'ACCT250', heures: 100 },
        ]},
        { code: 'UE.16', nature: NatureUE.OPTIONNELLE, credits: 5, cours: [] }, // Cours électif 1 — à assigner par l'administration
      ],
    },
    {
      libelle: 'S5', ordre: 1, niveauOrdre: 3, niveauLibelle: 'L3', credits: 30,
      ue: [
        { code: 'UE.17', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'ACCT420', titre: 'Fiscalité', prerequisCode: 'ACCT250', heures: 50 },
          { code: 'ACCT470', titre: 'Comptabilité des Sociétés', prerequisCode: null, heures: 50 },
        ]},
        { code: 'UE.18', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'ACCT400', titre: 'Comptabilité Analytique', prerequisCode: 'ACCT250', heures: 50 },
          { code: 'ACCT410', titre: 'États financiers', prerequisCode: null, heures: 50 },
        ]},
        { code: 'UE.19', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'ACCT430', titre: 'Normes et Difficultés Comptables', prerequisCode: 'ACCT250', heures: 50 },
        ]},
        { code: 'UE.20', nature: NatureUE.OPTIONNELLE, credits: 5, cours: [] }, // Cours électif 2 — à assigner par l'administration
      ],
    },
    {
      libelle: 'S6', ordre: 2, niveauOrdre: 3, niveauLibelle: 'L3', credits: 30,
      ue: [
        { code: 'UE.21', nature: NatureUE.TRANSVERSALE, credits: 5, cours: [
          { code: 'MNGT450/FINA410', titre: 'Entrepreneuriat et Business Plan', prerequisCode: 'MNGT300', heures: 50 },
        ]},
        { code: 'UE.22', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'MMIS400', titre: 'Logiciel SAGE', prerequisCode: 'ACCT380', heures: 50 },
          { code: 'ACCT460', titre: 'Contrôle de Gestion', prerequisCode: 'ACCT400', heures: 50 },
        ]},
        { code: 'UE.23', nature: NatureUE.OPTIONNELLE, credits: 5, cours: [] }, // Cours électif 3 — à assigner par l'administration
        { code: 'UE.24', nature: NatureUE.OPTIONNELLE, credits: 10, choixExclusif: true, finDeCycle: true, cours: [
          { code: 'ACCT495', titre: "Stage de Fin d'études", prerequisCode: null, heures: 100 },
          { code: 'ACCT499', titre: "Mémoire de Fin d'études", prerequisCode: null, heures: 100 },
        ]}, // Choix obligatoire entre les deux : chaque étudiant prend Stage OU Mémoire
      ],
    },
  ],
};
