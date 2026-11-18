import { useState } from "react"
import { ArrowLeftIcon } from "lucide-react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { requestResetCode, resetPassword } from "../api/auth"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import ErrorAlert from "../components/ErrorAlert"
import AuthSplitLayout from "../components/AuthSplitLayout"
import FloatingInput from "../components/FloatingInput"
import PasswordChecklist from "../components/PasswordChecklist"
import { passwordProblem } from "../utils/passwordRules"
import { Button } from "@/components/ui/button"

const RESEND_SECONDS = 60 // the server sends at most one code a minute (password_reset.py)

// Forgot password in two steps: the email of the account, then a new password.
// Direct mode (the server's default for now): a registered email goes straight to the new
// password. Code mode (PASSWORD_RESET_EMAIL_CODE=1 on the server): the second step also asks
// for the 6-digit code emailed to that address.
function ForgotPassword() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const notify = useToast()
  const [step, setStep] = useState("email") // "email", then "password"
  const [mode, setMode] = useState("direct") // "direct" or "code", from the server
  const [resetToken, setResetToken] = useState("")
  const [account, setAccount] = useState("")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [sentAt, setSentAt] = useState(0)

  if (user) return <Navigate to="/" replace />

  const sendCode = async (e) => {
    e?.preventDefault()
    setErrorMessage("")
    setLoading(true)
    try {
      const result = await requestResetCode(email.trim())
      setMode(result.mode || "code")
      if (result.mode === "direct") {
        setResetToken(result.reset_token)
        setAccount(result.username)
      } else {
        setMessage(result.message)
        setSentAt(Date.now())
      }
      setStep("password")
    } catch (error) {
      console.error(error)
      setErrorMessage(error.response?.data?.error || "Could not send the code. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const resend = () => {
    const wait = Math.ceil((sentAt + RESEND_SECONDS * 1000 - Date.now()) / 1000)
    if (wait > 0) {
      setErrorMessage(`Wait ${wait} more seconds before asking for another code.`)
      return
    }
    setCode("")
    sendCode()
  }

  const submitNewPassword = async (e) => {
    e.preventDefault()
    setErrorMessage("")
    const problem = passwordProblem(password)
    if (problem) return setErrorMessage(problem)
    if (password !== confirm) return setErrorMessage("The two passwords don't match.")
    setLoading(true)
    try {
      await resetPassword(
        mode === "direct"
          ? { resetToken, newPassword: password }
          : { email: email.trim(), code: code.trim(), newPassword: password }
      )
      notify("Password changed. Sign in with your new password.")
      navigate("/login")
    } catch (error) {
      console.error(error)
      setErrorMessage(error.response?.data?.error || "Could not change the password. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthSplitLayout
      showDownload={false}
      title="Forgot your password?"
      tagline="Enter the email address on your PinePal account, then choose a new password."
      headerAction={
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
      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-4">
          <p className="text-sm text-muted-foreground">Enter the email address of the account you want to recover.</p>
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
          {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
          <Button type="submit" disabled={loading} className="h-10 w-full rounded-[10px] text-[15px] font-medium">
            {loading ? "Checking..." : "Continue"}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitNewPassword} className="space-y-4">
          {mode === "direct" ? (
            <p className="text-sm text-muted-foreground">
              Set a new password for <span className="font-medium text-foreground">@{account}</span> ({email}).
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {message} Check <span className="font-medium text-foreground">{email}</span>, including the spam
                folder.
              </p>
              <FloatingInput
                size="compact"
                id="code"
                label="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </>
          )}
          <FloatingInput
            size="compact"
            id="new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <FloatingInput
            size="compact"
            id="confirm-password"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <PasswordChecklist password={password} confirm={confirm} className="px-1" />
          {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
          <Button
            type="submit"
            disabled={loading || (mode === "code" && code.length !== 6)}
            className="h-10 w-full rounded-[10px] text-[15px] font-medium"
          >
            {loading ? "Saving..." : "Change password"}
          </Button>
          <div className="flex justify-between text-sm">
            <button
              type="button"
              className="text-muted-foreground underline underline-offset-4"
              onClick={() => {
                setStep("email")
                setErrorMessage("")
              }}
            >
              Use another email
            </button>
            {mode === "code" && (
              <button
                type="button"
                disabled={loading}
                className="font-medium text-primary-text underline underline-offset-4"
                onClick={resend}
              >
                Send a new code
              </button>
            )}
          </div>
        </form>
      )}
    </AuthSplitLayout>
  )
}

export default ForgotPassword
