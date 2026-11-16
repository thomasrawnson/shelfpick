# SP-IOS-21B — Legal Pages and Build 3 Preparation

**Status:** PUBLICATION CANDIDATE — OWNER APPROVAL REQUIRED  
**App source baseline:** `bea871438e3b6ecc2cb26b014ca422887080cf53`  
**Website source baseline:** `d8fc296d5f469c29af1f5e1273bf7e3c703274ba`  
**Prepared:** 13 November 2026

This is a private decision and release-preparation record. It is not legal advice, independent legal approval, publication authority, deployment authority or App Store authority.

## Evidence used

- accepted ShelfPick 1.0 (2) implementation and SP-IOS-19 release evidence;
- current `privacy-notice-draft.md`, `terms-draft.md`, retention procedure and production runbook;
- SP-IOS-21A consolidated compliance report and owner decision sheet;
- owner-supplied company identity, 13+ decision, 4+ content rating and disabled-feature boundaries; and
- current official ICO, Apple, Render, Resend and BoardGameGeek materials recorded in SP-IOS-21A/21B research.

No files or Git records named SP-IOS-16A, SP-IOS-16B or SP-IOS-18C were found in the approved source, available worktrees, Git history or local release-evidence tree. SP-IOS-21A's explicit reconciliation therefore remains the controlling record for those subjects; this report does not invent missing approvals.

## Public-page candidate

The exact publication candidate is in the isolated website worktree `/private/tmp/pluto-site-sp-ios-21b` on local branch `codex/sp-ios-21b-website`:

- `src/pages/shelfpick/privacy.astro`
- `src/pages/shelfpick/terms.astro`
- `src/styles/shelfpick-legal.css`
- ShelfPick landing and support links in `src/pages/shelfpick/index.astro` and `src/pages/shelfpick/support.astro`

Approval hashes for the three new public-page files:

- Privacy Policy: `5c69c179f9e3d26bfe50009e179242811a1e009deb575133e604fc4d73dcbaae`
- Terms of Use: `7af3e0e64912b7b9714facf85f06ec80a9584a8a062f0340f8a7b1886802f4d3`
- Shared legal-page CSS: `905534cb2cae87b118ef79b438faf4e4003e09639b23cffb65f26c8d339d3c80`

The pages identify Pluto Night Labs Ltd, company number `17485329`, registered office `128 City Road, London, EC1V 2NX, United Kingdom`, and `hello@plutonightlabs.com`. They preserve the separate studio-wide `/privacy/` page.

The public text states the current product boundary: Free-only; 13+ accounts; 4+ content rating; no date-of-birth collection; no phone/QR voting; no Pro purchases; no connected client analytics/crash provider; and rights-safe cover-free exports. It describes actual account, collection, preference, player, play, recommendation, operational-log and provider handling.

Retention wording deliberately matches implementation instead of the older aspirational schedule: account data until deletion; Render application logs seven days; Resend email/log data 30 days; HMAC abuse-row cleanup on a later write after 24 hours; expired token hashes without scheduled cleanup; and three-day database point-in-time recovery.

## Residual legal uncertainty accepted for owner decision

No independent lawyer has reviewed the candidate. The owner has stated there is no budget for external review and wishes to proceed using internal research. Approval should therefore explicitly accept these residual risks:

1. the selected lawful bases — contract for the requested account/service, legitimate interests for security/reliability/improvement, and legal obligation/legitimate interests for rights records — have not been independently tested;
2. Render, Resend and BoardGameGeek contracting roles, subprocessors and UK transfer mechanisms have not been independently verified end to end;
3. a 13+ self-declaration is not strong age assurance and does not itself decide whether the Children's Code applies to a service likely to be accessed by under-18s;
4. on-write rather than scheduled cleanup leaves no guaranteed deletion time for some security/token rows;
5. BGG/CDN technical request collection may affect the final App Privacy declaration beyond the conservative six-type matrix; and
6. the consumer-liability, suspension, governing-law and change clauses are cautious internal drafting, not counsel-approved conclusions.

These risks must remain in the private release record. They are intentionally absent from the user-facing pages because the pages describe the service and user rights rather than the provenance of drafting advice.

## Smallest safe build 3 plan

Build 3 must not start until the owner approves the exact page text and separately authorises publication/deployment.

1. Review the website diff and captured light/dark mobile/desktop pages.
2. Record owner approval of the exact Privacy Policy and Terms candidate.
3. Separately authorise Git integration and deployment of the website candidate. Verify both public URLs return HTTP 200 without authentication, use the correct canonical URLs, and remain linked from ShelfPick landing/support.
4. Confirm App Store Connect build number 3 remains unused.
5. Create a new clean isolated ShelfPick worktree at `bea871438e3b6ecc2cb26b014ca422887080cf53`, unless the owner separately approves a newer immutable source SHA.
6. Build the packaged frontend with:
   - `VITE_API_BASE_URL=https://board-game-picker-api.onrender.com`
   - `VITE_LEGAL_DRAFTS_ENABLED=false`
   - `VITE_PUBLIC_LEGAL_LINKS_ENABLED=true`
7. Run the existing frontend tests, lint, production build, PWA check, iOS API-origin check and Capacitor sync. Confirm the built Settings/About surface contains only the two approved public legal URLs and no draft routes.
8. Use `frontend/scripts/prepare-ios-company.mjs` to create a temporary company project. Do not edit the checked-in prototype identity.
9. In the staged project only, build/archive with `MARKETING_VERSION=1.0`, `CURRENT_PROJECT_VERSION=3`, team `9CDNVY8UKQ`, bundle `com.plutonightlabs.shelfpick`, iPhone-only targeting, portrait orientation and iOS 15 minimum.
10. Reuse the existing Apple Distribution identity and ShelfPick App Store profile. Stop on any new certificate, profile repair, account, fee or identifier requirement.
11. Validate signature, entitlements, privacy manifests, version/build, production API origin, legal URLs and unchanged Free-only/13+/phone-voting/Pro/export-artwork safeguards.
12. Export one IPA locally. Upload, TestFlight assignment and App Store submission remain separately authorised actions.

No application-code change is required to expose the links: `public-legal-links.ts`, `vite.config.ts` and the existing focused test already implement the fail-closed build flag and exact URLs. Build 3 is a new binary because Vite embeds the flag at build time.

## Safeguards that must remain unchanged

- `VITE_LEGAL_DRAFTS_ENABLED=false`
- `GAME_NIGHT_PHONE_VOTING_ENABLED=false`
- `EXPORT_COVER_ARTWORK_ENABLED=false`
- no Pro purchasing or public paid entitlement
- no registration-age or date-of-birth change
- no schema, entitlement, recommendation or production configuration change

`PUBLIC_REGISTRATION_ENABLED` is a separate production launch decision and must not be changed as a side effect of building the binary.

## Local verification completed

- Astro type/build: 29 files, zero errors/warnings/hints; 19 static pages built, including both legal routes.
- ShelfPick browser QA: 16 light/dark cases at 320, 390 and 1440 widths; zero failures for overflow, contrast, focus, headings, metadata, canonical URLs, internal links, images, forms and console errors.
- Full website prelaunch regression: zero failures, including reduced motion, internal links, provider-request guard and existing route assertions.
- Focused ShelfPick legal-link configuration test: 1 passed; approved URLs appear only when the public build flag is true and draft routes remain absent.
- Placeholder/contradiction scan and `git diff --check`: passed.
- No backend, native archive, Simulator, physical-device, production or App Store test was run or required by this preparation milestone.

## Consolidated publication-approval request

The owner is asked to approve, in one decision:

> I approve the exact ShelfPick Privacy Policy and Terms candidates in `/private/tmp/pluto-site-sp-ios-21b`, acknowledge that they were prepared from internal research without independent legal review, accept the six residual risks recorded above, confirm that `hello@plutonightlabs.com` will be monitored for support, rights requests and data-protection complaints, and authorise a separate publication/integration milestone. This approval does not authorise deployment, build 3, Apple upload or App Store submission.

After that approval, the next separately authorised action is website integration and publication. Only after both URLs are verified live should build 3 be created.
