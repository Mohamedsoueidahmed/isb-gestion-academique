-- Ajouter la colonne, activée par défaut pour tous les parcours existants.
ALTER TABLE "parcours" ADD COLUMN "est_actif" BOOLEAN NOT NULL DEFAULT true;

-- Désactiver spécifiquement "Tronc Commun (Master Informatique)" — une
-- structure abandonnée (les autres parcours du Master Informatique ont
-- chacun leur propre maquette complète), sans aucune inscription
-- dessous au moment de cette migration. Le nom exact est ciblé pour ne
-- toucher aucun autre parcours par erreur.
UPDATE "parcours" SET "est_actif" = false WHERE "nom" = 'Tronc Commun (Master Informatique)';
