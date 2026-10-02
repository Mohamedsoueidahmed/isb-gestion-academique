-- AlterTable
ALTER TABLE "cours_electifs" ADD COLUMN     "formation_id" TEXT;

-- AddForeignKey
ALTER TABLE "cours_electifs" ADD CONSTRAINT "cours_electifs_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
