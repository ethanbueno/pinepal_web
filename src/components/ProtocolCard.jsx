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
  return <span className={"rounded-full border px-2.5 py-0.5 text-xs font-semibold " + className}>{children}</span>
}

// A titled part of the guide with an icon in a soft amber square, like the mobile guide sections
function Section({ icon: Icon, title, children }) {
  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary-text">
          <Icon className="size-4" />
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// The guide photo, or a plain placeholder when the photo is missing (same as the mobile app)
function GuidePhoto({ url, name }) {
  const [broken, setBroken] = useState(false)

  if (!url || broken) {
    return (
      <div className="flex h-44 items-center justify-center bg-muted text-muted-foreground">
        <ImageIcon className="size-10" />
      </div>
    )
  }
  return <img src={url} alt={name} className="h-44 w-full object-cover" onError={() => setBroken(true)} />
}

// the remediation guide for one disease class, laid out like the mobile Disease Guide
function ProtocolCard({ protocol }) {
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
      <GuidePhoto url={protocol.image_url} name={protocol.display_name} />

      {/* header: color strip, name, scientific name, type and severity */}
      <div className="flex border-b">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
        <div className="p-4">
          <h2 className="text-lg font-semibold">{protocol.display_name}</h2>
          {protocol.scientific_name && protocol.scientific_name !== "N/A" && (
            <p className="text-sm text-muted-foreground italic">{protocol.scientific_name}</p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Chip className="border-border bg-muted text-muted-foreground">{protocol.type}</Chip>
            <Chip className={severityClass(protocol.severity)}>{protocol.severity} severity</Chip>
          </div>
          {protocol.cause && <p className="mt-2 text-sm text-muted-foreground">Cause: {protocol.cause}</p>}
        </div>
      </div>

      <CardContent className="flex flex-col gap-4 py-4 text-[0.95rem] leading-relaxed">
        {protocol.about && (
          <Section icon={InfoIcon} title="About">
            <p className="whitespace-pre-line">{protocol.about}</p>
          </Section>
        )}
        <Section icon={SearchIcon} title="Symptoms">
          <p className="whitespace-pre-line">{protocol.symptoms}</p>
        </Section>
        <Section icon={StethoscopeIcon} title="Immediate action">
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
        <Section icon={ShieldCheckIcon} title="Prevention">
          <p className="whitespace-pre-line">{protocol.prevention}</p>
        </Section>
        <p className="border-t pt-3 text-xs text-muted-foreground">Version {protocol.version}</p>
      </CardContent>
    </Card>
  )
}

export default ProtocolCard
