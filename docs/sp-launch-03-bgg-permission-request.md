# ShelfPick BoardGameGeek permission request — SUPERSEDED, DO NOT SEND

**Not sent and no longer required.** The owner subsequently supplied confirmation that BGG approved ShelfPick's commercial XML API application. The operative evidence summary is `docs/bgg-attribution-and-permission.md`. Preserve this file only as historical drafting evidence; do not create or send another application from it.

**Subject:** ShelfPick public application authorisation and cover-image permission

Hello BoardGameGeek team,

I am **[LEGAL NAME / OPERATING IDENTITY]**, the operator of ShelfPick (**[PUBLIC URL OR PRE-LAUNCH DESCRIPTION]**; contact: **[EMAIL]**). I am requesting authorisation for a small initial public release and confirmation of the applicable XML API licence/classification.

ShelfPick is a board-game collection and game-choice web app. At launch it will be Free-only: no payments, advertising, donations, paid benefits, pricing or checkout. A possible future one-off paid “Pro” offering is only a product direction, is not available at launch, and would not be introduced without returning to BGG to agree any required commercial licence.

Current BGG use:

- users may supply their public BGG username to import their owned collection;
- ShelfPick's backend uses a registered bearer application token for XML API2 `/collection`, `/thing`, `/search` and `/hot` requests;
- `/thing` requests are batched to at most 20 IDs; Hot IDs are cached in application memory for 24 hours and stored game metadata is reused to minimise requests;
- the browser displays BGG-hosted image/thumbnail URLs returned by the API, links game results to their BGG pages, and shows BGG's linked “Powered by BGG” attribution;
- requests are server-side; the token is not shipped to the browser; and BGG data is not used for AI/LLM training.

ShelfPick does **not** enable its legacy non-XML ranked-page reader in the public runtime. Please confirm that it must remain disabled unless BGG separately authorises that source.

Exported play/recap images currently omit cover artwork by default. Please confirm whether (a) displaying BGG-hosted cover URLs inside the app and (b) embedding a cover in a user-generated PNG require separate permission. We will keep (b) disabled unless expressly approved and any underlying image rights requirements are satisfied.

Expected launch scale: **[EXPECTED USERS AND APPROXIMATE REQUEST VOLUME]**. Hosting region: Frankfurt, Germany. **[DESCRIBE ANY PERSISTENT METADATA REFRESH/DELETION POLICY AFTER OWNER DECISION.]**

Could you confirm in writing:

1. approval/registration of this application and its initial non-commercial classification;
2. whether the described endpoints, caching/storage and public-collection import are permitted;
3. whether the linked attribution placement is sufficient;
4. the permitted treatment of in-app cover display and optional exported images; and
5. what notice/licence change is required before any paid Pro release.

I can provide screenshots, traffic estimates or further technical details if helpful.

Thank you,

**[NAME]**
**[LEGAL/OPERATING IDENTITY]**
**[CONTACT DETAILS]**

This request reflects BGG's current [Using the XML API](https://boardgamegeek.com/using_the_xml_api), [XML API Terms of Use](https://boardgamegeek.com/wiki/page/XML%20API%20Terms%20of%20Use) and [commercial-use guidance](https://boardgamegeek.com/wiki/page/BGG_XML_API_Commercial_Use). Recheck those pages immediately before sending.
