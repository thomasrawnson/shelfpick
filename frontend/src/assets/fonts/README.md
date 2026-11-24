# Self-hosted fonts (SP-UI-03)

Used on the Tonight screen only (see DESIGN.md, Typography). Both are variable fonts under the SIL Open Font
License 1.1; the licence texts sit beside the files and must ship with them.

| File | Family | Axis | Subset | Source |
| --- | --- | --- | --- | --- |
| `Fraunces-latin-wght.woff2` | Fraunces | weight 100 to 900 | Latin | `@fontsource-variable/fraunces` 5.3.0 (Fraunces v38), `files/fraunces-latin-wght-normal.woff2` |
| `DMSans-latin-wght.woff2` | DM Sans | weight 100 to 1000 | Latin | `@fontsource-variable/dm-sans` 5.3.0 (DM Sans v17), `files/dm-sans-latin-wght-normal.woff2` |
| `Fraunces-OFL.txt`, `DMSans-OFL.txt` | licences | | | `LICENSE` from the same packages |

The files are copied, not installed as dependencies, so nothing in the build fetches a font. To update, download the new
package with `npm pack`, replace the woff2 and licence files, and change the versions above.
