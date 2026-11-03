# ShelfPick privacy notice — DRAFT FOR OWNER AND LEGAL REVIEW

**Not approved for publication.** Bracketed items require owner decisions or qualified legal advice. This draft describes application behaviour as of SP-LAUNCH-02 and does not claim UK GDPR compliance.

## Who is responsible

Data controller: **[OWNER TO PROVIDE LEGAL/OPERATING IDENTITY]**

Privacy contact: **[OWNER TO PROVIDE CONTACT ADDRESS]**

## Data ShelfPick handles

- Account: email address, password hash, display name, verification state, account tier, optional BoardGameGeek username and preferences.
- Shelf and activity: owned/wishlisted games, plays, dates, duration, optional location, participant names and scores, rankings, Picker events, timers and hosted Game Night sessions.
- Guest voting: guest display name, hashed guest credential and ballot within the host's expiring session.
- Operations: authentication-abuse counters stored as keyed hashes, request identifiers and server logs. **[OWNER TO CONFIRM LOG CONTENT AND RETENTION AFTER HOSTING IS CONFIGURED.]**

Passwords, raw one-time links and guest credentials are not stored in readable form. ShelfPick does not currently implement advertising or product analytics. Browser authentication uses local storage; production traffic must use HTTPS.

## Why, legal basis, sharing and transfers

ShelfPick processes the data above to provide accounts, collections, recommendations, play history, sharing and Game Night features; prevent abuse; send verification/reset mail; and operate and recover the service.

**[QUALIFIED LEGAL REVIEW REQUIRED: specify a lawful basis for each purpose, controller/processor roles, international-transfer safeguards, children's use and any legitimate-interest assessment.]**

Expected processors/integrations are Render (hosting/database), Resend (transactional email) and BoardGameGeek (game/collection data requests). Their approved entities, regions and agreements must be confirmed before publication. BGG usernames identify public BGG collections; users should not enter a username they are not authorised to use.

## Retention and user choices

Active-account data remains until account deletion or the approved retention schedule requires earlier removal. In-app deletion removes the account and its ShelfPick-owned personal data from the live database; shared catalogue records remain. Provider backups may retain deleted data until they age out under the approved backup schedule and are not restored except for disaster recovery.

**[OWNER TO APPROVE exact inactive-account, expired Game Night, authentication-counter, application-log, support-request and backup periods.]**

Users can correct profile/preferences in Settings and delete their account after password confirmation. Access/export, correction, objection, restriction or deletion requests can be made through **[OWNER SUPPORT/PRIVACY CONTACT]** and must follow the verified procedure in `docs/data-retention-and-requests.md`.

## Rights, complaints and changes

**[QUALIFIED LEGAL REVIEW REQUIRED: applicable rights, exceptions, response periods, supervisory-authority wording and notice-change process.]**

Publication gate: owner identity/contact, purposes and legal bases, processors/transfers, retention, rights/complaints and qualified review are all complete.
