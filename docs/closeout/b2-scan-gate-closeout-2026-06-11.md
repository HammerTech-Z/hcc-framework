# B-2 Real Input Scan Gate — Closeout — 2026-06-11

> B-2 first slice — vault_import + local_file_import（仅已存在入口）
> 执行人：Claude Code（独立 worktree `b2-scan-gate-20260611`）
> 基座：`21f56fc`（HCC-GO authorization 签收后）
> 不启动 runtime / 不读 `~/.hermes/vault` / 不写 `~/.hermes/**`

## 1. 改动范围

| 文件 | 类型 | 状态 |
|---|---|---|
| `src/shared/lib/safety/real-input-scan-gate.ts` | 新建 | ~150 行 |
| `tests/safety/real-input-scan-gate.test.ts` | 新建 | ~200 行 |
| `tests/safety/external-input-scan-coverage.test.ts` | 追加 H-6 | +120 行 |
| `tests/fixtures/learning-loop/ll011-b2-scan-gate-quarantine.json` | 新建 fixture | ~30 行 |
| 本报告 | 新建 | ~80 行 |

**未触碰**：`src/main/` / `src/renderer/` / `src/screens/` / `package.json` / `package-lock.json` / `.gitignore` / `~/.hermes/**` / 10 个脏文件。

## 2. 测试结果（实测，非期望）

```bash
npx vitest run tests/safety/real-input-scan-gate.test.ts --config vitest.config.ts
# → 14/14 passed
npx vitest run tests/safety/external-input-scan-coverage.test.ts --config vitest.config.ts
# → 25/25 passed（原 17 + H-6 v3 追加 8）
npm run typecheck
# → typecheck:node + typecheck:web 双过
```

## 3. Scan Gate 设计要点

- `RealInputSource = "vault_import" | "local_file_import"`（仅已存在入口）
- 微信 / 飞书 / external_link / github / web **不建 gate**（plan B-2 spec）
- caller 传 `content` + `sourceRef`，adapter 不读 vault 或任何 fs
- `trust_level` 复用 A-1 `HCCProgressTrustLevel`（5 级 union）
- 决策携带 `*_allowed = false` 全部禁用：runtime / persistence / backend_daemon / cron / weixin / channel / live_apply / hcc_auto_executor

## 4. H-6 补齐（v3 实际）

`H6TrustLevelMatrix` — 6 条记录，覆盖 `HCCProgressTrustLevel` 5 级全量：

| trust_level | id | evidenceRef |
|---|---|---|
| `unverified` | external_input_scan_coverage_uncovered | external-input-scan-coverage.test.ts |
| `ai_inferred` | live_knowledge_ingest_external_content | live-knowledge-ingest-scan-gate.ts |
| `ai_inferred` | next_task_context_live_ingress | next-task-context-ingress-scan-gate.ts |
| `single_run` | real_input_scan | real-input-scan-gate.ts |
| `reproduced` | hcc_task_handoff_policy_gov006 | hcc-task-handoff-policy.ts |
| `human_confirmed` | user_signoff_authority | hcc-go-authorization-2026-06-11.md |

- `human_confirmed` 条目含 `reserved_for_user_signoff: true`（§3 自证可信禁止：AI 不自盖）
- 每条都有非空 `evidenceRef`
- 测试断言 5 级全命中 + human_confirmed reserved marker + 无 AI self-confirm path

## 5. Rollback Plan

```bash
git revert <B-2-commit>
# 或删文件：
rm src/shared/lib/safety/real-input-scan-gate.ts
rm tests/safety/real-input-scan-gate.test.ts
# coverage test 还原（删 H-6 describe 块）
npx vitest run --config vitest.config.ts  # 基线不降
```

## 6. LOOP Quarantine

`tests/fixtures/learning-loop/ll011-b2-scan-gate-quarantine.json`：
- `reflection_task_id`: `HERMES-B2-001`
- `proposed_state`: `remain_quarantined`
- `human_approval_ref.verified`: `false`
- `trust_level`: `single_run`

## 7. HCC-GO 条件二进展

- B-1（已被 A-6 消耗）
- **B-2（本 slice）— 待用户验收签 GO**
- B-3 / B-4 串行（每步用户单独批）
- Phase B 车道二 B-5/B-6 — HCC-STABLE 后开放

## 8. 修订记录

- 2026-06-11 v4：文档口径修正 — 测试结果从期望改为实测（14/14 + 25/25 + typecheck 双过）；H-6 §4 改为 v3 实际（H6TrustLevelMatrix 6 条 + 5 级表）；不改代码。
- 2026-06-11 v3：H-6 matrix 从 reserved marker 改为真实 `human_confirmed` trust_level + `reserved_for_user_signoff: true` 标记；5 级全覆盖；新增 `reproduced` 条目。
- 2026-06-11 v2：H-6 升级为 H6TrustLevelMatrix 真实结构（5 entry 含 id + trust_level + evidenceRef）；coverage test 24 tests；adapter 修 TS2367。
- 2026-06-11 v1：B-2 初版
