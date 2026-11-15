import { runLocalAccounts } from "./support"

// Resets local-onboarding@shelfpick.app to a verified account with onboarding
// incomplete and no answers, and clears loopback auth rate-limit buckets so
// consecutive local runs are repeatable. The script refuses anything other
// than APP_ENV=development on an allowed loopback PostgreSQL database.
export default function globalSetup() {
  console.log(runLocalAccounts("setup", "--reset-loopback-rate-limits"))
}
