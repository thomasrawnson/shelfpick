# Public privacy policy: phone voting changes (DRAFT for owner review)

Drafted 2026-11-17 against the live page https://plutonightlabs.com/shelfpick/privacy/ (last updated 13 November 2026, "Applies to ShelfPick 1.0"). Nothing here is published, and no website file has been changed. The website lives in a separate repository (`studio/pluto-night-labs-site`, `src/pages/shelfpick/privacy.astro`); apply the text below there only after approval, and publish **before** `GAME_NIGHT_PHONE_VOTING_ENABLED` is turned on in production.

Each section below says which existing section it replaces or adds to. Wording follows the live page's plain style and states only what the code does today (checked 2026-11-17: guests can edit or delete their own nickname and ballot; host sessions, guests and ballots are deleted by database cascade when the host account is deleted; the 30-day cleanup job exists but `RETENTION_CLEANUP_ENABLED` is off). No lawyer has reviewed this text.

## 1. Header

Replace "Applies to ShelfPick 1.0" with "Applies to ShelfPick 1.0 and later" and set "Last updated" to the publication date.

## 2. "Information ShelfPick uses" — replace the "Game Night" paragraph

**Game Night**
ShelfPick can use selected players, group preferences and a shortlist to help a host choose a game.

A host with an account can also open a phone vote. ShelfPick creates a link and QR code for that vote. Anyone with the link can join without an account or email address: they choose a nickname and cast a ballot for the shortlisted games. ShelfPick stores the nickname, a hashed credential that lets that browser or device change its own ballot, and the ballot itself. The host sees nicknames and the group's totals, not each guest's individual choice. Please ask children and other guests to use nicknames rather than real names. A guest's credential is kept in that browser's local storage on their device.

## 3. "Information ShelfPick uses" — add to "Security and operations"

Append: "Guests who vote use the same request logging as signed-in users; ShelfPick does not ask guests for an email address, location or contact details."

## 4. "Why we use information" — add a purpose

**To run phone votes:** let a host collect and count votes from guests at game night. We rely on our legitimate interests in providing the feature the host asked for, with a limited set of information and an easy way for guests to remove it.

(Owner to confirm this basis; the live page uses contract for account features and legitimate interests for security, so this one is a judgement call for guests, who have no contract with us.)

## 5. "How long we keep information" — add

**Phone votes.** A vote link stops working 12 hours after it is created. Guest nicknames, hashed credentials and ballots are kept until the guest removes them, or the host deletes their ShelfPick account, which also removes the host's vote sessions and everything guests submitted to them. We do not currently run an automatic deletion of expired votes.

*Alternative, only if the owner turns on retention cleanup before publishing:* "…Expired votes, including guest nicknames and ballots, are deleted automatically 30 days after the link expires."

## 6. "Your choices and rights" — add

Guests can change their nickname or ballot, or remove their nickname and ballot, from the device they joined on while the vote is open. Guests cannot be identified by email, so a guest who wants a record removed after leaving the page can email hello@plutonightlabs.com with the host's name and the date of the vote, and we will try to find and remove it, though we may not be able to identify a record from a nickname alone.

## 7. "Age and children" — add

Phone votes do not require an account or collect a date of birth, so ShelfPick cannot tell the age of a guest. Hosts should only share a vote link with people they are playing with, and should ask children to use nicknames. The 13+ requirement applies to creating an account, not to joining a vote as a guest.

## 8. Remove

Delete "Phone and QR voting are not available in this release." from the Game Night paragraph (done in section 2) and anywhere else it appears (support page, landing page; check `src/pages/shelfpick/`).

## 9. App Store Connect App Privacy: suggested additions (owner enters these)

Guest data is new compared with the version-1.0 answers. Compare against what is already entered; suggested additions:

| Data type | Collected | Linked to identity | Tracking | Purpose |
|-----------|-----------|--------------------|----------|---------|
| Other User Content (guest nickname and ballot) | Yes | Not linked to the guest's identity (no account); stored against the host's session | No | App Functionality |

Apple counts the host's own data under the existing account answers. If you judge a nickname to be a "Name", declare Name as well. The privacy manifest in `frontend/ios/App/App/PrivacyInfo.xcprivacy` (PR SP-PRIVACY-02) and the App Store Connect answers should be changed together so they match.

## 10. Questions for the owner

1. Is "legitimate interests" the basis you want for guest data (section 4)?
2. Publish "no automatic deletion yet" (section 5), or enable `RETENTION_CLEANUP_ENABLED` first and publish the 30-day wording? Enabling it is a production change and is out of scope without your approval.
3. The "contact us" route for guests (section 6) adds a manual task. Keep it, or drop the sentence?
