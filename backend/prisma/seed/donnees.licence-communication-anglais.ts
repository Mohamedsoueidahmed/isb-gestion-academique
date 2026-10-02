import { NatureUE } from '@prisma/client';

/**
 * License of Arts in Communication and Business English — un seul
 * parcours, sur trois niveaux.
 *
 * UE.02 et UE.06 : Arabe et Français sont TOUS LES DEUX obligatoires ici
 * (deux cours différents, pas un choix) — confirmé, contrairement au
 * Master Anglais où la même disposition visuelle représentait un choix.
 *
 * ENGL350 est renommé en ENGL350B pour son occurrence en S4
 * ("Communication Skills in Tourism") : le document réutilise le même
 * code pour un cours différent de celui de S3 ("Business English") — une
 * vraie collision du document, pas une invention de notre part.
 *
 * UE.24 : choix confirmé entre les deux rapports (Training Report /
 * Thesis Report), même mécanisme que Stage/Mémoire ailleurs.
 */
export const donneesLicenceCommunicationAnglais = {
  codeCourt: 'CBE',
  nom: 'Communication and Business English',
  semestres: [
    {
      libelle: 'S1', ordre: 1, niveauOrdre: 1, niveauLibelle: 'L1', credits: 30,
      ue: [
        { code: 'UE.01', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'ENGL200', titre: 'English Listening and Speaking Skills I', prerequisCode: 'ENGL100', heures: 50 },
          { code: 'ENGL210', titre: 'English Reading and Writing I', prerequisCode: null, heures: 50 },
        ]},
        { code: 'UE.02', nature: NatureUE.TRANSVERSALE, credits: 10, cours: [
          { code: 'ARAB200', titre: 'Arabic Writing and Speaking Skills I', prerequisCode: 'ARAB100', heures: 50 },
          { code: 'FREN200', titre: 'French Writing and Speaking Skills I', prerequisCode: 'FRAN100', heures: 50 },
        ]},
        { code: 'UE.03', nature: NatureUE.TRANSVERSALE, credits: 5, cours: [
          { code: 'CSCI200', titre: 'Introduction to Computer Sciences', prerequisCode: 'FRAN100', heures: 50 },
        ]},
        { code: 'UE.04', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'ENGL220', titre: 'Grammar and Vocabulary I', prerequisCode: 'ENGL100', heures: 50 },
        ]},
      ],
    },
    {
      libelle: 'S2', ordre: 2, niveauOrdre: 1, niveauLibelle: 'L1', credits: 30,
      ue: [
        { code: 'UE.05', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'ENGL250', titre: 'English Listening and Speaking Skills II', prerequisCode: 'ENGL200', heures: 50 },
          { code: 'ENGL260', titre: 'English Reading and Writing II', prerequisCode: 'ENGL210', heures: 50 },
        ]},
        { code: 'UE.06', nature: NatureUE.TRANSVERSALE, credits: 10, cours: [
          { code: 'ARAB250', titre: 'Arabic Listening and Speaking Skills II', prerequisCode: 'ARAB200', heures: 50 },
          { code: 'FREN250', titre: 'French Listening and Speaking Skills II', prerequisCode: 'FREN200', heures: 50 },
        ]},
        { code: 'UE.07', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'ENGL270', titre: 'Grammar and Vocabulary II', prerequisCode: 'ENGL220', heures: 50 },
        ]},
        { code: 'UE.08', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'COMM250', titre: 'Communication Theory', prerequisCode: 'ENGL200', heures: 50 },
        ]},
      ],
    },
    {
      libelle: 'S3', ordre: 1, niveauOrdre: 2, niveauLibelle: 'L2', credits: 30,
      ue: [
        { code: 'UE.09', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'ENGL350', titre: 'Business English', prerequisCode: 'ENGL250', heures: 50 },
          { code: 'FREN300', titre: 'Business French', prerequisCode: 'FREN250', heures: 50 },
        ]},
        { code: 'UE.10', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'ENGL300', titre: 'English Listening and Speaking Skills III', prerequisCode: 'ENGL250', heures: 50 },
          { code: 'ENGL310', titre: 'Composition I', prerequisCode: null, heures: 50 },
        ]},
        { code: 'UE.11', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'COMM300', titre: 'Interpersonal Communications', prerequisCode: 'COMM250', heures: 50 },
        ]},
        { code: 'UE.12', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'BUSN200', titre: 'Basics of Business', prerequisCode: 'ENGL250', heures: 50 },
        ]},
      ],
    },
    {
      libelle: 'S4', ordre: 2, niveauOrdre: 2, niveauLibelle: 'L2', credits: 30,
      ue: [
        { code: 'UE.13', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'ENGL350B', titre: 'Communication Skills in Tourism', prerequisCode: 'MNGT210', heures: 50 },
          { code: 'BUSN310', titre: 'Marketing', prerequisCode: null, heures: 50 },
        ]},
        { code: 'UE.14', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'BUSN300', titre: 'Foundations of Entrepreneurship', prerequisCode: 'ENGL310', heures: 50 },
        ]},
        { code: 'UE.15', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'COMM360', titre: 'Strategic Communication', prerequisCode: 'COMM300', heures: 50 },
          { code: 'COMM380', titre: 'Mass Media Communication', prerequisCode: 'COMM300', heures: 50 },
        ]},
        { code: 'UE.16', nature: NatureUE.OPTIONNELLE, credits: 5, cours: [] }, // Créneau électif, catalogue Communication and Business English
      ],
    },
    {
      libelle: 'S5', ordre: 1, niveauOrdre: 3, niveauLibelle: 'L3', credits: 30,
      ue: [
        { code: 'UE.17', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'BUSN400', titre: 'Business Customer Service', prerequisCode: 'COMM360', heures: 50 },
          { code: 'BUSN410', titre: 'Human Resources Management', prerequisCode: 'BUSN300', heures: 50 },
        ]},
        { code: 'UE.18', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'COMM410', titre: 'Communication of Listening', prerequisCode: 'COMM360', heures: 50 },
          { code: 'COMM405', titre: 'Conflict and Communication', prerequisCode: null, heures: 50 },
        ]},
        { code: 'UE.19', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'COMM420', titre: 'Advertising and Public Relations', prerequisCode: 'COMM360', heures: 50 },
        ]},
        { code: 'UE.20', nature: NatureUE.OPTIONNELLE, credits: 5, cours: [] }, // Créneau électif, catalogue Communication and Business English
      ],
    },
    {
      libelle: 'S6', ordre: 2, niveauOrdre: 3, niveauLibelle: 'L3', credits: 30,
      ue: [
        { code: 'UE.21', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'COMM460', titre: 'Visual Communication', prerequisCode: 'COMM420', heures: 50 },
        ]},
        { code: 'UE.22', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'COMM450', titre: 'Persuasive Communication', prerequisCode: 'COMM410', heures: 50 },
          { code: 'BUSN450', titre: 'Entrepreneurs as Leaders', prerequisCode: null, heures: 50 },
        ]},
        { code: 'UE.23', nature: NatureUE.OPTIONNELLE, credits: 5, cours: [] }, // Créneau électif, catalogue Communication and Business English
        { code: 'UE.24', nature: NatureUE.OPTIONNELLE, credits: 10, choixExclusif: true, finDeCycle: true, cours: [
          { code: 'COMM495', titre: 'Communication Training Report', prerequisCode: null, heures: 300 },
          { code: 'COMM499', titre: 'Communication Thesis Report', prerequisCode: null, heures: 300 },
        ]},
      ],
    },
  ],
};
