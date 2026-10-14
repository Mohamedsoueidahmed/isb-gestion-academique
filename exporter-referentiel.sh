#!/bin/bash
# Exporte le REFERENTIEL du système ACADÉMIQUE vers un fichier à transporter
# sur un autre ordinateur (par exemple du portable vers le serveur).
#
# Contenu : université, formations, parcours, niveaux, semestres, UE, cours et
# catalogue des électifs, c'est-à-dire la structure des formations. JAMAIS
# d'étudiants, de notes, de classes, d'années universitaires ni de comptes.
#
# Les parcours masqués dans l'application (est_actif = false) ne sont pas
# exportés, ni rien de ce qui en dépend (niveaux, semestres, UE, cours). Le
# serveur reçoit donc un référentiel propre, sans les restes des essais.
#
# Usage :  ./exporter-referentiel.sh  [fichier-de-sortie]
#   par défaut : referentiel-academique.sql.gz, dans ce dossier.
#
# L'application doit tourner (docker compose up -d). Rien n'est modifié dans
# la base : la lecture se fait en une seule transaction, en lecture seule.
#
# Le fichier se charge ensuite sur l'ordinateur de destination avec
# ./importer-referentiel.sh. Il ne contient ni mot de passe ni donnée
# d'étudiant, mais gardez-le pour vous : *.sql.gz est déjà exclu de Git.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

SERVICE="postgres-academique"
SORTIE="${1:-referentiel-academique.sql.gz}"
# Les tables « parents » d'abord : c'est l'ordre dans lequel elles seront
# rechargées, chaque table arrive après celle qu'elle référence.
TABLES=(universite formations parcours niveaux semestres ue cours cours_electifs)

erreur() { echo "Erreur : $1" >&2; exit 1; }

# Le SQL arrive sur l'entrée standard ; USER et DB sont lus DANS le conteneur.
sql() { docker compose exec -T "$SERVICE" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -q'; }
req() { printf '%s\n' "$1" | sql; }

# Ce qui dépend d'un parcours actif : ses niveaux, leurs semestres, leurs UE,
# leurs cours. Le catalogue des électifs dépend de la formation, pas du parcours.
P_ACTIFS="SELECT id FROM public.parcours WHERE est_actif"
N_ACTIFS="SELECT id FROM public.niveaux WHERE parcours_id IN ($P_ACTIFS)"
S_ACTIFS="SELECT id FROM public.semestres WHERE niveau_id IN ($N_ACTIFS)"
U_ACTIFS="SELECT id FROM public.ue WHERE semestre_id IN ($S_ACTIFS)"
filtre() {
  case "$1" in
    parcours)  echo "est_actif" ;;
    niveaux)   echo "parcours_id IN ($P_ACTIFS)" ;;
    semestres) echo "niveau_id IN ($N_ACTIFS)" ;;
    ue)        echo "semestre_id IN ($S_ACTIFS)" ;;
    cours)     echo "ue_id IN ($U_ACTIFS)" ;;
    *)         echo "true" ;;
  esac
}

docker compose ps --status running --services | grep -x "$SERVICE" > /dev/null \
  || erreur "le service $SERVICE ne tourne pas. Lancez d'abord : docker compose up -d"

echo "1/4  Lecture de la base"
UNION=""
for t in "${TABLES[@]}"; do
  UNION+="${UNION:+ UNION ALL }SELECT '$t', count(*) FROM public.$t"
done
TOTAUX=$(req "$UNION") || erreur "impossible de lire les tables du référentiel (la base est-elle bien celle du système académique ?)."
declare -A DANS_LA_BASE
while IFS='|' read -r nom nombre; do DANS_LA_BASE[$nom]="$nombre"; done <<< "$TOTAUX"
[ "${DANS_LA_BASE[parcours]:-0}" -gt 0 ] || erreur "la base ne contient aucun parcours : il n'y a rien à exporter."

MASQUES=$(req "SELECT nom FROM public.parcours WHERE NOT est_actif ORDER BY nom")
GARDES=$(req "SELECT f.nom || '  >  ' || p.nom FROM public.parcours p JOIN public.formations f ON f.id = p.formation_id WHERE p.est_actif ORDER BY f.nom, p.nom")
MIGRATIONS=$(req "SELECT count(*) || ' ' || max(migration_name) FROM _prisma_migrations WHERE finished_at IS NOT NULL") \
  || erreur "table _prisma_migrations introuvable : l'application n'a jamais démarré sur cette base."

declare -A COLONNES
for t in "${TABLES[@]}"; do
  COLONNES[$t]=$(req "SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$t'")
  [ -n "${COLONNES[$t]}" ] || erreur "la table $t est introuvable."
done

echo "2/4  Extraction (en lecture seule, une seule transaction)"
CORPS=$(mktemp)
TMP_SORTIE="$SORTIE.en-cours"
trap 'rm -f "$CORPS" "$TMP_SORTIE"' EXIT
{
  echo "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;"
  for t in "${TABLES[@]}"; do
    echo "SELECT 'COPY public.$t (${COLONNES[$t]}) FROM stdin;';"
    echo "COPY (SELECT ${COLONNES[$t]} FROM public.$t WHERE $(filtre "$t") ORDER BY id) TO STDOUT;"
    echo "SELECT '\\.';"
  done
  echo "COMMIT;"
} | sql > "$CORPS" || erreur "l'extraction a échoué. Aucun fichier n'a été écrit."

# Nombre de lignes réellement écrites pour chaque table (et non un décompte
# fait à part), pour que l'en-tête dise exactement ce que contient le fichier.
declare -A EXPORTEES
while IFS='=' read -r nom nombre; do EXPORTEES[$nom]="$nombre"; done < <(
  awk '/^COPY public\./ { t = $2; sub(/^public\./, "", t); n = 0; dedans = 1; next }
       /^\\\.$/ { if (dedans) { print t "=" n; dedans = 0 } ; next }
       dedans { n++ }' "$CORPS"
)
LIGNES=""
for t in "${TABLES[@]}"; do
  [ -n "${EXPORTEES[$t]:-}" ] || erreur "extraction incomplète (table $t absente du résultat). Aucun fichier n'a été écrit."
  LIGNES+="${LIGNES:+ }$t=${EXPORTEES[$t]}"
done
[ "${EXPORTEES[universite]}" -ge 1 ] || erreur "la table universite est vide : le référentiel est incomplet. Aucun fichier n'a été écrit."
[ "${EXPORTEES[parcours]}" -ge 1 ] || erreur "tous les parcours sont masqués : il n'y a rien à exporter. Aucun fichier n'a été écrit."

echo "3/4  Écriture de $SORTIE"
{
  echo "-- ISB-REFERENTIEL-ACADEMIQUE 1"
  echo "-- cree-le: $(date +%Y-%m-%dT%H:%M:%S%z)"
  echo "-- migrations: $MIGRATIONS"
  echo "-- lignes: $LIGNES"
  echo "SET client_encoding = 'UTF8';"
  cat "$CORPS"
} | gzip > "$TMP_SORTIE"
gzip -t "$TMP_SORTIE" || erreur "l'archive écrite est illisible. Aucun fichier n'a été remplacé."
REMPLACE=""
[ -e "$SORTIE" ] && REMPLACE=" (remplace l'export précédent)"
mv -f "$TMP_SORTIE" "$SORTIE"

echo "4/4  Résultat"
printf '%-16s %12s %10s\n' table "dans la base" exportées
for t in "${TABLES[@]}"; do
  printf '%-16s %12s %10s\n' "$t" "${DANS_LA_BASE[$t]}" "${EXPORTEES[$t]}"
done
echo ""
echo "Parcours exportés (${EXPORTEES[parcours]}) : ce sont ceux qui seront visibles sur le serveur. Relisez cette liste."
while IFS= read -r nom; do echo "  - $nom"; done <<< "$GARDES"
if [ -n "$MASQUES" ]; then
  echo ""
  echo "Parcours masqués, NON exportés (avec leurs niveaux, semestres, UE et cours) :"
  while IFS= read -r nom; do echo "  - $nom"; done <<< "$MASQUES"
fi
echo ""
echo "Fichier créé : $SORTIE ($(du -h "$SORTIE" | cut -f1))$REMPLACE"
echo "Copiez-le sur l'ordinateur de destination, puis lancez là-bas :"
echo "  ./importer-referentiel.sh $(basename "$SORTIE")"
