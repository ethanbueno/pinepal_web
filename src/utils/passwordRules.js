// Password rules for new passwords, the same as password_problem() in backend/security.py
// and lib/utils/password_rules.dart in the mobile app. They only apply when a password is
// set (sign up, add user or farmer, reset, change), so older passwords still sign in.

export const MIN_PASSWORD = 8
const MAX_PASSWORD_BYTES = 72 // bcrypt can't hash more than 72 bytes

// Each rule is one line of the checklist under the password box
export const PASSWORD_RULES = [
  { key: "length", label: `${MIN_PASSWORD} or more characters`, test: (pw) => pw.length >= MIN_PASSWORD },
  { key: "upper", label: "1 uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { key: "symbol", label: "1 special symbol, like ! @ # or $", test: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
]

// The first rule a password breaks, as a message for the error box, or "" if it's fine
export function passwordProblem(pw) {
  if (pw.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`
  if (new TextEncoder().encode(pw).length > MAX_PASSWORD_BYTES) return "Password is too long (72 characters at most)."
  if (!/[A-Z]/.test(pw)) return "Password needs at least 1 uppercase letter."
  if (!/[^A-Za-z0-9\s]/.test(pw)) return "Password needs at least 1 special symbol, like ! @ # or $."
  return ""
}
