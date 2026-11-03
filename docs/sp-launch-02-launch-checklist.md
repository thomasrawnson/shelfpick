# SP-LAUNCH-02 launch checklist

## Application candidate

- [ ] Owner reviews this branch and resolves all test failures.
- [ ] Public registration remains `false` in `render.yaml`; activation is a separate deployment decision.
- [ ] Review pre-existing unverified accounts before activation; confirm whether they should be re-verified or removed.
- [ ] Full backend, migration, frontend, PWA, accessibility and dependency gates pass on one clean SHA.
- [ ] Free Picker, Discover, collection, plays and Game Night regression evidence is recorded; Pro still has no purchase/price/checkout.

## Legal and upstream

- [ ] Complete O1–O9 in `docs/sp-launch-03-owner-decision-sheet.md`; this is the authoritative owner decision register.
- [x] Operator direction, public contact and all seven provisional retention periods supplied for legal review.
- [ ] Registered company number/postal address and monitored privacy-request process evidenced.
- [ ] Privacy notice and terms receive qualified review and owner approval before publication.
- [ ] Manual data-request channel and secure delivery method approved and drilled.
- [x] BGG commercial XML API application approval recorded without storing its token; linked attribution preserved.
- [ ] Underlying cover-image display/export rights recorded; exported cover artwork remains disabled.
- [ ] Draft Privacy/Terms routes receive legal and owner approval before their fail-closed production gate can change.

## Operations — not performed by SP-LAUNCH-02

- [ ] Explicit approval for Render provisioning, spend, domains, credentials and deployment.
- [ ] Verify Render's trusted-proxy client address behaviour and auth-limit/mail-quota alerts in the deployed environment.
- [ ] Exact candidate SHA deployed manually; TLS, CORS, CSP/security headers, health, email and BGG flows smoke-tested.
- [ ] Notifications, external uptime probe, mail quota alert, cost controls and incident owner configured.
- [ ] Independent logical export and isolated restore rehearsal prove RPO/RTO and deleted-account handling.
- [ ] Rollback rehearsal completed without reverting the database unsafely.

## Internal release verification

- [ ] Physical iPhone Safari and Android Chrome: registration/verification/reset, install/reopen/offline, collection/import, Picker, play/share, settings deletion and failed-network states.
- [ ] QR Game Night flow across two real devices and background/reopen timer behaviour.
- [ ] VoiceOver and TalkBack critical journeys; keyboard, focus, safe-area and 200% zoom checks.
- [ ] Owner signs off Free-only positioning and remaining documented risks.
