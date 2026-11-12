import { useEffect, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { PlusIcon, UsersIcon } from "lucide-react"
import { getFarmers, createFarmer, updateFarmer, setFarmerStatus, syncFarmer } from "../api/farmers"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import Modal from "../components/Modal"
import MiniMap from "../components/MiniMap"
import ErrorAlert from "../components/ErrorAlert"
import PageHeader from "../components/PageHeader"
import LoadingBlocks from "../components/LoadingBlocks"
import EmptyState from "../components/EmptyState"
import PasswordInput from "../components/PasswordInput"
import SelectField, { toOptions } from "../components/SelectField"
import { MUNICIPALITIES, LOCKED_MUNICIPALITY, MAP_CENTER } from "../utils/diseases"
import { OUTSIDE_TOWN, insideLockedTown } from "../utils/mapArea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const emptyForm = {
  full_name: "",
  farm_name: "",
  municipality: LOCKED_MUNICIPALITY,
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

  // Sync now
  const [syncTarget, setSyncTarget] = useState(null) // the farmer with no account
  const [syncMode, setSyncMode] = useState("existing") // "existing" | "new"
  const [syncForm, setSyncForm] = useState({ full_name: "", username: "", password: "" })
  const [accounts, setAccounts] = useState([]) // farmers that have a login
  const [syncing, setSyncing] = useState(false)

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
      municipality: LOCKED_MUNICIPALITY,
      farm_size_ha: farmer.farm_size_ha ?? "",
      // a farmer who signed up has no farm pin until their first sync
      farm_latitude: farmer.farm_latitude ?? MAP_CENTER[0],
      farm_longitude: farmer.farm_longitude ?? MAP_CENTER[1],
      username: farmer.username ?? "",
      password: "",
    })
    setHasAccount(farmer.has_account)
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    // the farm must be inside Echague (the server checks it too)
    if (!insideLockedTown(form.farm_latitude, form.farm_longitude)) {
      notify(OUTSIDE_TOWN, "error")
      return
    }
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
  // "Sync now" for a farmer with no account (a phone that synced before signing in, or a
  // farmer from the scan data): connect it to an existing farmer login, which moves its
  // scans into that account's farmer ID, or sign up a new account that keeps this farmer ID
  const openSync = (farmer) => {
    setSyncTarget(farmer)
    setSyncMode("existing")
    setSyncForm({ full_name: farmer.full_name, username: "", password: "" })
    getFarmers()
      .then((all) => setAccounts(all.filter((a) => a.has_account)))
      .catch((err) => console.error(err))
  }

  const handleSync = async (e) => {
    e.preventDefault()
    setSyncing(true)
    try {
      const data =
        syncMode === "existing"
          ? { username: syncForm.username }
          : { full_name: syncForm.full_name, username: syncForm.username, password: syncForm.password }
      const result = await syncFarmer(syncTarget.farmer_id, data)
      notify(
        result.merged_from
          ? `${result.merged_from}'s scans moved to ${result.farmer_id} (@${result.username}).`
          : `${result.farmer_id} is now connected to @${result.username}.`
      )
      setSyncTarget(null)
      reload()
    } catch (err) {
      console.error(err)
      notify(err.response?.data?.error || "Could not sync the farmer.", "error")
    } finally {
      setSyncing(false)
    }
  }

  const chosenAccount = accounts.find((a) => a.username === syncForm.username)

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
      {embedded ? (
        <div className="mb-4 flex justify-end">
          <Button onClick={openAdd}>
            <PlusIcon />
            Add farmer
          </Button>
        </div>
      ) : (
        <PageHeader
          title="Farmers"
          description="Registered farmers and their farms. Click a row to see a farmer's scans."
          action={
            <Button onClick={openAdd}>
              <PlusIcon />
              Add farmer
            </Button>
          }
        />
      )}

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-full grow sm:w-auto sm:min-w-48">
            <Label className="mb-1.5 text-muted-foreground">Search</Label>
            <Input
              placeholder="Name or farm name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-auto">
            <Label className="mb-1.5 text-muted-foreground">Municipality</Label>
            <SelectField
              className="w-full sm:w-48"
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
        <LoadingBlocks rows={6} height="h-10" label="Loading farmers" />
      ) : farmers.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No farmers found" text="Try another name or municipality, or add a farmer." />
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
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{f.full_name}</TableCell>
                  <TableCell>{f.farm_name || <span className="text-muted-foreground">Not set yet</span>}</TableCell>
                  <TableCell>{f.municipality}</TableCell>
                  <TableCell className="tabular-nums">{f.farm_size_ha}</TableCell>
                  <TableCell className="tabular-nums">{f.total_scans}</TableCell>
                  <TableCell>
                    <Badge variant={f.is_active ? "default" : "secondary"}>
                      {f.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      {!f.has_account && (
                        <Button size="sm" onClick={() => openSync(f)}>Sync now</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openEdit(f)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={f.is_active ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : ""}
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
              {/* locked: every farm is in Echague for now */}
              <SelectField
                value={LOCKED_MUNICIPALITY}
                onChange={() => {}}
                options={toOptions([LOCKED_MUNICIPALITY])}
                disabled
              />
            </div>
            <div>
              <Label className="mb-1.5">Farm size (ha)</Label>
              <Input type="number" step="0.1" min="0" value={form.farm_size_ha} onChange={(e) => handleChange("farm_size_ha", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5">
                Username{editingId ? ` (farmer ID ${editingId} stays the same)` : ""}
              </Label>
              {/* the farmer ID is given by the system and never changes; the username is only the login */}
              <Input
                value={form.username}
                onChange={(e) => handleChange("username", e.target.value)}
                disabled={Boolean(editingId) && hasAccount}
                minLength={3}
                required={!editingId || Boolean(form.password)}
              />
            </div>
            <div>
              <Label className="mb-1.5">
                {!editingId ? "Password" : hasAccount ? "New password (optional)" : "Password (creates their login)"}
              </Label>
              <PasswordInput
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
              onPick={(lat, lng) => {
                // a farm pin outside Echague is refused right away
                if (!insideLockedTown(lat, lng)) {
                  notify(OUTSIDE_TOWN, "error")
                  return
                }
                setForm({ ...form, farm_latitude: lat, farm_longitude: lng })
              }}
              points={[{ id: "farm", lat: form.farm_latitude, lng: form.farm_longitude, color: "#16A34A" }]}
            />
          </div>
          {/* a farm pinned before the Echague lock can still be outside it */}
          {!insideLockedTown(form.farm_latitude, form.farm_longitude) && (
            <p className="-mt-2 mb-4 text-sm text-destructive">
              This farm's pin is outside Echague. Click the map inside the Echague border to move it before saving.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(syncTarget)} title={`Sync now: ${syncTarget?.farmer_id ?? ""}`} onClose={() => setSyncTarget(null)}>
        {syncTarget && (
          <form onSubmit={handleSync}>
            <p className="text-sm text-muted-foreground mb-3">
              {syncTarget.full_name} has no account yet. Connect this farmer to a login.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <Button
                type="button"
                variant={syncMode === "existing" ? "default" : "outline"}
                onClick={() => setSyncMode("existing")}
              >
                Existing account
              </Button>
              <Button
                type="button"
                variant={syncMode === "new" ? "default" : "outline"}
                onClick={() => setSyncMode("new")}
              >
                New account
              </Button>
            </div>

            {syncMode === "existing" ? (
              <>
                <Label className="mb-1.5">Farmer account</Label>
                <div className="mb-3">
                  <SelectField
                    value={syncForm.username}
                    onChange={(v) => setSyncForm({ ...syncForm, username: v })}
                    options={accounts.map((a) => ({
                      value: a.username,
                      label: `@${a.username} - ${a.full_name} (${a.farmer_id})`,
                    }))}
                    placeholder={accounts.length === 0 ? "No farmer accounts yet" : "Choose an account"}
                  />
                </div>
                {chosenAccount && (
                  <p className="text-sm mb-4">
                    {syncTarget.total_scans} {syncTarget.total_scans === 1 ? "scan" : "scans"} from{" "}
                    {syncTarget.farmer_id} move to {chosenAccount.farmer_id}, and {syncTarget.farmer_id} is removed.{" "}
                    {chosenAccount.farmer_id}'s farm details stay the same.
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 mb-3">
                  <div>
                    <Label className="mb-1.5">Full name</Label>
                    <Input
                      value={syncForm.full_name}
                      onChange={(e) => setSyncForm({ ...syncForm, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5">Username</Label>
                    <Input
                      value={syncForm.username}
                      onChange={(e) => setSyncForm({ ...syncForm, username: e.target.value })}
                      minLength={3}
                      required
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5">Password</Label>
                    <PasswordInput
                      value={syncForm.password}
                      onChange={(e) => setSyncForm({ ...syncForm, password: e.target.value })}
                      minLength={6}
                      required
                    />
                  </div>
                </div>
                <p className="text-sm mb-4">
                  {syncTarget.farmer_id} stays this farmer's ID, with its scans and farm details.
                </p>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSyncTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={syncing || (syncMode === "existing" && !syncForm.username)}>
                {syncing ? "Syncing..." : "Sync now"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

export default Farmers
