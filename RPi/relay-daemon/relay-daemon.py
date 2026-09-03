import json
import signal
import sys
import threading
import time

import paho.mqtt.client as mqtt

try:
    import gpiozero
except ImportError:
    print("ERROR: gpiozero not installed. Run: pip install gpiozero")
    sys.exit(1)

try:
    import yaml
except ImportError:
    print("ERROR: pyyaml not installed. Run: pip install pyyaml")
    sys.exit(1)


def load_config(path="config.yaml"):
    with open(path, "r") as f:
        return yaml.safe_load(f)


class RelayDaemon:
    def __init__(self, config):
        self.config = config
        self.building_id = config["building_id"]
        self.relays = {}
        self.timers = {}

        for idx, rcfg in config["relays"].items():
            pin = rcfg["gpio_pin"]
            self.relays[idx] = gpiozero.DigitalOutputDevice(
                pin, active_high=True, initial_value=False
            )
            print(f"  Relay {idx}: {rcfg['label']} (GPIO {pin})")

        self.mqtt_client = mqtt.Client(
            client_id=config["mqtt"].get("client_id", f"porteria-{self.building_id}")
        )
        self.mqtt_client.on_connect = self._on_connect
        self.mqtt_client.on_message = self._on_message

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"[MQTT] Connected to {self.config['mqtt']['host']}")
            topic = f"porteria/{self.building_id}/relay/+/set"
            client.subscribe(topic)
            print(f"[MQTT] Subscribed to {topic}")
            self._publish_all_status()
        else:
            print(f"[MQTT] Connection failed with code {rc}")

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
        except json.JSONDecodeError:
            print(f"[MQTT] Invalid JSON: {msg.payload}")
            return

        parts = msg.topic.split("/")
        if len(parts) < 5:
            return

        try:
            relay_idx = int(parts[3])
        except (ValueError, IndexError):
            return

        if relay_idx not in self.relays:
            print(f"[Relay] Unknown relay index: {relay_idx}")
            return

        state = payload.get("state")
        duration_ms = payload.get("durationMs")
        request_id = payload.get("requestId", "unknown")

        relay = self.relays[relay_idx]

        if state == "ON":
            relay.on()
            print(f"[Relay] {relay_idx} ON (request: {request_id})")
            if duration_ms:
                self._cancel_timer(relay_idx)
                timer = threading.Timer(duration_ms / 1000.0, self._relay_off, args=[relay_idx])
                self.timers[relay_idx] = timer
                timer.start()

        elif state == "OFF":
            self._cancel_timer(relay_idx)
            relay.off()
            print(f"[Relay] {relay_idx} OFF (request: {request_id})")

        elif state == "TOGGLE":
            self._cancel_timer(relay_idx)
            relay.toggle()
            new_state = "ON" if relay.value else "OFF"
            print(f"[Relay] {relay_idx} TOGGLE -> {new_state} (request: {request_id})")

        self._publish_status(relay_idx)

    def _relay_off(self, relay_idx):
        if relay_idx in self.relays:
            self.relays[relay_idx].off()
        self.timers.pop(relay_idx, None)
        print(f"[Relay] {relay_idx} OFF (timer)")
        self._publish_status(relay_idx)

    def _cancel_timer(self, relay_idx):
        timer = self.timers.pop(relay_idx, None)
        if timer:
            timer.cancel()

    def _publish_status(self, relay_idx):
        state = "ON" if self.relays[relay_idx].value else "OFF"
        topic = f"porteria/{self.building_id}/relay/{relay_idx}/status"
        payload = json.dumps({"state": state, "timestamp": int(time.time() * 1000)})
        self.mqtt_client.publish(topic, payload, qos=1)

    def _publish_all_status(self):
        for idx in self.relays:
            self._publish_status(idx)

    def start(self):
        host = self.config["mqtt"]["host"]
        port = self.config["mqtt"].get("port", 1883)

        while True:
            try:
                self.mqtt_client.connect(host, port, keepalive=60)
                self.mqtt_client.loop_start()
                return
            except OSError as e:
                print(f"[MQTT] Connection failed ({e}), retrying in 5s...")
                time.sleep(5)

    def stop(self):
        print("\n[Daemon] Shutting down...")
        for idx, timer in self.timers.items():
            timer.cancel()
        self.mqtt_client.loop_stop()
        self.mqtt_client.disconnect()
        for idx, relay in self.relays.items():
            relay.close()
        print("[Daemon] Cleanup complete")


def main():
    config = load_config()
    daemon = RelayDaemon(config)

    def sig_handler(signum, frame):
        daemon.stop()
        sys.exit(0)

    signal.signal(signal.SIGTERM, sig_handler)
    signal.signal(signal.SIGINT, sig_handler)

    print(f"Porteria Relay Daemon — {config['building_id']}")
    daemon.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        daemon.stop()


if __name__ == "__main__":
    main()
