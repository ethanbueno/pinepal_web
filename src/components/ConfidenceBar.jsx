import { LOW_CONFIDENCE } from "../utils/diseases"

// How sure the model is, as a thin bar. Amber normally, red under the low confidence line.
// Same look as the confidence bar in the mobile app.
function ConfidenceBar({ value }) {
  const low = value < LOW_CONFIDENCE

  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={"h-full rounded-full " + (low ? "bg-destructive" : "bg-primary")}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      {low && (
        <p className="mt-1.5 text-xs font-medium text-destructive">
          Low confidence result. Check the photo and verify the diagnosis.
        </p>
      )}
    </div>
  )
}

export default ConfidenceBar
