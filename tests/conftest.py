import pytest

from game import question_deck


@pytest.fixture(autouse=True)
def isolated_deck(tmp_path, monkeypatch):
    """Fragen-Stapel der Tests nicht in data/ schreiben."""
    monkeypatch.setattr(question_deck, "DECK_PATH", str(tmp_path / "question_decks.json"))
