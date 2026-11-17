import { expect, test } from "@playwright/test"
import fs from "node:fs"

// SP-UNLOCK-01: real canvas (WebKit) pixel check that exported PNGs carry the
// unmodified official Powered by BGG logo, with cover artwork off.
const SHOTS = "../docs/screenshots/sp-unlock-01"

const PLAY = {
  played_at: "2026-09-28T12:00:00.000Z", duration_minutes: 75, location: null,
  participants: [{ name: "Alex", score: null, is_winner: false }],
}
const RECAP = {
  month: "2026-10", month_label: "October 2026", total_plays: 6, unique_games: 4,
  total_duration_minutes: 275, duration_plays: 4,
  most_played: { bgg_id: 1, name: "Clockwork Market", play_count: 3, image_url: null },
  collage_games: [],
}

for (const kind of ["share-card", "monthly-recap"] as const) {
  test(`${kind} PNG contains the unmodified Powered by BGG logo`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "iPhone 15")
    await page.goto("/login")
    const result = await page.evaluate(async ({ kind, PLAY, RECAP }) => {
      const share = await import(/* @vite-ignore */ "/src/share-card.ts")
      const recapMod = await import(/* @vite-ignore */ "/src/monthly-recap-card.ts")
      const blob = kind === "share-card"
        ? await share.renderPlayShareCard({ name: "Clockwork Market", mechanics: [] }, PLAY, share.DEFAULT_SHARE_PRIVACY, false)
        : await recapMod.renderMonthlyRecapCard(RECAP, false)
      const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src
      })
      const card = await load(URL.createObjectURL(blob))
      const logo = await load("/branding/powered-by-bgg-rgb.svg")
      const width = 230, height = width / (342 / 76), right = 1128, top = 1388
      const x = right - width
      const actual = document.createElement("canvas"); actual.width = 1200; actual.height = 1500
      const actualCtx = actual.getContext("2d")!; actualCtx.drawImage(card, 0, 0)
      const bg = actualCtx.getImageData(x - 6, top + 2, 1, 1).data
      const expected = document.createElement("canvas"); expected.width = 1200; expected.height = 1500
      const expectedCtx = expected.getContext("2d")!
      expectedCtx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`; expectedCtx.fillRect(0, 0, 1200, 1500)
      expectedCtx.drawImage(logo, x, top, width, height)
      const w = Math.round(width), h = Math.round(height)
      const a = actualCtx.getImageData(x, top, w, h).data
      const e = expectedCtx.getImageData(x, top, w, h).data
      let diff = 0
      for (let i = 0; i < a.length; i += 1) diff += Math.abs(a[i] - e[i])
      return { meanDiff: diff / a.length, size: [card.width, card.height], png: await new Promise<string>(resolve => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(blob)
      }) }
    }, { kind, PLAY, RECAP })
    expect(result.size).toEqual([1200, 1500])
    expect(result.meanDiff).toBeLessThan(2)
    fs.writeFileSync(`${SHOTS}/export-${kind}.png`, Buffer.from(result.png.split(",")[1], "base64"))
  })
}
