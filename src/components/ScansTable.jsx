import { useLocation, useNavigate } from "react-router-dom"
import { CheckIcon, ScanSearchIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import EmptyState from "./EmptyState"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import DiseaseBadge from "./DiseaseBadge"
import { LOCKED_MUNICIPALITY, LOW_CONFIDENCE } from "../utils/diseases"
import { formatDate, formatPercent } from "../utils/format"

// used by Scans, Dashboard (highest / lowest confidence) and Farmer Detail
// bare = just the table, for a page that wraps it in its own card (the Dashboard)
// emptyText = the line a bare table shows when there are no scans
// showMunicipality: off while PinePal is locked to one municipality (every scan is Echague)
function ScansTable({
  scans,
  showFarmer = true,
  showMunicipality = !LOCKED_MUNICIPALITY,
  showVerified = true,
  bare = false,
  emptyText = "No scans yet. Scans synced from the mobile app will appear here.",
}) {
  const navigate = useNavigate()
  const location = useLocation()

  if (scans.length === 0 && bare) {
    return <p className="px-(--card-spacing) py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
  }

  if (scans.length === 0) {
    return (
      <EmptyState
        icon={ScanSearchIcon}
        title="No Scans to Show"
        text="No scans match these filters yet. Scans synced from the mobile app will appear here."
      />
    )
  }

  const Wrapper = bare ? "div" : Card
  const wrapperProps = bare ? {} : { className: "py-0" }
  // in a card, the first and last columns line up with the card's title and links
  const edge = bare ? "first:pl-(--card-spacing) last:pr-(--card-spacing)" : ""

  const open = (scan) => navigate("/scans/" + scan.scan_uuid, { state: { from: location.pathname } })
  const needsReview = (scan) => !scan.verified_label && scan.confidence < LOW_CONFIDENCE

  return (
    <Wrapper {...wrapperProps}>
      {/* phones: one compact row per scan instead of a table that has to scroll sideways */}
      <ul className="divide-y md:hidden">
        {scans.map((scan) => (
          <li key={scan.scan_uuid}>
            <button
              type="button"
              onClick={() => open(scan)}
              className={
                "flex w-full flex-col gap-1 px-(--card-spacing,0.75rem) py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/50 " +
                (needsReview(scan) ? "bg-destructive/10" : "")
              }
            >
              <span className="flex items-center justify-between gap-3">
                <DiseaseBadge label={scan.predicted_label} />
                <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
                  {showVerified && scan.verified_label && <CheckIcon className="size-3.5" aria-label="Verified" />}
                  {formatPercent(scan.confidence)}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {[
                  formatDate(scan.scanned_at),
                  showFarmer && scan.farmer_name,
                  showMunicipality && scan.municipality,
                  scan.image_source,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* bigger screens: the table */}
      <Table className="max-md:hidden">
        <TableHeader>
          <TableRow>
            <TableHead className={edge}>Date</TableHead>
            {showFarmer && <TableHead className={edge}>Farmer</TableHead>}
            {showMunicipality && <TableHead className={edge}>Municipality</TableHead>}
            <TableHead className={edge}>Predicted</TableHead>
            <TableHead className={edge}>Confidence</TableHead>
            {showVerified && <TableHead className={edge}>Verified</TableHead>}
            <TableHead className={edge}>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scans.map((scan) => (
            <TableRow
              key={scan.scan_uuid}
              onClick={() => open(scan)}
              className={"cursor-pointer " + (needsReview(scan) ? "bg-destructive/10 hover:bg-destructive/15" : "")}
            >
              <TableCell className={edge}>{formatDate(scan.scanned_at)}</TableCell>
              {showFarmer && <TableCell className={edge}>{scan.farmer_name}</TableCell>}
              {showMunicipality && <TableCell className={edge}>{scan.municipality}</TableCell>}
              <TableCell className={edge}>
                <DiseaseBadge label={scan.predicted_label} />
              </TableCell>
              <TableCell className={edge + " tabular-nums"}>{formatPercent(scan.confidence)}</TableCell>
              {showVerified && (
                <TableCell className={edge}>
                  {scan.verified_label ? <CheckIcon className="size-4" aria-label="Verified" /> : "–"}
                </TableCell>
              )}
              <TableCell className={edge}>{scan.image_source}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Wrapper>
  )
}

export default ScansTable
