import { useAuth } from "../context/AuthContext"
import Dashboard from "./Dashboard"
import FarmerWelcome from "./FarmerWelcome"

// "/" shows a different home page for each role
function Home() {
  const { user } = useAuth()

  if (user.role === "farmer") {
    return <FarmerWelcome />
  }
  return <Dashboard />
}

export default Home
