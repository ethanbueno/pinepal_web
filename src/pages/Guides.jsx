import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ChevronRightIcon } from "lucide-react"
import { getProtocols } from "../api/protocols"
import ProtocolCard, { GuideChips, GuidePhoto } from "../components/ProtocolCard"
import BackButton from "../components/BackButton"
import ErrorAlert from "../components/ErrorAlert"
import PageHeader from "../components/PageHeader"
import LoadingBlocks from "../components/LoadingBlocks"
import { getDisease } from "../utils/diseases"

// One condition in the list, like the mobile Disease Guide: small photo, name with its
// color dot, type and severity. Clicking it opens the full guide.
function GuideTile({ protocol }) {
  const disease = getDisease(protocol.label)
  const color = disease ? disease.color : "#888888"

  return (
    <Link
      to={"?guide=" + protocol.protocol_id}
      className="flex items-center gap-4 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
    >
      <GuidePhoto
        url={protocol.image_url}
        name={protocol.display_name}
        className="size-[72px] rounded-lg"
        iconClass="size-6"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <h2 className="line-clamp-2 font-semibold">{protocol.display_name}</h2>
        </div>
        <div className="mt-2">
          <GuideChips protocol={protocol} />
        </div>
      </div>
      <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}

// read-only remediation guides for farmers: a compact list, and the full guide for
// the one picked (?guide=<id> in the URL, so the browser back button works)
function Guides() {
  const [protocols, setProtocols] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchParams] = useSearchParams()

  useEffect(() => {
    getProtocols()
      .then((data) => {
        setProtocols(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setError("Could not load the guides.")
        setLoading(false)
      })
  }, [])

  const guideId = searchParams.get("guide")
  const selected = guideId ? protocols.find((p) => String(p.protocol_id) === guideId) : null

  if (selected) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-3">
          <BackButton to="/guides">All guides</BackButton>
        </div>
        <ProtocolCard protocol={selected} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Guides"
        description="Click a condition to see its symptoms, what to do now and how to prevent it."
      />

      {loading ? (
        <LoadingBlocks rows={4} height="h-24" label="Loading guides" />
      ) : error ? (
        <ErrorAlert>{error}</ErrorAlert>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {protocols.map((p) => (
            <GuideTile key={p.protocol_id} protocol={p} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Guides
