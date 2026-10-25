import { Link } from "react-router-dom"
import { ArrowLeftIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

// A "back" button for detail pages: an outline button with an arrow.
function BackButton({ to, children }) {
  return (
    <Link to={to} className={buttonVariants({ variant: "outline", size: "sm" })}>
      <ArrowLeftIcon />
      {children}
    </Link>
  )
}

export default BackButton
