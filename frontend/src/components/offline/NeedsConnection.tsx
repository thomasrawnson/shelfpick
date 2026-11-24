import { useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import { probeApi } from "../../api/client"
import { useOnline } from "../../offline/connectivity"
import { APP_PATHS } from "../../routes"

type Props = { feature: string; children: ReactNode }

// Tonight, Discover, Stats and Game Night need the server. Without a connection they say so, and point
// at what still works, instead of loading into an error.
function NeedsConnection({ feature, children }: Props) {
  const online = useOnline()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)

  // While the notice is up, look for the connection coming back.
  useEffect(() => {
    if (online) return
    const id = window.setInterval(() => { void probeApi() }, 10_000)
    return () => window.clearInterval(id)
  }, [online])

  if (online) return <>{children}</>

  async function tryAgain() {
    setChecking(true)
    await probeApi()
    setChecking(false)
  }

  return (
    <section className="screen needs-connection" role="status">
      <h1>{feature} needs a connection</h1>
      <p>You're offline. Your shelf and plays are still here, and anything you log will sync when you're back.</p>
      <div className="needs-connection-actions">
        <button type="button" className="primary-button" onClick={() => navigate(APP_PATHS.plays)}>Log a play</button>
        <button type="button" className="secondary-button" onClick={() => navigate(APP_PATHS.shelfOwned)}>Browse your shelf</button>
        <button type="button" className="ghost-button" disabled={checking} onClick={() => void tryAgain()}>
          {checking ? "Checking…" : "Try again"}
        </button>
      </div>
    </section>
  )
}

export default NeedsConnection
