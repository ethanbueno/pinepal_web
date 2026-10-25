import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import SelectField, { toOptions } from "./SelectField"
import { DISEASES, MUNICIPALITIES } from "../utils/diseases"
import { emptyFilters } from "../utils/filters"

const diseaseOptions = DISEASES.map((d) => ({ value: d.label, label: d.name }))
const verifiedOptions = [
  { value: "yes", label: "Verified" },
  { value: "no", label: "Not verified" },
]

function Field({ label, children, className }) {
  return (
    <div className={className}>
      <Label className="mb-1.5">{label}</Label>
      {children}
    </div>
  )
}

// extra = true also shows the verified, low confidence and search filters
function FilterBar({ filters, onChange, extra = false, showMunicipality = true }) {
  const update = (name, value) => onChange({ ...filters, [name]: value })

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-wrap items-end gap-3">
        {extra && (
          <Field label="Search" className="grow min-w-48">
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
            className="w-44"
            allLabel="All diseases"
            value={filters.disease}
            onChange={(v) => update("disease", v)}
            options={diseaseOptions}
          />
        </Field>

        {showMunicipality && (
          <Field label="Municipality">
            <SelectField
              className="w-48"
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
                className="w-36"
                allLabel="All"
                value={filters.verified}
                onChange={(v) => update("verified", v)}
                options={verifiedOptions}
              />
            </Field>

            <Label className="pb-2 cursor-pointer">
              <Checkbox
                checked={filters.low_conf}
                onCheckedChange={(checked) => update("low_conf", checked)}
              />
              Low confidence only
            </Label>
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
