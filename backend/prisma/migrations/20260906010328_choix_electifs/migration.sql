-- CreateTable
CREATE TABLE "choix_electifs" (
    "id" TEXT NOT NULL,
    "inscription_id" TEXT NOT NULL,
    "ue_id" TEXT NOT NULL,
    "cours_id" TEXT NOT NULL,

    CONSTRAINT "choix_electifs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "choix_electifs_inscription_id_ue_id_key" ON "choix_electifs"("inscription_id", "ue_id");

-- AddForeignKey
ALTER TABLE "choix_electifs" ADD CONSTRAINT "choix_electifs_inscription_id_fkey" FOREIGN KEY ("inscription_id") REFERENCES "inscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_electifs" ADD CONSTRAINT "choix_electifs_ue_id_fkey" FOREIGN KEY ("ue_id") REFERENCES "ue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "choix_electifs" ADD CONSTRAINT "choix_electifs_cours_id_fkey" FOREIGN KEY ("cours_id") REFERENCES "cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
