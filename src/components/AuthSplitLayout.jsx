import { SmartphoneIcon } from "lucide-react"
import logo from "../assets/pinepal-logo.png"
import ThemeToggle from "./ThemeToggle"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Photo for the right-hand panel on laptops. Drop a pineapple farm photo in src/assets
// and point this at it (import it, then set AUTH_PHOTO = thatImport). While it is null
// the panel shows an amber-tinted placeholder with the logo.
const AUTH_PHOTO = null

// TODO: point this at the APK or Play Store listing once the app is published.
const APP_DOWNLOAD_URL = "#"

// Shared page for Login and Register.
// Laptops: two columns, the headline + form card + "Download mobile app" on the left, a tall photo panel on the right.
// Phones and tablets: one column, no photo panel.
// headerAction is an extra button shown next to the theme toggle (Register uses it for "Back to login").
// compact (Register) uses a smaller headline and drops "Download mobile app" so the longer form fits without scrolling.
function AuthSplitLayout({ title, tagline, headerAction, compact = false, children }) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2 lg:gap-6 lg:p-6">
      <div className="flex min-h-screen flex-col px-4 pt-4 pb-8 sm:px-8 lg:min-h-0 lg:px-6 lg:py-0">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="" className="size-10" />
            <span className="text-lg font-semibold">PinePal</span>
          </div>
          <div className="flex items-center gap-2">
            {headerAction}
            <ThemeToggle />
          </div>
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

            {!compact && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  className="h-10 rounded-[10px] px-4 text-[15px]"
                  render={<a href={APP_DOWNLOAD_URL} />}
                  nativeButton={false}
                >
                  <SmartphoneIcon /> Download mobile app
                </Button>
              </div>
            )}

            <p className={cn("flex items-center justify-center gap-1.5 text-xs text-muted-foreground", compact ? "mt-4" : "mt-6")}>
              <img src={logo} alt="" className="size-4" /> Pineapple disease monitoring for Echague, Isabela
            </p>
          </div>
        </main>
      </div>

      {/* Laptops only: tall photo panel that stays in view while the form column scrolls */}
      <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] overflow-hidden rounded-3xl border lg:block">
        {AUTH_PHOTO ? (
          <img src={AUTH_PHOTO} alt="Pineapple farm" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/35 via-primary/10 to-muted">
            <img src={logo} alt="" className="size-40 opacity-90 drop-shadow-sm" />
          </div>
        )}
      </aside>
    </div>
  )
}

export default AuthSplitLayout
