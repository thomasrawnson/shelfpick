# SP-IOS-09A — reviewer access and feature screenshot gate

**State:** BLOCKED before live account creation. No reviewer identity or sample record was created on Render; no registration, production configuration or entitlement was changed. Feature screenshots: **0/6**. This document is a concrete procedure for owner review, not evidence that the account exists.

## Dedicated identity and exact production gate

- Proposed identity: **ShelfPick App Review**, a dedicated company-controlled mailbox or alias, with its address and inbox access kept in the owner's password manager. The address is **not selected, created or verified** in this milestone. It must not be an owner's personal account or a disposable mailbox that expires during review.
- The [production runbook](production-runbook.md#private-beta-invitation-operator-procedure) says private registration accepts only exact addresses in server-only `BETA_INVITE_EMAILS`. Adding a new address changes Render configuration and requires redeploying the approved commit. SP-IOS-09A expressly excludes that change. Therefore the reviewer mailbox must **already be active and allowlisted** to proceed within this scope. If it is not, the account and screenshots remain blocked pending a separately authorised invitation/configuration milestone. A generic registration response cannot prove invitation status.
- Even if an eligible mailbox exists, **separate explicit owner authorisation** is required before submitting its registration form or creating the sample Collection, Plays and preferences on live Render. The owner should enter and retain the unique random password and verification email directly; no credentials, tokens, verification links or private address go into Git, chat, screenshots or logs.
- Once authorised, use normal invite-only registration and email verification, complete onboarding as “Review Player”, confirm `FREE` and only `game_night_basic` entitlement, and sign in using the existing company application. Do not grant Pro or change the API's access rules. Keep the mailbox and account available through review/appeal; rotate password and revoke sessions after the review window closes, then update private App Store Connect credentials. Full deletion testing uses a separate disposable account.

## Smallest synthetic data set after authorisation

| Area | Proposed account-owned data | Verification |
| --- | --- | --- |
| Profile | “Review Player”; approved stock avatar; 2 players, 60 minutes, Either play style | Settings/Profile and Picker defaults match |
| Collection | 3–5 catalogue games with varied player counts and durations, added through the normal UI | Overview, search and game detail work; any visible art is approved for screenshot use or the existing branded fallback |
| Plays | 2–3 manual plays across at least two collection games, with synthetic dates and no location, scores or real participant names | Plays/history and individual game history show records |
| Picker | Use the sample Collection and normal Free criteria; record the visible explanation | Recommendation is genuine API output, with no Pro override |
| Game Night | Build a basic shortlist and select the host's game | Phone/QR voting is unavailable to all tiers in this V1 candidate |

The source of truth for Free access is `backend/services/entitlements.py`; the frontend gates `game_night_basic` for the basic flow. The retained `game_night_enhanced` entitlement does not override the SP-IOS-14E-B server availability gate, which blocks phone voting for all tiers in V1. The final six-image order and captions are in [SP-IOS-09](SP-IOS-09-REVIEW-EXPERIENCE.md). Capture at 1320 × 2868 opaque portrait PNG from the approved company candidate, after checking the specific games for artwork rights. Inspect every frame for account email, notification, real name, credentials and unapproved cover images before retaining it. Provide the reviewer password only through App Store Connect's private review information after final account verification, never in a public listing or repository file.

## Cold launch investigation

The existing production-targeted company build on the disposable 6.9-inch iOS 27.2 simulator was terminated and launched after a simulator reboot. A second local recording captured the actual transition: Home Screen → [black frame](screenshots/sp-ios-09a/cold-launch-dark-frame.png) → [stable logged-out UI](screenshots/sp-ios-09a/stable-login.png). Both diagnostic images are 1320 × 2868 PNGs; the stable simulator screenshot retains an alpha channel and is **not** an App Store asset. The video was recorded locally at `/private/tmp/sp-ios-09a-cold-launch-2.mov`; it contains only the simulator. The dark interval recurred, but the frames do not prove whether iOS omitted the launch storyboard or the WebView remained unpainted after it. The signed physical app was not tested here. No startup code or asset was changed without an established root cause.

## Validation and remaining work

- Read-only code and runbook inspection verified the invite gate, Free/Pro boundary and screenshot sequence. No frontend, native, backend or configuration source changed in SP-IOS-09A, so SP-IOS-09's 98-test/web/PWA/native build results remain prior evidence, **not rerun tests**. `git diff --check` and the captured frame dimensions were checked locally.
- Before final screenshots: owner supplies an eligible company-controlled mailbox and authorises **that account's registration, verification and account-owned sample writes**. If the mailbox is not already allowlisted, request a separate production invitation change rather than silently modifying Render.
- After account provisioning: verify all Free journeys on the company app, capture and inspect 6/6 genuine feature screens, confirm App Store metadata and artwork rights, then stop for owner visual approval. Privacy policy, App Review credentials, distribution signing and submission remain separate gates.

No commit, push, merge, TestFlight, App Store Connect action or production deployment occurred.
