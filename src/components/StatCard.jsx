import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// A number with a label. Give it `to` to make the whole card a link (`state` is passed along),
// and tone="warning" to highlight a number that needs attention (only while the value is above 0).
function StatCard({ title, value, note, to, state, tone }) {
  const warn = tone === "warning" && Number(value) > 0

  // Card draws its outline with a ring, so the hover and warning colors change the ring
  const card = (
    <Card
      className={cn(
        "h-full transition-shadow",
        warn && "bg-destructive/5 ring-destructive/30",
        to && "group-hover:ring-primary group-focus-visible:ring-2 group-focus-visible:ring-ring"
      )}
    >
      <CardContent className="flex flex-col gap-1">
        <CardDescription className="font-medium">{title}</CardDescription>
        <div className={cn("text-2xl font-semibold tracking-tight tabular-nums", warn && "text-destructive")}>
          {value}
        </div>
        {note && <div className="text-xs leading-relaxed text-muted-foreground">{note}</div>}
      </CardContent>
    </Card>
  )

  return to ? (
    <Link to={to} state={state} className="group block rounded-xl outline-none">
      {card}
    </Link>
  ) : (
    card
  )
}

export default StatCard
