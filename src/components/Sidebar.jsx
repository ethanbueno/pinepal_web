import { NavLink, matchPath, useLocation, useNavigate } from "react-router-dom"
import {
  BookOpenIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  FileTextIcon,
  HouseIcon,
  ImagesIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MapIcon,
  MoonIcon,
  ScanSearchIcon,
  ScrollTextIcon,
  SmartphoneIcon,
  SproutIcon,
  StethoscopeIcon,
  SunIcon,
  UserCogIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import logo from "../assets/pinepal-logo.png"
import { APP_DOWNLOAD_URL } from "../config/app"
import { getRoleLabel } from "../utils/roles"
import { useTheme } from "../hooks/useTheme"

const staffLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboardIcon, end: true },
  { to: "/map", label: "Disease Map", icon: MapIcon },
  { to: "/scans", label: "History", icon: ScanSearchIcon },
  { to: "/diagnose", label: "Scan", icon: StethoscopeIcon },
  // admins manage farmers from the Farmers tab on the Users page instead
  { to: "/farmers", label: "Farmers", icon: UsersIcon, notForAdmin: true },
  { to: "/protocols", label: "Guide", icon: FileTextIcon },
  { to: "/export", label: "Export", icon: DownloadIcon },
  { to: "/users", label: "Users", icon: UserCogIcon, adminOnly: true, alsoActiveOn: "/farmers" },
  { to: "/audit-logs", label: "Audit logs", icon: ScrollTextIcon, adminOnly: true },
]

const farmerLinks = [
  { to: "/", label: "Home", icon: HouseIcon, end: true },
  { to: "/my-farm", label: "My Farm", icon: SproutIcon },
  { to: "/diagnose", label: "Scan", icon: StethoscopeIcon },
  { to: "/my-scans", label: "My Scans", icon: ImagesIcon },
  { to: "/guides", label: "Guides", icon: BookOpenIcon },
]

const initials = (name) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

function AppSidebar({ user, onLogout }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { dark, toggleTheme } = useTheme()

  // farmers get their own short menu, officers don't see admin-only links,
  // admins don't see links that live under another page for them
  const links =
    user.role === "farmer"
      ? farmerLinks
      : staffLinks.filter((link) =>
          user.role === "admin" ? !link.notForAdmin : !link.adminOnly
        )

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3 pt-4 group-data-[collapsible=icon]:p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<NavLink to="/" />}>
              <img src={logo} alt="" className="-my-2 size-12 shrink-0 group-data-[collapsible=icon]:my-0 group-data-[collapsible=icon]:size-8" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">PinePal</span>
                <span className="truncate text-xs">Pineapple Disease Identifier</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3 py-2 group-data-[collapsible=icon]:p-2">
          <SidebarGroupLabel className="mb-1">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {links.map(({ to, label, icon: Icon, end, alsoActiveOn }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton
                    tooltip={label}
                    className="h-9 px-3 data-active:bg-primary/15 data-active:text-primary-text data-active:hover:bg-primary/20 data-active:hover:text-primary-text"
                    isActive={
                      !!matchPath({ path: to, end: !!end }, pathname) ||
                      (!!alsoActiveOn && !!matchPath({ path: alsoActiveOn, end: false }, pathname))
                    }
                    render={<NavLink to={to} end={end} />}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 pb-4 group-data-[collapsible=icon]:p-2">
        <SidebarMenu className="gap-2">
          {/* the Android app, same link as the login page; collapsed it is just the icon with a tooltip */}
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Download mobile app"
              className="border bg-card shadow-xs hover:bg-primary/10 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none"
              render={<a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" />}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-text">
                <SmartphoneIcon className="size-4" />
              </span>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Download mobile app</span>
                <span className="truncate text-xs text-muted-foreground">Android APK</span>
              </div>
              <DownloadIcon className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{initials(user.full_name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.full_name}</span>
                  <span className="truncate text-xs">{getRoleLabel(user.role)}</span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="min-w-56">
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <UserIcon />
                  My profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme}>
                  {dark ? <SunIcon /> : <MoonIcon />}
                  {dark ? "Light mode" : "Dark mode"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
                  <LogOutIcon />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

    </Sidebar>
  )
}

export default AppSidebar
