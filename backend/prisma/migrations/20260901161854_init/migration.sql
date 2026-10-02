-- CreateEnum
CREATE TYPE "LibelleRole" AS ENUM ('ADMINISTRATEUR', 'RESPONSABLE_ACADEMIQUE');

-- CreateEnum
CREATE TYPE "NatureUE" AS ENUM ('FONDAMENTALE', 'TRANSVERSALE', 'OPTIONNELLE');

-- CreateEnum
CREATE TYPE "StatutEtudiant" AS ENUM ('ACTIF', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "StatutInscription" AS ENUM ('ACTIVE', 'CLOTUREE');

-- CreateEnum
CREATE TYPE "TypeActionAudit" AS ENUM ('CREATION_ETUDIANT', 'SUPPRESSION_ETUDIANT', 'MODIFICATION_CLASSE', 'CHANGEMENT_AFFECTATION_ENSEIGNANT', 'VERROUILLAGE_SAISIE', 'DEVERROUILLAGE_SAISIE');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "libelle" "LibelleRole" NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mot_de_passe_hash" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "est_actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universite" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "nom_court" TEXT,
    "logo_url" TEXT,
    "couleurs_json" JSONB,
    "contact_json" JSONB,

    CONSTRAINT "universite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annees_universitaires" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3) NOT NULL,
    "est_active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "annees_universitaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formations" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "nombre_niveaux" INTEGER NOT NULL,
    "credits_total" INTEGER NOT NULL,
    "heures_total" INTEGER NOT NULL,
    "est_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "formations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcours" (
    "id" TEXT NOT NULL,
    "formation_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "code_court" TEXT NOT NULL,

    CONSTRAINT "parcours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "niveaux" (
    "id" TEXT NOT NULL,
    "parcours_id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,

    CONSTRAINT "niveaux_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semestres" (
    "id" TEXT NOT NULL,
    "niveau_id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "semestres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ue" (
    "id" TEXT NOT NULL,
    "semestre_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nature" "NatureUE" NOT NULL,
    "credits" INTEGER NOT NULL,

    CONSTRAINT "ue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cours" (
    "id" TEXT NOT NULL,
    "ue_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "prerequis_code" TEXT,
    "heures" INTEGER,
    "est_electif" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cours_electifs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "prerequis_code" TEXT,
    "heures" INTEGER,
    "credits" INTEGER,

    CONSTRAINT "cours_electifs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "annee_universitaire_id" TEXT NOT NULL,
    "parcours_id" TEXT NOT NULL,
    "niveau_id" TEXT NOT NULL,
    "semestre_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "effectif_max" INTEGER,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etudiants" (
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "statut" "StatutEtudiant" NOT NULL DEFAULT 'ACTIF',
    "cree_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "etudiants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscriptions" (
    "id" TEXT NOT NULL,
    "etudiant_id" TEXT NOT NULL,
    "annee_universitaire_id" TEXT NOT NULL,
    "parcours_id" TEXT NOT NULL,
    "niveau_id" TEXT NOT NULL,
    "semestre_id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "date_inscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut_inscription" "StatutInscription" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "inscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "inscription_id" TEXT NOT NULL,
    "cours_id" TEXT NOT NULL,
    "valeur" DECIMAL(4,2),
    "date_saisie" TIMESTAMP(3),
    "derniere_modification" TIMESTAMP(3),
    "saisie_par_id" TEXT,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes_historique" (
    "id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "ancienne_valeur" DECIMAL(4,2),
    "modifie_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_par_id" TEXT,

    CONSTRAINT "notes_historique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absences" (
    "id" TEXT NOT NULL,
    "inscription_id" TEXT NOT NULL,
    "cours_id" TEXT NOT NULL,
    "date_seance" TIMESTAMP(3) NOT NULL,
    "est_absent" BOOLEAN NOT NULL DEFAULT false,
    "saisie_par_id" TEXT,

    CONSTRAINT "absences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enseignants" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,

    CONSTRAINT "enseignants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affectations_enseignant" (
    "id" TEXT NOT NULL,
    "enseignant_id" TEXT NOT NULL,
    "cours_id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "annee_universitaire_id" TEXT NOT NULL,

    CONSTRAINT "affectations_enseignant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_audit" (
    "id" TEXT NOT NULL,
    "type_action" "TypeActionAudit" NOT NULL,
    "utilisateur_id" TEXT,
    "details" JSONB,
    "date_action" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_libelle_key" ON "roles"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "annees_universitaires_libelle_key" ON "annees_universitaires"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "parcours_formation_id_code_court_key" ON "parcours"("formation_id", "code_court");

-- CreateIndex
CREATE UNIQUE INDEX "niveaux_parcours_id_libelle_key" ON "niveaux"("parcours_id", "libelle");

-- CreateIndex
CREATE UNIQUE INDEX "semestres_niveau_id_libelle_key" ON "semestres"("niveau_id", "libelle");

-- CreateIndex
CREATE UNIQUE INDEX "ue_semestre_id_code_key" ON "ue"("semestre_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cours_ue_id_code_key" ON "cours"("ue_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cours_electifs_code_key" ON "cours_electifs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "classes_annee_universitaire_id_parcours_id_niveau_id_semest_key" ON "classes"("annee_universitaire_id", "parcours_id", "niveau_id", "semestre_id", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "etudiants_matricule_key" ON "etudiants"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "inscriptions_etudiant_id_semestre_id_annee_universitaire_id_key" ON "inscriptions"("etudiant_id", "semestre_id", "annee_universitaire_id");

-- CreateIndex
CREATE UNIQUE INDEX "notes_inscription_id_cours_id_key" ON "notes"("inscription_id", "cours_id");

-- CreateIndex
CREATE UNIQUE INDEX "absences_inscription_id_cours_id_date_seance_key" ON "absences"("inscription_id", "cours_id", "date_seance");

-- CreateIndex
CREATE UNIQUE INDEX "affectations_enseignant_cours_id_classe_id_annee_universita_key" ON "affectations_enseignant"("cours_id", "classe_id", "annee_universitaire_id");

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcours" ADD CONSTRAINT "parcours_formation_id_fkey" FOREIGN KEY ("formation_id") REFERENCES "formations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "niveaux" ADD CONSTRAINT "niveaux_parcours_id_fkey" FOREIGN KEY ("parcours_id") REFERENCES "parcours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semestres" ADD CONSTRAINT "semestres_niveau_id_fkey" FOREIGN KEY ("niveau_id") REFERENCES "niveaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ue" ADD CONSTRAINT "ue_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "semestres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cours" ADD CONSTRAINT "cours_ue_id_fkey" FOREIGN KEY ("ue_id") REFERENCES "ue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_annee_universitaire_id_fkey" FOREIGN KEY ("annee_universitaire_id") REFERENCES "annees_universitaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_parcours_id_fkey" FOREIGN KEY ("parcours_id") REFERENCES "parcours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_niveau_id_fkey" FOREIGN KEY ("niveau_id") REFERENCES "niveaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "semestres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_etudiant_id_fkey" FOREIGN KEY ("etudiant_id") REFERENCES "etudiants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_annee_universitaire_id_fkey" FOREIGN KEY ("annee_universitaire_id") REFERENCES "annees_universitaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_parcours_id_fkey" FOREIGN KEY ("parcours_id") REFERENCES "parcours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_niveau_id_fkey" FOREIGN KEY ("niveau_id") REFERENCES "niveaux"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_semestre_id_fkey" FOREIGN KEY ("semestre_id") REFERENCES "semestres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions" ADD CONSTRAINT "inscriptions_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_inscription_id_fkey" FOREIGN KEY ("inscription_id") REFERENCES "inscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_cours_id_fkey" FOREIGN KEY ("cours_id") REFERENCES "cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_saisie_par_id_fkey" FOREIGN KEY ("saisie_par_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes_historique" ADD CONSTRAINT "notes_historique_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_inscription_id_fkey" FOREIGN KEY ("inscription_id") REFERENCES "inscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_cours_id_fkey" FOREIGN KEY ("cours_id") REFERENCES "cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_saisie_par_id_fkey" FOREIGN KEY ("saisie_par_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_enseignant" ADD CONSTRAINT "affectations_enseignant_enseignant_id_fkey" FOREIGN KEY ("enseignant_id") REFERENCES "enseignants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_enseignant" ADD CONSTRAINT "affectations_enseignant_cours_id_fkey" FOREIGN KEY ("cours_id") REFERENCES "cours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_enseignant" ADD CONSTRAINT "affectations_enseignant_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_enseignant" ADD CONSTRAINT "affectations_enseignant_annee_universitaire_id_fkey" FOREIGN KEY ("annee_universitaire_id") REFERENCES "annees_universitaires"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
