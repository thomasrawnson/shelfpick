import { useEffect, useState, type CSSProperties } from "react"

import { accentTextColors, coverAccent, fallbackAccent } from "./cover-accent"

// CSS variables for a cover's accent: a fill colour plus AA-safe text colours for
// light and dark themes. Starts on the palette colour and refines once the cover is read.
export function useCoverAccent(src: string | null | undefined, name: string): CSSProperties {
  const key = `${src ?? ""}|${name}`
  const [sampled, setSampled] = useState<{ key: string; color: string } | null>(null)

  useEffect(() => {
    let active = true
    void coverAccent(src, name).then(color => { if (active) setSampled({ key, color }) })
    return () => { active = false }
  }, [src, name, key])

  const accent = sampled?.key === key ? sampled.color : fallbackAccent(name)

  const text = accentTextColors(accent)
  return {
    "--cover-accent": accent,
    "--cover-accent-text-light": text.light,
    "--cover-accent-text-dark": text.dark,
  } as CSSProperties
}
