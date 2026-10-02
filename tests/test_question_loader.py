import os
import tempfile

import config
from game.question_loader import _parse_md, load, list_categories


def test_parse_md_extracts_questions():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write("# Title\n\nSome text.\n\n- Ist das eine Frage?\n- Kein Fragezeichen\n- Noch eine Frage?\n")
        f.flush()
        questions = _parse_md(f.name, "test")
    os.unlink(f.name)
    assert len(questions) == 2
    assert questions[0].text == "Ist das eine Frage?"
    assert questions[0].category == "test"
    assert questions[1].text == "Noch eine Frage?"


def test_parse_md_ignores_non_questions():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write("- Not a question\n## Header?\n- A question?\n")
        f.flush()
        questions = _parse_md(f.name, "test")
    os.unlink(f.name)
    assert len(questions) == 1
    assert questions[0].text == "A question?"


def test_list_categories_returns_sorted():
    categories = list_categories()
    assert categories == sorted(categories)
    assert "Alltag & Gesellschaft" in categories
    assert "Schule & Jugend (10–14 Jahre)" in categories


def test_load_all_categories():
    questions = load()
    assert len(questions) > 0
    categories = {q.category for q in questions}
    assert "Alltag & Gesellschaft" in categories
    assert "Schule & Jugend (10–14 Jahre)" in categories


def test_load_single_category():
    questions = load("Alltag & Gesellschaft")
    assert len(questions) > 0
    assert all(q.category == "Alltag & Gesellschaft" for q in questions)


def test_every_category_fills_a_game():
    for category in list_categories():
        assert len(load(category)) >= config.questions_per_game(), category


def test_load_nonexistent_category():
    questions = load("nonexistent")
    assert questions == []
