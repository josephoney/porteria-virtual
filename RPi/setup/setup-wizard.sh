#!/bin/bash

export TERM=linux
export NCURSES_NO_UTF8_ACS=1

CONFIG_FILE="/opt/porteria/config.env"
FLAG_FILE="/opt/porteria/.configured"
RELAY_DIR="/opt/porteria/relay-daemon"
KIOSK_DIR="/opt/porteria/kiosk"
SETUP_DIR="/opt/porteria/setup"
BACKTITLE="Porteria Virtual — Configuracion Inicial"

# Salir si ya esta configurado SOLO cuando se invoca sin terminal
# (caso del systemd service en boot). Si hay terminal, es re-configuracion
# manual del usuario y se permite entrar.
if [ -f "$FLAG_FILE" ] && [ ! -t 0 ]; then
    exit 0
fi

if ! command -v whiptail &>/dev/null; then
    echo "ERROR: whiptail not found. Install with: sudo apt install whiptail"
    exit 1
fi

# ─────────────────────────────────────────────
# Detectar usuario real (no root)
# ─────────────────────────────────────────────
if [ -n "$SUDO_USER" ]; then
    REAL_USER="$SUDO_USER"
    REAL_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
elif [ "$(id -u)" -eq 0 ]; then
    REAL_USER="pi"
    REAL_HOME="/home/pi"
else
    REAL_USER="$(whoami)"
    REAL_HOME="$HOME"
fi

sudo mkdir -p "$RELAY_DIR" "$KIOSK_DIR" "$SETUP_DIR"

# ─────────────────────────────────────────────
# Variables de estado (persisten entre submenus)
# ─────────────────────────────────────────────
SERVER_IP="${SERVER_IP:-192.168.1.100}"
BUILDING_ID="${BUILDING_ID:-edificio-01}"
BUILDING_NAME="${BUILDING_NAME:-EDIFICIO PRINCIPAL}"
RELAY_COUNT="${RELAY_COUNT:-1}"
DEFAULT_PINS=(17 18 27 22)
DEFAULT_LABELS=("Puerta Principal" "Porton" "Luz Hall" "Alarma")

# Pre-cargar config actual si existe (re-configuracion: muestra los
# valores guardados como defaults en vez de los de fabrica)
if [ -f "$CONFIG_FILE" ]; then
    # shellcheck disable=SC1090
    . "$CONFIG_FILE"
    SERVER_IP="${SERVER_IP:-192.168.1.100}"
    BUILDING_ID="${BUILDING_ID:-edificio-01}"
    BUILDING_NAME="${BUILDING_NAME:-EDIFICIO PRINCIPAL}"
    RELAY_COUNT="${RELAY_COUNT:-1}"
fi

for i in 1 2 3 4; do
    idx=$((i-1))
    # El config.env guarda RELAY_${i}_LABEL/GPIO; el wizard usa
    # RELAY_LABEL_${i}/RELAY_PIN_${i} — mapear si vinieron de config.env
    saved_label="RELAY_${i}_LABEL"
    saved_pin="RELAY_${i}_GPIO"
    varname_label="RELAY_LABEL_${i}"
    varname_pin="RELAY_PIN_${i}"
    eval "${varname_label}=\"${!varname_label:-${!saved_label:-${DEFAULT_LABELS[$idx]}}}\""
    eval "${varname_pin}=\"${!varname_pin:-${!saved_pin:-${DEFAULT_PINS[$idx]}}}\""
done

# ─────────────────────────────────────────────
# Funciones de utilidad
# ─────────────────────────────────────────────
inputbox() {
    local title="$1" text="$2" default="$3"
    local result
    result=$(whiptail --backtitle "$BACKTITLE" --title "$title" \
        --inputbox "$text" 14 60 "$default" 3>&1 1>&2 2>&3)
    echo "$result"
}

msg() {
    whiptail --backtitle "$BACKTITLE" --title "$1" --msgbox "$2" 10 50
}

yesno() {
    whiptail --backtitle "$BACKTITLE" --title "$1" --yesno "$2" 10 50
    return $?
}

# ─────────────────────────────────────────────
# Submenus
# ─────────────────────────────────────────────
config_network() {
    while true; do
        choice=$(inputbox "Tipo de Conexion" \
            "Seleccione como se conecta al servidor:\n\n\
  1. WiFi\n\
  2. Ethernet (cable de red)\n\n\
Ingrese el numero:" "1")
        case "$choice" in
            1|wifi|WiFi) config_wifi; return ;;
            2|ethernet|Ethernet) msg "Ethernet" "Usando conexion por cable de red."; return ;;
            "") return ;;
            *) msg "Error" "Ingrese 1 o 2." ;;
        esac
    done
}

config_wifi() {
    command -v nmcli &>/dev/null || {
        msg "Error" "nmcli no encontrado.\n\nInstalelo con:\nsudo apt install network-manager"
        return
    }

    whiptail --backtitle "$BACKTITLE" --title "Escaneando WiFi" \
        --infobox "Buscando redes disponibles..." 8 50

    wifi_raw=$(nmcli -t -f SSID,SIGNAL device wifi list 2>/dev/null | sort -t: -k2 -nr | awk -F: '!seen[$1]++')

    if [ -z "$wifi_raw" ]; then
        msg "Error" "No se encontraron redes WiFi."
        return
    fi

    local i=1 menu="" 
    declare -a arr
    while IFS=: read -r ssid signal; do
        arr[$i]="$ssid"
        menu="${menu}  ${i}. ${ssid}  (senal: ${signal}%)\n"
        i=$((i+1))
    done <<< "$wifi_raw"
    menu="${menu}\n  0. Ingresar SSID manualmente"
    local total=$((i-1))

    while true; do
        choice=$(inputbox "Redes WiFi" \
            "Redes encontradas:\n\n${menu}\n\nIngrese numero (1-${total}) o 0:" "1")
        [ -z "$choice" ] && return

        if [ "$choice" = "0" ]; then
            local ssid
            ssid=$(inputbox "SSID Manual" "Ingrese el nombre de la red WiFi:" "")
            [ -z "$ssid" ] && continue
        elif [ "$choice" -ge 1 ] 2>/dev/null && [ "$choice" -le "$total" ]; then
            local ssid="${arr[$choice]}"
        else
            msg "Error" "Numero invalido."
            continue
        fi

        local pass
        pass=$(whiptail --backtitle "$BACKTITLE" --title "Contrasena WiFi" \
            --passwordbox "Contrasena para '$ssid':" 10 50 3>&1 1>&2 2>&3)
        [ -z "$pass" ] && continue

        whiptail --backtitle "$BACKTITLE" --title "Conectando" \
            --infobox "Conectando a '$ssid'..." 8 50

        if sudo nmcli device wifi connect "$ssid" password "$pass" 2>/dev/null; then
            msg "Conectado" "WiFi conectado a '$ssid' exitosamente."
            return
        else
            msg "Error" "No se pudo conectar. Verifique la contrasena."
        fi
    done
}

config_server() {
    while true; do
        SERVER_IP=$(inputbox "Servidor" \
            "IP o hostname del servidor PorteriaVirtual:\n\n\
Ej: 192.168.1.100   (red local)\n\
Ej: 100.xxx.xxx.xxx (Tailscale)\n\n\
Actual: ${SERVER_IP}" \
            "$SERVER_IP")
        [ -z "$SERVER_IP" ] && return

        whiptail --backtitle "$BACKTITLE" --title "Probando" \
            --infobox "Haciendo ping a $SERVER_IP..." 8 50

        if ping -c 3 -W 2 "$SERVER_IP" >/dev/null 2>&1; then
            msg "Servidor OK" "$SERVER_IP responde correctamente."
            return
        else
            msg "No Alcanzable" "No se pudo contactar a $SERVER_IP.\nVerifique la IP."
        fi
    done
}

config_building() {
    BUILDING_ID=$(inputbox "Edificio ID" \
        "ID unico para este kiosk (sin espacios):\n\nActual: ${BUILDING_ID}" \
        "$BUILDING_ID")
    [ -z "$BUILDING_ID" ] && BUILDING_ID="edificio-01"

    BUILDING_NAME=$(inputbox "Edificio Nombre" \
        "Nombre que se muestra en el kiosk:\n\nActual: ${BUILDING_NAME}" \
        "$BUILDING_NAME")
    [ -z "$BUILDING_NAME" ] && BUILDING_NAME="EDIFICIO PRINCIPAL"
}

config_relays() {
    while true; do
        choice=$(inputbox "Cantidad de Relays" \
            "Relays conectados a la RPi:\n\n\
  1 = Uno (puerta)\n\
  2 = Dos (puerta + porton)\n\
  3 = Tres (puerta + porton + luz)\n\
  4 = Cuatro (puerta + porton + luz + alarma)\n\n\
Actual: ${RELAY_COUNT}" \
            "$RELAY_COUNT")
        case "$choice" in
            1|2|3|4) RELAY_COUNT="$choice"; break ;;
            "") return ;;
            *) msg "Error" "Ingrese un numero del 1 al 4." ;;
        esac
    done

    for i in $(seq 1 "$RELAY_COUNT"); do
        local vname="RELAY_LABEL_${i}"
        local vpin="RELAY_PIN_${i}"
        local curr_label="${!vname}"
        local curr_pin="${!vpin}"

        local new_label
        new_label=$(inputbox "Relay $i — Nombre" \
            "Nombre del relay $i:\n\nActual: ${curr_label}" \
            "$curr_label")
        [ -n "$new_label" ] && eval "${vname}=${new_label}"

        local new_pin
        new_pin=$(inputbox "Relay $i — GPIO" \
            "Pin GPIO BCM para relay $i:\n\nActual: ${curr_pin}" \
            "$curr_pin")
        [ -n "$new_pin" ] && eval "${vpin}=${new_pin}"
    done
}

test_connection() {
    whiptail --backtitle "$BACKTITLE" --title "Probando" \
        --infobox "Ping a ${SERVER_IP}..." 8 50
    local ping_ok=false
    ping -c 3 -W 2 "$SERVER_IP" >/dev/null 2>&1 && ping_ok=true

    whiptail --backtitle "$BACKTITLE" --title "Probando" \
        --infobox "Verificando MQTT en ${SERVER_IP}:1883..." 8 50
    local mqtt_ok=false
    timeout 3 bash -c "echo >/dev/tcp/${SERVER_IP}/1883" 2>/dev/null && mqtt_ok=true

    local result="Resultados:\n\n\
  Ping a ${SERVER_IP}:  $($ping_ok && echo 'OK' || echo 'FALLO')\n\
  MQTT ${SERVER_IP}:1883: $($mqtt_ok && echo 'OK' || echo 'FALLO')\n\n"

    if $ping_ok && $mqtt_ok; then
        result="${result}Todo correcto."
    else
        result="${result}Verifique que el servidor este encendido\n\
y los puertos accesibles."
    fi

    msg "Test de Conectividad" "$result"
}

show_summary() {
    local s="Resumen actual:\n\n\
  Servidor:       ${SERVER_IP}\n\
  Edificio ID:    ${BUILDING_ID}\n\
  Edificio:       ${BUILDING_NAME}\n\
  Relays:         ${RELAY_COUNT}\n"
    for i in $(seq 1 "$RELAY_COUNT"); do
        local vname="RELAY_LABEL_${i}"
        local vpin="RELAY_PIN_${i}"
        s="${s}    Relay ${i}: ${!vname} (GPIO ${!vpin})\n"
    done
    msg "Resumen" "$s"
}

apply_and_finish() {
    if ! yesno "Confirmar" "Desea aplicar la configuracion y finalizar?\n\n\
Esto instalara los servicios y configurara\n\
el modo kiosk automatico."; then
        return
    fi

    whiptail --backtitle "$BACKTITLE" --title "Aplicando" \
        --infobox "Guardando configuracion..." 8 50

    # Guardar config.env
    sudo tee "$CONFIG_FILE" > /dev/null << EOF
SERVER_IP=${SERVER_IP}
BUILDING_ID=${BUILDING_ID}
BUILDING_NAME="${BUILDING_NAME}"
MQTT_HOST=${SERVER_IP}
MQTT_PORT=1883
KIOSK_URL=https://${SERVER_IP}/kiosk/
RELAY_COUNT=${RELAY_COUNT}
EOF
    for i in $(seq 1 "$RELAY_COUNT"); do
        local vname="RELAY_LABEL_${i}"
        local vpin="RELAY_PIN_${i}"
        echo "RELAY_${i}_LABEL=\"${!vname}\"" | sudo tee -a "$CONFIG_FILE" > /dev/null
        echo "RELAY_${i}_GPIO=${!vpin}"      | sudo tee -a "$CONFIG_FILE" > /dev/null
    done

    # Politica managed de Chromium: auto-otorga camara/mic al kiosk sin
    # prompt (solo funciona en kiosk mode). Se regenera con cada IP.
    sudo mkdir -p /etc/chromium/policies/managed
    sudo tee /etc/chromium/policies/managed/porteria-media.json > /dev/null << POLICY_EOF
{
  "VideoCaptureAllowedUrls": ["https://${SERVER_IP}/*"],
  "AudioCaptureAllowedUrls": ["https://${SERVER_IP}/*"]
}
POLICY_EOF

    # Generar config.yaml para relay daemon
    sudo tee "${RELAY_DIR}/config.yaml" > /dev/null << YAML_EOF
mqtt:
  host: ${SERVER_IP}
  port: 1883
  client_id: ${BUILDING_ID}

building_id: ${BUILDING_ID}

relays:
YAML_EOF
    for i in $(seq 1 "$RELAY_COUNT"); do
        local vname="RELAY_LABEL_${i}"
        local vpin="RELAY_PIN_${i}"
        sudo tee -a "${RELAY_DIR}/config.yaml" > /dev/null << YAML_ENTRY
  ${i}:
    gpio_pin: ${!vpin}
    label: "${!vname}"
YAML_ENTRY
    done

    # ── Instalar archivos ──
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    INSTALL_OK=true

    find_src() {
        for candidate in "$@"; do
            [ -f "$candidate" ] && { echo "$candidate"; return 0; }
        done
        return 1
    }

    # Relay daemon .py
    SRC=$(find_src "${REPO_ROOT}/relay-daemon/relay-daemon.py" \
                   "${SCRIPT_DIR}/relay-daemon.py" \
                   "$SETUP_DIR/relay-daemon.py")
    if [ -n "$SRC" ]; then
        sudo cp "$SRC" "$RELAY_DIR/"
    else
        whiptail --backtitle "$BACKTITLE" --title "Advertencia" \
            --msgbox "No se encontro relay-daemon.py entre los archivos fuente.\nEl daemon de relays no se instalara." 10 50
        INSTALL_OK=false
    fi

    # Relay systemd service
    SRC=$(find_src "${REPO_ROOT}/relay-daemon/porteria-relay.service" \
                   "${SCRIPT_DIR}/porteria-relay.service" \
                   "$SETUP_DIR/porteria-relay.service")
    if [ -n "$SRC" ]; then
        sudo cp "$SRC" /etc/systemd/system/porteria-relay.service
        sudo systemctl daemon-reload
        sudo systemctl enable porteria-relay 2>/dev/null || true
    else
        whiptail --backtitle "$BACKTITLE" --title "Advertencia" \
            --msgbox "No se encontro porteria-relay.service.\nEl daemon de relays no se iniciara automaticamente." 10 50
        INSTALL_OK=false
    fi

    # Kiosk script
    SRC=$(find_src "${REPO_ROOT}/kiosk-autostart/kiosk.sh" \
                   "${SCRIPT_DIR}/kiosk.sh" \
                   "$SETUP_DIR/kiosk.sh")
    if [ -n "$SRC" ]; then
        sudo cp "$SRC" "$KIOSK_DIR/"
        sudo chmod +x "${KIOSK_DIR}/kiosk.sh"
    else
        whiptail --backtitle "$BACKTITLE" --title "Advertencia" \
            --msgbox "No se encontro kiosk.sh.\nEl modo kiosk no se configurara." 10 50
        INSTALL_OK=false
    fi

    # Autostart — USAR HOME DEL USUARIO REAL, NO ROOT
    SRC=$(find_src "${REPO_ROOT}/kiosk-autostart/wayfire.ini" \
                   "${SCRIPT_DIR}/wayfire.ini")
    if [ -n "$SRC" ]; then
        sudo -u "$REAL_USER" mkdir -p "${REAL_HOME}/.config"
        sudo cp "$SRC" "${REAL_HOME}/.config/wayfire.ini"
        sudo chown "${REAL_USER}:${REAL_USER}" "${REAL_HOME}/.config/wayfire.ini"
    fi

    SRC=$(find_src "${REPO_ROOT}/kiosk-autostart/labwc-autostart" \
                   "${SCRIPT_DIR}/labwc-autostart")
    if [ -n "$SRC" ]; then
        sudo -u "$REAL_USER" mkdir -p "${REAL_HOME}/.config/labwc"
        sudo cp "$SRC" "${REAL_HOME}/.config/labwc/autostart"
        sudo chown -R "${REAL_USER}:${REAL_USER}" "${REAL_HOME}/.config/labwc"
    fi

    # Probar relay daemon
    if [ -f "${RELAY_DIR}/relay-daemon.py" ]; then
        timeout 5 python3 "${RELAY_DIR}/relay-daemon.py" > /tmp/relay-test.log 2>&1 || true
    fi

    # Marcar como configurado
    sudo touch "$FLAG_FILE"

    whiptail --backtitle "$BACKTITLE" --title "Configuracion Completa" \
        --msgbox "La configuracion ha finalizado.\n\n\
Al reiniciar, la RPi iniciara en modo kiosk\n\
conectandose a ${SERVER_IP}.\n\n\
Para re-configurar:\n\
  sudo rm ${FLAG_FILE} && sudo reboot" 14 60

    if yesno "Reiniciar" "Desea reiniciar ahora?"; then
        sudo reboot
    fi
}

# ─────────────────────────────────────────────
# MENU PRINCIPAL
# ─────────────────────────────────────────────
welcome_shown=false
while true; do
    if ! $welcome_shown; then
        whiptail --backtitle "$BACKTITLE" --title "Bienvenido" \
            --msgbox "Asistente de configuracion Porteria Virtual.\n\n\
Configure cada seccion en el orden que prefiera.\n\
Use 'Aplicar y Finalizar' cuando termine.\n\n\
Necesita un teclado USB conectado." 13 50
        welcome_shown=true
    fi

    MENU_CHOICE=$(inputbox "Menu Principal" \
        "Seleccione una opcion:\n\n\
  1. Configurar Red (WiFi/Ethernet)\n\
  2. Configurar Servidor (IP)\n\
  3. Configurar Edificio (ID y nombre)\n\
  4. Configurar Relays (GPIO)\n\
  5. Probar Conectividad\n\
  6. Ver Resumen\n\
  7. Aplicar y Finalizar\n\n\
  0. Salir sin guardar" \
        "")

    case "$MENU_CHOICE" in
        1) config_network ;;
        2) config_server ;;
        3) config_building ;;
        4) config_relays ;;
        5) test_connection ;;
        6) show_summary ;;
        7) apply_and_finish
           [ -f "$FLAG_FILE" ] && exit 0 ;;
        0) yesno "Salir" "Desea salir sin guardar cambios?" && exit 0 ;;
        "") ;;  # Cancel, volver a mostrar menu
        *) msg "Error" "Opcion invalida. Ingrese un numero del 0 al 7." ;;
    esac
done
