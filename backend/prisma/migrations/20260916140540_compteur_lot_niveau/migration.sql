-- CreateTable
CREATE TABLE "ouvertures_lot_niveau" (
    "id" TEXT NOT NULL,
    "niveau_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "date_confirmation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ouvertures_lot_niveau_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ouvertures_lot_niveau" ADD CONSTRAINT "ouvertures_lot_niveau_niveau_id_fkey" FOREIGN KEY ("niveau_id") REFERENCES "niveaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
