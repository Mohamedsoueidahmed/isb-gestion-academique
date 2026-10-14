#!/bin/bash
# Restaure une sauvegarde de la base du système ACADÉMIQUE.
#
# Usage : ./restaurer-base-docker.sh sauvegardes/isb-docker-sauvegarde-AAAA-MM-JJ_HH-MM-SS.sql.gz
#
# ATTENTION : la base actuelle est REMPLACÉE par le contenu de la sauvegarde.
# Par sécurité, l'état actuel est d'abord sauvegardé dans
# sauvegardes/avant-restauration-*.sql.gz (il ne sera jamais supprimé
# automatiquement).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

SERVICE_BASE="postgres-academique"
SERVICE_BACKEND="backend-academique"
SERVICE_SITE="frontend-academique"

erreur() { echo "Erreur : $1" >&2; exit 1; }

FICHIER="${1:-}"
if [ -z "$FICHIER" ]; then
  echo "Usage : ./restaurer-base-docker.sh <fichier de sauvegarde .sql.gz>" >&2
  echo "Les sauvegardes les plus récentes :" >&2
  ls -1t sauvegardes/isb-docker-sauvegarde-*.sql.gz 2> /dev/null | head -5 >&2 || true
  exit 1
fi
[ -f "$FICHIER" ] || erreur "fichier introuvable : $FICHIER"
gzip -t "$FICHIER" 2> /dev/null || erreur "ce fichier est corrompu (archive illisible) : $FICHIER"
docker compose ps --status running --services | grep -x "$SERVICE_BASE" > /dev/null \
  || erreur "le service $SERVICE_BASE ne tourne pas. Lancez d'abord : docker compose up -d"

echo "============================================================"
echo " Vous allez REMPLACER toute la base ($SERVICE_BASE) par :"
echo "   $FICHIER"
echo " Tout ce qui a été saisi depuis cette sauvegarde sera perdu."
echo " L'application sera arrêtée quelques instants."
echo "============================================================"
read -r -p "Tapez OUI (en majuscules) pour continuer : " REPONSE
[ "$REPONSE" = "OUI" ] || { echo "Annulé. Rien n'a été modifié."; exit 1; }

# 1. Copie de sécurité de l'état actuel.
SECURITE="sauvegardes/avant-restauration-$(date +%Y-%m-%d_%H-%M-%S).sql.gz"
echo "1/4  Copie de sécurité de l'état actuel : $SECURITE"
docker compose exec -T "$SERVICE_BASE" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$SECURITE"
gzip -t "$SECURITE" || erreur "la copie de sécurité est illisible, restauration annulée (rien n'a été modifié)."

# 2. Arrêt de l'application (le backend garde des connexions ouvertes à la base).
echo "2/4  Arrêt de l'application"
docker compose stop "$SERVICE_SITE" "$SERVICE_BACKEND"

# En cas d'échec à partir d'ici, on dit où retrouver l'état d'avant.
echec() { echo "" >&2; echo "ÉCHEC de la restauration. L'état précédent est conservé dans : $SECURITE" >&2; }
trap echec ERR

# 3. Base vide, puis restauration en une seule transaction (tout ou rien).
echo "3/4  Remplacement de la base"
docker compose exec -T "$SERVICE_BASE" sh -c 'psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\" WITH (FORCE)" -c "CREATE DATABASE \"$POSTGRES_DB\""'
gunzip -c "$FICHIER" | docker compose exec -T "$SERVICE_BASE" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction -q' > /dev/null

# 4. Redémarrage.
echo "4/4  Redémarrage de l'application"
docker compose up -d "$SERVICE_BACKEND" "$SERVICE_SITE"
trap - ERR
echo ""
echo "Restauration terminée. Patientez une minute puis vérifiez avec : docker compose ps"
echo "(l'état d'avant la restauration reste disponible dans $SECURITE)"
