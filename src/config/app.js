// Where the Android app (APK) is downloaded from, until an admin saves another link on
// Settings > Mobile app (stored in the database, see hooks/useAppDownloadUrl.js). The login
// page's Download button and the sidebar's "Download mobile app" card fall back to this.
// PinePal.apk on Google Drive. A Drive *file* link downloads the APK straight away (utils/download.js);
// a folder link would only open Drive. Switch to the Play Store listing once it's published.
export const APP_DOWNLOAD_URL =
  "https://drive.google.com/file/d/1UcgiNe6jjr7UAi26dIyt1VE_BE4LZeq4/view?usp=drive_link"
