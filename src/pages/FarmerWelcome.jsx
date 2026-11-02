import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowDownIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CameraIcon,
  ClipboardListIcon,
  ImagesIcon,
  MapIcon,
  ScanSearchIcon,
  SmartphoneIcon,
  SproutIcon,
  WifiOffIcon,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import logo from "../assets/pinepal-logo.png"
import AppShowcase from "../components/AppShowcase"
import { DISEASES } from "../utils/diseases"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const STEPS = [
  {
    icon: CameraIcon,
    title: "Take a photo",
    text: "Open the PinePal mobile app and point the camera at the fruit. Good light and the whole fruit in the frame give the best result.",
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
    text: "Once you are back online your scans sync to your account. You see them here, and agricultural officers use them to spot outbreaks early.",
  },
]

const PAGES = [
  {
    to: "/my-farm",
    icon: SproutIcon,
    title: "My Farm",
    text: "Your farm at a glance: scan totals, healthy versus diseased fruit, a map of where you scanned, and your latest results.",
  },
  {
    to: "/my-scans",
    icon: ImagesIcon,
    title: "My Scans",
    text: "Every scan you have made, with filters. Open one to see the photo, the diagnosis and where it was taken.",
  },
  {
    to: "/guides",
    icon: BookOpenIcon,
    title: "Guides",
    text: "Read about each disease: what it looks like, how to treat it, and how to stop it coming back.",
  },
]

// Fades its content up into place the first time it scrolls into view.
// Content is visible straight away for people who turn off animations.
function Reveal({ as: Tag = "div", children, className, delay = 0 }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || !("IntersectionObserver" in window)) {
      setShown(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-[opacity,translate] duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className
      )}
    >
      {children}
    </Tag>
  )
}

function SectionHeading({ eyebrow, title, text }) {
  return (
    <div className="mb-5 max-w-2xl">
      <p className="mb-1.5 text-xs font-semibold tracking-widest text-[#8a5f00] uppercase dark:text-primary">{eyebrow}</p>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {text && <p className="mt-1.5 text-muted-foreground">{text}</p>}
    </div>
  )
}

// Farmer home: an introduction to PinePal, how it works, and where to go next
function FarmerWelcome() {
  const { user } = useAuth()
  const firstName = user.full_name?.split(" ")[0] || user.username
  const diseaseCount = DISEASES.filter((d) => d.label !== "No_Disease").length

  const scrollToSteps = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" })
  }

  return (
    <div className="space-y-10 pb-6 sm:space-y-12">
      {/* Introduction */}
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-card to-card px-5 py-7 sm:px-8 sm:py-8">
        <div className="grid items-center gap-6 lg:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-sm backdrop-blur">
              <img src={logo} alt="" className="size-4" />
              Welcome, <span className="font-medium">{firstName}</span>
            </div>
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
              Catch pineapple diseases{" "}
              <span className="text-[#8a5f00] dark:text-primary">early</span>, right from your phone.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              PinePal looks at a photo of your pineapple, tells you if it is sick, and shows you what to do next.
              Every scan is saved here so you can follow the health of your farm over time.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button onClick={scrollToSteps} className="h-11 rounded-full px-6 text-base">
                See how it works <ArrowDownIcon />
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-full px-6 text-base"
                render={<Link to="/my-farm" />}
                nativeButton={false}
              >
                Go to My Farm
              </Button>
            </div>
            <dl className="mt-6 grid max-w-lg grid-cols-3 gap-4 border-t pt-5">
              <div>
                <dt className="text-xs text-muted-foreground">Detects</dt>
                <dd className="mt-1 font-semibold">{diseaseCount} diseases</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Scanning</dt>
                <dd className="mt-1 flex items-center gap-1.5 font-semibold">
                  <WifiOffIcon className="size-4 text-[#8a5f00] dark:text-primary" /> Offline
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Treatment</dt>
                <dd className="mt-1 font-semibold">Step by step</dd>
              </div>
            </dl>
          </Reveal>
          <Reveal delay={150} className="hidden lg:block">
            <div className="flex h-[384px] justify-center">
              <div className="origin-top scale-[0.8]">
                <AppShowcase />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-6">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="From photo to treatment in four steps"
            text="You only need your phone and a pineapple. Here is what happens each time you scan."
          />
        </Reveal>
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <Reveal as="li" key={title} delay={i * 100} className="relative h-full rounded-2xl border bg-card p-5">
                <span className="absolute top-4 right-5 text-4xl font-semibold text-muted-foreground/20 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/15 text-[#8a5f00] dark:text-primary">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </Reveal>
          ))}
        </ol>

        <Reveal className="mt-3">
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="font-semibold">What PinePal can recognise</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Each scan is sorted into one of these. The colour is the same everywhere in the app.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {DISEASES.map((d) => (
                <li
                  key={d.label}
                  className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
                  style={{ borderColor: d.color + "55", backgroundColor: d.color + "14" }}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* Explore the app */}
      <section>
        <Reveal>
          <SectionHeading
            eyebrow="Explore the app"
            title="Everything for your farm, in one place"
            text="Pick up where you left off. These pages are always in the menu on the left."
          />
        </Reveal>
        <div className="grid gap-3 md:grid-cols-3">
          {PAGES.map(({ to, icon: Icon, title, text }, i) => (
            <Reveal key={to} delay={i * 100} className="h-full">
              <Link
                to={to}
                className="group flex h-full flex-col rounded-2xl border bg-card p-5 transition-all hover:-translate-y-1 hover:border-foreground/40 hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:hover:translate-y-0"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-muted text-foreground">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium">
                  Open {title}
                  <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-3">
          <div className="flex flex-col items-start gap-4 rounded-2xl bg-foreground p-5 text-background sm:flex-row sm:items-center sm:p-6">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <SmartphoneIcon className="size-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Ready to scan?</h3>
              <p className="mt-1 text-sm opacity-75">
                New scans are taken with the PinePal mobile app. Log in there with this same account and your
                results show up here automatically.
              </p>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}

export default FarmerWelcome
