# Portfolio backend

The official portfolio uses the Flask backend in `app.py`. It serves the portfolio pages and provides the contact form and admin APIs on port `5000`.
The older `server.js` and `personal-server.js` files are not used by the current start scripts.

## Run locally

From the `official` project folder, run `backend\start_server.bat`. It uses the project `.venv` interpreter. To install or update dependencies first, run this from the `official` folder:

```powershell
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Then open `http://127.0.0.1:5000`. The homepage, contact form, login, registration, and admin dashboard are served by Flask. For production, use a host that runs Python/Flask through a WSGI server. If the frontend and backend use different origins, add this before loading `script.js` and `auth.js` in each HTML page:

```html
<script>window.OFFICIAL_API_BASE_URL = "https://api.example.com";</script>
```

Replace the example with the public API origin. GitHub Pages is static hosting and cannot run this Flask backend, so its contact and admin APIs will not work there.

## Admin setup

Open `/register.html` to create the initial admin account. Without `ADMIN_SETUP_KEY`, the first account can only be created from the same machine as the backend. For a hosted deployment, configure a private `ADMIN_SETUP_KEY` and enter it during initial setup. Registration closes after that first account is created. Passwords are stored as scrypt hashes. Sign in at `/login.html` to open the dashboard at `/admin.html`; dashboard access uses a temporary bearer token held in the current browser session.

Existing Node-generated `users.json` records that use scrypt hashes are supported.

## Email configuration

Copy `backend/.env.example` to `backend/.env` and provide `SMTP_EMAIL`, `SMTP_APP_PASSWORD`, and `RECEIVER_EMAIL`. Keep `.env` private and do not place credentials in frontend files or source control. The health endpoint reports whether email delivery is enabled and all SMTP values are configured. Set `EMAIL_ENABLED=false` to save contact submissions without attempting SMTP delivery.

Contact submissions are saved in `backend/data/messages.json`. If email delivery is unavailable, the page reports that the message was saved but the email notification was not sent.

## API

- `GET /api/health`
- `POST /api/contact`
- `GET /api/register/status`
- `POST /api/register` (initial admin account only)
- `POST /api/login`
- `GET /api/messages` (requires `Authorization: Bearer <token>`)
- `POST /api/logout`

Run backend tests from this folder with `..\.venv\Scripts\python.exe -m unittest discover -s . -p test_app.py`.
