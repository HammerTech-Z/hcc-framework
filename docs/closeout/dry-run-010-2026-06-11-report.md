# dry-run010 Closeout — 2026-06-11

> A-4 dry-run010 受控 worktree 收口报告
> 执行人：Claude Code（独立 worktree `a4-dry-run-010-20260611`）
> 不启动 HCC Auto Executor / 不写 `~/.hermes/**` / 不改 main 仓受锁 src/**

## 1. 范围

| 项 | 状态 |
|---|---|
| 入口文件 | `tests/safety/hcc-dry-run-010-fixture.test.ts`（新建） |
| Fixtures | `tests/safety/__fixtures__/dry-run-010/{plan,handoff,progress-round-1,artifact}.json`（4 个新建） |
| 收口报告 | 本文件 |
| 不动文件 | main 仓 `src/main/` `src/renderer/` `src/screens/` `src/shared/lib/screen-boundary-contract.ts` `package.json` `package-lock.json` `.gitignore` — **全部 0 改动** |
| 现场脏文件（main 仓当前已 dirty，A-4 严禁触碰）| `.wolf/memory.md` / `CONTEXT.md` / `NEXT_STEP.md` / `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` / `docs/design/UI-GROUND-TRUTH-2026-06-04.md` / `docs/design/UI-SLICE-0-CONTRACT-AUDIT-2026-06-05.md` / `src/shared/lib/screen-boundary-contract.ts` / `docs/design/audit/Hermes-Pro-UI-Audit-And-Redesign-2026-06-11.md` / `docs/design/audit/Hermes-Pro-UI-BaiLongma-macOS-Audit-Pack-2026-06-11.md` / `docs/design/audit/Hermes-Pro-UI-Claude-Web-Additional-Info-2026-06-11.md` — **10 个全部 0 触碰** |

## 2. 现状（plan fixture 反映）

### 2.1 完成基线（completed_baseline）

- P3 dry-run 001-006 + 008 + 009 PASS（HCC harness 8 artifact）
- A-1 GOV-006 handoff/progress/danger policy committed（`e7db08b`）
- A-2 HumanApprovalRef adapter committed（`836fea4`）
- A-3 closeout errata committed（`e9cee80`）

### 2.2 进行中（in_progress）

- DRY-RUN-010：A-1 / A-2 首个 fixture 消费者

### 2.3 下一步（next_step）

- 构造 fixture + 跑测试 + 出报告（无需用户授权）

## 3. 验证结果

> ⚠️ 本报告由 Claude Code 在 worktree 内产出；测试 / typecheck / diff 命令由用户在真实终端执行以确认。
> 本报告仅记录**设计意图 + 已落盘事实**。

### 3.1 设计层断言

- `plan.json` 通过 `validateHCCTaskHandoffPlan` — `schema_version=1.0.0` / 单 `in_progress` / `completed_baseline` 全部 `verified=true` & `append_only=true`
- `progress-round-1.json` 通过 `validateHCCProgressRecord` — 含 4 段（`changed_this_round` / `last_successful_command` / `current_blocker` / `next_plan`）+ `trust_level=single_run`
- `handoff.json` 显式声明 `executable=false` / `dry_run=true` / `runtime_class=dry_run` + `forbidden_actions` 列表含 `spawn/exec/runPlaybook`
- `artifact.json` 含 `source_commits`（3 commits）+ `forbidden_fields_absent`（8 fields）

### 3.2 A-2 接入层断言

- `actor=human` + 匹配 anchor → `verified=true`
- `actor=ai` → throw（AI 自批禁止）
- `human_approval_ref.verified=true` → throw（契约层不变）
- 缺 anchor / anchor.revoked / anchor.gate 不匹配 → `verified=false`（不 throw，但拒绝）
- audit 写入 `${auditDir}/${reflection_task_id}.jsonl`（**非** `~/.hermes/audit`），auditDir 段含 `.hermes` 即 throw

### 3.3 边界断言

- `assertNoDangerPolicyAutoApproval().valid === true`
- 测试文件**不含** `spawn(` / `exec(` / `runPlaybook(` / `ipcMain.handle('hcc…')` / `BrowserWindow.create` 符号（静态 rg 断言）
- `safeMtime(~/.hermes/audit)` before/after 一致（无 `~/.hermes/` 写入）

## 4. 用户需手动验证

```bash
# 1. 进 worktree
cd ~/hermes-pro-a4-dry-run-010

# 2. 跑 typecheck + test（依赖 main仓 node_modules；worktree 已 symlink）
npm run typecheck
./node_modules/.bin/vitest run tests/safety/hcc-dry-run-010-fixture.test.ts --config vitest.config.ts

# 3. diff --check
git diff --check

# 4. 边界
stat -f "%m %N" ~/.hermes/config.yaml ~/.hermes/SOUL.md ~/.hermes/handoff/packs ~/.hermes/audit
bash ~/hermes-pro-work/scripts/lock-verify.sh

# 5. status
git status --short -uall
```

## 5. 已知边界

- **不启动 Auto Executor** — 010 是 dry-run 链扩展，不接真实执行入口（per `docs/p3-dry-run-baseline-2026-06-01.md` line158）
- **不写 `~/.hermes/`** — 所有 fixture 写入 tmpDir（`os.tmpdir()`），或 `tests/safety/__fixtures__/dry-run-010/`（git tracked）
- **不接 IPC / preload / renderer** — 仅 unit test 层面
- **不扩展到 A-5 / A-6** — 本任务边界严格到 fixture 构造 + 契约断言

## 6. 失败分类（按 §1 灵魂第一条）

如验证失败：

- **事故 1**：`validateHCCTaskHandoffPlan` invalid → A-1 契约破坏，回滚 plan.json
- **事故 2**：A-2 actor=ai 未 throw → A-2 自批防线破坏，紧急上报
- **事故 3**：测试文件出现 `spawn(` 符号 → 误接 Auto Executor，紧急停止 + 删符号
- **事故 4**：`~/.hermes/audit` mtime 变化 → 红线违反，紧急回滚 worktree

## 7. 修订记录

- 2026-06-11 v1：010 fixture 初版（A-1 + A-2 首次接入）
- 后续：用户验收 + commit 后由 A-5 GOV-007 B1 九闸评估引用本 fixture 作为 `hcc_auto_executor` 闸前置证据