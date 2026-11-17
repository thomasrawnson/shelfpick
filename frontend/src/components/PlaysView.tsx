type Props = { onLogPlay: () => void }

// Checkpoint placeholder: play history with filters and Rematch lands after owner approval.
function PlaysView({ onLogPlay }: Props) {
  return (
    <section className="screen plays-screen">
      <header>
        <h1>Plays</h1>
        <p className="subtitle">Your play history will live here.</p>
      </header>
      <button type="button" className="primary-button plays-log-button" onClick={onLogPlay}>Log play</button>
    </section>
  )
}

export default PlaysView
