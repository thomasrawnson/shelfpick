import { useEffect, useRef, useState } from "react"
import type { Game, GamePlay } from "../../api/client"
import {
  buildShareCardContent,
  DEFAULT_SHARE_PRIVACY,
  isShareCancellation,
  renderPlayShareCard,
  shareFileName,
  type SharePrivacyOptions,
} from "../../share-card"

type Props = { game: Game; play: GamePlay; onClose: () => void }

function PlayShareDialog({ game, play, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [privacy, setPrivacy] = useState<SharePrivacyOptions>(DEFAULT_SHARE_PRIVACY)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [generating, setGenerating] = useState(true)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("")
  const generation = useRef(0)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    const current = ++generation.current
    let active = true
    void renderPlayShareCard(game, play, privacy).then(nextBlob => {
      if (!active || generation.current !== current) return
      const nextUrl = URL.createObjectURL(nextBlob)
      setBlob(nextBlob)
      setPreviewUrl(previous => { if (previous) URL.revokeObjectURL(previous); return nextUrl })
    }).catch(() => {
      if (active && generation.current === current) setError("Couldn't generate the image. Try again.")
    }).finally(() => {
      if (active && generation.current === current) setGenerating(false)
    })
    return () => { active = false }
  }, [game, play, privacy])

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const content = buildShareCardContent(game, play, privacy)
  const fileName = shareFileName(game.name)
  const file = blob && typeof File === "function"
    ? new File([blob], fileName, { type: "image/png" })
    : null
  let nativeShareAvailable = false
  try {
    nativeShareAvailable = Boolean(
      file
      && typeof navigator.share === "function"
      && navigator.canShare?.({ files: [file] }),
    )
  } catch {
    nativeShareAvailable = false
  }

  function updatePrivacy(key: keyof SharePrivacyOptions, value: boolean) {
    setGenerating(true)
    setError("")
    setStatus("")
    setPrivacy(current => ({ ...current, [key]: value }))
  }

  function retry() {
    setGenerating(true)
    setError("")
    setPrivacy(current => ({ ...current }))
  }

  function download() {
    if (!previewUrl) return
    const anchor = document.createElement("a")
    anchor.href = previewUrl
    anchor.download = fileName
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    setStatus("Image downloaded. Nothing was posted automatically.")
  }

  async function share() {
    if (!file || !nativeShareAvailable) return
    setStatus("")
    try {
      await navigator.share({ files: [file], title: `${game.name} play` })
      setStatus("Share sheet closed. ShelfPick did not post the image itself.")
    } catch (shareError) {
      if (isShareCancellation(shareError)) {
        setStatus("Sharing cancelled.")
        return
      }
      setError("Couldn't open sharing. Download the image instead.")
    }
  }

  function close() {
    dialogRef.current?.close()
  }

  return (
    <dialog
      ref={dialogRef}
      className="play-share-dialog"
      aria-labelledby="play-share-title"
      aria-describedby="play-share-description"
      onCancel={event => { event.preventDefault(); close() }}
      onClose={onClose}
    >
      <div className="play-share-header">
        <div>
          <h2 id="play-share-title">Share this play</h2>
          <p id="play-share-description">Preview the image, then choose what to include.</p>
        </div>
        <button type="button" className="ghost-button" onClick={close}>Close</button>
      </div>

      <div className="play-share-layout">
        <div className="play-share-preview" aria-live="polite" aria-busy={generating}>
          {generating && <p role="status">Generating preview…</p>}
          {!generating && error && <div className="play-share-error"><p role="alert">{error}</p><button type="button" className="secondary-button" onClick={retry}>Retry</button></div>}
          {!generating && !error && previewUrl && (
            <img
              src={previewUrl}
              alt={`Share image for ${content.title}, played ${content.date}${content.duration ? `, ${content.duration}` : ""}${content.location ? `, at ${content.location}` : ""}.`}
            />
          )}
        </div>

        <div className="play-share-options">
          <fieldset>
            <legend>Include in image</legend>
            <label><input type="checkbox" checked={privacy.includePlayerNames} onChange={event => updatePrivacy("includePlayerNames", event.target.checked)} />Player names</label>
            <label><input type="checkbox" checked={privacy.includeScores} onChange={event => updatePrivacy("includeScores", event.target.checked)} />Scores</label>
            <label><input type="checkbox" checked={privacy.includeLocation} disabled={!play.location} onChange={event => updatePrivacy("includeLocation", event.target.checked)} />Location{!play.location ? " (not recorded)" : ""}</label>
          </fieldset>
          <p className="play-share-privacy">Names and location start hidden. Account details and email addresses are never included.</p>
          <div className="play-share-actions">
            {nativeShareAvailable && <button type="button" className="primary-button" disabled={generating || Boolean(error)} onClick={() => void share()}>Share image</button>}
            <button type="button" className={nativeShareAvailable ? "secondary-button" : "primary-button"} disabled={generating || Boolean(error)} onClick={download}>Download image</button>
          </div>
          {status && <p className="success-message" role="status">{status}</p>}
        </div>
      </div>
    </dialog>
  )
}

export default PlayShareDialog
