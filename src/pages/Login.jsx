import { useState } from "react"
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import logo from "../assets/pinepal-logo.png"
import ThemeToggle from "../components/ThemeToggle"
import ErrorAlert from "../components/ErrorAlert"
import AppShowcase from "../components/AppShowcase"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Input with its label sitting inside the box, moving up once the box has focus or text.
// placeholder=" " is what lets peer-placeholder-shown tell an empty box apart.
function FloatingInput({ id, label, className, ...props }) {
  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        placeholder=" "
        className="peer h-14 w-full rounded-xl border border-input bg-card px-4 pt-5 pb-1.5 text-base outline-none transition-[border-color,box-shadow] focus:border-ring focus:ring-3 focus:ring-ring/25"
        {...props}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-2 left-4 text-xs text-muted-foreground transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs"
      >
        {label}
      </label>
    </div>
  )
}

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
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <ThemeToggle className="fixed top-4 right-4 z-10" />

      {/* Left: brand and what the app does. On small screens only the logo and headline stay. */}
      <section className="relative flex flex-col overflow-hidden px-6 pt-8 pb-2 sm:px-10 lg:border-r lg:px-14 lg:py-12">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="" className="size-11 lg:size-14" />
          <span className="text-xl font-semibold tracking-wide uppercase lg:text-2xl">PinePal</span>
        </div>

        {/* Laptops: showcase above the headline, scaled down to fit the half-width column.
            Wide screens (2xl): headline bottom-left with the showcase beside it. */}
        <div className="mt-8 flex flex-1 flex-col gap-6 lg:mt-4 2xl:flex-row 2xl:items-center 2xl:gap-6">
          <div className="hidden h-[400px] justify-center lg:flex 2xl:order-last 2xl:h-auto 2xl:flex-1">
            <div className="origin-top scale-[0.83] 2xl:scale-100">
              <AppShowcase />
            </div>
          </div>
          <h1 className="max-w-md text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:max-w-xl 2xl:max-w-[16rem] 2xl:self-end 2xl:pb-10 2xl:text-6xl">
            Spot pineapple disease{" "}
            <span className="text-[#8a5f00] dark:text-primary">before it spreads</span>.
          </h1>
        </div>

        <p className="mt-4 hidden max-w-md text-sm text-muted-foreground lg:block">
          Scan a fruit, get the diagnosis and treatment steps, and see where outbreaks are happening across Isabela.
        </p>
      </section>

      {/* Right: the form */}
      <section className="flex items-start justify-start px-6 pt-6 pb-12 sm:px-10 lg:items-center lg:justify-center lg:py-12">
        <div className="w-full max-w-md">
          <h2 className="mb-6 text-xl font-semibold">Log into PinePal</h2>
          <form onSubmit={handleLogin} className="space-y-3">
            <FloatingInput
              id="username"
              label="Username or email"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <FloatingInput
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
