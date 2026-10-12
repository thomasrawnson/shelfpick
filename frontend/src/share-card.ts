import type { Game, GamePlay } from "./api/client"

export type SharePrivacyOptions = {
  includePlayerNames: boolean
  includeScores: boolean
  includeLocation: boolean
}

export const DEFAULT_SHARE_PRIVACY: SharePrivacyOptions = {
  includePlayerNames: false,
  includeScores: false,
  includeLocation: false,
}

export type ShareCardContent = {
  title: string
  date: string
  duration: string | null
  location: string | null
  result: string | null
  participants: Array<{ label: string; score: string | null }>
}

const EMAIL_ADDRESS = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const EMAIL_ADDRESSES = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi

export const SHARE_CARD = {
  background: "#F6F3EB",
  surface: "#FFFFFF",
  forest: "#315C48",
  forestSoft: "#E3EBE6",
  goldSoft: "#F4EAD7",
  goldText: "#81591F",
  ink: "#1E2A24",
  inkSecondary: "#667068",
  line: "#D9D5CB",
} as const

function shareParticipantLabel(name: string, index: number): string {
  return EMAIL_ADDRESS.test(name) ? `Player ${index + 1}` : name
}

export function redactEmailAddresses(value: string): string {
  return value.replace(EMAIL_ADDRESSES, "[email hidden]")
}

export function buildShareCardContent(
  game: Game,
  play: GamePlay,
  privacy: SharePrivacyOptions,
): ShareCardContent {
  const winners = play.participants.filter(participant => participant.is_winner)
  const isCooperative = game.mechanics?.some(
    mechanic => mechanic.trim().toLowerCase() === "cooperative game",
  ) ?? false
  const isScoredTie = winners.length > 1
    && winners.every(winner => winner.score !== null)
    && winners.every(winner => winner.score === winners[0].score)
  const winnerLabels = winners.map(player => shareParticipantLabel(
    player.name,
    play.participants.indexOf(player),
  ))
  let result: string | null = null

  if (
    isCooperative
    && winners.length === play.participants.length
    && winners.length > 0
  ) {
    result = "Cooperative win"
  } else if (isScoredTie) {
    result = privacy.includePlayerNames
      ? `Tie: ${winnerLabels.join(", ")}`
      : "Tie"
  } else if (winners.length > 1) {
    result = privacy.includePlayerNames
      ? `Shared win: ${winnerLabels.join(", ")}`
      : "Shared win"
  } else if (winners.length === 1) {
    result = privacy.includePlayerNames
      ? `Winner: ${shareParticipantLabel(
        winners[0].name,
        play.participants.indexOf(winners[0]),
      )}`
      : "Winner recorded"
  }

  return {
    title: game.name,
    date: new Date(play.played_at).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    duration: play.duration_minutes && play.duration_minutes > 0
      ? `${play.duration_minutes} min`
      : null,
    location: privacy.includeLocation && play.location
      ? redactEmailAddresses(play.location)
      : null,
    result,
    participants: play.participants.map((participant, index) => ({
      label: privacy.includePlayerNames
        ? shareParticipantLabel(participant.name, index)
        : `Player ${index + 1}`,
      score: privacy.includeScores && participant.score !== null
        ? String(participant.score)
        : null,
    })),
  }
}

export function loadShareImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timeout = window.setTimeout(() => reject(new Error("Image timed out")), 8_000)
    if (/^https?:/i.test(src)) image.crossOrigin = "anonymous"
    image.onload = () => { window.clearTimeout(timeout); resolve(image) }
    image.onerror = () => { window.clearTimeout(timeout); reject(new Error("Image unavailable")) }
    image.src = src
  })
}

export function wrapShareText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const words = text.split(/\s+/).flatMap(word => {
    if (context.measureText(word).width <= maxWidth) return [word]
    const pieces: string[] = []
    let piece = ""
    for (const character of word) {
      if (piece && context.measureText(`${piece}${character}`).width > maxWidth) {
        pieces.push(piece)
        piece = character
      } else {
        piece += character
      }
    }
    if (piece) pieces.push(piece)
    return pieces
  })
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  const visible = lines.slice(0, maxLines)
  if (lines.length > maxLines) {
    let last = visible[maxLines - 1]
    while (last && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
    visible[maxLines - 1] = `${last}…`
  }
  visible.forEach((value, index) => context.fillText(value, x, y + index * lineHeight))
  return y + visible.length * lineHeight
}

export function fitShareText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (context.measureText(text).width <= maxWidth) return text
  let visible = text
  while (visible && context.measureText(`${visible}…`).width > maxWidth) {
    visible = visible.slice(0, -1)
  }
  return `${visible}…`
}

export function fillRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
  context.fill()
}

export type ImageRect = {
  x: number
  y: number
  width: number
  height: number
}

export function containImageRect(
  imageWidth: number,
  imageHeight: number,
  bounds: ImageRect,
): ImageRect {
  if (imageWidth <= 0 || imageHeight <= 0) return { ...bounds }
  const scale = Math.min(bounds.width / imageWidth, bounds.height / imageHeight)
  const width = imageWidth * scale
  const height = imageHeight * scale
  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height,
  }
}

export function drawShareArtworkFallback(
  context: CanvasRenderingContext2D,
  gameName: string,
  bounds: ImageRect,
) {
  context.fillStyle = SHARE_CARD.forestSoft
  fillRoundedRect(context, bounds.x, bounds.y, bounds.width, bounds.height, 28)

  const tileWidth = Math.min(360, bounds.width - 96)
  const tileHeight = Math.min(390, bounds.height - 96)
  const tileX = bounds.x + (bounds.width - tileWidth) / 2
  const tileY = bounds.y + (bounds.height - tileHeight) / 2
  context.fillStyle = SHARE_CARD.background
  fillRoundedRect(context, tileX, tileY, tileWidth, tileHeight, 24)

  context.fillStyle = SHARE_CARD.forest
  context.textAlign = "center"
  const initialsSize = Math.min(142, tileWidth * 0.38, tileHeight * 0.38)
  context.font = `600 ${initialsSize}px Lora, Georgia, serif`
  const initials = gameName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase())
    .join("") || "SP"
  context.fillText(initials, bounds.x + bounds.width / 2, tileY + tileHeight * 0.55)
  const fallbackLabelSize = Math.min(29, Math.max(16, tileWidth / 13))
  context.font = `700 ${fallbackLabelSize}px 'Nunito Sans', system-ui, sans-serif`
  context.fillText("Cover not available", bounds.x + bounds.width / 2, tileY + tileHeight * 0.82)
  context.textAlign = "left"
}

export async function renderPlayShareCard(
  game: Game,
  play: GamePlay,
  privacy: SharePrivacyOptions,
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = 1200
  canvas.height = 1500
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Image generation is unavailable in this browser.")
  const content = buildShareCardContent(game, play, privacy)

  try {
    await document.fonts?.ready
  } catch {
    // Canvas font stacks retain safe local fallbacks.
  }

  context.fillStyle = SHARE_CARD.background
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = SHARE_CARD.forest
  context.fillRect(0, 0, canvas.width, 22)

  const hasOptionalDetails = Boolean(
    content.location
    || privacy.includePlayerNames
    || privacy.includeScores,
  )
  const artworkStageHeight = hasOptionalDetails ? 560 : 650
  const artworkStage = { x: 64, y: 58, width: 1072, height: artworkStageHeight }
  const artworkBounds = { x: 98, y: 92, width: 1004, height: artworkStageHeight - 68 }
  context.fillStyle = SHARE_CARD.forestSoft
  fillRoundedRect(
    context,
    artworkStage.x,
    artworkStage.y,
    artworkStage.width,
    artworkStage.height,
    32,
  )
  let artworkLoaded = false
  if (game.image_url) {
    try {
      const artwork = await loadShareImage(game.image_url)
      const target = containImageRect(artwork.width, artwork.height, artworkBounds)
      context.fillStyle = SHARE_CARD.surface
      fillRoundedRect(context, target.x - 10, target.y - 10, target.width + 20, target.height + 20, 24)
      context.drawImage(artwork, target.x, target.y, target.width, target.height)
      artworkLoaded = true
    } catch {
      artworkLoaded = false
    }
  }
  if (!artworkLoaded) {
    drawShareArtworkFallback(context, game.name, artworkBounds)
  }

  let y = artworkStage.y + artworkStage.height + 84
  context.fillStyle = SHARE_CARD.ink
  context.font = "600 68px Lora, Georgia, serif"
  y = wrapShareText(context, content.title, 72, y, 1056, 72, 2) + 16
  context.fillStyle = SHARE_CARD.inkSecondary
  context.font = "700 29px 'Nunito Sans', system-ui, sans-serif"
  const dateAndDuration = [content.date, content.duration].filter(Boolean).join("  ·  ")
  context.fillText(fitShareText(context, dateAndDuration, 1056), 72, y)
  y += 48

  if (content.location) {
    context.fillStyle = SHARE_CARD.forest
    context.font = "700 28px 'Nunito Sans', system-ui, sans-serif"
    context.fillText(fitShareText(context, `At ${content.location}`, 1056), 72, y)
    y += 46
  }
  if (content.result) {
    context.fillStyle = SHARE_CARD.goldSoft
    fillRoundedRect(context, 72, y, 1056, 70, 16)
    context.fillStyle = SHARE_CARD.goldText
    context.font = "700 29px 'Nunito Sans', system-ui, sans-serif"
    context.fillText(fitShareText(context, content.result, 1004), 98, y + 45)
    y += 92
  }

  const visibleParticipants = content.participants.slice(0, 4)
  if (privacy.includePlayerNames || privacy.includeScores) {
    context.font = "700 26px 'Nunito Sans', system-ui, sans-serif"
    for (const participant of visibleParticipants) {
      context.fillStyle = SHARE_CARD.ink
      context.fillText(fitShareText(context, participant.label, 820), 78, y)
      if (participant.score !== null) {
        context.textAlign = "right"
        context.fillText(fitShareText(context, participant.score, 160), 1122, y)
        context.textAlign = "left"
      }
      y += 35
    }
    if (content.participants.length > visibleParticipants.length) {
      context.fillStyle = SHARE_CARD.inkSecondary
      context.fillText(`+${content.participants.length - visibleParticipants.length} more players`, 78, y)
    }
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
  context.fillText("A play from my shelf", 1128, 1395)
  context.font = "600 20px 'Nunito Sans', system-ui, sans-serif"
  context.fillText("Game data from BoardGameGeek", 1128, 1428)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Couldn't create the PNG.")), "image/png")
  })
}

export function shareFileName(gameName: string): string {
  const slug = gameName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
  return `shelfpick-${slug || "play"}.png`
}

export function isShareCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}
