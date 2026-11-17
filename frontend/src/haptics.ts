import { Capacitor } from "@capacitor/core"
import { Haptics, ImpactStyle } from "@capacitor/haptics"

export type HapticsDeps = {
  isNative: () => boolean
  impact: () => Promise<void>
}

// Pure factory so the behaviour can be unit-tested with a mock plugin.
export function createLightHaptic(deps: HapticsDeps): () => Promise<void> {
  return async () => {
    if (!deps.isNative()) return
    try {
      await deps.impact()
    } catch {
      // Haptics are decoration; never let them break an interaction.
    }
  }
}

// Light impact. Does nothing on the web / PWA.
export const lightImpact = createLightHaptic({
  isNative: () => Capacitor.isNativePlatform(),
  impact: () => Haptics.impact({ style: ImpactStyle.Light }),
})
