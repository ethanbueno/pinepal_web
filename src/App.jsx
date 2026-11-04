import { Routes, Route } from "react-router-dom"
import Layout from "./components/Layout"
import ProtectedRoute from "./components/ProtectedRoute"
import Login from "./pages/Login"
import Register from "./pages/Register"
import FarmerHome from "./pages/FarmerHome"
import Home from "./pages/Home"
import MyScans from "./pages/MyScans"
import Guides from "./pages/Guides"
import Diagnose from "./pages/Diagnose"
import DiseaseMap from "./pages/DiseaseMap"
import Scans from "./pages/Scans"
import ScanDetail from "./pages/ScanDetail"
import Protocols from "./pages/Protocols"
import Farmers from "./pages/Farmers"
import FarmerDetail from "./pages/FarmerDetail"
import ExportData from "./pages/ExportData"
import Users from "./pages/Users"
import NotFound from "./pages/NotFound"

const STAFF = ["admin", "officer"]

// shortcut: a page only admins and officers can open
function staffOnly(page) {
  return <ProtectedRoute roles={STAFF}>{page}</ProtectedRoute>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

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

        {/* farmers only */}
        <Route path="/my-farm" element={<ProtectedRoute roles={["farmer"]}><FarmerHome /></ProtectedRoute>} />
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

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
