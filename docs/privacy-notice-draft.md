# ShelfPick privacy notice — DRAFT FOR OWNER AND LEGAL REVIEW

**Not approved for publication.** Bracketed items require owner decisions or qualified legal advice. This draft describes application behaviour as of SP-LAUNCH-02 and does not claim UK GDPR compliance.

## Who is responsible

Proposed data controller/service operator: **Pluto Night Labs Ltd**, trading through the product **ShelfPick**. **[OWNER TO PROVIDE REGISTERED COMPANY NUMBER AND POSTAL ADDRESS.]**

Proposed public privacy/support contact: **hello@plutonightlabs.com**. **[OWNER TO CONFIRM MONITORING, RESPONSIBLE PERSON AND ESCALATION PROCESS.]**

The proposed launch is UK-first and Free-only. The proposed minimum age is 13+, subject to qualified legal and Children's Code review; this draft does not conclude that age 13 resolves children's-data duties.

## Data ShelfPick handles

- Account: email address, password hash, display name, verification state, account tier, optional BoardGameGeek username and preferences.
- Shelf and activity: owned/wishlisted games, plays, dates, duration, optional location, participant names and scores, rankings/comparisons, Picker criteria/events and recommendations, live-timer drafts and hosted Game Night candidate lists/sessions.
- Guest voting: guest display name, hashed guest credential and ballot within the host's expiring session.
- Operations: one-time verification/reset token hashes, authentication-abuse counters stored as keyed hashes, request identifiers and server logs. Production application logs record the Resend message ID but no longer record the recipient address; Resend still receives the address and message to deliver transactional email.

Passwords, raw one-time links and guest credentials are not stored in the database in readable form. The bearer access token and each Game Night guest credential are stored in that browser's local storage. ShelfPick does not currently set cookies or connect its telemetry hooks to an analytics provider. Production traffic must use HTTPS.

## Why, legal basis, sharing and transfers

ShelfPick processes the data above to provide accounts, collections, recommendations, play history, sharing and Game Night features; prevent abuse; send verification/reset mail; and operate and recover the service.

**[QUALIFIED LEGAL REVIEW REQUIRED: specify a lawful basis for each purpose, controller/processor roles, international-transfer safeguards, children's use and any legitimate-interest assessment.]**

Expected processors/integrations are Render (hosting/database/logs), Resend (transactional email) and BoardGameGeek (public collection/game requests and BGG-hosted images). Their roles, exact entities, regions, terms and transfer arrangements must be confirmed before publication. A supplied BGG username is sent to BGG to retrieve its public collection. Cover URLs are loaded directly from BGG by the user's browser, so BGG may receive ordinary web-request data such as IP address and request headers. Users should not enter a username they are not authorised to use. BGG's commercial XML API application approval is recorded; underlying cover-image rights remain separate.

## Retention and user choices

Active-account data remains until account deletion or the approved retention schedule requires earlier removal. In-app deletion removes the account and its ShelfPick-owned personal data from the live database; shared catalogue records remain. Provider backups may retain deleted data until they age out under the approved backup schedule and are not restored except for disaster recovery.

Game Night access expires after 12 hours, but this does not delete the host, guest or ballot rows. Stale auth-abuse rows are removed only during later authentication writes. Used/expired one-time-token rows otherwise remain until replacement or account deletion.

The owner has approved these provisional drafting periods for legal review: inactive accounts 24 months; expired Game Night records 30 days; expired verification/reset tokens 7 days; operational logs 30 days; independent backups 30 days; temporary exported personal-data files 7 days; and resolved privacy requests 12 months. They are not active automatic-deletion commitments until technical implementation, qualified review and publication approval are complete.

Users can correct profile/preferences in Settings and delete their account after password confirmation. Access/export, correction, objection, restriction or deletion requests can be made through **hello@plutonightlabs.com** after its monitoring process is approved, and must follow the verified procedure in `docs/data-retention-and-requests.md`.

## Rights, complaints and changes

**[QUALIFIED LEGAL REVIEW REQUIRED: applicable rights, exceptions, response periods, supervisory-authority wording and notice-change process.]**

Publication gate: owner identity/contact, purposes and legal bases, processors/transfers, retention, rights/complaints and qualified review are all complete.

Decision register: `docs/sp-launch-03-owner-decision-sheet.md`.
