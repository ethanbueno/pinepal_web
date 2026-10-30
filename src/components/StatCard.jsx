import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// A number with a label. Give it `to` to make the whole card a link (`state` is passed along),
// and tone="warning" to highlight a number that needs attention (only while the value is above 0).
function StatCard({ title, value, note, to, state, tone }) {
  const warn = tone === "warning" && Number(value) > 0

  const card = (
    <Card className={cn("h-full", warn && "border-destructive/40 bg-destructive/5", to && "transition-colors hover:border-primary")}>
      <CardContent className="flex flex-col gap-1">
        <CardDescription>{title}</CardDescription>
        <div className={cn("text-3xl font-semibold", warn && "text-destructive")}>{value}</div>
        {note && <div className="text-xs text-muted-foreground">{note}</div>}
      </CardContent>
    </Card>
  )

  return to ? (
    <Link to={to} state={state} className="block">
      {card}
    </Link>
  ) : (
    card
  )
}

export default StatCard
