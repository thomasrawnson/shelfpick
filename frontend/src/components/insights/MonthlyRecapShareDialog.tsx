import { useEffect, useRef, useState } from "react"
import type { MonthlyRecap } from "../../api/client"
import { resolveExportCoverArtworkPermission } from "../../export-artwork-policy"
import {
  monthlyRecapAltText,
  monthlyRecapFileName,
  renderMonthlyRecapCard,
} from "../../monthly-recap-card"
import { isShareCancellation } from "../../share-card"

type Props = { recap: MonthlyRecap; onClose: () => void }

function MonthlyRecapShareDialog({ recap, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [generating, setGenerating] = useState(true)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => { dialogRef.current?.showModal() }, [])
  useEffect(() => {
    let active = true
    void resolveExportCoverArtworkPermission()
      .then(allowCoverArtwork => renderMonthlyRecapCard(
        recap,
        allowCoverArtwork,
      )).then(nextBlob => {
      if (!active) return
      const nextUrl = URL.createObjectURL(nextBlob)
      setBlob(nextBlob)
      setPreviewUrl(previous => {
        if (previous) URL.revokeObjectURL(previous)
        return nextUrl
      })
    }).catch(() => {
      if (active) setError("Couldn't generate the image. Try again.")
    }).finally(() => {
      if (active) setGenerating(false)
    })
    return () => { active = false }
  }, [recap, attempt])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const fileName = monthlyRecapFileName(recap.month)
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

  function retry() {
    setGenerating(true)
    setError("")
    setStatus("")
    setAttempt(current => current + 1)
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
      await navigator.share({ files: [file], title: `${recap.month_label} ShelfPick recap` })
      setStatus("Share sheet closed. ShelfPick did not post the image itself.")
    } catch (shareError) {
      if (isShareCancellation(shareError)) {
        setStatus("Sharing cancelled.")
        return
      }
      setError("Couldn't open sharing. Download the image instead.")
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="play-share-dialog"
      aria-labelledby="monthly-recap-share-title"
      aria-describedby="monthly-recap-share-description"
      onCancel={event => { event.preventDefault(); dialogRef.current?.close() }}
      onClose={onClose}
    >
      <div className="play-share-header">
        <div>
          <h2 id="monthly-recap-share-title">Share {recap.month_label}</h2>
          <p id="monthly-recap-share-description">Preview your recap, then share or download it.</p>
        </div>
        <button type="button" className="ghost-button" onClick={() => dialogRef.current?.close()}>Close</button>
      </div>
      <div className="play-share-layout">
        <div className="play-share-preview" aria-live="polite" aria-busy={generating}>
          {generating && <p role="status">Generating preview…</p>}
          {!generating && error && (
            <div className="play-share-error">
              <p role="alert">{error}</p>
              <button type="button" className="secondary-button" onClick={retry}>Retry</button>
            </div>
          )}
          {!generating && !error && previewUrl && <img src={previewUrl} alt={monthlyRecapAltText(recap)} />}
        </div>
        <div className="play-share-options">
          <div>
            <h3>Only your play totals</h3>
            <p className="play-share-privacy">
              Player names, scores and locations are never included. Missing play time stays unreported.
            </p>
          </div>
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

export default MonthlyRecapShareDialog
