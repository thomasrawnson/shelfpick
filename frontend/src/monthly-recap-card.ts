import type { MonthlyRecap, MonthlyRecapGame } from "./api/client"
import {
  SHARE_CARD,
  containImageRect,
  drawShareArtworkFallback,
  fillRoundedRect,
  fitShareText,
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

export function monthlyRecapAltText(recap: MonthlyRecap): string {
  const duration = recap.total_duration_minutes === null
    ? "recorded play time unavailable"
    : `${formatDuration(recap.total_duration_minutes)}`
  const mostPlayed = recap.most_played
    ? ` Most played: ${recap.most_played.name}, ${recap.most_played.play_count} ${recap.most_played.play_count === 1 ? "play" : "plays"}.`
    : ""
  return `${recap.month_label} ShelfPick recap: ${recap.total_plays} plays, ${recap.unique_games} games, ${duration}.${mostPlayed}`
}

function collageRects(count: number): ImageRect[] {
  const x = 64
  const y = 254
  const width = 1072
  const height = 650
  const gap = 20
  if (count <= 1) return [{ x, y, width, height }]
  if (count === 2) {
    return [0, 1].map(index => ({
      x: x + index * ((width + gap) / 2),
      y,
      width: (width - gap) / 2,
      height,
    }))
  }
  return [0, 1, 2, 3].slice(0, count).map(index => ({
    x: x + (index % 2) * ((width + gap) / 2),
    y: y + Math.floor(index / 2) * ((height + gap) / 2),
    width: (width - gap) / 2,
    height: (height - gap) / 2,
  }))
}

async function drawGameTile(
  context: CanvasRenderingContext2D,
  game: MonthlyRecapGame,
  bounds: ImageRect,
) {
  context.fillStyle = SHARE_CARD.forestSoft
  fillRoundedRect(context, bounds.x, bounds.y, bounds.width, bounds.height, 24)
  const artworkBounds = {
    x: bounds.x + 18,
    y: bounds.y + 18,
    width: bounds.width - 36,
    height: bounds.height - 88,
  }
  let loaded = false
  if (game.image_url) {
    try {
      const artwork = await loadShareImage(game.image_url)
      const target = containImageRect(artwork.width, artwork.height, artworkBounds)
      context.fillStyle = SHARE_CARD.surface
      fillRoundedRect(context, target.x - 7, target.y - 7, target.width + 14, target.height + 14, 18)
      context.drawImage(artwork, target.x, target.y, target.width, target.height)
      loaded = true
    } catch {
      loaded = false
    }
  }
  if (!loaded) drawShareArtworkFallback(context, game.name, artworkBounds)
  context.fillStyle = SHARE_CARD.ink
  context.font = "700 25px 'Nunito Sans', system-ui, sans-serif"
  context.fillText(fitShareText(context, game.name, bounds.width - 40), bounds.x + 20, bounds.y + bounds.height - 27)
}

export async function renderMonthlyRecapCard(recap: MonthlyRecap): Promise<Blob> {
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
  context.fillText(recap.month_label.toUpperCase(), 72, 100)
  context.fillStyle = SHARE_CARD.ink
  context.font = "600 72px Lora, Georgia, serif"
  context.fillText("My month in games", 72, 190)

  const games = recap.collage_games.slice(0, 4)
  await Promise.all(games.map((game, index) => drawGameTile(context, game, collageRects(games.length)[index])))

  const metricY = 1010
  const recordedTime = recap.total_duration_minutes === null
    ? "Not recorded"
    : formatDuration(recap.total_duration_minutes).replace(" recorded", "")
  const metrics = [
    [String(recap.total_plays), recap.total_plays === 1 ? "PLAY" : "PLAYS"],
    [String(recap.unique_games), recap.unique_games === 1 ? "GAME" : "GAMES"],
    [recordedTime, recap.total_duration_minutes === null ? "PLAY TIME" : `RECORDED · ${recap.duration_plays} OF ${recap.total_plays} TIMED`],
  ]
  metrics.forEach(([value, label], index) => {
    const x = 72 + index * 352
    context.fillStyle = SHARE_CARD.ink
    context.font = index === 2 ? "600 42px Lora, Georgia, serif" : "600 64px Lora, Georgia, serif"
    context.fillText(fitShareText(context, value, 318), x, metricY)
    context.fillStyle = SHARE_CARD.inkSecondary
    context.font = "800 21px 'Nunito Sans', system-ui, sans-serif"
    context.fillText(label, x, metricY + 42)
  })

  if (recap.most_played) {
    context.fillStyle = SHARE_CARD.goldSoft
    fillRoundedRect(context, 72, 1120, 1056, 122, 18)
    context.fillStyle = SHARE_CARD.goldText
    context.font = "800 21px 'Nunito Sans', system-ui, sans-serif"
    context.fillText("MOST PLAYED", 98, 1161)
    context.fillStyle = SHARE_CARD.ink
    context.font = "600 37px Lora, Georgia, serif"
    const suffix = `${recap.most_played.play_count} ${recap.most_played.play_count === 1 ? "play" : "plays"}`
    context.fillText(fitShareText(context, `${recap.most_played.name} · ${suffix}`, 1004), 98, 1210)
  }

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
  context.fillText("A month from my shelf", 1128, 1395)
  context.font = "600 20px 'Nunito Sans', system-ui, sans-serif"
  context.fillText("Game data from BoardGameGeek", 1128, 1428)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Couldn't create the PNG.")), "image/png")
  })
}
