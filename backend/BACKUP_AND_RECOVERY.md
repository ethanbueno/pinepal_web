# Backup and recovery plan

PinePal keeps two kinds of data that would be lost in an accident:

| What | Where it lives | Backed up by |
| --- | --- | --- |
| Accounts, farmers, scans, sign-ins, audit logs | MySQL on Aiven (`pinepal_db`) | `backup.py`, plus Aiven's own automatic backups |
| Scan photos | `backend/uploads/` on the laptop running the backend (not in git) | `backup.py` |
| Code | GitHub | git itself |

## How to back up

From the `backend` folder:

```
python backup.py
```

This saves `backups/pinepal_backup_YYYY-MM-DD_HHMMSS.zip`. It contains:

- every table's structure and rows
- the triggers
- every scan photo
- a manifest with row counts and SHA-256 checksums

The database dump and the photos are **encrypted** inside the zip (Fernet: AES-128 plus an
HMAC-SHA256 signature) with `DATA_ENCRYPTION_KEY` from `.env`, so a lost or copied backup can't
be read. `restore.py` decrypts them with the same key. Keep a copy of the key apart from the
backups (a password manager): **a backup can't be restored without it**. If the key isn't set,
`backup.py` warns and saves an unencrypted backup.

Today a backup is under 1 MB and takes a few seconds. To save it straight to another drive, use `python backup.py --out E:\pinepal-backups`.

From the web, an admin can also open **Settings > Backup** and click **Download backup**. It makes the same encrypted zip and downloads it to their computer; nothing is kept on the server (Render's disk is wiped on restart). It needs `DATA_ENCRYPTION_KEY` and the database admin login (`DB_ADMIN_USER` / `DB_ADMIN_PASSWORD`, or `DB_USER` being the admin) set on the server, and it is recorded in the audit logs. Restoring is never done from the web.

## When and where

| When | Why |
| --- | --- |
| Once a day while the system is in use | Losing at most one day of scans |
| Before running any `migrate_*.py` script | A migration changes tables; a backup lets you undo it |
| Before a demo or defense | So a mistake during the demo can be rolled back |
| Before a full restore | `restore.py --live` does this for you automatically |

Keep **three copies in two places** (the 3-2-1 idea, scaled down):

1. `backend/backups/` on the laptop
2. A shared Google Drive folder for the team
3. A USB stick, for the backups before migrations and demos

Keep at least the last 7 daily backups. Backups contain farmer names, farm locations and password hashes, so share the Drive folder only with the team.

## How to check a backup works (the recovery drill)

```
python restore.py
```

This restores the newest backup into a **separate test database** (`pinepal_restore_test`). The real data is never touched. The script then checks:

- the zip against its checksums, so you know it isn't damaged
- every table's row count against the backup's counts
- the triggers and the photos

It ends with `RESULT: everything in the backup was restored`. Add `--drop-test` to delete the test database afterwards. Run the drill once a week, and after any change to `backup.py`.

Every backup and restore also shows on the admin **Audit logs** page.

## How to recover

### A record was deleted or changed by mistake

1. On the **Audit logs** page, find the change. Its detail view shows every old value.
2. Re-enter the values on the website. For many records, restore the last backup into the test database (`python restore.py`) and copy the rows you need from `pinepal_restore_test`.

### The database is broken or wiped

```
python restore.py backups/pinepal_backup_<date>.zip --live
```

The script asks you to type the database name, then makes a safety backup of the current state. Only after that does it replace the database and the photo folder. Afterwards, run `python create_app_user.py` and restart the backend.

### The laptop with the backend is lost or broken

1. Clone the repository on the new laptop and set up `backend/.env`. Ask the team for the logins.
2. Take the newest backup from Google Drive or the USB stick and put it in `backend/backups/`.
3. If the database on Aiven is fine, only the photos need to come back. Run `python restore.py`, then copy `backups/restore_test_uploads/` into `uploads/`.
4. If the database is gone too, create a new MySQL service. Put its details in `.env`, then run `python restore.py <file> --live` and `python create_app_user.py`.

### Aiven's own backups

Aiven also backs up the database automatically, including on the free plan. That is a second safety net if every local copy is lost. Check the service's **Backups** tab in the Aiven console to see what is kept. On the free plan, you can't trigger or restore those yourself, so `backup.py` is the main plan.

## Who does it

| Task | Who | How often |
| --- | --- | --- |
| Run `backup.py` and copy the zip to Drive | Whoever runs the backend that day | Daily while in use |
| Recovery drill (`restore.py`) | One assigned team member | Weekly |
| Backup before migrations and demos | Whoever runs the migration or demo | Each time |
