#!/usr/bin/env bash
# Actualiza el stack de staging: trae el código, reconstruye lo que cambió y
# reemplaza los contenedores. Pensado para correr en el servidor desde la raíz
# del repo.
#
#   bash deploy/update.sh
#
# Requiere que .env.staging exista en la raíz (no se versiona).

set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILE=docker-compose.staging.yml
ENV_FILE=${ENV_FILE:-.env.staging}

if [[ ! -f "$ENV_FILE" ]]; then
	echo "Falta $ENV_FILE. Copiá .env.staging.example y completá los secretos." >&2
	exit 1
fi

echo "==> Trayendo cambios"
git pull --ff-only

echo "==> Construyendo y levantando"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

# Cada rebuild deja la imagen anterior ocupando disco. Con 52 GB alcanza para
# mucho, pero es mejor no descubrirlo cuando el disco esté lleno.
echo "==> Limpiando imágenes sin uso"
docker image prune -f

echo "==> Estado"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps --format '{{.Service}} {{.Status}}'
