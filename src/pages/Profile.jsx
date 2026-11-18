import { useEffect, useState } from "react"
import {
  BadgeCheckIcon,
  CalendarIcon,
  HashIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  ShieldIcon,
  SmartphoneIcon,
  SproutIcon,
  UserIcon,
} from "lucide-react"
import { getProfile, updateProfile } from "../api/profile"
import { saveAppDownloadUrl } from "../api/settings"
import { setAppDownloadUrl, useAppDownloadUrl } from "../hooks/useAppDownloadUrl"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import ErrorAlert from "../components/ErrorAlert"
import PasswordInput from "../components/PasswordInput"
import PasswordChecklist from "../components/PasswordChecklist"
import Modal from "../components/Modal"
import { getRoleLabel } from "../utils/roles"
import { passwordProblem } from "../utils/passwordRules"
import { formatDate } from "../utils/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import LoadingBlocks from "../components/LoadingBlocks"

const ECHAGUE_ONLY = "Echague only for now"

// The cover: pineapple-leaf greens, drawn with gradients so there is no image to load
const COVER =
  "radial-gradient(120% 140% at 15% 0%, #4d8a3a 0%, transparent 55%)," +
  "radial-gradient(90% 120% at 85% 10%, #2f7d4f 0%, transparent 60%)," +
  "repeating-linear-gradient(115deg, rgba(255,255,255,0.07) 0 2px, transparent 2px 26px)," +
  "repeating-linear-gradient(65deg, rgba(0,0,0,0.08) 0 2px, transparent 2px 34px)," +
  "linear-gradient(135deg, #1f4d2b 0%, #2f6b35 45%, #173b22 100%)"

const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?"

// A section title in the app's accent color, like the reference's green headings
function SectionTitle({ children }) {
  return <CardTitle className="text-base font-semibold text-primary-text">{children}</CardTitle>
}

// One line of Personal info: an icon in a soft square, the value, and what it is under it.
// muted = greyed out, with a note (the municipality, while PinePal only covers Echague).
function InfoItem({ icon: Icon, value, label, muted = false, note }) {
  return (
    <div className={"flex items-center gap-3 " + (muted ? "opacity-50" : "")} aria-disabled={muted || undefined}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <div className={"truncate font-medium " + (muted ? "text-muted-foreground" : "")}>{value || "–"}</div>
        <div className="text-xs text-muted-foreground">
          {label}
          {note && ` · ${note}`}
        </div>
      </div>
    </div>
  )
}

// A number tile of the Overview card
function StatTile({ value, label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-primary/10 px-3 py-4 text-center">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs font-medium text-primary-text">{label}</div>
    </div>
  )
}

function Chip({ children }) {
  return <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{children}</span>
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

// What Edit profile can change, one at a time. Only the field being changed is sent, so
// everything else stays exactly as it is. secure = a sign-in detail, which needs the
// current password first (the server checks it too).
const EDITABLE = [
  { key: "full_name", label: "Full name", secure: false },
  { key: "username", label: "Username", secure: true },
  { key: "email", label: "Email", secure: true },
  { key: "new_password", label: "Password", secure: true },
  { key: "farm_name", label: "Farm name", secure: false, farmOnly: true },
  { key: "farm_size_ha", label: "Farm size", secure: false, farmOnly: true },
]

// The saved value of a field, as the form starts with it ("" for the password)
function savedValue(key, { account, farm }) {
  if (key === "full_name") return account.full_name
  if (key === "username") return account.username
  if (key === "email") return account.email ?? ""
  if (key === "farm_name") return farm?.farm_name ?? ""
  if (key === "farm_size_ha") return farm?.farm_size_ha ?? ""
  return ""
}

// The saved value as the list shows it
function shownValue(key, profile) {
  if (key === "new_password") return "••••••••"
  if (key === "username") return "@" + profile.account.username
  if (key === "farm_size_ha") return profile.farm?.farm_size_ha != null ? `${profile.farm.farm_size_ha} ha` : ""
  return savedValue(key, profile)
}

// Admins only: where the Android app is downloaded from (the login page's Download button
// and the sidebar card). Saved in the database for everyone (backend/app_settings.py).
function AppDownloadCard() {
  const notify = useToast()
  const saved = useAppDownloadUrl()
  // what the admin typed, or null to show the stored link (it may still be loading)
  const [draft, setDraft] = useState(null)
  const value = draft ?? saved
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async (e) => {
    e.preventDefault()
    const url = value.trim()
    setFormError("")
    if (!/^https?:\/\/\S+$/i.test(url)) {
      setFormError("Enter a full link that starts with https://")
      return
    }
    setSaving(true)
    try {
      const stored = await saveAppDownloadUrl(url)
      setAppDownloadUrl(stored)
      setDraft(null)
      notify("Download link saved.")
    } catch (err) {
      console.error(err)
      setFormError(err.response?.data?.error || "Could not save the download link.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <SectionTitle>Mobile app</SectionTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <Field
            id="app-download-url"
            label="Download link"
            hint="Used by Download mobile app on the login page and in the sidebar, for everyone."
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <SmartphoneIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="app-download-url"
                  type="url"
                  inputMode="url"
                  className="pl-9"
                  value={value}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="https://"
                />
              </div>
              <Button type="submit" disabled={saving || value.trim() === saved}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </Field>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </form>
      </CardContent>
    </Card>
  )
}

// The signed-in user's own details, from the database, laid out like a profile:
// a cover with the name, Overview and Farm for farmers, Personal info on the side.
// Edit profile lists what can be changed; each detail is changed on its own.
function Profile() {
  const { updateUser } = useAuth()
  const notify = useToast()

  const [profile, setProfile] = useState(null)
  const [error, setError] = useState("")

  const [editing, setEditing] = useState(false) // the Edit profile popup is open
  const [field, setField] = useState(null) // the one detail being changed, or null
  const [value, setValue] = useState("")
  const [confirm, setConfirm] = useState("") // the new password again
  const [current, setCurrent] = useState("") // the current password, for sign-in details
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch((err) => {
        console.error(err)
        setError("Could not load your profile.")
      })
  }, [])

  const openEdit = () => {
    setField(null)
    setEditing(true)
  }

  const closeEdit = () => {
    setField(null)
    setEditing(false)
  }

  // open one detail for changing, starting on what is saved
  const startChange = (key) => {
    setField(key)
    setValue(String(savedValue(key, profile)))
    setConfirm("")
    setCurrent("")
    setFormError("")
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const item = EDITABLE.find((f) => f.key === field)
    const text = field === "new_password" ? value : value.trim()
    setFormError("")

    if (field !== "new_password" && text === String(savedValue(field, profile))) {
      setFormError("That's the same as what is saved.")
      return
    }
    if ((field === "full_name" || field === "username" || field === "email") && !text) {
      setFormError(`Enter your ${item.label.toLowerCase()}.`)
      return
    }
    if (field === "new_password") {
      if (passwordProblem(text)) {
        setFormError(passwordProblem(text))
        return
      }
      if (text !== confirm) {
        setFormError("The new passwords do not match.")
        return
      }
    }
    if (item.secure && !current) {
      setFormError(`Enter your current password to change your ${item.label.toLowerCase()}.`)
      return
    }

    setSaving(true)
    try {
      // only this one detail is sent; the server leaves the rest as they are
      const data = await updateProfile({ [field]: text, ...(item.secure ? { current_password: current } : {}) })
      setProfile(data)
      updateUser({ full_name: data.account.full_name, username: data.account.username })
      setField(null)
      notify(`${item.label} changed.`)
    } catch (err) {
      console.error(err)
      setFormError(err.response?.data?.error || `Could not change your ${item.label.toLowerCase()}.`)
    } finally {
      setSaving(false)
    }
  }

  if (error) return <ErrorAlert>{error}</ErrorAlert>

  if (!profile) {
    return (
      <LoadingBlocks rows={2} height="h-48" label="Loading your profile" />
    )
  }

  const { account, farm } = profile
  const isFarmer = account.role === "farmer"
  const role = getRoleLabel(account.role)
  const active = !isFarmer || !farm || farm.is_active
  const location =
    farm?.farm_latitude != null ? `${farm.farm_latitude.toFixed(5)}, ${farm.farm_longitude.toFixed(5)}` : "Not set yet"

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-4">
        {/* the profile card: cover, avatar, name, and Edit profile */}
        <Card className="gap-0 py-0">
          <div className="h-32 sm:h-40" style={{ background: COVER }} aria-hidden="true" />
          <div className="flex flex-col gap-4 px-(--card-spacing) pb-4 sm:flex-row sm:items-end sm:gap-5 sm:px-6">
            <div className="-mt-12 flex size-24 shrink-0 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground ring-4 ring-card sm:-mt-16 sm:size-32 sm:text-4xl">
              {initials(account.full_name)}
            </div>
            <div className="min-w-0 sm:pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight">{account.full_name}</h1>
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary-text">
                  {role}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  {isFarmer ? <SproutIcon className="size-4" /> : <ShieldIcon className="size-4" />}
                  {isFarmer && farm?.farm_name ? farm.farm_name : role}
                </span>
                <span className="flex items-center gap-1.5 opacity-60" title={ECHAGUE_ONLY}>
                  <MapPinIcon className="size-4" />
                  {account.municipality || "No municipality yet"}, Isabela
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip>@{account.username}</Chip>
                {farm && <Chip>Farmer ID {farm.farmer_id}</Chip>}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t px-(--card-spacing) py-3 sm:px-6">
            <span
              className={
                "flex items-center gap-1.5 text-sm font-medium " +
                (active ? "text-green-700 dark:text-green-400" : "text-destructive")
              }
            >
              <BadgeCheckIcon className="size-4" />
              {active ? "Active account" : "Deactivated account"}
            </span>
            <Button onClick={openEdit}>
              <PencilIcon className="size-4" /> Edit profile
            </Button>
          </div>
        </Card>

        {account.role === "admin" && <AppDownloadCard />}

        {isFarmer && farm && (
          <>
            <Card>
              <CardHeader>
                <SectionTitle>Overview</SectionTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatTile value={farm.total_scans} label="Scans" />
                <StatTile value={farm.farm_size_ha != null ? `${farm.farm_size_ha} ha` : "–"} label="Farm size" />
                <StatTile value={farm.is_active ? "Active" : "Off"} label="Farm status" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <SectionTitle>Farm</SectionTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <InfoItem icon={SproutIcon} value={farm.farm_name || "No farm name yet"} label="Farm name" />
                <InfoItem icon={HashIcon} value={farm.farmer_id} label="Farmer ID" />
                <InfoItem icon={MapPinIcon} value={location} label="Farm location" />
                <InfoItem icon={CalendarIcon} value={formatDate(farm.registered_at)} label="Registered" />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* the side column */}
      <Card className="lg:sticky lg:top-4">
        <CardHeader>
          <SectionTitle>Personal info</SectionTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <InfoItem icon={MailIcon} value={account.email} label="Email" />
          <InfoItem icon={UserIcon} value={"@" + account.username} label="Username" />
          <InfoItem icon={ShieldIcon} value={role} label="Role" />
          <InfoItem icon={MapPinIcon} value={account.municipality} label="Municipality" muted note={ECHAGUE_ONLY} />
          <InfoItem
            icon={CalendarIcon}
            value={account.created_at ? formatDate(account.created_at) : ""}
            label="Joined"
          />
          <p className="border-t pt-3 text-xs text-muted-foreground">
            Change your email, username or password with Edit profile. Your role, municipality and join date can only be
            changed by an admin.
          </p>
        </CardContent>
      </Card>

      <Modal open={editing} title="Edit profile" onClose={closeEdit}>
        <p className="-mt-1 mb-1 text-sm text-muted-foreground">
          Choose what to change. Only that detail is saved; everything else stays the same.
        </p>
        <ul className="divide-y rounded-lg border">
          {EDITABLE.filter((item) => !item.farmOnly || (isFarmer && farm)).map((item) => {
            const open = field === item.key
            return (
              <li key={item.key} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                    <div className="truncate font-medium">{shownValue(item.key, profile) || "–"}</div>
                  </div>
                  {!open && (
                    <Button variant="outline" size="sm" disabled={field !== null} onClick={() => startChange(item.key)}>
                      Change
                    </Button>
                  )}
                </div>

                {open && (
                  <form onSubmit={handleSave} className="mt-3 flex flex-col gap-3">
                    {item.key === "new_password" ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field id="edit-value" label="New password">
                          <PasswordInput
                            id="edit-value"
                            autoComplete="new-password"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            autoFocus
                            required
                          />
                        </Field>
                        <Field id="edit-confirm" label="Confirm new password">
                          <PasswordInput
                            id="edit-confirm"
                            autoComplete="new-password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            required
                          />
                        </Field>
                        <PasswordChecklist password={value} confirm={confirm} className="sm:col-span-2" />
                      </div>
                    ) : (
                      <Field id="edit-value" label={`New ${item.label.toLowerCase()}`}>
                        <Input
                          id="edit-value"
                          type={item.key === "email" ? "email" : item.key === "farm_size_ha" ? "number" : "text"}
                          step={item.key === "farm_size_ha" ? "0.1" : undefined}
                          min={item.key === "farm_size_ha" ? "0" : undefined}
                          maxLength={item.key === "username" ? 50 : item.key === "full_name" ? 100 : 150}
                          autoComplete={
                            item.key === "email" ? "email" : item.key === "username" ? "username" : undefined
                          }
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          autoFocus
                        />
                      </Field>
                    )}

                    {item.secure && (
                      <Field id="edit-current" label="Current password" hint="Needed to change your sign-in details.">
                        <PasswordInput
                          id="edit-current"
                          autoComplete="current-password"
                          value={current}
                          onChange={(e) => setCurrent(e.target.value)}
                          required
                        />
                      </Field>
                    )}

                    {formError && <ErrorAlert className="">{formError}</ErrorAlert>}

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setField(null)}>
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" disabled={saving}>
                        {saving ? "Saving..." : `Save ${item.label.toLowerCase()}`}
                      </Button>
                    </div>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
        <div className="flex justify-end">
          <Button variant="outline" onClick={closeEdit}>
            Done
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default Profile
