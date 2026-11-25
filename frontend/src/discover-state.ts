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
      ? "No unowned Hot games are available right now. Check again later for new ideas."
      : "No unowned Top 100 games are available right now. Hot may have something different.",
    actionLabel: mode === "hot" ? "Reload list" : "Browse Hot",
    actionMode: "hot" as const,
  }
}


export function discoverPersonalisationCopy(
  status: DiscoverPersonalisationStatus,
  signals: DiscoverPersonalisationSignal[],
) {
  if (status === "popular_fallback") {
    return {
      title: "Popular picks to get you started",
      body: "Log a few plays or set your preferences and these will start to fit you. Until then, they’re popular on BoardGameGeek.",
      detail: [] as string[],
      actionLabel: "Set play preferences",
    }
  }

  if (status !== "personalised") return null

  const sources = [
    signals.includes("collection") ? "your shelf" : null,
    signals.includes("play_history") ? "the games you’ve played" : null,
    signals.includes("preferences") ? "your play preferences" : null,
    signals.includes("rankings") ? "your rankings" : null,
  ].filter((source): source is string => source !== null)

  let body = "Based on what ShelfPick knows about you."
  if (sources.length === 1) body = `Based on ${sources[0]}.`
  if (sources.length === 2) body = `Based on ${sources[0]} and ${sources[1]}.`
  if (sources.length > 2) {
    body = `Based on ${sources.slice(0, -1).join(", ")}, and ${sources[sources.length - 1]}.`
  }

  const detail = [
    signals.includes("collection")
      ? signals.includes("play_history")
        ? "Themes and mechanics of the games on your shelf, counting the ones you play most more"
        : "Themes and mechanics of the games on your shelf"
      : null,
    signals.includes("rankings") ? "Games like the ones you rank highest" : null,
    signals.includes("preferences") ? "Your usual player count and session length" : null,
  ].filter((line): line is string => line !== null)

  return { title: "Picked for you", body, detail, actionLabel: null }
}
