# DoneProof Product Design

**Status:** Approved for autonomous implementation  
**Date:** 2026-09-23  
**Owner:** DoneProof project

## 1. Product Summary

DoneProof is a local desktop application that turns software acceptance criteria into a version-bound delivery receipt. It does not claim that a project is complete merely because a test command exits successfully. Each criterion receives one of three explicit verdicts: **proven**, **failed**, or **unproven**.

The first release targets developers, freelancers, agencies, and technical leads who use coding agents such as Codex, Claude Code, and Cursor and need a reviewable answer to: “What evidence supports the claim that this work is done?”

## 2. Product Promise

> AI saying “done” is not evidence. DoneProof maps every acceptance criterion to evidence that another person can inspect.

The receipt must be useful to both technical reviewers and non-technical clients. It therefore presents a concise executive verdict first and preserves logs, hashes, screenshots, Git state, and command details behind expandable evidence sections.

## 3. Goals

- Create and maintain acceptance criteria for a local Git project.
- Detect common deterministic checks without executing them automatically.
- Run selected checks with cancellation, timeouts, bounded logs, and live status.
- Run browser proof scenarios made of explicit actions and assertions.
- Map check and browser evidence to individual criteria.
- Produce standalone HTML and Markdown receipts.
- Bind every receipt to a repository fingerprint and detect staleness.
- Keep source code, logs, screenshots, and reports local.
- Prove the product by using DoneProof to verify DoneProof.

## 4. Non-Goals for Version 1

- AI-generated code review or semantic correctness claims.
- Cloud accounts, multi-user collaboration, billing, or hosted storage.
- GitHub App, CI provider, or pull-request integration.
- Arbitrary shell access.
- Universal language and framework support.
- Automatic execution of commands merely because they were detected.
- Cryptographic identity signing or public transparency logs.
- Claiming that passing tests proves unspecified behavior.

## 5. Supported Projects

Version 1 supports Git repositories containing:

- Node.js projects using npm-compatible `package.json` scripts.
- Python projects using recognizable pytest, Ruff, mypy, or build configuration.
- Static or locally served web applications that Playwright can reach.

Unsupported projects may still be registered and documented, but DoneProof must report missing detection as **unproven** instead of guessing commands.

## 6. Core User Flow

1. The user selects a local Git repository through a native folder picker.
2. DoneProof detects the repository, stack, Git state, and candidate checks.
3. The user creates a proof contract with a goal and ordered acceptance criteria.
4. The user selects detected checks and associates them with criteria.
5. The user optionally creates browser scenarios using explicit visit, click, fill, press, URL assertion, text assertion, visibility assertion, and screenshot steps.
6. DoneProof displays the complete execution manifest before the first run.
7. The user starts a run. Checks execute sequentially in version 1 to keep logs and failures understandable.
8. DoneProof captures exit codes, durations, bounded stdout/stderr, browser assertions, screenshots, Git state, and content hashes.
9. The evidence engine computes a verdict for each criterion.
10. The user opens or exports a standalone delivery receipt.
11. DoneProof recalculates the repository fingerprint when the receipt is viewed and marks it stale if relevant project state changed.

## 7. Verdict Semantics

Verdicts are deterministic:

- **Proven:** every required evidence item attached to the criterion passed and all referenced artifacts exist with matching hashes.
- **Failed:** at least one required evidence item completed with a failing exit code or failed assertion.
- **Unproven:** no evidence is attached, evidence was skipped/cancelled/timed out, an artifact is missing, or evidence cannot be interpreted deterministically.

Project-level status is:

- **Proven** only when all required criteria are proven.
- **Failed** when any required criterion failed.
- **Unproven** otherwise.

Informational criteria do not block the project verdict but remain visible.

## 8. Architecture

DoneProof uses Electron, React, and TypeScript.

### Electron Main Process

Owns all privileged operations:

- Native folder selection.
- Filesystem access and path validation.
- Git inspection.
- Project detection.
- Process execution and cancellation.
- Playwright orchestration.
- Atomic persistence and report export.

The renderer never receives unrestricted filesystem or process APIs.

### Preload Bridge

Exposes a narrow typed API through Electron context isolation. Every request validates input in the main process. No raw Node integration is enabled in the renderer.

### React Renderer

Implements five primary surfaces:

- Project library.
- Contract editor.
- Verification configuration.
- Live run console.
- Receipt viewer.

### Domain Modules

- **Project Detector:** returns stack facts and candidate commands.
- **Git Fingerprint:** returns commit, dirty state, diff hash, and repository identity.
- **Safe Runner:** executes structured executable/argument arrays without a shell.
- **Browser Proof:** executes typed Playwright steps and produces assertions and screenshots.
- **Evidence Engine:** maps results to criteria and derives verdicts.
- **Receipt Generator:** creates standalone HTML and Markdown.
- **Local Store:** persists projects and run metadata using atomic JSON writes.

Domain logic remains independent from Electron where possible so it can be tested in Node.

## 9. Command Detection and Execution

### Node.js

Candidate checks come only from scripts already declared in `package.json`. Recognized semantic names include test, lint, build, typecheck, check, and their common variants. Commands are launched through the detected package manager executable with fixed arguments such as `npm run test`.

### Python

Candidate checks are emitted only when supporting configuration or dependencies are present. Initial supported commands are pytest, Ruff check, mypy, and `python -m build`.

### Execution Rules

- No shell interpolation.
- No free-form command field in version 1.
- The working directory is the selected project root.
- Each check has a configurable bounded timeout.
- Output is streamed live and stored with a size cap.
- Cancellation terminates the spawned process tree.
- Sensitive-looking values are redacted from displayed and exported logs.
- A detected command must be explicitly selected before it can run.

## 10. Browser Proof Model

A browser scenario contains:

- Name and optional criterion association.
- Base URL.
- Optional structured start command selected from detected scripts.
- Readiness URL and timeout.
- Ordered actions and assertions.

Supported steps:

- `visit`
- `click`
- `fill`
- `press`
- `assertText`
- `assertVisible`
- `assertUrl`
- `screenshot`

Selectors and values are stored as data. Scenario execution does not evaluate arbitrary JavaScript.

Screenshots are evidence artifacts with SHA-256 hashes. A failed browser assertion captures a failure screenshot when possible.

## 11. Persistence and File Layout

Shareable project configuration lives at the repository root:

```text
doneproof.yml
```

Run artifacts live locally under:

```text
.doneproof/
  runs/
    <run-id>/
      manifest.json
      result.json
      logs/
      screenshots/
      receipt.html
      receipt.md
```

The application stores its project registry and UI preferences in Electron's user-data directory. Writes use a temporary file followed by an atomic rename. DoneProof offers to add `.doneproof/` to `.gitignore` but never modifies `.gitignore` silently.

## 12. Repository Fingerprint and Staleness

Every run records:

- Repository root identity.
- Current branch when available.
- HEAD commit hash when available.
- Hash of the working-tree diff.
- Hash of `doneproof.yml`.
- Hashes of all evidence artifacts.
- DoneProof version.
- Start and completion timestamps.

A receipt is stale when the current commit, dirty diff, or proof contract differs from the recorded fingerprint. Staleness is separate from the historical verdict: the receipt preserves what passed at the time but warns that it no longer describes the current project state.

## 13. Receipt Design

The receipt begins with:

- Project and goal.
- Overall verdict.
- Staleness status.
- Commit and branch.
- Verification timestamp and duration.
- Counts of proven, failed, and unproven criteria.

Each criterion shows:

- Requirement text and importance.
- Verdict with plain-language reason.
- Attached checks and assertions.
- Relevant log excerpt.
- Screenshots.
- Artifact hashes and technical details in a secondary section.

The standalone HTML contains inline CSS and embedded small images so it opens without a server. Markdown uses relative artifact links when exported as a folder.

## 14. Error Handling

- Invalid or inaccessible repository: actionable error, no project record created.
- Git unavailable: project may be inspected, but version binding is unproven and clearly labeled.
- Missing executable: check becomes unproven with installation guidance.
- Timeout or cancellation: unproven, never failed unless the configured evidence explicitly defines timeout as failure in a later version.
- Report generation failure: preserve raw evidence and allow retry without rerunning checks.
- Corrupt state: retain the unreadable file, create a recovery copy, and avoid destructive reset.
- Missing artifact: mark affected criteria unproven.

## 15. Security and Privacy

- `contextIsolation` enabled and `nodeIntegration` disabled.
- Typed, allowlisted IPC methods only.
- Canonical path checks prevent access outside the selected repository except explicit export destinations.
- No telemetry, accounts, or network service owned by DoneProof.
- No `.env` parsing or secret collection.
- Redaction covers common token/key/password patterns and user-defined literals.
- The product warns users not to run checks from untrusted repositories.
- The application never implies that local execution is a security sandbox.

## 16. Visual Direction

DoneProof uses a calm evidence-console aesthetic rather than a generic SaaS dashboard:

- Neutral ink and slate surfaces.
- Green, amber, and red reserved for verdicts.
- Dense technical detail is progressively disclosed.
- The receipt remains legible when printed or saved as PDF.
- Keyboard navigation and visible focus states are required.
- Empty states teach the next action without decorative filler.

## 17. Testing Strategy

### Unit Tests

- Project detection.
- Structured command generation.
- Path containment.
- Fingerprinting and staleness.
- Redaction.
- Evidence-to-verdict rules.
- Receipt rendering.
- State migration and atomic persistence.

### Integration Tests

Temporary fixture repositories cover:

- Passing and failing checks.
- Timeout and cancellation.
- Large and sensitive output.
- Clean and dirty Git states.
- Missing executables and artifacts.
- Successful and failing browser scenarios.

### End-to-End Tests

Electron tests cover creating a project, editing a contract, selecting checks, running verification, inspecting a receipt, exporting it, and detecting staleness.

### Dogfood Acceptance

DoneProof must verify its own repository and produce a real receipt proving its required checks. The final handoff includes that receipt.

## 18. Definition of Done

Version 1 is complete when:

- The Windows application starts from documented commands and packages successfully.
- A Node fixture can produce proven, failed, and unproven criteria.
- A browser scenario produces assertions and screenshots.
- Receipts open independently of the app.
- Staleness is detected after a source change.
- Unit, integration, and end-to-end suites pass.
- Build, lint, and typecheck pass.
- DoneProof produces its own delivery receipt.
- Setup and usage documentation is sufficient for a new user.
- `TODO.md` contains no unresolved release-blocking item.

