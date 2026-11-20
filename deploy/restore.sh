#!/usr/bin/env bash
# Restaura un dump de PostgreSQL creado por deploy/backup.sh.
#
#   bash deploy/restore.sh backups/porteria-20260101T030000Z.dump --list
#   bash deploy/restore.sh backups/porteria-20260101T030000Z.dump --confirm
#
# --list    sólo muestra el contenido del archivo. No toca la base.
# --confirm obligatorio para restaurar: reemplaza los datos actuales.
#
# Antes de restaurar, el script detiene api y web para que nadie escriba.
# Después queda a cargo del operador levantar el stack y verificar (ver
# docs/runbook-produccion.md, sección 10).

set -euo pipefail

source "$(dirname "$0")/_common.sh"

usage() {
	cat >&2 <<'EOF'
Uso:
  bash deploy/restore.sh <archivo.dump> --list
  bash deploy/restore.sh <archivo.dump> --confirm

Opciones:
  --list      muestra el índice del dump sin tocar la base
  --confirm   ejecuta la restauración (destruye los datos actuales)
  --keep-app  no detiene api/web antes de restaurar
EOF
	exit 1
}

FILE=${1:-}
MODE=${2:-}
KEEP_APP=false

for arg in "$@"; do
	if [[ "$arg" == "--keep-app" ]]; then
		KEEP_APP=true
	fi
done

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
	usage
fi

case "$MODE" in
--list)
	compose exec -T db pg_restore -l <"$FILE"
	exit 0
	;;
--confirm) ;;
*) usage ;;
esac

# Integridad: si hay checksum al lado del dump, se verifica.
if [[ -f "$FILE.sha256" ]]; then
	if ! (cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256"); then
		echo "El checksum no coincide. El archivo está corrupto o incompleto." >&2
		exit 1
	fi
fi

echo "Se va a restaurar: $FILE"
echo "Sobre la base del stack: $COMPOSE_FILE"
echo "Esto REEMPLAZA todos los datos actuales."
echo
read -r -p "Escribí 'restaurar' para continuar: " ANSWER
if [[ "$ANSWER" != "restaurar" ]]; then
	echo "Cancelado."
	exit 1
fi

if [[ "$KEEP_APP" != true ]]; then
	log "Deteniendo api y web"
	compose stop api web >/dev/null
fi

log "Restaurando $FILE"
if ! compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' <"$FILE"; then
	echo "pg_restore terminó con errores. Revisá la salida antes de levantar el stack." >&2
	exit 1
fi

log "Restauración terminada"
cat <<'EOF'

Siguiente:
  1. Aplicar migraciones pendientes si el dump es viejo:
       docker compose ... run --rm migrate
  2. Levantar el stack:
       docker compose ... up -d api web
  3. Verificar /ready, login y un pase de prueba.
EOF
