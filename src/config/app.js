// Where the Android app (APK) is downloaded from, until an admin saves another link on
// their Profile page (stored in the database, see hooks/useAppDownloadUrl.js). The login
// page's Download button and the sidebar's "Download mobile app" card fall back to this.
// Google Drive folder with the latest PinePal.apk (switch to the Play Store listing once it's published).
export const APP_DOWNLOAD_URL =
  "https://drive.google.com/drive/folders/1C0kV6LxyPJJgpBZnmGJDiV6yS7n9ArIf?usp=drive_link"
