// Catalogue électif propre à la License of Arts in Communication and
// Business English — jamais mélangé avec les autres formations.
// SPAN200 renommé en SPAN200B : le code identique est aussi demandé par
// le catalogue de la Licence Sciences Informatiques pour le même cours ;
// la contrainte d'unicité du catalogue porte sur le code seul, pas par
// formation, donc les deux ne peuvent pas partager le même code.
export const donneesElectifsLicenceCommunicationAnglais = [
  { code: 'COMM370', titre: 'Journalism', prerequisCode: 'COMM300', heures: 50, credits: 5 },
  { code: 'COMM420B', titre: 'Leadership Communication', prerequisCode: 'COMM300', heures: 50, credits: 5 },
  { code: 'BUSN330', titre: 'Principles and Theory of Management', prerequisCode: 'BUSN300', heures: 50, credits: 5 },
  { code: 'COMM470', titre: 'Introduction to Research Methodology', prerequisCode: 'COMM410', heures: 50, credits: 5 },
  { code: 'SPAN200B', titre: 'Spanish Listening and Speaking Skills I', prerequisCode: 'SPAN100', heures: 50, credits: 5 },
  { code: 'SPAN210', titre: 'Spanish Reading and Writing I', prerequisCode: 'SPAN101', heures: 50, credits: 5 },
];
