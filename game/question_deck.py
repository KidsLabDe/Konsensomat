"""Fragen-Stapel pro Kategorie: Ziehen ohne Zurücklegen über mehrere Spiele.

Jede Frage einer Kategorie kommt genau einmal dran, bevor neu gemischt wird.
Der Stand wird in data/question_decks.json gespeichert und übersteht Neustarts.
"""

import json
import os
import random
import threading

from game.models import Question

DECK_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "question_decks.json")

ALL_CATEGORIES_KEY = "__alle__"

_lock = threading.Lock()


def _load_state() -> dict:
    if not os.path.exists(DECK_PATH):
        return {}
    try:
        with open(DECK_PATH, encoding="utf-8") as f:
            state = json.load(f)
        return state if isinstance(state, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save_state(state: dict):
    os.makedirs(os.path.dirname(DECK_PATH), exist_ok=True)
    tmp_path = DECK_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp_path, DECK_PATH)


def draw(category: str | None, questions: list[Question], n: int) -> list[Question]:
    """Draw n questions for a game without repeating until the deck is exhausted.

    When the deck runs out mid-draw, it is reshuffled; questions from the end
    of the previous round are placed last so they don't come back right away.
    """
    by_text = {q.text: q for q in questions}
    available = list(by_text)
    n = min(n, len(available))
    key = category or ALL_CATEGORIES_KEY

    with _lock:
        state = _load_state()
        deck = state.get(key, {})
        # Fragen, die inzwischen aus dem Katalog entfernt wurden, ignorieren
        drawn = [t for t in deck.get("drawn", []) if t in by_text]

        pool = [t for t in available if t not in drawn]
        random.shuffle(pool)
        picked = pool[:n]
        drawn += picked

        if len(picked) < n:
            # Stapel leer: neu mischen, gerade gezogene Fragen zuletzt
            recent = set(drawn[-n:])
            pool = [t for t in available if t not in picked]
            random.shuffle(pool)
            pool.sort(key=lambda t: t in recent)
            refill = pool[:n - len(picked)]
            picked += refill
            drawn = refill
            random.shuffle(picked)

        state[key] = {"drawn": drawn}
        _save_state(state)

    return [by_text[t] for t in picked]
