import { useEffect } from "react"
import { NavLink, matchPath, useLocation } from "react-router-dom"
import {
  BookOpenIcon,
  CameraIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  HistoryIcon,
  HouseIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MapIcon,
  ScrollTextIcon,
  SettingsIcon,
  SmartphoneIcon,
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
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import logo from "../assets/pinepal-logo.png"
import { useAppDownloadUrl } from "../hooks/useAppDownloadUrl"
import { openSettings } from "../hooks/useSettingsDialog"
import { downloadLinkProps } from "../utils/download"
import { getRoleLabel } from "../utils/roles"

// Icons match the mobile app's tabs: Home, History (clock), Scan (camera), Guide (open book)
const staffLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboardIcon, end: true },
  { to: "/map", label: "Disease Map", icon: MapIcon },
  { to: "/scans", label: "History", icon: HistoryIcon },
  { to: "/diagnose", label: "Scan", icon: CameraIcon },
  // admins manage farmers from the Farmers tab on the Users page instead
  { to: "/farmers", label: "Farmers", icon: UsersIcon, notForAdmin: true },
  { to: "/protocols", label: "Guide", icon: BookOpenIcon },
  { to: "/export", label: "Export", icon: DownloadIcon },
  { to: "/users", label: "Users", icon: UserCogIcon, adminOnly: true, alsoActiveOn: "/farmers" },
  { to: "/audit-logs", label: "Audit logs", icon: ScrollTextIcon, adminOnly: true },
]

const farmerLinks = [
  { to: "/", label: "Home", icon: HouseIcon, end: true },
  { to: "/diagnose", label: "Scan", icon: CameraIcon },
  { to: "/my-scans", label: "History", icon: HistoryIcon },
  { to: "/guides", label: "Guide", icon: BookOpenIcon },
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
  const { isMobile, setOpenMobile, state } = useSidebar()
  const appDownloadUrl = useAppDownloadUrl()

  // on phones the sidebar is a drawer over the page: close it once a link is followed,
  // so the new page does not load and re-render underneath it
  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

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
          {/* the Android app, same link as the login page (admins change it in Settings > Mobile app);
              no border, a soft amber glow on hover; collapsed it is just the icon with a tooltip */}
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Download mobile app"
              className="bg-card transition-shadow hover:bg-primary/10 hover:shadow-[0_0_16px_-2px_color-mix(in_oklab,var(--primary)_55%,transparent)] group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none"
              render={<a {...downloadLinkProps(appDownloadUrl)} />}
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
                <Avatar className="size-8 rounded-lg after:rounded-lg">
                  {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" className="rounded-lg" />}
                  <AvatarFallback className="rounded-lg">{initials(user.full_name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.full_name}</span>
                  <span className="truncate text-xs">{getRoleLabel(user.role)}</span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </DropdownMenuTrigger>
              {/* a floating panel 8px above the user card and as wide as it, the username on
                  top; only the collapsed icon sidebar, too narrow for that, opens it to the side */}
              <DropdownMenuContent
                side={!isMobile && state === "collapsed" ? "right" : "top"}
                align={!isMobile && state === "collapsed" ? "end" : "start"}
                sideOffset={8}
                className="min-w-56 rounded-xl p-1.5 shadow-lg ring-border"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate px-2.5 pt-1.5 pb-1 text-sm font-normal">
                    @{user.username}
                  </DropdownMenuLabel>
                  {/* Account opens on its own; Settings holds Appearance (and Mobile app for admins) */}
                  <DropdownMenuItem className="h-9.5 gap-2.5 rounded-lg px-2.5 [&_svg]:size-4.5" onClick={() => openSettings("account")}>
                    <UserIcon />
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem className="h-9.5 gap-2.5 rounded-lg px-2.5 [&_svg]:size-4.5" onClick={() => openSettings("appearance")}>
                    <SettingsIcon />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="my-1.5" />
                <DropdownMenuItem className="h-9.5 gap-2.5 rounded-lg px-2.5 [&_svg]:size-4.5" onClick={onLogout}>
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
