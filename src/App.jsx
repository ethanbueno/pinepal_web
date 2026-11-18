import { lazy, Suspense } from "react"
import { Navigate, Routes, Route } from "react-router-dom"
import Layout from "./components/Layout"
import ProtectedRoute from "./components/ProtectedRoute"
import PinePalLoader from "./components/PinePalLoader"
import Login from "./pages/Login"

// Every other page is loaded when it is first opened, so the first visit only downloads
// the login page and the app shell (the map, charts and so on come with their pages).
const Register = lazy(() => import("./pages/Register"))
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"))
const Home = lazy(() => import("./pages/Home"))
const MyScans = lazy(() => import("./pages/MyScans"))
const Guides = lazy(() => import("./pages/Guides"))
const Diagnose = lazy(() => import("./pages/Diagnose"))
const DiseaseMap = lazy(() => import("./pages/DiseaseMap"))
const Scans = lazy(() => import("./pages/Scans"))
const ScanDetail = lazy(() => import("./pages/ScanDetail"))
const Protocols = lazy(() => import("./pages/Protocols"))
const Farmers = lazy(() => import("./pages/Farmers"))
const FarmerDetail = lazy(() => import("./pages/FarmerDetail"))
const ExportData = lazy(() => import("./pages/ExportData"))
const Users = lazy(() => import("./pages/Users"))
const AuditLogs = lazy(() => import("./pages/AuditLogs"))
const NotFound = lazy(() => import("./pages/NotFound"))
const OpenSettings = lazy(() => import("./pages/OpenSettings"))

const STAFF = ["admin", "officer"]

// shortcut: a page only admins and officers can open
function staffOnly(page) {
  return <ProtectedRoute roles={STAFF}>{page}</ProtectedRoute>
}

// shown while a page's code downloads (pages inside the app get it under the sidebar, see Layout)
function PageLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <PinePalLoader label="Loading page" />
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* every role: Home shows the dashboard for staff and the welcome page for farmers */}
          <Route path="/" element={<Home />} />
          <Route path="/scans/:uuid" element={<ScanDetail />} />
          {/* Account and Settings are a window now; old links open it over the home page */}
          <Route path="/account" element={<OpenSettings section="account" />} />
          <Route path="/profile" element={<OpenSettings section="account" />} />
          <Route path="/settings" element={<OpenSettings section="appearance" />} />

          {/* farmers only */}
          {/* My Farm is part of Home now */}
          <Route path="/my-farm" element={<Navigate to="/" replace />} />
          <Route path="/my-scans" element={<ProtectedRoute roles={["farmer"]}><MyScans /></ProtectedRoute>} />
          <Route path="/guides" element={<ProtectedRoute roles={["farmer"]}><Guides /></ProtectedRoute>} />

          {/* staff save scans for any farmer, farmers save to their own history */}
          <Route path="/diagnose" element={<ProtectedRoute roles={[...STAFF, "farmer"]}><Diagnose /></ProtectedRoute>} />

          {/* admins and officers */}
          <Route path="/map" element={staffOnly(<DiseaseMap />)} />
          <Route path="/scans" element={staffOnly(<Scans />)} />
          <Route path="/protocols" element={staffOnly(<Protocols />)} />
          <Route path="/farmers" element={staffOnly(<Farmers />)} />
          <Route path="/farmers/:id" element={staffOnly(<FarmerDetail />)} />
          <Route path="/export" element={staffOnly(<ExportData />)} />

          {/* admin only */}
          <Route path="/users" element={<ProtectedRoute roles={["admin"]}><Users /></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute roles={["admin"]}><AuditLogs /></ProtectedRoute>} />
          {/* the login history is part of the audit logs now */}
          <Route path="/login-history" element={<Navigate to="/audit-logs" replace />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
