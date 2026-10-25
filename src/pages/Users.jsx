import { useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"
import { getUsers, createUser, updateUser, deleteUser } from "../api/users"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import Modal from "../components/Modal"
import ConfirmModal from "../components/ConfirmModal"
import ErrorAlert from "../components/ErrorAlert"
import SelectField from "../components/SelectField"
import { ROLES, getRoleLabel } from "../utils/roles"
import { formatDate } from "../utils/format"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// every account in the users table (admin, officer and farmer) is listed and editable here
const emptyForm = { full_name: "", username: "", role: "officer", password: "" }

function Users() {
  const { user: currentUser } = useAuth()
  const notify = useToast()

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

  const reload = () => setReloadCount(reloadCount + 1)
  const handleChange = (name, value) => setForm({ ...form, [name]: value })

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
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
      notify("Could not delete the user.", "error")
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading users...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-medium">Users</h1>
        <Button onClick={openAdd}>
          <PlusIcon />
          Add user
        </Button>
      </div>

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
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className=" text-center text-muted-foreground">No users yet.</TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id} className=" hover:bg-muted">
                <TableCell>{u.full_name}</TableCell>
                <TableCell>@{u.username}</TableCell>
                <TableCell>{getRoleLabel(u.role)}</TableCell>
                <TableCell>{formatDate(u.created_at)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(u)}>Edit</Button>
                    {/* an admin can't delete their own account */}
                    {u.id !== currentUser.id && (
                      <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(u)}>Delete</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Modal open={showForm} title={editingId ? "Edit user" : "Add user"} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSave}>
          <div className="grid gap-3 mb-4">
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
              <SelectField value={form.role} onChange={(v) => handleChange("role", v)} options={ROLES} />
            </div>
            <div>
              <Label className="mb-1.5">{editingId ? "New password (optional)" : "Password"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                required={!editingId}
              />
            </div>
          </div>

          {formError && <ErrorAlert>{formError}</ErrorAlert>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
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
