# B1 九闸 GO/NOT-GO 评估 — 2026-06-11

> A-5 GOV-007：B1 九闸评估 slice
> 执行人：Claude Code（独立 worktree `a5-gov-007-b1-20260611`）
> 基座：`bbad4b9`（A-4 merge to main）
> 不启动 runtime / 不写 `~/.hermes/**` / 不改 src/** / 不 push

## 1. 九闸评估表

> 命名映射：B1 矩阵 = `../../src/shared/lib/safety/b1-runtime-readiness-matrix.ts`（commit `c9492be`，design-time snapshot）。
> A-5 实测覆盖矩阵中 `blocked` → 更新为实测 status。矩阵用 `no_hermes_config_writes` / `hcc_auto_executor_live_apply` 分别对应 A-5 闸名 `no_hermes_writes` / `hcc_auto_executor`。

### 1.1 backend_daemon

| 维度 | 值 |
|---|---|
| **status** | `not_applicable` |
| **evidence command** | `ps aux \| grep -iE 'node\|server\|daemon' \| grep -v grep` |
| **evidence output** | 命中 VS Code Helper (node.mojom.NodeService) ×3、Codex app-server、大象 Helper (node.mojom.NodeService)、WindowServer (`-daemon`)、AudioComponentRegistrar (`-daemon`)、distnoted (`daemon`) 等非 Hermes 进程。**未发现 Hermes backend daemon 进程。** |
| **source refs** | `ps aux` 实测 + `src/main/index.ts` 是 Electron main 进程（GUI app，非 backend daemon） |
| **residual risk** | P3 dry-run 执行期间不涉及 daemon；A-6 首个真实任务也只在 worktree 执行 |
| **owner** | N/A（not applicable） |

### 1.2 channel_runtime

| 维度 | 值 |
|---|---|
| **status** | `not_applicable` |
| **evidence command** | `grep -Ec 'BrowserWindow\|ipcMain' src/main/index.ts` |
| **evidence output** | **123** 个 `ipcMain.handle`/`.on`——但这些是 Electron 原生 IPC，非"channel runtime 常驻自动执行"。当前 Hermes 无 channel runtime 自动调度。 |
| **source refs** | `src/main/index.ts`（Electron main）；`src/preload/index.ts`（IPC bridge） |
| **residual risk** | 123 IPC handlers 是被动调用（renderer → main）；不触发自动任务流。A-6 不接新 IPC。 |
| **owner** | N/A |

### 1.3 cron_scheduling

| 维度 | 值 |
|---|---|
| **status** | `not_applicable` |
| **evidence command** | `ps aux \| grep -iE 'cron\|launchd.*hermes\|hermes.*cron' \| grep -v grep` + `crontab -l 2>/dev/null \|\| true` |
| **evidence output** | `ps aux`：无 hermes cron 进程；`crontab -l`：无用户 crontab（输出空）。`src/main/cronjobs.ts` 模块存在（mtime 2026-06-11）但本 slice 未启动 cron runtime。 |
| **source refs** | `src/main/cronjobs.ts`；P7 4 个 cron 已切 `deliver=local`（db41a51 / 21129f5 / 28f0bff / skill-cleanup-weekly） |
| **residual risk** | cron 模块存在但未常驻；如后续启动 cron daemon 需走 B1 重评 |
| **owner** | N/A |

### 1.4 weixin_ingress

| 维度 | 值 |
|---|---|
| **status** | `not_applicable` |
| **evidence command** | `find src -iname '*weixin*' -o -iname '*wechat*' -o -iname '*ilink*' -o -iname '*wx*'` |
| **evidence output** | 空（src 树中无 weixin/wechat/ilink/wx 入口文件） |
| **source refs** | A-5 plan spec：weixin_ingress 预期 `not_applicable`（入口不存在） |
| **residual risk** | 零。P7 cron 已切 `deliver=local`。 |
| **owner** | N/A |

### 1.5 gateway_ipc

| 维度 | 值 |
|---|---|
| **status** | `not_applicable` |
| **evidence command** | `grep -Ec 'ipcMain' src/main/index.ts` |
| **evidence output** | 119 个 `ipcMain.handle` / `.on`——Electron 标准 IPC，非"gateway"常驻自动转发 |
| **source refs** | `src/main/index.ts`；矩阵原标记 `requires_separate_slice` 指向 `HERMES-GOV-007`（即本 A-5） |
| **residual risk** | 如后续引入 gateway（常驻 IPC 转发 / 外部 Gateway），需独立的 B1 重评 slice |
| **owner** | N/A |

### 1.6 hcc_auto_executor

| 维度 | 值 |
|---|---|
| **status** | `requires_user_authorization` |
| **evidence command** | `grep -rn 'hcc_auto_executor\|AutoExecutor\|auto.executor' src/main 2>/dev/null` |
| **evidence output** | 空——Auto Executor 未 import、未 start、未 wire。A-1 + A-4 证明 dry-run 和 contract 层面 ready，但常驻启动仍需用户独立授权。 |
| **source refs** | A-1 GOV-006 `assertHCCHandoffPolicyNoRuntimeAuthorization().no_hcc_auto_executor === true`；A-4 dry-run010 test 静态断言 `not.toMatch(/spawn\( \| exec\( \| runPlaybook\( /)`；`HCCNoRuntimeAuthorizationReport`（no_hcc_auto_executor: true） |
| **residual risk** | Auto Executor 常驻 = 独立批（plan A-6 spec）。常驻启动前不构成 `blocked`，但计入 `requires_user_authorization` 清单。 |
| **owner** | 用户（常驻启动需用户显式授权） |

### 1.7 user_authorization

| 维度 | 值 |
|---|---|
| **status** | `ready` |
| **evidence command** | `grep -n 'requires_user_authorization\|assertNoDangerPolicyAutoApproval' src/shared/lib/safety/hcc-task-handoff-policy.ts` |
| **evidence output** | `HCCDangerDecision = "requires_user_approval"`（line 34）；`assertNoDangerPolicyAutoApproval()`（line 344，13/13 tests pass）；A-2 `confirmHumanApproval` 拒绝 actor=ai / verified=true |
| **source refs** | A-1 handoff-policy + tests（commit `e7db08b`）；A-2 human-approval-gate + tests（commit `836fea4`）；`HCCTaskHandoffPlan.next_step.requires_user_authorization` |
| **residual risk** | 每任务仍需用户显式批——`requires_user_authorization` 不自消失 |
| **owner** | 用户（每任务单独批） |

### 1.8 no_hermes_writes

| 维度 | 值 |
|---|---|
| **status** | `ready` |
| **evidence command** | `stat -f "%m %N" ~/.hermes/config.yaml ~/.hermes/SOUL.md ~/.hermes/handoff/packs ~/.hermes/audit` |
| **evidence output** | config.yaml: `1780225681`（2026-06-02T12:28:01 UTC，未变）；SOUL.md: `1781150187`（2026-06-11T03:56:27 UTC，仅 P0-2 注入写入）；handoff/packs: `1780195726`（未变）；audit: `1780230084`（未变） |
| **source refs** | P0-1 LOCK.md v4 + lock-verify.sh（PASS=46 FAIL=0）；A-1 handoff-policy：`no_hermes_writes: true`（矩阵 `no_hermes_config_writes`）；A-4 dry-run010：audit 仅写 tmpDir |
| **residual risk** | 零。all Phase A slices 未触发 `~/.hermes/**` 写入（SOUL.md 除外——属 P0-2 用户批准的灵魂注入）。 |

### 1.9 no_runtime_mutation

| 维度 | 值 |
|---|---|
| **status** | `ready` |
| **evidence command** | `grep -n 'no_runtime\|no_daemon\|no_cron\|no_weixin\|no_live_apply\|no_hcc_auto_executor\|no_progress_file' src/shared/lib/safety/hcc-task-handoff-policy.ts` |
| **evidence output** | `HCCNoRuntimeAuthorizationReport` 全部 `true`（line 139-146 + 364-371）；test line 282 断言同步 |
| **source refs** | A-1 handoff-policy（`assertHCCHandoffPolicyNoRuntimeAuthorization()`）；矩阵 `assertB1MatrixNoRuntimeSideEffects()`（no_runtime_mutation: true / no_hermes_writes: true / no_daemon_or_cron_or_weixin_or_channel_or_live_apply_or_hcc: true） |
| **residual risk** | 零。Phase A 所有 slices 为 design-only / dry-run / pure contract。 |

## 2. GO/NOT-GO 裁决

### 2.1 裁决结论

**B1-GO / blocked=0** — 九闸无一 `blocked`。

| 闸 | 状态 |
|---|---|
| backend_daemon | not_applicable |
| channel_runtime | not_applicable |
| cron_scheduling | not_applicable |
| weixin_ingress | not_applicable |
| gateway_ipc | not_applicable |
| hcc_auto_executor | requires_user_authorization |
| user_authorization | ready |
| no_hermes_writes | ready |
| no_runtime_mutation | ready |

**blocked 计数 = 0**。满足 HCC-GO 条件一（B1 九闸 `blocked` 清零）。

### 2.2 requires_user_authorization 清单

| 项 | 当前状态 | 批注 |
|---|---|---|
| A-6 首任务启动 | **待用户批** | 启动前需用户显式 GO |
| A-6 首任务交付验收 | **待用户批** | 交付后用户签收 |
| Auto Executor 常驻启动 | **待用户批**（独立 slice，非 A-6 触发） | `hcc_auto_executor` 常驻 ≠ HCC-GO |
| Phase B 车道一（知识库）| **待用户批** | B-1~B-4 每个 slice 用户单批 |
| Phase B 车道二（其余）| **待用户批** | B-5~B-6 每 slice 单独批 |

### 2.3 blocked / residual risk 清单

**无 blocked 闸**。

residual risk 已在 §1 逐闸列明：

| 闸 | residual risk | 处置 |
|---|---|---|
| channel_runtime | 123 IPC handlers 存在（Electron 原生） | 不构成自动任务流；后续如接常驻 gateway → 独立 GOV-NNN |
| cron_scheduling | cron 模块存在（数据定义） | 不构成常驻执行；如后启 cron daemon → 独立重评 |
| gateway_ipc | 同 channel_runtime | 如后引 gateway 常驻 → 独立重评 |
| hcc_auto_executor | Auto Executor 常驻未授权 | 独立批（A-6 spec）；从 `ready` 改为 `requires_user_authorization`（v2） |

## 3. HCC-GO 四条件进度

| # | 条件 | 状态 |
|---|---|---|
|1 | B1 九闸 `blocked` 清零 | ✅ 已达成（本评估 B1-GO） |
|2 | `requires_user_authorization` 项全部由用户显式批 | ⏳ **部分**（见 §2.2 清单——本评估已逐项列出，待用户逐项批） |
|3 | dry-run 010 PASS | ✅ 已达成（A-4 commit `bbad4b9`，15/15 tests） |
|4 | A-6 首个真实任务交付 + 复盘入 LOOP 候选 | ⏳ **A-6 未启动** |

**HCC-GO 得分：2/4**。剩余 2 项全部由用户控制（#2 批清单 + #4 A-6 启动）。

## 4. 修订记录

- 2026-06-11 v2：勘误 backend_daemon 证据口径（如实记录非 Hermes 进程命中）；channel_runtime 命令修正为 `grep -Ec` + 实数值 123；cron_scheduling 补 `ps aux` + `crontab -l` 证据；hcc_auto_executor 状态 `ready` → `requires_user_authorization`；GO 口径改为 B1-GO / blocked=0 区分完整 HCC-GO（2/4）；文末 source links 改为 `../../src/...`
- 2026-06-11 v1：初版（GO，blocked=0）

## 5. 关联文档

- [A-1 GOV-006 handoff policy](../../src/shared/lib/safety/hcc-task-handoff-policy.ts)（commit `e7db08b`）
- [A-2 HumanApprovalRef gate](../../src/main/safety/human-approval-gate.ts)（commit `836fea4`）
- [A-4 dry-run010 closeout](../closeout/dry-run-010-2026-06-11-report.md)（commit `14d1a3c`）
- [B1 runtime-readiness matrix](../../src/shared/lib/safety/b1-runtime-readiness-matrix.ts)（design-time commit `c9492be`）
- [02-execution-plan §A-5](../plan/02-execution-plan.md)
- [LOCK.md](../../LOCK.md)（P0-1，lock-verify PASS=46 FAIL=0）
