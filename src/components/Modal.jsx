import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// A popup with a title. The form goes inside as children.
function Modal({ open, title, onClose, children }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[calc(100%-2rem)] overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export default Modal
