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

echo "[1/6] Usuario detectado: $REAL_USER ($REAL_HOME)"

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

echo "[2/6] Instalando dependencias de sistema..."

export DEBIAN_FRONTEND=noninteractive

# Paquetes apt
APT_PKGS="whiptail network-manager chromium dnsmasq python3-paho-mqtt python3-gpiozero python3-yaml"
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
echo "[3/6] Copiando archivos a /opt/porteria/..."

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

# web config (pagina de configuracion via ethernet 192.168.1.1)
WEB_DIR="/opt/porteria/web-config"
mkdir -p "$WEB_DIR"
SRC=$(find_src "${RPI_DIR}/web-config/webconfig.py")
if [ -n "$SRC" ]; then
    cp "$SRC" "$WEB_DIR/"
    chmod +x "$WEB_DIR/webconfig.py"
else
    echo "ADVERTENCIA: webconfig.py no encontrado."
fi

SRC=$(find_src "${RPI_DIR}/web-config/porteria-webconfig.service")
if [ -n "$SRC" ]; then
    cp "$SRC" /etc/systemd/system/porteria-webconfig.service
else
    echo "ADVERTENCIA: porteria-webconfig.service no encontrado."
fi

# ─────────────────────────────────────────────
# Autostart del compositor detectado
# ─────────────────────────────────────────────
echo "[4/6] Detectando compositor..."

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
# Deshabilitar plymouth (splash screen)
# ─────────────────────────────────────────────
echo "   -> Deshabilitando plymouth (splash screen)..."

# El wizard bloquea el boot antes del display-manager; plymouth-quit-wait
# queda esperando el splash y se cuelga. Para un kiosk el splash sobra.
systemctl mask plymouth.service plymouth-quit-wait.service 2>/dev/null || true

# Ademas, desactivar via kernel cmdline (a prueba de futuras unidades)
CMDLINE_FILE="/boot/cmdline.txt"
if [ -f "$CMDLINE_FILE" ]; then
    if ! grep -q "plymouth.enable=0" "$CMDLINE_FILE"; then
        sed -i 's/$/ plymouth.enable=0/' "$CMDLINE_FILE"
        echo "      -> plymouth.enable=0 agregado a $CMDLINE_FILE"
    fi
fi

# ─────────────────────────────────────────────
# Puerto ethernet de configuracion (IP fija 192.168.1.1)
# ─────────────────────────────────────────────
echo "[5/6] Configurando puerto ethernet (192.168.1.1)..."

# IP fija en la interfaz ethernet del kiosk. El instalador conecta una
# notebook con cable y accede a http://192.168.1.1/ para configurar.
ETH_IF=$(nmcli -t -f DEVICE,TYPE device 2>/dev/null | awk -F: '$2=="ethernet" {print $1; exit}')
if [ -z "$ETH_IF" ]; then
    ETH_IF="eth0"
    echo "      -> No se detecto interfaz ethernet via nmcli; usando eth0"
fi
echo "      -> Interfaz ethernet: $ETH_IF"

# Desactivar autoconnect de la conexion ethernet por defecto (si existe)
# para que no compita con la IP estatica del puerto de configuracion.
DEFAULT_CONN=$(nmcli -t -f NAME,TYPE con show 2>/dev/null | awk -F: '$2=="802-3-ethernet" {print $1; exit}')
if [ -n "$DEFAULT_CONN" ]; then
    nmcli con modify "$DEFAULT_CONN" connection.autoconnect no 2>/dev/null || true
    echo "      -> Autoconnect desactivado en: $DEFAULT_CONN"
fi

# Conexion NetworkManager con IP fija. NO se trae arriba durante el install
# (evita cortar la sesion/internet actual); se activa en el proximo boot.
nmcli con delete porteria-config 2>/dev/null || true
nmcli con add type ethernet con-name porteria-config ifname "$ETH_IF" \
    ipv4.method manual ipv4.addresses 192.168.1.1/24 ipv6.method disabled \
    connection.autoconnect yes connection.autoconnect-priority 100 \
    2>/dev/null || echo "      -> ADVERTENCIA: no se pudo crear la conexion estatica"

# DNSMASQ: servidor DHCP en el puerto ethernet para que la notebook del
# instalador obtenga IP automaticamente (192.168.1.100+)
cat > /etc/dnsmasq.d/porteria-config.conf << EOF
interface=$ETH_IF
bind-interfaces
dhcp-range=192.168.1.100,192.168.1.200,255.255.255.0,12h
EOF

# dnsmasq solo debe servir DHCP en la interfaz de configuracion; evitar
# que interfiera con la red WiFi principal. Se habilita (arranca en boot).
systemctl enable dnsmasq 2>/dev/null || true
echo "      -> dnsmasq habilitado (DHCP 192.168.1.100-200 en $ETH_IF)"

# ─────────────────────────────────────────────
# Habilitar servicios
# ─────────────────────────────────────────────
echo "[6/6] Habilitando servicios..."

systemctl daemon-reload
systemctl enable porteria-setup 2>/dev/null || true
systemctl enable porteria-relay 2>/dev/null || true
systemctl enable porteria-webconfig 2>/dev/null || true

# ─────────────────────────────────────────────
# Mensaje final
# ─────────────────────────────────────────────
echo ""
echo "=============================================="
echo " Instalacion completada."
echo ""
echo " Reinicie la RPi. Hay DOS formas de configurar:"
echo ""
echo " 1) WEB (recomendado, sin monitor):"
echo "    Conecte una notebook al puerto ethernet"
echo "    con cable y abra:  http://192.168.1.1/"
echo "    (la notebook obtiene IP automaticamente)"
echo ""
echo " 2) Terminal (tty1, requiere teclado USB):"
echo "    En el primer boot aparece el wizard"
echo "    de configuracion."
echo ""
echo " Para re-configurar despues de instalar:"
echo "   - Web: vuelva a conectar al ethernet 192.168.1.1"
echo "   - Terminal: sudo rm /opt/porteria/.configured"
echo "               sudo reboot"
echo "=============================================="