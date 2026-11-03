# ShelfPick data retention and request procedure — DRAFT

**Qualified privacy review and publication approval required before launch.** The owner has accepted the periods below as provisional drafting positions. They are not active deletion commitments, and no production cleanup is scheduled or enabled.

| Data | Provisional period | Current implementation and gap |
|---|---:|---|
| Inactive account and owned/transitive data | 24 months | Authenticated deletion exists. No reliable last-activity timestamp or automatic inactive-account cleanup exists; no inactivity deletion is authorised. |
| Expired Game Night host/guest/ballot rows | 30 days after `expires_at` | Access expires after 12 hours. A batched, idempotent, opt-in cleanup routine now exists but is disabled and unscheduled. |
| Expired verification/reset token hashes | 7 days after `expires_at` | Active predecessors are replaced. A batched, idempotent, opt-in cleanup routine now exists but is disabled and unscheduled. |
| Operational logs | 30 days | Request logs contain request ID, method, redacted path, status and duration. Production application email logs omit the recipient address. Provider log retention is not configured because no service is provisioned. |
| Independent backups | 30 days | No production database or independent backup job exists. Recovery must be isolated and reconcile deletion requests before promotion. |
| Temporary exported personal-data files | 7 days | The manual request process is not yet operated; no server-side export store or cleanup job exists. |
| Resolved privacy requests | 12 months | The manual case register, access control and deletion process are not yet approved or operated. |

Auth rate-limit HMAC rows are a separate security control: rows older than 24 hours are removed during a later auth write, so there is not yet a guaranteed hard deletion deadline. Browser bearer and Game Night guest credentials remain in `localStorage` until logout/removal or replacement by the app.

## Manual access/export request

1. Receive the request only through **hello@plutonightlabs.com** after the owner confirms monitoring and escalation; record receipt without copying unnecessary personal data.
2. Verify identity using a signed-in confirmation or a single-use link to the registered email. Never request or accept the account password by email.
3. Confirm scope and any applicable exception with the privacy owner/legal reviewer.
4. Export only rows owned by the authenticated user: account/profile/preferences, collection/wishlist, players, plays/participants, rankings/comparisons, Picker sessions/events, timers and hosted Game Night sessions/guests/ballots. Do not include password hashes, tokens, credential hashes, internal secrets or another user's data.
5. Deliver through **[APPROVED SECURE METHOD]**, record completion and delete working files after **7 days**. Retain the resolved case record for **12 months**, subject to qualified review.

## Deletion request

Prefer the authenticated in-app flow. For an assisted request, verify identity as above, record the authorised request, invoke the same account-deletion service, confirm live-database removal, and explain the approved backup ageing period. Never edit production tables manually unless a separate incident procedure and owner approval require it.

## Verification checklist

- Two-user test proves only the target user's owned/transitive rows are removed and shared catalogue data remains.
- Old bearer tokens return 401 after deletion.
- Restore procedure does not silently re-enable a deleted account; any recovery reconciliation is documented.
- Request log contains dates/status, not exported personal content.

Owner decisions and processor evidence are tracked in `docs/sp-launch-03-owner-decision-sheet.md`.

Implementation and scheduling boundaries are in `docs/sp-launch-04-retention-implementation.md`.
