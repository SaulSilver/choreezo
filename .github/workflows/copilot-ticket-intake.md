---
name: Copilot ticket intake

on:
  issues:
    types: [opened, edited, labeled]

permissions:
  contents: read
  issues: write
  pull-requests: write
  copilot-requests: write

network: defaults

engine: copilot

tools:
  github:
    toolsets: [issues, pull-requests, contents]

safe-outputs:
  add-comment:
  add-labels:
  create-pull-request:
    draft: true
    labels: [copilot-ready]
    title-prefix: "[copilot] "
    allowed-base-branches:
      - main
      - master

---

# Copilot ticket intake

Review the triggering issue in this repository and decide whether it is ready for autonomous work.

Guardrails:

- Only take action when the issue is open and has the `copilot-ready` label.
- If the issue is missing any of these sections or they are too vague to implement safely, add or preserve `needs-human-input`, leave a concise comment listing what is missing, and stop:
  - Scope
  - Acceptance criteria
  - Affected surface
  - Release impact
- If the issue references the future Go backend, backend deployment, or cross-surface architecture that is not yet defined, ask for human guidance and stop instead of inventing the backend structure.

Decision rules:

- For narrow implementation-ready changes limited to the current frontend app or `functions/**`, create a draft pull request that follows the repository instructions in `AGENTS.md`.
- For broader or ambiguous issues, leave a comment with a concrete implementation plan and note the blocker preventing direct PR creation.

Implementation expectations for pull requests:

- Keep changes surgical and aligned with existing repository patterns.
- Run `npx tsc --noEmit` for app changes.
- Run `cd functions && npm run build` when `functions/**` changes.
- Summarize validation evidence, risks, and release notes in the pull request body.
- Do not automate production release steps; delivery automation stops at the draft PR stage for this repository.
