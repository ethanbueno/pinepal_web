import { useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"
import { getProtocols, createProtocol, updateProtocol, deleteProtocol } from "../api/protocols"
import { useToast } from "../components/toastcontext"
import Modal from "../components/Modal"
import ConfirmModal from "../components/ConfirmModal"
import DiseaseBadge from "../components/DiseaseBadge"
import ErrorAlert from "../components/ErrorAlert"
import PageHeader from "../components/PageHeader"
import LoadingBlocks from "../components/LoadingBlocks"
import SelectField, { toOptions } from "../components/SelectField"
import { DISEASES, getDisease } from "../utils/diseases"
import { formatDate } from "../utils/format"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const TYPES = ["Disease", "Disorder", "Healthy"]
const SEVERITIES = ["None", "Low", "Medium", "High"]
const diseaseOptions = DISEASES.map((d) => ({ value: d.label, label: d.name }))

const emptyForm = {
  label: "Crown_Rot",
  display_name: "",
  type: "Disease",
  severity: "Medium",
  symptoms: "",
  immediate_action: "",
  about: "",
  prevention: "",
}

function Protocols() {
  const [protocols, setProtocols] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadCount, setReloadCount] = useState(0)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const notify = useToast()

  useEffect(() => {
    let ignore = false

    getProtocols()
      .then((data) => {
        if (ignore) return
        setProtocols(data)
        setError("")
        setLoading(false)
      })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setError("Could not load the guides.")
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [reloadCount])

  const reload = () => setReloadCount(reloadCount + 1)

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (protocol) => {
    setEditingId(protocol.protocol_id)
    setForm({
      label: protocol.label,
      display_name: protocol.display_name,
      type: protocol.type,
      severity: protocol.severity,
      symptoms: protocol.symptoms,
      immediate_action: protocol.immediate_action,
      about: protocol.about || "",
      prevention: protocol.prevention,
    })
    setShowForm(true)
  }

  const handleChange = (name, value) => setForm({ ...form, [name]: value })

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingId) {
        await updateProtocol(editingId, form)
        notify("Guide updated. Phones will download it on their next sync.")
      } else {
        await createProtocol(form)
        notify("Guide added.")
      }
      setShowForm(false)
      reload()
    } catch (err) {
      console.error(err)
      notify("Could not save the guide.", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      await deleteProtocol(target.protocol_id)
      notify("Guide deleted.")
      reload()
    } catch (err) {
      console.error(err)
      notify("Could not delete the guide.", "error")
    }
  }

  const header = (
    <PageHeader
      title="Guide"
      description="Remediation guides for each class. Phones download changes on their next sync."
      action={
        <Button onClick={openAdd}>
          <PlusIcon />
          Add guide
        </Button>
      }
    />
  )

  if (loading) {
    return (
      <div>
        {header}
        <LoadingBlocks rows={6} height="h-11" label="Loading guides" />
      </div>
    )
  }

  return (
    <div>
      {header}

      {error && <ErrorAlert>{error}</ErrorAlert>}

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {protocols.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No guides yet. Click "Add guide" to create the first remediation guide.
                </TableCell>
              </TableRow>
            )}
            {protocols.map((p) => (
              <TableRow key={p.protocol_id}>
                <TableCell>
                  <DiseaseBadge label={p.label} />
                </TableCell>
                <TableCell>{p.type}</TableCell>
                <TableCell>{p.severity}</TableCell>
                <TableCell className="tabular-nums">v{p.version}</TableCell>
                <TableCell>{formatDate(p.updated_at)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteTarget(p)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Modal open={showForm} title={editingId ? "Edit guide" : "Add guide"} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSave}>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5">Class</Label>
              <SelectField
                value={form.label}
                disabled={editingId !== null}
                onChange={(v) => handleChange("label", v)}
                options={diseaseOptions}
              />
            </div>
            <div>
              <Label className="mb-1.5">Display name</Label>
              <Input
                value={form.display_name}
                placeholder={getDisease(form.label).name}
                onChange={(e) => handleChange("display_name", e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="mb-1.5">Type</Label>
              <SelectField value={form.type} onChange={(v) => handleChange("type", v)} options={toOptions(TYPES)} />
            </div>
            <div>
              <Label className="mb-1.5">Severity</Label>
              <SelectField value={form.severity} onChange={(v) => handleChange("severity", v)} options={toOptions(SEVERITIES)} />
            </div>
          </div>

          {[
            ["about", "About"],
            ["symptoms", "Symptoms"],
            ["immediate_action", "Immediate action (one step per line)"],
            ["prevention", "Prevention"],
          ].map(([name, title]) => (
            <div className="mb-4" key={name}>
              <Label className="mb-1.5">{title}</Label>
              <Textarea
                rows={name === "immediate_action" ? 5 : 3}
                value={form[name]}
                onChange={(e) => handleChange(name, e.target.value)}
                required
              />
            </div>
          ))}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete guide?"
        message={`The app will have no remediation guide for ${deleteTarget?.display_name}. This can't be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default Protocols
