import { useRef, useState, type FormEvent } from "react"
import { confirmPasswordReset } from "../api/client"
import { FieldValidationError } from "../api/request"
import { passwordError } from "../auth-validation"
import PasswordField from "./ui/PasswordField"
import BrandLogo from "./ui/BrandLogo"
import { resetTokenFromSearch } from "../reset-link"

export default function ResetPasswordView() {
  const token = resetTokenFromSearch(window.location.search)
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [fieldError, setFieldError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const pending = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  function showPasswordError(value: string) {
    setFieldError(value)
    if (value) requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>("#password")?.focus())
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || message) return
    const invalid = passwordError(password)
    showPasswordError(invalid)
    setError("")
    if (invalid) return
    pending.current = true; setSubmitting(true)
    try {
      setMessage(await confirmPasswordReset(token, password))
      setPassword("")
    } catch (err) {
      if (err instanceof FieldValidationError && err.fields.password) showPasswordError(err.fields.password)
      else setError(err instanceof Error ? err.message : "Couldn't reset your password. Try again.")
    } finally { pending.current = false; setSubmitting(false) }
  }
  return <section className="auth-screen"><div className="auth-card">
    <header className="auth-header"><BrandLogo /><h1>{token ? "Choose a new password" : "Invalid reset link"}</h1></header>
    {!token ? <a className="secondary-button" href="/forgot-password">Request a new reset link</a> : message ? <>
      <p role="status">{message}</p><a className="primary-button" href="/login">Log in</a>
    </> : <form ref={form} className="auth-form" onSubmit={submit} noValidate aria-busy={submitting}>
      <PasswordField value={password} onChange={setPassword} error={fieldError} disabled={submitting} newPassword />
      {fieldError && <p role="alert" className="field-error">Check your new password.</p>}
      {error && <div><p className="error-message" role="alert">{error}</p><a href="/forgot-password">Request a new reset link</a></div>}
      <button type="submit" className="primary-button auth-submit" disabled={submitting}>{submitting ? "Updating…" : "Update password"}</button>
    </form>}
  </div></section>
}
