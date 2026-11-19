from flask import Flask, jsonify
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from dotenv import load_dotenv
import atexit
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
from users import users
from scans import scans
from web_auth import web_auth
from diagnose import diagnose
from mobile_scans import mobile_scans
from mobile_sync import mobile_sync
from farmers import farmers
from my_profile import profile
from audit_logs import audit_logs
from password_reset import password_reset
from app_settings import app_settings
from admin_backup import admin_backup
from activity_log import init_activity_log
from rate_limits import init_rate_limits

load_dotenv()

app = Flask(__name__)

app.config["JWT_SECRET_KEY"] = os.getenv(
    "JWT_SECRET_KEY"
)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB uploads

jwt = JWTManager(app)
# limits on sign in, sign up and password resets (rate_limits.py)
init_rate_limits(app)
CORS(app, expose_headers=["Content-Disposition", "X-Row-Count"])  # read by the web app (file names, row counts)

app.register_blueprint(users)
app.register_blueprint(scans)
app.register_blueprint(web_auth)
app.register_blueprint(diagnose)
app.register_blueprint(mobile_scans)
app.register_blueprint(mobile_sync)
app.register_blueprint(farmers)
app.register_blueprint(profile)
app.register_blueprint(audit_logs)
app.register_blueprint(password_reset)
app.register_blueprint(app_settings)
app.register_blueprint(admin_backup)

# every request goes into audit_logs (activity_log.py)
init_activity_log(app)

# Home
@app.route("/")
def home():
    return jsonify({
        "message": "PinePal API is running"
    })


FRONTEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # the project root
FRONTEND_PORT = 5173
API_PORT = 5000

# Vite lines that only add noise. Errors, warnings and anything unexpected still get through.
IGNORED_VITE_LINES = [
    re.compile(r"^>\s"),                       # npm's "> pinepal_web@0.0.0 dev" header
    re.compile(r"Network:"),                    # "use --host to expose"
    re.compile(r"\(client\).*(Re-optimizing|\[optimizer\]|optimized dependencies)"),
]


def port_in_use(port):
    with socket.socket() as probe:
        return probe.connect_ex(("127.0.0.1", port)) == 0


def relay_frontend_output(process):
    """Print the dashboard's output, trimmed to the lines that matter."""
    ready_in = None
    for raw in process.stdout:
        line = raw.rstrip()
        if not line or any(pattern.search(line) for pattern in IGNORED_VITE_LINES):
            continue
        ready = re.search(r"ready in (\d+) ms", line)
        if ready:
            ready_in = int(ready.group(1)) / 1000
            continue
        local = re.search(r"Local:\s+(\S+)", line)
        if local:
            took = f" ({ready_in:.1f} s)" if ready_in is not None else ""
            line = f"* Web dashboard ready at {local.group(1)}{took}"
        print(line, flush=True)


def start_frontend():
    """Start the web dashboard (`npm run dev`) next to the API.

    Set START_FRONTEND=0 in the environment to run only the API.
    Returns the process, or None when it was not started.
    """
    if os.getenv("START_FRONTEND", "1") == "0":
        return None

    if port_in_use(FRONTEND_PORT):
        print(f"* Web dashboard: port {FRONTEND_PORT} is already in use, so it is not started again.")
        return None

    npm = shutil.which("npm")
    if npm is None:
        print("* Web dashboard not started: npm was not found. Install Node.js, or run it yourself.")
        return None
    if not os.path.isdir(os.path.join(FRONTEND_DIR, "node_modules")):
        print("* Web dashboard not started: run `npm install` in the project folder first.")
        return None

    # Vite's colors are only codes like [32m[1m here, because its output is read and
    # reprinted by this program, so turn them off.
    env = dict(os.environ)
    env["NO_COLOR"] = "1"
    env.pop("FORCE_COLOR", None)

    print("* Starting the web dashboard...", flush=True)
    process = subprocess.Popen(
        [npm, "run", "dev"], cwd=FRONTEND_DIR, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace", bufsize=1,
    )
    atexit.register(stop_frontend, process)
    threading.Thread(target=relay_frontend_output, args=(process,), daemon=True).start()
    return process


def stop_frontend(process):
    """Stop npm and the dev server it started (on Windows npm leaves node running otherwise)."""
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True)
    else:
        process.terminate()


def start_frontend_after_api():
    """Start the dashboard once Flask has printed its own startup lines, so those come first."""

    def wait_then_start():
        for _ in range(100):  # up to about 20 seconds for the API to come up
            if port_in_use(API_PORT):
                break
            time.sleep(0.2)
        time.sleep(1.5)  # the debugger lines (the PIN) print a moment after the port opens
        start_frontend()

    threading.Thread(target=wait_then_start, daemon=True).start()


if __name__ == "__main__":
    # In debug mode Flask runs this file twice (a watcher and the server). Only the
    # watcher, which stays alive across reloads, starts the dashboard.
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        start_frontend_after_api()
    app.run(debug=True, port=API_PORT)
