import { Skeleton } from "@/components/ui/skeleton"

// Grey placeholder blocks while a page loads.
// rows = how many blocks, height = Tailwind height class of each block.
function LoadingBlocks({ rows = 3, height = "h-14", label = "Loading" }) {
  const blocks = Array.from({ length: rows }, (_, i) => i)

  return (
    <div className="flex flex-col gap-3" aria-label={label} aria-busy="true">
      {blocks.map((i) => (
        <Skeleton key={i} className={height + " rounded-xl"} />
      ))}
    </div>
  )
}

export default LoadingBlocks
