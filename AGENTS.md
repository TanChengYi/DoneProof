# DoneProof Agent Instructions

## Mission

Build DoneProof into a reliable local desktop product that maps software acceptance criteria to deterministic evidence and produces version-bound delivery receipts.

## Source of Truth

- Product design: `docs/superpowers/specs/2026-09-23-doneproof-design.md`
- Implementation status: `TODO.md`
- Implementation plan: `docs/superpowers/plans/` once created

When instructions conflict, the approved product design wins unless the user explicitly changes scope.

## Autonomy

- Infer routine implementation details and continue toward a working product.
- Do not stop after planning or scaffolding.
- Ask only when a choice would materially change product scope, require credentials, spend money, publish externally, or perform an irreversible action not already authorized.
- The user has authorized creating and developing this repository and submitting the finished project to GitHub.
- Preserve evidence for every completion claim.

## Engineering Rules

- Use TypeScript in strict mode.
- Keep Electron privileged operations in the main process behind a narrow typed preload API.
- Keep domain logic independent of Electron wherever practical.
- Never run detected project commands automatically on first discovery.
- Never pass user-controlled command strings through a shell.
- Treat missing or ambiguous evidence as unproven.
- Prefer deterministic checks over model judgments.
- Use atomic persistence and explicit schema versions.
- Redact likely secrets before logs reach the renderer or exported receipts.
- Add or update tests before considering a behavior complete.
- Update `TODO.md` at every milestone and whenever blockers or risks change.

## Model Routing Guidance

The file records recommended routing; it does not itself switch the active Codex model.

| Work | Recommended model | Reasoning |
| --- | --- | --- |
| Product research, architecture, security boundaries, ambiguous failures, final acceptance | GPT-6 Astra | XHigh |
| Main implementation, refactoring, integration tests, iterative fixes | GPT-6 Sol | High |
| Repository inventory, mechanical edits, fixture expansion, documentation formatting | GPT-6 Luna | Medium |

Escalate to Astra when a decision crosses security/process boundaries, changes public interfaces, or two evidence-backed fix attempts fail. Use Luna only when the task is deterministic and independently verifiable. Model routing never reduces the required test or evidence standard.

## Completion Gate

Do not claim completion until:

- Build, lint, typecheck, unit, integration, and end-to-end checks pass.
- A packaged Windows build receives a smoke test.
- DoneProof generates a valid receipt for its own repository.
- The receipt is inspected for correctness and staleness behavior.
- `TODO.md` has no unresolved release blocker.

