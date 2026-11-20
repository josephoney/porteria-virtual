#!/usr/bin/env bash
# Respaldo de PostgreSQL con copia fuera del servidor.
#
#   bash deploy/backup.sh
#   COMPOSE_FILE=docker-compose.staging.yml ENV_FILE=.env.staging bash deploy/backup.sh
#
# Qué hace:
#   1. pg_dump en formato custom (-Fc) desde el contenedor db.
#   2. Verifica que el archivo sea un dump legible antes de darlo por bueno.
#   3. Sube el archivo y su checksum al bucket remoto (S3 compatible) con rclone.
#   4. Borra respaldos locales y remotos más viejos que BACKUP_RETENTION_DAYS.
#
# Pensado para cron o systemd timer en el servidor. Ver deploy/README.md.
#
# Variables (se leen del ENV_FILE, se pueden exportar antes):
#   BACKUP_DIR                   destino local            (default: <repo>/backups)
#   BACKUP_RETENTION_DAYS        días a conservar         (default: 14)
#   BACKUP_S3_ENDPOINT           endpoint S3 compatible   (sin esto no hay copia remota)
#   BACKUP_S3_BUCKET             bucket
#   BACKUP_S3_REGION             región                   (default: us-east-1)
#   BACKUP_S3_PREFIX             carpeta dentro del bucket (default: porteria)
#   BACKUP_S3_ACCESS_KEY_ID      credencial
#   BACKUP_S3_SECRET_ACCESS_KEY  credencial
#   BACKUP_S3_FORCE_PATH_STYLE   true/false               (default: true)
#   RCLONE_IMAGE                 imagen de rclone         (default: rclone/rclone:latest)
#   SKIP_OFFSITE=1               sólo respaldo local

set -euo pipefail

source "$(dirname "$0")/_common.sh"

# --- Cargar sólo las variables de respaldo -----------------------------------
# El resto de los secretos vive en los contenedores; el host no los necesita.

if [[ -f "$ENV_FILE" ]]; then
	while IFS='=' read -r key value; do
		if [[ ! $key =~ ^(BACKUP_|RCLONE_IMAGE|SKIP_OFFSITE) ]]; then
			continue
		fi
		if [[ -n "${!key:-}" ]]; then
			continue # lo que ya está exportado gana
		fi
		value=${value%$'\r'}
		value=${value#\"}
		value=${value%\"}
		value=${value#\'}
		value=${value%\'}
		export "$key=$value"
	done <"$ENV_FILE"
fi

BACKUP_DIR=${BACKUP_DIR:-$REPO_ROOT/backups}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}
BACKUP_S3_PREFIX=${BACKUP_S3_PREFIX:-porteria}
BACKUP_S3_REGION=${BACKUP_S3_REGION:-us-east-1}
BACKUP_S3_FORCE_PATH_STYLE=${BACKUP_S3_FORCE_PATH_STYLE:-true}
RCLONE_IMAGE=${RCLONE_IMAGE:-rclone/rclone:latest}

mkdir -p "$BACKUP_DIR"
LOG_FILE=${LOG_FILE:-$BACKUP_DIR/backup.log}

fail() {
	log "ERROR: $*"
	exit 1
}

# --- Evitar dos respaldos simultáneos ----------------------------------------

LOCK_FILE=${TMPDIR:-/tmp}/porteria-backup.lock
exec 9>"$LOCK_FILE"
if command -v flock >/dev/null 2>&1; then
	if ! flock -n 9; then
		log "Ya hay un respaldo en curso ($LOCK_FILE). Salgo."
		exit 0
	fi
fi

# --- Dump --------------------------------------------------------------------

STAMP=$(date -u '+%Y%m%dT%H%M%SZ')
NAME="porteria-$STAMP.dump"
TMP_FILE="$BACKUP_DIR/.$NAME.part"
DUMP_FILE="$BACKUP_DIR/$NAME"

log "Iniciando respaldo ($NAME) desde $COMPOSE_FILE"

cleanup() {
	rm -f "$TMP_FILE"
}
trap cleanup EXIT

if ! compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' >"$TMP_FILE"; then
	fail "pg_dump falló. Revisá que el servicio db esté arriba y saludable."
fi

SIZE=$(stat -c%s "$TMP_FILE" 2>/dev/null || stat -f%z "$TMP_FILE")
if [[ $SIZE -lt 4096 ]]; then
	fail "El dump pesa $SIZE bytes: está vacío o truncado. No se sube nada."
fi

# Un dump custom arranca con la firma "PGDMP".
if [[ "$(head -c 5 "$TMP_FILE")" != "PGDMP" ]]; then
	fail "El archivo no tiene la firma de pg_dump (-Fc)."
fi

# Validación del índice del archivo, no sólo del tamaño. pg_restore lee desde
# stdin, así que no hace falta copiarlo al contenedor.
if ! compose exec -T db pg_restore -l >/dev/null 2>&1 <"$TMP_FILE"; then
	fail "pg_restore no pudo leer el dump: está corrupto."
fi

mv "$TMP_FILE" "$DUMP_FILE"
(
	cd "$BACKUP_DIR"
	sha256sum "$NAME" >"$NAME.sha256"
)

log "Dump OK: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"

# --- Copia fuera del servidor ------------------------------------------------

OFFSITE_CONFIGURED=true
if [[ "${SKIP_OFFSITE:-0}" == "1" ]]; then
	OFFSITE_CONFIGURED=false
	log "AVISO: SKIP_OFFSITE=1. El respaldo queda sólo en este servidor."
elif [[ -z "${BACKUP_S3_ENDPOINT:-}" || -z "${BACKUP_S3_BUCKET:-}" ||
	-z "${BACKUP_S3_ACCESS_KEY_ID:-}" || -z "${BACKUP_S3_SECRET_ACCESS_KEY:-}" ]]; then
	OFFSITE_CONFIGURED=false
	log "AVISO: falta configurar BACKUP_S3_*. El respaldo queda sólo en este servidor."
fi

rclone_remote() {
	docker run --rm \
		-e RCLONE_CONFIG_BACKUP_TYPE=s3 \
		-e RCLONE_CONFIG_BACKUP_PROVIDER=Other \
		-e RCLONE_CONFIG_BACKUP_ENV_AUTH=false \
		-e "RCLONE_CONFIG_BACKUP_ENDPOINT=$BACKUP_S3_ENDPOINT" \
		-e "RCLONE_CONFIG_BACKUP_REGION=$BACKUP_S3_REGION" \
		-e "RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID=$BACKUP_S3_ACCESS_KEY_ID" \
		-e "RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY=$BACKUP_S3_SECRET_ACCESS_KEY" \
		-e "RCLONE_CONFIG_BACKUP_FORCE_PATH_STYLE=$BACKUP_S3_FORCE_PATH_STYLE" \
		-e RCLONE_CONFIG_BACKUP_NO_CHECK_BUCKET=true \
		-v "$BACKUP_DIR:/backups:ro" \
		"$RCLONE_IMAGE" \
		"$@" 2>&1 | sed 's/\(secret_access_key=\)[^ ,]*/\1***/I'
}

if [[ "$OFFSITE_CONFIGURED" == true ]]; then
	REMOTE="backup:$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX"
	log "Subiendo a $REMOTE"

	if ! rclone_remote copyto "/backups/$NAME" "$REMOTE/$NAME"; then
		fail "Falló la subida a $REMOTE. El dump local quedó en $DUMP_FILE."
	fi
	if ! rclone_remote copyto "/backups/$NAME.sha256" "$REMOTE/$NAME.sha256"; then
		fail "Falló la subida del checksum a $REMOTE."
	fi

	# Verificación de que el objeto remoto existe y coincide en tamaño.
	REMOTE_SIZE=$(rclone_remote size "$REMOTE/$NAME" --json 2>/dev/null |
		sed -n 's/.*"bytes":\([0-9]*\).*/\1/p' || true)
	if [[ -n "$REMOTE_SIZE" && "$REMOTE_SIZE" != "$SIZE" ]]; then
		fail "El tamaño remoto ($REMOTE_SIZE) no coincide con el local ($SIZE)."
	fi

	log "Subida OK ($REMOTE/$NAME)"
fi

# --- Retención ---------------------------------------------------------------

log "Borrando respaldos locales de más de $BACKUP_RETENTION_DAYS días"
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'porteria-*.dump' -o -name 'porteria-*.dump.sha256' \) \
	-mtime "+$BACKUP_RETENTION_DAYS" -delete

if [[ "$OFFSITE_CONFIGURED" == true ]]; then
	log "Borrando respaldos remotos de más de $BACKUP_RETENTION_DAYS días"
	rclone_remote delete "backup:$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX" \
		--include 'porteria-*.dump*' \
		--min-age "${BACKUP_RETENTION_DAYS}d" || log "AVISO: no se pudo aplicar la retención remota."
fi

log "Respaldo terminado"
