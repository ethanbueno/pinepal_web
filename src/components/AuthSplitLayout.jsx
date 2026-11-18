import { SmartphoneIcon } from "lucide-react"
import logo from "../assets/pinepal-logo.png"
import ThemeToggle from "./ThemeToggle"
import AuthPhotoSlideshow from "./AuthPhotoSlideshow"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAppDownloadUrl } from "../hooks/useAppDownloadUrl"
import { downloadLinkProps } from "../utils/download"

// Eased left-edge fade for the photo half (smoothstep-like stops, so there's no visible band)
const PHOTO_FADE =
  "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.03) 2.5%, rgba(0,0,0,0.12) 5%, " +
  "rgba(0,0,0,0.27) 7.5%, rgba(0,0,0,0.45) 10%, rgba(0,0,0,0.63) 12.5%, rgba(0,0,0,0.79) 15%, " +
  "rgba(0,0,0,0.91) 17.5%, rgba(0,0,0,0.98) 20%, #000 22%)"

// Shared page for Login and Register.
// Laptops: two columns, the headline + form card + "Download Mobile App" on the left, a tall photo panel on the right.
// Phones and tablets: one column, no photo panel.
// headerAction is an extra button shown next to the theme toggle (Register uses it for "Back to Login").
// compact (Register) uses a smaller headline and drops "Download Mobile App" so the longer form fits without scrolling.
// showDownload={false} drops "Download Mobile App" (Forgot password).
function AuthSplitLayout({ title, tagline, headerAction, compact = false, showDownload = true, children }) {
  const appDownloadUrl = useAppDownloadUrl()
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2 lg:gap-6 lg:p-6">
      {/* light/dark: a bare icon in the bottom-left corner */}
      <ThemeToggle bare className="fixed bottom-3 left-3 z-20 text-muted-foreground hover:text-foreground" />
      <div className="flex min-h-screen flex-col px-4 pt-4 pb-8 sm:px-8 lg:min-h-0 lg:px-6 lg:py-0">
        {/* Header is pinned at h-10; the bigger logo overflows it (-my-2) and translate-y nudges it
            down visually, so nothing below moves */}
        <header className="flex h-10 translate-y-3 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="-my-2 size-14" />
            <span className="text-2xl font-semibold tracking-tight">PinePal</span>
          </div>
          {headerAction && <div className="flex items-center gap-2">{headerAction}</div>}
        </header>

        <main
          className={cn(
            "flex flex-1 items-start justify-center lg:items-center",
            compact ? "pt-6 lg:py-4" : "pt-10 lg:py-10"
          )}
        >
          <div className="w-full max-w-md">
            <h1
              className={cn(
                "text-center leading-[1.05] font-semibold tracking-tight",
                compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl xl:text-6xl"
              )}
            >
              {title}
            </h1>
            {tagline && (
              <p className={cn("mx-auto text-center text-sm text-muted-foreground", compact ? "mt-2 max-w-md" : "mt-4 max-w-sm")}>
                {tagline}
              </p>
            )}

            <div
              className={cn("rounded-[32px] border bg-card p-5 shadow-xs sm:p-7", compact ? "mt-4" : "mt-8")}
            >
              {children}
            </div>

            {!compact && showDownload && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  className="h-10 rounded-[10px] px-4 text-[15px]"
                  render={<a {...downloadLinkProps(appDownloadUrl)} />}
                  nativeButton={false}
                >
                  <SmartphoneIcon /> Download Mobile App
                </Button>
              </div>
            )}

            <p className={cn("flex items-center justify-center gap-1.5 text-xs text-muted-foreground", compact ? "mt-4" : "mt-6")}>
              <img src={logo} alt="" className="size-4" /> Pineapple disease monitoring for Echague, Isabela
            </p>
          </div>
        </main>
      </div>

      {/* Laptops only: the photos fill the whole right half, edge to edge, and fade into the page
          toward the middle. Negative margins cancel the page padding so nothing on the left moves. */}
      <aside
        className="sticky top-0 hidden h-screen overflow-hidden lg:-my-6 lg:-mr-6 lg:-ml-3 lg:block"
        style={{ maskImage: PHOTO_FADE, WebkitMaskImage: PHOTO_FADE }}
      >
        <AuthPhotoSlideshow />
      </aside>
      {/* Soft amber glow where the photo meets the page, so the seam feels warm instead of washed out */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-y-0 left-1/2 hidden w-72 -translate-x-1/3 bg-linear-to-r from-transparent via-[#f0b323]/15 to-transparent blur-2xl lg:block"
      />
    </div>
  )
}

export default AuthSplitLayout
