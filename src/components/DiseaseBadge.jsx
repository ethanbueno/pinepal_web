import { Badge } from "@/components/ui/badge"
import { getDisease } from "../utils/diseases"

function DiseaseBadge({ label }) {
  const disease = getDisease(label)
  const color = disease ? disease.color : "#888888"
  const name = disease ? disease.name : label

  return (
    <Badge
      variant="outline"
      className="h-auto py-0.5"
      style={{ backgroundColor: color + "26", color: color, borderColor: color + "66" }}
    >
      {name}
    </Badge>
  )
}

export default DiseaseBadge
