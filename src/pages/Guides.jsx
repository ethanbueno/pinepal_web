import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { getProtocols } from "../api/protocols"
import ProtocolCard from "../components/ProtocolCard"
import GuideTile from "../components/GuideTile"
import BackButton from "../components/BackButton"
import ErrorAlert from "../components/ErrorAlert"
import PageHeader from "../components/PageHeader"
import LoadingBlocks from "../components/LoadingBlocks"

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
      <div className="w-full">
        <div className="mb-3">
          <BackButton to="/guides">All guides</BackButton>
        </div>
        <ProtocolCard protocol={selected} wide />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Guide"
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
