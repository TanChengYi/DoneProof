# DoneProof V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and package a local Windows desktop application that maps acceptance criteria to deterministic command and browser evidence and exports version-bound delivery receipts.

**Architecture:** Electron owns privileged filesystem, Git, process, Playwright, persistence, and export operations behind a typed preload bridge. React renders the project, contract, run, and receipt workflows. Pure TypeScript domain modules compute fingerprints, redact logs, map evidence to verdicts, and render reports so most behavior can be tested without Electron.

**Tech Stack:** Electron, React 19, TypeScript 5, electron-vite, Vitest, Playwright, Zod, YAML, Lucide React, ESLint, electron-builder

**Spec:** `docs/superpowers/specs/2026-09-23-doneproof-design.md`

## Global Constraints

- Windows is the release platform; keep path and process behavior portable where practical.
- TypeScript uses strict mode and renderer Node integration stays disabled.
- Commands are executable/argument arrays and always run with `shell: false`.
- Detected commands require explicit selection; version 1 has no arbitrary command input.
- Missing or ambiguous evidence resolves to `unproven`, never an optimistic pass.
- Project data, logs, screenshots, and receipts remain local with no DoneProof telemetry.
- Persistent writes use schema versions and atomic replacement.
- Likely secrets are redacted before renderer or report exposure.
- Every task follows red-green-refactor and ends with a focused commit.

## Review Focus

- A symlink or `..` path escaping the selected project must be rejected by the path-containment tests in Task 3.
- A command producing secrets and more than the log limit must be redacted and truncated without deadlocking; Task 4 tests both in one run.
- A repository without Git or without a commit must still open while receipts remain explicitly unversioned/unproven; Task 3 covers both states.
- A cancelled or timed-out browser scenario must terminate its server and browser and yield `unproven`; Task 5 owns this test.
- A receipt with a missing or hash-mismatched artifact must become `unproven` and display the integrity problem; Tasks 6 and 7 pin this behavior.

---

## File Map

```text
package.json                         scripts and dependency contract
electron.vite.config.ts              Electron/Vite build entry points
electron-builder.yml                 Windows packaging configuration
eslint.config.js                     TypeScript/React lint rules
tsconfig.json                        shared strict compiler options
tsconfig.node.json                   main/preload compiler options
tsconfig.web.json                    renderer compiler options
src/shared/models.ts                 persisted and IPC domain types
src/shared/schemas.ts                Zod boundary schemas
src/main/index.ts                    Electron lifecycle and window creation
src/main/ipc.ts                      validated IPC registration
src/main/domain/path-policy.ts       canonical project containment
src/main/domain/project-detector.ts  Node/Python stack and check detection
src/main/domain/git-fingerprint.ts   commit/diff/contract fingerprinting
src/main/domain/redaction.ts         secret masking and bounded output
src/main/domain/verdict.ts           evidence-to-criterion verdict rules
src/main/services/store.ts           versioned atomic JSON persistence
src/main/services/runner.ts          structured command lifecycle
src/main/services/browser-proof.ts   Playwright scenario execution
src/main/services/run-service.ts     complete verification orchestration
src/main/services/receipt.ts         HTML/Markdown receipt rendering
src/preload/index.ts                 narrow typed context bridge
src/renderer/src/main.tsx            React bootstrap
src/renderer/src/App.tsx             navigation and application shell
src/renderer/src/api.ts              typed bridge adapter
src/renderer/src/styles.css          complete visual system
src/renderer/src/features/projects/  project library and onboarding
src/renderer/src/features/contract/  goal, criteria, and evidence editor
src/renderer/src/features/run/       manifest review and live console
src/renderer/src/features/receipt/   receipt summary and evidence viewer
tests/fixtures/                       deterministic Node/Python/web projects
tests/integration/                    filesystem/process/browser coverage
tests/e2e/                            Electron user journey
scripts/create-dogfood-contract.mjs   deterministic self-verification setup
README.md                             setup, usage, safety, architecture
```

### Task 1: Runnable Electron Shell and Shared Contract

**Files:**
- Create: `package.json`, lockfile, `electron.vite.config.ts`, `electron-builder.yml`
- Create: `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `eslint.config.js`
- Create: `src/shared/models.ts`, `src/shared/schemas.ts`
- Create: `src/main/index.ts`, `src/preload/index.ts`
- Create: `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/styles.css`
- Test: `src/shared/schemas.test.ts`

**Interfaces:**
- Produces: `ProjectRecord`, `ProofContract`, `Criterion`, `CheckDefinition`, `BrowserScenario`, `RunRecord`, `EvidenceResult`, `Verdict`, and `proofContractSchema`.

- [ ] **Step 1: Add the failing shared-schema test**

```ts
it('rejects a criterion without text', () => {
  expect(() => proofContractSchema.parse({ version: 1, goal: 'Ship', criteria: [{ id: 'c1', text: '', required: true }] })).toThrow();
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `npm test -- src/shared/schemas.test.ts`  
Expected: FAIL because the shared schema does not exist.

- [ ] **Step 3: Scaffold Electron/Vite and implement strict shared models**

```ts
export type Verdict = 'proven' | 'failed' | 'unproven';
export interface Criterion { id: string; text: string; required: boolean; evidenceIds: string[] }
export interface ProofContract { version: 1; goal: string; criteria: Criterion[]; checks: CheckDefinition[]; scenarios: BrowserScenario[] }
```

Configure `contextIsolation: true`, `nodeIntegration: false`, React strict mode, Vitest, ESLint, typecheck, build, and Windows NSIS/portable packaging scripts.

- [ ] **Step 4: Run baseline quality gates**

Run: `npm run typecheck && npm test -- src/shared/schemas.test.ts && npm run build`  
Expected: all pass and Electron/Vite emits main, preload, and renderer bundles.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json electron.vite.config.ts electron-builder.yml eslint.config.js tsconfig*.json src
git commit -m "chore: scaffold DoneProof desktop application"
```

### Task 2: Atomic Local Store and Project Registry

**Files:**
- Create: `src/main/services/store.ts`
- Create: `src/main/services/store.test.ts`
- Modify: `src/shared/models.ts`

**Interfaces:**
- Consumes: `ProjectRecord`, `RunRecord`.
- Produces: `createStore(root: string): LocalStore` with `listProjects()`, `saveProject(project)`, `saveRun(run)`, and `getRun(id)`.

- [ ] **Step 1: Write failure/recovery tests**

```ts
it('preserves a corrupt state file and starts with an empty schema', async () => {
  await writeFile(join(root, 'state.json'), '{broken');
  const store = await createStore(root);
  expect(await store.listProjects()).toEqual([]);
  expect((await readdir(root)).some((name) => name.startsWith('state.corrupt-'))).toBe(true);
});
```

Also test upsert-by-canonical-path, schema version `1`, and temp-file cleanup after a successful atomic rename.

- [ ] **Step 2: Confirm tests fail**

Run: `npm test -- src/main/services/store.test.ts`  
Expected: FAIL because `createStore` is missing.

- [ ] **Step 3: Implement the store**

```ts
export interface LocalStore {
  listProjects(): Promise<ProjectRecord[]>;
  saveProject(project: ProjectRecord): Promise<void>;
  saveRun(run: RunRecord): Promise<void>;
  getRun(id: string): Promise<RunRecord | null>;
}
```

Write JSON to `state.json.tmp`, fsync/close, then rename to `state.json`. On parse failure rename the source to `state.corrupt-<timestamp>.json` before creating clean state.

- [ ] **Step 4: Run store tests and full unit suite**

Run: `npm test -- src/main/services/store.test.ts && npm test`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/store.ts src/main/services/store.test.ts src/shared/models.ts
git commit -m "feat: add resilient local project store"
```

### Task 3: Project Detection, Safe Paths, and Git Fingerprints

**Files:**
- Create: `src/main/domain/path-policy.ts`, `src/main/domain/path-policy.test.ts`
- Create: `src/main/domain/project-detector.ts`, `src/main/domain/project-detector.test.ts`
- Create: `src/main/domain/git-fingerprint.ts`, `src/main/domain/git-fingerprint.test.ts`
- Create: `tests/fixtures/node-pass/package.json`, `tests/fixtures/python-pass/pyproject.toml`

**Interfaces:**
- Produces: `assertInsideProject(projectRoot, candidate): Promise<string>`.
- Produces: `detectProject(root): Promise<ProjectDetection>`.
- Produces: `fingerprintRepository(root, contractPath): Promise<RepositoryFingerprint>`.

- [ ] **Step 1: Write failing detection and containment tests**

```ts
it('detects only declared npm checks', async () => {
  const result = await detectProject(nodeFixture);
  expect(result.checks.map((check) => check.id)).toEqual(['npm:test', 'npm:lint', 'npm:build', 'npm:typecheck']);
});

it('rejects a symlink escaping the project', async () => {
  await expect(assertInsideProject(root, join(root, 'escape', 'secret.txt'))).rejects.toThrow('outside the selected project');
});
```

Add Git tests for clean, dirty, no-commit, and Git-unavailable states; the latter two must return explicit `versioned: false` data rather than throw.

- [ ] **Step 2: Confirm focused failures**

Run: `npm test -- src/main/domain/path-policy.test.ts src/main/domain/project-detector.test.ts src/main/domain/git-fingerprint.test.ts`  
Expected: FAIL for missing implementations.

- [ ] **Step 3: Implement deterministic detection and SHA-256 fingerprinting**

```ts
export interface RepositoryFingerprint {
  versioned: boolean;
  branch: string | null;
  head: string | null;
  diffHash: string;
  contractHash: string | null;
}
```

Use canonical real paths for containment. Generate command definitions only from recognized `package.json` scripts or present Python tool configuration. Invoke Git with argument arrays.

- [ ] **Step 4: Run domain tests**

Run: `npm test -- src/main/domain`  
Expected: PASS on Windows, including no-commit fixture behavior.

- [ ] **Step 5: Commit**

```bash
git add src/main/domain tests/fixtures
git commit -m "feat: detect projects and bind proof to git state"
```

### Task 4: Structured Command Runner, Redaction, and Cancellation

**Files:**
- Create: `src/main/domain/redaction.ts`, `src/main/domain/redaction.test.ts`
- Create: `src/main/services/runner.ts`, `src/main/services/runner.test.ts`
- Create: `tests/fixtures/process/emit.mjs`

**Interfaces:**
- Produces: `redactAndLimit(chunk, options): RedactedOutput`.
- Produces: `createRunner(): SafeRunner` with `run(spec, hooks, signal): Promise<CommandResult>`.

- [ ] **Step 1: Write runner contract tests**

```ts
it('redacts secrets and truncates bounded output without hanging', async () => {
  const result = await runner.run({ executable: process.execPath, args: [emitFixture, '--secret', 'sk-test-123', '--bytes', '20000'], cwd: root, timeoutMs: 5000, maxOutputBytes: 1024 }, hooks, signal);
  expect(result.output).not.toContain('sk-test-123');
  expect(result.output).toContain('[REDACTED]');
  expect(result.truncated).toBe(true);
});
```

Add tests for success, nonzero exit, timeout, user cancellation, nonexistent executable, streaming order, and `shell: false` metacharacter handling.

- [ ] **Step 2: Confirm runner tests fail**

Run: `npm test -- src/main/services/runner.test.ts`  
Expected: FAIL for missing runner.

- [ ] **Step 3: Implement the runner**

```ts
export interface CommandSpec { id: string; executable: string; args: string[]; cwd: string; timeoutMs: number; maxOutputBytes: number }
export interface CommandResult { status: 'passed' | 'failed' | 'unproven'; exitCode: number | null; durationMs: number; output: string; truncated: boolean; reason?: string }
```

Use `spawn(executable, args, { cwd, shell: false, windowsHide: true })`. Terminate child trees on Windows with a narrowly targeted `taskkill /PID <pid> /T /F`; on POSIX terminate the process group. Timeout and cancellation return `unproven`.

- [ ] **Step 4: Run runner and domain suites**

Run: `npm test -- src/main/services/runner.test.ts src/main/domain/redaction.test.ts`  
Expected: PASS with no leaked test secret.

- [ ] **Step 5: Commit**

```bash
git add src/main/domain/redaction* src/main/services/runner* tests/fixtures/process
git commit -m "feat: execute bounded verification commands safely"
```

### Task 5: Browser Proof Scenarios

**Files:**
- Create: `src/main/services/browser-proof.ts`, `src/main/services/browser-proof.test.ts`
- Create: `tests/fixtures/web-proof/server.mjs`, `tests/fixtures/web-proof/index.html`
- Modify: `src/shared/models.ts`, `src/shared/schemas.ts`

**Interfaces:**
- Consumes: `BrowserScenario`, `SafeRunner`, project path policy.
- Produces: `runBrowserScenario(scenario, context): Promise<BrowserEvidenceResult>`.

- [ ] **Step 1: Add schema and execution tests**

```ts
it('captures a screenshot after deterministic actions and assertions', async () => {
  const result = await runBrowserScenario(signInScenario, context);
  expect(result.status).toBe('passed');
  expect(result.steps.every((step) => step.status === 'passed')).toBe(true);
  expect(await stat(result.screenshots[0].path)).toBeDefined();
});
```

Test invalid step data, failed text assertion with failure screenshot, readiness timeout, cancellation, and guaranteed server/browser teardown. Timeout and cancellation must be `unproven`.

- [ ] **Step 2: Confirm browser tests fail**

Run: `npm test -- src/main/services/browser-proof.test.ts`  
Expected: FAIL because the service is missing.

- [ ] **Step 3: Implement the typed Playwright executor**

Use an exhaustive switch over `visit`, `click`, `fill`, `press`, `assertText`, `assertVisible`, `assertUrl`, and `screenshot`. Do not expose `page.evaluate`. Hash each screenshot after it is written.

- [ ] **Step 4: Run browser proof integration tests**

Run: `npm test -- src/main/services/browser-proof.test.ts`  
Expected: PASS and no fixture server remains listening after the suite.

- [ ] **Step 5: Commit**

```bash
git add src/shared src/main/services/browser-proof* tests/fixtures/web-proof
git commit -m "feat: capture deterministic browser proof"
```

### Task 6: Evidence Engine and Run Orchestration

**Files:**
- Create: `src/main/domain/verdict.ts`, `src/main/domain/verdict.test.ts`
- Create: `src/main/services/run-service.ts`, `src/main/services/run-service.test.ts`
- Modify: `src/shared/models.ts`

**Interfaces:**
- Produces: `deriveCriterionVerdict(criterion, evidence): CriterionVerdict`.
- Produces: `deriveProjectVerdict(criteria): Verdict`.
- Produces: `createRunService(deps).execute(request, events, signal): Promise<RunRecord>`.

- [ ] **Step 1: Write truth-table tests**

```ts
it.each([
  [['passed', 'passed'], 'proven'],
  [['passed', 'failed'], 'failed'],
  [['passed', 'unproven'], 'unproven'],
  [[], 'unproven'],
])('maps required evidence %j to %s', (statuses, expected) => {
  expect(deriveCriterionVerdict(criterionFor(statuses), evidenceFor(statuses)).verdict).toBe(expected);
});
```

Add missing-artifact and hash-mismatch cases; both must be `unproven`. Test event order and that a failed check does not prevent independent later checks from gathering evidence.

- [ ] **Step 2: Confirm failures**

Run: `npm test -- src/main/domain/verdict.test.ts src/main/services/run-service.test.ts`  
Expected: FAIL for missing engine/service.

- [ ] **Step 3: Implement deterministic verdicts and orchestration**

Run selected checks sequentially, then scenarios sequentially. Persist a manifest before execution and a result after every evidence item so interruption leaves recoverable state. Emit typed progress events.

- [ ] **Step 4: Run orchestration suite**

Run: `npm test -- src/main/domain/verdict.test.ts src/main/services/run-service.test.ts`  
Expected: PASS for proven, failed, unproven, integrity failure, and interrupted-state cases.

- [ ] **Step 5: Commit**

```bash
git add src/main/domain/verdict* src/main/services/run-service* src/shared/models.ts
git commit -m "feat: derive evidence-backed completion verdicts"
```

### Task 7: Portable HTML and Markdown Receipts

**Files:**
- Create: `src/main/services/receipt.ts`, `src/main/services/receipt.test.ts`
- Create: `src/main/templates/receipt.css`
- Create: `tests/fixtures/receipts/mixed-run.json`

**Interfaces:**
- Consumes: `RunRecord`, current `RepositoryFingerprint`.
- Produces: `renderHtmlReceipt(input): string`, `renderMarkdownReceipt(input): string`, `exportReceipt(input, directory): Promise<ExportedReceipt>`.

- [ ] **Step 1: Write semantic receipt tests**

```ts
it('renders criterion verdicts, git identity, staleness, and integrity failures', () => {
  const html = renderHtmlReceipt(mixedRunWithMissingArtifact);
  expect(html).toContain('Evidence integrity problem');
  expect(html).toContain('UNPROVEN');
  expect(html).toContain(mixedRun.fingerprint.head!);
});
```

Also test HTML escaping, inline CSS, embedded small screenshots, Markdown relative links, print styles, and stale-versus-historical-verdict wording.

- [ ] **Step 2: Confirm renderer tests fail**

Run: `npm test -- src/main/services/receipt.test.ts`  
Expected: FAIL because receipt functions are missing.

- [ ] **Step 3: Implement receipt rendering and export**

Use escaped templates, semantic headings/tables, verdict tokens, expandable technical evidence, and `@media print`. Embed screenshots as data URLs only below a documented size threshold; otherwise copy them beside the report and link them.

- [ ] **Step 4: Run receipt tests and inspect fixture output**

Run: `npm test -- src/main/services/receipt.test.ts && npm run generate:receipt-fixture`  
Expected: PASS and `test-results/receipt-fixture/receipt.html` opens with no server.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/receipt* src/main/templates tests/fixtures/receipts package.json
git commit -m "feat: export standalone delivery receipts"
```

### Task 8: Validated IPC and Complete Desktop Workflow

**Files:**
- Create: `src/main/ipc.ts`, `src/main/ipc.test.ts`
- Modify: `src/main/index.ts`, `src/preload/index.ts`
- Create: `src/renderer/src/api.ts`
- Modify: `src/renderer/src/App.tsx`, `src/renderer/src/styles.css`
- Create: `src/renderer/src/features/projects/ProjectLibrary.tsx`
- Create: `src/renderer/src/features/contract/ContractEditor.tsx`
- Create: `src/renderer/src/features/run/RunWorkspace.tsx`
- Create: `src/renderer/src/features/receipt/ReceiptView.tsx`
- Test: matching `*.test.tsx` files for each feature

**Interfaces:**
- Consumes: all domain and service interfaces from Tasks 1–7.
- Produces: `window.doneproof` typed methods for project selection, inspection, contract persistence, run lifecycle, receipt export, and external opening.

- [ ] **Step 1: Write IPC boundary and primary UI tests**

```ts
it('does not expose arbitrary process execution', () => {
  expect(Object.keys(exposedBridge).sort()).toEqual(['cancelRun', 'chooseProject', 'exportReceipt', 'getProject', 'getRun', 'listProjects', 'onRunEvent', 'saveContract', 'startRun']);
});
```

UI tests cover the empty state, invalid criterion text, candidate-check selection, explicit first-run manifest, live events, failed/unproven copy, and keyboard-visible focus.

- [ ] **Step 2: Confirm UI tests fail**

Run: `npm test -- src/main/ipc.test.ts src/renderer/src/features`  
Expected: FAIL for missing IPC and components.

- [ ] **Step 3: Implement validated IPC and five-screen UI**

Validate every IPC payload with Zod in the main process. Keep navigation state explicit. Use CSS variables and semantic classes for neutral surfaces and verdict-only status colors. Include loading, empty, failure, and recovery states for every async surface.

- [ ] **Step 4: Run component, accessibility, lint, and build gates**

Run: `npm test && npm run lint && npm run typecheck && npm run build`  
Expected: PASS with no renderer Node globals.

- [ ] **Step 5: Commit**

```bash
git add src/main src/preload src/renderer
git commit -m "feat: deliver the DoneProof desktop workflow"
```

### Task 9: End-to-End Fixtures, Packaging, and Dogfood Receipt

**Files:**
- Create: `tests/e2e/doneproof.spec.ts`, `tests/e2e/helpers.ts`
- Create: `tests/fixtures/node-fail/`, `tests/fixtures/node-unproven/`
- Create: `scripts/create-dogfood-contract.mjs`
- Create: `doneproof.yml`
- Create: `README.md`
- Modify: `TODO.md`, `package.json`, `electron-builder.yml`

**Interfaces:**
- Consumes: the complete application.
- Produces: packaged Windows artifacts and `.doneproof/runs/<id>/receipt.html` for DoneProof itself.

- [ ] **Step 1: Write the end-to-end acceptance journey**

```ts
test('creates a mixed-verdict receipt and detects staleness', async ({ electronApp }) => {
  await addFixtureProject(electronApp, 'node-fail');
  await defineThreeCriteria(electronApp);
  await runSelectedChecks(electronApp);
  await expectReceiptCounts(electronApp, { proven: 1, failed: 1, unproven: 1 });
  await mutateFixtureSource();
  await expectReceiptStale(electronApp);
});
```

Add an export/open test and a cancellation test. Run fixtures from disposable copies so tests never dirty committed sources.

- [ ] **Step 2: Confirm E2E fails before wiring final scripts**

Run: `npm run test:e2e`  
Expected: FAIL until packaging/test launch helpers and fixtures are connected.

- [ ] **Step 3: Complete packaging, docs, and dogfood configuration**

Document install, development, safety model, supported stacks, first receipt, verdict semantics, and limitations. Generate DoneProof's contract with required criteria for lint, typecheck, unit/integration tests, E2E tests, build, and receipt portability.

- [ ] **Step 4: Run the complete release gate**

Run: `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build && npm run package:win`  
Expected: all pass; Windows installer/portable artifact exists under `release/`.

- [ ] **Step 5: Dogfood DoneProof and inspect the receipt**

Run: `npm run dogfood`  
Expected: `.doneproof/runs/<id>/receipt.html` reports all required DoneProof criteria proven, contains the current commit/diff fingerprint, and opens standalone. Modify a disposable source copy and verify the same receipt is displayed as stale.

- [ ] **Step 6: Update project progress and commit**

```bash
git add README.md TODO.md doneproof.yml package.json electron-builder.yml tests scripts
git commit -m "test: prove and package DoneProof v1"
```

### Task 10: Final Verification and GitHub Publication

**Files:**
- Modify: `TODO.md`, `README.md` only if verification finds documentation gaps

**Interfaces:**
- Consumes: packaged application, full test suite, dogfood receipt.
- Produces: clean release commit and public GitHub repository when authentication is available.

- [ ] **Step 1: Run verification from a clean checkout**

Clone the local repository into a temporary directory, install from the lockfile, and run: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`, and `npm run package:win`.

- [ ] **Step 2: Inspect material artifacts**

Open the packaged application, the exported HTML receipt, and the Markdown receipt. Confirm no secrets, absolute private paths, missing images, broken navigation, or optimistic verdicts appear.

- [ ] **Step 3: Resolve every release blocker and repeat affected checks**

Each fix begins with a regression test, changes only the owning module, and reruns the focused check plus the complete release gate when behavior crosses module boundaries.

- [ ] **Step 4: Mark the release complete**

Set all completed `TODO.md` milestones to checked, record exact commands and artifact paths, and commit with `docs: finalize DoneProof v1 release evidence`.

- [ ] **Step 5: Publish to GitHub**

Verify `gh auth status`, confirm no repository named `DoneProof` will be overwritten, create the repository with description “Evidence-backed delivery receipts for AI-built software”, push `main`, and attach the resulting repository URL to the handoff. Do not publish `.doneproof/`, logs, or local fixture artifacts.

