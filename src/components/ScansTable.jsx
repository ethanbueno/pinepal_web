import { useLocation, useNavigate } from "react-router-dom"
import { CheckIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import DiseaseBadge from "./DiseaseBadge"
import { LOW_CONFIDENCE } from "../utils/diseases"
import { formatDate, formatPercent } from "../utils/format"

// used by Scans, Dashboard (recent) and Farmer Detail
// bare = just the table, for a page that wraps it in its own card (the Dashboard)
function ScansTable({ scans, showFarmer = true, bare = false }) {
  const navigate = useNavigate()
  const location = useLocation()

  if (scans.length === 0 && bare) {
    return (
      <p className="px-6 py-4 text-center text-muted-foreground">
        No scans yet. Scans synced from the mobile app will appear here.
      </p>
    )
  }

  if (scans.length === 0) {
    return (
      <Card>
        <CardContent className="py-2 text-center text-muted-foreground">
          No scans yet. Scans synced from the mobile app will appear here.
        </CardContent>
      </Card>
    )
  }

  const Wrapper = bare ? "div" : Card
  const wrapperProps = bare ? {} : { className: "py-0" }

  return (
    <Wrapper {...wrapperProps}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {showFarmer && <TableHead>Farmer</TableHead>}
            <TableHead>Municipality</TableHead>
            <TableHead>Predicted</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Verified</TableHead>
            <TableHead>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scans.map((scan) => (
            <TableRow
              key={scan.scan_uuid}
              onClick={() => navigate("/scans/" + scan.scan_uuid, { state: { from: location.pathname } })}
              className={
                "cursor-pointer " +
                (!scan.verified_label && scan.confidence < LOW_CONFIDENCE ? "bg-destructive/10 hover:bg-destructive/15" : "")
              }
            >
              <TableCell>{formatDate(scan.scanned_at)}</TableCell>
              {showFarmer && <TableCell>{scan.farmer_name}</TableCell>}
              <TableCell>{scan.municipality}</TableCell>
              <TableCell>
                <DiseaseBadge label={scan.predicted_label} />
              </TableCell>
              <TableCell>{formatPercent(scan.confidence)}</TableCell>
              <TableCell>
                {scan.verified_label ? <CheckIcon className="size-4" /> : "–"}
              </TableCell>
              <TableCell>{scan.image_source}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Wrapper>
  )
}

export default ScansTable
