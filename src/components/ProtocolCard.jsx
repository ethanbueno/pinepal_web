import { useState } from "react"
import {
  ArrowLeftRightIcon,
  BookOpenIcon,
  CameraIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  ExternalLinkIcon,
  ImageIcon,
  InfoIcon,
  LifeBuoyIcon,
  SearchIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  ZoomInIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { getDisease } from "../utils/diseases"
import { actionSteps, guidePhotos } from "../utils/guides"

// Same severity colors as the mobile guide: green for none, amber for low and medium, red for high
function severityClass(severity) {
  const level = (severity || "").toLowerCase()
  if (level === "none") return "text-chart-2 bg-chart-2/15 border-chart-2/40"
  if (level === "high" || level === "critical") return "text-destructive bg-destructive/15 border-destructive/40"
  return "text-primary-text bg-primary/15 border-primary/40"
}

function Chip({ className, children }) {
  return <span className={"rounded-full border px-2 py-0.5 text-xs font-semibold " + className}>{children}</span>
}

// The type and severity chips, also used by the compact list on the Guides page
export function GuideChips({ protocol }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip className="border-border bg-muted text-muted-foreground">{protocol.type}</Chip>
      {(protocol.severity || "").toLowerCase() !== "none" && (
        <Chip className={severityClass(protocol.severity)}>{protocol.severity} severity</Chip>
      )}
    </div>
  )
}

// A titled part of the guide with an icon in a soft amber square, like the mobile guide sections.
// highlight = the "what to do" box, tinted amber so it stands out from the reading parts
function Section({ icon: Icon, title, highlight = false, children }) {
  return (
    <section className={highlight ? "rounded-lg border border-primary/30 bg-primary/10 p-3" : ""}>
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={
            "flex size-7 items-center justify-center rounded-md text-primary-text " +
            (highlight ? "bg-card" : "bg-primary/15")
          }
        >
          <Icon className="size-3.5" />
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  )
}

// A short bulleted list, like the symptoms or who to call
function BulletList({ items }) {
  return (
    <ul className="flex list-none flex-col gap-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="w-3 shrink-0 font-bold text-primary-text">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

// Bullets when the guide has its list of items (the edit form saves both), a paragraph
// when the text no longer matches the items
function ItemsOrText({ items, text }) {
  if (items?.length > 0 && items.join(" ") === text) return <BulletList items={items} />
  return <p className="whitespace-pre-line">{text}</p>
}

// Small grey label above a group of sections
function GroupLabel({ children }) {
  return <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</p>
}

// The sources, Philippine ones first. Long lists start folded to the first few.
const SOURCES_SHOWN = 4

// Small "author · license" links for the guide photos, opened in a new tab
function PhotoCredits({ credits }) {
  return (
    <div className="text-xs text-muted-foreground">
      <p className="font-semibold">Photo credits</p>
      <ul className="mt-0.5 flex flex-col gap-0.5">
        {credits.map((credit, i) => (
          <li key={i}>
            <a
              href={credit.url}
              target="_blank"
              rel="noreferrer"
              title={credit.title}
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              {credit.author} · {credit.license}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SourceList({ sources, photoCredits = [] }) {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? sources : sources.slice(0, SOURCES_SHOWN)

  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {shown.map((source, i) => (
          <li key={i}>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex gap-1 font-medium text-primary-text underline-offset-2 hover:underline"
            >
              <span>{source.title}</span>
              <ExternalLinkIcon className="mt-1 size-3 shrink-0 opacity-60 group-hover:opacity-100" />
            </a>
            <p className="text-xs text-muted-foreground">
              {source.publisher} · {source.tier}
            </p>
          </li>
        ))}
      </ul>
      {sources.length > SOURCES_SHOWN && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-text hover:underline"
        >
          {showAll ? "Show fewer" : `Show all ${sources.length} sources`}
          <ChevronDownIcon className={"size-3.5 transition-transform " + (showAll ? "rotate-180" : "")} />
        </button>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Always check that a product is registered with the Fertilizer and Pesticide Authority (FPA) and follow its
        label.
      </p>
      {photoCredits.length > 0 && (
        <div className="mt-3">
          <PhotoCredits credits={photoCredits} />
        </div>
      )}
    </>
  )
}

// The guide photo, or a plain placeholder when the photo is missing (same as the mobile app).
// placeholder = false shows nothing instead of the empty box.
// className sets the size, so the Guides list can use it as a small thumbnail.
export function GuidePhoto({ url, name, placeholder = true, className = "h-44 w-full", iconClass = "size-10" }) {
  const [broken, setBroken] = useState(false)

  if (!url || broken) {
    if (!placeholder) return null
    return (
      <div className={"flex shrink-0 items-center justify-center bg-muted text-muted-foreground " + className}>
        <ImageIcon className={iconClass} />
      </div>
    )
  }
  return <img src={url} alt={name} className={"shrink-0 object-cover " + className} onError={() => setBroken(true)} />
}

// The header photos: up to this many slots, the main one first and bigger
const PHOTO_SLOTS = 5

// The reference photos in the guide header: the main photo, then four smaller ones to its right
// (wrapping on narrow screens). A photo is a button that opens the dialog at that photo, where
// Prev/Next or the Left/Right arrow keys go through the photos that loaded (Escape or a click
// outside closes it). A missing photo, or one that fails to load, shows a "Photo coming soon" box.
function ReferencePhotos({ urls, name }) {
  const [broken, setBroken] = useState(() => new Set())
  const [openIndex, setOpenIndex] = useState(null)

  const slots = Array.from({ length: PHOTO_SLOTS }, (_, i) => urls[i] || null)
  const loaded = slots.filter((url) => url && !broken.has(url))
  const total = loaded.length
  const current = openIndex === null || total === 0 ? null : Math.min(openIndex, total - 1)

  const markBroken = (url) =>
    setBroken((prev) => {
      if (prev.has(url)) return prev
      const next = new Set(prev)
      next.add(url)
      return next
    })
  const step = (delta) => setOpenIndex((i) => (i + delta + total) % total)
  const onKeyDown = (e) => {
    if (total < 2) return
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      step(-1)
    } else if (e.key === "ArrowRight") {
      e.preventDefault()
      step(1)
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {slots.map((url, i) => {
          const size = i === 0 ? "h-32 w-48 sm:h-36 sm:w-56" : "h-32 w-24 sm:h-36 sm:w-28"
          const box = "block shrink-0 overflow-hidden rounded-lg ring-1 ring-foreground/10 " + size
          if (!url || broken.has(url)) {
            return (
              <div
                key={i}
                className={box + " flex flex-col items-center justify-center gap-1 bg-muted p-1 text-center text-muted-foreground"}
              >
                <ImageIcon className="size-5" />
                <span className="text-[10px] leading-tight">Photo coming soon</span>
              </div>
            )
          }
          return (
            <button
              key={i}
              type="button"
              aria-label={`View larger photo ${i + 1}`}
              onClick={() => setOpenIndex(loaded.indexOf(url))}
              className={box + " relative cursor-zoom-in focus-visible:outline-2 focus-visible:outline-primary"}
            >
              <img src={url} alt={name} className="size-full object-cover" onError={() => markBroken(url)} />
              <span className="absolute right-1 bottom-1 rounded-md bg-black/60 p-0.5 text-white">
                <ZoomInIcon className="size-3.5" />
              </span>
            </button>
          )
        })}
      </div>
      <Dialog open={current !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent className="max-h-[calc(100%-2rem)] gap-3 p-4 sm:max-w-4xl" onKeyDown={onKeyDown}>
          {current !== null && (
            <>
              <img
                src={loaded[current]}
                alt={name}
                className="mx-auto max-h-[80vh] max-w-full rounded-md object-contain"
              />
              <div className="flex items-center justify-between gap-2">
                {total > 1 ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => step(-1)}>
                    <ChevronLeftIcon />
                    Prev
                  </Button>
                ) : (
                  <span />
                )}
                <DialogTitle className="text-center text-sm font-medium">
                  {name} · {current + 1} / {total}
                </DialogTitle>
                {total > 1 ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => step(1)}>
                    Next
                    <ChevronRightIcon />
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// the remediation guide for one disease class, laid out like the mobile Disease Guide:
// "Identify" (about, symptoms, look-alikes), then "What to do" (steps in an amber box, prevention),
// then "Help and sources".
// wide = it has a whole page (Guides, Scan detail): on big screens Identify and What to do sit in
// two columns, with help and sources in a row under them.
function ProtocolCard({ protocol, wide = false }) {
  if (!protocol) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">No remediation guide for this class yet.</CardContent>
      </Card>
    )
  }

  const disease = getDisease(protocol.label)
  const color = disease ? disease.color : "#888888"
  const steps = actionSteps(protocol.immediate_action)
  const hasLookAlikes = protocol.look_alikes?.length > 0
  const hasHelp = protocol.get_help?.length > 0
  const hasSources = protocol.sources?.length > 0
  const hasSide = hasHelp || hasSources
  const photoCredits = protocol.photo_credits || []
  // The healthy guide has hand checks instead of treatment. Its order is About, Check the plant
  // yourself, then Could also be and Scanning tips.
  const healthy = protocol.checks?.length > 0

  const checks = healthy && (
    <Section icon={ClipboardCheckIcon} title="Check the plant yourself" highlight>
      <BulletList items={protocol.checks} />
    </Section>
  )
  const lookAlikes = hasLookAlikes && (
    <Section icon={ArrowLeftRightIcon} title="Could also be">
      <BulletList items={protocol.look_alikes} />
    </Section>
  )

  const identify = (
    <div className="flex flex-col gap-4">
      <GroupLabel>{healthy ? "Result" : "Identify"}</GroupLabel>
      {protocol.about && (
        <Section icon={InfoIcon} title="About">
          <p className="whitespace-pre-line">{protocol.about}</p>
        </Section>
      )}
      {protocol.symptoms && (
        <Section icon={SearchIcon} title="Symptoms">
          <ItemsOrText items={protocol.symptom_items} text={protocol.symptoms} />
        </Section>
      )}
      {healthy ? checks : lookAlikes}
    </div>
  )

  const act = (
    <div className="flex flex-col gap-4">
      <GroupLabel>{healthy ? "Keep watching" : "What to do"}</GroupLabel>
      {healthy && lookAlikes}
      {protocol.scan_tips?.length > 0 && (
        <Section icon={CameraIcon} title="Scanning tips">
          <BulletList items={protocol.scan_tips} />
        </Section>
      )}
      {steps.length > 0 && (
        <Section icon={StethoscopeIcon} title="Immediate action" highlight>
          {/* numbered, because the order of the steps matters */}
          <ol className="flex list-none flex-col gap-1.5">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-5 shrink-0 font-bold text-primary-text">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}
      {protocol.prevention && (
        <Section icon={ShieldCheckIcon} title="Prevention">
          <ItemsOrText items={protocol.prevention_items} text={protocol.prevention} />
        </Section>
      )}
    </div>
  )

  const side = hasSide && (
    <div className="flex flex-col gap-4">
      <GroupLabel>Help and sources</GroupLabel>
      <div className={"grid gap-4 " + (hasHelp && hasSources ? "lg:grid-cols-2 lg:gap-8" : "")}>
        {hasHelp && (
          <Section icon={LifeBuoyIcon} title="Get help">
            <BulletList items={protocol.get_help} />
          </Section>
        )}
        {hasSources && (
          <Section icon={BookOpenIcon} title={`Sources (${protocol.sources.length})`}>
            <SourceList sources={protocol.sources} photoCredits={photoCredits} />
          </Section>
        )}
      </div>
    </div>
  )

  const footer = (
    <>
      <p className="text-xs text-muted-foreground">
        Version {protocol.version}
        {protocol.reviewed && <> · Last reviewed {protocol.reviewed}</>}
      </p>
      {/* a guide without sources (No Disease) still credits its photos */}
      {!hasSources && photoCredits.length > 0 && (
        <div className="mt-2">
          <PhotoCredits credits={photoCredits} />
        </div>
      )}
    </>
  )

  return (
    <Card className="gap-0 py-0">
      {/* header: color strip, reference photos on top, then name, scientific name, type and severity */}
      <div className="flex border-b">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1 px-4 py-3">
          <ReferencePhotos urls={guidePhotos(protocol)} name={protocol.display_name} />
          <h2 className="text-lg font-semibold">{protocol.display_name}</h2>
          {protocol.scientific_name && protocol.scientific_name !== "N/A" && (
            <p className="text-sm text-muted-foreground italic">{protocol.scientific_name}</p>
          )}
          <div className="mt-2">
            <GuideChips protocol={protocol} />
          </div>
          {protocol.cause && <p className="mt-1.5 text-sm text-muted-foreground">Cause: {protocol.cause}</p>}
        </div>
      </div>

      {wide ? (
        <CardContent className="flex flex-col gap-6 px-4 py-4 text-sm leading-relaxed">
          {/* two even columns on big screens: identify on the left, what to do on the right */}
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            {identify}
            <div className="border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">{act}</div>
          </div>
          {side && <div className="border-t pt-5">{side}</div>}
          <div className="border-t pt-2.5">{footer}</div>
        </CardContent>
      ) : (
        <CardContent className="flex flex-col gap-5 px-4 py-4 text-sm leading-relaxed">
          {identify}
          <div className="border-t pt-5">{act}</div>
          {side && <div className="border-t pt-5">{side}</div>}
          <div className="border-t pt-2.5">{footer}</div>
        </CardContent>
      )}
    </Card>
  )
}

export default ProtocolCard
