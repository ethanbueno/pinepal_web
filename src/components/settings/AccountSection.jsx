import { useEffect, useRef, useState } from "react"
import { CameraIcon, ImageIcon, Loader2Icon, Trash2Icon } from "lucide-react"
import { getProfile, removeProfilePhoto, updateProfile, uploadProfilePhoto } from "../../api/profile"
import { useAuth } from "../../context/AuthContext"
import { useToast } from "../toastcontext"
import { getRoleLabel } from "../../utils/roles"
import { passwordProblem } from "../../utils/passwordRules"
import { formatDate } from "../../utils/format"
import PasswordInput from "../PasswordInput"
import PasswordChecklist from "../PasswordChecklist"
import LoadingBlocks from "../LoadingBlocks"
import ErrorAlert from "../ErrorAlert"
import SettingsRow from "./SettingsRow"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?"

// What can be changed, one at a time. Only the field being changed is sent, so everything
// else stays as it is. secure = a sign-in detail, which needs the current password first
// (the server checks it too, backend/my_profile.py).
const EDITABLE = {
  full_name: { label: "Full Name", secure: false },
  username: { label: "Username", secure: true },
  email: { label: "Email", secure: true },
  new_password: { label: "Password", secure: true },
  farm_name: { label: "Farm Name", secure: false },
  farm_size_ha: { label: "Farm Size", secure: false },
}

// The saved value of a field, as the form starts with it ("" for the password)
function savedValue(key, { account, farm }) {
  if (key === "full_name") return account.full_name
  if (key === "username") return account.username
  if (key === "email") return account.email ?? ""
  if (key === "farm_name") return farm?.farm_name ?? ""
  if (key === "farm_size_ha") return farm?.farm_size_ha ?? ""
  return ""
}

// The saved value as the row shows it
function shownValue(key, profile) {
  if (key === "new_password") return "••••••••"
  if (key === "username") return "@" + profile.account.username
  if (key === "farm_size_ha") return profile.farm?.farm_size_ha != null ? `${profile.farm.farm_size_ha} ha` : ""
  return savedValue(key, profile)
}

const PHOTO_TYPES = ["image/jpeg", "image/png"]
const MAX_PHOTO_BYTES = 10 * 1024 * 1024 // the server's limit (MAX_CONTENT_LENGTH in app.py)

// The top of the Account section: the profile photo with its change menu (upload a new one,
// or remove it), the name beside it. Same layout as the Account tab in the mobile app.
function AccountHeader({ account, onChange }) {
  const { updateUser } = useAuth()
  const notify = useToast()
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const hasPhoto = !!account.avatar_url

  const pick = () => {
    // after the menu has closed, or the browser may ignore the click
    setTimeout(() => input.current?.click(), 0)
  }

  const save = async (request, done) => {
    setBusy(true)
    try {
      const data = await request()
      onChange(data)
      updateUser({ avatar_url: data.account.avatar_url }) // the sidebar's user card
      notify(done)
    } catch (err) {
      console.error(err)
      notify(err.response?.data?.error || "Could not change your profile photo.", "error")
    } finally {
      setBusy(false)
    }
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = "" // so the same file can be picked again
    if (!file) return
    if (!PHOTO_TYPES.includes(file.type)) {
      notify("Choose a JPG or PNG photo.", "error")
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      notify("That photo is over 10 MB. Choose a smaller one.", "error")
      return
    }
    save(() => uploadProfilePhoto(file), "Profile photo changed.")
  }

  const remove = () => save(removeProfilePhoto, "Profile photo removed.")

  return (
    <div className="flex items-center gap-4 pt-2 pb-5">
      <input ref={input} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />
      <div className="relative shrink-0">
        <Avatar className="size-20 rounded-full sm:size-24">
          {hasPhoto && <AvatarImage src={account.avatar_url} alt="" />}
          <AvatarFallback className="rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
            {initials(account.full_name)}
          </AvatarFallback>
        </Avatar>
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <Loader2Icon className="size-6 animate-spin text-white" />
          </div>
        )}
        <div className="absolute -right-1 -bottom-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={busy}
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Change profile photo"
                  className="rounded-full bg-card shadow-sm"
                />
              }
            >
              <CameraIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="min-w-44 rounded-xl p-1.5">
              <DropdownMenuItem className="h-9 gap-2.5 rounded-lg px-2.5" onClick={pick}>
                <ImageIcon />
                {hasPhoto ? "Upload New Photo" : "Upload Photo"}
              </DropdownMenuItem>
              {hasPhoto && (
                <DropdownMenuItem variant="destructive" className="h-9 gap-2.5 rounded-lg px-2.5" onClick={remove}>
                  <Trash2Icon />
                  Remove Photo
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-lg font-semibold">{account.full_name}</div>
        <div className="truncate text-sm text-muted-foreground">
          @{account.username} · {getRoleLabel(account.role)}
        </div>
      </div>
    </div>
  )
}

function Value({ children, muted }) {
  return <span className={"truncate text-sm " + (muted ? "text-muted-foreground" : "")}>{children || "–"}</span>
}

// Settings > Account: the signed-in user's photo and own details, each changed on its own row.
function AccountSection() {
  const { updateUser } = useAuth()
  const notify = useToast()

  const [profile, setProfile] = useState(null)
  const [error, setError] = useState("")

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
        setError("Could not load your account.")
      })
  }, [])

  if (error) return <ErrorAlert>{error}</ErrorAlert>
  if (!profile) return <LoadingBlocks rows={3} height="h-12" label="Loading your account" />

  const { account, farm } = profile
  const isFarmer = account.role === "farmer"

  const startChange = (key) => {
    setField(key)
    setValue(String(savedValue(key, profile)))
    setConfirm("")
    setCurrent("")
    setFormError("")
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const item = EDITABLE[field]
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

  // a row that can be changed: the value and Change, or the form while it is open
  const editRow = (key) => {
    const item = EDITABLE[key]
    if (field !== key) {
      return (
        <SettingsRow key={key} label={item.label}>
          <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end">
            <Value>{shownValue(key, profile)}</Value>
            <Button variant="outline" size="sm" disabled={field !== null} onClick={() => startChange(key)}>
              Change
            </Button>
          </div>
        </SettingsRow>
      )
    }
    return (
      <SettingsRow key={key} label={item.label} hint={item.secure ? "Needs your current password." : undefined}>
        <form onSubmit={handleSave} className="flex w-full flex-col gap-2 sm:max-w-sm">
          {key === "new_password" ? (
            <>
              <PasswordInput
                aria-label="New password"
                placeholder="New password"
                autoComplete="new-password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                required
              />
              <PasswordInput
                aria-label="Confirm new password"
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <PasswordChecklist password={value} confirm={confirm} />
            </>
          ) : (
            <Input
              aria-label={`New ${item.label.toLowerCase()}`}
              type={key === "email" ? "email" : key === "farm_size_ha" ? "number" : "text"}
              step={key === "farm_size_ha" ? "0.1" : undefined}
              min={key === "farm_size_ha" ? "0" : undefined}
              maxLength={key === "username" ? 50 : key === "full_name" ? 100 : 150}
              autoComplete={key === "email" ? "email" : key === "username" ? "username" : undefined}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          )}
          {item.secure && (
            <PasswordInput
              aria-label="Current password"
              placeholder="Current password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          )}
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setField(null)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </SettingsRow>
    )
  }

  const location =
    farm?.farm_latitude != null ? `${farm.farm_latitude.toFixed(5)}, ${farm.farm_longitude.toFixed(5)}` : "Not set yet"

  return (
    <div className="divide-y">
      <AccountHeader account={account} onChange={setProfile} />
      {editRow("full_name")}
      {editRow("username")}
      {editRow("email")}
      {editRow("new_password")}

      {isFarmer && farm && (
        <>
          {editRow("farm_name")}
          {editRow("farm_size_ha")}
          <SettingsRow label="Farmer ID">
            <Value>{farm.farmer_id}</Value>
          </SettingsRow>
          <SettingsRow label="Farm Location" hint="From your synced scans.">
            <Value>{location}</Value>
          </SettingsRow>
        </>
      )}

      <SettingsRow label="Role" hint="Only an admin can change it.">
        <Value>{getRoleLabel(account.role)}</Value>
      </SettingsRow>
      <SettingsRow label="Municipality" hint="Echague only for now.">
        <Value muted>{account.municipality ? `${account.municipality}, Isabela` : ""}</Value>
      </SettingsRow>
      <SettingsRow label="Joined">
        <Value>{account.created_at ? formatDate(account.created_at) : ""}</Value>
      </SettingsRow>
    </div>
  )
}

export default AccountSection
