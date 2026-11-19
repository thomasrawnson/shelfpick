import type { ReactNode } from "react"

type Props = {
  className?: string
  thumbnailUrl: string
  thumbnailLabel: string
  onOpen: () => void
  children: ReactNode
}

// A compact preview: the actual share card scaled down beside its summary and actions.
function RecapPreview({ className = "", thumbnailUrl, thumbnailLabel, onOpen, children }: Props) {
  return (
    <article className={`recap-preview ${className}`.trim()}>
      <button type="button" className="recap-preview-thumb" aria-label={thumbnailLabel} onClick={onOpen}>
        {thumbnailUrl
          ? <img src={thumbnailUrl} alt="" />
          : <span className="recap-preview-skeleton" aria-hidden="true" />}
      </button>
      <div className="recap-preview-body">{children}</div>
    </article>
  )
}

export default RecapPreview
