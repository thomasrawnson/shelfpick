import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

let server
let telemetry
let AppErrorBoundary

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" })
  telemetry = await server.ssrLoadModule("/src/telemetry.ts")
  AppErrorBoundary = (await server.ssrLoadModule("/src/components/AppErrorBoundary.tsx")).default
})

after(async () => {
  telemetry?.setErrorSink(null)
  await server?.close()
})

test("render failures show a safe fallback and capture only a failure area", () => {
  const failures = []
  telemetry.setErrorSink(event => failures.push(event))
  const boundary = new AppErrorBoundary({ children: React.createElement("p", null, "Normal screen") })
  assert.match(renderToStaticMarkup(boundary.render()), /Normal screen/)
  boundary.state = AppErrorBoundary.getDerivedStateFromError()
  const fallback = renderToStaticMarkup(boundary.render())
  assert.match(fallback, /Something went wrong/)
  assert.match(fallback, /Reload ShelfPick/)
  assert.doesNotMatch(fallback, /stack|private@example.com/i)
  boundary.componentDidCatch(new Error("private@example.com"), { componentStack: "private@example.com" })
  assert.deepEqual(failures, [{ area: "react_render" }])
  telemetry.setErrorSink(null)
})
