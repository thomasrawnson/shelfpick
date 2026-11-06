# SP-IOS-14E — child guest DPIA candidate

**Unapproved working document, 6 November 2026.** Reconstructed because the 14A DPIA and 14C worktree were unavailable. It does not replace a qualified privacy review or authorise public child guest voting.

## Processing and necessity

ShelfPick proposes 13+ accounts and account-free Game Night guest participation for under-13 children invited by an eligible host. A guest receives a session link, supplies a required display name (the UI asks for a nickname), receives a random credential, and may cast a ballot. The host can see participant nicknames and aggregate results. Guest responses expose only the credential holder's own detail plus aggregates. The link and credential limit access; neither proves age or parental responsibility. The host's enhanced Game Night entitlement remains required.

The service need is a private group decision without child accounts, email or location. A generated alias instead of free-text nickname, or at-table voting instead of phone voting, are less intrusive alternatives that need owner assessment. A nickname entered by a child may be a real name, and session links can be forwarded.

## Safeguard register

| State | Safeguard and evidence | Limit |
| --- | --- | --- |
| Implemented and tested locally | Server requires a literal true 13+ registration declaration; invitation, verification and rate limits remain. | Self-declaration is not independent age assurance and the declaration is not retained as separate evidence. |
| Implemented and tested locally | Credential hash and join-token scope restrict correction/deletion; ballot and guest removed atomically; persistent per-IP rights throttle; generic invalid-credential result. | A stolen valid bearer credential remains effective; network-level rate-limit behaviour has not been production-tested. |
| Implemented and browser-tested | Nickname guidance says the host can see it; guest can correct or remove their own nickname/vote; local credential clears after removal. | Synthetic fixture only; no human child comprehension test. |
| Existing baseline | Host Pro gate, guest account-free join, host/public response separation and 12-hour access expiry. | Expiry does not delete rows; production guest cleanup is not scheduled. |
| Proposed, unimplemented | Approved public child-readable notice, monitored privacy contact, lost-credential manual handling, bounded guest retention cleanup and backup-restore reconciliation. | Requires owner operational decisions and legal review. |
| Unverified | PostgreSQL migration/integration CI, production log fields and retention, iOS guest flow, physical-device behaviour, child/parent comprehension. | Local SQLite and browser checks cannot satisfy these gates. |

## Risks and decision

**BLOCKER:** No approved guest lawful basis/LIA, child-readable public notice or monitored rights path; retention and recovery promises are unsettled. Public under-13 phone voting must remain unavailable pending owner and qualified UK review. If the final DPIA finds residual high risk that cannot be reduced, prior ICO consultation is required before processing ([ICO guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/do-we-need-to-consult-the-ico/)).

**RISK:** Forwarded links, host-held guest names, bearer credential theft, real-name entry, lack of independent age assurance and unscheduled row cleanup. **POLISH:** Shorter child-tested guidance and a generated-alias option may reduce ambiguity but need product approval.

The controller/owner must record purposes, lawful basis per data use, safeguards, residual likelihood/severity, consultation with affected people or their representatives, and an accountable sign-off. This candidate is not accepted or published.

The tested/unverified/proposed decision matrix and precise release order are in `docs/SP-IOS-14E-V-ACCEPTANCE-PACKAGE.md`. This DPIA candidate remains unsigned after the follow-up verification.
