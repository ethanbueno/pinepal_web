import { Button } from "@/components/ui/button"

function Pagination({ page, perPage, total, onChange }) {
  const lastPage = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <span className="text-muted-foreground">
        Page {page} of {lastPage} · {total} results
      </span>
      <div className="flex gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  )
}

export default Pagination
