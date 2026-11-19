"""Limits on how often the sign-in, sign-up and password routes can be called (Flask-Limiter).

Without them a script could try passwords forever, or create farmer IDs and fake scans
without end. Two kinds of limit:
  - per IP address (client_ip): one computer can't hammer a route
  - per account (account_key): many computers together can't keep guessing one account's
    password (for example "admin")

The counts are kept in memory. That is enough for the live server, which runs one gunicorn
worker (render.yaml); with more workers or servers, set RATELIMIT_STORAGE_URI to a Redis URL.
Over a limit the route answers 429 { "error": "..." } instead of running.
"""
import os

from flask import jsonify, request
from flask_limiter import Limiter
from flask_limiter.errors import RateLimitExceeded

# Sign in: per IP, and per username or email typed in
LOGIN_PER_IP = "10 per minute; 50 per hour"
LOGIN_PER_ACCOUNT = "10 per 15 minutes"
# Sign up and a phone's own farmer ID: new rows in users / farmers
SIGNUP_PER_IP = "5 per hour; 20 per day"
DEVICE_PER_IP = "5 per hour; 20 per day"
# Forgot / reset password (password_reset.py also limits the codes per account)
RESET_PER_IP = "5 per minute; 30 per hour"
# Model runs on the web Diagnose page (each one uses the server's CPU)
DIAGNOSE_PER_IP = "30 per minute"


def client_ip():
    """The visitor's IP address. On Render, requests come through Cloudflare, which puts the
    real address in CF-Connecting-IP / True-Client-IP (a visitor can't fake them, Cloudflare
    replaces them). Elsewhere it is the last X-Forwarded-For entry, the one the nearest proxy
    added, or the direct connection's address."""
    for header in ("CF-Connecting-IP", "True-Client-IP"):
        value = request.headers.get(header, "").strip()
        if value:
            return value
    forwarded = [part.strip() for part in request.headers.get("X-Forwarded-For", "").split(",") if part.strip()]
    if forwarded:
        return forwarded[-1]
    return request.remote_addr or "unknown"


def typed_account():
    data = request.get_json(silent=True) or {}
    return str(data.get("username") or data.get("email") or "").strip().lower()[:150]


def account_key():
    """The username or email being signed in to, so guesses at one account are counted
    together wherever they come from."""
    return "account:" + typed_account()


limiter = Limiter(
    key_func=client_ip,
    storage_uri=os.getenv("RATELIMIT_STORAGE_URI", "memory://"),
    headers_enabled=True,  # Retry-After tells the app how long to wait
)


# Guesses at one account count together on the web and the mobile sign-in. A request with no
# username is refused anyway (400), so it is not counted.
account_login_limit = limiter.shared_limit(
    LOGIN_PER_ACCOUNT, scope="login-account", key_func=account_key,
    exempt_when=lambda: not typed_account(),
)


def init_rate_limits(app):
    limiter.init_app(app)

    @app.errorhandler(RateLimitExceeded)
    def too_many(error):
        response = jsonify({"error": "Too many attempts. Wait a few minutes and try again."})
        response.status_code = 429
        return response
