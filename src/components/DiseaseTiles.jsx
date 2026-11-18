import { Link } from "react-router-dom"
import { FOUND_DISEASES } from "../utils/diseases"
import { guideLink } from "../utils/guides"
import { cn } from "@/lib/utils"

// public/guides/<name>.jpg, the guide photos
const photoOf = (label) => `/guides/${label.toLowerCase()}.jpg`

// The diseases PinePal finds as photos side by side, each with its name in a dark caption bar
// and opening its guide. It fills the Home banner's picture frame on the "What PinePal
// recognises" slide (HomeCarousel), where the other slides show one photo.
// focusable is false while that slide is hidden, so Tab skips the photos.
function DiseaseTiles({ focusable = true, className }) {
  return (
    <ul className={cn("flex size-full", className)}>
      {FOUND_DISEASES.map((d) => (
        <li key={d.label} className="relative min-w-0 flex-1">
          <Link
            to={guideLink(d.label)}
            tabIndex={focusable ? 0 : -1}
            aria-label={`${d.name} guide`}
            className="group block size-full overflow-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
          >
            <img
              src={photoOf(d.label)}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
            />
            {/* the disease colour along the top, the name in a dark bar at the bottom */}
            <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: d.color }} />
            <span className="absolute inset-x-0 bottom-0 bg-black/65 px-1 py-2 text-center text-[10px] leading-tight font-semibold tracking-wide text-white uppercase sm:text-[11px]">
              {d.name}
            </span>
          </Link>
          {/* a thin line between the photos */}
          <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-white/40" />
        </li>
      ))}
    </ul>
  )
}

export default DiseaseTiles
