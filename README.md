# PinePal Web

Web dashboard for **PinePal**, a pineapple disease detection system. Farmers scan fruit with the PinePal mobile app, scans sync to a Flask + MySQL backend, and officers monitor cases here: a dashboard, a disease map of Isabela, scans and verification, farmers, and CSV export. Admins and officers can also diagnose a photo on the web with the MobileNetV2 model in `backend/model/`.

- **Front end:** React, Vite, Tailwind, shadcn/ui, Recharts, Leaflet (`src/`)
- **Back end:** Flask, MySQL (`backend/`)

## Features

| Area | What it does | Who |
| --- | --- | --- |
| Dashboard | Scans needing review, totals, diseased share, monthly trend, disease breakdown, recent scans, municipality ranking | staff |
| Disease Map | Scans plotted by diagnosis on the borders of Isabela's cities and municipalities | staff |
| Scans | Filterable list, scan detail, officer verification | staff |
| Diagnose | Upload a photo, get a diagnosis, save it as a scan | staff |
| Farmers | Add, edit and deactivate farmers; scans per farmer | staff |
| Users | Add, edit and manage accounts and roles | admin |
| Export | CSV download with filters | staff |
| My Farm, My Scans | A farmer's own farm and scans | farmer |

In progress: treatment Protocols and farmer Guides, Excel export, and syncing scans from the mobile app.

## Project structure

```
src/        React app (pages, components, API calls)
backend/    Flask API, database scripts and the MobileNetV2 model
```

## Setup

You need Node.js and Python installed.

### 1. Private settings

The backend needs private connection settings that are not part of this repository. Ask the team for them, and use `backend/.env.example` as the template for your own `backend/.env`. Never commit that file or any other private file.

### 2. Backend

```
cd backend
pip install -r requirements.txt
python setup_db.py      # creates any missing tables
python app.py           # http://127.0.0.1:5000
```

Other backend scripts (run from `backend/`):

| Script | What it does |
| --- | --- |
| `python migrate_farmers.py` | creates the `farmers` table and fills it from the scans |
| `python migrate_farmer_feedback.py` | adds the farmer-feedback columns to the scans table |
| `python seed_sample_scans.py` | adds 60 example scans (`--remove` deletes only those) |
| `python import_mobile_scans.py` | copies scans from an older local database into the current one |

### 3. Web dashboard

From the project root, in another terminal:

```
npm install
npm run dev
```

The `.env` in the project root only holds the address of the backend API (`VITE_API_URL`, default `http://127.0.0.1:5000`).

### 4. Scan data

Scans are not stored in git. A fresh setup has none until you import them, restore a database export, or run `seed_sample_scans.py`.

## Notes

- Roles: `admin`, `officer` (staff pages) and `farmer` (own farm and scans).
- The Disease Map and Export are temporarily locked to Echague. Set `LOCKED_MUNICIPALITY` to `""` in `src/utils/diseases.js` to show all of Isabela again.
- Municipality borders come from GADM 4.1 (https://gadm.org, free for non-commercial use).
