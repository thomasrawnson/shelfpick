import type { MonthlyRecap, MonthlyRecapGame } from "./api/client"
import {
  SHARE_CARD,
  containImageRect,
  coverCropRect,
  fillRoundedRect,
  fitShareText,
  drawPoweredByBgg,
  loadCoverArtwork,
  loadShareImage,
  type ImageRect,
} from "./share-card"

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "Not recorded"
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (!hours) return `${remainder}m recorded`
  return remainder ? `${hours}h ${remainder}m recorded` : `${hours}h recorded`
}

export function monthlyRecapFileName(month: string): string {
  return `shelfpick-${month}-recap.png`
}

export type MonthlyHighlight = { label: string; value: string }

// "Most played" only means something when a game was played more than once.
export function monthlyHighlight(recap: MonthlyRecap): MonthlyHighlight | null {
  const top = recap.most_played
  if (!top) return null
  if (recap.total_plays === recap.unique_games) {
    return recap.unique_games === 1
      ? { label: "Played", value: top.name }
      : { label: "Variety", value: `${recap.unique_games} different games` }
  }
  return { label: "Most played", value: `${top.name} · ${top.play_count} ${top.play_count === 1 ? "play" : "plays"}` }
}

export function monthlyRecapAltText(recap: MonthlyRecap): string {
  const duration = recap.total_duration_minutes === null
    ? "recorded play time unavailable"
    : `${formatDuration(recap.total_duration_minutes)}`
  const highlight = monthlyHighlight(recap)
  const highlightText = !highlight
    ? ""
    : highlight.label === "Variety"
      ? ` ${highlight.value}, one play each.`
      : ` ${highlight.label}: ${highlight.value.replace(" · ", ", ")}.`
  return `${recap.month_label} ShelfPick recap: ${recap.total_plays} plays, ${recap.unique_games} games, ${duration}.${highlightText}`
}

const COLLAGE: ImageRect = { x: 72, y: 196, width: 1056, height: 840 }
const COLLAGE_RADIUS = 30
// Distinct, dark-enough tones so touching fallback tiles stay readable under white text.
const FALLBACK_TILE_COLOURS = ["#315C48", "#4D6B5D", "#6E5B2F", "#3F5C6E"] as const
const SCRIM_RGB = "18, 30, 24"

// Tiles share edges exactly: no gutters. The collage as a whole is clipped to
// one rounded rectangle, so only its outer corners are rounded.
export function collageRects(count: number): ImageRect[] {
  const { x, y, width, height } = COLLAGE
  const halfWidth = width / 2
  const halfHeight = height / 2
  if (count <= 1) return [{ x, y, width, height }]
  if (count === 2) {
    return [
      { x, y, width: halfWidth, height },
      { x: x + halfWidth, y, width: halfWidth, height },
    ]
  }
  if (count === 3) {
    return [
      { x, y, width: halfWidth, height },
      { x: x + halfWidth, y, width: halfWidth, height: halfHeight },
      { x: x + halfWidth, y: y + halfHeight, width: halfWidth, height: halfHeight },
    ]
  }
  return [0, 1, 2, 3].map(index => ({
    x: x + (index % 2) * halfWidth,
    y: y + Math.floor(index / 2) * halfHeight,
    width: halfWidth,
    height: halfHeight,
  }))
}

export function monthlyPlayCountLabel(playCount: number): string {
  return `${playCount} ${playCount === 1 ? "play" : "plays"}`
}

function recapInitials(gameName: string): string {
  return gameName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase())
    .join("") || "SP"
}

async function loadTileArtwork(
  game: MonthlyRecapGame,
  allowCoverArtwork: boolean,
): Promise<HTMLImageElement | null> {
  if (!allowCoverArtwork || !game.image_url) return null
  try {
    return await loadCoverArtwork(game.image_url)
  } catch {
    return null
  }
}

// A blurred backdrop without canvas `filter` (unsupported in WebKit): draw the
// cover tiny on an offscreen canvas, then smooth-scale it over the whole tile.
function drawBlurredBackdrop(
  context: CanvasRenderingContext2D,
  artwork: HTMLImageElement,
  bounds: ImageRect,
) {
  const small = document.createElement("canvas")
  small.width = 40
  small.height = Math.max(8, Math.round(40 * bounds.height / bounds.width))
  const smallContext = small.getContext("2d")
  if (smallContext) {
    smallContext.imageSmoothingEnabled = true
    smallContext.imageSmoothingQuality = "high"
    const source = coverCropRect(artwork.width, artwork.height, { x: 0, y: 0, width: small.width, height: small.height })
    smallContext.drawImage(
      artwork,
      source.x, source.y, source.width, source.height,
      0, 0, small.width, small.height,
    )
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(small, bounds.x, bounds.y, bounds.width, bounds.height)
  } else {
    context.fillStyle = `rgb(${SCRIM_RGB})`
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
  }
  context.fillStyle = "rgba(10, 18, 14, 0.5)"
  context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
}

// The label strip is reserved below the artwork so box-art titles are never covered.
function labelStripHeight(bounds: ImageRect): number {
  return bounds.height > 600 ? 116 : 92
}

function drawGameTile(
  context: CanvasRenderingContext2D,
  game: MonthlyRecapGame,
  bounds: ImageRect,
  index: number,
  artwork: HTMLImageElement | null,
) {
  const strip = labelStripHeight(bounds)
  const artArea: ImageRect = { ...bounds, height: bounds.height - strip }
  if (artwork) {
    // Whole cover, never cropped: contained over a blurred, darkened copy of
    // itself so the tile is still edge to edge.
    drawBlurredBackdrop(context, artwork, bounds)
    const target = containImageRect(artwork.width, artwork.height, artArea)
    context.drawImage(artwork, target.x, target.y, target.width, target.height)
  } else {
    context.fillStyle = FALLBACK_TILE_COLOURS[index % FALLBACK_TILE_COLOURS.length]
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
    context.fillStyle = "rgba(246, 243, 235, 0.92)"
    context.textAlign = "center"
    const initialsSize = Math.min(150, artArea.width * 0.3, artArea.height * 0.42)
    context.font = `600 ${initialsSize}px Lora, Georgia, serif`
    context.fillText(
      recapInitials(game.name),
      artArea.x + artArea.width / 2,
      artArea.y + artArea.height / 2 + initialsSize * 0.34,
    )
    context.textAlign = "left"
  }

  // Name and play count sit on their own dark strip under the artwork.
  const stripTop = bounds.y + bounds.height - strip
  const scrim = context.createLinearGradient(0, stripTop - 24, 0, bounds.y + bounds.height)
  scrim.addColorStop(0, `rgba(${SCRIM_RGB}, 0)`)
  scrim.addColorStop(0.2, `rgba(${SCRIM_RGB}, 0.72)`)
  scrim.addColorStop(1, `rgba(${SCRIM_RGB}, 0.94)`)
  context.fillStyle = scrim
  context.fillRect(bounds.x, stripTop - 24, bounds.width, strip + 24)

  const large = bounds.height > 600
  const padding = 28
  const textWidth = bounds.width - padding * 2
  const playsSize = large ? 28 : 24
  const nameSize = large ? 42 : 32
  const baseline = bounds.y + bounds.height - (large ? 24 : 20)
  context.textAlign = "left"
  context.fillStyle = "rgba(255, 255, 255, 0.9)"
  context.font = `800 ${playsSize}px 'Nunito Sans', system-ui, sans-serif`
  context.fillText(monthlyPlayCountLabel(game.play_count), bounds.x + padding, baseline)
  context.fillStyle = "#FFFFFF"
  context.font = `700 ${nameSize}px 'Nunito Sans', system-ui, sans-serif`
  context.fillText(
    fitShareText(context, game.name, textWidth),
    bounds.x + padding,
    baseline - playsSize - 10,
  )
}

function drawStatBand(context: CanvasRenderingContext2D, recap: MonthlyRecap) {
  const highlight = monthlyHighlight(recap)
  const x = 72
  const y = 1062
  const width = 1056
  const height = highlight ? 226 : 150
  context.fillStyle = SHARE_CARD.line
  fillRoundedRect(context, x, y, width, height, 28)
  context.fillStyle = SHARE_CARD.surface
  fillRoundedRect(context, x + 2, y + 2, width - 4, height - 4, 26)

  const recordedTime = recap.total_duration_minutes === null
    ? "Not recorded"
    : formatDuration(recap.total_duration_minutes).replace(" recorded", "")
  const metrics = [
    [String(recap.total_plays), recap.total_plays === 1 ? "PLAY" : "PLAYS"],
    [String(recap.unique_games), recap.unique_games === 1 ? "GAME" : "GAMES"],
    [recordedTime, recap.total_duration_minutes === null ? "PLAY TIME" : `RECORDED · ${recap.duration_plays} OF ${recap.total_plays} TIMED`],
  ]
  const columnWidth = width / 3
  context.textAlign = "center"
  metrics.forEach(([value, label], index) => {
    const centre = x + columnWidth * index + columnWidth / 2
    context.fillStyle = SHARE_CARD.ink
    context.font = value.length > 8 ? "600 38px Lora, Georgia, serif" : "600 62px Lora, Georgia, serif"
    context.fillText(fitShareText(context, value, columnWidth - 48), centre, y + 80)
    context.fillStyle = SHARE_CARD.inkSecondary
    context.font = "800 19px 'Nunito Sans', system-ui, sans-serif"
    context.fillText(fitShareText(context, label, columnWidth - 40), centre, y + 118)
    if (index > 0) {
      context.fillStyle = SHARE_CARD.line
      context.fillRect(x + columnWidth * index - 1, y + 26, 2, 104)
    }
  })
  context.textAlign = "left"

  if (highlight) {
    context.fillStyle = SHARE_CARD.line
    context.fillRect(x + 40, y + 148, width - 80, 2)
    const label = highlight.label.toUpperCase()
    context.fillStyle = SHARE_CARD.goldText
    context.font = "800 21px 'Nunito Sans', system-ui, sans-serif"
    context.fillText(label, x + 40, y + 196)
    const labelWidth = context.measureText(label).width
    context.fillStyle = SHARE_CARD.ink
    context.font = "600 36px Lora, Georgia, serif"
    context.fillText(
      fitShareText(context, highlight.value, width - 80 - labelWidth - 24),
      x + 40 + labelWidth + 24,
      y + 198,
    )
  }
}

export async function renderMonthlyRecapCard(
  recap: MonthlyRecap,
  allowCoverArtwork = false,
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = 1200
  canvas.height = 1500
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Image generation is unavailable in this browser.")
  try { await document.fonts?.ready } catch { /* Safe local font fallbacks remain. */ }

  context.fillStyle = SHARE_CARD.background
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = SHARE_CARD.forest
  context.fillRect(0, 0, canvas.width, 22)
  context.fillStyle = SHARE_CARD.goldText
  context.font = "800 28px 'Nunito Sans', system-ui, sans-serif"
  context.fillText(recap.month_label.toUpperCase(), 72, 90)
  context.fillStyle = SHARE_CARD.ink
  context.font = "600 72px Lora, Georgia, serif"
  context.fillText("My month in games", 72, 160)

  const games = recap.collage_games.slice(0, 4)
  const rects = collageRects(games.length)
  const artwork = await Promise.all(games.map(game => loadTileArtwork(game, allowCoverArtwork)))
  context.save()
  context.beginPath()
  context.roundRect(COLLAGE.x, COLLAGE.y, COLLAGE.width, COLLAGE.height, COLLAGE_RADIUS)
  context.clip()
  games.forEach((game, index) => drawGameTile(context, game, rects[index], index, artwork[index]))
  context.restore()

  drawStatBand(context, recap)

  context.fillStyle = SHARE_CARD.line
  context.fillRect(72, 1332, 1056, 2)
  try {
    const logo = await loadShareImage("/branding/shelfpick-logo-light.svg")
    context.drawImage(logo, 72, 1362, 258, 74)
  } catch {
    context.fillStyle = SHARE_CARD.forest
    context.font = "700 43px 'Nunito Sans', system-ui, sans-serif"
    context.fillText("ShelfPick", 72, 1415)
  }
  context.fillStyle = SHARE_CARD.inkSecondary
  context.textAlign = "right"
  context.font = "700 24px 'Nunito Sans', system-ui, sans-serif"
  context.fillText("A month from my shelf", 1128, 1376)
  await drawPoweredByBgg(context, 1128, 1388)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Couldn't create the PNG.")), "image/png")
  })
}
