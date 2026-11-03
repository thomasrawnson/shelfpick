# BoardGameGeek attribution and permission assessment

**Reviewed:** 3 November 2026

**Status:** Commercial XML API application approved; attribution implemented; underlying image rights remain a separate launch gate.

## Approval record

Recorded on 3 November 2026 from the approval notice supplied and confirmed by the owner:

- BoardGameGeek approved ShelfPick's commercial XML API application.
- Public-facing use requires the linked “Powered by BGG” logo.
- BGG may apply a fee in future, but the supplied notice states no current fee.

This record contains no API token. It does not grant or imply rights in third-party game-cover artwork, permission to embed artwork in exported files, approval of non-XML scraping, or endorsement by BGG. The future-fee possibility requires owner review before accepting any charge.

BoardGameGeek's current [Using the XML API](https://boardgamegeek.com/using_the_xml_api) page (version date 2 July 2025) says registration and authorisation are required for nearly all XML API use, requests should be server-side and minimised, and public-facing apps must show a linked “Powered by BGG” logo. The [XML API terms](https://boardgamegeek.com/wiki/page/XML%20API%20Terms%20of%20Use) also require BoardGameGeek credit and the linked logo. ShelfPick now has the owner-confirmed commercial XML API application approval recorded above.

SP-LAUNCH-02 adds BGG's unmodified official `powered-by-bgg-rgb.svg` from BGG's linked public asset folder to Collection & Data and About, linking to `https://boardgamegeek.com/`. API calls remain server-side, use the application token, batch at BGG's 20-item maximum and now have tighter response/retry/work bounds. Exported cover artwork remains disabled by default.

The public runtime uses XML API2 `/collection`, `/thing`, `/search` and `/hot`. It displays image/thumbnail URLs returned by BGG. The legacy non-XML ranked-page reader remains in source but is not registered in the runtime provider and must remain disabled unless separately authorised. Hot IDs use a 24-hour in-process cache; game metadata is retained in ShelfPick's shared catalogue.

## Owner/external gates

1. Record the approved application/token custodian in the private operations register; never place the token in frontend code or documentation.
2. Confirm whether in-app display of BGG-hosted cover images is covered. Keep cover artwork out of exported share cards unless separately authorised.
3. Recheck the official policy immediately before launch because BGG states it may change.
4. Obtain owner approval before accepting a future BGG fee or changing the Free-only launch model.

The earlier request draft in `docs/sp-launch-03-bgg-permission-request.md` is superseded and must not be sent.
