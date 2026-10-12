# SP-BETA-02-QA — browser validation closeout

**Date:** 12 October 2026
**Scope:** local synthetic browser and focused regression validation only.

## Previous failure root cause

Two independent fixture problems caused the earlier incomplete run:

1. The production preview was initially built without VITE_API_BASE_URL, so
   the production client correctly failed closed before rendering.
2. The later inline Playwright fixture returned /auth/me without cross-origin
   response headers. The browser rejected that response, session restoration
   failed, and /discover remained on the authentication recovery path. The
   Top 100 tab therefore never existed for the test to select.

No Discover route, authentication-state or feature-rendering regression was
found. The closeout used a production build with the API explicitly set to
http://127.0.0.1:8000, Vite preview on port 4175 and a stateful synthetic API
on port 8000 with explicit CORS headers.

## Browser evidence

Installed Google Chrome passed:

- 390x844 light;
- 390x844 dark;
- 1440x900 light;
- 1440x900 dark.

Each matrix run covered invite-only registration copy, generic registration
success, absence of an access token before verification, resend, expired-link
recovery, successful verification, authenticated Hot results, explicit Top 100
unavailability, absence of any mode=top100 request, Free For You locking,
keyboard focus, horizontal overflow and bottom-navigation clearance.

An additional synthetic journey proved invited and uninvited registration
messages are identical, a pending account cannot authenticate, an existing
account can still log in, and a Pro fixture can load For You from the Hot-only
runtime provider. No ranked request or misleading ranked result occurred.

Representative screenshots:

- screenshots/sp-beta-02/beta-390-light.png
- screenshots/sp-beta-02/beta-390-dark.png
- screenshots/sp-beta-02/beta-1440-light.png
- screenshots/sp-beta-02/beta-1440-dark.png

## Regression evidence

- focused backend authentication/configuration/Discover: 54 passed;
- focused frontend SP-BETA-02: 3 passed;
- Playwright: four responsive/theme states plus the additional authentication
  and Pro For You journey passed;
- no application, schema, dependency or entitlement change was made by this
  closeout.

SP-BETA-02 is complete. Remaining beta gates are release-candidate integration,
remote CI, BGG artwork permission or fallback-only exports, provisioned
health/email/backup recovery, physical iPhone and Android validation, and
explicit owner approval.
