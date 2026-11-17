import { useState } from "react"
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import ErrorAlert from "../components/ErrorAlert"
import AuthSplitLayout from "../components/AuthSplitLayout"
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
    <AuthSplitLayout
      title="Log into PinePal"
      tagline="Scan a pineapple, get the diagnosis and treatment steps, and see where outbreaks are happening across Echague, Isabela."
    >
      <form onSubmit={handleLogin} className="space-y-4">
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
        <div className="-mt-1 text-right">
          <Link to="/forgot-password" className="text-sm text-primary-text underline underline-offset-4">
            Forgot password?
          </Link>
        </div>
        {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
        <Button type="submit" disabled={loading} className="h-10 w-full rounded-[10px] text-[15px] font-medium">
          {loading ? "Signing in..." : "Log in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to PinePal?{" "}
        <Link to="/register" className="font-medium text-primary-text underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </AuthSplitLayout>
  )
}
export default Login
