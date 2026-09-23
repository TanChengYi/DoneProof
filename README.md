# DoneProof

DoneProof is a local-first Windows desktop app that turns acceptance criteria into inspectable delivery evidence. It runs only the checks you approve, binds results to a Git fingerprint, and exports standalone HTML and Markdown receipts.

## Why it exists

AI can produce code quickly, but “done” is often still a claim. DoneProof records what was required, which deterministic checks ran, what each check produced, and whether the repository has changed since that evidence was collected.

## What V1 does

- Opens a local Node or Python project and detects declared quality checks.
- Lets you map required criteria to command or browser evidence in `doneproof.yml`.
- Runs commands without a shell, with timeouts, cancellation, bounded logs, and secret redaction.
- Runs typed Playwright browser scenarios and hashes captured screenshots.
- Marks each criterion `PROVEN`, `FAILED`, or `UNPROVEN`; missing or damaged evidence never passes optimistically.
- Exports portable HTML and Markdown receipts that retain the historical verdict and warn when the repository fingerprint is stale.

All project data remains on the machine. DoneProof has no telemetry or cloud service.

## Development

Requirements: Windows, Node.js 22 or newer, npm, Git, and WebView-capable Electron graphics support.

```powershell
npm ci
npm run dev
```

Quality and release commands:

```powershell
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run package:win
```

The Windows installer and portable executable are written to `release/`.

## First receipt

1. Open a project.
2. Review or edit its goal, acceptance criteria, detected checks, and browser scenarios.
3. Open **Verify**, inspect the manifest, then choose **Run verification**.
4. Inspect failures and unproven evidence in **Receipt**.
5. Export the receipt. If code, the contract, or the Git revision changes, the exported report clearly marks the recorded run as historical and stale.

To make DoneProof verify itself:

```powershell
npm run dogfood
```

The self-verification receipt is written under `.doneproof/runs/<run-id>/receipt.html` and is intentionally excluded from Git.

## Contract format

`doneproof.yml` contains a goal, criteria, checks, and browser scenarios. Checks are executable/argument arrays—not shell strings. The renderer cannot request arbitrary command execution; every IPC payload is validated in the Electron main process.

For a criterion to be `PROVEN`, every referenced evidence item must pass and every artifact hash must verify. Any failed evidence produces `FAILED`; missing, cancelled, timed-out, or integrity-invalid evidence produces `UNPROVEN`.

## Safety model

- Electron uses context isolation, a sandboxed renderer, and a narrow preload bridge.
- Commands use `shell: false` and run only from approved definitions.
- File evidence is constrained to the selected project and checked using canonical paths.
- Output is size-limited and likely credentials are redacted before storage or display.
- Receipts are historical records; staleness is calculated against the current commit, diff, and contract hashes.

## Supported projects and limitations

V1 detects npm scripts named `test`, `lint`, `build`, and `typecheck`, plus configured pytest, Ruff, mypy, and Python build projects. Browser proof supports a deliberately limited action vocabulary rather than arbitrary page evaluation.

The release target is Windows. There is no account system, remote collaboration, CI integration, automatic command approval, or cryptographic signing service in V1. A receipt proves only the configured evidence and should be reviewed like any other build artifact.

## Architecture

Electron owns filesystem, Git, process, Playwright, persistence, and export operations. React renders the project, contract, run, and receipt workflows through a typed preload API. Pure TypeScript domain modules calculate fingerprints, redact logs, derive verdicts, and render reports. State and run artifacts are stored atomically under the local application data directory or the selected project's `.doneproof/` directory.
