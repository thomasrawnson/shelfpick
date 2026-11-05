import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.shelfpick.prototype",
  appName: "ShelfPick Prototype",
  webDir: "dist",
  ios: {
    zoomEnabled: true,
  },
  plugins: {
    CapacitorHttp: { enabled: true },
  },
}

export default config
