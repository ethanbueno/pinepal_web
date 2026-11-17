import { Link } from "react-router-dom"
import { ChevronRightIcon } from "lucide-react"
import { GuideChips, GuidePhoto } from "./ProtocolCard"
import { getDisease } from "../utils/diseases"

// One condition in a guide list, like the mobile Disease Guide: small photo, name with its
// color dot, type and severity. Clicking it opens the full guide (?guide=<id> on the same page).
// Used by the farmer Guides page and the staff Guide page.
function GuideTile({ protocol }) {
  const disease = getDisease(protocol.label)
  const color = disease ? disease.color : "#888888"

  return (
    <Link
      to={"?guide=" + protocol.protocol_id}
      className="flex items-center gap-4 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
    >
      <GuidePhoto
        url={protocol.image_url}
        name={protocol.display_name}
        className="size-[72px] rounded-lg"
        iconClass="size-6"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <h2 className="line-clamp-2 font-semibold">{protocol.display_name}</h2>
        </div>
        <div className="mt-2">
          <GuideChips protocol={protocol} />
        </div>
      </div>
      <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}

export default GuideTile
