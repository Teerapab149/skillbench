# Engineering readiness handoff

Generated 2026-09-12 on branch `harden/bucket-a`, re-run after Amendments 14 and 15. The engineering work is committed; the working tree is clean apart from the investigator's own report files, which remain untracked on purpose.

Supersedes the 2026-09-08 draft of this artifact, which was written from a working tree still being edited and therefore recorded an experiment digest that no longer existed by the time it was read.

## Decision

**ENGINEERING READY (offline). COLLECTION NOT READY.**

The implementation and the offline gate are ready for a reviewer to launch after the investigator records the scientific policy decisions below. This handoff does not start Claude or write production results.

## Evidence

All commands below were re-run on 2026-09-12 after the Amendment 14 and 15 changes to `config/arms.json`, `src/adapters/claude-cli.mjs`, `src/graders.mjs`, `src/runner.mjs`, `src/analyze.mjs`, `src/readiness.mjs` and `scripts/gate-analysis.mjs`.

- `npm test`: **172/172 passed**.
- `npm run check`: **passed** (design, spec traceability, and CLI prompt path).
- `npm run check:acceptance`: **passed** (11 baseline failures, 11 reference-green proofs, 10 wrong-answer and 7 alternate-answer variants; S05, S07 and S11 still have no alternate-answer variant).
- `npm run gate`: **passed** (172 known-answer tests, mock pipeline of 110 simulated runs, drift refusal, experiment isolation, analyzer and artifact gates, A4 exposure recomputation, the two allocation gates, and the budget-exhaustion estimand gate).
- Focused suites: lock + attempt journal **34/34**; runner lock lifetime **2/2**; stats + readiness **31/31**; budget exhaustion **5/5**.
- `node scripts/preflight.mjs --json`: read-only; engineering `true`, collection `false`; allocation `5 arms × 11 scenarios × 6 repetitions = 330 cells` **read from `config/arms.json` rather than hard-coded**, and checked against the arms and scenario files actually on disk (`allocation-declared` passes); model `claude-sonnet-5`, turn cap `80`.
- Fixture baseline: tag `skillbench-baseline` in the `fixtures/gpu-booking` repository points at tree `879c307bd9e3c67d88fbc7c9292d824785959afb`. Fixture working tree clean; current lock status empty; legacy v1 lock absent.
- Experiment digest: **`865265d3e3aaf21b`**. It has moved twice today, both times on purpose: `c2b6c73688e0fd7a` → `d80d67d06bce7de8` when Amendment 14 added `preRegisteredAllocation` to `config/arms.json`, then → `865265d3e3aaf21b` when Amendment 15 changed the adapter, graders and runner. All of those files are inside the digest because they can change what the experiment measures. One runtime manifest is present (`manifest-1b83634ad939.json`).
- `results/` inventory: 66 files, fingerprint `11f3370b3562f7615c8988cdd4dd54a4df76194b0454c4d42580d271db945cd0`.
- Preflight states not established offline: `auth-presence` **unknown** (no environment credential present; presence would not prove entitlement anyway) and `attempt-provenance` **unknown** (journal empty, 0 records, 0 orphan starts). Neither is an engineering defect; both require a real run.

## Two reconciliations closed

**Experiment digest.** The 2026-09-08 artifact recorded `bdb844e886672adc`. That value was captured while `src/runner.mjs` was still being written, and `src/runner.mjs` is one of the files the digest covers. The digest is a pure function of the content of `arms/`, `scenarios/`, `config/arms.json`, `config/rules-canonical.json` and the harness sources that can change what the experiment does, so the recorded value was stale the moment the last edit landed. The current tree computes `c2b6c73688e0fd7a`, unchanged across the commit. The superseded value should not be used for drift comparison.

**Results fingerprint.** The loop record kept `feb7710ccb105da0aa93022ebd47f5bb6aeb872975e0825470ac4c98b8e25b0d` as a data-preservation baseline across 66 files, while the canonical `fingerprint()` in `src/readiness.mjs` reports `11f3370b...` across the same 66 files. The production results were not altered: no file under `results/` has been modified since 2026-09-05, three days before the engineering loop opened. The historical value could not be reproduced from the current tree by the documented method or by the plausible variants of it (byte-ordered paths, `sha256sum`-style lines, content-only concatenation), so its method is unknown and it is superseded rather than explained. From here, the canonical method is the one in `src/readiness.mjs`: a recursive walk of `results/`, per-file SHA-256, rows joined as `path:hash` by newline, hashed once.

## What is now enforced

Turn-budget exhaustion is separated from infrastructure failure at the adapter, so it is graded, runtime-validated and counted toward the primary, with a sensitivity analysis printed beside it every time. Retries cover transient infrastructure failures only, and each cell takes the first usable attempt, where usable is defined without reference to the score. Fixture locks are canonical, fail-closed, process-aware, stale-reclaimable and outside the fixture tree. Runner lock lifetime is covered behaviourally through runtime validation, grading and final output, including early errors. Attempt provenance is append-only (`start`, `artifact`, immutable dispositions), with explicit retry/pause/crash recovery and a post-checkpoint commit marker. Mock output refuses `results/` and its descendants. Preflight is read-only. Scenario-level LOSO is exploratory only; primary inference remains exact sign-flip plus scenario-cluster bootstrap with correctly bounded labels.

## Collection blockers requiring investigator record

Two of the four are closed. The preflight now reports one pending research decision instead of three: only the Amendment 11–13 disposition is left, and blocker 4 is a real run rather than a decision.

1. Approve or reject Amendments 11–13 (including Trigger-F1 relevance mapping).
2. ~~Choose the failed-attempt estimand and retry/selection policy.~~ **Closed 2026-09-12 — Amendment 15** (PRE-REGISTRATION.md §22): budget exhaustion counts toward the primary with a paired sensitivity analysis, transient infra failures are retryable, and each cell takes the first usable attempt.
3. ~~Reconcile the fixed 330-cell allocation with the adaptive/drop-stop language.~~ **Closed 2026-09-12 — Amendment 14** (PRE-REGISTRATION.md §21): 330 cells confirmed, drop-arm replaced by uniform rep truncation, surplus/add-scenario rule void, allocation declared once in `config/arms.json` and enforced by `analyze.mjs` and preflight.
4. Run the real Claude CLI preflight once, confirming auth and the frozen runtime manifest. No API or Claude run has been started by this engineering loop.

## Launch command after approval

Run the read-only preflight, then the project's declared Claude command with an explicit production output directory and no concurrent fixture owner:

```text
node scripts/preflight.mjs --json
npm run gate0
npm run gate:rep0
npm run main
```

Use the investigator-approved retry/estimand policy and preserve the generated attempt-provenance journal. Do not use the mock adapter for production results.
