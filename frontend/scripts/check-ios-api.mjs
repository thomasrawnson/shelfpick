const value = process.env.VITE_API_BASE_URL?.trim()

if (!value) {
  console.error("Set VITE_API_BASE_URL to the approved HTTPS Render API origin before building iOS.")
  process.exit(1)
}

let url
try {
  url = new URL(value)
} catch {
  console.error("VITE_API_BASE_URL must be a valid HTTPS origin.")
  process.exit(1)
}

if (url.protocol !== "https:" || url.origin !== value.replace(/\/$/, "")) {
  console.error("VITE_API_BASE_URL must be an HTTPS origin without a path, query or fragment.")
  process.exit(1)
}
