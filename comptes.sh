#!/bin/bash
# Gestion des comptes du système ACADÉMIQUE.
#
#   ./comptes.sh lister           liste les comptes
#   ./comptes.sh creer            crée un compte
#   ./comptes.sh mot-de-passe     remplace le mot de passe d'un compte
#   ./comptes.sh desactiver       bloque la connexion d'un compte
#   ./comptes.sh activer          rend la connexion à un compte désactivé
#
# À lancer depuis ce dossier, application démarrée (docker compose up -d).
# Les mots de passe sont demandés à l'écran, sans affichage.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

SERVICE="backend-academique"

if [ $# -lt 1 ]; then
  echo "Usage : ./comptes.sh lister | creer | mot-de-passe | desactiver | activer" >&2
  exit 1
fi

if ! docker compose ps --status running --services | grep -x "$SERVICE" > /dev/null; then
  echo "Erreur : le service $SERVICE ne tourne pas. Lancez d'abord : docker compose up -d" >&2
  exit 1
fi

# L'outil est copié dans le conteneur le temps de l'exécution, puis effacé.
docker compose cp outils/comptes.js "$SERVICE":/app/comptes.js
nettoyer() { docker compose exec -T "$SERVICE" rm -f /app/comptes.js > /dev/null 2>&1 || true; }
trap nettoyer EXIT

docker compose exec -w /app "$SERVICE" node comptes.js "$@"
