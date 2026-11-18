// Google Drive share links open the Drive page. For a single file, Drive also has a direct
// address that downloads the file itself (Content-Disposition: attachment). confirm=t skips
// the "can't scan this file for viruses" page Drive shows for big files like the APK.
//   https://drive.google.com/file/d/<id>/view?usp=...   -> direct download
//   https://drive.google.com/open?id=<id>, .../uc?id=<id> -> direct download
// Folder links and any other site are returned unchanged (a folder can't be downloaded).
const FILE_PATH = /drive\.google\.com\/file\/d\/([\w-]+)/
const ID_PARAM = /drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([\w-]+)/

export function directDownloadUrl(url) {
  if (!url) return url
  const match = url.match(FILE_PATH) || url.match(ID_PARAM)
  return match
    ? `https://drive.usercontent.google.com/download?id=${match[1]}&export=download&confirm=t`
    : url
}

// <a> attributes for a Download button: a direct download stays on this page (the browser
// just saves the file), anything else opens in a new tab.
export function downloadLinkProps(url) {
  const direct = directDownloadUrl(url)
  return direct !== url
    ? { href: direct }
    : { href: url, target: "_blank", rel: "noopener noreferrer" }
}
