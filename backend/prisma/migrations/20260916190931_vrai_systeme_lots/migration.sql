/*
  Warnings:

  - You are about to drop the `ouvertures_lot_niveau` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "StatutLot" AS ENUM ('OUVERT', 'FERME');

-- DropForeignKey
ALTER TABLE "ouvertures_lot_niveau" DROP CONSTRAINT "ouvertures_lot_niveau_niveau_id_fkey";

-- AlterTable
ALTER TABLE "affectations_cours" ADD COLUMN     "lot_id" TEXT;

-- DropTable
DROP TABLE "ouvertures_lot_niveau";

-- CreateTable
CREATE TABLE "lots" (
    "id" TEXT NOT NULL,
    "niveau_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "statut" "StatutLot" NOT NULL DEFAULT 'OUVERT',
    "date_ouverture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_fermeture" TIMESTAMP(3),

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_cours" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "cours_id" TEXT NOT NULL,

    CONSTRAINT "lot_cours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lot_cours_lot_id_cours_id_key" ON "lot_cours"("lot_id", "cours_id");

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_niveau_id_fkey" FOREIGN KEY ("niveau_id") REFERENCES "niveaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_cours" ADD CONSTRAINT "lot_cours_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_cours" ADD CONSTRAINT "lot_cours_cours_id_fkey" FOREIGN KEY ("cours_id") REFERENCES "cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_cours" ADD CONSTRAINT "affectations_cours_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
