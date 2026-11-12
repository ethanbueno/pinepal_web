import { useState } from "react"
import { ArrowLeftIcon } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { registerRequest } from "../api/auth"
import { useToast } from "../components/toastcontext"
import ErrorAlert from "../components/ErrorAlert"
import AuthSplitLayout from "../components/AuthSplitLayout"
import FloatingInput from "../components/FloatingInput"
import { LOCKED_MUNICIPALITY } from "../utils/diseases"
import { Button } from "@/components/ui/button"

// A numbered heading over a group of fields
function FormSection({ number, title, children }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs text-primary-text">
          {number}
        </span>
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

// The sign-up form, in the shared Login/Register layout
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
    <AuthSplitLayout
      compact
      title="Create your account"
      tagline="Scan your pineapples, keep a history of every diagnosis, and get treatment steps for your farm."
      headerAction={
        // back to the login page, next to the theme toggle
        <Button
          variant="outline"
          size="icon"
          aria-label="Back to login"
          render={<Link to="/login" />}
          nativeButton={false}
        >
          <ArrowLeftIcon />
        </Button>
      }
    >
      <form onSubmit={handleRegister} className="space-y-5">
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

        <div className="space-y-4">
          {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}

          <Button type="submit" disabled={loading} className="h-10 w-full rounded-[10px] text-[15px] font-medium">
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
    </AuthSplitLayout>
  )
}
export default Register
