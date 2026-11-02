import { CircleCheckIcon, MapPinIcon, ScanLineIcon, ShieldCheckIcon, WifiOffIcon } from "lucide-react"
import logo from "../assets/pinepal-logo.png"
import DiseaseBadge from "./DiseaseBadge"
import { DISEASES } from "../utils/diseases"

// Scan pins on the mini map in the showcase, as [x, y, disease label]
const MAP_PINS = [
  [38, 30, "Crown_Rot"],
  [62, 22, "No_Disease"],
  [50, 48, "Fruit_Rot"],
  [28, 58, "No_Disease"],
  [70, 55, "Mealybug_Wilt"],
  [45, 72, "Crown_Rot"],
  [80, 36, "No_Disease"],
  [58, 84, "Multiple_Crown"],
]

const pinColor = (label) => DISEASES.find((d) => d.label === label)?.color

// What PinePal does, drawn as small pieces of the app floating together.
// Used on the login page and the farmer home page. It is 460x480, decoration only.
function AppShowcase() {
  return (
    <div className="relative mx-auto h-[480px] w-[460px] max-w-full select-none" aria-hidden="true">
      {/* disease map */}
      <div className="absolute top-6 left-0 w-48 rotate-[-4deg] rounded-2xl border bg-card p-3 shadow-lg">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
          <MapPinIcon className="size-3.5 text-primary" /> Disease map · Isabela
        </div>
        <div className="relative h-32 overflow-hidden rounded-lg bg-muted">
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full text-border" preserveAspectRatio="none">
            <path d="M20 10 L75 6 L92 40 L85 90 L35 95 L10 60 Z" fill="currentColor" opacity="0.6" />
          </svg>
          {MAP_PINS.map(([x, y, label]) => (
            <span
              key={`${x}-${y}`}
              className="absolute size-2.5 -translate-1/2 rounded-full ring-2 ring-card"
              style={{ left: `${x}%`, top: `${y}%`, backgroundColor: pinColor(label) }}
            />
          ))}
        </div>
      </div>

      {/* phone with a scan result */}
      <div className="absolute top-0 right-6 w-56 rounded-[28px] border bg-card p-2.5 shadow-2xl">
        <div className="mb-2 flex items-center justify-between px-2 pt-1 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">PinePal Scanner</span>
          <ScanLineIcon className="size-3.5" />
        </div>
        <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#e8f0dc] to-[#f6ead0] dark:from-[#1d2a1f] dark:to-[#2a2416]">
          <img src={logo} alt="" className="size-32 drop-shadow-md" />
          {/* viewfinder corners */}
          <span className="absolute top-3 left-3 size-5 rounded-tl-md border-t-2 border-l-2 border-primary" />
          <span className="absolute top-3 right-3 size-5 rounded-tr-md border-t-2 border-r-2 border-primary" />
          <span className="absolute bottom-3 left-3 size-5 rounded-bl-md border-b-2 border-l-2 border-primary" />
          <span className="absolute right-3 bottom-3 size-5 rounded-br-md border-r-2 border-b-2 border-primary" />
          <span className="login-scan-line absolute inset-x-4 h-0.5 rounded-full bg-primary shadow-[0_0_12px_2px] shadow-primary/60" />
        </div>
        <div className="space-y-2 px-2 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <DiseaseBadge label="Crown_Rot" />
            <span className="text-[11px] font-medium text-destructive">High severity</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Confidence</span>
            <span className="font-medium text-foreground">94%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[94%] rounded-full bg-primary" />
          </div>
        </div>
      </div>

      {/* treatment steps */}
      <div className="absolute bottom-4 left-6 w-60 rotate-[2deg] rounded-2xl border bg-card p-4 shadow-xl">
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-medium">
          <ShieldCheckIcon className="size-3.5 text-chart-2" /> What to do next
        </div>
        <ul className="space-y-2 text-[11px] text-muted-foreground">
          {["Isolate infected fruit", "Sanitise tools with 10% bleach", "Treat cuts with fungicide"].map((step) => (
            <li key={step} className="flex items-center gap-2">
              <CircleCheckIcon className="size-3.5 shrink-0 text-chart-2" /> {step}
            </li>
          ))}
        </ul>
      </div>

      {/* floating chips */}
      <div className="absolute top-[52%] left-[-8px] flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-md">
        <WifiOffIcon className="size-3.5 text-primary" /> Works offline
      </div>
      <div className="absolute right-0 bottom-20 flex items-center gap-1.5 rounded-full bg-chart-2 px-3 py-1.5 text-xs font-medium text-white shadow-md">
        <CircleCheckIcon className="size-3.5" /> Healthy fruit
      </div>
    </div>
  )
}

export default AppShowcase
