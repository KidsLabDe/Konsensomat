import threading
from typing import Callable

import config
from game.models import GamePhase, GameSession, Vote
from game.question_loader import load
from game import question_deck
from game import stats


class GameStateMachine:
    """Core game logic — no Flask/SocketIO imports.

    Communicates state changes via the on_state_change callback.
    """

    def __init__(self, on_state_change: Callable[[], None] | None = None):
        self.session = GameSession()
        self.on_state_change = on_state_change
        self._timer: threading.Timer | None = None
        self._timer_lock = threading.Lock()
        self._tick_interval = 1.0
        self._category: str | None = None
        self._transition_reason: str = "start"  # "start", "agreement", "timeout"

    def start_game(self, category: str | None = None):
        """Load questions and begin the first voting round."""
        self._cancel_timer()
        questions = load(category)
        if not questions:
            return
        questions = question_deck.draw(category, questions, config.questions_per_game())
        self._category = category
        self.session = GameSession(questions=questions)
        stats.record_game_start()
        self._enter_transition()

    def register_vote(self, player_id: int, vote: Vote):
        """Register a player's vote. Evaluate when both have voted."""
        if self.session.phase not in (GamePhase.VOTING, GamePhase.DEBATE):
            return

        player = self._get_player(player_id)
        if player is None:
            return

        # During voting phase, only allow one vote per player
        if self.session.phase == GamePhase.VOTING and player.vote is not None:
            return

        player.vote = vote
        self._broadcast()

        if self.session.both_voted():
            self._evaluate_votes()

    def restart_game(self):
        """Reset to idle state."""
        self._cancel_timer()
        self.session = GameSession()
        self._broadcast()

    def get_state(self) -> dict:
        """Serialize current state for broadcasting.

        Hides individual vote values until both players have voted.
        """
        session = self.session
        both_voted = session.both_voted()

        players = []
        for p in session.players:
            player_data = {
                "id": p.id,
                "name": p.name,
                "has_voted": p.vote is not None,
            }
            if both_voted:
                player_data["vote"] = p.vote.value if p.vote else None
            players.append(player_data)

        question_text = None
        question_number = 0
        total_questions = len(session.questions)
        if session.current_question is not None:
            question_text = session.current_question.text
            question_number = session.current_question_index + 1

        return {
            "phase": session.phase.value,
            "score": session.score,
            "agreements": session.agreements,
            "question": question_text,
            "question_number": question_number,
            "total_questions": total_questions,
            "players": players,
            "timer_remaining": round(session.timer_remaining),
            "timer_total": self._current_timer_total(),
            "transition_reason": self._transition_reason,
        }

    # --- Internal methods ---

    def _get_player(self, player_id: int):
        for p in self.session.players:
            if p.id == player_id:
                return p
        return None

    def _current_question_text(self) -> str:
        q = self.session.current_question
        return q.text if q else ""

    def _enter_transition(self, reason: str = "start"):
        """Show Konsensomat transition before next question."""
        self._transition_reason = reason
        self.session.phase = GamePhase.TRANSITION
        tt = config.transition_time()
        self.session.timer_remaining = tt
        self._broadcast()
        self._start_countdown(tt, self._on_transition_done)

    def _on_transition_done(self):
        """Transition finished — enter voting."""
        if self.session.phase != GamePhase.TRANSITION:
            return
        self._enter_voting()

    def _enter_voting(self):
        """Start voting phase with countdown."""
        self.session.phase = GamePhase.VOTING
        self.session.reset_votes()
        vt = config.voting_time()
        self.session.timer_remaining = vt
        self._broadcast()
        stats.record_question_asked(self._current_question_text())
        self._start_countdown(vt, self._on_voting_timeout)

    def _enter_debate(self):
        """Start debate phase with countdown."""
        self.session.phase = GamePhase.DEBATE
        self.session.reset_votes()
        dt = config.debate_time()
        self.session.timer_remaining = dt
        self._broadcast()
        self._start_countdown(dt, self._on_debate_timeout)

    def _evaluate_votes(self):
        """Check if votes match and transition accordingly."""
        if self.session.votes_match():
            self._on_agreement()
        else:
            self._on_disagreement()

    def _on_agreement(self):
        """Votes match — score points. 10 for voting, 100 for debate consensus."""
        self.session.agreements += 1
        if self.session.phase == GamePhase.DEBATE:
            self.session.score += 100
        else:
            self.session.score += 10
        stats.record_agreement(self._current_question_text())
        if self.session.has_more_questions():
            self.session.next_question()
            if self.session.phase == GamePhase.DEBATE:
                self._cancel_timer()
            self._enter_transition("agreement")
        else:
            self._enter_score_screen()

    def _on_disagreement(self):
        """Votes don't match."""
        if self.session.phase == GamePhase.VOTING:
            # First disagreement — enter debate
            self._cancel_timer()
            stats.record_disagreement(self._current_question_text())
            self._enter_debate()
        elif self.session.phase == GamePhase.DEBATE:
            # Still disagree during debate — reset votes, timer keeps running
            self.session.reset_votes()
            self._broadcast()

    def _on_voting_timeout(self):
        """Voting time expired — skip to next question or end."""
        if self.session.phase != GamePhase.VOTING:
            return
        stats.record_timeout(self._current_question_text())
        if self.session.has_more_questions():
            self.session.next_question()
            self._enter_transition("timeout")
        else:
            self._enter_score_screen()

    def _on_debate_timeout(self):
        """Debate time expired — game over."""
        if self.session.phase != GamePhase.DEBATE:
            return
        self.session.phase = GamePhase.GAME_OVER
        self.session.timer_remaining = 0
        self._broadcast()
        stats.record_game_end(
            self.session.score, len(self.session.questions),
            self._category, completed=False,
        )
        self._start_end_screen_timer()

    def _enter_score_screen(self):
        """All questions done — show final score."""
        self._cancel_timer()
        self.session.phase = GamePhase.SCORE_SCREEN
        self.session.timer_remaining = 0
        self._broadcast()
        stats.record_game_end(
            self.session.score, len(self.session.questions),
            self._category, completed=True,
        )
        self._start_end_screen_timer()

    def _start_end_screen_timer(self):
        """Auto-return to idle after end_screen_seconds."""
        seconds = config.end_screen_time()
        if seconds > 0:
            self._timer = threading.Timer(seconds, self._on_end_screen_timeout)
            self._timer.daemon = True
            self._timer.start()

    def _on_end_screen_timeout(self):
        """End screen timer expired — return to idle."""
        if self.session.phase in (GamePhase.GAME_OVER, GamePhase.SCORE_SCREEN):
            self.restart_game()

    def _current_timer_total(self) -> int:
        if self.session.phase == GamePhase.TRANSITION:
            return config.transition_time()
        elif self.session.phase == GamePhase.VOTING:
            return config.voting_time()
        elif self.session.phase == GamePhase.DEBATE:
            return config.debate_time()
        return 0

    # --- Timer management ---

    def _start_countdown(self, seconds: float, on_expire: Callable):
        """Start a ticking countdown that broadcasts every second."""
        self._cancel_timer()
        self.session.timer_remaining = seconds
        self._countdown_target = on_expire
        self._timer = threading.Timer(self._tick_interval, self._tick)
        self._timer.daemon = True
        self._timer.start()

    def _tick(self):
        """Decrement timer and schedule next tick or fire expiry."""
        expired_target = None
        with self._timer_lock:
            self.session.timer_remaining -= self._tick_interval
            if self.session.timer_remaining <= 0:
                self.session.timer_remaining = 0
                self._broadcast()
                # Don't call target inside lock — would deadlock on _cancel_timer
                expired_target = self._countdown_target
            else:
                self._broadcast()
                self._timer = threading.Timer(self._tick_interval, self._tick)
                self._timer.daemon = True
                self._timer.start()
        # Call expiry handler outside lock
        if expired_target:
            expired_target()

    def _cancel_timer(self):
        with self._timer_lock:
            if self._timer is not None:
                self._timer.cancel()
                self._timer = None

    def _broadcast(self):
        if self.on_state_change:
            self.on_state_change()
