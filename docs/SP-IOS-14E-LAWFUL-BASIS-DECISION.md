# SP-IOS-14E — guest voting lawful-basis decision candidate

**Decision: open.** This is a focused legitimate-interests assessment for owner and qualified UK legal review, not an approval of that basis or public under-13 use.

## Purpose test

A host and invited guest may have a legitimate interest in coordinating a private game choice. Separate purposes must be recorded for nickname, one-session credential, ballot, abuse prevention and operational logs. No advertising, profile-building or cross-session child identity is proposed.

## Necessity test

A short-lived, credential-bound ballot plausibly prevents one guest editing another's vote. A free-text nickname is less clearly necessary: generated or optional aliases may work. At-table voting avoids online child data but does not provide remote phone voting. The owner must document why that difference matters for V1. Keep collection to one session; do not collect date of birth, email or precise location from child guests.

## Balancing test

Children merit extra weight in this balance. A child may enter a real name, a host can retain observed names, a forwarded link can expose participation, and a stolen credential plus link enables correction/deletion. Twelve-hour access expiry does not guarantee deletion; lost credentials make rights requests difficult. Local tests show credential scoping, ballot deletion, throttling and host/public response separation, but there is no child comprehension evidence, production log review or approved retention schedule. The balance remains **undetermined with potentially high residual risk**. See the [ICO Children's Code lawful-basis guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/annex-c-lawful-basis-for-processing/) and [ICO legitimate interests guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/legitimate-interests/).

## Other bases and conditions

If consent is chosen for an online service offered directly to an under-13 child, UK Article 8 requires parental authorisation and reasonable verification; a host invitation is not that verification. Contract is not established merely by the host's account terms for a child without an account. The lawful basis must be chosen for each purpose, with qualified advice; no basis is assumed automatically.

Before owner sign-off: decide nickname minimisation and age-assurance sufficiency; approve a child-readable public notice and monitored no-account contact; define lost-credential identity review without collecting documents by default; set and implement bounded guest deletion and restore reconciliation; verify logs and PostgreSQL CI; assess forwarded-link and bearer-theft risk; obtain appropriate child/parent comprehension input; finish and sign the DPIA. If high residual risk cannot be mitigated, assess prior ICO consultation before processing.

The 14E-V verification did not change this open decision. Its evidence matrix is in `docs/SP-IOS-14E-V-ACCEPTANCE-PACKAGE.md`; the owner and qualified adviser must still record the per-purpose basis and balancing conclusion.
