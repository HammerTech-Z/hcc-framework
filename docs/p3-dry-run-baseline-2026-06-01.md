# P3 dry-run baseline (2026-06-01)

> 状态：P3 dry-run 001-006 + 008 + 009 + P3 harness 8 artifact + P3.5 upgrade candidate 软切换均已通过（2026-06-02）；**P3.5 soft switch 1-2 天观察期已结束、由用户裁决 KEEP v0.15.1（2026-06-04，ADR-20260604-p3-5-soft-switch-decision-keep-v0-15-1）、`hermes` 入口保持指向 candidate v0.15.1、rollback 备份仍可回滚**。P7 WeChat/iLink 4 个低优先级 cron job 已切 `deliver=local`（2026-06-02）。BaiLongma Read-only Cockpit Final Polish PASS（2026-06-02）。**Knowledge Reuse Chain Slice 004-006.9 / 007A-007N / 008A-008M 已完成、6 commits 推送（2026-06-04：2f79c75 / 2a8dc08 / cdeea86 / 7c3e89b / d997914 / d5a6469），closeout base HEAD == origin/hermes-pro-main == d5a6469efd84ba98730c2fa3924e769019756077；当时工作区 clean**。V5 保持 `MVP_PARTIAL`；C4/C5 暂缓（非技术失败）。**HCC Auto Executor 仍不可用、未启动、未接线；P3 真实执行仍暂停；hard cutover 仍未批准；BaiLongma/HCC Productionization NOT APPROVED；L6 live knowledge flush 未批准；Knowledge Reuse Chain 当前只到 L5 dry-run / prompt-builder，不代表 live knowledgeIngest / live knowledgeSearch / default system prompt injection / Agent subprocess / L6 live flush 已启用**。
> 用途：把 001-006 + 008 + 009 的成果归档为当前 P3 基线事实源，让 Claude Code / Hermes / 后续 Agent 读到同一上下文，不再重复追问或误判 HCC Auto Executor 已经处于可用/已启动状态。
> 最高约束：`~/.hermes/HERMES-SOUL.md` v5.3。
>
> **当前测试基线（2026-06-04 更新）**：本文 §2 中 Slice 008 / Slice 009 / §8 P3 harness 引用的 `tests/safety 19 files / 470/470 PASS` / `tests/safety 20 files, 515/515 PASS` / `tests/safety 23 files, 625/625 PASS` / BaiLongma Final Polish `46 files / 995 tests PASS` 等数字均为该切片收口时点的局部事实源，**保留作历史证据，不再代表当前全量**。当前 Hermes Pro 全量测试基线为 **81 files / 2931 tests PASS**（typecheck EXIT 0；执行：`npm run typecheck && npx vitest run`；closeout base HEAD == `d5a6469efd84ba98730c2fa3924e769019756077`；当时工作区 clean）。后续 §2 / §8 中任何"X files / Y tests"数字均为该切片收口时点的局部事实源；新引入的"X files / Y tests"必须与提交时点对应。

---

## 1. P3 dry-run 当前状态（一句话）

**P3 端到端 dry-run 契约（001-006）已完整，Slice 008 补 Handoff payload temp fixture + local verifier-only check，Slice 009 补 Artifact Store dry-run record（plan + handoff 可被 P2.5 append-only audit log 消费）；真实执行入口未启、未批、未接线。P3 harness 8 artifact（Chain Test 002 + Code Task 003-006 + Doc-Sync 009 + Closeout/Final Closeout）已 PASS，tests/safety 23 files / 625/625 PASS。P3.5 upgrade candidate 软切换已通过（2026-06-02）；P3.5 soft switch 1-2 天观察期已结束、由用户裁决 KEEP v0.15.1（2026-06-04，ADR-20260604-p3-5-soft-switch-decision-keep-v0-15-1）。Claude Code 继续按 dry-run 契约执行 P3 代码/项目任务；Hermes 只做需求整理、计划审查、知识检索、Handoff Pack、结果归档。**

| 事实 | 状态 |
|------|------|
| 001 HCC dry-run planning skeleton | ✅ PASS |
| 002 CodeGraph impact 接入 HCC dry-run plan | ✅ PASS |
| 003 Domain Profile: code | ✅ PASS |
| 004 HCC plan → VerifierInput dry-run 生成 | ✅ PASS |
| 005 端到端 dry-run 契约验证 | ✅ PASS |
| 006 Handoff Pack dry-run payload | ✅ PASS |
| 008 Handoff payload temp fixture + local verifier-only check | ✅ PASS |
| HCC Auto Executor | ❌ 不可用 / 未启动 / 未批准 |
| `executable` 字段 | 恒 `false`（类型硬编码） |
| 真实 IPC handler | ❌ 未新增 |
| `spawn` / `exec` / `runPlaybook` 调用 | ❌ 0 命中 |
| 真实 `~/.hermes/handoff` 写入 | ❌ 未做 |
| Knowledge / Vault / Memory 写入 | ❌ 未做 |
| P4 / P5 / Mano-P 推进 | ❌ 未做 |

---

## 2. 每个 slice 摘要

### Slice 001 — HCC dry-run planning skeleton

- **目标**：收敛 `hcc-task-runner.ts` / `hcc-task-types.ts` / `hcc-task-runner.test.ts` 为只读 dry-run planning skeleton。
- **修改文件**：
  - `src/main/hcc-task-types.ts` — `HCCTaskPlan.executable: false` 类型硬编码；`HCCLeaseResult` 补 `resourceId` 字段。
  - `src/main/hcc-task-runner.ts` — 纯函数 `buildHCCTaskPlan` / `buildHCCTaskSafetyPlan` / `buildHCCTaskFromRequest`；`buildCodeGraphContext` 占位；`buildDomainProfile` 注入默认 code profile。
  - `src/main/hcc-dry-run.ts` — Slice B 已有，类型同步（`HCCLeaseResult.resourceId` 补）。
  - `tests/safety/hcc-task-runner.test.ts` — 46 tests 覆盖 request→plan 映射 / 校验 / 无执行副作用。
- **测试结果**：`npx vitest run tests/safety/hcc-task-runner.test.ts` → 46/46 PASS。
- **安全边界**：无 spawn / exec / runPlaybook / IPC / 真实 audit / rollback / Knowledge / Vault / Memory 写入；step command 强制 `[DRY-RUN]` 前缀。

### Slice 002 — CodeGraph impact 接入 HCC dry-run plan

- **目标**：让 HCC dry-run plan 接收 CodeGraph impact result，把影响面写入 `HCCTaskContext` / `HCCTaskPlan`。
- **修改文件**：
  - `src/main/hcc-task-types.ts` — `CodeGraphStatus` / `CodeGraphImpact` / `HCCCodeGraphContext` 类型；`HCCTaskRequest.codeGraphImpact?` / `isCodeTask?`。
  - `src/main/hcc-task-runner.ts` — `buildCodeGraphContext` 纯归一化。
  - `tests/safety/hcc-task-runner.test.ts` — +18 tests 覆盖 available / missing / failed / 字段保留 / 不阻塞。
- **测试结果**：`tests/safety/hcc-task-runner.test.ts` → 64/64 PASS；`tests/safety` → 334/334 PASS。
- **安全边界**：HCC 不调用 CodeGraph；只接收外部传入的只读 impact 描述；`failed` 状态追加 `validationErrors` 但 plan 仍 `executable=false`。

### Slice 003 — Domain Profile: code

- **目标**：最小 Domain Profile: code，携带 `hardChecks` / `softChecks` / `passCriteria` / `rollback` / `costSignals`，用于 Quality Loop。
- **修改文件**：
  - `src/shared/lib/safety/domain-profile.ts` — 新建。`DomainProfile` / `DomainVerifierSpec` / `DomainProfileName` / `validateDomainProfile()`。
  - `src/main/hcc-task-types.ts` — `domainProfile` 字段；`DomainProfile` re-export。
  - `src/main/hcc-task-runner.ts` — `buildDomainProfile` 注入默认 / 透传 / 校验 / null 四分支。
  - `tests/safety/domain-profile.test.ts` — 13 tests schema + validate。
  - `tests/safety/hcc-task-runner.test.ts` — +17 tests runner 集成。
- **测试结果**：`tests/safety/domain-profile.test.ts` 13/13；`tests/safety/hcc-task-runner.test.ts` 81/81；`tests/safety` 351/351。
- **安全边界**：rollback 明禁 `git reset --hard`；hardChecks 仅数据，无执行；非法 profile → `validationErrors` + `state=blocked`；`executable` 仍恒 false。

### Slice 004 — HCC plan → VerifierInput dry-run 生成

- **目标**：HCC plan → Builder/Verifier 边界要求的 VerifierInput，本地构造 + 校验，不运行真实 verifier。
- **修改文件**：
  - `src/main/hcc-task-types.ts` — re-export `VerifierInput` / `BuilderVerifierBoundary` / `BuilderMetadata` / `TaskResult` / `ValidationResult` / `ForbiddenField` / `FORBIDDEN_FIELDS`；`HCCTaskPlan` 加 `verifierInput` / `verifierInputValid` / `verifierInputValidationErrors` / `verifierBoundary`。
  - `src/main/hcc-task-runner.ts` — `buildHCCVerifierInput()` 纯函数；plan 接入 verifier section；旧 `void(buildVerifierInput(...))` 占位删除。
  - `tests/safety/hcc-verifier-input.test.ts` — 26 tests 覆盖映射 / 边界 / forbidden / 隔离。
  - `tests/safety/hcc-task-runner.test.ts` — 4 旧测试更新以匹配 Slice 004 收紧契约（code 任务无 changedFiles 现在被 blocker gate 拦下）。
- **测试结果**：`tests/safety/hcc-task-runner.test.ts` 82/82；`tests/safety/hcc-verifier-input.test.ts` 26/26；`tests/safety` 391/391。
- **安全边界**：复用 P2.5 `buildVerifierInput` + `validateVerifierInput` + `shouldRequireIndependentVerifier`；forbidden fields 防护；`!domainProfile` 短路；空 `verificationCommands` / `acceptanceCriteria` / `changedFiles` → `verifierInputValid=false` + `state=blocked`。

### Slice 005 — 端到端 dry-run 契约验证

- **目标**：用端到端 dry-run fixture 验证 001-004 契约完整性。
- **修改文件**：
  - `tests/safety/hcc-dry-run-contract.test.ts` — 新建。30 tests 跨 6 describe：happy / boundary / blocked / invariants / no-side-effects / JSON round-trip。
- **测试结果**：`tests/safety/hcc-dry-run-contract.test.ts` 30/30；`tests/safety` 421/421。
- **安全边界**：plan JSON 序列化搜索 `runPlaybook` / `spawn` / `exec(` / `ipcMain` 零命中；tmpDir 验证无意外文件落盘；`executable` 恒 false 在 happy / blocked / invalid-profile 三类用例均验。

### Slice 006 — Handoff Pack dry-run payload

- **目标**：让 HCC dry-run plan 可生成 Handoff Pack payload，供 Hermes ↔ Claude Code 任务状态同步。
- **修改文件**：
  - `src/main/hcc-handoff-pack.ts` — 新建。`buildHCCHandoffPayload()` + `assertHandoffPayloadNoForbiddenFields()` + `HCCHandoffPayload` 类型 + `FORBIDDEN_PAYLOAD_FIELDS`。
  - `tests/safety/hcc-handoff-pack.test.ts` — 新建。30 tests 跨 13 describe。
- **测试结果**：`tests/safety` 450/450。
- **安全边界**：`safety.redaction_status` 默认 `"not_run"` 永不伪造 `"pass"`；`forbidden_fields_checked` 列 8 字段作为正向审计；`assertHandoffPayloadNoForbiddenFields` 递归 keys 命中即 throw；payload 仅返回给 caller，持久化由 caller 决定；不写 `~/.hermes/handoff`。

### Slice 008 — Handoff payload temp fixture + local verifier-only check

- **目标**：让 001-006 产出的 Handoff payload 可以在临时目录写入 fixture、读回并做本地 verifier-only 检查，验证下游独立上下文可消费的最低契约。
- **修改文件**：
  - `src/main/hcc-handoff-pack.ts` — 增加 `writeHCCHandoffPayloadFixture()` / `readHCCHandoffPayloadFixture()` / `verifyHCCHandoffPayloadFixture()`；路径必须限制在 caller 提供的 `tmpDir` 内。
  - `tests/safety/hcc-handoff-fixture.test.ts` — 新建。20 tests 覆盖 fixture 写读、schema/必需字段、redaction_status 约束、forbidden fields、do_not_read 完整性、Builder/Verifier boundary、无执行原语、无真实 handoff 写入。
- **测试结果**：`tests/safety/hcc-handoff-fixture.test.ts` 20/20；`tests/safety` 当时 19 files, 470/470 PASS。
- **安全边界**：只写 `os.tmpdir()` 下测试目录；测试记录真实 `~/.hermes/handoff/packs` mtime 并确认未变化；不启动外部 verifier，不 spawn，不 IPC，不执行 `runPlaybook`。

### Slice 009 — Artifact Store dry-run record

- **目标**：把 P3 dry-run plan + Handoff payload 包装为单一 Artifact Store 记录，让 P2.5 append-only audit-log 契约可消费；只写 `tmpDir`，永不触真实 audit 链与真实 `~/.hermes/handoff/packs`。
- **修改文件**：
  - `src/main/hcc-artifact-store.ts` — 新建。`buildHCCArtifactRecord(plan, handoff, options?)` 纯函数；`assertArtifactRecordNoForbiddenFields` 递归 keys 扫描；`verifyHCCArtifactRecord(record, options?)` 本地 verifier-only check（拒绝伪造 `redaction_status="pass"` 除非 `redactionConfirmed: true`）；`writeHCCArtifactRecordFixture` / `readHCCArtifactRecordFixture` 路径强制落在 `tmpDir` 内，escape 抛错。
  - `tests/safety/hcc-artifact-store.test.ts` — 新建。45 tests 跨 12 describe：happy / safety / next_actions / do_not_read / forbidden fields / verify 拒假 / tmpDir 写读 round-trip / 路径 escape 拒 / JSON 序列化 / 无真实 handoff+audit 写入 / source_commit / artifact_type / notes。
- **测试结果**：`tests/safety/hcc-artifact-store.test.ts` 45/45；`npm run typecheck` EXIT 0；`tests/safety` 20 files, 515/515 PASS。
- **安全边界**：`dryRun: true` / `executable: false` / `runtime_class: "dry_run"` 在 TypeScript 字面量类型硬编码；`safety.side_effect_gates` 强制 `no_ipc` / `no_spawn` / `no_runPlaybook`；`safety.forbidden_fields_checked` 列 8 字段作为正向审计；`do_not_read` 显式含 `~/.hermes/handoff/packs/` 与 `~/.hermes/audit/` 标记；测试用 `statSync` 记录 `~/.hermes/handoff/packs` 与 `~/.hermes/audit` 的 mtime 在 `afterAll` 中确认未变化；不接 `audit-log` 模块，不写真实 `~/.hermes/audit`；`filename` 必含 `task_id`，`subdir` 与最终 `outPath` 必须 `startsWith(resolvedTmp + path.sep)` 否则 throw。报告：`~/.hermes/pipeline-runs/HCC-20260601-P3-SLICE-009-artifact-store-dry-run/01-report.md`。

---

## 3. 当前已具备能力

| 能力 | 实现位置 | 入口 |
|------|---------|------|
| `request → plan` 纯映射 | `buildHCCTaskPlan` | `src/main/hcc-task-runner.ts` |
| CodeGraph impact context 归一化 | `buildCodeGraphContext` | 同上 |
| Domain Profile: code 注入 | `buildDomainProfile` + `DEFAULT_CODE_DOMAIN_PROFILE` | `src/shared/lib/safety/domain-profile.ts` |
| VerifierInput 构造 + 校验 | `buildHCCVerifierInput` + `buildVerifierInput` + `validateVerifierInput` | `src/shared/lib/safety/builder-verifier.ts` |
| 端到端 dry-run 契约 | 测试 fixture | `tests/safety/hcc-dry-run-contract.test.ts` |
| Handoff payload 生成 | `buildHCCHandoffPayload` | `src/main/hcc-handoff-pack.ts` |
| Handoff payload temp fixture 写读 | `writeHCCHandoffPayloadFixture` / `readHCCHandoffPayloadFixture` | `src/main/hcc-handoff-pack.ts` |
| Handoff payload local verifier-only check | `verifyHCCHandoffPayloadFixture` | `src/main/hcc-handoff-pack.ts` |
| Artifact Store dry-run record | `buildHCCArtifactRecord` / `assertArtifactRecordNoForbiddenFields` / `verifyHCCArtifactRecord` / `writeHCCArtifactRecordFixture` / `readHCCArtifactRecordFixture` | `src/main/hcc-artifact-store.ts` |
| Builder/Verifier boundary 判定 | `shouldRequireIndependentVerifier` | `src/shared/lib/safety/builder-verifier.ts` |
| JSON 序列化往返 | plan / payload 内置 | — |

---

## 4. 当前未具备能力

| 缺失 | 原因 |
|------|------|
| 真实执行入口 | HCC Auto Executor 未批准，未启动 |
| IPC handler | P3 不接新 IPC（per 边界规则） |
| `runPlaybook` / `spawn` 接线 | 同上 |
| `verificationCommands` 实跑 | dry-run 阶段不执行命令 |
| Artifact Store / Knowledge / Vault / Memory 写入 | dry-run 阶段不写副作用 |
| HCC Auto Executor | 必须用户重新明确授权才能进入 |
| `manga` / `miniapp` / `hermes-self` profile 实现 | 仅 `code` profile 已实现；其它留 P5 解冻 |
| 独立上下文 Verifier 外部实跑 | 008 + 009 已完成本地 verifier-only check（fixture 写读、record 写读 + 校验）；外部/独立进程 verifier 实跑仍未做 |

---

## 5. 后续建议顺序

| 编号 | 主题 | 风险 | 价值 |
|------|------|------|------|
| **009** | Artifact Store dry-run record | 中 | ✅ PASS（plan + handoff 可被 P2.5 append-only audit log 消费；仅 dry-run 记录） |
| **010** | 受控 worktree dry-run | 中 | 在隔离 worktree 跑 plan 构造，不执行 step 命令；解锁后续真执行的预演。008 + 009 已覆盖 Hermes ↔ Claude Code dry-run 状态交换的完整契约链，010 仅在 HCC Auto Executor 解冻后才有意义 |
| 真实执行入口 | HCC Auto Executor | **高** | **必须用户重新明确授权 + 硬件/云端验证 + 安全复核，独立批** |

> **执行边界**：010 仍由 Claude Code 执行；Hermes 仍不启动 HCC Auto Executor；P4 / P5 / Mano-P 仍不推进。009 已完成，状态已升级为 baseline 的一部分。

---

## 6. Claude Code / Hermes 分工（再强调）

- **Claude Code**：继续按 dry-run 契约执行 P3 代码/项目任务。每次任务产 plan / verifier section / handoff payload / artifact record，不接真实执行入口。
- **Hermes**：只做需求整理、计划审查、知识检索、Handoff Pack、结果归档。不启动 HCC Auto Executor，不注册真实执行 IPC，不接 CLI-Anything / Safari MCP 深度动作。

---

## 7. 验证

- `npm run typecheck` → EXIT CODE 0
- `npx vitest run tests/safety` → 20 files, 515/515 PASS（009 增量 45 tests，008 以来再增 45）

---

## 8. P3 harness + P3.5 soft switch 后续（2026-06-02 增补）

### 8.1 P3 harness 测试轮（8 artifact，全部 PASS）

| Artifact | 报告 | 关键事实 |
|---------|------|---------|
| Doc-Sync 009（markdown 同步） | `~/.hermes/pipeline-runs/HCC-20260601-P3-DOC-SYNC-009/01-report.md` | 4 entry-point 文档 cross-checked；`tests/safety` 22 files / 555/555 PASS；`git diff --check` clean |
| Chain Test 002（跨模块链路测试） | `~/.hermes/pipeline-runs/HCC-20260601-P3-CHAIN-TEST-002/01-report.md` | `tests/safety/hcc-p3-exchange-contract.test.ts` 20/20；plan → handoff fixture → artifact record → fixture → verify 端到端 |
| Code Task 003-006（真实小源码任务） | `~/.hermes/pipeline-runs/HCC-20260601-P3-CODE-TASK-{003,004,005,006}-*/01-report.md` | `src/main/hcc-artifact-store.ts` + `src/main/hcc-handoff-page-summary.ts`；4 个新模块/函数；`tests/safety` 23 files, 625/625 PASS |
| Harness Closeout + Final Closeout | `~/.hermes/pipeline-runs/HCC-20260601-P3-HARNESS-{CLOSEOUT,FINAL-CLOSEOUT}/01-report.md` | 8 artifact + 1 closeout + 1 final closeout |

**测试结果**：`tests/safety` 23 files, 625/625 PASS（baseline 19 files / 470/470 → 23 / 625）。

### 8.2 P3.5 upgrade candidate 软切换（2026-06-02）

| Artifact | 报告 | 关键事实 |
|---------|------|---------|
| B-runtime-smoke | `~/.hermes/pipeline-runs/HCC-20260601-P3.5-B-RUNTIME-SMOKE/01-report.md` | 14/14 PASS；aiohttp TestClient 端到端；zero subprocess / handoff / audit 写入 |
| A-remain（低风险剩余） | `~/.hermes/pipeline-runs/HCC-20260601-P3.5-ROUND2-A-REMAIN/01-report.md` | 11 skills + run_horizon + 3 docs；A 剩余全迁完 |
| hermes-candidate wrapper v1.2.0 | `~/.hermes/pipeline-runs/HCC-20260601-P3.5-SOFT-SWITCH-WRAPPER/01-report.md` | safe-subcommand allowlist + blocklist (13 allowed / 11 blocked / fail-closed) + .venv detection fix |
| Round 2 C Scoping Review | `~/.hermes/pipeline-runs/HCC-20260602-P3.5-ROUND2-C-SCOPING/01-report.md` | 18 files 分类：14 dead-infrastructure 0 importers + 4 high-risk hard-constraint-touching；推荐 0-file 迁移 / 软切换 |
| Hermes live vs candidate readonly compare | `~/.hermes/pipeline-runs/HCC-20260602-HERMES-LIVE-VS-CANDIDATE-READONLY-COMPARE/01-report.md` | 7 pair；6 byte-identical + config 1 行差 + tools 1 行差 |
| Soft-to-Live Switch Rehearsal | `~/.hermes/pipeline-runs/HCC-20260602-HERMES-SOFT-TO-LIVE-SWITCH-REHEARSAL/01-report.md` | `hermes` symlink 默认指向 candidate `.venv/bin/hermes`；6/6 smoke 全过 |
| Soft Switch Observation Baseline | `~/.hermes/pipeline-runs/HCC-20260602-HERMES-SOFT-SWITCH-OBSERVATION/01-baseline.md` | 1-2 天观察期已结束（2026-06-04 由用户裁决 KEEP v0.15.1，ADR-20260604-p3-5-soft-switch-decision-keep-v0-15-1）；rollback 命令就位 |

**当前入口**：`hermes` 默认指向 `/Users/midoudou/.hermes/hermes-agent-upgrade-candidate/.venv/bin/hermes`（candidate v0.15.1）。

**Backup**：`~/.hermes/backups/hermes-agent-full-snapshot-20260602-venv-detection/`（旧 wrapper）+ `~/.hermes/backups/hermes-live-wrapper-pre-soft-switch-20260602/`（旧 hermes symlink target）。

**Rollback 命令**：
```bash
ln -sf /Users/midoudou/.hermes/hermes-agent/venv/bin/hermes        /Users/midoudou/.local/bin/hermes
```

### 8.3 当前仍冻结

| 项目 | 状态 |
|------|------|
| HCC Auto Executor | ❌ 未启动、未接线；真实执行入口未批 |
| Round 2 C | ❌ 仍冻结（4 个 high-risk 文件待用户显式批 + Action Gate 部署） |
| hard cutover（ADR §7.C） | ❌ 不推荐；需新 ADR + rollback 计划 + 用户明确批 + 30 天 dual-run + Action Gate |
| P3 候选 010 | ❌ 受控 worktree dry-run；需单独批准；仅在 HCC Auto Executor 解冻后才有意义 |
| 真实执行入口（spawn / runPlaybook / 真 verificationCommands / 真 Artifact Store 写入）| ❌ 必须另批 |
| BaiLongma Productionization | ❌ NOT APPROVED；仅允许只读增强 |
| Hermes Agent hard cutover | ❌ 未批准；当前为 P3.5 soft switch KEEP v0.15.1 期（2026-06-04 ADR），如需 hard cutover 仍需新 ADR + 30 天 dual-run + Action Gate |
| P7 高优先级投递策略 | ❌ 仍待独立决策（独立 ticket；本任务只完成低优先级 4 job `deliver=local`） |
| V5 C4 / C5 | ❌ 暂缓（非技术失败；生图/视频外部 API 不可控 + 成本不可控） |

### 8.4 观察期建议（1-2 天）

- 观察期内仅做 read-only / 轻量使用 `hermes` 命令
- 避免 `serve` / `run` / `agent` / `delegate` / `update` / `config set|edit` 等危险子命令
- 监控 `~/.hermes/handoff/packs` 和 `~/.hermes/audit` mtime 变化（HARD 触发 rollback）
- 监控 `ps aux` 看是否有长驻进程出现（HARD 触发 rollback）
- 观察期结束决定 rollback / 保持 / 升级为 hard cutover

### 8.5 Knowledge Reuse Chain 增补（2026-06-04）

| Slice | 范围 | 状态 | 6 commits 中对应 |
|------|------|------|-----------------|
| 004-006.9 | protocol / prompt contract / fixtures / integration | ✅ PASS | `2f79c75` docs + `2a8dc08` fixtures + `cdeea86` shared lib + `7c3e89b` tests（部分）|
| 007A-007N | handoff contract + optional hcc handoff knowledge envelope | ✅ PASS | `7c3e89b` tests（部分）+ `d5a6469` hcc-handoff wire envelope |
| 008A-008M | Surface B + task-dispatch prompt builder | ✅ PASS | `d997914` feat(main) task-dispatch-prompt-builder + `7c3e89b` tests（部分）|

- closeout base HEAD == `d5a6469efd84ba98730c2fa3924e769019756077` == `origin/hermes-pro-main`；当时工作区 clean。
- 全量基线：**81 files / 2931 tests PASS**（`npm run typecheck` EXIT 0；`npx vitest run`）。
- Chain 当前只到 L5 dry-run / prompt-builder。**不代表** live `knowledgeIngest` / live `knowledgeSearch` / default system prompt injection / Agent subprocess / L6 live knowledge flush 已启用。
- L6 live knowledge flush 仍**未批准**；BaiLongma/HCC Productionization 仍**NOT APPROVED**；hard cutover 仍**未批准**；Round 2 C 仍**冻结**。

---

## 9. 关联文档


- [CONTEXT.md](../CONTEXT.md) — 当前入口
- [NEXT_STEP.md](../NEXT_STEP.md) — 下一步
- [docs/current-fusion-plan-2026-05-30.md](current-fusion-plan-2026-05-30.md) — 融合计划
- [docs/security/p2-5-safety-foundation-2026-05-30.md](security/p2-5-safety-foundation-2026-05-30.md) — P2.5 安全基座

---

> 本文档为 P3 dry-run 基线事实源。下次任何 Agent 重新接手 P3，先读本文件，再读 `NEXT_STEP.md`。
