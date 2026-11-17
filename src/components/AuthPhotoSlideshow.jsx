import { useEffect, useState } from "react"
import farmSunlitRows from "../assets/auth/farm-sunlit-rows.jpg"
import farmMistyField from "../assets/auth/farm-misty-field.jpg"
import farmHarvest from "../assets/auth/farm-harvest.jpg"
import farmPineappleRows from "../assets/auth/farm-pineapple-rows.jpg"
import farmHarvestPile from "../assets/auth/farm-harvest-pile.jpg"
import farmMountainField from "../assets/auth/farm-mountain-field.jpg"
import { cn } from "@/lib/utils"

// Photos for the Login/Register photo panel. position keeps the subject in frame
// when the landscape photo is cropped to the tall panel.
const PHOTOS = [
  { src: farmSunlitRows, alt: "Pineapple ripening between rows of leaves", position: "58% center" },
  { src: farmMistyField, alt: "Pineapples growing in a misty field", position: "38% center" },
  { src: farmHarvest, alt: "A farmer harvesting pineapples into a crate", position: "40% center" },
  { src: farmPineappleRows, alt: "Ripe pineapples standing in a row", position: "55% center" },
  { src: farmHarvestPile, alt: "A pile of freshly harvested pineapples", position: "center" },
  { src: farmMountainField, alt: "A pineapple field below the mountains", position: "50% center" },
]

const SLIDE_MS = 6500 // how long each photo stays before the next fades in

// Fisher-Yates shuffle, so every visit starts on a different photo in a different order
function shuffled(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)"
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setReduced(media.matches)
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])
  return reduced
}

// Shuffled crossfade of farm photos under a warm amber tint.
// Pauses while the tab is hidden; with reduced motion it shows one still photo.
function AuthPhotoSlideshow({ className }) {
  const [photos] = useState(() => shuffled(PHOTOS))
  const [{ active, previous }, setSlide] = useState({ active: 0, previous: null })
  const [tabHidden, setTabHidden] = useState(() => document.hidden)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden)
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  // Next photo after SLIDE_MS
  useEffect(() => {
    if (reducedMotion || tabHidden || photos.length < 2) return
    const timer = setTimeout(
      () => setSlide((s) => ({ active: (s.active + 1) % photos.length, previous: s.active })),
      SLIDE_MS
    )
    return () => clearTimeout(timer)
  }, [active, reducedMotion, tabHidden, photos.length])

  return (
    <div className={cn("relative isolate size-full overflow-hidden bg-muted", className)}>
      {photos.map((photo, i) => (
        <img
          key={photo.src}
          src={photo.src}
          alt={i === active ? photo.alt : ""}
          aria-hidden={i !== active}
          decoding="async"
          style={{ objectPosition: photo.position }}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity ease-out",
            reducedMotion ? "duration-0" : "duration-[1600ms]",
            i === active ? "opacity-100" : "opacity-0",
            // slow push-in, kept on the outgoing photo too so it doesn't jump while fading out
            !reducedMotion && (i === active || i === previous) && "auth-photo-zoom"
          )}
        />
      ))}

      {/* Warm amber wash. Uses the light-theme amber (#f0b323) directly so the tint looks
          the same in light and dark mode. */}
      <div className="pointer-events-none absolute inset-0 bg-[#f0b323]/40 mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-[#f0b323]/10" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-[#f0b323]/25 via-transparent to-transparent" />

    </div>
  )
}

export default AuthPhotoSlideshow
