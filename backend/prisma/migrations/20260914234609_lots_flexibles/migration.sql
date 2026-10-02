-- CreateTable
CREATE TABLE "affectations_cours" (
    "id" TEXT NOT NULL,
    "inscription_id" TEXT NOT NULL,
    "cours_id" TEXT NOT NULL,
    "numero_lot" INTEGER NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affectations_cours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deblocages_prerequis" (
    "id" TEXT NOT NULL,
    "inscription_id" TEXT NOT NULL,
    "cours_id" TEXT NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deblocages_prerequis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affectations_cours_inscription_id_cours_id_key" ON "affectations_cours"("inscription_id", "cours_id");

-- CreateIndex
CREATE UNIQUE INDEX "deblocages_prerequis_inscription_id_cours_id_key" ON "deblocages_prerequis"("inscription_id", "cours_id");

-- AddForeignKey
ALTER TABLE "affectations_cours" ADD CONSTRAINT "affectations_cours_inscription_id_fkey" FOREIGN KEY ("inscription_id") REFERENCES "inscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_cours" ADD CONSTRAINT "affectations_cours_cours_id_fkey" FOREIGN KEY ("cours_id") REFERENCES "cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deblocages_prerequis" ADD CONSTRAINT "deblocages_prerequis_inscription_id_fkey" FOREIGN KEY ("inscription_id") REFERENCES "inscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deblocages_prerequis" ADD CONSTRAINT "deblocages_prerequis_cours_id_fkey" FOREIGN KEY ("cours_id") REFERENCES "cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
