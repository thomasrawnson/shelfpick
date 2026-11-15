# ShelfPick agent instructions

Preserve the repository's existing architecture, documented test commands,
release gates and unrelated working-tree changes. Do not deploy, publish,
change credentials, or perform remote operations without explicit authority.

## Shared testing policy

- For testing work, read and follow
  `/Users/tomrawnson/Developer/pluto-night-labs/studio/pluto-device-lab/PLUTO-TESTING-POLICY.md`.
- Repository documents and acceptance gates remain authoritative when stricter.
  Never report Simulator evidence as physical-device evidence.

## Shared Pluto workflow and knowledge

- Read `/Users/tomrawnson/Developer/pluto-night-labs/studio/pluto-standards/CORE.md` first, then
  `/Users/tomrawnson/Developer/pluto-night-labs/studio/pluto-standards/standards/DEVELOPMENT-WORKFLOW.md`
  for authorised development work. Use
  `/Users/tomrawnson/Developer/pluto-night-labs/studio/pluto-standards/templates/CODEX-TASK.md` for new
  handoffs and the split owner report in `CORE.md`.
- Use `/Users/tomrawnson/Developer/pluto-night-labs/studio/pluto-second-brain/map.md` and
  `projects/shelfpick.md` for dated portfolio navigation only. Verify current
  implementation, release, hosting, privacy and App Store claims in this Git
  repository, its current worktree/release evidence, tests and authorised live
  sources. The Second Brain never proves deployment or owner approval.
- Retrieve context in this order: task and applicable root/nested `AGENTS.md`;
  shared core/workflow; Second Brain map/project note; `ROADMAP.md`, `DESIGN.md`,
  the production runbook and current release/handoff evidence; then affected
  source, tests and authorised live state. Report conflicts instead of silently
  choosing an old report.
- Resume interrupted work from `git status`, `git worktree list`, the current
  branch/SHA and its exact release report or handoff. Preserve the dirty primary
  checkout and never infer that a draft PR, prior CI pass or local candidate is
  merged, deployed, live, legally approved, device-accepted or App-Store-ready.
- Fast Track covers one already authorised, bounded, reversible local milestone:
  inspect, implement, run focused and mandatory checks, repair, retest and report
  once. Avoid duplicate planning/review, but retain privacy/legal, security,
  migration, production, account, device/accessibility, App Store, Git and owner
  gates. No successor task starts automatically. Report a broken shared reference.
