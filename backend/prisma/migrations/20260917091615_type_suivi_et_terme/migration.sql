-- CreateEnum
CREATE TYPE "TypeSuivi" AS ENUM ('NORMAL', 'ANTICIPE', 'EN_RETARD');

-- CreateEnum
CREATE TYPE "Terme" AS ENUM ('AUTOMNE', 'PRINTEMPS', 'ETE');

-- AlterTable
ALTER TABLE "affectations_cours" ADD COLUMN     "terme" "Terme",
ADD COLUMN     "type_suivi" "TypeSuivi" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "lots" ADD COLUMN     "terme" "Terme";
