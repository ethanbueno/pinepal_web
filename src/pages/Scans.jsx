import { useEffect, useState } from "react"
import { getScans } from "../api/scans"
import FilterBar from "../components/FilterBar"
import { emptyFilters } from "../utils/filters"
import ScansTable from "../components/ScansTable"
import Pagination from "../components/Pagination"
import ErrorAlert from "../components/ErrorAlert"

const PER_PAGE = 20

function Scans() {
  const [filters, setFilters] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let ignore = false

    getScans({ ...filters, page, per_page: PER_PAGE })
      .then((result) => {
        if (ignore) return
        setData(result)
        setError("")
        setLoading(false)
      })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setError("Could not load scans.")
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [filters, page])

  // a new filter always starts again from page 1
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
    setPage(1)
  }

  return (
    <div>
      <h1 className="text-2xl font-medium mb-4">Scans</h1>

      <FilterBar filters={filters} onChange={handleFilterChange} extra />

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {loading ? (
        <p className="text-muted-foreground">Loading scans...</p>
      ) : (
        <>
          <ScansTable scans={data.items} />
          <Pagination page={page} perPage={PER_PAGE} total={data.total} onChange={setPage} />
        </>
      )}
    </div>
  )
}

export default Scans
