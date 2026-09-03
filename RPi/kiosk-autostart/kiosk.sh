#!/bin/bash

CONFIG_FILE="/opt/porteria/config.env"
FLAG_FILE="/opt/porteria/.configured"

# Detectar binario de Chromium:
#   Bookworm/RPi OS 2023+: 'chromium'   (ya no existe chromium-browser)
#   Imagenes legacy:                    'chromium-browser'
CHROMIUM_BIN=""
for bin in chromium chromium-browser; do
    if command -v "$bin" >/dev/null 2>&1; then
        CHROMIUM_BIN="$bin"
        break
    fi
done

if [ -z "$CHROMIUM_BIN" ]; then
    echo "[Kiosk] ERROR: Chromium no encontrado. Instalar: sudo apt install chromium"
    exit 1
fi
echo "[Kiosk] Usando binario: $CHROMIUM_BIN"

if [ ! -f "$FLAG_FILE" ]; then
    echo "[Kiosk] RPi no configurada. Para ejecutar el asistente:"
    echo "        sudo rm -f $FLAG_FILE && sudo reboot"
    echo "[Kiosk] Usando URL por defecto mientras tanto..."
    KIOSK_URL="https://192.168.1.100/kiosk/"
else
    source "$CONFIG_FILE"
    KIOSK_URL="${KIOSK_URL:-https://${SERVER_IP}/kiosk/}"
fi

echo "[Kiosk] Iniciando — URL: ${KIOSK_URL}"

# Esperar a que haya red (max 60s). Sin esto Chromium arranca
# antes de que la red este lista y muestra error.
echo "[Kiosk] Esperando red activa..."
for i in $(seq 1 30); do
    if nm-online -q 2>/dev/null; then
        echo "[Kiosk] Red activa."
        break
    fi
    sleep 2
done

while true; do
    "$CHROMIUM_BIN" \
        --kiosk \
        --noerrdialogs \
        --disable-infobars \
        --no-first-run \
        --disable-session-crashed-bubble \
        --disable-pinch \
        --overscroll-history-navigation=0 \
        --hide-scrollbars \
        --check-for-update-interval=31536000 \
        --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' \
        --ignore-certificate-errors \
        "$KIOSK_URL"

    echo "[Kiosk] Chromium exited, restarting in 3s..."
    sleep 3
done