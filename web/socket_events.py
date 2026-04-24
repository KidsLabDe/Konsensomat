from flask import request
from flask_socketio import SocketIO
from game.state_machine import GameStateMachine
from game.models import GamePhase
from input.keyboard import KeyboardInputHandler

socketio: SocketIO | None = None
game_machine: GameStateMachine | None = None
input_handler = KeyboardInputHandler()

# sid -> player number (1 or 2) for connected buzzer pages
connected_buzzers: dict[str, int] = {}


def _connected_players() -> set[int]:
    return set(connected_buzzers.values())


def _build_state() -> dict:
    if game_machine is None:
        return {}
    state = game_machine.get_state()
    players = _connected_players()
    state["buzzers"] = {"player1": 1 in players, "player2": 2 in players}
    return state


def init_socket_events(sio: SocketIO, machine: GameStateMachine):
    global socketio, game_machine
    socketio = sio
    game_machine = machine

    @sio.on("connect")
    def on_connect():
        sio.emit("game_state", _build_state())

    @sio.on("disconnect")
    def on_disconnect():
        if request.sid in connected_buzzers:
            del connected_buzzers[request.sid]
            broadcast_state()

    @sio.on("join_as_player")
    def on_join_as_player(data):
        player = data.get("player")
        if player in (1, 2):
            connected_buzzers[request.sid] = player
            broadcast_state()

    @sio.on("keypress")
    def on_keypress(data):
        key = data.get("key", "")
        valid_keys = input_handler.valid_keys()
        phase = machine.session.phase

        if key in valid_keys and phase == GamePhase.IDLE:
            sio.emit("menu_action", {"action": "select", "key": key})
            return

        if key in valid_keys and phase in (GamePhase.GAME_OVER, GamePhase.SCORE_SCREEN):
            machine.restart_game()
            return

        result = input_handler.parse(key)
        if result is not None:
            player_id, vote = result
            machine.register_vote(player_id, vote)

    @sio.on("start_game")
    def on_start_game(data):
        category = data.get("category")
        machine.start_game(category)

    @sio.on("restart_game")
    def on_restart_game(_data=None):
        machine.restart_game()


def broadcast_state():
    if socketio is not None and game_machine is not None:
        socketio.emit("game_state", _build_state())
