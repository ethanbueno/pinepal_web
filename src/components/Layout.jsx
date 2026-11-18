import { Outlet, useNavigate } from "react-router-dom"
import { ChevronLeftIcon, ChevronRightIcon, MenuIcon } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useToast } from "./toastcontext"
import AppSidebar from "./Sidebar"
import SettingsDialog from "./settings/SettingsDialog"
import logo from "../assets/pinepal-logo.png"
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
      className="absolute top-4 left-0 z-20 hidden h-10 w-5 md:flex items-center justify-center rounded-r-lg border border-l-0 bg-sidebar text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icon className="size-4" />
    </button>
  )
}

// Phones: a slim bar at the top with the menu button (the sidebar is a drawer there).
// Solid background, no blur: backdrop blur over the page flickers in mobile Chrome.
function MobileTopBar() {
  const { toggleSidebar } = useSidebar()
  return (
    <div className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background px-2 pt-[env(safe-area-inset-top)] md:hidden">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Open menu"
        className="flex size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted"
      >
        <MenuIcon className="size-5" />
      </button>
      <img src={logo} alt="" className="size-8" />
      <span className="font-semibold">PinePal</span>
    </div>
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
      <SettingsDialog />
      <SidebarInset>
        <SidebarTab />
        <MobileTopBar />
        {/* same padding on both sides (phones: 16px, the menu button lives in the top bar);
            on desktop the left one also clears the sidebar tab (20px) */}
        <div className="min-w-0 px-4 py-4 md:px-10 md:py-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
