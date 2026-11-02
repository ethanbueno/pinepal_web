import { useEffect, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { PlusIcon } from "lucide-react"
import { getFarmers, createFarmer, updateFarmer, setFarmerStatus } from "../api/farmers"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import Modal from "../components/Modal"
import MiniMap from "../components/MiniMap"
import ErrorAlert from "../components/ErrorAlert"
import SelectField, { toOptions } from "../components/SelectField"
import { MUNICIPALITIES, DEFAULT_MUNICIPALITY, MAP_CENTER } from "../utils/diseases"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const emptyForm = {
  full_name: "",
  farm_name: "",
  municipality: DEFAULT_MUNICIPALITY,
  farm_size_ha: "",
  farm_latitude: MAP_CENTER[0],
  farm_longitude: MAP_CENTER[1],
  username: "",
  password: "",
}

// embedded = shown inside the Farmers tab of the Users page (admins), so no page title
function Farmers({ embedded = false }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const notify = useToast()

  const [search, setSearch] = useState("")
  const [municipality, setMunicipality] = useState("")
  const [farmers, setFarmers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadCount, setReloadCount] = useState(0)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [hasAccount, setHasAccount] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let ignore = false

    getFarmers({ search, municipality })
      .then((data) => {
        if (ignore) return
        setFarmers(data)
        setError("")
        setLoading(false)
      })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setError("Could not load farmers.")
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [search, municipality, reloadCount])

  const reload = () => setReloadCount(reloadCount + 1)
  const handleChange = (name, value) => setForm({ ...form, [name]: value })

  const openAdd = () => {
    setEditingId(null)
    setHasAccount(false)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (farmer) => {
    setEditingId(farmer.farmer_id)
    setForm({
      full_name: farmer.full_name,
      farm_name: farmer.farm_name,
      municipality: farmer.municipality,
      farm_size_ha: farmer.farm_size_ha ?? "",
      farm_latitude: farmer.farm_latitude,
      farm_longitude: farmer.farm_longitude,
      username: farmer.farmer_id,
      password: "",
    })
    setHasAccount(farmer.has_account)
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingId) {
        await updateFarmer(editingId, form)
        notify("Farmer updated.")
      } else {
        await createFarmer(form)
        notify("Farmer added. They can now log in on the mobile app.")
      }
      setShowForm(false)
      reload()
    } catch (err) {
      console.error(err)
      notify(err.response?.data?.error || "Could not save the farmer.", "error")
    } finally {
      setSaving(false)
    }
  }

  // deactivate instead of delete, so old scans keep their farmer
  const handleToggleStatus = async (farmer) => {
    try {
      await setFarmerStatus(farmer.farmer_id, !farmer.is_active)
      notify(farmer.is_active ? "Farmer deactivated." : "Farmer activated.")
      reload()
    } catch (err) {
      console.error(err)
      notify("Could not change the status.", "error")
    }
  }

  // admins have no Farmers page of their own any more, it is a tab under Users
  if (user.role === "admin" && !embedded) {
    return <Navigate to="/users?tab=farmers" replace />
  }

  return (
    <div>
      <div className={`flex items-center mb-4 ${embedded ? "justify-end" : "justify-between"}`}>
        {!embedded && <h1 className="text-2xl font-medium">Farmers</h1>}
        <Button onClick={openAdd}>
          <PlusIcon />
          Add farmer
        </Button>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grow min-w-48">
            <Label className="mb-1.5">Search</Label>
            <Input
              placeholder="Name or farm name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5">Municipality</Label>
            <SelectField
              className="w-48"
              allLabel="All"
              value={municipality}
              onChange={setMunicipality}
              options={toOptions(MUNICIPALITIES)}
            />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {loading ? (
        <p className="text-muted-foreground">Loading farmers...</p>
      ) : farmers.length === 0 ? (
        <Card>
          <CardContent className="py-2 text-center text-muted-foreground">No farmers found.</CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Farm</TableHead>
                <TableHead>Municipality</TableHead>
                <TableHead>Size (ha)</TableHead>
                <TableHead>Scans</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {farmers.map((f) => (
                <TableRow
                  key={f.farmer_id}
                  onClick={() => navigate("/farmers/" + f.farmer_id)}
                  className=" cursor-pointer hover:bg-muted"
                >
                  <TableCell>{f.full_name}</TableCell>
                  <TableCell>{f.farm_name}</TableCell>
                  <TableCell>{f.municipality}</TableCell>
                  <TableCell>{f.farm_size_ha}</TableCell>
                  <TableCell>{f.total_scans}</TableCell>
                  <TableCell>
                    <Badge variant={f.is_active ? "default" : "secondary"}>
                      {f.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(f)}>Edit</Button>
                      <Button
                        size="sm"
                        variant={f.is_active ? "destructive" : "outline"}
                        onClick={() => handleToggleStatus(f)}
                      >
                        {f.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Modal open={showForm} title={editingId ? "Edit farmer" : "Add farmer"} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSave}>
          <div className="grid gap-3 sm:grid-cols-2 mb-3">
            <div>
              <Label className="mb-1.5">Full name</Label>
              <Input value={form.full_name} onChange={(e) => handleChange("full_name", e.target.value)} required />
            </div>
            <div>
              <Label className="mb-1.5">Farm name</Label>
              <Input value={form.farm_name} onChange={(e) => handleChange("farm_name", e.target.value)} required />
            </div>
            <div>
              <Label className="mb-1.5">Municipality</Label>
              <SelectField
                value={form.municipality}
                onChange={(v) => handleChange("municipality", v)}
                options={toOptions(MUNICIPALITIES)}
              />
            </div>
            <div>
              <Label className="mb-1.5">Farm size (ha)</Label>
              <Input type="number" step="0.1" min="0" value={form.farm_size_ha} onChange={(e) => handleChange("farm_size_ha", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5">Username (this is the farmer ID)</Label>
              <Input
                value={form.username}
                onChange={(e) => handleChange("username", e.target.value)}
                disabled={Boolean(editingId)}
                minLength={3}
                required
              />
            </div>
            <div>
              <Label className="mb-1.5">
                {!editingId ? "Password" : hasAccount ? "New password (optional)" : "Password (creates their login)"}
              </Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                required={!editingId}
              />
            </div>
          </div>

          <Label className="mb-1.5">Farm location (click the map to move the pin)</Label>
          <div className="mb-4">
            <MiniMap
              height={220}
              center={[form.farm_latitude, form.farm_longitude]}
              zoom={11}
              onPick={(lat, lng) => setForm({ ...form, farm_latitude: lat, farm_longitude: lng })}
              points={[{ id: "farm", lat: form.farm_latitude, lng: form.farm_longitude, color: "#16A34A" }]}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Farmers
