#!/bin/bash
set -euo pipefail

# Sauvegarde de la base de données de la plateforme ISB — lit DATABASE_URL
# directement depuis le .env du backend, jamais codé en dur ici, pour
# toujours utiliser la même base que l'application elle-même.
#
# Usage : ./sauvegarder-base.sh
# (peut être placé dans une tâche planifiée — voir instructions à la fin)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if ! command -v pg_dump &> /dev/null; then
  echo "Erreur : pg_dump n'est pas installé. Sur Ubuntu : sudo apt install postgresql-client" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Erreur : fichier .env introuvable à $ENV_FILE" >&2
  exit 1
fi

DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n1 | cut -d '=' -f2- | tr -d '"'"'"'')

if [ -z "$DATABASE_URL" ]; then
  echo "Erreur : DATABASE_URL introuvable ou vide dans .env" >&2
  exit 1
fi

# Le paramètre ?schema=public (ajouté par Prisma) n'est pas un paramètre de
# connexion reconnu par pg_dump — on le retire ; pg_dump sauvegarde de
# toute façon tout le schéma par défaut.
DATABASE_URL_PROPRE="${DATABASE_URL%%\?*}"

DOSSIER_SAUVEGARDES="$SCRIPT_DIR/sauvegardes"
mkdir -p "$DOSSIER_SAUVEGARDES"

HORODATAGE=$(date +%Y-%m-%d_%H-%M-%S)
FICHIER_SORTIE="$DOSSIER_SAUVEGARDES/isb-sauvegarde-$HORODATAGE.sql.gz"

echo "Sauvegarde en cours vers $FICHIER_SORTIE..."

if ! pg_dump "$DATABASE_URL_PROPRE" | gzip > "$FICHIER_SORTIE"; then
  echo "Échec de la sauvegarde." >&2
  rm -f "$FICHIER_SORTIE"
  exit 1
fi

TAILLE=$(du -h "$FICHIER_SORTIE" | cut -f1)
echo "Sauvegarde terminée : $FICHIER_SORTIE ($TAILLE)"

# Garde seulement les 30 sauvegardes les plus récentes (environ un mois si
# lancé une fois par jour), pour éviter un remplissage illimité du disque.
NOMBRE_A_GARDER=30
NOMBRE_ACTUEL=$(find "$DOSSIER_SAUVEGARDES" -maxdepth 1 -name "isb-sauvegarde-*.sql.gz" | wc -l)
if [ "$NOMBRE_ACTUEL" -gt "$NOMBRE_A_GARDER" ]; then
  ls -1t "$DOSSIER_SAUVEGARDES"/isb-sauvegarde-*.sql.gz | tail -n +$((NOMBRE_A_GARDER + 1)) | xargs rm -f
  echo "Anciennes sauvegardes au-delà de $NOMBRE_A_GARDER supprimées."
fi
