import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import DiseaseBadge from "./DiseaseBadge"

function Section({ title, text }) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="text-sm text-muted-foreground whitespace-pre-line">{text}</p>
    </div>
  )
}

// the remediation guide for one disease class
function ProtocolCard({ protocol }) {
  if (!protocol) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          No remediation guide for this class yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="font-semibold">Remediation guide</CardTitle>
            <DiseaseBadge label={protocol.label} />
          </div>
          <span className="text-xs text-muted-foreground">
            {protocol.severity} severity · v{protocol.version}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Section title="Symptoms" text={protocol.symptoms} />
        <Section title="Immediate action" text={protocol.immediate_action} />
        <Section title="Prevention" text={protocol.prevention} />
      </CardContent>
    </Card>
  )
}

export default ProtocolCard
