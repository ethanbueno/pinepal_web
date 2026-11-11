import { useEffect, useState } from "react"
import { LockIcon, PencilIcon } from "lucide-react"
import { getProfile, updateProfile, changePassword } from "../api/profile"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import PageHeader from "../components/PageHeader"
import ErrorAlert from "../components/ErrorAlert"
import Modal from "../components/Modal"
import { getRoleLabel } from "../utils/roles"
import { formatDate } from "../utils/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

const MIN_PASSWORD = 6 // same as MIN_PASSWORD in backend/farmers.py

// One detail. locked = only an admin or officer can change it, so it gets a lock;
// the others can be changed with Edit profile. disabled = greyed out like a disabled
// field, with a note why (the municipality, while PinePal only covers Echague).
function DetailRow({ label, value, locked = false, disabled = false, note }) {
  return (
    <div
      className={
        "flex items-start justify-between gap-4 border-b py-2.5 text-sm last:border-b-0 " +
        (disabled ? "cursor-not-allowed opacity-50" : "")
      }
      aria-disabled={disabled || undefined}
    >
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {locked && <LockIcon className="size-3.5" aria-label="Can't be changed here" />}
        {label}
      </span>
      <span className={"text-right break-all " + (disabled ? "text-muted-foreground" : "font-medium")}>
        {value || "–"}
        {note && <span className="block text-xs">{note}</span>}
      </span>
    </div>
  )
}

const ECHAGUE_ONLY = "Echague only for now"

function Field({ id, label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?"

// The signed-in user's own details, from the database. The page only shows them;
// the floating Edit profile button opens the few that can be changed (the name,
// and for farmers the farm name and size). The password has its own card.
function Profile() {
  const { updateUser } = useAuth()
  const notify = useToast()

  const [profile, setProfile] = useState(null)
  const [error, setError] = useState("")

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ full_name: "", farm_name: "", farm_size_ha: "" })
  const [saving, setSaving] = useState(false)

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" })
  const [passwordError, setPasswordError] = useState("")
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch((err) => {
        console.error(err)
        setError("Could not load your profile.")
      })
  }, [])

  // the form starts on what is saved every time it opens
  const openEdit = () => {
    setForm({
      full_name: profile.account.full_name,
      farm_name: profile.farm?.farm_name ?? "",
      farm_size_ha: profile.farm?.farm_size_ha ?? "",
    })
    setEditing(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await updateProfile(form)
      setProfile(data)
      updateUser({ full_name: data.account.full_name })
      setEditing(false)
      notify("Profile saved.")
    } catch (err) {
      console.error(err)
      notify(err.response?.data?.error || "Could not save your profile.", "error")
    } finally {
      setSaving(false)
    }
  }

  const handlePassword = async (e) => {
    e.preventDefault()
    setPasswordError("")
    if (passwords.next.length < MIN_PASSWORD) {
      setPasswordError(`The new password must be at least ${MIN_PASSWORD} characters.`)
      return
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordError("The new passwords do not match.")
      return
    }
    setChanging(true)
    try {
      await changePassword(passwords.current, passwords.next)
      setPasswords({ current: "", next: "", confirm: "" })
      notify("Password changed.")
    } catch (err) {
      console.error(err)
      setPasswordError(err.response?.data?.error || "Could not change your password.")
    } finally {
      setChanging(false)
    }
  }

  const header = (
    <PageHeader
      title="My profile"
      description="Your details as saved in PinePal. Details with a lock can only be changed by an admin or officer."
    />
  )

  if (error) {
    return (
      <div>
        {header}
        <ErrorAlert>{error}</ErrorAlert>
      </div>
    )
  }

  if (!profile) {
    return (
      <div>
        {header}
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  const { account, farm } = profile
  const isFarmer = account.role === "farmer"
  const location =
    farm?.farm_latitude != null ? `${farm.farm_latitude.toFixed(5)}, ${farm.farm_longitude.toFixed(5)}` : "Not set yet"
  const size = farm?.farm_size_ha != null ? `${farm.farm_size_ha} ha` : ""

  return (
    // pb leaves room for the floating Edit profile button
    <div className="pb-24">
      {header}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-base font-semibold">
                {initials(account.full_name)}
              </span>
              <div className="min-w-0">
                <CardTitle className="truncate font-semibold">{account.full_name}</CardTitle>
                <CardDescription>{getRoleLabel(account.role)}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="mb-1 text-sm font-semibold">Personal details</h3>
            <DetailRow label="Full name" value={account.full_name} />
            <DetailRow label="Username" value={"@" + account.username} locked />
            <DetailRow label="Email" value={account.email} locked />
            <DetailRow label="Role" value={getRoleLabel(account.role)} locked />
            <DetailRow label="Municipality" value={account.municipality} locked disabled note={ECHAGUE_ONLY} />
            <DetailRow label="Member since" value={account.created_at && formatDate(account.created_at)} locked />
          </CardContent>
        </Card>

        {isFarmer && (
          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Farm</CardTitle>
              {!farm && <CardDescription>No farm is linked to your account yet.</CardDescription>}
            </CardHeader>
            {farm && (
              <CardContent>
                <DetailRow label="Farm name" value={farm.farm_name} />
                <DetailRow label="Farm size" value={size} />
                <DetailRow label="Farmer ID" value={farm.farmer_id} locked />
                <DetailRow label="Municipality" value={farm.municipality} locked disabled note={ECHAGUE_ONLY} />
                <DetailRow label="Farm location" value={location} locked />
                <DetailRow label="Status" value={farm.is_active ? "Active" : "Deactivated"} locked />
                <DetailRow label="Registered" value={formatDate(farm.registered_at)} locked />
                <DetailRow label="Scans" value={String(farm.total_scans)} locked />
              </CardContent>
            )}
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Change password</CardTitle>
            <CardDescription>Enter your current password first.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePassword} className="flex flex-col gap-4">
              <Field id="current-password" label="Current password">
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  required
                />
              </Field>
              <Field id="new-password" label="New password" hint={`At least ${MIN_PASSWORD} characters.`}>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwords.next}
                  onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
                  required
                />
              </Field>
              <Field id="confirm-password" label="Confirm new password">
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  required
                />
              </Field>
              {passwordError && <ErrorAlert className="">{passwordError}</ErrorAlert>}
              <Button type="submit" variant="outline" disabled={changing} className="w-full sm:w-fit">
                {changing ? "Changing..." : "Change password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* floating at the bottom of the screen, always in reach */}
      <Button
        size="lg"
        onClick={openEdit}
        className="fixed right-6 bottom-6 z-30 h-12 rounded-full px-6 text-base shadow-lg"
      >
        <PencilIcon className="size-4" /> Edit profile
      </Button>

      <Modal open={editing} title="Edit profile" onClose={() => setEditing(false)}>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {isFarmer
              ? "You can change your name, farm name and farm size. Ask your agricultural officer to change anything else."
              : "You can change your name. Ask an admin to change anything else."}
          </p>
          <Field id="full-name" label="Full name">
            <Input
              id="full-name"
              value={form.full_name}
              maxLength={100}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </Field>
          {isFarmer && (
            <>
              <Field id="farm-name" label="Farm name">
                <Input
                  id="farm-name"
                  value={form.farm_name}
                  maxLength={150}
                  placeholder="For example: Bueno Farm"
                  onChange={(e) => setForm({ ...form, farm_name: e.target.value })}
                />
              </Field>
              <Field id="farm-size" label="Farm size (hectares)">
                <Input
                  id="farm-size"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.farm_size_ha}
                  onChange={(e) => setForm({ ...form, farm_size_ha: e.target.value })}
                />
              </Field>
            </>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Profile
