import { Link, Navigate } from "react-router-dom"
import {
  ArrowRightIcon,
  BookOpenIcon,
  CameraIcon,
  ClipboardCheckIcon,
  MapPinIcon,
  RefreshCwIcon,
  ScanLineIcon,
  SmartphoneIcon,
  StethoscopeIcon,
  UsersIcon,
  WifiOffIcon,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import logo from "../assets/pinepal-logo.png"
import ThemeToggle from "../components/ThemeToggle"
import AppShowcase from "../components/AppShowcase"
import { DISEASES, LOCKED_MUNICIPALITY } from "../utils/diseases"
import { Button } from "@/components/ui/button"

// What PinePal does, one card each
const FEATURES = [
  {
    icon: ScanLineIcon,
    title: "Scan and diagnose",
    text: "Take a photo of a pineapple. PinePal's model tells you which disease it sees and how sure it is.",
  },
  {
    icon: BookOpenIcon,
    title: "Know what to do",
    text: "Every diagnosis comes with care steps to treat the disease and keep it from spreading.",
  },
  {
    icon: MapPinIcon,
    title: "See where it spreads",
    text: "Each scan is placed on a map, so outbreaks show up early and officers know where to go.",
  },
  {
    icon: WifiOffIcon,
    title: "Works in the field",
    text: "The mobile app scans without internet and syncs your scans once you are back online.",
  },
]

// How it works, from the farm to the officer
const STEPS = [
  {
    icon: CameraIcon,
    title: "Scan",
    text: "A farmer photographs a fruit with the PinePal app or uploads one on this site.",
  },
  {
    icon: StethoscopeIcon,
    title: "Diagnose",
    text: "The model names the disease, with its confidence and the care steps.",
  },
  {
    icon: RefreshCwIcon,
    title: "Sync",
    text: "The scan and its location reach the dashboard when the phone is online.",
  },
  {
    icon: ClipboardCheckIcon,
    title: "Review",
    text: "Agricultural officers check unsure scans and follow outbreaks on the map.",
  },
]

// Who uses it and what they get
const AUDIENCES = [
  {
    icon: SmartphoneIcon,
    title: "For farmers",
    points: [
      "Check a fruit in seconds, right in the field",
      "Keep a history of every scan on your farm",
      "Follow care guides for each disease",
    ],
  },
  {
    icon: UsersIcon,
    title: "For agricultural officers",
    points: [
      "A dashboard of cases, month by month",
      "A disease map with dots or a heat map",
      "Review and correct uncertain diagnoses",
    ],
  },
]

const sectionTitle = "text-3xl font-semibold tracking-tight sm:text-4xl"

// The public front page: what PinePal is, before signing in.
// Someone already signed in goes straight to their home page.
function Landing() {
  const { user } = useAuth()
  if (user) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* top bar */}
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/welcome" className="flex items-center gap-2">
            <img src={logo} alt="" className="size-8" />
            <span className="font-semibold">PinePal</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--primary)_1px,transparent_1px)] [background-size:22px_22px] opacity-15"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium">
                <MapPinIcon className="size-3.5 text-primary-text" /> Pineapple disease monitoring for Echague, Isabela
              </span>
              <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Spot pineapple disease <span className="text-primary-text">before it spreads</span>.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                PinePal is a pineapple disease detection system. Farmers scan their fruit with a phone, get a diagnosis
                and care steps, and agricultural officers see where disease is showing up across the farms.
              </p>
            </div>
            <div className="hidden justify-center sm:flex">
              <AppShowcase />
            </div>
          </div>
        </section>

        {/* what it does */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className={sectionTitle}>What PinePal does</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              One system for the farm and the agriculture office: from a photo of a single fruit to a picture of the
              whole area.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border bg-card p-5 shadow-sm">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <f.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* diseases it detects */}
        <section className="border-t">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:items-center">
            <div>
              <h2 className={sectionTitle}>What it can detect</h2>
              <p className="mt-3 text-muted-foreground">
                PinePal recognizes {DISEASES.length - 1} common pineapple problems, and tells healthy fruit apart from
                diseased fruit. When it isn't sure, the scan is flagged so an officer can check it.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {DISEASES.map((d) => (
                <li key={d.label} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="font-medium">{d.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* how it works */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className={sectionTitle}>How it works</h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative rounded-2xl border bg-card p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary-text">
                      {i + 1}
                    </span>
                    <s.icon className="size-5 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* who it is for */}
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className={sectionTitle}>Who it's for</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {AUDIENCES.map((a) => (
                <div key={a.title} className="rounded-2xl border bg-card p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary-text">
                      <a.icon className="size-5" />
                    </span>
                    <h3 className="text-lg font-semibold">{a.title}</h3>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    {a.points.map((p) => (
                      <li key={p} className="flex gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Farmers sign up themselves. Officer and admin accounts are added by an admin.
            </p>
          </div>
        </section>
      </main>

      {/* pb leaves room for the Get started bar, so it never covers the footer */}
      <footer className="border-t pb-24">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex items-center gap-2">
            <img src={logo} alt="" className="size-5" /> PinePal
          </span>
          <span>
            Pineapple disease monitoring for Echague, Isabela
            {LOCKED_MUNICIPALITY ? ` · Now serving ${LOCKED_MUNICIPALITY}` : ""}
          </span>
        </div>
      </footer>

      {/* the only way in from here: always at the bottom of the screen, opens the login page */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <p className="hidden text-sm text-muted-foreground sm:block">Ready to check your pineapples?</p>
          <Button size="lg" className="h-12 w-full rounded-full px-8 text-base sm:w-auto" render={<Link to="/login" />}>
            Get started <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Landing
