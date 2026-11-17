import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { getProtocols, createProtocol, updateProtocol, deleteProtocol } from "../api/protocols"
import { useToast } from "../components/toastcontext"
import BackButton from "../components/BackButton"
import ConfirmModal from "../components/ConfirmModal"
import ErrorAlert from "../components/ErrorAlert"
import GuideEditForm from "../components/GuideEditForm"
import GuideTile from "../components/GuideTile"
import LoadingBlocks from "../components/LoadingBlocks"
import PageHeader from "../components/PageHeader"
import ProtocolCard from "../components/ProtocolCard"
import { Button } from "@/components/ui/button"

// The guides API is still a mock, so say where the changes go
function MockNote() {
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      Changes last until the page is refreshed. Saving to the database is not set up yet.
    </p>
  )
}

// The staff Guide page: the same compact list and full guide as the farmer Guides page
// (?guide=<id> opens one), plus adding, editing and deleting guides.
function Protocols() {
  const [protocols, setProtocols] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadCount, setReloadCount] = useState(0)

  // editor = null when closed, { protocol } when open (protocol null = a new guide)
  const [editor, setEditor] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
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

  const reload = () => setReloadCount((n) => n + 1)

  // errors are thrown back to the form, which shows them and stays open
  const handleSave = async (fields) => {
    const editing = editor.protocol
    if (editing) {
      await updateProtocol(editing.protocol_id, fields)
      notify("Guide updated.")
      setEditor(null)
      reload()
    } else {
      const created = await createProtocol(fields)
      notify("Guide added.")
      setEditor(null)
      reload()
      navigate("?guide=" + created.protocol_id)
    }
  }

  const handleDelete = async () => {
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      await deleteProtocol(target.protocol_id)
      notify("Guide deleted.")
      navigate("/protocols")
      reload()
    } catch (err) {
      console.error(err)
      notify("Could not delete the guide.", "error")
    }
  }

  const guideId = searchParams.get("guide")
  const selected = guideId ? protocols.find((p) => String(p.protocol_id) === guideId) : null

  const dialogs = (
    <>
      {editor && (
        <GuideEditForm
          key={editor.protocol ? editor.protocol.protocol_id : "new"}
          open
          protocol={editor.protocol}
          onSave={handleSave}
          onClose={() => setEditor(null)}
        />
      )}
      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete guide?"
        message={`Are you sure you want to delete the guide for ${deleteTarget?.display_name}? The app will have no remediation guide for it. This can't be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )

  // one guide, the same full card farmers see, with edit and delete on top
  if (selected) {
    return (
      <div className="w-full">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <BackButton to="/protocols">All guides</BackButton>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteTarget(selected)}
            >
              <Trash2Icon />
              Delete
            </Button>
            <Button size="sm" onClick={() => setEditor({ protocol: selected })}>
              <PencilIcon />
              Edit guide
            </Button>
          </div>
        </div>
        <ProtocolCard protocol={selected} wide />
        <MockNote />
        {dialogs}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Guide"
        description="Click a condition to see its guide and edit it."
        action={
          <Button onClick={() => setEditor({ protocol: null })}>
            <PlusIcon />
            Add guide
          </Button>
        }
      />

      {loading ? (
        <LoadingBlocks rows={4} height="h-24" label="Loading guides" />
      ) : error ? (
        <ErrorAlert>{error}</ErrorAlert>
      ) : protocols.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No guides yet. Click "Add guide" to create the first remediation guide.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {protocols.map((p) => (
            <GuideTile key={p.protocol_id} protocol={p} />
          ))}
        </div>
      )}

      <MockNote />
      {dialogs}
    </div>
  )
}

export default Protocols
