-- CreateEnum
CREATE TYPE "CycleFormation" AS ENUM ('LICENCE', 'MASTER');

-- CreateEnum
CREATE TYPE "TypeComposante" AS ENUM ('DEVOIR_1', 'DEVOIR_2', 'EXPOSE', 'EXAMEN_SESSION_1', 'EXAMEN_SESSION_2', 'DEVOIR');

-- CreateEnum
CREATE TYPE "StatutValidationMatiere" AS ENUM ('VALIDEE', 'NON_VALIDEE', 'EN_ATTENTE_SESSION_2');

-- AlterTable
ALTER TABLE "formations" ADD COLUMN     "cycle" "CycleFormation";

-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "statut_validation" "StatutValidationMatiere";

-- CreateTable
CREATE TABLE "evaluations_composantes" (
    "id" TEXT NOT NULL,
    "inscription_id" TEXT NOT NULL,
    "cours_id" TEXT NOT NULL,
    "type" "TypeComposante" NOT NULL,
    "valeur" DECIMAL(4,2),
    "date_saisie" TIMESTAMP(3),
    "derniere_modification" TIMESTAMP(3),
    "saisie_par_id" TEXT,

    CONSTRAINT "evaluations_composantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations_composantes_historique" (
    "id" TEXT NOT NULL,
    "evaluation_composante_id" TEXT NOT NULL,
    "ancienne_valeur" DECIMAL(4,2),
    "modifie_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_par_id" TEXT,

    CONSTRAINT "evaluations_composantes_historique_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_composantes_inscription_id_cours_id_type_key" ON "evaluations_composantes"("inscription_id", "cours_id", "type");

-- AddForeignKey
ALTER TABLE "evaluations_composantes" ADD CONSTRAINT "evaluations_composantes_inscription_id_fkey" FOREIGN KEY ("inscription_id") REFERENCES "inscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_composantes" ADD CONSTRAINT "evaluations_composantes_cours_id_fkey" FOREIGN KEY ("cours_id") REFERENCES "cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_composantes" ADD CONSTRAINT "evaluations_composantes_saisie_par_id_fkey" FOREIGN KEY ("saisie_par_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations_composantes_historique" ADD CONSTRAINT "evaluations_composantes_historique_evaluation_composante_i_fkey" FOREIGN KEY ("evaluation_composante_id") REFERENCES "evaluations_composantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
