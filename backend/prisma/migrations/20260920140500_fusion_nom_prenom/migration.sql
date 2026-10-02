-- Fusionner prénom et nom en un seul champ (prénom d'abord, puis nom),
-- AVANT de supprimer la colonne prenom — pour ne perdre aucune donnée
-- existante. Ex. Nom="Mouhamadou", Prénom="bady" devient "bady Mouhamadou".
UPDATE "etudiants" SET "nom" = "prenom" || ' ' || "nom";

-- AlterTable
ALTER TABLE "etudiants" DROP COLUMN "prenom";
