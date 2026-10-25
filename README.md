# PinePal Web

Web dashboard for PinePal, a pineapple disease detection system. Farmers scan with the PinePal mobile app, scans sync to a Flask + MySQL backend, and officers monitor cases here: dashboard, disease map of Isabela, scans, farmers, protocols and CSV export. Admins and officers can also diagnose a photo on the web using the MobileNetV2 model in `backend/model/`.

- **Front end:** React + Vite + Tailwind (this folder, `src/`)
- **Back end:** Flask + MySQL (`backend/`)

## Setup

### 1. Backend

1. Install and start MySQL (XAMPP).
2. Create `backend/.env`. This file is git-ignored, so passwords never end up in the repo:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=pinepal_db
   JWT_SECRET_KEY=<any long random string>
   ADMIN_PASSWORD=<password for the admin account>
   ```
3. Run:
   ```
   cd backend
   pip install -r requirements.txt
   python setup_db.py      # creates tables, the disease list and the admin account (admin@pinepal.com)
   python app.py           # http://127.0.0.1:5000
   ```

### 2. Web dashboard

From the project root, in another terminal:

```
npm install
npm run dev
```

`.env` in the project root holds `VITE_API_URL` (default `http://localhost:5000`). Change it to point the dashboard at a different API host.

### 3. Scan data

The dashboard reads the mobile app's scans from the `mobile_scans` table. To copy them from the mobile app's `db_bueno` database on the same MySQL server:

```
cd backend
python import_mobile_scans.py
```

The script is safe to re-run (rows already imported are skipped). Scans are not stored in git, so a fresh setup has none until you import them or restore a database export.

## Notes

- Roles: `admin`, `officer` (staff pages) and `farmer` (own scans and guides). Only admins can delete scans.
- The Disease Map is temporarily locked to Echague. Set `LOCKED_MUNICIPALITY` to `""` in `src/utils/diseases.js` to show all of Isabela again.
- Municipality borders come from GADM 4.1 (https://gadm.org, free for non-commercial use).
