import { useEffect, useState } from "react"
import DatePicker from "../components/DatePicker"
import { DownloadIcon } from "lucide-react"
import { countScans, getScans } from "../api/scans"
import { cachedGet } from "../api/cache"
import { downloadExport } from "../api/exportData"
import { useToast } from "../components/toastcontext"
import ErrorAlert from "../components/ErrorAlert"
import PageHeader from "../components/PageHeader"
import ScansTable from "../components/ScansTable"
import Pagination from "../components/Pagination"
import LoadingBlocks from "../components/LoadingBlocks"
import SelectField, { toOptions } from "../components/SelectField"
import { DISEASES, LOCKED_MUNICIPALITY, MUNICIPALITIES } from "../utils/diseases"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

// the municipality starts at (and stays on) the temporary lock, like the Disease Map
const emptyFilters = { disease: "", municipality: LOCKED_MUNICIPALITY, from: "", to: "", verifiedOnly: false }
const diseaseOptions = DISEASES.map((d) => ({ value: d.label, label: d.name }))
const PER_PAGE = 20

function ExportData() {
  const notify = useToast()
  const [filters, setFilters] = useState(emptyFilters)
  const [format, setFormat] = useState("csv")
  const [rowCount, setRowCount] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState("")

  // the scans that will be in the file, one page at a time
  const [page, setPage] = useState(1)
  const [scans, setScans] = useState({ items: [], total: 0 })
  const [loadingScans, setLoadingScans] = useState(true)
  const [scansError, setScansError] = useState("")

  // a new filter always starts the list again from page 1
  const update = (name, value) => {
    setFilters({ ...filters, [name]: value })
    setPage(1)
    setLoadingScans(true)
  }

  const goToPage = (newPage) => {
    setPage(newPage)
    setLoadingScans(true)
  }

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

    const params = {
      disease: filters.disease,
      municipality: filters.municipality,
      from: filters.from,
      to: filters.to,
      verified: filters.verifiedOnly ? "yes" : "",
    }
    cachedGet(["scanCount", params], () => countScans(params), (total) => {
      if (!ignore) setRowCount(total)
    })
      .catch((err) => console.error(err))

    return () => {
      ignore = true
    }
  }, [filters])

  // same filters again, for the list of scans under the form
  useEffect(() => {
    let ignore = false

    const params = {
      disease: filters.disease,
      municipality: filters.municipality,
      from: filters.from,
      to: filters.to,
      verified: filters.verifiedOnly ? "yes" : "",
      page,
      per_page: PER_PAGE,
    }
    cachedGet(["scans", params], () => getScans(params), (result) => {
      if (ignore) return
      setScans(result)
      setScansError("")
      setLoadingScans(false)
    })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setScansError("Could not load the scans.")
        setLoadingScans(false)
      })

    return () => {
      ignore = true
    }
  }, [filters, page])

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
      <PageHeader
        title="Export"
        description={
          "Download scan records as a spreadsheet." +
          (LOCKED_MUNICIPALITY ? ` Temporarily locked to ${LOCKED_MUNICIPALITY}.` : "")
        }
      />

      {/* filters, format and Download on one row (wraps on phones); empty filters include everything */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3 sm:gap-4">
            <div className="flex w-full flex-col gap-1.5 sm:w-44">
              <Label className="text-muted-foreground">Disease</Label>
              <SelectField
                allLabel="All diseases"
                value={filters.disease}
                onChange={(v) => update("disease", v)}
                options={diseaseOptions}
              />
            </div>
            <div className="flex w-full flex-col gap-1.5 sm:w-40">
              <Label className="text-muted-foreground">Municipality</Label>
              <SelectField
                allLabel={LOCKED_MUNICIPALITY ? undefined : "All municipalities"}
                value={filters.municipality}
                onChange={(v) => update("municipality", v)}
                options={toOptions(LOCKED_MUNICIPALITY ? [LOCKED_MUNICIPALITY] : MUNICIPALITIES)}
                disabled={Boolean(LOCKED_MUNICIPALITY)}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-40 sm:flex-none">
              <Label className="text-muted-foreground">From</Label>
              <DatePicker value={filters.from} onChange={(value) => update("from", value)} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:w-40 sm:flex-none">
              <Label className="text-muted-foreground">To</Label>
              <DatePicker value={filters.to} onChange={(value) => update("to", value)} />
            </div>
            <div className="flex w-24 flex-col gap-1.5">
              <Label className="text-muted-foreground">Format</Label>
              <SelectField
                value={format}
                onChange={setFormat}
                options={[
                  { value: "csv", label: "CSV" },
                  { value: "xlsx", label: "XLSX" },
                ]}
              />
            </div>
            <Label className="flex h-10 cursor-pointer items-center font-normal md:h-7">
              <Checkbox
                checked={filters.verifiedOnly}
                onCheckedChange={(checked) => update("verifiedOnly", checked)}
              />
              Verified only
            </Label>

            <div className="flex w-full items-center justify-between gap-3 sm:ml-auto sm:w-auto">
              <span className="text-sm text-muted-foreground tabular-nums">
                {rowCount === null ? "Counting..." : `${rowCount} ${rowCount === 1 ? "row" : "rows"}`}
              </span>
              <Button disabled={downloading || rowCount === 0} onClick={handleDownload}>
                <DownloadIcon />
                {downloading ? "Preparing..." : "Download"}
              </Button>
            </div>
          </div>

          {error && <ErrorAlert className="">{error}</ErrorAlert>}
        </CardContent>
      </Card>

      {/* what the file will contain (the row count is already next to Download) */}
      <div className="mt-4">
        {scansError && <ErrorAlert>{scansError}</ErrorAlert>}

        {loadingScans ? (
          <LoadingBlocks rows={6} height="h-10" label="Loading scans" />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="font-semibold">Scans in the export</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <ScansTable scans={scans.items} bare emptyText="No scans match these filters." />
              </CardContent>
            </Card>
            {scans.total > 0 && (
              <Pagination page={page} perPage={PER_PAGE} total={scans.total} onChange={goToPage} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default ExportData
