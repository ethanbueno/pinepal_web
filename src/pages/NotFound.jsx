import { Link } from "react-router-dom"
import { MapPinOffIcon } from "lucide-react"
import EmptyState from "../components/EmptyState"
import { buttonVariants } from "@/components/ui/button"

function NotFound() {
  return (
    <EmptyState icon={MapPinOffIcon} title="Page not found" text="That page does not exist.">
      <Link to="/" className={buttonVariants({ variant: "outline" })}>
        Go to the home page
      </Link>
    </EmptyState>
  )
}

export default NotFound
