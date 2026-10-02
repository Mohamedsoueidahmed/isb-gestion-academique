import { NatureUE } from '@prisma/client';

/**
 * Semestres M1 (S1+S2) partagés entre les deux spécialisations du Master
 * Informatique (CDSI, IA) — une seule source à maintenir, mais chaque
 * spécialisation crée sa PROPRE copie réelle en base via ce même contenu
 * (voir donnees.master-info-cdsi.ts et donnees.master-info-ia.ts). Il
 * n'existe plus de parcours "Tronc Commun" séparé : chaque spécialisation
 * est un parcours complet, autonome, dès la première année.
 */
export const semestresM1PartagesInfo = [
  {
    libelle: 'S1', ordre: 1, niveauOrdre: 1, niveauLibelle: 'M1', credits: 30,
    ue: [
      { code: 'UE.01', nature: NatureUE.FONDAMENTALE, credits: 12, cours: [
        { code: 'MCSC500', titre: 'Algorithme et structure avancé de données', prerequisCode: 'CSCI350', heures: 60 },
        { code: 'MCSC510', titre: 'Administration et Sécurité des Réseaux', prerequisCode: 'CSCI350', heures: 60 },
      ]},
      { code: 'UE.02', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
        { code: 'MCSC520', titre: 'Programmation Approfondie en Python', prerequisCode: 'CSCI360', heures: 60 },
      ]},
      { code: 'UE.03', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
        { code: 'MCSC530', titre: 'Intelligence artificielle et recherche opérationnelle', prerequisCode: 'CSCI350', heures: 60 },
      ]},
      { code: 'UE.04', nature: NatureUE.TRANSVERSALE, credits: 6, cours: [
        { code: 'MNGT510', titre: 'Principes et Gestion Stratégique des Entreprise', prerequisCode: 'MNGT200', heures: 60 },
      ]},
    ],
  },
  {
    libelle: 'S2', ordre: 2, niveauOrdre: 1, niveauLibelle: 'M1', credits: 30,
    ue: [
      { code: 'UE.05', nature: NatureUE.FONDAMENTALE, credits: 12, cours: [
        { code: 'MCSC560', titre: 'Datamining et Big Data', prerequisCode: 'MCSC510', heures: 60 },
        { code: 'MCSC570', titre: 'J2EE, Cloud Computing et Architecture des Microservices', prerequisCode: 'MCSC510', heures: 60 },
      ]},
      { code: 'UE.06', nature: NatureUE.FONDAMENTALE, credits: 6, cours: [
        { code: 'MCSC580', titre: 'Base de Données NoSQL', prerequisCode: 'MCSC540', heures: 60 },
      ]},
      { code: 'UE.07', nature: NatureUE.TRANSVERSALE, credits: 6, cours: [
        { code: 'ENGL500', titre: 'English for Business Communication', prerequisCode: 'ENGL200', heures: 60 },
      ]},
      { code: 'UE.08', nature: NatureUE.OPTIONNELLE, credits: 6, cours: [] }, // Créneau électif, catalogue Master Informatique
    ],
  },
];
