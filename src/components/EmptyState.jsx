import { Card, CardContent } from "@/components/ui/card"

// A card with an icon, a short title and a hint, for lists with nothing in them.
// `icon` is a lucide icon component, for example icon={SearchXIcon}.
function EmptyState({ icon: Icon, title, text, children }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        {Icon && <Icon className="size-8 text-muted-foreground" />}
        <p className="font-medium">{title}</p>
        {text && <p className="max-w-md text-sm text-muted-foreground">{text}</p>}
        {children && <div className="mt-2">{children}</div>}
      </CardContent>
    </Card>
  )
}

export default EmptyState
