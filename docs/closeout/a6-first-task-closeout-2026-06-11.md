# A-6 HCC 首个真实闭环任务 — 收口报告

> 任务：能力/领域注册表空壳
> 执行人：Claude Code（独立 worktree `a6-capability-registry-20260611`）
> 基座：`a7be913`（A-5 merge to main）
> 日期：2026-06-11

## 1. 改动范围

| 文件 | 类型 | 行数 |
|---|---|---|
| `src/shared/lib/registry/capability-registry.ts` | 新建 | ~80 |
| `tests/safety/capability-registry.test.ts` | 新建 | ~170 |
| `tests/fixtures/learning-loop/ll010-a6-first-task-quarantine.json` | 新建 | ~30 |
| 本报告 | 新建 | ~60 |

**未触碰**：`src/main/` / `src/renderer/` / `src/screens/` / `package.json` / `package-lock.json` / `.gitignore` / `~/.hermes/**` / 10 个脏文件。

## 2. 测试结果

```bash
npx vitest run tests/safety/capability-registry.test.ts --config vitest.config.ts
# → 16 passed (16)
npm run typecheck
# → node + web 双过
```

## 3. 能力范围

- `CapabilityRegistry`：entries 集合 + 查询 helpers（`listCapabilities` / `getCapabilityById` / `filterCapabilitiesByTrustLevel`）
- `DomainRegistry`：domains 集合 + `createEmptyDomainRegistry()` 空壳
- 不接活线自动登记 / 不调 `knowledgeIngest` / 不做 I/O / IPC / runtime / daemon

## 4. Rollback Plan

```bash
git revert <A-6-commit>
# 或直接删文件：
rm src/shared/lib/registry/capability-registry.ts
rm tests/safety/capability-registry.test.ts
rm tests/fixtures/learning-loop/ll010-a6-first-task-quarantine.json
rm docs/closeout/a6-first-task-closeout-2026-06-11.md
npx vitest run --config vitest.config.ts  # 确认基线不降
```

## 5. LOOP quarantine artifact

`tests/fixtures/learning-loop/ll010-a6-first-task-quarantine.json`：
- `reflection_task_id`: `HERMES-A6-001`
- `proposed_state`: `remain_quarantined`
- `human_approval_ref.verified`: `false`
- `evidence_refs` 指向本任务 3 个产物

## 6. HCC-GO 条件四

| # | 条件 | 状态 |
|---|---|---|
|1 | B1 九闸 blocked 清零 | ✅ A-5 |
|2 | requires_user_authorization 清单待用户批 | ⏳ |
|3 | dry-run 010 PASS | ✅ A-4 |
|4 | A-6 首个真实任务交付 + 复盘入 LOOP 候选 | ⏳ 待用户验收 |

本任务交付后，条件四达成。用户验收签 GO 后 HCC-GO = 3/4（#2 仍待用户逐项批）。

## 7. 修订记录

- 2026-06-11 v2：勘误 — 去 test 中 hardcoded worktree absolute path；改用 `import.meta.url` + `path.resolve` 自定位源码；合并到 main 后路径无漂移
- 2026-06-11 v1：A-6 首任务初版（16/16 tests）
