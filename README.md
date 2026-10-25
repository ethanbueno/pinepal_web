# PinePal Web

Web dashboard for PinePal, a pineapple disease detection system. Farmers scan with the PinePal mobile app, scans sync to a Flask + MySQL backend, and officers monitor cases here: dashboard, disease map of Isabela, scans, farmers, protocols and CSV export. Admins and officers can also diagnose a photo on the web using the MobileNetV2 model in `backend/model/`.

- **Front end:** React + Vite + Tailwind (this folder, `src/`)
- **Back end:** Flask + MySQL (`backend/`)

## Setup

### 1. Backend

The database is hosted on Aiven MySQL, so no local MySQL/XAMPP is needed.

1. On the Aiven service's Overview page, download the **CA certificate** and save it as `backend/ca.pem`.
2. Copy `backend/.env.example` to `backend/.env` and fill it in from Aiven's Connection information. `.env` and `ca.pem` are git-ignored, so passwords never end up in the repo:
   ```
   DB_HOST=<Aiven host>
   DB_PORT=<Aiven port>
   DB_USER=avnadmin
   DB_PASSWORD=<Aiven password>
   DB_NAME=pinepal_db
   DB_SSL_CA=ca.pem
   JWT_SECRET_KEY=<any long random string>
   ADMIN_PASSWORD=<password for the admin account>
   ```
3. Run:
   ```
   cd backend
   pip install -r requirements.txt
   python setup_db.py      # creates missing tables, the disease list and the admin account (admin@pinepal.com)
   python app.py           # http://127.0.0.1:5000
   ```

Other backend scripts:

| Script | What it does |
| --- | --- |
| `python reset_admin_password.py` | sets the `admin` login's password to `ADMIN_PASSWORD` |
| `python seed_sample_scans.py` | adds 60 example scans (`--remove` deletes only those) |
| `python import_mobile_scans.py` | copies scans from a local XAMPP MySQL into Aiven (see below) |

### 2. Web dashboard

From the project root, in another terminal:

```
npm install
npm run dev
```

`.env` in the project root holds `VITE_API_URL` (default `http://127.0.0.1:5000`), the address of the Flask backend. The database is on Aiven; only the API runs on this computer.

### 3. Scan data

The dashboard reads the mobile app's scans from the `mobile_scans` table. To copy scans from an old local XAMPP setup (`db_bueno.scans` and `pinepal_db.mobile_scans`) into Aiven, put the local connection in `backend/.env.xampp` (same keys as `.env`, e.g. `DB_HOST=localhost`, `DB_USER=root`), start XAMPP's MySQL, then:

```
cd backend
python import_mobile_scans.py
```

The script is safe to re-run (scans already on Aiven are skipped) and never changes the local databases. Scans are not stored in git, so a fresh setup has none until you import them, restore a database export or run `seed_sample_scans.py`.

## Notes

- Roles: `admin`, `officer` (staff pages) and `farmer` (own scans and guides). Only admins can delete scans.
- The Disease Map is temporarily locked to Echague. Set `LOCKED_MUNICIPALITY` to `""` in `src/utils/diseases.js` to show all of Isabela again.
- Municipality borders come from GADM 4.1 (https://gadm.org, free for non-commercial use).
