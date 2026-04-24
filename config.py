import json
import os

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "game_config.json")


def _load():
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def _save(data):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def auto_online() -> bool:
    return os.environ.get("AUTO_ONLINE", "0") == "1"


def get_all() -> dict:
    data = _load()
    data["auto_online"] = auto_online()
    return data


def update(section: str, values: dict):
    """Update a config section (keys, timers, server) and persist."""
    data = _load()
    if section in data:
        data[section].update(values)
        _save(data)
    return data


# Convenience accessors (read on each access so runtime changes work)
def voting_time() -> int:
    return _load()["timers"]["voting_seconds"]


def debate_time() -> int:
    return _load()["timers"]["debate_seconds"]


def transition_time() -> int:
    return _load()["timers"].get("transition_seconds", 10)


def questions_per_game() -> int:
    return _load()["timers"].get("questions_per_game", 5)


def end_screen_time() -> int:
    return _load()["timers"].get("end_screen_seconds", 30)


def port() -> int:
    return _load()["server"]["port"]


def debug() -> bool:
    return _load()["server"]["debug"]


def key_map() -> dict:
    """Return key config as {key_string: (player_id, vote_string)} mapping."""
    keys = _load()["keys"]
    return {
        keys["player1_ja"]: (1, "ja"),
        keys["player1_nein"]: (1, "nein"),
        keys["player2_ja"]: (2, "ja"),
        keys["player2_nein"]: (2, "nein"),
    }


# Legacy constants for backward compatibility during transition
VOTING_TIME = get_all()["timers"]["voting_seconds"]
DEBATE_TIME = get_all()["timers"]["debate_seconds"]
PORT = get_all()["server"]["port"]
DEBUG = get_all()["server"]["debug"]
