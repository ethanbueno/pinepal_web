import { useEffect, useState } from "react"
import { DownloadIcon } from "lucide-react"
import { countScans } from "../api/scans"
import { downloadExport } from "../api/exportData"
import { useToast } from "../components/toastcontext"
import ErrorAlert from "../components/ErrorAlert"
import SelectField, { toOptions } from "../components/SelectField"
import { DISEASES, LOCKED_MUNICIPALITY, MUNICIPALITIES } from "../utils/diseases"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// the municipality starts at (and stays on) the temporary lock, like the Disease Map
const emptyFilters = { disease: "", municipality: LOCKED_MUNICIPALITY, from: "", to: "", verifiedOnly: false }
const diseaseOptions = DISEASES.map((d) => ({ value: d.label, label: d.name }))

function ExportData() {
  const notify = useToast()
  const [filters, setFilters] = useState(emptyFilters)
  const [format, setFormat] = useState("csv")
  const [rowCount, setRowCount] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState("")

  const update = (name, value) => setFilters({ ...filters, [name]: value })

  // same filters the export uses, so the number matches the file
  const scanFilters = {
    disease: filters.disease,
    municipality: filters.municipality,
    from: filters.from,
    to: filters.to,
    verified: filters.verifiedOnly ? "yes" : "",
  }

  useEffect(() => {
    let ignore = false

    countScans({
      disease: filters.disease,
      municipality: filters.municipality,
      from: filters.from,
      to: filters.to,
      verified: filters.verifiedOnly ? "yes" : "",
    })
      .then((total) => {
        if (!ignore) setRowCount(total)
      })
      .catch((err) => console.error(err))

    return () => {
      ignore = true
    }
  }, [filters])

  const handleDownload = async () => {
    setError("")
    setDownloading(true)
    try {
      const rows = await downloadExport(scanFilters, format)
      notify(`Exported ${rows} rows.`)
    } catch (err) {
      console.error(err)
      setError(err.message || "Could not export the data.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-medium">Export</h1>
      <p className="text-muted-foreground mb-4">
        Download scan records as a spreadsheet.
        {LOCKED_MUNICIPALITY && ` Temporarily locked to ${LOCKED_MUNICIPALITY}.`}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Leave a filter empty to include everything.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label>Disease</Label>
              <SelectField
                allLabel="All diseases"
                value={filters.disease}
                onChange={(v) => update("disease", v)}
                options={diseaseOptions}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Municipality</Label>
              <SelectField
                allLabel={LOCKED_MUNICIPALITY ? undefined : "All municipalities"}
                value={filters.municipality}
                onChange={(v) => update("municipality", v)}
                options={toOptions(LOCKED_MUNICIPALITY ? [LOCKED_MUNICIPALITY] : MUNICIPALITIES)}
                disabled={Boolean(LOCKED_MUNICIPALITY)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>From</Label>
              <Input type="date" value={filters.from} onChange={(e) => update("from", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>To</Label>
              <Input type="date" value={filters.to} onChange={(e) => update("to", e.target.value)} />
            </div>
          </div>

          <Label className="cursor-pointer font-normal">
            <Checkbox
              checked={filters.verifiedOnly}
              onCheckedChange={(checked) => update("verifiedOnly", checked)}
            />
            Verified scans only
          </Label>

          <Separator />

          <div className="flex flex-col gap-1.5">
            <Label>Format</Label>
            <ToggleGroup
              variant="outline"
              spacing={0}
              value={[format]}
              onValueChange={(value) => value[0] && setFormat(value[0])}
            >
              <ToggleGroupItem value="csv" className="px-4">CSV</ToggleGroupItem>
              <ToggleGroupItem value="xlsx" className="px-4">XLSX</ToggleGroupItem>
            </ToggleGroup>
          </div>

          {error && <ErrorAlert className="">{error}</ErrorAlert>}
        </CardContent>
        <CardFooter className="justify-between gap-4 border-t">
          <span className="text-sm text-muted-foreground">
            {rowCount === null ? "Counting rows..." : `${rowCount} ${rowCount === 1 ? "row" : "rows"} will be exported`}
          </span>
          <Button disabled={downloading || rowCount === 0} onClick={handleDownload}>
            <DownloadIcon />
            {downloading ? "Preparing..." : "Download"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default ExportData
