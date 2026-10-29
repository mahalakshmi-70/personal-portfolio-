import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import threading
import time
from email.message import EmailMessage
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, abort, jsonify, request, send_from_directory
from flask_cors import CORS


BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env")

PUBLIC_FILES = {
    "about.html",
    "admin.html",
    "auth.js",
    "contact.html",
    "education.html",
    "Golamari Mahalakshmi Resume 1.pdf",
    "index.html",
    "login.html",
    "profile.png",
    "project.html",
    "register.html",
    "script.js",
    "style.css",
    "skills.html",
}
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PASSWORD_HASH_LENGTH = 64


def _read_records(path):
    if not path.exists():
        return []

    try:
        records = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid JSON in data file: {path.name}") from exc

    if not isinstance(records, list):
        raise RuntimeError(f"Expected a JSON array in data file: {path.name}")
    return records


def _write_records(path, records):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")


def _hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt.encode("utf-8"),
        n=16384,
        r=8,
        p=1,
        dklen=PASSWORD_HASH_LENGTH,
    )
    return salt, digest.hex()


def _password_matches(password, user):
    salt = user.get("salt")
    stored_hash = user.get("passwordHash")

    if isinstance(salt, str) and isinstance(stored_hash, str):
        try:
            _, calculated_hash = _hash_password(password, salt)
        except (ValueError, TypeError):
            return False
        return hmac.compare_digest(calculated_hash, stored_hash)

    legacy_password = user.get("password")
    return isinstance(legacy_password, str) and hmac.compare_digest(
        password, legacy_password
    )


def create_app(config=None):
    app = Flask(__name__)
    app.config.from_mapping(
        DATA_DIR=Path(os.getenv("DATA_DIR", BACKEND_DIR / "data")),
        SMTP_EMAIL=os.getenv("SMTP_EMAIL"),
        SMTP_APP_PASSWORD=os.getenv("SMTP_APP_PASSWORD"),
        RECEIVER_EMAIL=os.getenv("RECEIVER_EMAIL"),
        ADMIN_SETUP_KEY=os.getenv("ADMIN_SETUP_KEY"),
        EMAIL_ENABLED=os.getenv("EMAIL_ENABLED", "true").lower() not in {"0", "false", "no"},
        SESSION_TTL_SECONDS=8 * 60 * 60,
        SESSION_STORE={},
        DATA_LOCK=threading.RLock(),
        SESSION_LOCK=threading.RLock(),
        MAX_CONTENT_LENGTH=1024 * 1024,
    )
    if config:
        app.config.update(config)
    CORS(app)

    def data_path(filename):
        return Path(app.config["DATA_DIR"]) / filename

    def send_contact_email(entry):
        if not app.config["EMAIL_ENABLED"]:
            return False

        credentials = (
            app.config["SMTP_EMAIL"],
            app.config["SMTP_APP_PASSWORD"],
            app.config["RECEIVER_EMAIL"],
        )
        if not all(credentials):
            return False

        message = EmailMessage()
        message["From"] = credentials[0]
        message["To"] = credentials[2]
        message["Subject"] = "New Portfolio Contact Message"
        message["Reply-To"] = entry["email"]
        message.set_content(
            "New Portfolio Contact Message\n\n"
            f"Name: {entry['name']}\n"
            f"Email: {entry['email']}\n"
            f"Phone: {entry['phone'] or 'N/A'}\n"
            f"Message: {entry['message']}\n"
        )

        try:
            with smtplib.SMTP("smtp.gmail.com", 587) as server:
                server.starttls()
                server.login(credentials[0], credentials[1])
                server.send_message(message)
        except (OSError, smtplib.SMTPException, ValueError):
            app.logger.exception("Contact email delivery failed.")
            return False
        return True

    def get_session_user():
        authorization = request.headers.get("Authorization", "")
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None

        with app.config["SESSION_LOCK"]:
            session = app.config["SESSION_STORE"].get(token)
            if not session:
                return None
            if session["expires_at"] <= time.time():
                del app.config["SESSION_STORE"][token]
                return None
            return session["user"]

    @app.get("/")
    def home():
        return send_from_directory(PROJECT_DIR, "index.html")

    @app.get("/<path:filename>")
    def public_file(filename):
        if filename not in PUBLIC_FILES:
            abort(404)
        return send_from_directory(PROJECT_DIR, filename)

    @app.get("/api/health")
    def health():
        email_enabled = app.config["EMAIL_ENABLED"] and all(
            (
                app.config["SMTP_EMAIL"],
                app.config["SMTP_APP_PASSWORD"],
                app.config["RECEIVER_EMAIL"],
            )
        )
        return jsonify({"status": "ok", "emailEnabled": email_enabled})

    @app.post("/api/contact")
    def contact():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"success": False, "error": "A JSON payload is required."}), 400

        name = str(data.get("name") or "").strip()
        email = str(data.get("email") or "").strip()
        phone = str(data.get("phone") or "").strip()
        message_text = str(data.get("message") or "").strip()
        if not name or not email or not message_text:
            return jsonify(
                {"success": False, "error": "Name, email, and message are required."}
            ), 400
        if not EMAIL_PATTERN.fullmatch(email):
            return jsonify({"success": False, "error": "Invalid email format."}), 400
        if len(name) > 100 or len(email) > 254 or len(phone) > 40 or len(message_text) > 10000:
            return jsonify({"success": False, "error": "One or more fields are too long."}), 400

        entry = {
            "id": int(time.time() * 1000),
            "name": name,
            "email": email,
            "phone": phone,
            "message": message_text,
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        with app.config["DATA_LOCK"]:
            messages = _read_records(data_path("messages.json"))
            messages.append(entry)
            _write_records(data_path("messages.json"), messages)

        email_sent = send_contact_email(entry)
        response_message = (
            "Your message has been received."
            if email_sent
            else "Your message was saved, but the email notification could not be sent."
        )
        return jsonify(
            {"success": True, "message": response_message, "emailSent": email_sent}
        )

    @app.get("/api/register/status")
    def registration_status():
        with app.config["DATA_LOCK"]:
            users = _read_records(data_path("users.json"))
        return jsonify({"registrationAvailable": len(users) == 0})

    @app.post("/api/register")
    def register():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"success": False, "error": "A JSON payload is required."}), 400

        name = str(data.get("name") or "").strip()
        email = str(data.get("email") or "").strip().lower()
        password = str(data.get("password") or "")
        if not name or not email or not password:
            return jsonify(
                {"success": False, "error": "Name, email, and password are required."}
            ), 400
        if len(name) > 100 or not EMAIL_PATTERN.fullmatch(email):
            return jsonify({"success": False, "error": "Enter a valid name and email."}), 400
        if len(password) < 7:
            return jsonify(
                {"success": False, "error": "Password must be at least 7 characters."}
            ), 400

        with app.config["DATA_LOCK"]:
            users = _read_records(data_path("users.json"))
            if users:
                return jsonify(
                    {
                        "success": False,
                        "error": "Admin registration is closed. Sign in with the existing account.",
                    }
                ), 409
            setup_key = app.config["ADMIN_SETUP_KEY"]
            if setup_key:
                supplied_key = str(data.get("setupKey") or "")
                if not hmac.compare_digest(supplied_key, setup_key):
                    return jsonify(
                        {"success": False, "error": "A valid admin setup key is required."}
                    ), 403
            elif request.remote_addr not in {"127.0.0.1", "::1"}:
                return jsonify(
                    {
                        "success": False,
                        "error": "Initial admin setup must be local unless ADMIN_SETUP_KEY is configured.",
                    }
                ), 403

            salt, password_hash = _hash_password(password)
            user = {
                "id": secrets.token_hex(16),
                "name": name,
                "email": email,
                "passwordHash": password_hash,
                "salt": salt,
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            _write_records(data_path("users.json"), [user])

        return jsonify({"success": True, "message": "Admin account created."}), 201

    @app.post("/api/login")
    def login():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"success": False, "error": "A JSON payload is required."}), 400

        username = str(data.get("username") or "").strip()
        password = str(data.get("password") or "")
        if not username or not password:
            return jsonify(
                {"success": False, "error": "Username and password are required."}
            ), 400

        with app.config["DATA_LOCK"]:
            users = _read_records(data_path("users.json"))
            user = next(
                (
                    candidate
                    for candidate in users
                    if candidate.get("name") == username
                    or candidate.get("email", "").lower() == username.lower()
                ),
                None,
            )
            if not user or not _password_matches(password, user):
                return jsonify(
                    {"success": False, "error": "Invalid username or password."}
                ), 401

            if isinstance(user.get("password"), str):
                salt, password_hash = _hash_password(password)
                user["salt"] = salt
                user["passwordHash"] = password_hash
                del user["password"]
                _write_records(data_path("users.json"), users)

        token = secrets.token_urlsafe(32)
        with app.config["SESSION_LOCK"]:
            app.config["SESSION_STORE"][token] = {
                "user": {"name": user["name"], "email": user["email"]},
                "expires_at": time.time() + app.config["SESSION_TTL_SECONDS"],
            }
        return jsonify(
            {"success": True, "token": token, "user": {"name": user["name"]}}
        )

    @app.get("/api/messages")
    def messages():
        if not get_session_user():
            return jsonify({"success": False, "error": "Authentication required."}), 401
        with app.config["DATA_LOCK"]:
            stored_messages = _read_records(data_path("messages.json"))
        return jsonify(stored_messages)

    @app.post("/api/logout")
    def logout():
        authorization = request.headers.get("Authorization", "")
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer" and token:
            with app.config["SESSION_LOCK"]:
                app.config["SESSION_STORE"].pop(token, None)
        return jsonify({"success": True})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")), debug=False)
