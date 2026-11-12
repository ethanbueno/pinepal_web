import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { PlusIcon } from "lucide-react"
import { getUsers, createUser, updateUser, deleteUser } from "../api/users"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import Modal from "../components/Modal"
import ConfirmModal from "../components/ConfirmModal"
import ErrorAlert from "../components/ErrorAlert"
import PageHeader from "../components/PageHeader"
import LoadingBlocks from "../components/LoadingBlocks"
import PasswordInput from "../components/PasswordInput"
import SelectField, { toOptions } from "../components/SelectField"
import { ROLES, getRoleLabel } from "../utils/roles"
import { LOCKED_MUNICIPALITY } from "../utils/diseases"
import { formatDate } from "../utils/format"
import Farmers from "./Farmers"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Accounts sorted into tabs by role. Admins and officers are plain accounts edited here;
// the Farmers tab is the full farmers list, since a farmer also has a farm to manage.
const TABS = [
  { value: "admins", role: "admin", label: "Admins" },
  { value: "officers", role: "officer", label: "Officers" },
  { value: "farmers", role: "farmer", label: "Farmers" },
]

// farmers are added from the Farmers tab, together with their farm
const ACCOUNT_ROLES = ROLES.filter((r) => r.value !== "farmer")

const emptyForm = { full_name: "", username: "", role: "officer", password: "" }

function Users() {
  const { user: currentUser } = useAuth()
  const notify = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.find((t) => t.value === searchParams.get("tab")) || TABS[0]

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadCount, setReloadCount] = useState(0)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    let ignore = false

    getUsers()
      .then((data) => {
        if (ignore) return
        setUsers(data)
        setError("")
        setLoading(false)
      })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setError("Could not load users.")
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [reloadCount])

  const tabUsers = users.filter((u) => u.role === tab.role)
  const countOf = (role) => users.filter((u) => u.role === role).length

  const reload = () => setReloadCount(reloadCount + 1)
  const handleChange = (name, value) => setForm({ ...form, [name]: value })

  const openAdd = () => {
    setEditingId(null)
    setForm({ ...emptyForm, role: tab.role })
    setFormError("")
    setShowForm(true)
  }

  const openEdit = (u) => {
    setEditingId(u.id)
    setForm({ full_name: u.full_name, username: u.username, role: u.role, password: "" })
    setFormError("")
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setFormError("")
    setSaving(true)
    try {
      if (editingId) {
        await updateUser(editingId, form)
        notify("User updated.")
      } else {
        await createUser(form)
        notify("User added.")
      }
      setShowForm(false)
      reload()
    } catch (err) {
      console.error(err)
      setFormError(err.response?.data?.error || "Could not save the user.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      await deleteUser(target.id)
      notify(`Deleted @${target.username}.`)
      reload()
    } catch (err) {
      console.error(err)
      notify(err.response?.data?.error || "Could not delete the user.", "error")
    }
  }

  const header = <PageHeader title="Users" description="Accounts that can sign in, sorted by role." />

  if (loading) {
    return (
      <div>
        {header}
        <LoadingBlocks rows={5} height="h-10" label="Loading users" />
      </div>
    )
  }

  return (
    <div>
      {header}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab.value} onValueChange={(value) => setSearchParams({ tab: value })}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="px-3">
                {t.label}
                {/* farmer counts come from the farmers list in that tab, not from accounts */}
                {t.role !== "farmer" && (
                  <span className="ml-1.5 rounded-full bg-background px-1.5 text-xs tabular-nums text-muted-foreground">
                    {countOf(t.role)}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {tab.role !== "farmer" && (
          <Button onClick={openAdd}>
            <PlusIcon />
            Add {tab.role === "admin" ? "admin" : "officer"}
          </Button>
        )}
      </div>

      {tab.role === "farmer" ? (
        <Farmers embedded />
      ) : (
        <>
          {error && <ErrorAlert>{error}</ErrorAlert>}

          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tabUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No {tab.label.toLowerCase()} yet.
                    </TableCell>
                  </TableRow>
                )}
                {tabUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">@{u.username}</TableCell>
                    <TableCell>{getRoleLabel(u.role)}</TableCell>
                    <TableCell>{formatDate(u.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                          Edit
                        </Button>
                        {/* an admin can't delete their own account */}
                        {u.id !== currentUser.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(u)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <Modal open={showForm} title={editingId ? "Edit user" : "Add user"} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSave}>
          <div className="mb-4 grid gap-4">
            <div>
              <Label className="mb-1.5">Full name</Label>
              <Input value={form.full_name} onChange={(e) => handleChange("full_name", e.target.value)} required />
            </div>
            <div>
              <Label className="mb-1.5">Username</Label>
              <Input value={form.username} onChange={(e) => handleChange("username", e.target.value)} required />
            </div>
            <div>
              <Label className="mb-1.5">Role</Label>
              <SelectField value={form.role} onChange={(v) => handleChange("role", v)} options={ACCOUNT_ROLES} />
            </div>
            <div>
              {/* locked: every account is in Echague for now */}
              <Label className="mb-1.5">Municipality</Label>
              <SelectField
                value={LOCKED_MUNICIPALITY}
                onChange={() => {}}
                options={toOptions([LOCKED_MUNICIPALITY])}
                disabled
              />
            </div>
            <div>
              <Label className="mb-1.5">{editingId ? "New password (optional)" : "Password"}</Label>
              <PasswordInput
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                required={!editingId}
              />
            </div>
          </div>

          {formError && <ErrorAlert>{formError}</ErrorAlert>}

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
        title="Delete user?"
        message={`Are you sure you want to delete @${deleteTarget?.username}? This can't be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export default Users
