import { useRef, useState, type FormEvent } from "react"
import { login, register, resendBetaVerification } from "../api/client"
import { FieldValidationError } from "../api/request"
import { saveToken, type AuthUser } from "../auth"
import { registrationErrors } from "../auth-validation"
import PasswordField from "./ui/PasswordField"
import BrandLogo from "./ui/BrandLogo"

type Props = { onAuthenticated: (user: AuthUser) => void; sessionExpired?: boolean }
export default function AuthView({ onAuthenticated, sessionExpired }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [fields, setFields] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [registrationMessage, setRegistrationMessage] = useState("")
  const [resending, setResending] = useState(false)
  const pending = useRef(false)
  const form = useRef<HTMLFormElement>(null)

  function showFields(next: Record<string, string>) {
    setFields(next)
    const first = ["display_name", "email", "password"].find(key => next[key])
    if (first) requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus())
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const invalid = mode === "register" ? registrationErrors(email, displayName, password) : {
      ...(!email.trim() ? { email: "Enter your email address." } : {}),
      ...(!password ? { password: "Enter your password." } : {}),
    }
    setError("")
    showFields(invalid)
    if (Object.keys(invalid).length) return
    pending.current = true
    setSubmitting(true)
    try {
      const result = mode === "login" ? await login(email.trim(), password) : await register(email.trim(), displayName, password)
      if ("access_token" in result) {
        saveToken(result.access_token)
        onAuthenticated(result.user)
      } else {
        setRegistrationMessage(result.message)
        setPassword("")
      }
    } catch (err) {
      if (err instanceof FieldValidationError) showFields(err.fields)
      else if (mode === "register" && err instanceof Error && /email.*already/i.test(err.message)) showFields({ email: err.message })
      else setError(err instanceof Error ? err.message : "Couldn't submit. Please try again.")
    } finally {
      pending.current = false
      setSubmitting(false)
    }
  }
  function switchMode(next: "login" | "register") {
    if (pending.current) return
    setMode(next); setError(""); setFields({}); setRegistrationMessage("")
  }
  return <section className="auth-screen"><div className="auth-card">
    <header className="auth-header">
      <BrandLogo />
      <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="subtitle">{mode === "register" ? "Private beta registration is invite-only." : "Your collection, plays and recommendations in one place."}</p>
    </header>
    {sessionExpired && <p role="status" className="field-hint">Your session has expired. Log in again to continue.</p>}
    <div className="auth-tabs">
      <button type="button" disabled={submitting} aria-pressed={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Log in</button>
      <button type="button" disabled={submitting} aria-pressed={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>Register</button>
    </div>
    <form ref={form} className="auth-form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
      {registrationMessage && <p className="field-hint" role="status">{registrationMessage}</p>}
      {registrationMessage && <button type="button" className="auth-link-button" disabled={resending} onClick={() => {
        setResending(true); setError("")
        void resendBetaVerification(email.trim())
          .then(setRegistrationMessage)
          .catch(err => setError(err instanceof Error ? err.message : "Couldn't resend verification email."))
          .finally(() => setResending(false))
      }}>{resending ? "Sending…" : "Resend verification email"}</button>}
      {mode === "register" && <div>
        <label htmlFor="display-name">Name</label>
        <input id="display-name" name="display_name" value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" required disabled={submitting} aria-invalid={!!fields.display_name} aria-describedby={fields.display_name ? "name-error" : undefined} />
        {fields.display_name && <p id="name-error" className="field-error">{fields.display_name}</p>}
      </div>}
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" required disabled={submitting} aria-invalid={!!fields.email} aria-describedby={fields.email ? "email-error" : undefined} />
        {fields.email && <p id="email-error" className="field-error">{fields.email}</p>}
      </div>
      <PasswordField value={password} onChange={setPassword} error={fields.password} disabled={submitting} newPassword={mode === "register"} />
      {mode === "login" && <a className="auth-link-button" href="/forgot-password">Forgot password?</a>}
      {Object.keys(fields).length > 0 && <p className="field-error" role="alert">Check the highlighted fields.</p>}
      {error && <p className="error-message" role="alert">{error} Your input has been kept.</p>}
      <button type="submit" className="primary-button auth-submit" disabled={submitting}>
        {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </button>
    </form>
  </div></section>
}
