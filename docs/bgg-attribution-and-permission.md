# BoardGameGeek attribution and permission assessment

**Reviewed:** 3 November 2026

**Status:** Attribution implemented; application/licensing and image-rights approval remain launch gates.

BoardGameGeek's current [Using the XML API](https://boardgamegeek.com/using_the_xml_api) page (version date 2 July 2025) says registration and authorisation are required for nearly all XML API use, requests should be server-side and minimised, and public-facing apps must show a linked “Powered by BGG” logo. The [XML API terms](https://boardgamegeek.com/wiki/page/XML%20API%20Terms%20of%20Use) also require BoardGameGeek credit and the linked logo. BGG defines applications offering a benefit for payment as commercial and requires a commercial licence; current policy describes possible free thresholds but does not grant ShelfPick approval.

SP-LAUNCH-02 adds BGG's unmodified official `powered-by-bgg-rgb.svg` from BGG's linked public asset folder to Collection & Data and About, linking to `https://boardgamegeek.com/`. API calls remain server-side, use the application token, batch at BGG's 20-item maximum and now have tighter response/retry/work bounds. Exported cover artwork remains disabled by default.

## Owner/external gates

1. Record the approved BGG application and token owner; never place the token in frontend code.
2. Ask BGG to classify/approve the initial Free-only public release and disclose intended future paid Pro functionality. Do not infer that a threshold is permission.
3. Confirm whether in-app display of BGG-hosted cover images is covered. Keep cover artwork out of exported share cards unless separately authorised.
4. Recheck the official policy immediately before launch because BGG states it may change.
