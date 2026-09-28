import type {
  DiscoverMode,
  DiscoverPersonalisationSignal,
  DiscoverPersonalisationStatus,
} from "./api/client"


export function discoverEmptyCopy(
  mode: DiscoverMode,
  dismissed = false,
) {
  if (dismissed) {
    return {
      title: "You've cleared this list",
      body: "Reload the list to bring those games back.",
      actionLabel: "Reload list",
      actionMode: mode,
    }
  }

  if (mode === "for_you") {
    return {
      title: "No personalised matches yet",
      body: "No unowned games match the signals available right now. Hot may have more ideas.",
      actionLabel: "Browse Hot",
      actionMode: "hot" as const,
    }
  }

  return {
    title: "No new games to show right now",
    body: mode === "hot"
      ? "No unowned Hot games are available right now. Top 100 may have more ideas."
      : "No unowned Top 100 games are available right now. Hot may have something different.",
    actionLabel: mode === "hot" ? "Browse Top 100" : "Browse Hot",
    actionMode: mode === "hot" ? "top100" as const : "hot" as const,
  }
}


export function discoverPersonalisationCopy(
  status: DiscoverPersonalisationStatus,
  signals: DiscoverPersonalisationSignal[],
) {
  if (status === "popular_fallback") {
    return {
      title: "Popular picks to get you started",
      body: "ShelfPick doesn’t have a matching shelf, play or preference signal yet, so these games come from BoardGameGeek Hot and ranked lists.",
      actionLabel: "Set play preferences",
    }
  }

  if (status !== "personalised") return null

  const sources = [
    signals.includes("collection") ? "games on your Owned shelf" : null,
    signals.includes("play_history") ? "your recorded plays" : null,
    signals.includes("preferences") ? "your saved play preferences" : null,
    signals.includes("rankings") ? "your personal ShelfPick rankings" : null,
  ].filter((source): source is string => source !== null)

  let body = "These matches use your ShelfPick signals."
  if (sources.length === 1) body = `These matches use ${sources[0]}.`
  if (sources.length === 2) body = `These matches use ${sources[0]} and ${sources[1]}.`
  if (sources.length > 2) {
    body = `These matches use ${sources.slice(0, -1).join(", ")}, and ${sources[sources.length - 1]}.`
  }

  return { title: "Picked for how you play", body, actionLabel: null }
}
