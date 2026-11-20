#!/usr/bin/env bash
# Utilidades compartidas por los scripts de deploy. No se ejecuta solo: se sourcea.
#
#   source "$(dirname "$0")/_common.sh"
#
# Deja definidos REPO_ROOT, COMPOSE_FILE, ENV_FILE, compose() y log().

if [[ -n "${_PORTERIA_COMMON_LOADED:-}" ]]; then
	return 0
fi
_PORTERIA_COMMON_LOADED=1

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

# El archivo de entorno es el que distingue un servidor de otro: cada uno tiene
# exactamente uno. Se resuelve primero y de ahí sale el compose por defecto.
if [[ -z "${ENV_FILE:-}" ]]; then
	for candidate in ".env.staging" "deploy/.env.production" ".env.production"; do
		if [[ -f "$candidate" ]]; then
			ENV_FILE=$candidate
			break
		fi
	done
fi

if [[ -z "${ENV_FILE:-}" || ! -f "$ENV_FILE" ]]; then
	echo "No encuentro el archivo de entorno. Pasá ENV_FILE=..." >&2
	exit 1
fi

if [[ -z "${COMPOSE_FILE:-}" ]]; then
	if [[ "$(basename "$ENV_FILE")" == ".env.staging" ]]; then
		COMPOSE_FILE=docker-compose.staging.yml
	else
		for candidate in deploy/docker-compose.prod.yml docker-compose.prod.yml; do
			if [[ -f "$candidate" ]]; then
				COMPOSE_FILE=$candidate
				break
			fi
		done
	fi
fi

if [[ -z "${COMPOSE_FILE:-}" || ! -f "$COMPOSE_FILE" ]]; then
	echo "No encuentro el compose. Pasá COMPOSE_FILE=..." >&2
	exit 1
fi

# Docker Compose resuelve --env-file relativo al directorio actual, así que se
# guardan rutas absolutas para que el script funcione desde cualquier lado.
COMPOSE_FILE=$(cd "$(dirname "$COMPOSE_FILE")" && pwd)/$(basename "$COMPOSE_FILE")
ENV_FILE=$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")

compose() {
	docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

log() {
	local line
	line="[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
	echo "$line"
	if [[ -n "${LOG_FILE:-}" ]]; then
		echo "$line" >>"$LOG_FILE"
	fi
}
