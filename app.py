import eventlet
eventlet.monkey_patch()

from flask import Flask
from flask_socketio import SocketIO

import config
from game.state_machine import GameStateMachine
from web.routes import bp, init_routes
from web.socket_events import init_socket_events, broadcast_state


def create_app() -> tuple[Flask, SocketIO, GameStateMachine]:
    app = Flask(__name__)
    app.config["SECRET_KEY"] = "einig-oder-aus-dev"

    socketio = SocketIO(app, async_mode="eventlet")
    game_machine = GameStateMachine(on_state_change=broadcast_state)

    init_routes(game_machine)
    init_socket_events(socketio, game_machine)

    app.register_blueprint(bp)

    return app, socketio, game_machine


def main():
    app, socketio, _ = create_app()
    socketio.run(app, host="0.0.0.0", port=config.port(), debug=config.debug())


if __name__ == "__main__":
    main()
