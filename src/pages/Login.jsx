import { useState } from "react"
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import logo from "../assets/pinepal-logo.png"
import ThemeToggle from "../components/ThemeToggle"
import ErrorAlert from "../components/ErrorAlert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <ThemeToggle className="fixed top-4 right-4" />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center justify-center gap-2.5">
          <img src={logo} alt="" className="size-40" />
          <span className="text-4xl font-semibold tracking-wide uppercase">PinePal</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Login to your account</CardTitle>
            <CardDescription>Enter your username or email below to sign in</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="username">Username or email</FieldLabel>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter username or email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </Field>
                {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
                <Field>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="underline underline-offset-4">
              Create one
            </Link>
        </p>
      </div>
    </div>
  )
}
export default Login
