import { useEffect, useState } from "react"
import { getProtocols } from "../api/protocols"
import ProtocolCard from "../components/ProtocolCard"
import ErrorAlert from "../components/ErrorAlert"
import PageHeader from "../components/PageHeader"
import LoadingBlocks from "../components/LoadingBlocks"

// read-only remediation guides for farmers
function Guides() {
  const [protocols, setProtocols] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

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

  return (
    <div>
      <PageHeader title="Guides" description="What to look for and what to do for each pineapple condition." />

      {loading ? (
        <LoadingBlocks rows={4} height="h-48" label="Loading guides" />
      ) : error ? (
        <ErrorAlert>{error}</ErrorAlert>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {protocols.map((p) => (
            <ProtocolCard key={p.protocol_id} protocol={p} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Guides
