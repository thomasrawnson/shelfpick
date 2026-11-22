import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { after, before, test } from "node:test"
import { createServer } from "vite"

let server
let core

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  core = await server.ssrLoadModule("/src/analytics/core.ts")
})
after(async () => { await server?.close() })

function harness(initial = {}, { unreadable = false, unwritable = false } = {}) {
  const store = new Map(Object.entries(initial))
  const calls = []
  const sdk = {
    init: () => calls.push(["init"]),
    capture: (name, properties) => calls.push(["capture", name, properties]),
    optIn: () => calls.push(["optIn"]),
    optOut: () => calls.push(["optOut"]),
  }
  const analytics = core.createAnalytics({
    sdk,
    storage: {
      getItem: k => { if (unreadable) throw new Error("storage unreadable"); return store.get(k) ?? null },
      setItem: (k, v) => { if (unwritable) throw new Error("storage unwritable"); store.set(k, v) },
    },
    appVersion: "abc1234",
    common: { environment: "dev", platform: "web" },
  })
  return { analytics, calls, store }
}
const captured = calls => calls.filter(c => c[0] === "capture")
const optedIn = () => ({ "shelfpick.analytics.enabled": "on" })

test("a fresh install loads no SDK and sends nothing until the user chooses", () => {
  const { analytics, calls } = harness()
  analytics.start()
  analytics.track("discover_opened", { tab: "hot" })
  assert.deepEqual(calls, [])
  assert.equal(analytics.isEnabled(), false)
  assert.equal(analytics.hasChoice(), false)
})

test("an unreadable preference means off: no SDK, no events", () => {
  const { analytics, calls } = harness(optedIn(), { unreadable: true })
  analytics.start()
  analytics.track("discover_opened", { tab: "hot" })
  assert.deepEqual(calls, [])
  assert.equal(analytics.isEnabled(), false)
  assert.equal(analytics.hasChoice(), false)
})

test("an unrecognised stored value is not consent", () => {
  const { analytics, calls } = harness({ [core.ANALYTICS_PREF_KEY]: "yes" })
  analytics.start()
  assert.deepEqual(calls, [])
  assert.equal(analytics.hasChoice(), false)
})

test("choosing Not now stores the answer, starts nothing and is not asked again", () => {
  const { analytics, calls, store } = harness()
  analytics.setEnabled(false)
  analytics.start()
  analytics.track("picker_completed", { source: "pick", player_count: 3, time_band: "any", result_count: 2 })
  assert.deepEqual(calls, [])
  assert.equal(store.get(core.ANALYTICS_PREF_KEY), "off")
  assert.equal(analytics.hasChoice(), true)
})

test("accepting stores the choice, starts the SDK and records the first launch", () => {
  const { analytics, calls, store } = harness()
  analytics.start()
  assert.deepEqual(calls, [])
  analytics.setEnabled(true)
  assert.equal(store.get(core.ANALYTICS_PREF_KEY), "on")
  assert.deepEqual(calls[0], ["init"])
  assert.deepEqual(captured(calls).map(c => c[1]), ["app_installed", "app_opened", "settings_changed"])
  analytics.track("discover_opened", { tab: "hot" })
  assert.deepEqual(captured(calls).at(-1), ["capture", "discover_opened", { tab: "hot" }])
})

test("an opt-in that cannot be stored starts nothing", () => {
  const { analytics, calls } = harness({}, { unwritable: true })
  analytics.setEnabled(true)
  analytics.track("discover_opened", { tab: "hot" })
  assert.deepEqual(calls, [])
})

test("a stored opt-in starts the SDK at launch", () => {
  const { analytics, calls } = harness(optedIn())
  analytics.start()
  assert.deepEqual(calls[0], ["init"])
  assert.equal(captured(calls).length, 2)
})

test("withdrawing opts the SDK out, persists, and silences every later event", () => {
  const { analytics, calls, store } = harness(optedIn())
  analytics.start()
  const before = captured(calls).length
  analytics.setEnabled(false)
  analytics.track("discover_opened", { tab: "hot" })
  assert.equal(captured(calls).length, before)
  assert.ok(calls.some(c => c[0] === "optOut"))
  assert.equal(store.get(core.ANALYTICS_PREF_KEY), "off")
  analytics.setEnabled(true)
  analytics.track("discover_opened", { tab: "hot" })
  assert.ok(calls.some(c => c[0] === "optIn"))
  assert.deepEqual(captured(calls).at(-1), ["capture", "discover_opened", { tab: "hot" }])
})

test("lifecycle: install on first launch, update when the build changes, opened every launch", () => {
  const first = harness(optedIn())
  first.analytics.start()
  assert.deepEqual(captured(first.calls).map(c => c[1]), ["app_installed", "app_opened"])
  const updated = harness({ ...optedIn(), "shelfpick.analytics.installed-version": "old" })
  updated.analytics.start()
  assert.deepEqual(captured(updated.calls).map(c => c[1]), ["app_updated", "app_opened"])
  const same = harness({ ...optedIn(), "shelfpick.analytics.installed-version": "abc1234" })
  same.analytics.start()
  assert.deepEqual(captured(same.calls).map(c => c[1]), ["app_opened"])
})

test("the guard drops unknown events and properties that are emails, free text or IDs", () => {
  const { analytics, calls } = harness(optedIn())
  analytics.start()
  const n = captured(calls).length
  analytics.track("not_in_the_plan", {})
  analytics.track("discover_opened", { tab: "tom@example.com" })
  analytics.track("discover_opened", { tab: "my favourite game" })
  analytics.track("discover_opened", { tab: "hot", search: "catan" })
  analytics.track("pick_started", { source: "pick", player_count: 4.5, time_band: "any" })
  analytics.track("pick_started", { source: "pick", player_count: 123456, time_band: "any" })
  analytics.track("play_logged", { source: "play_log_form", player_count: 2, has_scores: "yes" })
  assert.equal(captured(calls).length, n)
  analytics.track("play_logged", { source: "play_log_form", player_count: 2, has_scores: true })
  assert.equal(captured(calls).length, n + 1)
})

test("time bands avoid exact duration payloads", () => {
  assert.equal(core.timeBand(null), "any")
  assert.equal(core.timeBand(0), "any")
  assert.equal(core.timeBand(60), "up_to_60")
  assert.equal(core.timeBand(121), "over_120")
})

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry) ? [path] : []
  })
}

test("every event the code sends is in the catalogue, and no code bypasses the wrapper", () => {
  const catalogue = Object.keys(core.EVENT_SPECS)
  const used = new Set()
  for (const file of sourceFiles("src")) {
    const text = readFileSync(file, "utf8")
    for (const match of text.matchAll(/Analytics\.track\(\s*"([a-z_]+)"/g)) used.add(match[1])
    if (!file.includes("src/analytics/")) assert.doesNotMatch(text, /posthog/i, `${file} must use the Analytics wrapper only`)
    assert.doesNotMatch(text, /Analytics\.track\(\s*[^"\s]/, `${file} must pass a literal event name`)
  }
  for (const name of used) assert.ok(catalogue.includes(name), `${name} is sent but not in EVENT_SPECS`)
  // Lifecycle events are emitted inside the wrapper/bootstrap rather than by feature code.
  for (const name of catalogue) {
    assert.ok(used.has(name) || /^app_/.test(name), `${name} is in EVENT_SPECS but never sent`)
  }
})

test("the tracking plan documents exactly the catalogue, with its property names", () => {
  const full = readFileSync("../docs/analytics/tracking-plan.md", "utf8")
  const plan = full.slice(full.indexOf("## Events"), full.indexOf("## Property values"))
  const rows = [...plan.matchAll(/^\| `([a-z_]+)` \|(.*)$/gm)]
  assert.deepEqual(rows.map(r => r[1]).sort(), Object.keys(core.EVENT_SPECS).sort())
  for (const [, name, rest] of rows) {
    for (const prop of Object.keys(core.EVENT_SPECS[name])) {
      assert.ok(rest.includes(`\`${prop}\``), `${name}: property ${prop} missing from the tracking plan`)
    }
  }
})
