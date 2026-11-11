import { useLocation, useNavigate } from "react-router-dom"
import { CheckIcon, ScanSearchIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import EmptyState from "./EmptyState"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import DiseaseBadge from "./DiseaseBadge"
import { LOW_CONFIDENCE } from "../utils/diseases"
import { formatDate, formatPercent } from "../utils/format"

// used by Scans, Dashboard (highest / lowest confidence) and Farmer Detail
// bare = just the table, for a page that wraps it in its own card (the Dashboard)
// emptyText = the line a bare table shows when there are no scans
function ScansTable({
  scans,
  showFarmer = true,
  showVerified = true,
  bare = false,
  emptyText = "No scans yet. Scans synced from the mobile app will appear here.",
}) {
  const navigate = useNavigate()
  const location = useLocation()

  if (scans.length === 0 && bare) {
    return <p className="px-6 py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
  }

  if (scans.length === 0) {
    return (
      <EmptyState
        icon={ScanSearchIcon}
        title="No scans to show"
        text="No scans match these filters yet. Scans synced from the mobile app will appear here."
      />
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
            {showVerified && <TableHead>Verified</TableHead>}
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
              <TableCell className="tabular-nums">{formatPercent(scan.confidence)}</TableCell>
              {showVerified && (
                <TableCell>
                  {scan.verified_label ? <CheckIcon className="size-4" aria-label="Verified" /> : "–"}
                </TableCell>
              )}
              <TableCell>{scan.image_source}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Wrapper>
  )
}

export default ScansTable
