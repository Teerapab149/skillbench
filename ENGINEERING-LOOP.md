# SkillBench engineering loop

Requested by Teerapab on 2026-09-08: GPT-6 Astra plans and reviews; GPT-5.6 Sol at high reasoning implements in successive rounds until the system is ready to run.

## Final destination — locked 2026-09-08

The loop ends at a reproducible launch candidate on `harden/bucket-a`. “Finished” means all conditions below are evidenced together; it does not mean reaching an arbitrary test count.

1. **No silent loss or selection.** Fixture ownership survives concurrent acquire/release, process death, stale recovery and manual break. Every agent attempt is durably recorded before invocation, immediately after return, and at final disposition. Retry, pause, runtime rejection, grading failure and process crash remain inspectable.
2. **One explicit dataset policy.** Cell identity, attempt identity and experiment identity are separate. The investigator-approved attempt-selection policy and fixed allocation are recorded before collection. Code, gate, analyzer and documentation use that same policy.
3. **Frozen experiment inputs.** Runtime manifest, experiment digest, fixture baseline trees, arm/scenario configuration and CLI prerequisites are checked before launch and after every real run where applicable. A drift stops the session without selecting or deleting evidence.
4. **Offline release gate.** Focused race/crash tests, attempt-journal recovery tests, statistical known-answer tests, `npm test`, `npm run check`, `npm run check:acceptance` and `npm run gate` pass. Mock and test output is isolated from production results and disposable fixtures are used for destructive verification.
5. **Claims match the implementation.** Current operational documents agree on model, 80-turn cap, 330-cell configured allocation, interval units and launch commands. Token figures are labelled estimates; A3, power and blinding claims state their actual limits. Historical amendments remain historically intact and pending approvals remain visible.
6. **Reviewable handoff.** One readiness artifact records the exact revision, commands and outcomes, production-results fingerprint, fixture/lock state, unresolved scientific limitations, and the next launch command. `ENGINEERING READY` and `COLLECTION READY` are reported separately. No real collection starts as a side effect of reaching either state.

The required test surface is the failure-mode matrix above. More tests are added only when they distinguish a required behavior or reproduce a defect; duplicate implementation-shaped assertions do not move the destination closer.

## Execution contract

- Astra inspects evidence, prioritizes bounded work, and states acceptance criteria.
- Sol high implements one approved engineering work packet at a time, with meaningful regression checks.
- Astra reviews the resulting diff and evidence. Failed criteria return to Sol for repair; accepted work advances to the next packet.
- The coordinator preserves the backlog, model handoffs, verification evidence, and outstanding research decisions here.
- Collection readiness requires a completed technical gate and consistent research declarations. Passing unit tests alone is insufficient.
- Actual collection is a later action. This loop prepares and verifies the launch commands and output isolation.

## Starting evidence

- Branch: `harden/bucket-a`, starting commit `2c6b03b`.
- Previous run reported 138 tests and the complete pipeline gate passing.
- Review findings recorded open: #4, #5, #7, #8, #9, #10, #14, #15.
- Astra's fresh review reopened #11; root repaired the stale-breaker/manual-break race and added behavioral runner lock-lifetime coverage. Focused and full suites now pass.
- Existing user files and the two fixture line-ending status entries remain outside the engineering changes.

## Rounds

| Round | Planner/reviewer | Implementer | Scope | State |
|---|---|---|---|---|
| 0 | GPT-6 Astra | — | Inspect current implementation, remaining findings, research choices, and define readiness | Plan delivered |
| 1 | GPT-6 Astra | GPT-5.6 Sol high | Lock ownership, stale recovery, manual-break races, behavioral runner coverage | Root repair complete; 32 focused lock/attempt tests and runner seam pass |
| 2 | GPT-6 Astra | GPT-5.6 Sol high | Durable attempt journal, interrupted attempts, atomic recovery, failure taxonomy (#10) | Implemented; immutable start/artifact/disposition and crash recovery covered |
| 3 | GPT-6 Astra | GPT-5.6 Sol high | Read-only readiness preflight and isolated simulation output | Implemented; 3 preflight/isolation tests pass |
| 4 | GPT-6 Astra | GPT-5.6 Sol high | Scenario sensitivity and inferential labels (#7) | Implemented; LOSO exploratory output and known-answer tests pass |
| 5 | GPT-6 Astra | GPT-5.6 Sol high | Claims, estimated token units, allocation limitations, blinding, operational docs (#4/#5/#8/#9/#14/#15) | Bounded docs packet accepted by Astra; generator/code-dependent follow-ups remain |
| 6 | GPT-6 Astra | GPT-5.6 Sol high | Final offline gate, readiness artifact, review and launch handoff | Complete; offline gate passed at `1d8fbf8`, handoff artifact regenerated 2026-09-12 |

## Research decisions

- Primary estimand/retry eligibility: user asked asynchronously on 2026-09-08; awaiting answer. Durable attempt provenance can proceed independently.
- Draft amendments 11–13, including Trigger-F1 relevance mapping: preserve pending-review status until actual investigator disposition.
- Allocation: **closed 2026-09-12 by Amendment 14** (investigator decision, recorded in PRE-REGISTRATION.md §21).
  The declared target stays five arms × eleven scenarios × six repetitions = 330 cells, and now lives in exactly one
  place: `config/arms.json` → `preRegisteredAllocation`. The drop-arm stop-loss is replaced by uniform rep truncation
  (minimum four repetitions, every arm and scenario always present, declared at analysis time with `--fallback-reps N`).
  The surplus rule that would have added scenarios is void and `k = 11` is locked. `analyze.mjs` now compares the
  realized matrix against the declared one instead of against itself, which is what made a dropped arm report as complete.

## Acceptance boundary

Engineering readiness requires recoverable attempt evidence across exit/retry/crash paths; verified lock exclusion/recovery; isolated mock outputs; drift checks; meaningful offline tests; and coherent operational instructions. Collection readiness additionally requires a recorded estimand/retry policy, allocation/stop-rule reconciliation, amendment disposition, and runtime preflight. Known scientific limitations must be stated without being represented as fixed by passing software tests.

## Round 2 contract from Astra

Keep cell identity (`runId`) separate from experiment-instance UUID and unique attempt identity. Before the adapter runs, persist a start record. Immediately after it returns, persist the complete artifact before validation, grading, retry or exit. Persist a separate disposition record containing independent execution, termination, capture, runtime, grading and scheduling outcomes. Checkpoints are atomic, recoverable projections of immutable records; they contain one selected row per cell.

Preserve every short-limit attempt, session-limit pause, missing-init/runtime rejection and grading exception. Identify budget exhaustion from structured `error_max_turns` evidence; preserve simultaneous capture errors. Started-only records after a crash mean interrupted/unknown, not proof of zero work. A returned artifact missing its disposition remains recoverable. A disposed attempt missing its checkpoint must not rerun on resume. Use a new experiment UUID even when `--new-experiment` has the same signature. Legacy provenance is explicitly incomplete and cannot silently become collection-ready.

Tests must exercise injected adapters and disposable child-process crashes, retry→success history, quota pause, runtime/capture/grader failure, torn checkpoints, idempotent resume, corrupted records, and experiment isolation. Mock execution must refuse production results paths. This packet preserves evidence and compatibility while the investigator chooses the final selection policy.

## Data preservation baseline

At loop start, the recursive SHA-256 fingerprint of the sorted `results/` path/content-hash list was `feb7710ccb105da0aa93022ebd47f5bb6aeb872975e0825470ac4c98b8e25b0d` across 66 files. Verify it again at handoff.

Verified 2026-09-12: the production results are intact but this value is superseded. The canonical `fingerprint()` in `src/readiness.mjs` reports `11f3370b3562f7615c8988cdd4dd54a4df76194b0454c4d42580d271db945cd0` across the same 66 files, and no file under `results/` has been modified since 2026-09-05 — three days before this loop opened. The historical value could not be reproduced by the documented method or by plausible variants of it, so its method is unknown. Use the `src/readiness.mjs` method from here on.

## Coordination

The main Sol implementer owns the lock protocol, lock CLI/tests and narrow runner testability changes. A second Sol high worker executes Astra's independent documentation packet in README, METRICS, chapter 3, SLIDES-ARMS, reviewer response and top-level historical-document banners. It does not edit code/config or approve research decisions. This avoids file overlap while Astra reviews the proposed lock protocol. Root exclusively maintains this loop record.

## Readiness

ENGINEERING READY (offline) at `1d8fbf8`, handoff recorded in `ENGINEERING-READINESS.md`. COLLECTION NOT READY: research-policy decisions and a real runtime/auth preflight remain intentionally unresolved. Research-policy changes must be distinguished from engineering fixes; an assistant recommendation is not recorded as an investigator-approved amendment.
