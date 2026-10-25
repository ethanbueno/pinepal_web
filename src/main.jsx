import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "leaflet/dist/leaflet.css"
import "./index.css"
import App from "./App.jsx"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "./context/AuthContext.jsx"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
      <Toaster position="bottom-right" />
    </BrowserRouter>
  </StrictMode>,
)
