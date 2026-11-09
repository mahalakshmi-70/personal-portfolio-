# Portfolio backend

The official portfolio uses Flask in `app.py` for local development. On Netlify, JavaScript Functions provide the same API routes because Netlify does not run this Flask server directly. The older `server.js` and `personal-server.js` files are not used by the current start scripts.

## Run locally

From the `official` project folder, run `backend\start_server.bat`. It uses the project `.venv` interpreter. To install or update dependencies first, run this from the `official` folder:

```powershell
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Then open `http://127.0.0.1:5000`. The homepage, contact form, login, registration, and admin dashboard are served by Flask. If you host the frontend and a separate Flask API on different origins, add this before loading `script.js` and `auth.js` in each HTML page:

```html
<script>window.OFFICIAL_API_BASE_URL = "https://api.example.com";</script>
```

Replace the example with the public API origin. This override is not needed for Netlify; its `/api/...` routes are rewritten to the Functions below.

## Netlify deployment

Netlify publishes the public pages and assets from `dist/` and deploys JavaScript API functions from `netlify/functions/`. Rewrites keep the existing `/api/...` URLs. Messages, the admin account, and login sessions use persistent Netlify Blobs stores.

Before using contact email or creating the admin account, add these environment variables in Netlify under **Project configuration → Environment variables**: `SMTP_EMAIL`, `SMTP_APP_PASSWORD`, `RECEIVER_EMAIL`, and `ADMIN_SETUP_KEY`. Use a long random value for `ADMIN_SETUP_KEY`; enter the same value once on `/register.html` when creating the initial admin. Do not put these values in frontend files or commit a real `.env` file.

The Blobs store is persistent across deploys. Netlify starts with an empty Blobs store; local `backend/data/users.json` and `messages.json` records are not automatically imported. The Netlify build uses the root `package.json` and runs `npm install` followed by `npm run build`.

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
