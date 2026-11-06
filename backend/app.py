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
from auth import auth
from users import users
from scans import scans
from web_auth import web_auth
from diagnose import diagnose
from mobile_scans import mobile_scans
from mobile_sync import mobile_sync
from farmers import farmers

load_dotenv()

app = Flask(__name__)

app.config["JWT_SECRET_KEY"] = os.getenv(
    "JWT_SECRET_KEY"
)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB uploads

jwt = JWTManager(app)
CORS(app)

app.register_blueprint(auth)
app.register_blueprint(users)
app.register_blueprint(scans)
app.register_blueprint(web_auth)
app.register_blueprint(diagnose)
app.register_blueprint(mobile_scans)
app.register_blueprint(mobile_sync)
app.register_blueprint(farmers)

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


# ---------------------------------------------------------------------------
# Colors for the terminal output. They are only used in a real terminal: output panes that
# are not one (for example VS Code's "Running" view for Run Code) cannot draw colors and
# would show codes like [32m instead. NO_COLOR=1 turns them off, FORCE_COLOR=1 forces them on.
# ---------------------------------------------------------------------------
RESET, BOLD, DIM = "\x1b[0m", "\x1b[1m", "\x1b[2m"
RED, GREEN, YELLOW, BLUE, MAGENTA, CYAN = (f"\x1b[{n}m" for n in (31, 32, 33, 34, 35, 36))

REQUEST_LINE = re.compile(r'^(\S+) - - \[([^\]]+)\] "(\w+) (\S+) ([^"]+)" (\d{3}) (\S+)\s*$')
METHOD_COLORS = {"GET": GREEN, "POST": BLUE, "PUT": YELLOW, "PATCH": YELLOW, "DELETE": RED}


def paint(text, *styles):
    return "".join(styles) + text + RESET


def colors_enabled():
    if os.getenv("NO_COLOR"):
        return False
    force = os.getenv("FORCE_COLOR")
    if force not in (None, "", "0"):
        return True
    return sys.stdout.isatty()


def colorize_line(line):
    if not line.strip() or "\x1b" in line:
        return line

    request = REQUEST_LINE.match(line)
    if request:
        ip, when, method, path, protocol, status, size = request.groups()
        if method == "OPTIONS":  # the browser's preflight check: dim, it is just noise
            return paint(line, DIM)
        code = int(status)
        status_color = [GREEN, CYAN, YELLOW, RED + BOLD][min(max(code // 100 - 2, 0), 3)]
        return (
            paint(f"{ip} - - [{when}]", DIM) + " "
            + paint(method, METHOD_COLORS.get(method, MAGENTA), BOLD) + " " + path + " "
            + paint(protocol, DIM) + " " + paint(status, status_color, BOLD) + paint(f" {size}", DIM)
        )

    text = line.strip()
    if text.startswith("* Running on"):
        return line.replace(text, paint("* Running on", GREEN) + " " + paint(text[len("* Running on "):], CYAN))
    if text.startswith("* Web dashboard ready at"):
        url, _, took = text[len("* Web dashboard ready at "):].partition(" ")
        return paint("* Web dashboard ready at", GREEN, BOLD) + " " + paint(url, CYAN) + (" " + paint(took, DIM) if took else "")
    if text.startswith("* Debugger PIN:"):
        return line.replace(text, paint("* Debugger PIN:", YELLOW) + " " + paint(text.split(": ", 1)[1], BOLD))
    if text.startswith("* Debugger is active"):
        return paint(line, GREEN)
    if text.startswith("* Debug mode: on"):
        return line.replace(text, paint("* Debug mode:", DIM) + " " + paint("on", YELLOW))
    if text.startswith(("WARNING:", "* Web dashboard:", "* Web dashboard not started", "Port ")):
        return paint(line, YELLOW)
    if text.startswith(("* Serving Flask app", "Press CTRL+C", "* Restarting with stat", "* Starting the web dashboard")):
        return paint(line, DIM)
    if text.startswith("Traceback (most recent call last)") or text.startswith("ERROR in") or " ERROR in " in line[:40]:
        return paint(line, RED, BOLD)
    if re.match(r"^\w[\w.]*(Error|Exception)\b", text) and not line.startswith(" "):
        return paint(line, RED)
    if line.startswith("  File "):
        return paint(line, DIM)
    if "[vite]" in line and re.search(r"error|failed", line, re.I):
        return paint(line, RED)
    if "[vite]" in line and re.search(r"hmr update|page reload|hmr invalidate", line):
        return paint(line, DIM)
    return line


class ColorStream:
    """Wraps stdout or stderr and colors each line on its way out."""

    def __init__(self, stream):
        self._stream = stream

    def write(self, text):
        if isinstance(text, str) and text.strip():
            colored = "\n".join(colorize_line(part) for part in text.split("\n"))
            self._stream.write(colored)
            return len(text)
        return self._stream.write(text)

    def __getattr__(self, name):  # isatty, flush, encoding and the rest pass straight through
        return getattr(self._stream, name)


def install_colors():
    if not colors_enabled():
        return
    if os.name == "nt":
        os.system("")  # lets older Windows consoles read color codes
    try:
        # Werkzeug (Flask's server) styles some of its own lines, and on Windows they then arrive
        # in pieces. Turn that off so every line reaches ColorStream whole.
        import werkzeug.serving
        werkzeug.serving._log_add_style = False
    except (ImportError, AttributeError):
        pass
    sys.stdout = ColorStream(sys.stdout)
    sys.stderr = ColorStream(sys.stderr)


if __name__ == "__main__":
    install_colors()
    # In debug mode Flask runs this file twice (a watcher and the server). Only the
    # watcher, which stays alive across reloads, starts the dashboard.
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        start_frontend_after_api()
    app.run(debug=True, port=API_PORT)
