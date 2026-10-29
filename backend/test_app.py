import json
import tempfile
import unittest
from pathlib import Path

from app import create_app


class PortfolioAppTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp_dir.name)
        self.app = create_app(
            {
                "TESTING": True,
                "DATA_DIR": self.data_dir,
                "SMTP_EMAIL": None,
                "SMTP_APP_PASSWORD": None,
                "RECEIVER_EMAIL": None,
                "ADMIN_SETUP_KEY": None,
                "EMAIL_ENABLED": False,
            }
        )
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_health_reports_email_configuration(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"status": "ok", "emailEnabled": False})

    def test_contact_validation_and_persistence(self):
        invalid = self.client.post("/api/contact", json={})
        self.assertEqual(invalid.status_code, 400)
        self.assertFalse((self.data_dir / "messages.json").exists())

        response = self.client.post(
            "/api/contact",
            json={
                "name": "Test Sender",
                "email": "sender@example.com",
                "phone": "",
                "message": "A test contact message",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.get_json()["emailSent"])
        stored = json.loads((self.data_dir / "messages.json").read_text(encoding="utf-8"))
        self.assertEqual(len(stored), 1)
        self.assertEqual(stored[0]["message"], "A test contact message")

    def test_admin_registration_login_messages_and_logout(self):
        self.client.post(
            "/api/contact",
            json={
                "name": "Test Sender",
                "email": "sender@example.com",
                "message": "Private test message",
            },
        )

        registration = self.client.post(
            "/api/register",
            json={"name": "Owner", "email": "owner@example.com", "password": "test-password"},
        )
        self.assertEqual(registration.status_code, 201)
        users = json.loads((self.data_dir / "users.json").read_text(encoding="utf-8"))
        self.assertNotIn("password", users[0])
        self.assertNotIn("test-password", users[0].values())

        closed_registration = self.client.post(
            "/api/register",
            json={"name": "Other", "email": "other@example.com", "password": "other-pass"},
        )
        self.assertEqual(closed_registration.status_code, 409)

        unauthorized = self.client.get("/api/messages")
        self.assertEqual(unauthorized.status_code, 401)

        login = self.client.post(
            "/api/login",
            json={"username": "owner@example.com", "password": "test-password"},
        )
        self.assertEqual(login.status_code, 200)
        token = login.get_json()["token"]

        messages = self.client.get(
            "/api/messages", headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(messages.status_code, 200)
        self.assertEqual(messages.get_json()[0]["message"], "Private test message")

        logout = self.client.post(
            "/api/logout", headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(logout.status_code, 200)
        expired_session = self.client.get(
            "/api/messages", headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(expired_session.status_code, 401)

    def test_wrong_password_is_rejected(self):
        self.client.post(
            "/api/register",
            json={"name": "Owner", "email": "owner@example.com", "password": "test-password"},
        )
        response = self.client.post(
            "/api/login",
            json={"username": "Owner", "password": "wrong-password"},
        )
        self.assertEqual(response.status_code, 401)

    def test_remote_admin_setup_requires_the_configured_key(self):
        remote_client = create_app(
            {
                "TESTING": True,
                "DATA_DIR": self.data_dir / "remote",
                "ADMIN_SETUP_KEY": "test-only-setup-key",
                "EMAIL_ENABLED": False,
            }
        ).test_client()
        payload = {
            "name": "Owner",
            "email": "owner@example.com",
            "password": "test-password",
            "setupKey": "wrong-key",
        }
        denied = remote_client.post(
            "/api/register", json=payload, environ_overrides={"REMOTE_ADDR": "192.0.2.4"}
        )
        self.assertEqual(denied.status_code, 403)

        payload["setupKey"] = "test-only-setup-key"
        allowed = remote_client.post(
            "/api/register", json=payload, environ_overrides={"REMOTE_ADDR": "192.0.2.4"}
        )
        self.assertEqual(allowed.status_code, 201)

    def test_site_pages_are_served_without_exposing_backend_files(self):
        for path in (
            "/",
            "/admin.html",
            "/education.html",
            "/skills.html",
            "/style.css",
        ):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            response.close()
        self.assertEqual(self.client.get("/backend/app.py").status_code, 404)


if __name__ == "__main__":
    unittest.main()
