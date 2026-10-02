-- AlterTable
ALTER TABLE "affectations_cours" ADD COLUMN     "dispense" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "universite_origine" TEXT,
ALTER COLUMN "numero_lot" DROP NOT NULL;
