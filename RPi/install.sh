#!/bin/bash
#
# Porteria Virtual — Instalacion inicial en Raspberry Pi
#
# Uso:
#   Copiar el contenido del repositorio (o este directorio RPi/) a la RPi
#   y ejecutar una sola vez:
#
#       sudo bash install.sh
#
# Este script:
#   1. Instala dependencias de sistema (whiptail, network-manager, chromium)
#      y Python (paho-mqtt, gpiozero, pyyaml) — soporta Bookworm/PEP 668.
#   2. Copia setup/, kiosk-autostart/ y relay-daemon/ a /opt/porteria/.
#   3. Instala y habilita los servicios porteria-setup y porteria-relay.
#   4. Configura el autostart del compositor detectado (Wayfire/LabWC).
#
# Luego reiniciar: en el primer boot aparece el wizard en tty1 para
# configurar IP del servidor, edificio y relays.

set -u

BACKTITLE="Porteria Virtual — Instalacion"

# ─────────────────────────────────────────────
# Detectar usuario real (no root)
# ─────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: Ejecutar como root: sudo bash install.sh"
    exit 1
fi

if [ -n "${SUDO_USER:-}" ]; then
    REAL_USER="$SUDO_USER"
    REAL_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
else
    # En Bookworm ya no existe el usuario "pi" por defecto
    REAL_USER="pi"
    REAL_HOME="/home/pi"
    if getent passwd "$REAL_USER" >/dev/null 2>&1; then
        REAL_USER="$(getent passwd "$REAL_USER" | cut -d: -f1)"
    fi
fi

if [ ! -d "$REAL_HOME" ]; then
    REAL_USER="$(ls /home 2>/dev/null | head -1)"
    [ -n "$REAL_USER" ] && REAL_HOME="/home/$REAL_USER"
fi

echo "[1/5] Usuario detectado: $REAL_USER ($REAL_HOME)"

# ─────────────────────────────────────────────
# Directorios destino
# ─────────────────────────────────────────────
SETUP_DIR="/opt/porteria/setup"
KIOSK_DIR="/opt/porteria/kiosk"
RELAY_DIR="/opt/porteria/relay-daemon"
# Direccion del directorio RPi/ (donde vive este script), con fallback
# a la ruta completa dentro del repo si se copio solo este archivo.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RPI_DIR="$SCRIPT_DIR"
[ -d "$RPI_DIR/setup" ] || RPI_DIR="$(cd "$SCRIPT_DIR/RPi" 2>/dev/null && pwd)"

echo "[2/5] Instalando dependencias de sistema..."

export DEBIAN_FRONTEND=noninteractive

# Paquetes apt
APT_PKGS="whiptail network-manager chromium python3-paho-mqtt python3-gpiozero python3-yaml"
if ! apt-get update -y >/dev/null 2>&1; then
    echo "ERROR: apt-get update fallo. Verifique conectividad a internet."
    exit 1
fi

apt-get install -y $APT_PKGS || {
    # Fallback: chromium-browser en imagenes legacy
    apt-get install -y whiptail network-manager python3-paho-mqtt python3-gpiozero python3-yaml chromium-browser || {
        echo "ERROR: No se pudieron instalar los paquetes. Revise el output de apt."
        exit 1
    }
}

# ─────────────────────────────────────────────
# Copiar archivos a /opt/porteria
# ─────────────────────────────────────────────
echo "[3/5] Copiando archivos a /opt/porteria/..."

mkdir -p "$SETUP_DIR" "$KIOSK_DIR" "$RELAY_DIR"

find_src() {
    for candidate in "$@"; do
        [ -f "$candidate" ] && { echo "$candidate"; return 0; }
    done
    return 1
}

# setup wizard
SRC=$(find_src "${RPI_DIR}/setup/setup-wizard.sh")
if [ -n "$SRC" ]; then
    cp "$SRC" "$SETUP_DIR/"
    chmod +x "$SETUP_DIR/setup-wizard.sh"
else
    echo "ADVERTENCIA: setup-wizard.sh no encontrado."
fi

# setup systemd service
SRC=$(find_src "${RPI_DIR}/setup/porteria-setup.service")
if [ -n "$SRC" ]; then
    cp "$SRC" /etc/systemd/system/porteria-setup.service
else
    echo "ADVERTENCIA: porteria-setup.service no encontrado."
fi

# kiosk script
SRC=$(find_src "${RPI_DIR}/kiosk-autostart/kiosk.sh")
if [ -n "$SRC" ]; then
    cp "$SRC" "$KIOSK_DIR/"
    chmod +x "$KIOSK_DIR/kiosk.sh"
else
    echo "ADVERTENCIA: kiosk.sh no encontrado."
fi

# relay daemon
SRC=$(find_src "${RPI_DIR}/relay-daemon/relay-daemon.py")
if [ -n "$SRC" ]; then
    cp "$SRC" "$RELAY_DIR/"
else
    echo "ADVERTENCIA: relay-daemon.py no encontrado."
fi

# relay systemd service
SRC=$(find_src "${RPI_DIR}/relay-daemon/porteria-relay.service")
if [ -n "$SRC" ]; then
    cp "$SRC" /etc/systemd/system/porteria-relay.service
else
    echo "ADVERTENCIA: porteria-relay.service no encontrado."
fi

# config.yaml por defecto (el wizard la regenera al configurar)
SRC=$(find_src "${RPI_DIR}/relay-daemon/config.yaml")
if [ -n "$SRC" ]; then
    cp "$SRC" "$RELAY_DIR/"
fi

# ─────────────────────────────────────────────
# Autostart del compositor detectado
# ─────────────────────────────────────────────
echo "[4/5] Detectando compositor..."

mkdir -p "${REAL_HOME}/.config"

detect_wayfire=false
detect_labwc=false

command -v wayfire >/dev/null 2>&1 && detect_wayfire=true
command -v labwc    >/dev/null 2>&1 && detect_labwc=true

# Autostart generico Wayfire
SRC=$(find_src "${RPI_DIR}/kiosk-autostart/wayfire.ini")
if $detect_wayfire && [ -n "$SRC" ]; then
    cp "$SRC" "${REAL_HOME}/.config/wayfire.ini"
    chown -R "${REAL_USER}:${REAL_USER}" "${REAL_HOME}/.config/wayfire.ini"
    echo "      -> Wayfire autostart instalado"
fi

# Autostart LabWC
SRC=$(find_src "${RPI_DIR}/kiosk-autostart/labwc-autostart")
if $detect_labwc && [ -n "$SRC" ]; then
    mkdir -p "${REAL_HOME}/.config/labwc"
    cp "$SRC" "${REAL_HOME}/.config/labwc/autostart"
    chown -R "${REAL_USER}:${REAL_USER}" "${REAL_HOME}/.config/labwc"
    echo "      -> LabWC autostart instalado"
fi

if ! $detect_wayfire && ! $detect_labwc; then
    echo "      -> Ningun compositor detectado (Wayfire/LabWC)."
    echo "         Si usa Raspberry Pi OS Desktop (Bookworm), deberia tener wayfire."
    echo "         Para Raspberry Pi OS Lite debe configurar un compositor manualmente."
fi

# ─────────────────────────────────────────────
# Habilitar servicios
# ─────────────────────────────────────────────
echo "[5/5] Habilitando servicios..."

systemctl daemon-reload
systemctl enable porteria-setup 2>/dev/null || true
systemctl enable porteria-relay 2>/dev/null || true

# ─────────────────────────────────────────────
# Mensaje final
# ─────────────────────────────────────────────
echo ""
echo "=============================================="
echo " Instalacion completada."
echo ""
echo " Reinicie la RPi. En el primer boot aparecera"
echo " el wizard de configuracion en tty1 (necesita"
echo " teclado USB). Configure IP del servidor,"
echo " edificio y relays."
echo ""
echo " Para re-ejecutar el wizard despues de"
echo " configurar:"
echo "   sudo rm /opt/porteria/.configured"
echo "   sudo reboot"
echo "=============================================="