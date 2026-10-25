import { Outlet, useNavigate } from "react-router-dom"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useToast } from "./toastcontext"
import AppSidebar from "./Sidebar"
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar"

// A small tab stuck to the sidebar's edge (like a folder lip) that opens and closes it
function SidebarTab() {
  const { open, openMobile, isMobile, toggleSidebar } = useSidebar()
  const isOpen = isMobile ? openMobile : open
  const Icon = isOpen ? ChevronLeftIcon : ChevronRightIcon

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      className="absolute top-4 left-0 z-20 flex h-10 w-5 items-center justify-center rounded-r-lg border border-l-0 bg-sidebar text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icon className="size-4" />
    </button>
  )
}

function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const notify = useToast()

  const handleLogout = () => {
    logout()
    notify("You have been signed out.", "info")
    navigate("/login")
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} onLogout={handleLogout} />
      <SidebarInset>
        <SidebarTab />
        <div className="min-w-0 p-4 pl-8 md:p-6 md:pl-10">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
