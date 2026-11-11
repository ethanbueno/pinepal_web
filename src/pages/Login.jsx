import { useState } from "react"
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import logo from "../assets/pinepal-logo.png"
import ThemeToggle from "../components/ThemeToggle"
import ErrorAlert from "../components/ErrorAlert"
import AuthBrandPanel from "../components/AuthBrandPanel"
import FloatingInput from "../components/FloatingInput"
import { Button } from "@/components/ui/button"

function Login() {
  const location = useLocation()
  const registeredUsername = location.state?.registeredUsername
  const [username, setUsername] = useState(registeredUsername || "")
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const notify = useToast()
  // already logged in
  if (user) {
    return <Navigate to="/" replace />
  }
  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorMessage("")
    setLoading(true)
    try {
      const loggedIn = await login(username, password)
      notify(`Signed in as @${loggedIn.username}`)
      navigate("/")
    } catch (error) {
      console.error(error)
      if (error.response?.status === 401) {
        setErrorMessage("Invalid username or password")
      } else {
        setErrorMessage(error.response?.data?.error || "Login failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }
  return (
    // laptops: the brand side takes 5/8 of the width, the login form 3/8
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[5fr_3fr]">
      <ThemeToggle className="fixed top-4 right-4 z-10" />

      {/* Left: brand and what the app does */}
      <AuthBrandPanel side="left" />

      {/* Right: the form */}
      <section className="flex items-start justify-start px-6 pt-6 pb-12 sm:px-10 lg:items-center lg:justify-center lg:py-12">
        <div className="w-full max-w-md">
          <h2 className="mb-6 text-xl font-semibold">Log into PinePal</h2>
          <form onSubmit={handleLogin} className="space-y-3">
            <FloatingInput
              size="compact"
              id="username"
              label="Username or email"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <FloatingInput
              size="compact"
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
            <Button type="submit" disabled={loading} className="mt-2 h-12 w-full rounded-full text-base">
              {loading ? "Signing in..." : "Log in"}
            </Button>
          </form>

          <div className="my-8 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> New to PinePal? <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="outline"
            className="h-12 w-full rounded-full text-base"
            render={<Link to="/register" />}
            nativeButton={false}
          >
            Create new account
          </Button>

          <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <img src={logo} alt="" className="size-4" /> Pineapple disease monitoring for Isabela
          </p>
        </div>
      </section>
    </div>
  )
}
export default Login
