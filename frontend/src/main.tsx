import {
  StrictMode,
} from "react"

import {
  createRoot,
} from "react-dom/client"

import {
  BrowserRouter,
} from "react-router-dom"

import {
  registerSW,
} from "virtual:pwa-register"

import { Capacitor } from "@capacitor/core"

import App
  from "./App.tsx"
import AppErrorBoundary from "./components/AppErrorBoundary.tsx"

import "./index.css"

if (Capacitor.getPlatform() === "ios") {
  document.documentElement.dataset.nativeIos = "true"
  document.querySelector('meta[name="viewport"]')?.setAttribute(
    "content",
    "width=device-width, initial-scale=1.0, viewport-fit=cover",
  )
}


if (!Capacitor.isNativePlatform()) registerSW({
  immediate: true,

  onRegisteredSW(
    _swUrl,
    registration,
  ) {
    if (!registration) {
      return
    }

    window.setInterval(
      () => {
        registration
          .update()
          .catch(
            (error) => {
              console.warn(
                "Service worker update check failed",
                error,
              )
            },
          )
      },
      60 * 60 * 1000,
    )
  },

  onRegisterError(error) {
    console.error(
      "Service worker registration failed",
      error,
    )
  },
})


createRoot(
  document.getElementById(
    "root",
  )!,
).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
)
