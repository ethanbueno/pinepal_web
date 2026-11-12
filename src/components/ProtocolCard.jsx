import { useState } from "react"
import { ImageIcon, InfoIcon, SearchIcon, ShieldCheckIcon, StethoscopeIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getDisease } from "../utils/diseases"
import { actionSteps } from "../utils/guides"

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
      <Chip className={severityClass(protocol.severity)}>{protocol.severity} severity</Chip>
    </div>
  )
}

// A titled part of the guide with an icon in a soft amber square, like the mobile guide sections.
// plain = no line above it (the wide layout puts sections side by side instead)
function Section({ icon: Icon, title, plain = false, children }) {
  return (
    <div className={plain ? "" : "border-t pt-3 first:border-t-0 first:pt-0"}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary-text">
          <Icon className="size-3.5" />
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </div>
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

// the remediation guide for one disease class, laid out like the mobile Disease Guide.
// wide = it spans a whole page (Scan detail): no empty photo box, and the sections in two
// columns on big screens so the lines don't get too long to read
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

  return (
    <Card className="gap-0 py-0">
      <GuidePhoto url={protocol.image_url} name={protocol.display_name} placeholder={!wide} />

      {/* header: color strip, name, scientific name, type and severity */}
      <div className="flex border-b">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
        <div className="px-4 py-3">
          <h2 className="text-base font-semibold">{protocol.display_name}</h2>
          {protocol.scientific_name && protocol.scientific_name !== "N/A" && (
            <p className="text-sm text-muted-foreground italic">{protocol.scientific_name}</p>
          )}
          <div className="mt-2">
            <GuideChips protocol={protocol} />
          </div>
          {protocol.cause && <p className="mt-1.5 text-sm text-muted-foreground">Cause: {protocol.cause}</p>}
        </div>
      </div>

      <CardContent
        className={
          "px-4 py-3 text-sm leading-relaxed " +
          (wide ? "grid gap-x-8 gap-y-4 lg:grid-cols-2" : "flex flex-col gap-3")
        }
      >
        {protocol.about && (
          <Section icon={InfoIcon} title="About" plain={wide}>
            <p className="whitespace-pre-line">{protocol.about}</p>
          </Section>
        )}
        <Section icon={SearchIcon} title="Symptoms" plain={wide}>
          <p className="whitespace-pre-line">{protocol.symptoms}</p>
        </Section>
        <Section icon={StethoscopeIcon} title="Immediate action" plain={wide}>
          {/* numbered, because the order of the steps matters */}
          <ol className="flex list-none flex-col gap-1">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-5 shrink-0 font-bold text-primary-text">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Section>
        <Section icon={ShieldCheckIcon} title="Prevention" plain={wide}>
          <p className="whitespace-pre-line">{protocol.prevention}</p>
        </Section>
        <p className={"border-t pt-2.5 text-xs text-muted-foreground " + (wide ? "lg:col-span-2" : "")}>
          Version {protocol.version}
        </p>
      </CardContent>
    </Card>
  )
}

export default ProtocolCard
