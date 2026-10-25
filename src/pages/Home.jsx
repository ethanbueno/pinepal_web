import { useAuth } from "../context/AuthContext"
import Dashboard from "./Dashboard"
import FarmerHome from "./FarmerHome"

// "/" shows a different home page for each role
function Home() {
  const { user } = useAuth()

  if (user.role === "farmer") {
    return <FarmerHome />
  }
  return <Dashboard />
}

export default Home
