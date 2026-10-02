-- AlterTable
ALTER TABLE "etudiants" ADD COLUMN     "date_naissance" TIMESTAMP(3),
ADD COLUMN     "inn" TEXT,
ADD COLUMN     "numero_bac" TEXT,
ADD COLUMN     "type_bac" TEXT;
