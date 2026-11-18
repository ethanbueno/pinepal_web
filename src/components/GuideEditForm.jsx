import { useState } from "react"
import DatePicker from "./DatePicker"
import { ImageIcon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import SelectField, { toOptions } from "./SelectField"
import { DISEASES, getDisease } from "../utils/diseases"
import { TIER_ORDER, guidePhotos, guideType, sortSources } from "../utils/guides"

const SEVERITIES = ["None", "Low", "Medium", "High"]
const diseaseOptions = DISEASES.map((d) => ({ value: d.label, label: d.name }))
const MAX_PHOTO_BYTES = 2 * 1024 * 1024
// photo slots in the guide header: the main photo and four more
const PHOTO_SLOTS = 5

// The list fields, edited as one item per line
const LIST_FIELDS = [
  ["symptoms", "Symptoms", "One symptom per line."],
  ["look_alikes", "Could also be", "One look-alike per line."],
  ["immediate_action", "Immediate action", "One step per line. They are numbered in this order."],
  ["prevention", "Prevention", "One measure per line."],
  ["checks", "Check the plant yourself", "One check per line. Only the healthy guide uses this."],
  ["scan_tips", "Scanning tips", "One tip per line."],
  ["get_help", "Get help", "One office or contact per line."],
]

const toLines = (items) => (items || []).join("\n")

// textarea text -> list of non-empty trimmed lines
const fromLines = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")

const isUrl = (url) => /^https?:\/\/\S+$/i.test(url.trim())

// a guide -> the form's values (lists become one item per line)
function toForm(protocol) {
  const p = protocol || {}
  const photos = guidePhotos(p)
  return {
    label: p.label || "Crown_Rot",
    display_name: p.display_name || "",
    scientific_name: p.scientific_name || "",
    cause: p.cause || "",
    severity: p.severity || "Medium",
    about: p.about || "",
    symptoms: toLines(p.symptom_items?.length ? p.symptom_items : p.symptoms ? [p.symptoms] : []),
    look_alikes: toLines(p.look_alikes),
    immediate_action: p.immediate_action || "",
    prevention: toLines(p.prevention_items?.length ? p.prevention_items : p.prevention ? [p.prevention] : []),
    checks: toLines(p.checks),
    scan_tips: toLines(p.scan_tips),
    get_help: toLines(p.get_help),
    sources: (p.sources || []).map((s) => ({ ...s })),
    reviewed: p.reviewed || "",
    // always five slots, main photo first; empty slots are null
    image_urls: Array.from({ length: PHOTO_SLOTS }, (_, i) => photos[i] || null),
  }
}

// the form's values -> the fields the guide pages and ProtocolCard read
function fromForm(form, protocol) {
  const symptomItems = fromLines(form.symptoms)
  const preventionItems = fromLines(form.prevention)
  return {
    label: form.label,
    display_name: form.display_name.trim(),
    scientific_name: form.scientific_name.trim(),
    cause: form.cause.trim(),
    // the type comes from the class and cause, like the starting guides
    type: protocol ? protocol.type : guideType(form.label, form.cause),
    severity: form.severity,
    about: form.about.trim(),
    // the joined text plus the separate items, so the card shows bullets
    symptoms: symptomItems.join(" "),
    symptom_items: symptomItems,
    prevention: preventionItems.join(" "),
    prevention_items: preventionItems,
    immediate_action: fromLines(form.immediate_action).join("\n"),
    look_alikes: fromLines(form.look_alikes),
    checks: fromLines(form.checks),
    scan_tips: fromLines(form.scan_tips),
    get_help: fromLines(form.get_help),
    sources: sortSources(
      form.sources.map((s) => ({
        title: s.title.trim(),
        publisher: s.publisher.trim(),
        url: s.url.trim(),
        tier: s.tier,
      }))
    ),
    reviewed: form.reviewed || null,
    // the filled slots in order; the first one is also the list thumbnail
    image_urls: form.image_urls.filter(Boolean),
    image_url: form.image_urls.find(Boolean) || null,
  }
}

// One photo slot of the form: the photo (or the placeholder), upload and remove.
// The photo is kept as a data URL, since there is nowhere to upload it yet.
function PhotoSlot({ url, name, label, onChange }) {
  const [error, setError] = useState("")

  const handleFile = (e) => {
    const file = e.target.files[0]
    e.target.value = "" // so picking the same file again still fires
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Pick an image file.")
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Larger than 2 MB. Pick a smaller one.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setError("")
      onChange(reader.result)
    }
    reader.onerror = () => setError("Could not read the photo.")
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex w-28 flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {url ? (
        <img src={url} alt={name} className="size-28 shrink-0 rounded-lg object-cover ring-1 ring-foreground/10" />
      ) : (
        <div className="flex size-28 shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-muted text-center text-muted-foreground ring-1 ring-foreground/10">
          <ImageIcon className="size-5" />
          <span className="text-[10px] leading-tight">Photo coming soon</span>
        </div>
      )}
      {/* a label styled as a button opens the hidden file picker */}
      <label
        className={
          buttonVariants({ variant: "outline", size: "sm" }) +
          " cursor-pointer focus-within:ring-3 focus-within:ring-ring/50"
        }
      >
        <UploadIcon />
        Upload
        <input type="file" accept="image/*" className="sr-only" aria-label={`Upload ${label}`} onChange={handleFile} />
      </label>
      {url && (
        <Button type="button" variant="outline" size="sm" aria-label={`Remove ${label}`} onClick={() => onChange(null)}>
          <Trash2Icon />
          Remove
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// The photo part of the form: five slots, the main photo first
function PhotosField({ urls, name, onChange }) {
  const setSlot = (i, value) => onChange(urls.map((u, j) => (j === i ? value : u)))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        {urls.map((url, i) => (
          <PhotoSlot
            key={i}
            url={url}
            name={name}
            label={i === 0 ? "Main photo" : `Photo ${i + 1}`}
            onChange={(v) => setSlot(i, v)}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">JPG or PNG, up to 2 MB each. The main photo is also the list thumbnail.</p>
    </div>
  )
}

// The sources as editable rows: title, publisher, link and where it is from
function SourcesField({ sources, onChange }) {
  const update = (i, name, value) => onChange(sources.map((s, j) => (j === i ? { ...s, [name]: value } : s)))
  const add = () => onChange([...sources, { title: "", publisher: "", url: "", tier: "Philippines" }])
  const remove = (i) => onChange(sources.filter((_, j) => j !== i))

  return (
    <div className="flex flex-col gap-3">
      {sources.length === 0 && <p className="text-sm text-muted-foreground">No sources yet.</p>}
      {sources.map((source, i) => (
        <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
          <Input
            aria-label="Source title"
            placeholder="Title"
            value={source.title}
            onChange={(e) => update(i, "title", e.target.value)}
            required
          />
          <Input
            aria-label="Publisher"
            placeholder="Publisher"
            value={source.publisher}
            onChange={(e) => update(i, "publisher", e.target.value)}
          />
          <Input
            aria-label="Link"
            placeholder="https://..."
            value={source.url}
            aria-invalid={source.url !== "" && !isUrl(source.url)}
            onChange={(e) => update(i, "url", e.target.value)}
            required
          />
          <div className="flex gap-2">
            <SelectField
              value={source.tier}
              onChange={(v) => update(i, "tier", v)}
              options={toOptions(TIER_ORDER)}
              className="w-full min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Remove source"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => remove(i)}
            >
              <Trash2Icon />
            </Button>
          </div>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <PlusIcon />
          Add source
        </Button>
      </div>
    </div>
  )
}

// A titled group of fields in the form
function FormSection({ title, children }) {
  return (
    <section className="flex flex-col gap-4 border-t pt-4">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

// The edit form for one guide, with every part of the guide card.
// protocol = null adds a new guide. onSave gets the fields to save; it can throw to keep the form open.
function GuideEditForm({ open, protocol, onSave, onClose }) {
  const [form, setForm] = useState(() => toForm(protocol))
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const badSource = form.sources.find((s) => !isUrl(s.url))
    if (badSource) {
      setError(`The link for "${badSource.title || "a source"}" must start with http:// or https://.`)
      return
    }
    setError("")
    setSaving(true)
    try {
      await onSave(fromForm(form, protocol))
    } catch (err) {
      console.error(err)
      setError("Could not save the guide.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[calc(100%-2rem)] overflow-y-auto p-5 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{protocol ? "Edit guide" : "Add guide"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* the header of the guide card */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5">Class</Label>
              <SelectField
                value={form.label}
                disabled={protocol !== null}
                onChange={(v) => set("label", v)}
                options={diseaseOptions}
              />
            </div>
            <div>
              <Label className="mb-1.5">Display name</Label>
              <Input
                value={form.display_name}
                placeholder={getDisease(form.label)?.name}
                onChange={(e) => set("display_name", e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="mb-1.5">Scientific name</Label>
              <Input value={form.scientific_name} onChange={(e) => set("scientific_name", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5">Severity</Label>
              <SelectField value={form.severity} onChange={(v) => set("severity", v)} options={toOptions(SEVERITIES)} />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5">Cause</Label>
              <Input
                value={form.cause}
                placeholder="e.g. Fungal disease, Physiological disorder"
                onChange={(e) => set("cause", e.target.value)}
              />
            </div>
          </div>

          <FormSection title="Photos">
            <PhotosField urls={form.image_urls} name={form.display_name} onChange={(v) => set("image_urls", v)} />
          </FormSection>

          <FormSection title="Guide">
            <div>
              <Label className="mb-1.5">About</Label>
              <Textarea rows={4} value={form.about} onChange={(e) => set("about", e.target.value)} />
            </div>
            {LIST_FIELDS.map(([name, title, hint]) => (
              <div key={name}>
                <Label className="mb-1.5">{title}</Label>
                <Textarea rows={4} value={form[name]} onChange={(e) => set(name, e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </div>
            ))}
          </FormSection>

          <FormSection title="Sources">
            <SourcesField sources={form.sources} onChange={(v) => set("sources", v)} />
            <p className="text-xs text-muted-foreground">Sources are listed Philippines first, then Southeast Asia, then International.</p>
          </FormSection>

          <FormSection title="Review">
            <div className="sm:w-1/2">
              <Label className="mb-1.5">Last reviewed</Label>
              <DatePicker placeholder="Pick a date" value={form.reviewed} onChange={(value) => set("reviewed", value)} />
            </div>
          </FormSection>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default GuideEditForm
