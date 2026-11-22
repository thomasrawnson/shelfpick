# SP-SETTINGS-01b: Tip jar goes live

Branch `sp-settings-01b` from `origin/main` 506de60 (SP-HOTFIX-01 merged as #57). Draft PR for owner review. Nothing deployed,
submitted, tagged or merged. No App Store Connect or RevenueCat changes. In-app build number bumped to 24 (version 1.2.1 unchanged;
the release number is an owner choice).

## What changed

| Area | Change |
| --- | --- |
| SDK use | Checked against the current `@revenuecat/purchases-capacitor` docs (Context7) and the installed typings: `getProducts({ productIdentifiers, type: NON_SUBSCRIPTION })` returns `{ products }` with `identifier` and `priceString`; `purchaseStoreProduct({ product })` buys one. Both are added to the plain-object adapter in `billing/store.ts`; no second SDK setup. |
| Store | `ProStore.loadTipProducts` and `purchaseTip` take the account's app user ID and sign the SDK in first, in the same ordered queue as Pro, so a tip is never bought under a previous account. Cancel (code 1, `userCancelled`) and pending (code 20) reuse the Pro mapping; anything else is an error. |
| Tip layer | `createTipLayer` (`tip-jar.ts`) is the real `PurchaseLayer`. Sheet prices are the store's `priceString`. Only products the store returned can be bought. Hard-coded GBP prices exist only in the development store, which is compiled out of release bundles (checked). |
| Product IDs | `TIP_PRODUCTS` in `tip-jar.ts`: `com.plutonightlabs.shelfpick.tip.coffee`, `.tip.pint`, `.tip.gamenight`. Backend `TIP_PRODUCT_IDS`; a backend test fails if they differ. |
| Row | `useTipLayer` shows the row only when `VITE_PURCHASES_ENABLED` is on, a native store exists and the tips have loaded. PWA, purchases off, or a failed load: hidden. If a load fails after the sheet is open, the existing error with Retry shows. |
| Server | `verified_purchase_from_subscriber` ignores any entitlement whose product is a tip (even with a null expiry, same shape as Pro Lifetime, or attached to `pro` by mistake). The webhook skips tip product events without a lookup. Pro results are unchanged when tips sit alongside a real purchase. |
| Docs | PRIVACY.md, terms-draft.md, SP-PRO-01-APP-REVIEW-NOTES.md (new paragraph and screenshot item), production-runbook.md, ROADMAP.md. |

Unchanged: server-verified user-scoped checks and access-time expiry, the plain-object adapter, SP-HOTFIX-01's restore gating and
expiry parsing, schema and migrations. The tip count and badge stay on the device.

## Evidence

| Layer | Result |
| --- | --- |
| Backend | `pytest` 711 passed, 17 skipped on a disposable PostgreSQL (dropped afterwards); `alembic check` clean. New tests fail without the fix (7 of 8 tip API tests checked). |
| Frontend | `npm test` 292/292 (mocked store and SDK: success counts and shows thanks and the badge; cancel and failure leave it unchanged; pending shows the message; non-GBP price strings; nothing buyable without a loaded product; retry after a failed load; account switch during SDK preparation), lint, `tsc -b`, build, `check:pwa`. |
| Release mode | iOS-mode bundles built with purchases on and off pass `fastlane/bundle_flags.rb`; no hard-coded tip prices in either. The native row itself was not exercised (see below). |
| Browser | Playwright (WebKit, iPhone 15, development store): `settings-layout` and `paywall` 21 passed, 1 failed. The failure is the Feedback test, which asserts 1.1 (11) and was already failing on `main`. |
| Simulator / StoreKit | **Not tested.** A StoreKit configuration run needs the Xcode scheme edited and would register a test customer in the production RevenueCat project through the real public key. Left for the physical-device sandbox test. |

## Owner gates

1. Confirm product IDs and prices.
2. Create the three consumables in App Store Connect and RevenueCat; do not attach them to the `pro` entitlement or any offering.
3. Sandbox tip on a physical iPhone: success, cancel, and the account stays Free.
4. Add tips to the hosted Privacy Policy and Terms; add the review-notes paragraph and one review screenshot per tip.
5. Choose the release (1.2.1 build 24 or a new version).
