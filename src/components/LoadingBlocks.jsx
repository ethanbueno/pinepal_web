import PinePalLoader from "./PinePalLoader"

// Shown while a page or panel loads: the PinePal loader in the middle of the space
// the content will fill, so the page isn't a blank white area.
// rows and height are kept so older calls still work; together they set how tall the area is.
const ROW_PX = { "h-10": 40, "h-14": 56, "h-24": 96, "h-32": 128, "h-40": 160, "h-48": 192 }

function LoadingBlocks({ rows = 3, height = "h-14", label = "Loading" }) {
  const areaPx = Math.max(240, rows * ((ROW_PX[height] ?? 56) + 12))

  return (
    <div
      aria-busy="true"
      className="flex w-full flex-col items-center justify-center gap-3"
      style={{ minHeight: `min(${areaPx}px, 60vh)` }}
    >
      <PinePalLoader size={96} label={label} />
      <p className="text-sm text-muted-foreground">{label}...</p>
    </div>
  )
}

export default LoadingBlocks
