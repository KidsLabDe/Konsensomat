import time
import threading
from unittest.mock import MagicMock, patch

from game.models import GamePhase, Vote
from game.state_machine import GameStateMachine


def make_machine(questions_count=5) -> GameStateMachine:
    """Create a machine with a mock callback and patched question loading.

    Starts game and skips through TRANSITION to VOTING so tests
    can focus on game logic.
    """
    callback = MagicMock()
    machine = GameStateMachine(on_state_change=callback)
    from game.models import Question
    questions = [Question(text=f"Frage {i}?", category="test") for i in range(questions_count)]
    with patch("game.state_machine.load", return_value=questions):
        machine.start_game("test")
    # Skip transition to get to voting
    _skip_transition(machine)
    return machine


def _skip_transition(machine: GameStateMachine):
    """If machine is in TRANSITION, fast-forward to VOTING."""
    if machine.session.phase == GamePhase.TRANSITION:
        machine._cancel_timer()
        machine._on_transition_done()


def _skip_transition_if_needed(machine: GameStateMachine):
    """After agreement advances to next question, skip the transition."""
    if machine.session.phase == GamePhase.TRANSITION:
        machine._cancel_timer()
        machine._on_transition_done()


def test_start_game_enters_transition():
    """start_game now goes to TRANSITION first."""
    callback = MagicMock()
    machine = GameStateMachine(on_state_change=callback)
    from game.models import Question
    questions = [Question(text="Q?", category="test")]
    with patch("game.state_machine.load", return_value=questions):
        machine.start_game("test")
    assert machine.session.phase == GamePhase.TRANSITION


def test_transition_leads_to_voting():
    m = make_machine()
    assert m.session.phase == GamePhase.VOTING
    assert m.session.current_question is not None


def test_matching_votes_score_and_advance():
    m = make_machine()
    m.register_vote(1, Vote.JA)
    m.register_vote(2, Vote.JA)
    assert m.session.score == 10
    # After agreement, enters transition for next question
    _skip_transition_if_needed(m)
    assert m.session.phase == GamePhase.VOTING
    assert m.session.current_question_index == 1


def test_mismatching_votes_enter_debate():
    m = make_machine()
    m.register_vote(1, Vote.JA)
    m.register_vote(2, Vote.NEIN)
    assert m.session.phase == GamePhase.DEBATE
    assert m.session.score == 0


def test_agreement_during_debate():
    m = make_machine()
    # Force mismatch
    m.register_vote(1, Vote.JA)
    m.register_vote(2, Vote.NEIN)
    assert m.session.phase == GamePhase.DEBATE

    # Now agree during debate — worth 100 points
    m.register_vote(1, Vote.JA)
    m.register_vote(2, Vote.JA)
    assert m.session.score == 100
    _skip_transition_if_needed(m)
    assert m.session.phase == GamePhase.VOTING
    assert m.session.current_question_index == 1


def test_disagreement_during_debate_resets_votes():
    m = make_machine()
    m.register_vote(1, Vote.JA)
    m.register_vote(2, Vote.NEIN)
    assert m.session.phase == GamePhase.DEBATE

    # Disagree again
    m.register_vote(1, Vote.NEIN)
    m.register_vote(2, Vote.JA)
    # Still in debate, votes reset
    assert m.session.phase == GamePhase.DEBATE
    assert not m.session.players[0].vote
    assert not m.session.players[1].vote


def test_debate_timeout_game_over():
    m = make_machine()
    m._cancel_timer()  # Prevent real timer

    m.register_vote(1, Vote.JA)
    m.register_vote(2, Vote.NEIN)
    assert m.session.phase == GamePhase.DEBATE

    # Simulate timeout
    m._on_debate_timeout()
    assert m.session.phase == GamePhase.GAME_OVER


def test_voting_timeout_skips_question():
    m = make_machine()
    m._cancel_timer()  # Prevent real timer
    old_index = m.session.current_question_index

    m._on_voting_timeout()
    # After timeout, enters transition for next question
    _skip_transition_if_needed(m)
    assert m.session.current_question_index == old_index + 1
    assert m.session.phase == GamePhase.VOTING


def test_all_questions_done_score_screen():
    m = make_machine(questions_count=2)
    # Answer first correctly
    m.register_vote(1, Vote.JA)
    m.register_vote(2, Vote.JA)
    assert m.session.score == 10
    _skip_transition_if_needed(m)

    # Answer second correctly
    m.register_vote(1, Vote.NEIN)
    m.register_vote(2, Vote.NEIN)
    assert m.session.score == 20
    assert m.session.phase == GamePhase.SCORE_SCREEN


def test_get_state_hides_votes_until_both_voted():
    m = make_machine()
    m.register_vote(1, Vote.JA)
    state = m.get_state()
    # P1 has voted but P2 hasn't — vote value should be hidden
    assert state["players"][0]["has_voted"] is True
    assert "vote" not in state["players"][0]

    m.register_vote(2, Vote.NEIN)
    # After both voted, machine transitions to debate — check the new state
    state = m.get_state()
    # In debate phase, votes are reset, so we just verify the state is valid
    assert state["phase"] in ("debate", "voting", "transition")


def test_get_state_shows_votes_when_both_voted():
    m = make_machine()
    # We need to check state right after both vote but before transition
    # Since transition happens immediately, test the returned state dict construction
    m.session.players[0].vote = Vote.JA
    m.session.players[1].vote = Vote.NEIN
    state = m.get_state()
    assert state["players"][0]["vote"] == "ja"
    assert state["players"][1]["vote"] == "nein"


def test_restart_game():
    m = make_machine()
    m.register_vote(1, Vote.JA)
    m.register_vote(2, Vote.JA)
    assert m.session.score == 10

    m.restart_game()
    assert m.session.phase == GamePhase.IDLE
    assert m.session.score == 0


def test_vote_ignored_in_wrong_phase():
    m = make_machine()
    m._cancel_timer()
    m.session.phase = GamePhase.IDLE
    m.register_vote(1, Vote.JA)
    assert m.session.players[0].vote is None


def test_vote_ignored_in_transition():
    """Votes during transition should be ignored."""
    callback = MagicMock()
    machine = GameStateMachine(on_state_change=callback)
    from game.models import Question
    questions = [Question(text="Q?", category="test")]
    with patch("game.state_machine.load", return_value=questions):
        machine.start_game("test")
    assert machine.session.phase == GamePhase.TRANSITION
    machine.register_vote(1, Vote.JA)
    assert machine.session.players[0].vote is None


def test_start_game_ignored_when_not_idle():
    m = make_machine()
    first_question = m.session.current_question
    with patch("game.state_machine.load") as load:
        m.start_game("test")
    load.assert_not_called()
    assert m.session.phase == GamePhase.VOTING
    assert m.session.current_question is first_question


def test_duplicate_vote_ignored_in_voting():
    m = make_machine()
    m.register_vote(1, Vote.JA)
    m.register_vote(1, Vote.NEIN)  # Should be ignored
    assert m.session.players[0].vote == Vote.JA


def test_on_state_change_callback_called():
    callback = MagicMock()
    m = GameStateMachine(on_state_change=callback)
    from game.models import Question
    with patch("game.state_machine.load", return_value=[Question("Q?", "test")]):
        m.start_game("test")
    assert callback.call_count > 0


def test_all_categories_skips_excluded():
    from game.models import Question
    questions = [Question(text=f"Frage {i}?", category="normal") for i in range(5)]
    questions += [Question(text=f"Question {i}?", category="Englisch") for i in range(5)]
    machine = GameStateMachine(on_state_change=MagicMock())
    with patch("game.state_machine.load", return_value=questions), \
         patch("config.exclude_from_all", return_value=["Englisch"]):
        machine.start_game(None)
    machine._cancel_timer()
    assert machine.session.questions
    assert all(q.category == "normal" for q in machine.session.questions)
