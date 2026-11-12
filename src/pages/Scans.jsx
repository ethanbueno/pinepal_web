import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { getScans } from "../api/scans"
import FilterBar from "../components/FilterBar"
import { emptyFilters } from "../utils/filters"
import ScansTable from "../components/ScansTable"
import Pagination from "../components/Pagination"
import ErrorAlert from "../components/ErrorAlert"
import PageHeader from "../components/PageHeader"
import LoadingBlocks from "../components/LoadingBlocks"

const PER_PAGE = 20

function Scans() {
  // other pages can open this one with filters already set (the Dashboard's "Needs Review" card)
  const location = useLocation()
  const [filters, setFilters] = useState(() => ({ ...emptyFilters, ...(location.state?.filters || {}) }))
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
      <PageHeader
        title="Scans"
        description="Every scan synced from the mobile app or saved on the website. Click a row to open it."
      />

      <FilterBar filters={filters} onChange={handleFilterChange} extra />

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {loading ? (
        <LoadingBlocks rows={6} height="h-10" label="Loading scans" />
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
