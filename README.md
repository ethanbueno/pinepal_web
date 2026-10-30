# PinePal Web

Web dashboard for **PinePal**, a pineapple disease detection system. Farmers scan fruit with the PinePal mobile app, scans sync to a Flask + MySQL backend, and officers monitor cases here: a dashboard, a disease map of Isabela, scans and verification, farmers, and CSV export. Admins and officers can also diagnose a photo on the web with the MobileNetV2 model in `backend/model/`.

- **Front end:** React, Vite, Tailwind, shadcn/ui, Recharts, Leaflet (`src/`)
- **Back end:** Flask, MySQL (`backend/`)

## Features

| Area | What it does | Who |
| --- | --- | --- |
| Dashboard | Scans needing review, totals, diseased share, monthly trend, disease breakdown, recent scans, municipality ranking | staff |
| Disease Map | Scans plotted by diagnosis on the borders of Isabela's cities and municipalities | staff |
| Scans | Filterable list, scan detail, officer verification (admins can delete) | staff |
| Diagnose | Upload a photo, get a diagnosis, save it as a scan | staff |
| Farmers | Add, edit and deactivate farmers; farmer logins; scans per farmer | staff |
| Users | Add, edit, change roles, delete accounts | admin |
| Export | CSV download with filters | staff |
| My Farm, My Scans | A farmer's own farm and scans | farmer |

In progress: treatment Protocols and farmer Guides, Excel export, and syncing scans from the mobile app (the endpoints exist but are not yet tested end to end).

## Project structure

```
src/             React app (pages, components, API calls)
backend/         Flask API, database scripts, MobileNetV2 model (backend/model/)
backend/.env     your private settings (git-ignored, never committed)
.env             front-end settings (only the address of the API)
```

## Setup

### 1. Backend

The database is a hosted MySQL service (Aiven), so no local MySQL or XAMPP is needed.

1. In the service's Overview page, download the **CA certificate** and save it as `backend/ca.pem`.
2. Copy `backend/.env.example` to `backend/.env` and fill in the values from the service's *Connection information*. Both `.env` and `ca.pem` are git-ignored:
   ```
   DB_HOST=<host from the service>
   DB_PORT=<port from the service>
   DB_USER=<user from the service>
   DB_PASSWORD=<password from the service>
   DB_NAME=pinepal_db
   DB_SSL_CA=ca.pem
   JWT_SECRET_KEY=<a long random string you generate>
   ADMIN_PASSWORD=<the password you want for the admin account>
   ```
3. Run:
   ```
   cd backend
   pip install -r requirements.txt
   python setup_db.py      # creates missing tables, the disease list and the admin account
   python app.py           # http://127.0.0.1:5000
   ```

Other backend scripts:

| Script | What it does |
| --- | --- |
| `python reset_admin_password.py` | sets the admin account's password to `ADMIN_PASSWORD` |
| `python seed_sample_scans.py` | adds 60 example scans (`--remove` deletes only those) |
| `python import_mobile_scans.py` | copies scans from a local XAMPP MySQL into the hosted database (see below) |
| `python migrate_farmers.py` | creates the `farmers` table and fills it from the scans (run after the scans are in). A farmer's login username is their farmer ID, for example `F004`. Names start as "Farmer F004"; edit them on the Farmers page. |
| `python migrate_farmer_feedback.py` | adds the farmer-feedback columns to `mobile_scans` (safe to run more than once) |

### 2. Web dashboard

From the project root, in another terminal:

```
npm install
npm run dev
```

The `.env` in the project root holds `VITE_API_URL`, the address of the Flask backend (default `http://127.0.0.1:5000`). Only the API runs on your computer; the database is hosted.

### 3. Scan data

The dashboard reads the mobile app's scans from the `mobile_scans` table. Scans are not stored in git, so a fresh setup has none until you import them, restore a database export, or run `seed_sample_scans.py`.

To copy scans from an old local XAMPP setup (`db_bueno.scans` and `pinepal_db.mobile_scans`), put the local connection in `backend/.env.xampp` (same keys as `.env`; for XAMPP that is the local host and the `root` user), start XAMPP's MySQL, then:

```
cd backend
python import_mobile_scans.py
```

The script is safe to re-run (scans already in the database are skipped) and never changes the local databases.

## Security notes

- **Never commit secrets.** `backend/.env`, every `backend/.env.*` file (except `.env.example`), `backend/ca.pem` and `backend/uploads/` are git-ignored. Check `git status` before committing.
- **If a secret is ever committed, change it.** Deleting the file is not enough, because git keeps the history. Reset the database password in the hosting dashboard and generate a new `JWT_SECRET_KEY`.
- **Share credentials privately** (direct message or a password manager), never in an issue, a pull request or a group chat.
- The admin account's password is set by you through `ADMIN_PASSWORD`. It is not documented or stored in the code.
- Passwords are stored as bcrypt hashes. Login uses signed JWT tokens, access is role-based, and only admins can delete scans.

## Notes

- Roles: `admin`, `officer` (staff pages) and `farmer` (own farm and scans).
- The Disease Map and Export are temporarily locked to Echague. Set `LOCKED_MUNICIPALITY` to `""` in `src/utils/diseases.js` to show all of Isabela again.
- Municipality borders come from GADM 4.1 (https://gadm.org, free for non-commercial use).
