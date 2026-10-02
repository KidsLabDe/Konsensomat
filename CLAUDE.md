# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Konsensomat — Die Demokratiemaschine** is an interactive physical installation by KidsLab gGmbH (Augsburg). Two players answer yes/no questions at voting stations. Agreement = point. Disagreement = 2-minute debate timer — reach consensus or game over.

Target: Raspberry Pi running full-screen Chromium kiosk, standalone without internet.

## Development Commands

```bash
uv sync                    # Install dependencies
uv run python app.py       # Start server (port 5001)
uv run pytest tests/       # Run all tests
uv run pytest tests/test_state_machine.py -k "test_name"  # Single test
```

URLs: Game at `/`, Admin at `/admin`, Audio test at `/audiotest`

## Tech Stack

- **Backend:** Python 3.11+ (Flask + Flask-SocketIO), package manager: uv
- **Frontend:** Vanilla HTML/CSS/JS, Socket.IO for real-time state, GSAP for animations
- **Hardware controller:** CircuitPython on Raspberry Pi Pico (`taster/code.py`)

## Architecture

Single Flask process serves game UI, admin UI, API, and static files. All game state flows through one path:

```
GameStateMachine (Python) → Socket.IO "game_state" event → game.js → DOM updates
```

### Key Modules

- `app.py` — Flask app factory, creates SocketIO instance
- `game/state_machine.py` — `GameStateMachine` class: state transitions, timers (threading-based), scoring
- `game/models.py` — Enums (`GamePhase`, `Vote`, `GameMode`), dataclasses (`Player`, `Question`, `GameSession`)
- `game/question_loader.py` — Parses markdown question files from `questions/`
- `game/stats.py` — Persistent stats in `data/stats.json`, thread-safe
- `web/routes.py` — Flask routes (pages + REST API)
- `web/socket_events.py` — Socket.IO event handlers, `KeyboardInputHandler` maps keys to (player, vote)
- `config.py` — Reads `game_config.json` (keys, timers, server settings)

### Frontend

- `static/js/game.js` — Main game loop, listens to `game_state` events, manages screen visibility
- `static/js/input.js` — Keyboard input with combo detection, emits `keypress` via Socket.IO
- `static/js/audio.js` — `AudioManager` for sound effects
- `static/js/animations.js` + `animation-scenes.js` — GSAP animation utilities and phase-specific scenes
- `templates/game.html` — Single page with screens: idle, transition, voting, debate, game_over, score_screen

### Socket.IO Events

| Direction | Event | Payload | Purpose |
|-----------|-------|---------|---------|
| Server→Client | `game_state` | Full state dict | Every state change |
| Server→Client | `menu_action` | Button press info | Category navigation in IDLE |
| Client→Server | `keypress` | `{key}` | Keyboard/button input |
| Client→Server | `start_game` | `{category}` | Begin game with selected category |
| Client→Server | `restart_game` | — | Return to IDLE |

### Game State Machine

States: `IDLE` → `TRANSITION` (10s) → `VOTING` (10s) → `DEBATE` (120s) → `GAME_OVER` → `SCORE_SCREEN` → `IDLE`

- Match during VOTING: +10 points, next question
- Agreement during DEBATE: +100 points, next question
- Timeout during DEBATE: Game Over
- SCORE_SCREEN auto-returns to IDLE after 30s

### Input Abstraction

Key bindings configured in `game_config.json`. Default development keys:
- Player 1: `1` = Ja, `2` = Nein
- Player 2: `8` = Ja, `9` = Nein

Physical buttons use CircuitPython on Pico sending HID keycodes.

### Question Format

Markdown in `questions/`. Two supported formats:
1. **Catalog file** (`.md` with `## Category` headers, numbered questions `1. Question?`)
2. **Directory-based** (subdirectories = categories, `.md` files with `- Question?` lines)

## Configuration

All runtime config in `game_config.json`: key bindings, timer durations, `questions_per_game`, server port, debug flag. Editable via admin UI at `/admin`.

## REST API Endpoints

- `GET /api/categories` — List question categories
- `GET /api/state` — Current game state
- `GET /api/config` — Current configuration
- `GET /api/stats` — Game statistics summary

## Language

Documentation is in German. Code uses a mix of German and English — follow existing conventions per file.

## Raspberry Pi Deployment

```bash
bash scripts/install.sh    # One-time setup (systemd services, kiosk autostart, hotspot)
sudo systemctl restart einig-oder-aus  # Restart server
journalctl -u einig-oder-aus -f        # View logs
```

Fallback hotspot: SSID `Konsensomat`, password `kidslab`, admin at `http://192.168.4.1:5001/admin`.
