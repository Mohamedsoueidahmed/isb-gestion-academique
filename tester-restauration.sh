#!/bin/bash
# Vérifie qu'une sauvegarde du système ACADÉMIQUE peut vraiment être restaurée,
# SANS toucher aux vraies données. Une sauvegarde jamais testée n'est pas une
# sauvegarde.
#
# Usage : ./tester-restauration.sh [fichier de sauvegarde .sql.gz]
#   Sans fichier : teste la sauvegarde la plus récente du dossier sauvegardes/.
#   Pour tester la copie du disque externe :
#   ./tester-restauration.sh /mnt/sauvegardes/academique/isb-docker-sauvegarde-AAAA-MM-JJ_HH-MM-SS.sql.gz
#
# Principe : la sauvegarde est chargée dans une base temporaire (test_restauration),
# créée à côté de la vraie base, comparée à elle table par table, puis supprimée.
# L'application continue de tourner : elle n'est ni arrêtée ni modifiée.
set -euo pipefail

export PATH=/usr/local/bin:/usr/bin:/bin

cd "$(dirname "${BASH_SOURCE[0]}")"

SERVICE="postgres-academique"
BASE_TEST="test_restauration"

erreur() { echo "Erreur : $1" >&2; exit 1; }

# Un nom explicitement vide (ex. "$(ls ...)" sans résultat) est une erreur : on ne teste pas
# en silence une autre sauvegarde que celle demandée.
if [ "$#" -ge 1 ] && [ -z "$1" ]; then
  erreur "le nom du fichier est vide (le disque externe est-il monté ? essayez : sudo mount -a)."
fi
FICHIER="${1:-}"
if [ -z "$FICHIER" ]; then
  FICHIER="$(ls -1t sauvegardes/isb-docker-sauvegarde-*.sql.gz 2> /dev/null | head -1 || true)"
  [ -n "$FICHIER" ] || erreur "aucune sauvegarde dans sauvegardes/ (lancez d'abord ./sauvegarder-base-docker.sh)."
fi
[ -f "$FICHIER" ] || erreur "fichier introuvable : $FICHIER"
gzip -t "$FICHIER" 2> /dev/null || erreur "archive illisible (corrompue) : $FICHIER"
docker compose ps --status running --services | grep -x "$SERVICE" > /dev/null \
  || erreur "le service $SERVICE ne tourne pas. Lancez d'abord : docker compose up -d"

# $1 = nom de la base, les autres arguments sont ceux de psql. Le nom de
# l'utilisateur est lu DANS le conteneur, là où il existe.
psql_dans() {
  local base="$1"
  shift
  docker compose exec -T "$SERVICE" sh -c 'b="$1"; shift; exec psql -U "$POSTGRES_USER" -d "$b" "$@"' sh "$base" "$@"
}

NOM_BASE="$(docker compose exec -T "$SERVICE" sh -c 'printf %s "$POSTGRES_DB"' < /dev/null)"
[ -n "$NOM_BASE" ] || erreur "impossible de lire le nom de la base dans le conteneur."
[ "$NOM_BASE" != "$BASE_TEST" ] || erreur "la vraie base porte le nom réservé au test ($BASE_TEST)."

supprimer_base_test() {
  psql_dans postgres -q -c "DROP DATABASE IF EXISTS $BASE_TEST WITH (FORCE)" < /dev/null > /dev/null 2>&1 || true
}
# Quoi qu'il arrive, la base temporaire disparaît à la fin.
trap supprimer_base_test EXIT

echo "Test de restauration de : $FICHIER"
echo "  sauvegarde du $(date -r "$FICHIER" '+%Y-%m-%d à %H:%M')"
echo ""

echo "1/3  Création d'une base temporaire ($BASE_TEST), à côté de la vraie base"
supprimer_base_test
psql_dans postgres -q -v ON_ERROR_STOP=1 -c "CREATE DATABASE $BASE_TEST" < /dev/null

echo "2/3  Chargement de la sauvegarde dans la base temporaire"
if ! gunzip -c "$FICHIER" | psql_dans "$BASE_TEST" -q -v ON_ERROR_STOP=1 --single-transaction > /dev/null; then
  echo "" >&2
  echo "ÉCHEC : cette sauvegarde ne peut pas être restaurée. La vraie base n'a pas été touchée." >&2
  exit 1
fi

echo "3/3  Comparaison avec la vraie base ($NOM_BASE)"
COMPTAGE="SELECT table_name || '|' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
RESTAUREE="$(psql_dans "$BASE_TEST" -At -c "$COMPTAGE" < /dev/null | LC_ALL=C sort -t '|' -k1,1)"
REELLE="$(psql_dans "$NOM_BASE" -At -c "$COMPTAGE" < /dev/null | LC_ALL=C sort -t '|' -k1,1)"

printf '\n  %-34s %12s %12s\n' "Table" "Sauvegarde" "En base"
MANQUANTES=0
DIFFERENTES=0
TOTAL=0
while IFS='|' read -r table dans_sauvegarde en_base; do
  [ -n "$table" ] || continue
  TOTAL=$((TOTAL + 1))
  note=""
  if [ "$dans_sauvegarde" = "-" ]; then
    MANQUANTES=$((MANQUANTES + 1))
    note="   <- absente de la sauvegarde"
  elif [ "$en_base" = "-" ]; then
    note="   <- absente de la base actuelle"
  elif [ "$dans_sauvegarde" != "$en_base" ]; then
    DIFFERENTES=$((DIFFERENTES + 1))
    note="   <- différent"
  fi
  printf '  %-34s %12s %12s%s\n' "$table" "$dans_sauvegarde" "$en_base" "$note"
done < <(LC_ALL=C join -t '|' -a 1 -a 2 -e '-' -o 0,1.2,2.2 <(printf '%s\n' "$RESTAUREE") <(printf '%s\n' "$REELLE"))

echo ""
if [ "$MANQUANTES" -gt 0 ]; then
  echo "ATTENTION : $MANQUANTES table(s) de la base actuelle manquent dans cette sauvegarde." >&2
  echo "Elle est peut-être plus ancienne qu'une mise à jour de l'application. Testez une sauvegarde plus récente." >&2
  exit 2
fi
echo "RÉSULTAT : la sauvegarde se restaure sans erreur et contient les $TOTAL tables de la base."
if [ "$DIFFERENTES" -gt 0 ]; then
  echo "Les lignes marquées « différent » ont changé depuis la sauvegarde : c'est normal si des données ont été saisies depuis."
fi
echo "La base temporaire est supprimée. La vraie base n'a pas été modifiée."
