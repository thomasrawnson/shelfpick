# SP-PRO-01: App Review notes and App Store Connect checklist for 1.2

Date: 19 November 2026. Status: **draft for the owner to paste and tick off. Nothing here has been entered in App Store Connect.**
Facts below were checked against `main` at 36d31c7 (build 1.2 (18)) and the live API on 19 November 2026. Do not put reviewer credentials in this repository; keep them in the owner's password manager and in the App Store Connect notes field only.

## 1. Text for the App Review "Notes" field

Paste, then replace the two bracketed lines with a real reviewer account. Delete the brackets before submitting.

> ShelfPick 1.2 adds an optional paid upgrade, ShelfPick Pro, sold with two in-app purchases: Pro Yearly (auto-renewing subscription) and Pro Lifetime (one-time purchase). Everything in the app that was free in 1.0 and 1.1 is still free.
>
> Sign in: [reviewer email] / [reviewer password]. [This account is on the Free plan with sample games and plays.] A ShelfPick account is required because a purchase is attached to the account. Public registration is open (13+, email verification) if you prefer to create your own.
>
> To reach the paywall: open the Discover tab and tap "Compare Free and Pro" (the same link is on the Game Night screen). The Pro page lists what Pro unlocks and shows Pro Yearly and Pro Lifetime with the price from the App Store, a "Restore purchases" button, and links to the Terms of Use and Privacy Policy. In Settings, a Free account also shows an "Unlock ShelfPick Pro" card at the top.
>
> To buy: choose a plan on the Pro page and confirm in the App Store sheet with a sandbox Apple Account. After the purchase, Settings > Profile shows PRO and "Plan: ShelfPick Pro". Once Pro, Settings has a "ShelfPick Pro" group with "Your Pro plan", which opens the same page for Restore purchases and managing the subscription.
>
> Server-side check: the app does not unlock Pro by itself. After a purchase our server verifies it with RevenueCat (our purchase-verification provider) and then returns the Pro entitlement. Sandbox purchases made during review are accepted and grant Pro on the account that made them.
>
> Account deletion is in Settings > Profile. It removes the ShelfPick account and its purchase record; it does not cancel an App Store subscription, which is cancelled in the iPhone's Apple Account settings (the Terms and Privacy Policy say so).
>
> Pro unlocks: deeper play statistics (records, head-to-head, filters), Help my H-index in the Picker, custom scoresheets, For You suggestions and the live game timer.

### 1b. Added for the Tip jar build (SP-SETTINGS-01b)

Add this paragraph to the same Notes field when the build with the Tip jar is submitted:

> Settings > Support ShelfPick > Tip jar offers three optional one-time tips (Coffee, Pint, Game night) as consumable in-app purchases, with the price from the App Store. A tip unlocks nothing and is separate from ShelfPick Pro; the account stays on its current plan. The row appears once the tips have loaded from the App Store. To test: open Settings > Tip jar, choose a tip and confirm with a sandbox Apple Account; a thank-you screen and a "Supporter" badge appear on this device. The tip count is stored only on the device.

Also: each tip needs its own review screenshot in App Store Connect (the Tip jar sheet), and the tips are submitted with the version like the Pro products.

## 2. App Store Connect checklist (owner)

1. **In-App Purchases.** Confirm both products exist and are "Ready to Submit": `com.plutonightlabs.shelfpick.pro.yearly` (auto-renewing subscription, 1 year) and `com.plutonightlabs.shelfpick.pro.lifetime` (one-time purchase, check the type in App Store Connect). For each: display name, description, price, availability, and the **review screenshot** (a screenshot of the Pro page showing both plans is enough).
2. **Subscription group.** Name, localisation and Pro Yearly in one group; add the "Manage subscription" terms if prompted.
3. **Attach to the version.** The first in-app purchases are reviewed together with an app version: on the 1.2 version page, add both under "In-App Purchases and Subscriptions", select build 18 and submit them together.
4. **App Privacy.** Add Purchases > Purchase History (linked to the user, App Functionality, not used for tracking). Keep User ID declared. Confirm device identifiers and IP address against RevenueCat's published App Store guidance. `PRIVACY.md` records this.
5. **EULA and Terms link.** Add the Terms of Use and the Apple standard EULA link to the App Description (or enter a custom EULA). The hosted Terms page must show the "ShelfPick Pro" section first; see the legal pages branch `sp-pro-01-legal-pages` in the site repository.
6. **Hosted pages.** Publish the updated Terms and Privacy Policy **before** submitting. As of 19 November 2026 the live Terms still say Pro is not offered.
7. **Reviewer account.** Create a Free reviewer account (public registration is open) and keep its credentials only in the notes field and the password manager.
8. **Release option.** Manual release, as for 1.0, so the pages, IAP state and the backend can be confirmed before customers see Pro.
9. **Backend.** Confirm production has `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_WEBHOOK_AUTH` set and `GET /export-config` returns the expected value (it returned `cover_artwork_enabled: true` on 19 November 2026).

## 3. Tests still to run on TestFlight build 18 before submitting

| Test | How | Done |
| --- | --- | --- |
| Plans load | Discover > Compare Free and Pro | Yes (build 17, 19 Nov) |
| Settings Pro row | Pro account: Settings > Your Pro plan | |
| Restore purchases | Pro page > Restore purchases | |
| Sandbox purchase on TestFlight | Free account, sandbox tester, Pro Yearly then Pro Lifetime | |
| Account deletion | Delete a sandbox Pro account; RevenueCat customer should be gone; no "erasure failed" warning in Render logs | |
| Expiry and refund | Sandbox yearly renews quickly; confirm Pro locks again after expiry or refund | |

Evidence layers: a TestFlight run on a physical iPhone is device evidence; a Simulator run is not. Record which was used.
