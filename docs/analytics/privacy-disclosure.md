# Analytics privacy disclosure (SP-ANL-001)

Draft for the owner. Not legal advice. Checked 2026-11-17 against Apple's App Privacy Details page (developer.apple.com/app-store/app-privacy-details). Nothing here is entered in App Store Connect or published; the owner does that.

## What is collected

Anonymous events listed in `tracking-plan.md`, sent to PostHog EU Cloud (`eu.i.posthog.com`). Each carries a random ID that PostHog generates and stores in the app's local storage (no cookies), the event name, the listed properties, `environment`, `platform`, `app_version`, and standard SDK device context (OS and version, device model, browser/WebView, language, timezone, screen size). No email, name, account ID, typed text, game names, or IDFA. No `identify` call; person profiles are off. PostHog's server may derive approximate location from the IP address: enable **Discard client IP data** in the PostHog project settings (owner action, not done here).

## App Store privacy label

| Apple data type | Collected? | Linked to user? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Usage Data > Product Interaction ("app launches, taps, clicks ... how the user interacts with the app") | Yes | No (no account or identity is attached) | No | Analytics |
| Identifiers > Device ID ("advertising identifier, or other device-level ID") | Yes: the random PostHog ID is a device-level ID | See note | No | Analytics |
| Diagnostics (Other Diagnostic Data) | Arguably: app build and OS/device model sent as event context. Not crash or performance data | No | No | Analytics |

Not used for tracking: no data is combined with third-party data for advertising or shared with a data broker, and there is no IDFA or ATT prompt.

**Note and owner decision.** The expected "Product Interaction only, not linked" answer is incomplete: the random ID is a device-level ID, and Apple treats data tied to a device as linked unless it is de-identified before collection. The conservative label is Product Interaction plus Device ID, both for Analytics. Whether Device ID is "linked" is the owner's call; declaring it linked is safest if unsure. Add these rows to the existing label (which already covers account data) and update `PRIVACY.md` once decided.

## Privacy policy paragraph

> **Anonymous usage analytics.** ShelfPick uses PostHog, hosted in the European Union (PostHog EU Cloud), as a processor to count which features are used, for example finishing onboarding or running the Picker. Events carry a random identifier stored on your device, the app version and basic device information such as operating system. They never include your name, email address, account details, search text, notes or game names, and we do not use them for advertising or share them with data brokers. You can turn this off at any time in Settings > About > "Share anonymous usage analytics"; when it is off nothing is sent.

The privacy policy is hosted separately (https://plutonightlabs.com/shelfpick/privacy/); the owner publishes this wording there. A contract (DPA) with PostHog and the UK/EU transfer position have not been verified.
