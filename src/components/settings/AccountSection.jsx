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
  full_name: { label: "Full name", secure: false },
  username: { label: "Username", secure: true },
  email: { label: "Email", secure: true },
  new_password: { label: "Password", secure: true },
  farm_name: { label: "Farm name", secure: false },
  farm_size_ha: { label: "Farm size", secure: false },
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

// The cover until a photo is chosen: pineapple-leaf greens drawn with gradients, the same as
// the plain cover on the mobile app's Account tab (_Cover in my_profile_view.dart)
const COVER =
  "radial-gradient(120% 140% at 15% 0%, #4d8a3a 0%, transparent 55%)," +
  "radial-gradient(90% 120% at 85% 10%, #2f7d4f 0%, transparent 60%)," +
  "repeating-linear-gradient(115deg, rgba(255,255,255,0.07) 0 2px, transparent 2px 26px)," +
  "repeating-linear-gradient(65deg, rgba(0,0,0,0.08) 0 2px, transparent 2px 34px)," +
  "linear-gradient(135deg, #1f4d2b 0%, #2f6b35 45%, #173b22 100%)"

const PHOTO_TYPES = ["image/jpeg", "image/png"]
const MAX_PHOTO_BYTES = 10 * 1024 * 1024 // the server's limit (MAX_CONTENT_LENGTH in app.py)
const PHOTO_LABEL = { avatar: "Profile photo", cover: "Cover photo" }

// The menu behind a photo's change button: upload a new one, or remove the one there is
function PhotoMenu({ kind, hasPhoto, busy, onPick, onRemove, trigger, children }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={busy} render={trigger}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-44 rounded-xl p-1.5">
        <DropdownMenuItem className="h-9 gap-2.5 rounded-lg px-2.5" onClick={() => onPick(kind)}>
          <ImageIcon />
          {hasPhoto ? "Upload new photo" : "Upload photo"}
        </DropdownMenuItem>
        {hasPhoto && (
          <DropdownMenuItem
            variant="destructive"
            className="h-9 gap-2.5 rounded-lg px-2.5"
            onClick={() => onRemove(kind)}
          >
            <Trash2Icon />
            Remove photo
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The top of the Account section: the cover photo across the top, the profile photo over its
// bottom edge and the name beside it. Same layout as the Account screen in the mobile app.
function AccountHeader({ account, onChange }) {
  const { updateUser } = useAuth()
  const notify = useToast()
  const input = useRef(null)
  const [kind, setKind] = useState(null) // the photo the file picker is for
  const [busy, setBusy] = useState(null) // the photo being uploaded or removed

  const pick = (which) => {
    setKind(which)
    // after the menu has closed, or the browser may ignore the click
    setTimeout(() => input.current?.click(), 0)
  }

  const save = async (which, request, done) => {
    setBusy(which)
    try {
      const data = await request()
      onChange(data)
      updateUser({ avatar_url: data.account.avatar_url }) // the sidebar's user card
      notify(done)
    } catch (err) {
      console.error(err)
      notify(err.response?.data?.error || `Could not change your ${PHOTO_LABEL[which].toLowerCase()}.`, "error")
    } finally {
      setBusy(null)
    }
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = "" // so the same file can be picked again
    if (!file || !kind) return
    if (!PHOTO_TYPES.includes(file.type)) {
      notify("Choose a JPG or PNG photo.", "error")
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      notify("That photo is over 10 MB. Choose a smaller one.", "error")
      return
    }
    save(kind, () => uploadProfilePhoto(kind, file), `${PHOTO_LABEL[kind]} changed.`)
  }

  const remove = (which) => save(which, () => removeProfilePhoto(which), `${PHOTO_LABEL[which]} removed.`)

  return (
    <div className="pt-2 pb-4">
      <input ref={input} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />

      {/* the cover photo, or the plain green cover until there is one */}
      <div className="relative h-36 overflow-hidden rounded-xl border sm:h-48" style={{ background: COVER }}>
        {account.cover_url && <img src={account.cover_url} alt="" className="size-full object-cover" />}
        {busy === "cover" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2Icon className="size-6 animate-spin text-white" />
          </div>
        )}
        <div className="absolute top-3 right-3">
          <PhotoMenu
            kind="cover"
            hasPhoto={!!account.cover_url}
            busy={!!busy}
            onPick={pick}
            onRemove={remove}
            trigger={<Button variant="outline" size="sm" className="bg-card/90 backdrop-blur-sm" />}
          >
            <CameraIcon />
            Change cover
          </PhotoMenu>
        </div>
      </div>

      <div className="flex items-end gap-4 px-4 sm:px-6">
        <div className="relative -mt-12 shrink-0 sm:-mt-14">
          <Avatar className="size-24 rounded-full ring-4 ring-popover sm:size-28">
            {account.avatar_url && <AvatarImage src={account.avatar_url} alt="" />}
            <AvatarFallback className="rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
              {initials(account.full_name)}
            </AvatarFallback>
          </Avatar>
          {busy === "avatar" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2Icon className="size-6 animate-spin text-white" />
            </div>
          )}
          <div className="absolute right-0 bottom-0">
            <PhotoMenu
              kind="avatar"
              hasPhoto={!!account.avatar_url}
              busy={!!busy}
              onPick={pick}
              onRemove={remove}
              trigger={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Change profile photo"
                  className="rounded-full bg-card shadow-sm"
                />
              }
            >
              <CameraIcon />
            </PhotoMenu>
          </div>
        </div>
        <div className="min-w-0 pb-1">
          <div className="truncate text-lg font-semibold">{account.full_name}</div>
          <div className="truncate text-sm text-muted-foreground">
            @{account.username} · {getRoleLabel(account.role)}
          </div>
        </div>
      </div>
    </div>
  )
}

function Value({ children, muted }) {
  return <span className={"truncate text-sm " + (muted ? "text-muted-foreground" : "")}>{children || "–"}</span>
}

// Settings > Account: the signed-in user's photos and own details, each changed on its own row.
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
          <SettingsRow label="Farm location" hint="From your synced scans.">
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
