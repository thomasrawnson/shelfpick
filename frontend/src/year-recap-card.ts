import type { YearRecap } from "./api/client"
import {
  SHARE_CARD,
  drawPoweredByBgg,
  fillRoundedRect,
  fitShareText,
  loadShareImage,
} from "./share-card"
import { formatHours, monthName, plural, weekdayName } from "./year-recap"

export const YEAR_CARD_SIZE = { width: 1080, height: 1920 } as const
const MARGIN = 72
const SANS = "'Nunito Sans', system-ui, sans-serif"
const SERIF = "Lora, Georgia, serif"

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map(word => word[0]?.toUpperCase()).join("") || "SP"
}

function label(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  context.fillStyle = SHARE_CARD.goldText
  context.font = `800 24px ${SANS}`
  context.fillText(text, x, y)
}

// Initials artwork only: share exports never use cover images or user photos.
function drawTopGames(context: CanvasRenderingContext2D, recap: YearRecap, y: number): number {
  label(context, "TOP GAMES", MARGIN, y)
  const rowHeight = 112
  recap.top_games.slice(0, 3).forEach((game, index) => {
    const top = y + 28 + index * (rowHeight + 14)
    context.fillStyle = SHARE_CARD.forestSoft
    fillRoundedRect(context, MARGIN, top, 936, rowHeight, 22)
    context.fillStyle = SHARE_CARD.forest
    fillRoundedRect(context, MARGIN + 18, top + 18, 76, 76, 16)
    context.fillStyle = SHARE_CARD.surface
    context.textAlign = "center"
    context.font = `600 32px ${SERIF}`
    context.fillText(initials(game.name), MARGIN + 56, top + 66)
    context.textAlign = "left"
    context.fillStyle = SHARE_CARD.ink
    context.font = `600 36px ${SERIF}`
    context.fillText(fitShareText(context, game.name, 600), MARGIN + 116, top + 52)
    context.fillStyle = SHARE_CARD.inkSecondary
    context.font = `700 24px ${SANS}`
    context.fillText(plural(game.play_count, "play"), MARGIN + 116, top + 88)
    context.textAlign = "right"
    context.fillStyle = SHARE_CARD.goldText
    context.font = `600 44px ${SERIF}`
    context.fillText(`#${index + 1}`, MARGIN + 936 - 28, top + 70)
    context.textAlign = "left"
  })
  return y + 28 + Math.min(3, recap.top_games.length) * (rowHeight + 14)
}

function drawMonthBars(context: CanvasRenderingContext2D, recap: YearRecap, y: number) {
  const max = Math.max(...recap.plays_by_month, 1)
  const slot = 936 / 12
  const barHeight = 150
  recap.plays_by_month.forEach((count, index) => {
    const height = Math.max(count > 0 ? 10 : 4, (count / max) * barHeight)
    const isPeak = recap.busiest_month === index + 1
    context.fillStyle = isPeak ? SHARE_CARD.forest : SHARE_CARD.forestSoft
    fillRoundedRect(context, MARGIN + index * slot + 6, y + barHeight - height, slot - 12, height, 8)
    context.fillStyle = SHARE_CARD.inkSecondary
    context.textAlign = "center"
    context.font = `700 20px ${SANS}`
    context.fillText(monthName(index + 1).slice(0, 1), MARGIN + index * slot + slot / 2, y + barHeight + 32)
  })
  context.textAlign = "left"
}

export async function renderYearRecapCard(
  recap: YearRecap,
  includePlayerNames = false,
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = YEAR_CARD_SIZE.width
  canvas.height = YEAR_CARD_SIZE.height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Image generation is unavailable in this browser.")
  try { await document.fonts?.ready } catch { /* Safe local font fallbacks remain. */ }

  context.fillStyle = SHARE_CARD.background
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = SHARE_CARD.forest
  context.fillRect(0, 0, canvas.width, 26)

  label(context, `${recap.year} IN REVIEW`, MARGIN, 120)
  context.fillStyle = SHARE_CARD.ink
  context.font = `600 84px ${SERIF}`
  context.fillText("My year in games", MARGIN, 214)

  const timed = recap.total_duration_minutes === null
    ? "Not recorded"
    : formatHours(recap.total_duration_minutes)
  const metrics: Array<[string, string]> = [
    [String(recap.total_plays), recap.total_plays === 1 ? "PLAY" : "PLAYS"],
    [String(recap.unique_games), recap.unique_games === 1 ? "GAME" : "GAMES"],
    [timed, recap.total_duration_minutes === null ? "PLAY TIME" : recap.duration_plays < recap.total_plays ? `PLAYED · ${recap.duration_plays} TIMED` : "PLAYED"],
  ]
  metrics.forEach(([value, caption], index) => {
    const x = MARGIN + index * 316
    context.fillStyle = SHARE_CARD.ink
    context.font = `600 ${index === 2 ? 52 : 80}px ${SERIF}`
    context.fillText(fitShareText(context, value, 290), x, 360)
    context.fillStyle = SHARE_CARD.inkSecondary
    context.font = `800 22px ${SANS}`
    context.fillText(caption, x, 402)
  })

  let y = drawTopGames(context, recap, 500)

  if (recap.busiest_month) {
    y += 48
    label(context, "BUSIEST MONTH", MARGIN, y)
    context.fillStyle = SHARE_CARD.ink
    context.font = `600 48px ${SERIF}`
    context.fillText(
      `${monthName(recap.busiest_month)} · ${plural(recap.plays_by_month[recap.busiest_month - 1], "play")}`,
      MARGIN, y + 62,
    )
    drawMonthBars(context, recap, y + 96)
    y += 96 + 150 + 32
  }

  const facts: Array<[string, string]> = []
  if (recap.new_games_count > 0) facts.push(["NEW TO ME", plural(recap.new_games_count, "game")])
  if (recap.busiest_weekday) facts.push(["BUSIEST DAY", `${weekdayName(recap.busiest_weekday)}s`])
  if (recap.longest_play) facts.push(["LONGEST PLAY", formatHours(recap.longest_play.duration_minutes)])
  y += 56
  facts.slice(0, 3).forEach(([caption, value], index) => {
    const x = MARGIN + index * 316
    context.fillStyle = SHARE_CARD.inkSecondary
    context.font = `800 20px ${SANS}`
    context.fillText(caption, x, y)
    context.fillStyle = SHARE_CARD.ink
    context.font = `600 36px ${SERIF}`
    context.fillText(fitShareText(context, value, 290), x, y + 50)
  })

  if (includePlayerNames && recap.co_players.length > 0) {
    context.fillStyle = SHARE_CARD.goldSoft
    fillRoundedRect(context, MARGIN, y + 96, 936, 96, 18)
    context.fillStyle = SHARE_CARD.goldText
    context.font = `800 20px ${SANS}`
    context.fillText("PLAYED MOST WITH", MARGIN + 26, y + 132)
    context.fillStyle = SHARE_CARD.ink
    context.font = `600 32px ${SERIF}`
    context.fillText(
      fitShareText(context, recap.co_players.map(player => player.name).join(" · "), 880),
      MARGIN + 26, y + 174,
    )
  }

  context.fillStyle = SHARE_CARD.line
  context.fillRect(MARGIN, 1716, 936, 2)
  try {
    const logo = await loadShareImage("/branding/shelfpick-logo-light.svg")
    context.drawImage(logo, MARGIN, 1750, 258, 74)
  } catch {
    context.fillStyle = SHARE_CARD.forest
    context.font = `700 43px ${SANS}`
    context.fillText("ShelfPick", MARGIN, 1800)
  }
  context.fillStyle = SHARE_CARD.inkSecondary
  context.textAlign = "right"
  context.font = `700 24px ${SANS}`
  context.fillText(`${recap.year} from my shelf`, 1008, 1752)
  await drawPoweredByBgg(context, 1008, 1764)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Couldn't create the PNG.")), "image/png")
  })
}
