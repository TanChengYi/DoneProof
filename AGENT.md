# DoneProof Agent Playbook

This file records which model class should own each kind of work. `TODO.md` is the source of truth for current progress; this file is the routing policy.

## Model routing

| Work | Preferred model | Reasoning | Hand-off condition |
| --- | --- | --- | --- |
| Product discovery, unfamiliar repository analysis, architecture, security boundaries | GPT-6 Astra | High or XHigh | A written specification and an executable plan exist. |
| Cross-cutting implementation, Electron/IPC/process work, difficult defects | GPT-6 Astra | High | Focused regression tests pass and ownership boundaries are clear. |
| Sustained feature implementation, UI work, integration, repeated test/fix loops | GPT-6 Sol | High | The task is implemented, tested, and recorded in `TODO.md`. |
| Repository search, mechanical edits, fixture creation, straightforward test expansion | GPT-6 Luna | Medium | Changes are reviewed by the owning Sol/Astra phase. |
| Release blockers that survive systematic debugging | GPT-6 Astra | XHigh or Max | Root cause is demonstrated; do not escalate only because a task is long. |

## Autonomous workflow

1. Read `TODO.md`, Git status, recent commits, and the implementation plan before changing code.
2. Continue the first unchecked milestone; do not redo completed milestones.
3. Use red-green-refactor for behavior changes and keep deterministic evidence.
4. Update `TODO.md` only after fresh verification proves the milestone.
5. Before release, verify from a clean clone, smoke-test the packaged application, and run DoneProof against itself.
6. Never commit `.doneproof/`, exported receipts, local logs, test screenshots, or secrets.

## Current state

DoneProof V1 is complete and published. Future work should begin from an explicit new milestone in `TODO.md`; maintenance tasks should normally use GPT-6 Sol High, escalating to Astra only for architecture, security, or persistent cross-process defects.
