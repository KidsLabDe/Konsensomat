from game import question_deck
from game.models import Question


def make_questions(count: int) -> list[Question]:
    return [Question(text=f"Frage {i}?", category="test") for i in range(count)]


def test_no_repeats_until_deck_exhausted():
    questions = make_questions(25)
    seen = []
    for _ in range(5):
        seen += [q.text for q in question_deck.draw("test", questions, 5)]
    assert len(seen) == 25
    assert len(set(seen)) == 25


def test_reshuffle_avoids_previous_game():
    questions = make_questions(25)
    for _ in range(50):
        previous = {q.text for q in question_deck.draw("test", questions, 5)}
        current = {q.text for q in question_deck.draw("test", questions, 5)}
        assert not previous & current


def test_partial_deck_is_refilled():
    questions = make_questions(7)
    first = {q.text for q in question_deck.draw("test", questions, 5)}
    second = [q.text for q in question_deck.draw("test", questions, 5)]
    assert len(second) == 5
    assert len(set(second)) == 5
    # Die 2 übrigen Fragen kommen garantiert vor den bereits gezogenen
    assert {q.text for q in questions} - first <= set(second)


def test_categories_have_separate_decks():
    a = make_questions(5)
    b = [Question(text=f"B {i}?", category="b") for i in range(5)]
    question_deck.draw("a", a, 5)
    assert len(question_deck.draw("b", b, 5)) == 5


def test_removed_questions_are_ignored():
    questions = make_questions(10)
    question_deck.draw("test", questions, 5)
    fewer = questions[:3]
    drawn = question_deck.draw("test", fewer, 5)
    assert len(drawn) == 3
    assert {q.text for q in drawn} == {q.text for q in fewer}


def test_more_requested_than_available():
    questions = make_questions(3)
    drawn = question_deck.draw("test", questions, 5)
    assert sorted(q.text for q in drawn) == sorted(q.text for q in questions)
