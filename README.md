# Konsensomat — Die Demokratiemaschine

*Zwei Personen. Eine Frage. Zwei Minuten Zeit, um sich zu einigen — sonst ist das Spiel vorbei. **Konsensomat — Die Demokratiemaschine** macht Demokratie zum Erlebnis.*

---

Abstimmen ist einfach. Sich einigen ist schwerer. Bei **Konsensomat — Die Demokratiemaschine** treten zwei Personen an physischen Abstimmstationen gegeneinander an. Sind sie einer Meinung? Punkt. Nicht? Dann tickt die Uhr: zwei Minuten, um durch Diskutieren, Argumentieren und Verhandeln einen Konsens zu finden — oder das Spiel ist aus. Eine interaktive Installation von KidsLab für alle ab 10 Jahren.

---

Demokratie bedeutet mehr als Abstimmen — sie lebt von Debatte, dem Mut zur eigenen Meinung, und der Stärke, einen Kompromiss zu finden. Denn ein Kompromiss ist kein Verlieren: Er ist das Ergebnis echter Auseinandersetzung, gegenseitigen Zuhörens und gemeinsamen Denkens — und damit eine der wichtigsten Fähigkeiten in einer demokratischen Gesellschaft.

**Konsensomat — Die Demokratiemaschine** macht genau das erfahrbar: Zwei Teilnehmende stehen sich an physischen Abstimmstationen gegenüber und beantworten eine Frage mit Ja oder Nein. Sind sie einig, geht das Spiel weiter. Sind sie es nicht, tickt die Uhr — zwei Minuten, um durch echtes Gespräch einen Konsens zu finden. Gelingt das nicht: Game Over.

Die interaktive Installation von KidsLab ist inspiriert von Adam J. Scarboroughs „The Democracy Machine!" und für alle ab 10 Jahren konzipiert. Keine Vorkenntnisse nötig — nur die Bereitschaft, zuzuhören.

---

### Für Schulveranstaltungen

Was bedeutet es, sich zu einigen? Und was passiert, wenn man es nicht schafft? **Konsensomat — Die Demokratiemaschine** ist eine spielerische Installation, bei der Schülerinnen und Schüler demokratische Grundprinzipien am eigenen Leib erleben: Abstimmen, Diskutieren, Überzeugen — und manchmal auch Nachgeben. In kurzen Spielrunden à zwei Minuten wird spürbar, was Demokratie im Kern bedeutet: nicht Einigkeit um jeden Preis, sondern der Prozess, der dorthin führt. Entwickelt von KidsLab gGmbH, Augsburg.

---

## Technik

### Architektur

- **Backend:** Python (Flask + Flask-SocketIO) — Game-Server, Admin-UI und API in einem Prozess
- **Frontend:** Vanilla HTML/CSS/JS mit WebSocket (Socket.IO) für Echtzeit-Spielstatus
- **Zielplattform:** Raspberry Pi (Bookworm, Wayfire/Wayland) im Kiosk-Modus
- **Paketmanager:** [uv](https://docs.astral.sh/uv/)

### Steuerung

Tastenbelegung (konfigurierbar in `game_config.json`):

| Spieler | Ja | Nein |
|---------|-----|------|
| Spieler 1 | `1` | `2` |
| Spieler 2 | `8` | `9` |

Später ersetzbar durch GPIO, USB-Arcade-Encoder oder ESP32 — die Spiellogik ist von der Eingabequelle entkoppelt.

### Spielablauf

```
START → Frage anzeigen → 10s Abstimmung
  EINIG     → +1 Punkt → nächste Frage
  UNEINIG   → Buzzer → 120s Debatte (jederzeit neu abstimmen)
    → Einigung vor Ablauf → +1 Punkt → nächste Frage
    → Keine Einigung      → Game Over
ENDE → Punktestand → Neustart möglich
```

---

## Entwicklung

### Voraussetzungen

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (Paketmanager)

### Starten

```bash
uv sync                    # Dependencies installieren
uv run python app.py       # Server starten auf Port 5001
```

Dann im Browser öffnen:
- **Spiel:** http://localhost:5001
- **Admin:** http://localhost:5001/admin

### Konfiguration

Alle Einstellungen in `game_config.json`:

```json
{
  "keys": { ... },
  "timers": {
    "voting_seconds": 10,
    "debate_seconds": 120,
    "transition_seconds": 10,
    "questions_per_game": 5
  },
  "server": {
    "port": 5001,
    "debug": true
  }
}
```

---

## Raspberry Pi Installation

### Voraussetzungen

- Raspberry Pi (empfohlen: Pi 4 oder Pi 5)
- Raspberry Pi OS **Bookworm** (nutzt labwc/Wayland)
- Bildschirm/Monitor angeschlossen
- Repository geklont nach `~/Konsensomat`

### Einmal-Setup

```bash
cd ~/Konsensomat
bash scripts/install.sh
sudo reboot
```

Das Install-Script macht folgendes:
1. Installiert System-Pakete (`wtype`, `curl`)
2. Installiert `uv` falls nicht vorhanden
3. Installiert Python-Dependencies (`uv sync`)
4. Setzt `debug: false` in `game_config.json`
5. Richtet den **systemd-Service** ein (Flask-Server startet automatisch)
6. Richtet den **Hotspot-Fallback** ein (eigenes WLAN bei fehlender Verbindung)
7. Konfiguriert **labwc-Autostart** für Chromium im Kiosk-Modus
8. Deaktiviert Bildschirmschoner/DPMS

### Boot-Ablauf

```
[Boot]
  ├── systemd → Flask-Server (Port 5001)
  ├── systemd → Hotspot-Check (nach NetworkManager)
  │     └── Kein WLAN? → Hotspot "Konsensomat" aufmachen
  └── labwc autostart → kiosk.sh → wartet auf Server → Chromium --kiosk
```

### Fallback-Hotspot

Wenn der Pi beim Boot kein bekanntes WLAN findet, öffnet er automatisch einen eigenen Hotspot:

| | |
|---|---|
| **SSID** | `Konsensomat` |
| **Passwort** | `kidslab` |
| **IP des Pi** | `192.168.4.1` |

Verbinden und dann Admin-UI aufrufen: **http://192.168.4.1:5001/admin**

Sobald ein bekanntes WLAN konfiguriert ist und beim nächsten Boot gefunden wird, verbindet sich der Pi normal und der Hotspot bleibt aus.

### Services verwalten

```bash
# Flask-Server Status
sudo systemctl status einig-oder-aus

# Server neu starten
sudo systemctl restart einig-oder-aus

# Logs anzeigen
journalctl -u einig-oder-aus -f

# Hotspot-Status
sudo systemctl status einig-hotspot
```

### Kiosk-Modus debuggen

```bash
# labwc-Autostart prüfen
cat ~/.config/labwc/autostart

# Chromium manuell im Kiosk starten
bash ~/Konsensomat/scripts/kiosk.sh
```

### Aktualisieren

```bash
cd ~/Konsensomat
git pull
uv sync
sudo systemctl restart einig-oder-aus
```

---

## Projektstruktur

```
Konsensomat/
├── app.py                  # Flask-Server Einstiegspunkt
├── config.py               # Konfigurations-Accessors
├── game_config.json        # Laufzeit-Konfiguration
├── game/                   # Spiellogik (State Machine)
├── web/                    # Routes, Socket-Events, Templates
├── static/                 # CSS, JS, Bilder, Sounds
├── questions/              # Fragen als Markdown (nach Kategorie)
└── scripts/
    ├── install.sh              # Einmal-Setup auf dem Pi
    ├── einig-oder-aus.service  # systemd-Unit (Flask-Server)
    ├── einig-hotspot.service   # systemd-Unit (Hotspot-Fallback)
    ├── hotspot.sh              # Hotspot-Logik
    └── kiosk.sh                # Chromium Kiosk-Launcher
```

---

## Lizenz & Credits

Eine interaktive Installation von [KidsLab gGmbH](https://kidslab.de), Augsburg.
Inspiriert von Adam J. Scarboroughs „The Democracy Machine!".

- **Gregor Walter** — Programmierung & Konzept ([gregor@kidslab.de](mailto:gregor@kidslab.de))
- **Daniel Greiser** — Hardware & Installation ([daniel@kidslab.de](mailto:daniel@kidslab.de))


