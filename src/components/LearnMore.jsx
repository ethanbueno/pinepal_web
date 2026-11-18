import { useEffect, useRef } from "react"
import {
  CameraIcon,
  ClipboardListIcon,
  CloudUploadIcon,
  GaugeIcon,
  MapIcon,
  ScanSearchIcon,
  ShieldCheckIcon,
  SunIcon,
  WifiOffIcon,
} from "lucide-react"
import { HIGH_CONFIDENCE, LOW_CONFIDENCE } from "../utils/diseases"
import { cn } from "@/lib/utils"

const STEPS = [
  {
    icon: CameraIcon,
    title: "Take a photo",
    text: "Open the PinePal mobile app and point the camera at the fruit.",
  },
  {
    icon: ScanSearchIcon,
    title: "Get a diagnosis",
    text: "The app checks the photo right on your phone, even without internet, and names the disease with a confidence score.",
  },
  {
    icon: ClipboardListIcon,
    title: "Follow the treatment",
    text: "Every result comes with step-by-step treatment and prevention advice for that disease.",
  },
  {
    icon: MapIcon,
    title: "Track your farm",
    text: "Your scans sync to your account once you're online. Agricultural officers use them to spot outbreaks early.",
  },
]

const pct = (value) => `${Math.round(value * 100)}%`

const GOOD_TO_KNOW = [
  {
    icon: SunIcon,
    title: "Getting a good photo",
    text: "Use daylight, keep the whole fruit in the frame, and hold the phone steady. One fruit per photo.",
  },
  {
    icon: GaugeIcon,
    title: "What the confidence score means",
    text: `${pct(HIGH_CONFIDENCE)} or more: the app is sure. ${pct(LOW_CONFIDENCE)} to ${pct(HIGH_CONFIDENCE)}: likely right. Below ${pct(LOW_CONFIDENCE)}: unsure, so take another photo and an agricultural officer will review it.`,
  },
  {
    icon: WifiOffIcon,
    title: "No signal in the field?",
    text: "Scanning works offline. Results wait on your phone and upload by themselves the next time you're online.",
  },
  {
    icon: CloudUploadIcon,
    title: "One account, phone and web",
    text: "Sign in to the mobile app with this same account. Scans from the phone show up here on Home and in My Scans.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Who sees your scans",
    text: "Only you and PinePal's agricultural officers and admins. Officers may check a result and correct it.",
  },
]

const ACCENT = "text-[#8a5f00] dark:text-primary"

function Heading({ eyebrow, title }) {
  return (
    <div className="mb-4">
      <p className={cn("mb-1 text-xs font-semibold tracking-widest uppercase", ACCENT)}>{eyebrow}</p>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
    </div>
  )
}

// What a farmer needs to know about PinePal. On the Home page it sits right under the welcome
// card, hidden until "Learn more" is pressed, and opens with a short slide.
function LearnMore({ open, id }) {
  const ref = useRef(null)

  // bring it into view when it opens
  useEffect(() => {
    if (!open) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const timer = setTimeout(
      () => ref.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }),
      reduce ? 0 : 150
    )
    return () => clearTimeout(timer)
  }, [open])

  return (
    // grid rows 0fr -> 1fr animates the height without measuring it
    <div
      id={id}
      ref={ref}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "grid scroll-mt-6 transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="space-y-6 pt-6">
          <section>
            <Heading eyebrow="How it works" title="From photo to treatment in four steps" />
            <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="relative rounded-xl bg-card ring-1 ring-foreground/10 p-5">
                  <span className="absolute top-4 right-5 text-4xl font-semibold text-muted-foreground/20 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className={cn("mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/15", ACCENT)}>
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>
          </section>


          <section>
            <Heading eyebrow="Good to know" title="Tips for the best results" />
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {GOOD_TO_KNOW.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3 rounded-xl bg-card ring-1 ring-foreground/10 p-4">
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15", ACCENT)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">{title}</p>
                    <p className="mt-1 leading-relaxed text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

export default LearnMore
