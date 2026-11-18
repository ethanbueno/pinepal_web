import { Link } from "react-router-dom"
import { MapPinOffIcon } from "lucide-react"
import EmptyState from "../components/EmptyState"
import { buttonVariants } from "@/components/ui/button"

function NotFound() {
  return (
    <EmptyState icon={MapPinOffIcon} title="Page Not Found" text="That page does not exist.">
      <Link to="/" className={buttonVariants({ variant: "outline" })}>
        Go to the Home Page
      </Link>
    </EmptyState>
  )
}

export default NotFound
