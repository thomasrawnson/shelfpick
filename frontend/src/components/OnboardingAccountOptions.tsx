import { useState } from "react"
import { Link } from "react-router-dom"

import { APP_PATHS } from "../routes"
import { AccountDeletion } from "./SettingsSectionView"

type Props = {
  onLogout: () => Promise<void>
  onAccountDeleted: () => void
}

function OnboardingAccountOptions({ onLogout, onAccountDeleted }: Props) {
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState("")

  function logOut() {
    if (loggingOut) return
    setLoggingOut(true)
    setLogoutError("")
    void onLogout().catch((failure) => {
      setLogoutError(failure instanceof Error ? failure.message : "Couldn't log out.")
      setLoggingOut(false)
    })
  }

  return <section className="onboarding-screen onboarding-account-screen" aria-labelledby="onboarding-account-heading">
    <Link className="settings-back-link" to={APP_PATHS.onboarding}
      state={{ focusAccountOptions: true }}>Back to onboarding</Link>
    <header className="onboarding-header">
      <p className="eyebrow">Account options</p>
      <h1 id="onboarding-account-heading">Manage your account</h1>
      <p className="subtitle">You can leave setup without completing it.</p>
    </header>
    <section className="onboarding-account-card" aria-labelledby="onboarding-logout-heading">
      <h2 id="onboarding-logout-heading">Log out</h2>
      <p>Your setup progress on this screen is not saved.</p>
      <button type="button" className="secondary-button onboarding-account-action"
        disabled={loggingOut} onClick={logOut}>
        {loggingOut ? "Logging out…" : "Log out"}
      </button>
      {logoutError && <p className="error-message" role="alert">{logoutError}</p>}
    </section>
    <AccountDeletion onDeleted={onAccountDeleted} />
  </section>
}

export default OnboardingAccountOptions
