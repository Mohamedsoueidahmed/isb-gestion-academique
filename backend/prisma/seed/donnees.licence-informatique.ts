import { NatureUE } from '@prisma/client';

/**
 * Licence Sciences Informatiques — un seul parcours, sur trois niveaux.
 *
 * UE.20 (S5) scindée en UE.20 + UE.20B (5 crédits chacune) : le document
 * demande de choisir DEUX électifs à ce stade précis (100h/10 crédits au
 * total), et notre système de choix électif ne gère qu'un seul choix par
 * créneau — deux créneaux distincts reproduisent fidèlement l'intention
 * sans toucher au mécanisme déjà vérifié.
 *
 * UE.24 : le document écrit "Mémoire ou Projet de Fin d'études" — confirmé
 * comme une erreur du document ; il s'agit bien de Stage/Mémoire, comme
 * dans les trois parcours de la Licence Administration des Affaires.
 */
export const donneesLicenceInformatique = {
  codeCourt: 'INFO',
  nom: 'Sciences Informatiques',
  semestres: [
    {
      libelle: 'S1', ordre: 1, niveauOrdre: 1, niveauLibelle: 'L1', credits: 30,
      ue: [
        { code: 'UE.01', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'MATH200', titre: 'Analyse III', prerequisCode: 'FRAN100', heures: 50 },
          { code: 'MATH220', titre: 'Algèbre Linéaire & applications', prerequisCode: 'FRAN100', heures: 50 },
        ]},
        { code: 'UE.02', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'CSCI200', titre: 'Initiation à l\u2019Informatique', prerequisCode: 'FRAN100', heures: 50 },
        ]},
        { code: 'UE.03', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'CSCI210', titre: 'Microprocesseurs et Architecture des Ordinateurs', prerequisCode: 'FRAN100', heures: 50 },
        ]},
        { code: 'UE.04', nature: NatureUE.TRANSVERSALE, credits: 10, cours: [
          { code: 'ENGL200', titre: 'English Listening and Speaking Skills', prerequisCode: 'ENGL100', heures: 50 },
          { code: 'FRAN200', titre: 'Techniques de communication en Français', prerequisCode: 'FRAN100', heures: 50 },
        ]},
      ],
    },
    {
      libelle: 'S2', ordre: 2, niveauOrdre: 1, niveauLibelle: 'L1', credits: 30,
      ue: [
        { code: 'UE.05', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'MATH270', titre: 'Méthodes Numériques', prerequisCode: 'MATH200', heures: 50 },
          { code: 'MATH250', titre: 'Mathématiques Discrètes', prerequisCode: 'MATH200', heures: 50 },
        ]},
        { code: 'UE.06', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'CSCI250', titre: 'Introduction à l\u2019Algorithmique et à la Programmation', prerequisCode: 'CSCI200', heures: 50 },
        ]},
        { code: 'UE.07', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'CSCI270', titre: 'Introduction aux Systèmes d\u2019Exploitation', prerequisCode: 'CSCI200', heures: 50 },
        ]},
        { code: 'UE.08', nature: NatureUE.TRANSVERSALE, credits: 10, cours: [
          { code: 'ENGL250', titre: 'Intermediate English Listening and Speaking Skills', prerequisCode: 'ENGL200', heures: 50 },
          { code: 'FRAN250', titre: 'Techniques de communication en Français II', prerequisCode: 'FRAN200', heures: 50 },
        ]},
      ],
    },
    {
      libelle: 'S3', ordre: 1, niveauOrdre: 2, niveauLibelle: 'L2', credits: 30,
      ue: [
        { code: 'UE.09', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'CSCI300', titre: 'Programmation Intermédiaire avec manipulation d\u2019Objets', prerequisCode: 'CSCI250', heures: 50 },
        ]},
        { code: 'UE.10', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'CSCI310', titre: 'Algorithmes et Structures des Données', prerequisCode: 'CSCI250', heures: 50 },
          { code: 'CSCI330', titre: 'Introduction aux Systèmes de Bases de Données', prerequisCode: null, heures: 50 },
        ]},
        { code: 'UE.11', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'CSCI340', titre: 'Développement et Implémentation des Systèmes d\u2019Information', prerequisCode: 'CSCI250', heures: 50 },
        ]},
        { code: 'UE.12', nature: NatureUE.TRANSVERSALE, credits: 10, cours: [
          { code: 'ENGL300', titre: 'English for Business', prerequisCode: 'ENGL250', heures: 50 },
          { code: 'FRAN300', titre: 'Français des Affaires', prerequisCode: null, heures: 50 },
        ]},
      ],
    },
    {
      libelle: 'S4', ordre: 2, niveauOrdre: 2, niveauLibelle: 'L2', credits: 30,
      ue: [
        { code: 'UE.13', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'CSCI350', titre: 'Applications technologiques de Bases de Données', prerequisCode: 'CSCI300', heures: 50 },
          { code: 'CSCI360', titre: 'Programmation Orientée Objet Avancée I', prerequisCode: null, heures: 50 },
        ]},
        { code: 'UE.14', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'CSCI370', titre: 'Introduction aux Réseaux Informatiques', prerequisCode: 'CSCI310', heures: 50 },
        ]},
        { code: 'UE.15', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'CSCI380', titre: 'Introduction à l\u2019Intelligence Artificielle', prerequisCode: 'CSCI310', heures: 50 },
          { code: 'CSCI390', titre: 'Introduction à la Cryptographie et Sécurité des Données', prerequisCode: null, heures: 50 },
        ]},
        { code: 'UE.16', nature: NatureUE.OPTIONNELLE, credits: 5, cours: [] }, // Créneau électif, catalogue Licence Informatique
      ],
    },
    {
      libelle: 'S5', ordre: 1, niveauOrdre: 3, niveauLibelle: 'L3', credits: 30,
      ue: [
        { code: 'UE.17', nature: NatureUE.FONDAMENTALE, credits: 10, cours: [
          { code: 'CSCI400', titre: 'Programmation Orientée Objet Avancée II', prerequisCode: 'CSCI350', heures: 50 },
          { code: 'CSCI410', titre: 'Programmation du Réseau Web', prerequisCode: null, heures: 50 },
        ]},
        { code: 'UE.18', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'CSCI430', titre: 'Génie des Logiciels', prerequisCode: 'CSCI350', heures: 50 },
        ]},
        { code: 'UE.19', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'CSCI440', titre: 'Administration des Réseaux', prerequisCode: 'CSCI360', heures: 50 },
        ]},
        { code: 'UE.20', nature: NatureUE.OPTIONNELLE, credits: 5, cours: [] }, // Créneau électif 1, catalogue Licence Informatique
        { code: 'UE.20B', nature: NatureUE.OPTIONNELLE, credits: 5, cours: [] }, // Créneau électif 2 — deux choix distincts à ce stade, pas un seul
      ],
    },
    {
      libelle: 'S6', ordre: 2, niveauOrdre: 3, niveauLibelle: 'L3', credits: 30,
      ue: [
        { code: 'UE.21', nature: NatureUE.TRANSVERSALE, credits: 10, cours: [
          { code: 'MRKT300', titre: 'Principes Marketing', prerequisCode: 'FRAN250', heures: 50 },
          { code: 'MNGT470', titre: 'Entrepreneuriat', prerequisCode: null, heures: 50 },
        ]},
        { code: 'UE.22', nature: NatureUE.FONDAMENTALE, credits: 5, cours: [
          { code: 'CSCI460', titre: 'Sécurité des Réseaux', prerequisCode: 'CSCI440', heures: 50 },
        ]},
        { code: 'UE.23', nature: NatureUE.OPTIONNELLE, credits: 5, cours: [] }, // Créneau électif, catalogue Licence Informatique
        { code: 'UE.24', nature: NatureUE.OPTIONNELLE, credits: 10, choixExclusif: true, finDeCycle: true, cours: [
          { code: 'CSCI495', titre: 'Stage de Fin d\u2019études', prerequisCode: null, heures: 300 },
          { code: 'CSCI499', titre: 'Mémoire de Fin d\u2019études', prerequisCode: null, heures: 300 },
        ]},
      ],
    },
  ],
};
