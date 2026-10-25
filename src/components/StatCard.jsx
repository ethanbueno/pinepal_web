import { Card, CardContent, CardDescription } from "@/components/ui/card"

function StatCard({ title, value, note }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <CardDescription>{title}</CardDescription>
        <div className="text-3xl font-semibold">{value}</div>
        {note && <div className="text-xs text-muted-foreground">{note}</div>}
      </CardContent>
    </Card>
  )
}

export default StatCard
