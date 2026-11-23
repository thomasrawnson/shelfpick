import { useId, useState, type FormEvent } from "react"

import { sendFeedback } from "../api/client"
import {
  buildFeedback,
  FEEDBACK_MAX,
  feedbackLengthError,
  FeedbackOfflineError,
  queueFeedback,
  type FeedbackType,
} from "../feedback"
import ChoiceGroup from "./ui/ChoiceGroup"
import Sheet from "./ui/Sheet"

const TYPE_OPTIONS: Array<{ value: FeedbackType; label: string }> = [
  { value: "feature", label: "Feature idea" },
  { value: "problem", label: "Problem" },
  { value: "other", label: "Other" },
]

const PLACEHOLDERS: Record<FeedbackType, string> = {
  feature: "What would make ShelfPick better for your game nights?",
  problem: "What happened, and what did you expect to happen?",
  other: "What's on your mind?",
}

type Status = "editing" | "sending" | "sent" | "queued"

function FeedbackSheet({ userId, initialType, onClose }: {
  userId: number
  initialType: FeedbackType
  onClose: () => void
}) {
  const titleId = useId()
  const formId = useId()
  const messageId = useId()
  const countId = useId()
  const [type, setType] = useState<FeedbackType>(initialType)
  const [message, setMessage] = useState("")
  const [wantsReply, setWantsReply] = useState(false)
  // Device details help most with problems; the person can switch it either way.
  const [includeInfo, setIncludeInfo] = useState(initialType === "problem")
  const [status, setStatus] = useState<Status>("editing")
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === "sending") return
    const lengthError = feedbackLengthError(message)
    if (lengthError) { setError(lengthError); return }
    const payload = buildFeedback(type, message, wantsReply, includeInfo, navigator.userAgent)
    setError("")
    setStatus("sending")
    try {
      if (navigator.onLine === false) throw new FeedbackOfflineError()
      await sendFeedback(payload)
      setStatus("sent")
    } catch (failure) {
      if (failure instanceof FeedbackOfflineError) {
        queueFeedback(userId, payload)
        setStatus("queued")
        return
      }
      // The text stays in the box so nothing is lost.
      setError(failure instanceof Error ? failure.message : "Couldn't send your message. Try again.")
      setStatus("editing")
    }
  }

  const done = status === "sent" || status === "queued"
  const sending = status === "sending"
  const length = message.trim().length

  return <Sheet labelledBy={titleId} onEscape={() => { if (!sending) onClose() }}>
    <header className="play-sheet-header">
      {done ? <span /> : <button type="button" className="sheet-text-button" onClick={onClose} disabled={sending}>Cancel</button>}
      <div className="play-sheet-title"><h2 id={titleId}>Send feedback</h2></div>
      {done
        ? <button type="button" className="sheet-text-button sheet-strong" onClick={onClose}>Done</button>
        : <button type="submit" form={formId} className="sheet-save-button" disabled={sending} aria-busy={sending}>
          {sending ? "Sending…" : "Send"}
        </button>}
    </header>

    {done ? <div className="feedback-done" role="status">
      <strong>{status === "sent" ? "Thanks, we've got it" : "Saved to send later"}</strong>
      <p>{status === "sent"
        ? wantsReply ? "We read every message and will email you back." : "We read every message."
        : "You're offline. Your message is saved on this phone and will send automatically when you're back online."}</p>
    </div> : <form id={formId} className="feedback-form" noValidate onSubmit={(event) => { void submit(event) }}>
      <ChoiceGroup ariaLabel="Feedback type" value={type} options={TYPE_OPTIONS} onChange={setType} />
      <div className="feedback-field">
        <label htmlFor={messageId}>Message</label>
        <textarea id={messageId} value={message} rows={6} maxLength={FEEDBACK_MAX + 200}
          placeholder={PLACEHOLDERS[type]} aria-describedby={countId} aria-invalid={Boolean(error) || undefined}
          disabled={sending} onChange={(event) => { setMessage(event.target.value); setError("") }} />
        <span id={countId} className={`feedback-count${length > FEEDBACK_MAX ? " is-over" : ""}`}>
          {length} / {FEEDBACK_MAX}
        </span>
      </div>
      <div className="settings-list">
        <label className="feedback-toggle">
          <span>Email me back</span>
          <input type="checkbox" role="switch" checked={wantsReply} disabled={sending}
            onChange={(event) => setWantsReply(event.target.checked)} />
        </label>
        <label className="feedback-toggle">
          <span>Include app and device info</span>
          <input type="checkbox" role="switch" checked={includeInfo} disabled={sending}
            onChange={(event) => setIncludeInfo(event.target.checked)} />
        </label>
      </div>
      <p className="settings-field-note">
        {wantsReply ? "We'll reply to your account email. " : "Your email address isn't shared unless you ask for a reply. "}
        {includeInfo ? "App version, build, iOS version and device type are included." : "No device details are included."}
      </p>
      {error && <p className="error-message" role="alert">{error}</p>}
    </form>}
  </Sheet>
}

export default FeedbackSheet
