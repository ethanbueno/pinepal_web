import { AlertCircleIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

function ErrorAlert({ children, className = "mb-4" }) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircleIcon />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

export default ErrorAlert
