import { useCallback, useEffect, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const AUTOPLAY_MS = 7000

// The headline with one word in the welcome card's deep amber, like "early" on the old card
function Highlighted({ text, word }) {
  const at = word ? text.indexOf(word) : -1
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <span className="text-[#8a5f00] dark:text-primary">{word}</span>
      {text.slice(at + word.length)}
    </>
  )
}

// One slide's button: an action (onClick), a page in the app (to) or a link out (href).
function SlideAction({ action, active }) {
  const className =
    "inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground shadow-sm transition hover:brightness-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
  const tabIndex = active ? 0 : -1
  if (action.href) {
    return (
      <a href={action.href} target="_blank" rel="noreferrer" className={className} tabIndex={tabIndex}>
        {action.label}
      </a>
    )
  }
  return (
    <button type="button" onClick={action.onClick} className={className} tabIndex={tabIndex}>
      {action.label}
    </button>
  )
}

// The banner across the top of the farmer Home: photo slides with a headline, a line of
// text and one button each, arrows on the sides and dots below. It moves on by itself every
// few seconds, waits while the pointer or keyboard focus is on it, and stays put for people
// who turn off animations.
//
// slides: [{ image, eyebrow, eyebrowIcon, title, highlight (a word of the title), text, action: { label, onClick | href } }]
// It uses the welcome card's light amber gradient, so it follows light and dark mode.
function HomeCarousel({ slides, label = "Highlights" }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduceMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  const count = slides.length

  const go = useCallback((next) => setIndex((next + count) % count), [count])

  useEffect(() => {
    if (paused || reduceMotion || count < 2) return
    const timer = setTimeout(() => go(index + 1), AUTOPLAY_MS)
    return () => clearTimeout(timer)
  }, [index, paused, reduceMotion, count, go])

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className="relative h-[360px] overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-card to-card text-foreground shadow-lg shadow-primary/10 sm:h-[340px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(index - 1)
        if (e.key === "ArrowRight") go(index + 1)
      }}
    >
      {slides.map((slide, i) => {
        const active = i === index
        return (
          <div
            key={slide.title}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}: ${slide.title}`}
            aria-hidden={!active}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none",
              active ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            {/* the photo fills the right side, cut on a slant like the stripes */}
            <img
              src={slide.image}
              alt=""
              className="absolute inset-y-0 right-0 h-full w-full object-cover sm:w-[62%] sm:[clip-path:polygon(22%_0,100%_0,100%_100%,0_100%)]"
            />
            {/* on phones the photo sits behind the text, darkened so the text stays readable */}
            <div className="absolute inset-0 bg-gradient-to-r from-card via-card/90 to-card/40 sm:hidden" />
            {/* amber stripes along the slant */}
            <div aria-hidden className="absolute inset-y-0 left-[30%] hidden w-[24%] sm:block">
              <div className="absolute inset-y-0 left-[18%] w-[16%] -skew-x-[14deg] bg-primary/35" />
              <div className="absolute inset-y-0 left-[38%] w-[10%] -skew-x-[14deg] bg-primary/55" />
              <div className="absolute inset-y-0 left-[52%] w-[7%] -skew-x-[14deg] bg-primary/80" />
            </div>

            <div className="relative flex h-full max-w-xl flex-col justify-center px-8 pb-8 sm:px-14 sm:pb-6">
              {slide.eyebrow && (
                <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-sm backdrop-blur">
                  {slide.eyebrowIcon && <img src={slide.eyebrowIcon} alt="" className="size-4" />}
                  {slide.eyebrow}
                </p>
              )}
              <h2 className="text-3xl leading-[1.1] font-semibold tracking-tight sm:text-4xl">
                <Highlighted text={slide.title} word={slide.highlight} />
              </h2>
              <p className="mt-3 max-w-md text-base text-muted-foreground sm:text-lg">{slide.text}</p>
              <div className="mt-6">
                <SlideAction action={slide.action} active={active} />
              </div>
            </div>
          </div>
        )
      })}

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute top-1/2 left-0 flex h-12 w-8 -translate-y-1/2 items-center justify-center rounded-r-md border bg-card/90 text-foreground shadow-sm transition hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute top-1/2 right-0 flex h-12 w-8 -translate-y-1/2 items-center justify-center rounded-l-md border bg-card/90 text-foreground shadow-sm transition hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChevronRightIcon className="size-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.title}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}: ${slide.title}`}
                aria-current={i === index}
                className={cn(
                  "size-2.5 rounded-full transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  i === index ? "w-6 bg-primary" : "bg-foreground/20 hover:bg-foreground/40"
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export default HomeCarousel
