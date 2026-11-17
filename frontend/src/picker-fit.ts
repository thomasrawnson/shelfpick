// Plain-language label for the 0–100 Picker score. The score ranks games
// against tonight's choices; it is not a prediction, so the words stay modest.
export const FIT_SCALE = [
  { min: 85, label: "Great fit" },
  { min: 65, label: "Good fit" },
  { min: 0, label: "Worth a look" },
] as const

export function fitLabel(score: number): string {
  const rounded = Math.round(score)
  return (FIT_SCALE.find((band) => rounded >= band.min) ?? FIT_SCALE[FIT_SCALE.length - 1]).label
}

export const FIT_SCALE_NOTE =
  "Fit compares your shelf against tonight's players, time and preferences on a 0–100 scale: Great fit 85+, Good fit 65–84, Worth a look below 65."
