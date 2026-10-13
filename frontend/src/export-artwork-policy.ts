import { getExportConfiguration } from "./api/client"

type ConfigurationLoader = typeof getExportConfiguration

export async function resolveExportCoverArtworkPermission(
  loadConfiguration: ConfigurationLoader = getExportConfiguration,
): Promise<boolean> {
  try {
    const configuration = await loadConfiguration()
    return configuration.cover_artwork_enabled === true
  } catch {
    return false
  }
}
