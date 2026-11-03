# SP-LAUNCH-03 owner decision sheet

**For owner and qualified UK legal/privacy review — not approved for publication.**

## Verified boundary

- Reviewed against merged release commit `7855f01a7504f074ec582911a5cf4f37e859e942` (PR #6; implementation head `15443d8aa62e75be6699a102787f5491845a6864`). Exact-merge push CI [run 41684750000](https://github.com/thomasrawnson/shelfpick/actions/runs/41684750000) completed successfully.
- Fail-closed Privacy and Terms draft routes are prepared for isolated review. They are absent from the default production bundle while `VITE_LEGAL_DRAFTS_ENABLED=false`; they are not approved policies.
- Public registration and cover artwork in exported share images remain disabled in `render.yaml`. In-app BGG-hosted cover display remains enabled.

## Owner decisions

Fill every blank; do not treat the suggested legal bases as approved.

| ID | Decision required | Owner response / evidence |
|---|---|---|
| O1 | Controller/service-provider legal name, trading name, legal form, postal address and registration number (if applicable) | **Pluto Night Labs Ltd / ShelfPick confirmed; registered number and postal address outstanding** |
| O2 | Monitored privacy address and monitored support address; name the responsible owner and escalation route | **hello@plutonightlabs.com proposed; monitoring owner/escalation outstanding** |
| O3 | Launch territories, intended audience and minimum age; whether under-18 access is likely | **UK-first and proposed 13+; qualified legal/Children's Code review outstanding** |
| O4 | Lawful basis per purpose: account/service delivery; BGG import/display; transactional email; security/abuse prevention; support/privacy requests; and optional guest names/ballots | **[QUALIFIED LEGAL REVIEW]** |
| O5 | If legitimate interests are used, approve and retain each legitimate-interests assessment | **[QUALIFIED LEGAL REVIEW]** |
| O6 | Exact retention periods below, deletion cadence and backup ageing; confirm whether old one-time-token rows need scheduled deletion | **All seven periods provisionally owner-approved; legal review, implementation and scheduling outstanding** |
| O7 | Rights-request intake, identity verification, secure export delivery, request log and working-file deletion period; complete one rehearsal | **[OWNER TO APPROVE]** |
| O8 | Terms: governing law/jurisdiction, eligible age, acceptable use/enforcement, suspension/termination, IP, availability, liability, consumer rights, disputes and change notices | **[QUALIFIED LEGAL REVIEW]** |
| O9 | BGG application/licence classification and cover-artwork boundary | **Commercial XML API application approved; linked logo required; future fee possible but none specified; cover-image rights remain separate and exported covers stay disabled** |

Placeholder crosswalk: Privacy Notice → O1, O2, O4–O7; Terms → O1–O3 and O8; retention/request procedure → O2, O6 and O7; BGG request → O9. No bracketed legal/privacy decision is outside this register.

### O6 retention schedule to approve

| Record | Implemented behaviour | Approved period / change |
|---|---|---|
| Active/inactive account and owned data | Live until account deletion; inactivity cannot be measured reliably yet | **24 months provisional; no cleanup authorised** |
| Game Night host, guest names, hashed credentials and ballots | Access expires after 12 hours; opt-in batched cleanup foundation is disabled/unscheduled | **30 days after expiry** |
| Verification/reset token hashes | New active token replaces the prior active token; opt-in batched cleanup foundation is disabled/unscheduled | **7 days after expiry** |
| Auth-abuse HMAC keys/counters | Stale rows older than 24 hours are removed on a later auth write, not at a guaranteed deadline | Hard maximum/maintenance: **[TBD]** |
| Application/request/email logs | Request ID, method, redacted path, status and duration; production email log omits recipient and retains Resend message ID | **30 days** |
| Independent backups/exports | Provider configuration not yet approved/provisioned | **30 days; restore reconciliation outstanding** |
| Support/privacy case records and exports | Process not yet operated | **Resolved cases 12 months; temporary exports 7 days** |
| Browser bearer/guest credentials | Browser `localStorage` until logout/removal or application replacement | User/device guidance: **[TBD]** |

## Processor and transfer evidence

Before publication, record the exact contracting entity, role, data fields, purpose, hosting/processing regions, retention/deletion, subprocessors, written terms/DPA and any UK restricted-transfer mechanism for:

- Render (web hosting, PostgreSQL and logs; blueprint currently selects Frankfurt);
- Resend (verification/reset recipient, message content and delivery metadata);
- BoardGameGeek (public username, collection/game queries, application token, BGG-hosted image delivery); and
- any later monitoring, analytics, support or backup service. None is currently approved by this sheet.

GitHub and any preview host belong in the internal supplier inventory; real user/production data must not be placed in previews. Qualified advice must decide BGG's data-protection role and whether any transfer is restricted. ICO guidance requires privacy information to cover identity/contact, purposes and bases, retention, rights/complaints and, where applicable, recipients/transfers and legitimate interests: [privacy information](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/), [processor contracts](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts/) and [international transfers](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-guide-to-international-transfers/).

## Qualified-review questions

Obtain UK privacy/legal advice on O3–O5 and O8, controller/processor roles, international transfers, privacy-right wording/exceptions/deadlines, backup disclosure, and whether the service is likely to be accessed by children. Do not infer that choosing age 13 resolves UK children's-data duties; review the ICO's [children and UK GDPR](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/children-and-the-uk-gdpr/) and [Children's Code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/introduction-to-the-childrens-code/).

## Launch clearance

- [x] Technical release SHA and exact push CI verified.
- [x] Free-only positioning, disabled public registration and disabled exported-cover artwork verified in source.
- [ ] O1–O9 completed; retention schedule and processor evidence approved.
- [ ] Privacy notice and Terms revised, qualified-review outcome recorded, and owner approves exact publication text.
- [x] BGG commercial XML API application approval and linked-logo requirement recorded; cover-image rights remain separate.
- [x] Draft legal routes implemented behind a fail-closed build gate; legal and owner approval is still required before publication.
- [ ] Deployment, registration activation and production operations receive separate approval.

**Smallest next action:** owner supplies the registered company number/address and sends this sheet plus both legal drafts to a qualified UK privacy/legal reviewer; do not enable the routes or cleanup routine.
