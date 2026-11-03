# ShelfPick data retention and request procedure — DRAFT

**Owner approval and qualified privacy review required before launch.** No period below is a commitment until the owner fills and approves it.

| Data | Live-system behaviour | Required owner decision |
|---|---|---|
| Account, collection, wishlist, plays, players, preferences, rankings, timers and hosted voting | Kept for the active account; deleted transactionally by in-app account deletion | Inactive-account period: **[TBD]** |
| Expired Game Night guest names/ballots | Remain under the host account until account deletion | Automatic expiry/removal period: **[TBD]** |
| Auth rate-limit keyed hashes | Automatically removed after approximately 24 hours during subsequent auth traffic | Confirm 24-hour maximum and maintenance strategy |
| Provider logs/request IDs | Hosting configuration not yet verified | Log fields and period: **[TBD]** |
| Database backups/exports | Hosting not provisioned | Retention, RPO/RTO and deleted-data ageing: **[TBD]** |
| Support/privacy requests and exported response files | Process not yet operated | Secure channel, access controls and destruction period: **[TBD]** |

## Manual access/export request

1. Receive the request only through **[APPROVED SUPPORT/PRIVACY CONTACT]**; record receipt without copying unnecessary personal data.
2. Verify identity using a signed-in confirmation or a single-use link to the registered email. Never request or accept the account password by email.
3. Confirm scope and any applicable exception with the privacy owner/legal reviewer.
4. Export only rows owned by the authenticated user: account/profile/preferences, collection/wishlist, players, plays/participants, rankings/comparisons, Picker sessions/events, timers and hosted Game Night sessions/guests/ballots. Do not include password hashes, tokens, credential hashes, internal secrets or another user's data.
5. Deliver through **[APPROVED SECURE METHOD]**, record completion and delete working files after **[TBD]**.

## Deletion request

Prefer the authenticated in-app flow. For an assisted request, verify identity as above, record the authorised request, invoke the same account-deletion service, confirm live-database removal, and explain the approved backup ageing period. Never edit production tables manually unless a separate incident procedure and owner approval require it.

## Verification checklist

- Two-user test proves only the target user's owned/transitive rows are removed and shared catalogue data remains.
- Old bearer tokens return 401 after deletion.
- Restore procedure does not silently re-enable a deleted account; any recovery reconciliation is documented.
- Request log contains dates/status, not exported personal content.
