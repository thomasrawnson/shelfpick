import { Link } from "react-router-dom"

import {
  APP_PATHS,
} from "../routes"
import {
  LEGAL_DRAFT_MARKER,
  type LegalDraftKind,
} from "../legal-drafts"
import BrandLogo from "./ui/BrandLogo"


type Props = {
  kind: LegalDraftKind
  backTo: string
}


function DraftNotice() {
  return <div className="legal-draft-notice" role="note">
    <strong>{LEGAL_DRAFT_MARKER}</strong>
    <span>This working copy is for owner and qualified UK legal review. It is not the published ShelfPick policy or legal advice.</span>
  </div>
}


function DraftNavigation({ current }: {
  current: LegalDraftKind
}) {
  return <nav className="legal-draft-tabs" aria-label="Draft legal documents">
    <Link aria-current={current === "privacy" ? "page" : undefined} to={APP_PATHS.privacyDraft}>Privacy Policy draft</Link>
    <Link aria-current={current === "terms" ? "page" : undefined} to={APP_PATHS.termsDraft}>Terms of Use draft</Link>
  </nav>
}


function PrivacyDraft() {
  return <>
    <section>
      <h2>Who operates ShelfPick</h2>
      <p>ShelfPick is operated by Pluto Night Labs Ltd. The registered company number and postal address are still awaiting owner evidence and legal review.</p>
      <p>Public privacy and support contact: <a href="mailto:hello@plutonightlabs.com">hello@plutonightlabs.com</a>.</p>
      <p>The proposed launch is UK-first and Free-only. The proposed minimum age is 13+, subject to qualified legal and Children&apos;s Code review.</p>
    </section>

    <section>
      <h2>Information used by the service</h2>
      <ul>
        <li>Account details: email, password hash, display name, verification state, preferences and optional public BGG username.</li>
        <li>Shelf and activity: collection, wishlist, players, plays, optional locations, scores, rankings, Picker history, timers and hosted Game Night voting.</li>
        <li>Operations: hashed verification/reset tokens, keyed abuse-prevention counters, request identifiers, logs and transactional email delivery metadata.</li>
        <li>Device storage: the bearer session token and Game Night guest credential are kept in that browser&apos;s local storage.</li>
      </ul>
      <p>The final lawful basis for each purpose remains subject to qualified legal review. ShelfPick does not currently connect its telemetry hooks to a product analytics provider and does not offer advertising or paid checkout.</p>
    </section>

    <section>
      <h2>Providers and BoardGameGeek</h2>
      <p>Render is the intended hosting and PostgreSQL provider. Resend sends verification and password-reset email. Their exact contracting entities, roles, regions, subprocessors and transfer safeguards remain under review.</p>
      <p>A BGG username supplied by a user is sent to BoardGameGeek to retrieve its public collection. BGG game metadata and hosted cover URLs are displayed in ShelfPick; the browser may therefore send ordinary web-request data to BGG. ShelfPick has commercial XML API application approval, but underlying cover-image rights remain separate and cover artwork stays disabled in exported images.</p>
    </section>

    <section>
      <h2>Provisional retention periods</h2>
      <p>These periods are owner-approved drafting positions, not active automatic-deletion promises:</p>
      <dl className="legal-retention-list">
        <div><dt>Inactive accounts</dt><dd>24 months</dd></div>
        <div><dt>Expired Game Night records</dt><dd>30 days</dd></div>
        <div><dt>Expired verification/reset tokens</dt><dd>7 days</dd></div>
        <div><dt>Operational logs</dt><dd>30 days</dd></div>
        <div><dt>Independent backups</dt><dd>30 days</dd></div>
        <div><dt>Temporary exported personal-data files</dt><dd>7 days</dd></div>
        <div><dt>Resolved privacy requests</dt><dd>12 months</dd></div>
      </dl>
      <p>Account deletion in Settings removes the account and its ShelfPick-owned personal rows from the live database after password confirmation. Shared game-catalogue rows remain. Deleted data may remain in independent backups for the approved backup lifecycle once that process is implemented.</p>
    </section>

    <section>
      <h2>Requests and complaints</h2>
      <p>Profile and preference corrections and authenticated account deletion are available in Settings. The final access, correction, restriction, objection, erasure, complaint, response-time and exception wording is awaiting qualified UK privacy review. Until approved, contact <a href="mailto:hello@plutonightlabs.com">hello@plutonightlabs.com</a>.</p>
    </section>
  </>
}


function TermsDraft() {
  return <>
    <section>
      <h2>Service provider and eligibility</h2>
      <p>ShelfPick is operated by Pluto Night Labs Ltd. The registered company number, postal address, governing law wording and consumer terms still require evidence and qualified legal review.</p>
      <p>Contact: <a href="mailto:hello@plutonightlabs.com">hello@plutonightlabs.com</a>. The proposed launch is UK-first and Free-only, with a proposed minimum age of 13+ subject to legal and Children&apos;s Code review.</p>
    </section>

    <section>
      <h2>What ShelfPick provides</h2>
      <p>ShelfPick helps users manage a board-game collection, choose games, record plays and run optional Game Night voting. Recommendations are decision aids, not guarantees. ShelfPick Pro pricing, purchase and checkout are unavailable.</p>
      <p>BoardGameGeek data and availability are third-party dependencies. ShelfPick has commercial XML API application approval but is not affiliated with or endorsed by BoardGameGeek. Users must supply only a BGG username they are authorised to use.</p>
    </section>

    <section>
      <h2>Account responsibilities</h2>
      <p>Users must provide an email they control, keep credentials and guest links secure, use the service lawfully, and avoid interfering with the service or evading its security and workload limits. Final enforcement, suspension and termination wording requires legal review.</p>
    </section>

    <section>
      <h2>Availability and deletion</h2>
      <p>BGG, hosting and email outages may temporarily limit features. A user may delete their account in Settings after password confirmation. Live-database deletion and the separate backup lifecycle are described in the Privacy Policy draft.</p>
    </section>

    <section>
      <h2>Terms still requiring legal approval</h2>
      <p>Intellectual-property, acceptable-use enforcement, service changes, warranties, liability, consumer cancellation, disputes, governing law and notice provisions are intentionally not asserted in this draft. No binding Terms of Use will be published until qualified review and explicit owner approval are recorded.</p>
    </section>
  </>
}


export default function LegalDraftView({
  kind,
  backTo,
}: Props) {
  const title = kind === "privacy"
    ? "Privacy Policy draft"
    : "Terms of Use draft"

  return <article className="screen legal-draft-page" aria-labelledby="legal-draft-heading">
    <BrandLogo />
    <DraftNotice />
    <header className="legal-draft-heading">
      <p className="eyebrow">Owner review copy</p>
      <h1 id="legal-draft-heading">{title}</h1>
      <p>Prepared 3 November 2026</p>
    </header>
    <DraftNavigation current={kind} />
    {kind === "privacy" ? <PrivacyDraft /> : <TermsDraft />}
    <Link className="secondary-button legal-draft-back" to={backTo}>Back to ShelfPick</Link>
  </article>
}
