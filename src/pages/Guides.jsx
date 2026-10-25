import { useEffect, useState } from "react"
import { getProtocols } from "../api/protocols"
import ProtocolCard from "../components/ProtocolCard"
import ErrorAlert from "../components/ErrorAlert"

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

  if (loading) return <p className="text-muted-foreground">Loading guides...</p>
  if (error) return <ErrorAlert>{error}</ErrorAlert>

  return (
    <div>
      <h1 className="text-2xl font-medium mb-1">Guides</h1>
      <p className="text-muted-foreground mb-4">What to look for and what to do for each pineapple condition.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        {protocols.map((p) => (
          <ProtocolCard key={p.protocol_id} protocol={p} />
        ))}
      </div>
    </div>
  )
}

export default Guides
