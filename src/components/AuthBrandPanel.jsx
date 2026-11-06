import logo from "../assets/pinepal-logo.png"
import AppShowcase from "./AppShowcase"
import { cn } from "@/lib/utils"

// The brand half of the Login and Register pages: logo, headline and the app showcase.
// side="left" on Login (form on the right), side="right" on Register (form on the left).
// On small screens only the logo and headline stay, above the form.
function AuthBrandPanel({ side = "left" }) {
  return (
    <section
      className={cn(
        "relative flex flex-col overflow-hidden px-6 pt-8 pb-2 sm:px-10 lg:px-14 lg:py-12",
        side === "left" ? "lg:border-r" : "lg:order-last lg:border-l"
      )}
    >
      <div className="flex items-center gap-2.5">
        <img src={logo} alt="" className="size-11 lg:size-14" />
        <span className="text-xl font-semibold tracking-wide uppercase lg:text-2xl">PinePal</span>
      </div>

      {/* Laptops: showcase above the headline, scaled down to fit the half-width column.
          Wide screens (2xl): headline bottom-left with the showcase beside it. */}
      <div className="mt-8 flex flex-1 flex-col gap-6 lg:mt-4 2xl:flex-row 2xl:items-center 2xl:gap-6">
        <div className="hidden h-[400px] justify-center lg:flex 2xl:order-last 2xl:h-auto 2xl:flex-1">
          <div className="origin-top scale-[0.83] 2xl:scale-100">
            <AppShowcase />
          </div>
        </div>
        <h1 className="max-w-md text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:max-w-xl 2xl:max-w-[16rem] 2xl:self-end 2xl:pb-10 2xl:text-6xl">
          Spot pineapple disease <span className="text-primary-text">before it spreads</span>.
        </h1>
      </div>

      <p className="mt-4 hidden max-w-md text-sm text-muted-foreground lg:block">
        Scan a fruit, get the diagnosis and treatment steps, and see where outbreaks are happening across Isabela.
      </p>
    </section>
  )
}

export default AuthBrandPanel
