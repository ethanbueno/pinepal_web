import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { registerRequest } from "../api/auth"
import { useToast } from "../components/toastcontext"
import ThemeToggle from "../components/ThemeToggle"
import ErrorAlert from "../components/ErrorAlert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <ThemeToggle className="fixed top-4 right-4" />
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>Farmer account. Officers and admins are added by an admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="full-name">Full name</FieldLabel>
                  <Input
                    id="full-name"
                    placeholder="Enter full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="username">Username</FieldLabel>
                  <Input
                    id="username"
                    placeholder="Enter username"
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
                <Field>
                  <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirm password"
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    required
                  />
                </Field>
                {errorMessage && <ErrorAlert>{errorMessage}</ErrorAlert>}
                <Field>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Creating account..." : "Create account"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="underline underline-offset-4">
              Sign in
            </Link>
        </p>
      </div>
    </div>
  )
}
export default Register
