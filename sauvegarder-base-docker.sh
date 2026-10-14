#!/bin/bash
set -euo pipefail

# Sauvegarde de la base PostgreSQL qui tourne DANS Docker (projet academique).
# Remplace sauvegarder-base.sh, qui lisait backend/.env et sauvegardait donc
# l'ancienne base locale de PM2, plus utilisee depuis le passage a Docker.
#
# Usage : ./sauvegarder-base-docker.sh
# A placer a la racine du projet, a cote de docker-compose.yml.

export PATH=/usr/local/bin:/usr/bin:/bin

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Obligatoire : docker compose lit le .env de CE dossier pour interpreter
# docker-compose.yml, meme pour de simples commandes exec ou ps.
cd "$SCRIPT_DIR"

SERVICE="postgres-academique"
DOSSIER_SAUVEGARDES="$SCRIPT_DIR/sauvegardes"
mkdir -p "$DOSSIER_SAUVEGARDES"

HORODATAGE=$(date +%Y-%m-%d_%H-%M-%S)
FICHIER_SORTIE="$DOSSIER_SAUVEGARDES/isb-docker-sauvegarde-$HORODATAGE.sql.gz"

if ! docker compose ps --status running --services | grep -x "$SERVICE" > /dev/null; then
  echo "Erreur : le service $SERVICE ne tourne pas, rien à sauvegarder." >&2
  exit 1
fi

echo "Sauvegarde en cours vers $FICHIER_SORTIE..."

# Les variables entre apostrophes sont lues DANS le conteneur, la ou elles
# existent. Connexion par le socket local, sans mot de passe a transmettre.
if ! docker compose exec -T "$SERVICE" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$FICHIER_SORTIE"; then
  echo "Échec de la sauvegarde." >&2
  rm -f "$FICHIER_SORTIE"
  exit 1
fi

# Une sauvegarde jamais vérifiée n'est pas une sauvegarde : archive lisible,
# et taille plausible (un vrai dump de ce schema depasse largement 500 octets).
if ! gzip -t "$FICHIER_SORTIE"; then
  echo "Archive corrompue, sauvegarde supprimée." >&2
  rm -f "$FICHIER_SORTIE"
  exit 1
fi
TAILLE_OCTETS=$(stat -c %s "$FICHIER_SORTIE")
if [ "$TAILLE_OCTETS" -lt 500 ]; then
  echo "Sauvegarde anormalement petite ($TAILLE_OCTETS octets), supprimée." >&2
  rm -f "$FICHIER_SORTIE"
  exit 1
fi

TAILLE=$(du -h "$FICHIER_SORTIE" | cut -f1)
echo "Sauvegarde terminée : $FICHIER_SORTIE ($TAILLE)"

# Garde les 30 plus récentes (environ un mois, une par nuit).
NOMBRE_A_GARDER=30
NOMBRE_ACTUEL=$(find "$DOSSIER_SAUVEGARDES" -maxdepth 1 -name "isb-docker-sauvegarde-*.sql.gz" | wc -l)
if [ "$NOMBRE_ACTUEL" -gt "$NOMBRE_A_GARDER" ]; then
  ls -1t "$DOSSIER_SAUVEGARDES"/isb-docker-sauvegarde-*.sql.gz | tail -n +$((NOMBRE_A_GARDER + 1)) | xargs rm -f
  echo "Anciennes sauvegardes au-delà de $NOMBRE_A_GARDER supprimées."
fi
