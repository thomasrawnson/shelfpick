import { agoLabel, useStaleSince } from "../../offline/cache"

type Props = { names: string[]; what: string }

// Shown when a screen is built from the copy saved on this device because ShelfPick could not be reached.
function SavedCopyNotice({ names, what }: Props) {
  const since = useStaleSince(names)
  if (since === null) return null
  return (
    <p className="saved-copy-notice" role="status">
      Offline · {what} last updated {agoLabel(since)}
    </p>
  )
}

export default SavedCopyNotice
