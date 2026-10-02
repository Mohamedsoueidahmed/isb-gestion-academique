/*
  Warnings:

  - You are about to drop the column `semestre_id` on the `classes` table. All the data in the column will be lost.
  - You are about to drop the column `semestre_id` on the `inscriptions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[annee_universitaire_id,parcours_id,niveau_id,nom]` on the table `classes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[etudiant_id,annee_universitaire_id,niveau_id]` on the table `inscriptions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `semestre_actif_id` to the `classes` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "classes" DROP CONSTRAINT "classes_semestre_id_fkey";

-- DropForeignKey
ALTER TABLE "inscriptions" DROP CONSTRAINT "inscriptions_semestre_id_fkey";

-- DropIndex
DROP INDEX "classes_annee_universitaire_id_parcours_id_niveau_id_semest_key";

-- DropIndex
DROP INDEX "inscriptions_etudiant_id_semestre_id_annee_universitaire_id_key";

-- AlterTable
ALTER TABLE "classes" DROP COLUMN "semestre_id",
ADD COLUMN     "semestre_actif_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "inscriptions" DROP COLUMN "semestre_id";

-- CreateIndex
CREATE UNIQUE INDEX "classes_annee_universitaire_id_parcours_id_niveau_id_nom_key" ON "classes"("annee_universitaire_id", "parcours_id", "niveau_id", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "inscriptions_etudiant_id_annee_universitaire_id_niveau_id_key" ON "inscriptions"("etudiant_id", "annee_universitaire_id", "niveau_id");

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_semestre_actif_id_fkey" FOREIGN KEY ("semestre_actif_id") REFERENCES "semestres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
