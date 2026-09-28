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

function shareParticipantLabel(name: string, index: number): string {
  return EMAIL_ADDRESS.test(name) ? `Player ${index + 1}` : name
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
    location: privacy.includeLocation ? play.location : null,
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timeout = window.setTimeout(() => reject(new Error("Image timed out")), 8_000)
    if (/^https?:/i.test(src)) image.crossOrigin = "anonymous"
    image.onload = () => { window.clearTimeout(timeout); resolve(image) }
    image.onerror = () => { window.clearTimeout(timeout); reject(new Error("Image unavailable")) }
    image.src = src
  })
}

function wrapText(
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

function fitText(
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

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
  context.fill()
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

  context.fillStyle = "#F6F3EB"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = "#315C48"
  context.fillRect(0, 0, canvas.width, 26)

  const artworkX = 72
  const artworkY = 72
  const artworkWidth = 1056
  const artworkHeight = 530
  let artworkLoaded = false
  if (game.image_url) {
    try {
      const artwork = await loadImage(game.image_url)
      const scale = Math.max(artworkWidth / artwork.width, artworkHeight / artwork.height)
      const width = artwork.width * scale
      const height = artwork.height * scale
      context.save()
      context.beginPath()
      context.roundRect(artworkX, artworkY, artworkWidth, artworkHeight, 32)
      context.clip()
      context.drawImage(artwork, artworkX + (artworkWidth - width) / 2, artworkY + (artworkHeight - height) / 2, width, height)
      context.restore()
      artworkLoaded = true
    } catch {
      artworkLoaded = false
    }
  }
  if (!artworkLoaded) {
    context.fillStyle = "#E3EBE6"
    roundedRect(context, artworkX, artworkY, artworkWidth, artworkHeight, 32)
    context.fillStyle = "#315C48"
    context.textAlign = "center"
    context.font = "700 170px Lora, Georgia, serif"
    const initials = game.name.split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase()).join("") || "SP"
    context.fillText(initials, canvas.width / 2, artworkY + 315)
    context.font = "700 32px 'Nunito Sans', system-ui, sans-serif"
    context.fillText("Artwork unavailable", canvas.width / 2, artworkY + 390)
    context.textAlign = "left"
  }

  let y = 680
  context.fillStyle = "#1E2A24"
  context.font = "600 76px Lora, Georgia, serif"
  y = wrapText(context, content.title, 72, y, 1056, 82, 2) + 20
  context.fillStyle = "#667068"
  context.font = "700 30px 'Nunito Sans', system-ui, sans-serif"
  context.fillText(content.date, 72, y)
  y += 58

  const facts = [content.duration, content.location ? `At ${content.location}` : null].filter(Boolean) as string[]
  if (facts.length) {
    context.fillStyle = "#315C48"
    context.font = "700 30px 'Nunito Sans', system-ui, sans-serif"
    context.fillText(fitText(context, facts.join("  ·  "), 1056), 72, y)
    y += 56
  }
  if (content.result) {
    context.fillStyle = "#F4EAD7"
    roundedRect(context, 72, y, 1056, 76, 18)
    context.fillStyle = "#81591F"
    context.font = "700 31px 'Nunito Sans', system-ui, sans-serif"
    wrapText(context, content.result, 98, y + 49, 1004, 38, 1)
    y += 106
  }

  const visibleParticipants = content.participants.slice(0, 5)
  if (privacy.includePlayerNames || privacy.includeScores) {
    context.font = "700 28px 'Nunito Sans', system-ui, sans-serif"
    for (const participant of visibleParticipants) {
      context.fillStyle = "#1E2A24"
      context.fillText(fitText(context, participant.label, 820), 78, y)
      if (participant.score !== null) {
        context.textAlign = "right"
        context.fillText(fitText(context, participant.score, 160), 1122, y)
        context.textAlign = "left"
      }
      y += 43
    }
    if (content.participants.length > visibleParticipants.length) {
      context.fillStyle = "#667068"
      context.fillText(`+${content.participants.length - visibleParticipants.length} more`, 78, y)
    }
  }

  try {
    const logo = await loadImage("/branding/shelfpick-logo-light.svg")
    context.drawImage(logo, 72, 1350, 300, 86)
  } catch {
    context.fillStyle = "#315C48"
    context.font = "700 48px 'Nunito Sans', system-ui, sans-serif"
    context.fillText("ShelfPick", 72, 1412)
  }
  context.fillStyle = "#667068"
  context.textAlign = "right"
  context.font = "700 25px 'Nunito Sans', system-ui, sans-serif"
  context.fillText("A play from my shelf", 1128, 1405)

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
