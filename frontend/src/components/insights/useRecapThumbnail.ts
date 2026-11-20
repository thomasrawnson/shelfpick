import { useEffect, useState } from "react"

// Renders the real share card once and hands back an object URL for a small
// preview. The URL is revoked when the card changes or the preview unmounts,
// and is only returned while it still belongs to the current `key`.
export function useRecapThumbnail(render: () => Promise<Blob>, key: unknown): string {
  const [state, setState] = useState<{ key: unknown; url: string }>({ key: undefined, url: "" })

  useEffect(() => {
    let active = true
    let created = ""
    void render().then(blob => {
      if (!active) return
      created = URL.createObjectURL(blob)
      setState({ key, url: created })
    }).catch(() => { /* The preview card stays usable without a thumbnail. */ })
    return () => {
      active = false
      if (created) URL.revokeObjectURL(created)
    }
    // `render` closes over `key`; re-render only when the card data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state.key === key ? state.url : ""
}
