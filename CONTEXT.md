# Hermes Pro — 当前上下文入口

> 更新：2026-06-04（最终计划同步：Knowledge Reuse Chain Slice 004-006.9 / 007A-007N / 008A-008M 已完成、6 commits 推送（2f79c75 / 2a8dc08 / cdeea86 / 7c3e89b / d997914 / d5a6469）、HEAD == origin/hermes-pro-main == d5a6469efd84ba98730c2fa3924e769019756077；当前全量测试基线 **81 files / 2931 tests PASS**（npm run typecheck EXIT 0；npx vitest run 全量）；**P3.5 soft switch 1-2 天观察期已收尾、由用户裁决 KEEP v0.15.1（ADR-20260604-p3-5-soft-switch-decision-keep-v0-15-1）、`hermes` 入口保持指向 candidate v0.15.1、rollback 备份仍可回滚**；P7 4 个低优先级 cron job `deliver=local` 已切；BaiLongma Read-only Cockpit Final Polish PASS；V5 保持 MVP_PARTIAL，C4/C5 因生图/视频执行不可控 + 成本不可控暂缓；**HCC Auto Executor 仍不可用、未启动、未接线**；P3 真实执行仍暂停；**hard cutover 仍未批准**；**Round 2 C 仍冻结**；**BaiLongma/HCC Productionization NOT APPROVED**；**L6 live knowledge flush 未批准**。Knowledge Reuse Chain 当前只到 L5 dry-run / prompt-builder，**不代表 live knowledgeIngest / live knowledgeSearch / default system prompt injection / Agent subprocess / L6 live flush 已启用**。）

## Knowledge Reuse Chain 完成度（2026-06-04）

| Slice | 范围 | 状态 |
|------|------|------|
| 004-006.9 | protocol / prompt contract / fixtures / integration | ✅ PASS |
| 007A-007N | handoff contract + optional hcc handoff knowledge envelope | ✅ PASS |
| 008A-008M | Surface B + task-dispatch prompt builder | ✅ PASS |

- 6 commits（按时间序）：`2f79c75 docs` → `2a8dc08 test(fixtures)` → `cdeea86 feat(shared)` → `7c3e89b test` → `d997914 feat(main)` → `d5a6469 feat(hcc-handoff)`。
- `git diff --numstat 2f79c75^..d5a6469` 真值：107 files / +36901 / -0；分桶为 docs 35 / fixtures 27 / tests 35 / shared/lib 8 / main 2 / renderer 0 / other 0。
- Knowledge Reuse closeout base：HEAD == `d5a6469efd84ba98730c2fa3924e769019756077` == `origin/hermes-pro-main`；当前文档同步若尚未提交，`git status` 可能显示 entry docs 为 modified。
- 全量验证：`npm run typecheck` EXIT 0；`npx vitest run` 81 files / 2931 tests PASS；`git diff --check` clean。
- 关键源：`src/shared/lib/knowledge-reuse-protocol.ts` / `knowledge-reuse-integration.ts` / `knowledge-agent-contract-snippet.ts` / `knowledge-handoff-contract.ts` / `knowledge-runtime-injection-surface-b.ts` / `knowledge-live-flush-contract.ts` / `knowledge-live-flush-ui-contract.ts`；`src/main/task-dispatch-prompt-builder.ts` / `hcc-handoff-pack.ts` / `hcc-artifact-store.ts`。
### Chain 显式边界（不可越线声明）

- Chain 当前只到 **L5 dry-run / prompt-builder**。
- **不代表** live `knowledgeIngest` 已启用。
- **不代表** live `knowledgeSearch` 已启用。
- **不代表** default system prompt injection 已启用。
- **不代表** Agent subprocess 已启用。
- **不代表** L6 live knowledge flush 已启用。

## 硬冻结清单（仍生效）

- HCC Auto Executor：未批准、未启动、未接线。
- P3 real execution：paused。
- hard cutover：未批准。
- Round 2 C：frozen。
- BaiLongma/HCC Productionization：NOT APPROVED（仅允许只读增强）。
- L6 live knowledge flush：未批准。
- Locked roadmap（`docs/roadmap-locked-2026-05-28.md`）：不可直接改；任何路线图变更需新 ADR + 用户确认。

## 开工顺序

1. 先读 `/Users/midoudou/.hermes/HERMES-SOUL.md`。
2. 再读 `/Users/midoudou/hermes-pro/NEXT_STEP.md`。
3. P3 dry-run 基线读 `/Users/midoudou/hermes-pro/docs/p3-dry-run-baseline-2026-06-01.md`。
4. 当前融合执行参考读 `/Users/midoudou/hermes-pro/docs/current-fusion-plan-2026-05-30.md`。
5. 锁定路线图读 `/Users/midoudou/hermes-pro/docs/roadmap-locked-2026-05-28.md`。

## 当前核心判断

Hermes Pro 当前不是单纯知识库，也不是单纯代码执行器，而是：

- 知识摄入与吸收系统
- 任务理解与编排系统
- 安全可控的自动执行系统
- 面向 Hermes Pro 自进化、代码任务/小程序、AI 漫剧的个人能力增强系统

## 当前执行阶段

以 `NEXT_STEP.md` 为准：

当前阶段：**P3 dry-run baseline 001-006 + 008 + 009 + P3 harness 8 artifact + P3.5 upgrade candidate 软切换均已通过（2026-06-02）；P3.5 soft switch 1-2 天观察期已结束、由用户裁决 KEEP v0.15.1（2026-06-04，ADR-20260604-p3-5-soft-switch-decision-keep-v0-15-1）；Knowledge Reuse Chain Slice 004-006.9 / 007A-007N / 008A-008M 已完成（2026-06-04，6 commits，全量基线 81 files / 2931 tests PASS）；HCC Auto Executor 仍不可用、未启动；P3 真实执行仍暂停；hard cutover 仍未批准；L6 live knowledge flush 未批准。**

已完成：

1. P0：知识入口运行态修复 — PASS
2. P0.5：Hermes Handoff Pack MVP — PASS
3. P1：GBrain typed links MVP — PASS
4. P1.5：Usage Feedback Ledger — PASS
5. P2：BaiLongma 主驾驶舱升级 — PASS（typecheck PASS、tests 360 PASS、UI QA PASS、无写入、无 HCC/CLI/Safari MCP 外部动作）
6. P2.5：安全基座 — PASS（typecheck EXIT CODE 0，tests 278 PASS，shared 模块无 Node-only import，audit-log/rollback 均用 tmpDir）
7. P3 dry-run 001：HCC dry-run planning skeleton — PASS
8. P3 dry-run 002：CodeGraph impact 接入 HCC dry-run plan — PASS
9. P3 dry-run 003：Domain Profile: code 接入 HCC dry-run plan — PASS
10. P3 dry-run 004：HCC plan → VerifierInput dry-run 生成 — PASS
11. P3 dry-run 005：端到端 dry-run 契约验证 — PASS
12. P3 dry-run 006：Handoff Pack dry-run payload — PASS
13. P3 dry-run 008：Handoff payload temp fixture + local verifier-only check — PASS（tmpDir fixture；不写真实 `~/.hermes/handoff`）
14. P3 dry-run 009：Artifact Store dry-run record — PASS（`src/main/hcc-artifact-store.ts` + `tests/safety/hcc-artifact-store.test.ts` new；typecheck EXIT 0；`tests/safety` 20 files / 515/515 PASS；record `dryRun:true` / `executable:false` / `runtime_class:"dry_run"` 硬编码；tmpDir 写，零真实 `~/.hermes/handoff/packs` 与 `~/.hermes/audit` 写入）
15. Knowledge Reuse Chain Slice 004-006.9：protocol / prompt contract / fixtures / integration — PASS（`docs/knowledge/knowledge-reuse-protocol-2026-06-02.md` + `knowledge-reuse-dry-run-fixtures-2026-06-02.md` + `knowledge-reuse-integration-dry-run-2026-06-02.md`；`src/shared/lib/knowledge-reuse-protocol.ts` + `knowledge-reuse-integration.ts`；`tests/knowledge-reuse-protocol.test.ts` + `knowledge-reuse-integration.test.ts` + `knowledge-reuse-fixture.test.ts`）
16. Knowledge Reuse Chain Slice 007A-007N：handoff contract + optional hcc handoff knowledge envelope — PASS（`docs/knowledge/knowledge-handoff-contract-snippet-insertion-design-2026-06-03.md` + `knowledge-handoff-contract-snippet-dry-run-fixtures-2026-06-03.md` + `knowledge-handoff-builder-insertion-dry-run-2026-06-03.md` + `knowledge-handoff-builder-chain-closeout-2026-06-04.md`；`src/shared/lib/knowledge-handoff-contract.ts` + `knowledge-agent-contract-snippet.ts`；`tests/knowledge-handoff-contract.test.ts` + `knowledge-handoff-contract-fixture.test.ts` + `knowledge-agent-contract-snippet.test.ts` + `knowledge-agent-prompt-contract.test.ts` + `knowledge-agent-quick-reference.test.ts` + `tests/safety/hcc-handoff-knowledge-contract.test.ts` + `tests/safety/hcc-handoff-knowledge-contract-chain.test.ts`；`src/main/hcc-handoff-pack.ts` 增量 wire knowledge contract envelope）
17. Knowledge Reuse Chain Slice 008A-008M：Surface B + task-dispatch prompt builder — PASS（`docs/knowledge/knowledge-runtime-injection-surface-b-2026-06-04.md` + `knowledge-runtime-injection-l5-closeout-2026-06-04.md` + `knowledge-runtime-dispatch-l5-closeout-2026-06-04.md` + `knowledge-runtime-dispatch-pause-observation-2026-06-04.md` + `knowledge-task-dispatch-prompt-builder-2026-06-04.md` + `knowledge-task-dispatch-prompt-builder-chain-2026-06-04.md`；`src/shared/lib/knowledge-runtime-injection-surface-b.ts` + `knowledge-runtime-injection-simulation.ts` + `knowledge-runtime-injection-prompt-snapshots.ts`；`src/main/task-dispatch-prompt-builder.ts`；`tests/knowledge-runtime-injection-surface-b.test.ts` + `knowledge-runtime-injection-simulation.test.ts` + `knowledge-runtime-injection-prompt-snapshot.test.ts` + `knowledge-runtime-injection-l5-closeout.test.ts` + `knowledge-runtime-dispatch-l5-closeout.test.ts` + `knowledge-runtime-dispatch-pause-observation.test.ts` + `tests/task-dispatch-prompt-builder.test.ts` + `tests/safety/task-dispatch-prompt-builder-chain.test.ts`）
18. P3 harness 跨模块链路测试（Chain Test 002）— PASS（`tests/safety/hcc-p3-exchange-contract.test.ts` 20/20；plan → handoff fixture → artifact record → fixture → verify 端到端）
19. P3 harness 真实小源码任务（Code Task 003-006）— PASS（artifact summary + summary fixture reader + handoff page summary + summary aggregator；4 个新模块/函数；`tests/safety` 23 files, 625/625 PASS）
20. P3 harness 文档同步（Doc-Sync 009）— PASS（4 entry-point 文档 cross-checked）
21. P3 harness 关闭报告（Harness Closeout + Final Closeout）— PASS（8 artifact + 1 closeout + 1 final closeout）

P3.5 upgrade candidate 完成（2026-06-02）：
19. Round 1 backup + Round 2 A/B-impl/B-smoke/B-fix — PASS（candidate 18 agent + `default_soul.py` + `gateway/routes/*` + `api_server.py` 11 行 patch + `register_api_routes` 幂等）
20. B-runtime-smoke — PASS（14/14；aiohttp TestClient 端到端；zero subprocess / handoff / audit 写入）
21. A-remain（低风险剩余）— PASS（11 skills + run_horizon + 3 docs）
22. Read-only CLI smoke — PASS（9/9 forwarded read-only 命令）
23. hermes-candidate wrapper v1.2.0 safe-subcommand allowlist — PASS（13 allowed / 11 blocked / fail-closed；+ .venv detection fix）
24. live-vs-candidate read-only compare — PASS（7 pair；6 byte-identical + config 1 行差 + tools 1 行差）
25. Round 2 C scoping review — REVIEW ONLY（18 files 分类：14 dead-infrastructure 0 importers + 4 high-risk hard-constraint-touching；推荐 0-file 迁移 / 软切换）
26. soft-to-live switch 排练 — PASS（`hermes` symlink 默认指向 candidate `.venv/bin/hermes`；6/6 smoke 全过）
27. soft switch observation baseline — **KEEP v0.15.1**（观察期已结束，2026-06-04 用户裁决 KEEP；ADR-20260604-p3-5-soft-switch-decision-keep-v0-15-1；`hermes` 默认入口当前为 candidate v0.15.1，rollback 备份仍可回滚）
28. Knowledge Reuse Chain Slice 004-006.9 / 007A-007N / 008A-008M 推送 6 commits — PASS（2f79c75 / 2a8dc08 / cdeea86 / 7c3e89b / d997914 / d5a6469；closeout base HEAD == origin/hermes-pro-main == d5a6469efd84ba98730c2fa3924e769019756077；当时工作区 clean；全量基线 81 files / 2931 tests PASS）

**测试基线规则（2026-06-04 统一）**：历史快照（46 files / 995 tests、23 files / 625 tests、tests/safety 20 files / 515/515 等）保留为该切片收口时的当时证据；当前最新全量基线为 **81 files / 2931 tests PASS**（typecheck EXIT 0；`npm run typecheck && npx vitest run`）。任何后续 §X.Y 提到的"X files / Y tests"数字均为切片收口时点的局部事实源。

P3 真实执行仍未恢复：HCC Auto Executor 未批准、未启动、未接线。Round 2 C 仍冻结；hard cutover 仍未批准。

当前执行策略：

1. P3 代码/项目任务由 Claude Code 按 dry-run 契约执行（已完成 6 切片 + harness 8 artifact）。
2. Hermes 暂时只负责需求整理、计划审查、知识检索、Handoff Pack、执行结果归档。
3. 后续给执行 Agent 的提示词默认面向 Claude Code，直到 HCC Auto Executor 可用并经用户明确授权。
4. **P3.5 soft switch 观察期已结束、由用户裁决 KEEP v0.15.1（2026-06-04，ADR-20260604-p3-5-soft-switch-decision-keep-v0-15-1）；默认 `hermes` 入口保持指向 candidate v0.15.1；保持期内仍仅做 read-only 使用，避免 `serve` / `run` / `agent` / `delegate` / `update` / `config set|edit` 等危险子命令；如需回滚，使用 `ln -sf /Users/midoudou/.hermes/hermes-agent/venv/bin/hermes /Users/midoudou/.local/bin/hermes`（备份保留在 `~/.hermes/backups/hermes-live-wrapper-pre-soft-switch-20260602/`）**。
5. Round 2 C 仍冻结（14 dead-infrastructure + 4 high-risk 待用户显式批 + Action Gate 部署）。
6. hard cutover 仍未批准。
7. 真实执行入口（spawn / runPlaybook / HCC executor）必须另批。
8. 010（受控 worktree dry-run）仍需单独批准，且仅在 HCC Auto Executor 解冻后才有意义。
   008 + 009 + hermes-candidate wrapper 已覆盖 Hermes ↔ Claude Code dry-run 状态交换的完整契约链。

P7 WeChat/iLink 当前状态（2026-06-02）：

- 4 个低优先级 cron job 已切 `deliver=local`：`db41a513ebfd`（GitHub 每日热点推送）/ `21129f505fb4`（每周知识周报）/ `28f0bff3083d`（知识飞轮 - 每周全网搜索）/ `skill-cleanup-weekly`（每周闲置 Skill 清理报告）。schedule / prompt / skill set / enable state / state 全部保留；仅 `deliver` 字段从 `weixin` 改为 `local`。
- 报告：`~/.hermes/pipeline-runs/HCC-20260602-P7-WECHAT-ILINK-LOCAL-DELIVERY/01-report.md`。
- `~/.hermes/cron/jobs.json` mtime 变化属于 P7 任务的预期写；本任务不再次触碰。
- 高优先级投递策略仍待决策（独立 ticket；P7 已完成的 local delivery 仅覆盖被 rate limit 的低优先级尾部）。

BaiLongma Read-only Cockpit Final Polish（2026-06-02）：

- `src/renderer/src/screens/BaiLongma/BaiLongma.tsx` 阶段条扩到 10 行（P0 / P0.5 / P1 / P1.5 / P2 / P2.5 / P3 / P3.5 / P7 / Prod）；风险/阻塞面板扩到 9 行（4 blockers + 5 warnings）；下一步行动 4→5 行；顶部 badge 改为 "BaiLongma Read-only Cockpit · 只读 · 无新增 IPC · 无写入 · P3.5 soft switch 观察期"。
- `tests/bailongma-status-sync.test.ts` 扩展到 10 tests：P3.5 soft switch / P7 local delivery / Productionization NOT APPROVED / HCC Auto Executor paused / no-stale P2 badge / no-stale WeChat/iLink C-F line / no forbidden invocations。
- 验证：`npm run typecheck` EXIT 0；`npx vitest run` 46 files / 995 tests PASS；`git diff --check` clean。
- 边界：未新增 preload IPC；未调用 `runPlaybook(` / `triggerCronJob(` / `sendMessage(` / `config.set(`；`~/.hermes/handoff/packs` mtime `1780195726` 未变；`~/.hermes/audit` mtime `1780230084` 未变。
- 报告：`~/.hermes/pipeline-runs/HCC-20260602-BAILONGMA-READONLY-FINAL-POLISH/01-report.md`。

V5 defer 原因（2026-06-02）：

- V5 保持 `MVP_PARTIAL`：C1/C2/C3 已 PASS；C4（生图 API 接入）/ C5（视频自动生成）暂缓。
- 暂缓原因不是技术执行失败，而是 **AI 生图/视频执行不可控 + 成本不可控**：C4/C5 需要外部 API key + 按调用计费；当前 Hermes 暂未拿到此类 API key，且外部生图/视频 API 在 prompt-injection / 重试放大 / 无 review 中间产物 等风险上超出当前安全基座可拦截范围。
- 决定：V5 不进入外部 API 实跑；保持 MVP_PARTIAL / deferred；如需恢复需新 ADR + API key 预算审批 + Dry-run 边界 + 用户显式批。

Locked roadmap drift reset（2026-06-02）：

- 此前若干次 entry-point 文档（CONTEXT.md / NEXT_STEP.md / docs/current-fusion-plan-2026-05-30.md / docs/p3-dry-run-baseline-2026-06-01.md / docs/iteration-plan-v2-updated.md / docs/v7-ecosystem-integration-plan.md）出现与 locked roadmap 的 drift；已完成 reset，新增 `docs/adr/ADR-20260602-locked-roadmap-drift-reset.md` 记录 drift 范围 + reset 动作 + 未来同步规则。
- 规则：locked roadmap（`docs/roadmap-locked-2026-05-28.md`）不变；其余 entry-point 文档以 roadmap 为准做小范围同步；任何路线图变更需新 ADR + 用户确认。

不要重新执行 P0/P0.5/P1/P1.5/P2/P2.5/P3 dry-run 001-006 + 008 + 009；不要重跑 P3 harness 8 artifact；不要重跑 P3.5 Round 1-2 A/B-impl/B-smoke/B-fix / B-runtime-smoke / A-remain / hermes-candidate wrapper v1.2.0 / soft-to-live switch 排练。除非用户明确要求复验。

soft switch KEEP 期（2026-06-04 起，ADR-20260604-p3-5-soft-switch-decision-keep-v0-15-1）内不做以下动作：
- 不改 `~/.local/bin/hermes` symlink（除 rollback 外）
- 不跑长驻进程（`serve` / `run` / `agent` / `delegate` / `gateway`）
- 不写真实 `~/.hermes/handoff/packs` 或 `~/.hermes/audit`
- 不进入 Round 2 C
- 不切 hard cutover
- 不改 locked roadmap

## P3/P4 当前边界

P2.5 已验收通过，但 **HCC Auto Executor 尚不可作为可用执行入口**。在用户重新明确授权前：

- Hermes 不直接启动 HCC Auto Executor。
- Hermes 不接真实执行入口、不注册新的执行 IPC、不接 CLI-Anything / Safari MCP 深度动作。
- P3 代码/项目任务由 Claude Code 执行；Hermes 负责上游编排和下游归档。

P2.5 已补齐：

- 权限/能力模型
- 任务状态机
- 回滚策略
- pre-flight 安全闸
- Action Gate
- append-only 审计日志
- Scheduler / Resource Lease
- Builder / Verifier 分离
- 知识 provenance / trust_level
- 过时计划目录的索引器硬排除

未来恢复 Hermes P3 执行闭环时，Quality Loop 必须走 Domain Profile；P3 先实现 `code` profile，P5 再接 `manga` profile。

## 待定项目硬规则

Mano-P 已放入待定项目，不是当前计划、不是候选试点、不得推进执行。检索到 Mano-P 相关内容时，只能报告其待定状态；除非用户重新明确授权并满足硬件/云端验证条件，否则不得展开实施方案。

## 严禁误读

不要把以下位置当作当前计划来源：

- `/Users/midoudou/Desktop/知识/Hermes 代码任务/过时计划/`
- `/Users/midoudou/hermes-pro/docs/archive/`
- 任何 `*.before-*` 或带旧日期的历史备份

这些内容只作为历史证据存在；除非用户明确指定某个归档文件，否则 Agent 不应读取其正文作为当前上下文。
