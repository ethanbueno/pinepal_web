import logo from "../assets/pinepal-logo-yellow.png"

// PinePal loading indicator: an amber ring spinning around the logo.
// size = width and height in px (96 for a page, 64-72 inside a panel).
// onDark = lighter track, for use on top of a photo or a dark overlay.
function PinePalLoader({ size = 96, label = "Loading", onDark = false, className = "" }) {
  return (
    <div
      role="status"
      aria-label={label}
      className={"relative inline-flex shrink-0 items-center justify-center " + className}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full animate-spin" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="5"
          style={{ stroke: onDark ? "rgb(255 255 255 / 0.25)" : "var(--border)" }}
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className="pinepal-loader-arc"
          style={{ stroke: "var(--primary)" }}
        />
      </svg>
      <img src={logo} alt="" draggable="false" className="pinepal-loader-bob h-[58%] w-auto select-none" />
    </div>
  )
}

export default PinePalLoader
