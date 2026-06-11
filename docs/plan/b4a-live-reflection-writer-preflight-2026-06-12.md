# B-4A Live Reflection Writer — Preflight / Contract

> HCC Phase B 车道一 | B-4A | 2026-06-12
> 执行人：Claude Code
> 基座：`08472ae`（UI closeout H 之后，working tree clean）
> 不启动 runtime / 不写 ~/.hermes / 不改 src/main / 不改 renderer / 不 push

## 1. Scope

B-4A is the **contract-only preflight** for the Live Reflection Writer. It defines the
writer's type shapes, safety invariants, single-writer rule, and the chain from task
artifact → reflection → B-3 evaluator → quarantine decision. Zero runtime, zero I/O,
zero live flush.

This document is the **approval gate for B-4B (Writer implementation)**. B-4B must
satisfy every invariant defined here before it can GO.

## 2. Writer Contract

### 2.1 Design Descriptor

```
WRITER_DESIGN = {
  writer_status: "contract_only",
  writer_allowed: false,
  live_flush_allowed: false,
  knowledge_ingest_allowed: false,
  knowledge_search_allowed: false,
  audit_write_allowed: false,
  persistence_allowed: false,
  next_task_context_write_allowed: false,
  live_ranking_mutation_allowed: false,
  config_write_allowed: false,
  single_writer_required: true,
  writer_owner: "hermes_main",
  b3_evaluator_required: true,
  quarantine_default: true,
  human_approval_ref_required: true,
  schema_version: "1.0.0"
}
```

### 2.2 Single-Writer Invariant

Only **one** writer may exist in Hermes main. Submitted-by rules:

| submitted_by | allowed to write canonical reflection? | constraint |
|---|---|---|
| `hermes_main` | **yes** (sole writer) | `human_reviewed` stays false unless `human_approval_ref` present |
| `claude_code` | **no** | may only submit candidate via handoff pack; writer rejects |
| `codex` | **no** | same as claude_code |
| `human` | **no** | human approves via ApprovalGate, does not write reflection directly |

The contract must assert that only `hermes_main` is the valid `submitted_by` for
a canonical `PostTaskReflection`. Any other submitter must be rejected at the
contract layer.

### 2.3 Writer Chain (pure projection)

```
task_result (task_id, artifact_ref, verification_result)
    │
    ▼
buildReflectionInput(task)          ← pure projection
    │
    ▼
buildPostTaskReflection(input)      ← LOOP-001 contract
    │
    ▼
evaluateReflectionReadOnly(...)     ← B-3 evaluator (read-only)
    │
    ▼
decideQuarantineForReflection(...)  ← quarantine decision (this contract)
    │
    ▼
WriterOutput { reflection, verdict, quarantine }
```

Every step is a pure function. No step reads from or writes to disk, config,
vault, knowledge store, or ~/.hermes.

### 2.4 Quarantine Decision Matrix

| condition | decision |
|---|---|
| `evidence=[]` on any draft | `reject` |
| agent-submitted (`claude_code` / `codex`) | `reject` |
| `verification_result=fail` + no human_reviewed | `remain_quarantined` |
| `verification_result=pass` + agent-submitted | `remain_quarantined` |
| `human_reviewed=true` + `human_approval_ref` present + `verdict.trust_band=human_reviewed_candidate` | `promotion_candidate` |
| any other case | `remain_quarantined` |

`promotion_candidate` does NOT mean live flush. The apply path stays closed (B-4C).

### 2.5 Safety Flag Invariants

Every `WriterOutput` must carry:
- `writer_allowed: false`
- `live_flush_allowed: false`
- `knowledge_ingest_allowed: false`
- `knowledge_search_allowed: false`
- `audit_write_allowed: false`
- `persistence_allowed: false`
- `next_task_context_write_allowed: false`
- `live_ranking_mutation_allowed: false`
- `config_write_allowed: false`
- `dry_run_only: true`
- `human_approval_ref.verified: false`
- `approval_gate.status: "closed"`

## 3. Deliverables

| File | Type | Purpose |
|---|---|---|
| `docs/plan/b4a-live-reflection-writer-preflight-2026-06-12.md` | preflight doc | this file |
| `src/shared/lib/post-task-reflection-writer-contract.ts` | pure contract | writer descriptor + single-writer guard + quarantine decider + projection helpers |
| `tests/post-task-reflection-writer-contract.test.ts` | contract tests | descriptor invariants + single-writer + quarantine matrix + safety flags |
| `tests/fixtures/learning-loop/ll013-b4a-writer-contract-quarantine.json` | quarantine fixture | documents B-4A as quarantined, not live |

## 4. NOT-GO List

These items are explicitly **NOT authorized** in B-4A, and any test that flips one
of these flags must fail:

| forbidden flag | value | guard |
|---|---|---|
| `writer_allowed` | `false` | descriptor assertion + runtime guard |
| `live_flush_allowed` | `false` | descriptor assertion + runtime guard |
| `knowledge_ingest_allowed` | `false` | descriptor assertion + runtime guard |
| `knowledge_search_allowed` | `false` | descriptor assertion + runtime guard |
| `audit_write_allowed` | `false` | descriptor assertion + runtime guard |
| `persistence_allowed` | `false` | descriptor assertion + runtime guard |
| `next_task_context_write_allowed` | `false` | descriptor assertion + runtime guard |
| `live_ranking_mutation_allowed` | `false` | descriptor assertion + runtime guard |
| `config_write_allowed` | `false` | descriptor assertion + runtime guard |
| `human_approval_ref.verified` | `false` | runtime guard |
| `approval_gate.approved` | `false` | runtime guard |
| submitted_by non-hermes_main | `reject` | single-writer guard |

## 5. Boundary

| constraint | held |
|---|---|
| No `src/main/` modification | ✅ |
| No `src/renderer/` / `src/screens/` / `src/preload/` | ✅ |
| No `package.json` / `package-lock.json` | ✅ |
| No `~/.hermes/**` write | ✅ |
| No `knowledgeIngest` / `knowledgeSearch` call | ✅ |
| No runtime / dev server / HCC Auto Executor | ✅ |
| No locked roadmap change | ✅ |
| No live flush declaration | ✅ |
| No git push | ✅ |

## 6. Acceptance

- [x] Writer design descriptor reports `contract_only` with all flags false
- [x] Single-writer guard rejects `claude_code` / `codex` / `human` as `submitted_by`
- [x] Quarantine decider returns correct decision per matrix
- [x] Writer projection chain produces valid `WriterOutput` from task input
- [x] Runtime guard rejects any tampered flag
- [x] All tests PASS; typecheck PASS; lock-verify PASS
- [x] Forbidden runtime scan: 0 hits

## 7. Go/No-go

- **B-4A PASS ⇒ GO B-4B** (Writer implementation in `src/main/`, single writer + uniqueness test). B-4B must satisfy every invariant in this contract.
- **B-4B PASS ⇒ GO B-4C** (Live Flush, separate approval). B-4C is NOT authorized by B-4A or B-4B.

## 8. Revision

- 2026-06-12 v1：B-4A preflight — writer contract, single-writer invariant, quarantine decider, projection chain, safety flag hard-wired false.
