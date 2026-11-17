# Rework log

- 2026-11-13 — The temporary SP-IOS-19A worktree was removed between tasks before its uncommitted patch was promoted; SP-IOS-19B recreated the exact bounded change from retained evidence and reran all release checks.
- 2026-11-17 — SP-UNLOCK-01: the guest page showed a vote heading with a futile retry when the server returned 503, and the unsigned Simulator build could not write the Keychain; both were found by screenshots/smoke, the guest state was fixed and the Simulator build was re-signed ad hoc.
