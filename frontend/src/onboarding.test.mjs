import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

let server
let OnboardingView
let ProfileSettings
let PlayerAvatar

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: "custom" })
  OnboardingView = (await server.ssrLoadModule("/src/components/OnboardingView.tsx")).default
  ProfileSettings = (await server.ssrLoadModule("/src/components/ProfileSettings.tsx")).default
  PlayerAvatar = (await server.ssrLoadModule("/src/components/ui/PlayerAvatar.tsx")).default
})

after(async () => { await server?.close() })

test("first run opens with a short welcome and no paywall", () => {
  const markup = renderToStaticMarkup(React.createElement(OnboardingView, {
    displayName: "Morgan", onComplete: () => {},
  }))
  assert.match(markup, /Spend less time choosing. Spend more time playing./)
  assert.match(markup, /Step 1 of 4/)
  assert.match(markup, /Get started/)
  assert.doesNotMatch(markup, /paywall|Unlock Pro/i)
})

test("profile shows the saved identity and preferences", () => {
  const user = {
    id: 1, email: "morgan@example.com", display_name: "Morgan", bgg_username: null,
    email_verified: false, tier: "FREE", entitlements: [], onboarding_completed: true,
    preferred_player_count: 3, preferred_play_time: 90,
    preferred_play_style: "competitive", profile_player_id: 8,
    player_name: "Morgan Reed", avatar_key: "gold",
  }
  const markup = renderToStaticMarkup(React.createElement(ProfileSettings, {
    user, onChange: () => {},
  }))
  assert.match(markup, /value="Morgan Reed"/)
  assert.match(markup, /gold avatar" aria-pressed="true"/)
  assert.match(markup, /Save profile/)
})

test("avatar uses initials without an uploaded image", () => {
  const markup = renderToStaticMarkup(React.createElement(PlayerAvatar, {
    name: "Morgan Reed", variant: "forest",
  }))
  assert.match(markup, /player-avatar-forest/)
  assert.match(markup, />MR<\/span>/)
})
