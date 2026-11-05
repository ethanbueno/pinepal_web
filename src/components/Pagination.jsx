import { Button } from "@/components/ui/button"

function Pagination({ page, perPage, total, onChange }) {
  const lastPage = Math.max(1, Math.ceil(total / perPage))

  return (
    <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground tabular-nums">
        Page {page} of {lastPage} · {total} {total === 1 ? "result" : "results"}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  )
}

export default Pagination
