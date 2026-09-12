# Engineering readiness handoff

Generated 2026-09-12 on branch `harden/bucket-a` at commit `1d8fbf8`. The engineering work is now committed; the working tree is clean apart from the investigator's own report files, which remain untracked on purpose.

Supersedes the 2026-09-08 draft of this artifact, which was written from a working tree still being edited and therefore recorded an experiment digest that no longer existed by the time it was read.

## Decision

**ENGINEERING READY (offline). COLLECTION NOT READY.**

The implementation and the offline gate are ready for a reviewer to launch after the investigator records the scientific policy decisions below. This handoff does not start Claude or write production results.

## Evidence

All commands below were run on 2026-09-12 against `1d8fbf8`.

- `npm test`: **165/165 passed**.
- `npm run check`: **passed** (design, spec traceability, and CLI prompt path).
- `npm run check:acceptance`: **passed** (11 baseline failures, 11 reference-green proofs, 10 wrong-answer and 7 alternate-answer variants; S05, S07 and S11 still have no alternate-answer variant).
- `npm run gate`: **passed** (165 known-answer tests, mock pipeline of 110 simulated runs, drift refusal, experiment isolation, analyzer and artifact gates, A4 exposure recomputation).
- Focused suites: lock + attempt journal **34/34**; runner lock lifetime **2/2**; stats + readiness **29/29**.
- `node scripts/preflight.mjs --json`: read-only; engineering `true`, collection `false`; allocation `5 arms × 11 scenarios × 6 repetitions = 330 cells`; model `claude-sonnet-5`, turn cap `80`.
- Fixture baseline: tag `skillbench-baseline` in the `fixtures/gpu-booking` repository points at tree `879c307bd9e3c67d88fbc7c9292d824785959afb`. Fixture working tree clean; current lock status empty; legacy v1 lock absent.
- Experiment digest: **`c2b6c73688e0fd7a`**, computed before and after the commit with the same value. One runtime manifest is present (`manifest-1b83634ad939.json`).
- `results/` inventory: 66 files, fingerprint `11f3370b3562f7615c8988cdd4dd54a4df76194b0454c4d42580d271db945cd0`.
- Preflight states not established offline: `auth-presence` **unknown** (no environment credential present; presence would not prove entitlement anyway) and `attempt-provenance` **unknown** (journal empty, 0 records, 0 orphan starts). Neither is an engineering defect; both require a real run.

## Two reconciliations closed

**Experiment digest.** The 2026-09-08 artifact recorded `bdb844e886672adc`. That value was captured while `src/runner.mjs` was still being written, and `src/runner.mjs` is one of the files the digest covers. The digest is a pure function of the content of `arms/`, `scenarios/`, `config/arms.json`, `config/rules-canonical.json` and the harness sources that can change what the experiment does, so the recorded value was stale the moment the last edit landed. The current tree computes `c2b6c73688e0fd7a`, unchanged across the commit. The superseded value should not be used for drift comparison.

**Results fingerprint.** The loop record kept `feb7710ccb105da0aa93022ebd47f5bb6aeb872975e0825470ac4c98b8e25b0d` as a data-preservation baseline across 66 files, while the canonical `fingerprint()` in `src/readiness.mjs` reports `11f3370b...` across the same 66 files. The production results were not altered: no file under `results/` has been modified since 2026-09-05, three days before the engineering loop opened. The historical value could not be reproduced from the current tree by the documented method or by the plausible variants of it (byte-ordered paths, `sha256sum`-style lines, content-only concatenation), so its method is unknown and it is superseded rather than explained. From here, the canonical method is the one in `src/readiness.mjs`: a recursive walk of `results/`, per-file SHA-256, rows joined as `path:hash` by newline, hashed once.

## What is now enforced

Fixture locks are canonical, fail-closed, process-aware, stale-reclaimable and outside the fixture tree. Runner lock lifetime is covered behaviourally through runtime validation, grading and final output, including early errors. Attempt provenance is append-only (`start`, `artifact`, immutable dispositions), with explicit retry/pause/crash recovery and a post-checkpoint commit marker. Mock output refuses `results/` and its descendants. Preflight is read-only. Scenario-level LOSO is exploratory only; primary inference remains exact sign-flip plus scenario-cluster bootstrap with correctly bounded labels.

## Collection blockers requiring investigator record

1. Approve or reject Amendments 11–13 (including Trigger-F1 relevance mapping).
2. Choose the failed-attempt estimand and retry/selection policy.
3. Reconcile the fixed 330-cell allocation with the adaptive/drop-stop language still present in the planning documents.
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
