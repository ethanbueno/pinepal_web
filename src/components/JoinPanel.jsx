import { BookOpenIcon, MapPinIcon, ScanLineIcon, WifiOffIcon } from "lucide-react"
import logo from "../assets/pinepal-logo.png"

// What happens after signing up, shown next to the Register form
const STEPS = [
  { icon: ScanLineIcon, title: "Scan a pineapple", text: "Take a photo of the fruit with the app or upload one here." },
  { icon: BookOpenIcon, title: "Get the care guide", text: "See the diagnosis with the steps to treat and prevent it." },
  { icon: MapPinIcon, title: "Track your farm", text: "Keep every scan in one history and see where problems show up." },
]

// The side panel of the Register page. It is on purpose different from the Login panel:
// a warm amber surface with a dot pattern, a "Join PinePal" headline and how it works in 3 steps.
function JoinPanel() {
  return (
    <section className="relative overflow-hidden bg-primary/10 px-6 pt-8 pb-8 sm:px-10 lg:order-last lg:flex lg:flex-col lg:justify-center lg:border-l lg:px-14 lg:py-12">
      {/* soft dot pattern over the amber */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--primary)_1px,transparent_1px)] [background-size:22px_22px] opacity-25"
      />

      <div className="relative max-w-lg">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="" className="size-10" />
          <span className="text-lg font-semibold tracking-wide uppercase">PinePal</span>
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
          Join <span className="text-primary-text">PinePal</span>
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          A free farmer account for checking your pineapples and keeping your farm healthy.
        </p>

        <ol className="mt-6 space-y-2 lg:mt-8 lg:space-y-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm lg:items-start lg:gap-4 lg:p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground lg:size-10">
                <step.icon className="size-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">
                  {i + 1}. {step.title}
                </div>
                {/* the explanation only on laptops, so the form is not pushed far down on phones */}
                <p className="mt-0.5 hidden text-sm text-muted-foreground lg:block">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 hidden items-center lg:inline-flex gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium">
          <WifiOffIcon className="size-3.5 text-primary-text" /> The mobile app also works offline
        </div>
      </div>
    </section>
  )
}

export default JoinPanel
