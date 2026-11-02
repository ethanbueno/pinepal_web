import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ChevronLeftIcon } from "lucide-react"
import { registerRequest } from "../api/auth"
import { useToast } from "../components/toastcontext"
import logo from "../assets/pinepal-logo.png"
import ThemeToggle from "../components/ThemeToggle"
import ErrorAlert from "../components/ErrorAlert"
import { Button } from "@/components/ui/button"

const inputClass =
  "h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/25"

const labelClass = "mb-2 block text-sm font-medium"

function Register() {
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const notify = useToast()
  const handleRegister = async (e) => {
    e.preventDefault()
    setErrorMessage("")
    if (password !== passwordConfirmation) {
      setErrorMessage("Passwords do not match.")
      return
    }
    setLoading(true)
    try {
      // sign up only makes farmer accounts; officers and admins are added by an admin
      await registerRequest({ full_name: fullName, username, password, role: "farmer" })
      notify(`Account created for @${username}. Sign in to continue.`)
      navigate("/login", { state: { registeredUsername: username } })
    } catch (error) {
      console.error(error)
      setErrorMessage(error.response?.data?.error || "Registration failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 px-5 py-8 sm:px-6 sm:py-12">
      <ThemeToggle className="fixed top-4 right-4 z-10" />
      <div className="mx-auto w-full max-w-lg">
        <Link
          to="/login"
          aria-label="Back to log in"
          className="-ml-2 inline-flex size-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <ChevronLeftIcon className="size-5" />
        </Link>

        <div className="mt-3 flex items-center gap-1.5">
          <img src={logo} alt="" className="size-5" />
          <span className="text-sm font-semibold tracking-wide uppercase">PinePal</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[1.7rem]">
          Get started with a PinePal account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan your pineapples, keep a history of every diagnosis, and get treatment steps for your farm.
        </p>

        <form onSubmit={handleRegister} className="mt-6 space-y-5">
          <div>
            <label htmlFor="full-name" className={labelClass}>Full name</label>
            <input
              id="full-name"
              placeholder="Enter full name"
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="username" className={labelClass}>Username</label>
            <input
              id="username"
              placeholder="Enter username"
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className={labelClass}>Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              placeholder="Confirm password"
              className={inputClass}
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p>
              This creates a <span className="font-medium text-foreground">farmer account</span>. Agricultural officers
              and admins are added by an admin.
            </p>
            <p>Agricultural officers can see your scans and where they were taken, so they can track outbreaks.</p>
          </div>

          {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}

          <div className="space-y-3 pt-1">
            <Button type="submit" disabled={loading} className="h-12 w-full rounded-full text-base">
              {loading ? "Creating account..." : "Create account"}
            </Button>
            <Button
              variant="secondary"
              className="h-12 w-full rounded-full text-base"
              render={<Link to="/login" />}
              nativeButton={false}
            >
              I already have an account
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default Register
