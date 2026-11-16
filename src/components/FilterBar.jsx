import { useState } from "react"
import { SlidersHorizontalIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import SelectField, { toOptions } from "./SelectField"
import { DISEASES, LOCKED_MUNICIPALITY, MUNICIPALITIES } from "../utils/diseases"
import { emptyFilters } from "../utils/filters"

const diseaseOptions = DISEASES.map((d) => ({ value: d.label, label: d.name }))
const confidenceOptions = [
  { value: "low", label: "Low (under 60%)" },
  { value: "mid", label: "Middle (60–89%)" },
  { value: "high", label: "High (90% and up)" },
]
const verifiedOptions = [
  { value: "yes", label: "Verified" },
  { value: "no", label: "Not verified" },
]

function Field({ label, children, className }) {
  return (
    <div className={"w-full sm:w-auto " + (className || "")}>
      <Label className="mb-1.5 text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

// extra = true also shows the verified, low / high confidence and search filters.
// The municipality filter is left out while PinePal is locked to one municipality.
// On phones the filters fold away behind a Filters button, so the list is on the first screen.
function FilterBar({ filters, onChange, extra = false, showMunicipality = !LOCKED_MUNICIPALITY }) {
  const update = (name, value) => onChange({ ...filters, [name]: value })
  const [open, setOpen] = useState(false)
  // how many filters are set, shown on the phone button
  const active = Object.entries(filters).filter(
    ([key, value]) => value !== "" && value !== false && value !== emptyFilters[key]
  ).length

  return (
    <Card className="mb-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="-my-1 flex items-center justify-between gap-2 px-(--card-spacing) text-sm font-medium sm:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontalIcon className="size-4" /> Filters
          {active > 0 && (
            <span className="rounded-full bg-primary/15 px-2 text-xs text-primary-text">{active}</span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      <CardContent className={"flex-wrap items-end gap-3 sm:flex " + (open ? "flex" : "hidden")}>
        {extra && (
          <Field label="Search" className="grow min-w-32">
            <Input
              type="text"
              placeholder="Farmer or farm name"
              value={filters.search}
              onChange={(e) => update("search", e.target.value)}
            />
          </Field>
        )}

        <Field label="Disease">
          <SelectField
            className="w-full sm:w-44"
            allLabel="All diseases"
            value={filters.disease}
            onChange={(v) => update("disease", v)}
            options={diseaseOptions}
          />
        </Field>

        {showMunicipality && (
          <Field label="Municipality">
            <SelectField
              className="w-full sm:w-48"
              allLabel="All municipalities"
              value={filters.municipality}
              onChange={(v) => update("municipality", v)}
              options={toOptions(MUNICIPALITIES)}
            />
          </Field>
        )}

        <Field label="From">
          <Input type="date" value={filters.from} onChange={(e) => update("from", e.target.value)} />
        </Field>

        <Field label="To">
          <Input type="date" value={filters.to} onChange={(e) => update("to", e.target.value)} />
        </Field>

        {extra && (
          <>
            <Field label="Verified">
              <SelectField
                className="w-full sm:w-32"
                allLabel="All"
                value={filters.verified}
                onChange={(v) => update("verified", v)}
                options={verifiedOptions}
              />
            </Field>

            {/* one choice for low / middle / high, since a scan is only ever one of them */}
            <Field label="Confidence">
              <SelectField
                className="w-full sm:w-40"
                allLabel="All"
                value={filters.low_conf ? "low" : filters.mid_conf ? "mid" : filters.high_conf ? "high" : ""}
                onChange={(v) =>
                  onChange({ ...filters, low_conf: v === "low", mid_conf: v === "mid", high_conf: v === "high" })
                }
                options={confidenceOptions}
              />
            </Field>
          </>
        )}

        <Button variant="outline" onClick={() => onChange(emptyFilters)}>
          Reset
        </Button>
      </CardContent>
    </Card>
  )
}

export default FilterBar
