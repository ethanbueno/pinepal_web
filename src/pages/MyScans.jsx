import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { getMyFarmer } from "../api/farmers"
import { getScans } from "../api/scans"
import FilterBar from "../components/FilterBar"
import ScansTable from "../components/ScansTable"
import Pagination from "../components/Pagination"
import ErrorAlert from "../components/ErrorAlert"
import { emptyFilters } from "../utils/filters"
import { Card, CardContent } from "@/components/ui/card"

const PER_PAGE = 20

// the farmer's own scan history
function MyScans() {
  const { user } = useAuth()
  const [farmer, setFarmer] = useState(null)
  const [filters, setFilters] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // find which farm this account belongs to
  useEffect(() => {
    getMyFarmer(user)
      .then((me) => {
        setFarmer(me)
        if (!me) setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setError("Could not load your account.")
        setLoading(false)
      })
  }, [user])

  // then load only that farm's scans
  useEffect(() => {
    if (!farmer) return
    let ignore = false

    getScans({ ...filters, farmer_id: farmer.farmer_id, page, per_page: PER_PAGE })
      .then((result) => {
        if (ignore) return
        setData(result)
        setError("")
        setLoading(false)
      })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setError("Could not load your scans.")
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [farmer, filters, page])

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
    setPage(1)
  }

  return (
    <div>
      <h1 className="text-2xl font-medium mb-4">My Scans</h1>

      <FilterBar filters={filters} onChange={handleFilterChange} showMunicipality={false} />

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {loading ? (
        <p className="text-muted-foreground">Loading your scans...</p>
      ) : !farmer ? (
        <Card>
          <CardContent className="py-2 text-center text-muted-foreground">
            Your account is not linked to a farm yet. Please ask an agricultural officer.
          </CardContent>
        </Card>
      ) : (
        <>
          <ScansTable scans={data.items} showFarmer={false} />
          <Pagination page={page} perPage={PER_PAGE} total={data.total} onChange={setPage} />
        </>
      )}
    </div>
  )
}

export default MyScans
