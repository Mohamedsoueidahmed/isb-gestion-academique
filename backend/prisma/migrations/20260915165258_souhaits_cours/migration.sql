-- CreateTable
CREATE TABLE "souhaits_cours" (
    "id" TEXT NOT NULL,
    "inscription_id" TEXT NOT NULL,
    "cours_id" TEXT NOT NULL,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "souhaits_cours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "souhaits_cours_inscription_id_cours_id_key" ON "souhaits_cours"("inscription_id", "cours_id");

-- AddForeignKey
ALTER TABLE "souhaits_cours" ADD CONSTRAINT "souhaits_cours_inscription_id_fkey" FOREIGN KEY ("inscription_id") REFERENCES "inscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "souhaits_cours" ADD CONSTRAINT "souhaits_cours_cours_id_fkey" FOREIGN KEY ("cours_id") REFERENCES "cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
