import { useCallback, useEffect, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import logo from "../assets/pinepal-logo.png"
import { downloadLinkProps } from "../utils/download"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const AUTOPLAY_MS = 7000
const ACCENT = "text-[#8a5f00] dark:text-primary"

// The headline with one part in the welcome card's deep amber, like "early" on the old card
function Highlighted({ text, word }) {
  const at = word ? text.indexOf(word) : -1
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <span className={ACCENT}>{word}</span>
      {text.slice(at + word.length)}
    </>
  )
}

// One slide's button, the dashboard's standard button: an action (onClick) or a link out (href)
function SlideAction({ action, active }) {
  const tabIndex = active ? 0 : -1
  if (action.href) {
    return (
      <Button
        size="lg"
        tabIndex={tabIndex}
        render={<a {...downloadLinkProps(action.href)} />}
        nativeButton={false}
      >
        {action.label}
      </Button>
    )
  }
  return (
    <Button size="lg" tabIndex={tabIndex} onClick={action.onClick}>
      {action.label}
    </Button>
  )
}

// The banner across the top of the farmer Home. Every slide has the same layout: on the left
// a label with the PinePal logo, a headline with one part in amber, a line of text and a button.
// They are pinned (label and headline from the top, the button near the bottom), not centred,
// so they sit in the same place on every slide however long the headline is;
// on the right the same slanted picture with amber stripes along the slant. The picture is a
// photo, or the slide's own content (visual), drawn in the same frame. Arrows on the sides,
// dots below. It moves on every few seconds, waits while the pointer or keyboard focus is on
// it, and stays put for people who turn off animations.
//
// It is styled like the dashboard's cards (rounded-xl, a thin ring, the app's buttons and
// heading sizes) in the old welcome card's light amber, so it follows light and dark mode.
//
// slides: [{ label, title, highlight, text, action: { label, onClick | href },
//            image  or  visual(active) }]   (active is false while the slide is hidden)
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
      className="relative h-[300px] overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 via-card to-card text-card-foreground ring-1 ring-foreground/10 sm:h-[310px]"
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
            {/* the picture: the same slanted frame on every slide */}
            <div className="absolute inset-y-0 right-0 w-full sm:w-[54%] sm:[clip-path:polygon(18%_0,100%_0,100%_100%,0_100%)]">
              {slide.visual ? (
                slide.visual(active)
              ) : (
                <img src={slide.image} alt="" className="size-full object-cover" />
              )}
            </div>
            {/* phones: the picture sits behind the text, faded so the text stays readable */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card via-card/90 to-card/50 sm:hidden" />
            {/* amber stripes along the slant */}
            <div aria-hidden className="absolute inset-y-0 left-[38%] hidden w-[20%] sm:block">
              <div className="absolute inset-y-0 left-[16%] w-[16%] -skew-x-[13deg] bg-primary/35" />
              <div className="absolute inset-y-0 left-[36%] w-[10%] -skew-x-[13deg] bg-primary/55" />
              <div className="absolute inset-y-0 left-[50%] w-[7%] -skew-x-[13deg] bg-primary/80" />
            </div>

            {/* the text, from the top; at most 2 lines each, so it never reaches the button */}
            <div className="pointer-events-none relative px-12 pt-8 sm:w-[41%] sm:pt-9">
              <p className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-card/80 px-2.5 py-1 text-xs font-medium ring-1 ring-foreground/10 backdrop-blur">
                <img src={logo} alt="" className="size-3.5" />
                {slide.label}
              </p>
              <h2 className="line-clamp-2 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
                <Highlighted text={slide.title} word={slide.highlight} />
              </h2>
              <p className="mt-2 line-clamp-2 max-w-md text-sm text-muted-foreground sm:text-base">{slide.text}</p>
            </div>
            {/* the button: a fixed spot in the banner, the same on every slide whatever the text */}
            <div className="absolute bottom-11 left-12">
              <SlideAction action={slide.action} active={active} />
            </div>
          </div>
        )
      })}

      {count > 1 && (
        <>
          <Button
            variant="outline"
            size="icon"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute top-1/2 left-2 -translate-y-1/2 bg-card/90"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute top-1/2 right-2 -translate-y-1/2 bg-card/90"
          >
            <ChevronRightIcon />
          </Button>

          <div className="absolute bottom-4 left-12 flex gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.title}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}: ${slide.title}`}
                aria-current={i === index}
                className={cn(
                  "h-1.5 rounded-full transition-all focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  i === index ? "w-6 bg-primary" : "w-1.5 bg-foreground/25 hover:bg-foreground/40"
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
