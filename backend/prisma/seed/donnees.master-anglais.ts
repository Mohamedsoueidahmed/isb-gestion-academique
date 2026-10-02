import { NatureUE } from '@prisma/client';

/**
 * Master Anglais, parcours Communication, Business and Leadership — un
 * seul parcours pour cette formation.
 *
 * UE.04 du document original mélangeait un choix (Arabe OU Français) et un
 * cours obligatoire séparé (Anglais) dans une seule UE — notre schéma ne
 * permet pas qu'une UE soit à la fois "choix" et "obligatoire". Scindée
 * ici en UE.04 (choix électif Arabe/Français, 6 crédits) et UE.04B
 * (Anglais, obligatoire, 6 crédits) — total 12, identique au document.
 */
export const donneesMasterAnglais = {
  codeCourt: 'ANGL',
  nom: 'Communication, Business and Leadership',
  semestres: [
    {
      libelle: 'S1', ordre: 1, niveauOrdre: 1, niveauLibelle: 'M1', credits: 30,
      ue: [
        { code: 'UE.01', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'COMM500', titre: 'Theory and Practice of Communication', prerequisCode: 'COMM300', heures: 60 },
        ]},
        { code: 'UE.02', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'BUSN500', titre: 'Advanced Strategic Management', prerequisCode: 'BUSN200', heures: 60 },
        ]},
        { code: 'UE.03', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'BUSN520', titre: 'Strategic of Marketing Communication', prerequisCode: 'BUSN310', heures: 60 },
        ]},
        { code: 'UE.04', nature: NatureUE.OPTIONNELLE, credits: 6, choixExclusif: true, cours: [
          { code: 'ARAB500', titre: 'Advanced administrative Communication in Arabic I', prerequisCode: 'ARAB300', heures: 60 },
          { code: 'FREN500', titre: 'Advanced administrative Communication in French I', prerequisCode: 'FREN300', heures: 60 },
        ]}, // Choix obligatoire entre les deux : chaque étudiant prend Arabe OU Français
        { code: 'UE.04B', nature: NatureUE.TRANSVERSALE, credits: 6, cours: [
          { code: 'ENGL500', titre: 'Advanced Business English I', prerequisCode: 'ENGL350', heures: 60 },
        ]},
      ],
    },
    {
      libelle: 'S2', ordre: 2, niveauOrdre: 1, niveauLibelle: 'M1', credits: 30,
      ue: [
        { code: 'UE.05', nature: NatureUE.FONDAMENTALE, credits: 12, cours: [
          { code: 'COMM550', titre: 'Organizational Communication', prerequisCode: 'MCOM500', heures: 60 },
          { code: 'COMM560', titre: 'Research Methodology', prerequisCode: null, heures: 60 },
        ]},
        { code: 'UE.06', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'BUSN570', titre: 'Consumer Behavior', prerequisCode: 'BUSN520', heures: 60 },
        ]},
        { code: 'UE.07', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'COMM580', titre: 'Leadership Communication', prerequisCode: 'COMM500', heures: 60 },
        ]},
        { code: 'UE.08', nature: NatureUE.OPTIONNELLE, credits: 6, cours: [] }, // Créneau électif — catalogue Master Anglais
      ],
    },
    {
      libelle: 'S3', ordre: 1, niveauOrdre: 2, niveauLibelle: 'M2', credits: 30,
      ue: [
        { code: 'UE.09', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
          { code: 'ENGL600', titre: 'Advanced Business English II', prerequisCode: 'COMM500', heures: 60 },
        ]},
        { code: 'UE.10', nature: NatureUE.FONDAMENTALE, credits: 12, cours: [
          { code: 'BUSN600', titre: 'Strategic Human Resource Management', prerequisCode: 'BUSN500', heures: 60 },
          { code: 'COMM600', titre: 'Media Technology and Public Relations', prerequisCode: null, heures: 60 },
        ]},
        { code: 'UE.11', nature: NatureUE.OPTIONNELLE, credits: 6, choixExclusif: true, cours: [
          { code: 'ARAB600', titre: 'Advanced administrative Communication in Arabic II', prerequisCode: 'ARAB500', heures: 60 },
          { code: 'FREN600', titre: 'Advanced administrative Communication in French II', prerequisCode: 'FREN500', heures: 60 },
        ]}, // Choix obligatoire entre les deux, suite de UE.04
        { code: 'UE.12', nature: NatureUE.OPTIONNELLE, credits: 6, cours: [] }, // Créneau électif — catalogue Master Anglais
      ],
    },
    {
      libelle: 'S4', ordre: 2, niveauOrdre: 2, niveauLibelle: 'M2', credits: 30,
      ue: [
        { code: 'UE.13', nature: NatureUE.FONDAMENTALE, credits: 30, finDeCycle: true, cours: [
          { code: 'COMM697', titre: 'Stage de fin d\u2019études', prerequisCode: null, heures: 300 },
        ]},
      ],
    },
  ],
};
