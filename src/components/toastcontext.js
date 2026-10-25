import { toast } from "sonner"

// Same call as before: notify("message") or notify("message", "error" | "info")
export function useToast() {
  return (message, type = "success") => {
    if (type === "error") toast.error(message)
    else if (type === "info") toast.info(message)
    else toast.success(message)
  }
}
