#!/bin/bash
# Charge un référentiel produit par exporter-referentiel.sh dans la base du
# système ACADÉMIQUE (en général : celle du serveur, encore vide).
#
# Usage :  ./importer-referentiel.sh  referentiel-academique.sql.gz
#
# À faire une seule fois, APRÈS le premier démarrage de l'application (c'est
# lui qui crée les tables) et AVANT de créer l'année universitaire : c'est la
# création de l'année qui fabrique les classes, à partir des parcours et des
# niveaux. Créée avant le référentiel, l'année n'aurait aucune classe.
#
# Garde-fous : le script s'arrête SANS RIEN ÉCRIRE si le fichier est illisible
# ou n'a pas été produit par exporter-referentiel.sh, si les deux bases n'ont
# pas le même historique de migrations, ou si une table du référentiel
# contient déjà des lignes. Une sauvegarde de sécurité est faite avant le
# chargement, et le chargement est une seule transaction (tout ou rien).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

SERVICE="postgres-academique"
FICHIER="${1:-}"
TABLES=(universite formations parcours niveaux semestres ue cours cours_electifs)

erreur() { echo "Erreur : $1" >&2; exit 1; }

sql() { docker compose exec -T "$SERVICE" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -q'; }
req() { printf '%s\n' "$1" | sql; }

if [ -z "$FICHIER" ]; then
  echo "Usage : ./importer-referentiel.sh <fichier .sql.gz créé par exporter-referentiel.sh>" >&2
  exit 1
fi

echo "1/5  Lecture du fichier"
[ -f "$FICHIER" ] || erreur "fichier introuvable : $FICHIER"
gzip -t "$FICHIER" 2> /dev/null || erreur "ce fichier est corrompu (archive illisible) : $FICHIER"
ENTETE=$(gunzip -c "$FICHIER" | sed -n '1,6p')
grep -qx -- '-- ISB-REFERENTIEL-ACADEMIQUE 1' <<< "$ENTETE" \
  || erreur "ce fichier n'a pas été créé par exporter-referentiel.sh (ou vient d'une autre version). Rien n'a été modifié."
MIGRATIONS_FICHIER=$(printf '%s\n' "$ENTETE" | sed -n 's/^-- migrations: //p')
LIGNES_FICHIER=$(printf '%s\n' "$ENTETE" | sed -n 's/^-- lignes: //p')
{ [ -n "$MIGRATIONS_FICHIER" ] && [ -n "$LIGNES_FICHIER" ]; } || erreur "l'en-tête du fichier est incomplet. Rien n'a été modifié."
declare -A ATTENDU
for couple in $LIGNES_FICHIER; do ATTENDU[${couple%%=*}]="${couple#*=}"; done
for t in "${TABLES[@]}"; do
  [[ "${ATTENDU[$t]:-}" =~ ^[0-9]+$ ]] || erreur "l'en-tête du fichier ne donne pas le nombre de lignes de $t. Rien n'a été modifié."
done

echo "2/5  Vérification de la base de destination"
docker compose ps --status running --services | grep -x "$SERVICE" > /dev/null \
  || erreur "le service $SERVICE ne tourne pas. Lancez d'abord : docker compose up -d"
MIGRATIONS_BASE=$(req "SELECT count(*) || ' ' || max(migration_name) FROM _prisma_migrations WHERE finished_at IS NOT NULL" 2> /dev/null) \
  || erreur "les tables n'existent pas encore : l'application n'a jamais démarré sur cette base. Lancez docker compose up -d, attendez que backend-academique soit « healthy » (docker compose ps), puis recommencez."
if [ "$MIGRATIONS_FICHIER" != "$MIGRATIONS_BASE" ]; then
  echo "Erreur : le fichier et cette base n'ont pas la même version de structure." >&2
  echo "  fichier : $MIGRATIONS_FICHIER" >&2
  echo "  base    : $MIGRATIONS_BASE" >&2
  echo "Mettez le code de cette machine à la même version que celle où l'export a été fait (git pull / git checkout <étiquette>, puis docker compose build et up -d). Rien n'a été modifié." >&2
  exit 1
fi
for t in "${TABLES[@]}"; do
  n=$(req "SELECT count(*) FROM public.$t")
  if [ "$n" != "0" ]; then
    erreur "la table $t contient déjà $n ligne(s). Le référentiel ne se charge que dans une base où il est absent. Rien n'a été modifié."
  fi
done

echo "3/5  Sauvegarde de sécurité de la base"
[ -x ./sauvegarder-base-docker.sh ] || erreur "sauvegarder-base-docker.sh est introuvable ou non exécutable (chmod +x). Rien n'a été modifié."
./sauvegarder-base-docker.sh

echo "4/5  Chargement (une seule transaction : tout ou rien)"
if ! gunzip -c "$FICHIER" | docker compose exec -T "$SERVICE" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction -q -o /dev/null'; then
  echo "" >&2
  echo "ÉCHEC du chargement : la transaction a été annulée, la base est restée telle qu'avant." >&2
  exit 1
fi

echo "5/5  Vérification"
TOUT_OK=1
printf '%-16s %10s %10s\n' table attendu chargé
for t in "${TABLES[@]}"; do
  n=$(req "SELECT count(*) FROM public.$t")
  marque="ok"
  if [ "$n" != "${ATTENDU[$t]}" ]; then marque="DIFFÉRENT"; TOUT_OK=0; fi
  printf '%-16s %10s %10s  %s\n' "$t" "${ATTENDU[$t]}" "$n" "$marque"
done
if [ "$TOUT_OK" != "1" ]; then
  echo "" >&2
  echo "Erreur : les nombres de lignes ne correspondent pas. La sauvegarde faite à l'étape 3 (dossier sauvegardes/) permet de revenir en arrière avec ./restaurer-base-docker.sh." >&2
  exit 1
fi
echo ""
echo "Référentiel chargé avec succès."
echo "Étape suivante : connectez-vous à l'application et créez l'année universitaire."
echo "C'est cette création qui fabrique les classes (une par parcours et par niveau)."
