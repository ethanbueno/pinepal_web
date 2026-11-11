import { useEffect, useState } from "react"
import { LockIcon } from "lucide-react"
import { getProfile, updateProfile, changePassword } from "../api/profile"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import PageHeader from "../components/PageHeader"
import ErrorAlert from "../components/ErrorAlert"
import { getRoleLabel } from "../utils/roles"
import { formatDate } from "../utils/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

const MIN_PASSWORD = 6 // same as MIN_PASSWORD in backend/farmers.py

// A detail the user can see but not change: only an admin or officer can
function LockedRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2.5 text-sm last:border-b-0">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <LockIcon className="size-3.5" aria-label="Can't be changed here" />
        {label}
      </span>
      <span className="text-right font-medium break-all">{value || "–"}</span>
    </div>
  )
}

function Field({ id, label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// The signed-in user's own details, from the database. Only a few things can be changed here:
// the name, and for farmers the farm name and size, plus the password. The rest is locked.
function Profile() {
  const { updateUser } = useAuth()
  const notify = useToast()

  const [profile, setProfile] = useState(null)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ full_name: "", farm_name: "", farm_size_ha: "" })
  const [saving, setSaving] = useState(false)

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" })
  const [passwordError, setPasswordError] = useState("")
  const [changing, setChanging] = useState(false)

  const fillForm = (data) =>
    setForm({
      full_name: data.account.full_name,
      farm_name: data.farm?.farm_name ?? "",
      farm_size_ha: data.farm?.farm_size_ha ?? "",
    })

  useEffect(() => {
    getProfile()
      .then((data) => {
        setProfile(data)
        fillForm(data)
      })
      .catch((err) => {
        console.error(err)
        setError("Could not load your profile.")
      })
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await updateProfile(form)
      setProfile(data)
      fillForm(data)
      updateUser({ full_name: data.account.full_name })
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

  return (
    <div>
      {header}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* what can be changed */}
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Edit details</CardTitle>
            <CardDescription>
              {isFarmer ? "Your name, farm name and farm size." : "The name shown on your account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
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
              <Button type="submit" disabled={saving} className="w-full sm:w-fit">
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* what can only be looked at */}
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold">Account</CardTitle>
            <CardDescription>These details are locked.</CardDescription>
          </CardHeader>
          <CardContent>
            <LockedRow label="Username" value={"@" + account.username} />
            <LockedRow label="Email" value={account.email} />
            <LockedRow label="Role" value={getRoleLabel(account.role)} />
            <LockedRow label="Member since" value={account.created_at && formatDate(account.created_at)} />
          </CardContent>
        </Card>

        {isFarmer && (
          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Farm</CardTitle>
              <CardDescription>
                {farm ? "Set by PinePal or your agricultural officer." : "No farm is linked to your account yet."}
              </CardDescription>
            </CardHeader>
            {farm && (
              <CardContent>
                <LockedRow label="Farmer ID" value={farm.farmer_id} />
                <LockedRow label="Municipality" value={farm.municipality} />
                <LockedRow label="Farm location" value={location} />
                <LockedRow label="Status" value={farm.is_active ? "Active" : "Deactivated"} />
                <LockedRow label="Registered" value={formatDate(farm.registered_at)} />
                <LockedRow label="Scans" value={String(farm.total_scans)} />
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
    </div>
  )
}

export default Profile
