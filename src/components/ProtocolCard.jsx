import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import DiseaseBadge from "./DiseaseBadge"

function Section({ title, text }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium">{title}</div>
      <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{text}</p>
    </div>
  )
}

// the remediation guide for one disease class
function ProtocolCard({ protocol }) {
  if (!protocol) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">No remediation guide for this class yet.</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="font-semibold">Remediation guide</CardTitle>
            <DiseaseBadge label={protocol.label} />
          </div>
          <CardDescription className="text-xs">
            {protocol.severity} severity · v{protocol.version}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Section title="Symptoms" text={protocol.symptoms} />
        <Section title="Immediate action" text={protocol.immediate_action} />
        <Section title="Prevention" text={protocol.prevention} />
      </CardContent>
    </Card>
  )
}

export default ProtocolCard
