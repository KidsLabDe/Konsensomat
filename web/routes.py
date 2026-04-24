from flask import Blueprint, render_template, jsonify, request, Response
import config
from game.question_loader import list_categories
from game import stats

bp = Blueprint("main", __name__)

# Game state machine is set after app creation
game_machine = None


def init_routes(machine):
    global game_machine
    game_machine = machine


@bp.route("/robots.txt")
def robots():
    return Response("User-agent: *\nDisallow: /\n", mimetype="text/plain")


@bp.route("/")
def game():
    return render_template("game.html")


@bp.route("/admin")
def admin():
    return render_template("admin.html")


@bp.route("/audiotest")
def audiotest():
    return render_template("audiotest.html")


@bp.route("/buzzer/<int:player>")
def buzzer(player):
    if player not in (1, 2):
        return "Player must be 1 or 2", 400
    return render_template("buzzer.html", player=player)


@bp.route("/api/categories")
def api_categories():
    return jsonify(list_categories())


@bp.route("/api/state")
def api_state():
    if game_machine is None:
        return jsonify({"error": "Game not initialized"}), 500
    return jsonify(game_machine.get_state())


@bp.route("/api/config", methods=["GET"])
def api_config_get():
    return jsonify(config.get_all())


@bp.route("/api/config/<section>", methods=["POST"])
def api_config_update(section):
    data = request.get_json()
    if not data or section not in ("keys", "timers", "server"):
        return jsonify({"error": "Invalid section"}), 400
    updated = config.update(section, data)
    return jsonify(updated)


@bp.route("/api/stats")
def api_stats():
    return jsonify(stats.summary())


@bp.route("/api/stats/reset", methods=["POST"])
def api_stats_reset():
    stats.reset()
    return jsonify({"ok": True})
