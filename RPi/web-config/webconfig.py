#!/usr/bin/env python3
"""
Porteria Virtual — Web de configuracion del kiosk.

Accesible en http://192.168.1.1/ conectando una notebook al puerto
ethernet de la RPi (IP fija + DHCP por dnsmasq).

Permite configurar:
  - Nombre del kiosko (BUILDING_NAME)
  - ID del kiosko/edificio (BUILDING_ID)
  - IP del servidor (SERVER_IP / KIOSK_URL)
  - Red WiFi (si esta disponible)

Escribe /opt/porteria/config.env + config.yaml, conecta la WiFi y
reinicia. Usa solo la stdlib de Python + pyyaml (ya instalado).
"""

import json
import os
import re
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import yaml

CONFIG_FILE = "/opt/porteria/config.env"
CONFIG_YAML = "/opt/porteria/relay-daemon/config.yaml"
FLAG_FILE = "/opt/porteria/.configured"
CHROMIUM_POLICY = "/etc/chromium/policies/managed/porteria-media.json"
HOST = "0.0.0.0"
PORT = 80

# Solo se permite configurar desde el puerto ethernet del kiosk
# (192.168.1.0/24). El acceso por WiFi/red publica es rechazado.
CONFIG_SUBNET = "192.168.1."

DEFAULT_RELAYS = {1: {"gpio_pin": 17, "label": "Puerta Principal"}}
RELAY_LINE_RE = re.compile(r"^RELAY_\d+_(LABEL|GPIO)=")


def write_chromium_policy(server_ip):
    """Auto-otorga camara/mic al kiosk SIN prompt (politica managed de Chromium).

    En modo kiosk, VideoCaptureAllowedUrls/AudioCaptureAllowedUrls otorgan
    acceso sin preguntar. El archivo se regenera cada vez que cambia la IP.
    """
    policy = {
        "VideoCaptureAllowedUrls": [f"https://{server_ip}/*"],
        "AudioCaptureAllowedUrls": [f"https://{server_ip}/*"],
    }
    try:
        os.makedirs(os.path.dirname(CHROMIUM_POLICY), exist_ok=True)
        with open(CHROMIUM_POLICY, "w", encoding="utf-8") as f:
            json.dump(policy, f, indent=2)
    except OSError as e:
        print(f"[web-config] ADVERTENCIA: no se pudo escribir politica Chromium: {e}")


# ─────────────────────────────────────────────
# Lectura / escritura de config
# ─────────────────────────────────────────────
def read_env():
    cfg = {"server_ip": "", "building_id": "", "building_name": ""}
    if not os.path.exists(CONFIG_FILE):
        return cfg
    try:
        with open(CONFIG_FILE, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                v = v.strip().strip('"').strip("'")
                if k == "SERVER_IP":
                    cfg["server_ip"] = v
                elif k == "BUILDING_ID":
                    cfg["building_id"] = v
                elif k == "BUILDING_NAME":
                    cfg["building_name"] = v
    except OSError:
        pass
    return cfg


def write_env(server_ip, building_name, building_id):
    lines = [
        "# Porteria Virtual — Configuracion generada por web-config",
        f"SERVER_IP={server_ip}",
        f"BUILDING_ID={building_id}",
        f'BUILDING_NAME="{building_name}"',
        f"MQTT_HOST={server_ip}",
        "MQTT_PORT=1883",
        f"KIOSK_URL=https://{server_ip}/kiosk/",
    ]
    # Preservar relays ya definidos
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, encoding="utf-8") as f:
            for line in f:
                if RELAY_LINE_RE.match(line.strip()):
                    lines.append(line.strip())
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def write_yaml(server_ip, building_id):
    data = {}
    if os.path.exists(CONFIG_YAML):
        try:
            with open(CONFIG_YAML, encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
        except (OSError, yaml.YAMLError):
            data = {}
    data.setdefault("mqtt", {})["host"] = server_ip
    data["mqtt"]["port"] = 1883
    data["mqtt"]["client_id"] = building_id
    data["building_id"] = building_id
    data.setdefault("relays", dict(DEFAULT_RELAYS))
    os.makedirs(os.path.dirname(CONFIG_YAML), exist_ok=True)
    with open(CONFIG_YAML, "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, default_flow_style=False, allow_unicode=True)


# ─────────────────────────────────────────────
# Red
# ─────────────────────────────────────────────
def scan_wifi():
    try:
        out = subprocess.run(
            ["nmcli", "-t", "-f", "SSID,SIGNAL", "device", "wifi", "list"],
            capture_output=True, text=True, timeout=15,
        ).stdout
        seen = {}
        for line in out.splitlines():
            ssid, _, signal = line.rpartition(":")
            if ssid:
                seen.setdefault(ssid, signal)
        nets = [{"ssid": s, "signal": sig} for s, sig in seen.items()]
        nets.sort(key=lambda n: -int(n["signal"] or 0))
        return nets
    except Exception:
        return []


def connect_wifi(ssid, password):
    cmd = ["nmcli", "device", "wifi", "connect", ssid]
    if password:
        cmd += ["password", password]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return r.returncode == 0
    except Exception:
        return False


def reboot_later():
    time.sleep(2)
    try:
        subprocess.run(["reboot"], timeout=10)
    except Exception:
        subprocess.run(["sudo", "reboot"], timeout=10)


# ─────────────────────────────────────────────
# Servidor HTTP
# ─────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[web-config] %s\n" % (fmt % args))

    def _send(self, code, body, ctype="text/html; charset=utf-8"):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _allowed(self):
        """Solo se configura desde el puerto ethernet (192.168.1.0/24)."""
        client = self.client_address[0]
        return client.startswith(CONFIG_SUBNET)

    def do_GET(self):
        if not self._allowed():
            self._send(403, "Acceso restringido al puerto ethernet de configuracion")
            return
        if self.path in ("/", "/index.html"):
            self._send(200, HTML)
        elif self.path == "/api/status":
            self._send(200, json.dumps({
                "config": read_env(),
                "networks": scan_wifi(),
            }), "application/json")
        else:
            self._send(404, "Not found")

    def do_POST(self):
        if not self._allowed():
            self._send(403, "Acceso restringido al puerto ethernet de configuracion")
            return
        if self.path == "/api/save":
            self._save()
        elif self.path == "/api/reboot":
            threading.Thread(target=reboot_later, daemon=True).start()
            self._send(200, json.dumps({"ok": True}), "application/json")
        else:
            self._send(404, "Not found")

    def _save(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            self._send(400, json.dumps({"error": "JSON invalido"}), "application/json")
            return

        server_ip = str(data.get("server_ip", "")).strip()
        building_name = str(data.get("building_name", "")).strip() or "EDIFICIO PRINCIPAL"
        building_id = str(data.get("building_id", "")).strip() or "edificio-01"
        wifi_ssid = str(data.get("wifi_ssid", "")).strip()
        wifi_password = str(data.get("wifi_password", ""))

        if not re.match(r"^[\w.\-]+$", server_ip):
            self._send(400, json.dumps({"error": "IP de servidor invalida"}),
                       "application/json")
            return

        write_env(server_ip, building_name, building_id)
        write_yaml(server_ip, building_id)
        write_chromium_policy(server_ip)

        wifi_ok = True
        if wifi_ssid:
            wifi_ok = connect_wifi(wifi_ssid, wifi_password)

        # Marcar configurado y reiniciar
        try:
            with open(FLAG_FILE, "w"):
                pass
        except OSError:
            pass

        threading.Thread(target=reboot_later, daemon=True).start()
        self._send(200, json.dumps({"ok": True, "wifi_ok": wifi_ok}),
                   "application/json")


HTML = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Porteria Virtual — Configuracion del Kiosk</title>
<style>
  :root {
    --bg: #0a0c0f; --surface: #111318; --border: #1e2229;
    --accent: #00e5a0; --accent2: #0077ff; --danger: #ff3b5c;
    --text: #e8eaed; --muted: #8a93a6;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--text);
    font-family: 'Segoe UI', system-ui, sans-serif;
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; width: 100%; max-width: 460px; padding: 28px;
  }
  h1 { font-size: 20px; letter-spacing: 2px; margin-bottom: 4px; }
  .sub { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
  label { display: block; font-size: 13px; color: var(--muted); margin: 16px 0 6px; }
  input[type=text], input[type=password], select {
    width: 100%; padding: 10px 12px; background: var(--bg);
    border: 1px solid var(--border); border-radius: 6px; color: var(--text);
    font-size: 14px;
  }
  input:focus, select:focus { outline: none; border-color: var(--accent); }
  .row { display: flex; gap: 8px; }
  .row select { flex: 1; }
  .btn {
    margin-top: 24px; width: 100%; padding: 14px; border: none; border-radius: 6px;
    background: var(--accent); color: #06251c; font-size: 16px; font-weight: 600;
    cursor: pointer;
  }
  .btn:hover { filter: brightness(1.1); }
  .btn:disabled { opacity: 0.5; cursor: wait; }
  .btn-scan {
    padding: 10px 14px; border: 1px solid var(--border); border-radius: 6px;
    background: var(--bg); color: var(--accent2); cursor: pointer; white-space: nowrap;
    font-size: 13px;
  }
  .btn-scan:hover { border-color: var(--accent2); }
  #msg { margin-top: 16px; font-size: 13px; color: var(--accent2); min-height: 18px; }
  #msg.err { color: var(--danger); }
  .hint { font-size: 12px; color: var(--muted); margin-top: 6px; }
</style>
</head>
<body>
  <div class="card">
    <h1>PORTERIA VIRTUAL</h1>
    <div class="sub">Configuracion inicial del kiosk</div>

    <label for="building_name">Nombre del kiosko</label>
    <input type="text" id="building_name" placeholder="EDIFICIO PRINCIPAL" />

    <label for="building_id">ID del kiosko / edificio</label>
    <input type="text" id="building_id" placeholder="edificio-01" />

    <label for="server_ip">Direccion del servidor (IP)</label>
    <input type="text" id="server_ip" placeholder="192.168.2.7" />

    <label for="wifi_ssid">Red WiFi (opcional)</label>
    <div class="row">
      <select id="wifi_ssid"></select>
      <button class="btn-scan" onclick="scan()">Escanear</button>
    </div>
    <div class="hint">Si deja vacio, se mantiene la conexion por cable (ethernet).</div>

    <label for="wifi_password">Contrasena WiFi</label>
    <input type="password" id="wifi_password" placeholder="" />

    <button class="btn" id="saveBtn" onclick="save()">Guardar y Reiniciar</button>
    <div id="msg"></div>
  </div>

<script>
function $(id) { return document.getElementById(id); }

function msg(text, err) {
  var el = $('msg');
  el.textContent = text;
  el.className = err ? 'err' : '';
}

async function loadStatus() {
  try {
    var r = await fetch('/api/status');
    var s = await r.json();
    $('building_name').value = s.config.building_name || '';
    $('building_id').value = s.config.building_id || '';
    $('server_ip').value = s.config.server_ip || '';
    fillNetworks(s.networks || []);
  } catch (e) {
    msg('No se pudo cargar el estado.', true);
  }
}

function fillNetworks(networks) {
  var sel = $('wifi_ssid');
  sel.innerHTML = '<option value="">— Seleccionar —</option>';
  networks.forEach(function(n) {
    var o = document.createElement('option');
    o.value = n.ssid;
    o.textContent = n.ssid + ' (' + n.signal + '%)';
    sel.appendChild(o);
  });
}

async function scan() {
  msg('Escaneando redes WiFi...');
  try {
    var r = await fetch('/api/status');
    var s = await r.json();
    fillNetworks(s.networks || []);
    msg('Redes actualizadas.');
  } catch (e) {
    msg('No se pudo escanear.', true);
  }
}

async function save() {
  var btn = $('saveBtn');
  btn.disabled = true;
  msg('Guardando y reiniciando...');
  try {
    var body = {
      server_ip: $('server_ip').value,
      building_name: $('building_name').value,
      building_id: $('building_id').value,
      wifi_ssid: $('wifi_ssid').value,
      wifi_password: $('wifi_password').value
    };
    var r = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var res = await r.json();
    if (!r.ok) { msg(res.error || 'Error', true); btn.disabled = false; return; }
    if (body.wifi_ssid && !res.wifi_ok) {
      msg('Configurado, pero fallo la conexion WiFi. Reiniciando...', true);
    } else {
      msg('Configurado. Reiniciando en unos segundos...');
    }
  } catch (e) {
    msg('Error al guardar.', true);
    btn.disabled = false;
  }
}

loadStatus();
</script>
</body>
</html>
"""


def main():
    print(f"[web-config] Escuchando en {HOST}:{PORT} (http://192.168.1.1/)")
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    srv.serve_forever()


if __name__ == "__main__":
    main()