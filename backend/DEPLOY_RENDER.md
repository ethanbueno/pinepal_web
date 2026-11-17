# Putting the API on Render

The Flask backend runs on Render and the database stays on Aiven MySQL, so the
mobile app and the dashboard work from anywhere, on Wi-Fi or mobile data.
`render.yaml` in the project root has the setup.

## 1. Deploy

1. Push this repository to GitHub (with `render.yaml` and the updated `requirements.txt`).
2. On render.com: **New > Blueprint**, pick this repository. Render reads
   `render.yaml` and creates the `pinepal-api` web service.
3. When it asks for the values marked `sync: false`, copy them from `backend/.env`:

   | Variable | Value |
   | --- | --- |
   | `DB_HOST` | Aiven host |
   | `DB_PORT` | Aiven port |
   | `DB_USER` | Aiven user |
   | `DB_PASSWORD` | Aiven password |
   | `JWT_SECRET_KEY` | the same one as in `.env`, so existing logins keep working |

   `DB_NAME` (`pinepal_db`), `DB_SSL_CA` and `PYTHON_VERSION` are already set.
4. In the service: **Environment > Secret Files > Add**, name `ca.pem`, paste the
   contents of `backend/ca.pem`. Render puts it at `/etc/secrets/ca.pem`, which is
   what `DB_SSL_CA` points to.
5. Wait for the deploy, then open `https://<your-service>.onrender.com/`. It should
   say `PinePal API is running`.

On Aiven, if the service only allows some IP addresses, allow Render's outbound
addresses (shown in the Render service under **Connect > Outbound**) or allow all.

## 2. Point the apps at it

Mobile app (in `pinepal_mobile`):

```
flutter build apk --release --dart-define=PINEPAL_API_URL=https://<your-service>.onrender.com
```

Web dashboard: set `VITE_API_URL=https://<your-service>.onrender.com` when building it.

## Things to know

- **The free plan sleeps** after about 15 minutes without requests. The first request
  after that takes up to a minute while it starts, so the app's first login can time
  out and work on the second try. A paid instance does not sleep.
- **Uploaded photos are not kept.** Render's disk is wiped on every deploy and
  restart, so photos synced into `backend/uploads/` disappear (the scan rows stay in
  MySQL). To keep them, store photos in a bucket (Cloudinary, S3, Cloudflare R2) or
  add a Render disk (paid plans).
- The dashboard that `python app.py` starts on your laptop is not started on Render:
  gunicorn imports `app.py` without running its `__main__` part.
- Locally nothing changes: `python app.py` still works as before.
