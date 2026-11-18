import { Link } from "react-router-dom"
import { DISEASES } from "../utils/diseases"
import { startingGuides } from "../utils/guides"

// public/guides/<name>.jpg, the guide photos (healthy.jpg for No_Disease)
const photoOf = (label) => `/guides/${label === "No_Disease" ? "healthy" : label.toLowerCase()}.jpg`

// The guide for a label, opened with /guides?guide=<id> (Guides.jsx)
const guideLink = (label) => {
  const guide = startingGuides.find((g) => g.label === label)
  return guide ? `/guides?guide=${guide.protocol_id}` : "/guides"
}

// Everything PinePal can tell apart, as photo tiles with a caption bar. Each opens its guide.
function DiseaseTiles() {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-widest uppercase">What PinePal recognises</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {DISEASES.map((d) => (
          <li key={d.label}>
            <Link
              to={guideLink(d.label)}
              className="group relative block aspect-square overflow-hidden rounded-lg bg-muted shadow-sm focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <img
                src={photoOf(d.label)}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
              />
              {/* the disease colour runs along the top, the name sits in a dark bar at the bottom */}
              <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: d.color }} />
              <span className="absolute inset-x-0 bottom-0 bg-black/65 px-2 py-2 text-center text-xs font-semibold tracking-wide text-white uppercase backdrop-blur-[2px]">
                {d.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default DiseaseTiles
