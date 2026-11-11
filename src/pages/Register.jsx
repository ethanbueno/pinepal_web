import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { registerRequest } from "../api/auth"
import { useToast } from "../components/toastcontext"
import logo from "../assets/pinepal-logo.png"
import ThemeToggle from "../components/ThemeToggle"
import ErrorAlert from "../components/ErrorAlert"
import FloatingInput from "../components/FloatingInput"
import { LOCKED_MUNICIPALITY } from "../utils/diseases"
import { Button } from "@/components/ui/button"

// A numbered heading over a group of fields
function FormSection({ number, title, children }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs text-primary-text">
          {number}
        </span>
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

// The sign-up form on its own, centered on the page
function Register() {
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
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
      await registerRequest({ full_name: fullName, username, email, password, role: "farmer" })
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
    <div className="min-h-screen">
      <ThemeToggle className="fixed top-4 right-4 z-10" />

      {/* just the form, in the middle of the page */}
      <section className="flex min-h-screen items-start justify-center px-6 pt-16 pb-12 sm:px-10 sm:items-center sm:py-12">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-semibold tracking-tight">Create your account</h2>
          <p className="mt-1 mb-8 text-sm text-muted-foreground">
            Scan your pineapples, keep a history of every diagnosis, and get treatment steps for your farm.
          </p>

          <form onSubmit={handleRegister} className="space-y-8">
            <FormSection number={1} title="Your details">
              <FloatingInput
                size="compact"
                id="full-name"
                label="Full name"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              {/* locked to Echague for now, so it is not shown. The backend sets it on every new account. */}
              <input type="hidden" name="municipality" value={LOCKED_MUNICIPALITY} />
            </FormSection>

            <FormSection number={2} title="Account">
              <FloatingInput
                size="compact"
                id="username"
                label="Username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <FloatingInput
                size="compact"
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <FloatingInput
                size="compact"
                id="password"
                label="Password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <FloatingInput
                size="compact"
                id="confirm-password"
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                required
              />
            </FormSection>

            <div className="space-y-3">
              <div className="rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                This creates a <span className="font-medium text-foreground">farmer account</span>. Agricultural
                officers and admins are added by an admin. Officers can see your scans and where they were taken, so
                they can track outbreaks.
              </div>

              {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}

              <Button type="submit" disabled={loading} className="h-12 w-full rounded-full text-base">
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary-text underline underline-offset-4">
              Log in
            </Link>
          </p>

          {/* back to the welcome page */}
          <Link
            to="/welcome"
            className="mx-auto mt-8 flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <img src={logo} alt="" className="size-4" /> Pineapple disease monitoring for Isabela
          </Link>
        </div>
      </section>
    </div>
  )
}
export default Register
