# Hermes Pro — 下一步行动指南

| 最后更新 | 2026-06-02（P0/P0.5/P1/P1.5/P2/P2.5/P3 dry-run 001-006 + 008 + 009 + P3 harness 8 artifact + P3.5 upgrade candidate 软切换 + P7 WeChat/iLink 4 个低优先级 cron job deliver=local 已完成 + BaiLongma Read-only Cockpit Final Polish PASS；V5 保持 MVP_PARTIAL，C4/C5 因生图/视频执行不可控 + 成本不可控暂缓；P3.5 soft switch 进入 1-2 天观察期，hard cutover 仍未批准，P3 真实执行仍暂停）|
| 当前状态 | V1/V2 完成，V3 UI 完成，V4 BaiLongma POC-2 ✅+QA PASS+Read-only Cockpit Final Polish ✅；V6 MAIN COMPLETE；V7 PARTIAL COMPLETE；Productionization NOT APPROVED；当前执行阶段为 P3 dry-run baseline 001-006 + 008 + 009 + P3 harness + P3.5 soft switch PASS / real execution paused / soft switch observation active，参考 `docs/p3-dry-run-baseline-2026-06-01.md` 与 `docs/current-fusion-plan-2026-05-30.md` |

## 当前真实状态

| 版本 | 状态 | 说明 |
|------|------|------|
| V1 | ✅ 完成 | 基础可用 |
| V1.5 | ✅ 完成 | 修复阶段 |
| V2 | ✅ 4/5 完成 | Theme/AgentMonitor/MCP/Memory；BaiLongma 已移出到 V4 |
| V3 | ✅ UI完成 | Knowledge/Vault/Recharts/GBrain/Horizon；自动化 backlog 迁移到 V6 |
| V4 | ✅ POC-2+QA PASS | BaiLongma Layer 1-3 + POC-1 + POC-2 + typecheck通过 + Manual QA PASS；Productionization NOT APPROVED |
| V5 | ⏸️ MVP_PARTIAL | TEXT_TO_PROMPT_ASSET_PACK_READY；C1/C2/C3 ✅；C4/C5 暂缓（**生图/视频外部 API 不可控 + 成本不可控**，非技术失败，需新 ADR + API key 预算 + Dry-run 边界 + 用户显式批才能恢复）|
| V6 | ✅ MAIN COMPLETE | 主干 5/5 完成；V6-1/V6-5 扩展/产品决策项暂缓 |
| V7 | ✅ PARTIAL_COMPLETE | Safari MCP MVP PASS；browser-use DEFER；Mano-P 待定；UI-TARS/OpenAdapt 需用户授权 |

### V4 BaiLongma 当前进度

| 任务 | 状态 |
|------|------|
| Layer 1-3 设计文档 | ✅ 完成 |
| README + POC Plan | ✅ 完成 |
| POC-1 静态只读 screen | ✅ 完成 |
| POC-2 真实 cron 只读数据 | ✅ 完成 |
| npm run typecheck | ✅ 通过 |
| Manual QA | ✅ PASS（2026-05-29）|
| Productionization | ❌ NOT APPROVED（用户选择3d：暂不批准，只读增强方向）|

---

## 下一步优先级

| 优先级 | 任务 | 说明 |
|--------|------|------|
| **P0** | 知识入口运行态修复 | ✅ PASS：`knowledgeSearch` 固定查询 0 超时，过时计划目录硬排除已验证 |
| **P0.5** | Hermes Handoff Pack MVP | ✅ PASS：已生成 Handoff Pack 和 Verifier Report，脱敏扫描 0 发现 |
| **P1** | GBrain typed links MVP | ✅ PASS：typed links 只读，evidence/provenance/trust_level 已实现，25/25 tests PASS |
| **P1.5** | Usage Feedback Ledger | ✅ PASS：append-only in-memory usage_event 已实现，15/15 tests PASS；不改变检索排序 |
| **P2** | BaiLongma 主驾驶舱升级 | ✅ PASS（typecheck PASS、tests 360 PASS、UI QA PASS、无写入、无 HCC/CLI/Safari MCP 外部动作） |
| **P2.5** | 安全基座 | ✅ PASS（typecheck EXIT CODE 0，tests 278 PASS，shared 模块无 Node-only import，audit-log/rollback 均用 tmpDir，Gateway live query 未运行跳过后不误报） |
| **P3 dry-run 001** | HCC dry-run planning skeleton | ✅ PASS（46/46 tests） |
| **P3 dry-run 002** | CodeGraph impact 接入 HCC dry-run plan | ✅ PASS（+18 tests, executable 仍 false） |
| **P3 dry-run 003** | Domain Profile: code | ✅ PASS（13 schema + 17 runner, 351/351） |
| **P3 dry-run 004** | HCC plan → VerifierInput dry-run 生成 | ✅ PASS（+26 tests, 391/391） |
| **P3 dry-run 005** | 端到端 dry-run 契约验证 | ✅ PASS（30/30 contract tests, 421/421） |
| **P3 dry-run 006** | Handoff Pack dry-run payload | ✅ PASS（30/30 payload tests, 450/450） |
| **P3 dry-run 008** | Handoff payload temp fixture + local verifier-only check | ✅ PASS（20/20 fixture tests；`tests/safety` 当时 19 files, 470/470 PASS；仅 tmpDir 写读，不写真实 `~/.hermes/handoff`） |
| **P3** | HCC + CodeGraph + Quality Loop 主任务闭环 | ⏸️ **dry-run baseline PASS / real execution paused**：HCC Auto Executor 仍未批准、未启动；Claude Code 按 dry-run 契约执行 P3 代码/项目任务；Hermes 暂时只做需求整理、计划审查、知识检索、Handoff Pack、执行结果归档 |
| **P3 dry-run 009** | Artifact Store dry-run record | ✅ PASS（`src/main/hcc-artifact-store.ts` + `tests/safety/hcc-artifact-store.test.ts` new；`tests/safety` 20 files, 515/515 PASS；typecheck EXIT 0；record `dryRun:true` / `executable:false` / `runtime_class:"dry_run"` 类型硬编码；tmpDir 写读，零真实 `~/.hermes/handoff/packs` 与 `~/.hermes/audit` 写入；详见 `~/.hermes/pipeline-runs/HCC-20260601-P3-SLICE-009-artifact-store-dry-run/01-report.md`） |
| **P3 候选 010** | 受控 worktree dry-run | 待批：隔离 worktree 跑 plan 构造，不执行 step 命令。仅在 HCC Auto Executor 解冻后才有意义；真实执行入口必须另批。 |
| **P3 真实执行入口** | HCC Auto Executor 启动 | ❌ **必须用户重新明确授权 + 硬件/云端验证 + 安全复核，独立批** |
| **P4** | CLI-Anything / Safari MCP 安全工具桥 | Safari MCP MVP 已接；深度 CLI-Anything 进入试点，必须走授权、allowlist、pre-flight、安全复核 |
| **P5** | AI 漫剧提效链路 | awesome-video-generation + AstraVideo-AI 作为候选参考，先做工具雷达和任务队列设计，不直接入主线 |
| **P6** | 外部 Agent 能力采纳决策 | 基于 `docs/adr/ADR-20260530-external-agent-capability-adoption.md`；OpenClaw/OpenHuman/Ruflo/MyForge/DataLogic/MiroFish 只做候选或架构借鉴 |
| **P7** | WeChat/iLink rate limit 自然运行验证 + 投递策略 | ✅ **低优先级 4 个 cron job 已切 deliver=local**（`db41a513ebfd` / `21129f505fb4` / `28f0bff3083d` / `skill-cleanup-weekly`；schedule / prompt / skill set / enable state 不变，仅 `deliver: weixin → local`）；状态从 `still_rate_limited_needs_C_or_F_decision` 更新为 `low_priority_jobs_local_delivery_applied`；高优先级投递策略仍待独立决策。报告：`~/.hermes/pipeline-runs/HCC-20260602-P7-WECHAT-ILINK-LOCAL-DELIVERY/01-report.md` 与 `~/.hermes/pipeline-runs/HCC-20260602-WECHAT-ILINK-NATURAL-RUN-VERIFY/01-report.md` |

> **Productionization NOT APPROVED** — BaiLongma/HCC 仍停留在只读增强与候选设计阶段；写入/执行版必须另批。

> **Mano-P 待定** — Mano-P 已放入待定项目，不是当前计划、不是候选试点。检索到 Mano-P 只能报告待定状态，不得推进实施；UI-TARS/OpenAdapt 也需用户单独授权。

> **P3 执行委派规则（2026-06-02 更新）** — P3 dry-run baseline 001-006 + 008 + 009 已 PASS；P3 harness 8 artifact + P3.5 soft switch 已完成；当前处于 P3.5 soft switch 1-2 天观察期。后续项目/代码任务由 Claude Code 按 dry-run 契约执行（产 plan / verifier section / handoff payload / artifact record），不接真实执行入口。Hermes 负责需求整理、计划审查、知识检索、Handoff Pack、执行结果归档；不得直接启动 HCC Auto Executor、注册真实执行 IPC、或接 CLI-Anything / Safari MCP 深度动作。Round 2 C 仍冻结；hard cutover 仍未批。008 + 009 + hermes-candidate wrapper 已覆盖 Hermes ↔ Claude Code dry-run 状态交换的完整契约链。

---

## 相关文档

| 文档 | 用途 |
|------|------|
| [docs/roadmap-locked-2026-05-28.md](./docs/roadmap-locked-2026-05-28.md) | 锁定版路线图（唯一计划入口） |
| [docs/current-fusion-plan-2026-05-30.md](./docs/current-fusion-plan-2026-05-30.md) | 当前融合执行计划（Knowledge/HCC/CodeGraph/Understand/CLI-Anything/Handoff 一体化） |
| [docs/p3-dry-run-baseline-2026-06-01.md](./docs/p3-dry-run-baseline-2026-06-01.md) | **P3 dry-run baseline 001-006 + 008 + 009 基线事实源** |
| [docs/security/p2-5-safety-foundation-2026-05-30.md](./docs/security/p2-5-safety-foundation-2026-05-30.md) | P2.5 安全基座规格（P3/P4 硬前置） |
| [docs/v6-knowledge-automation-plan.md](./docs/v6-knowledge-automation-plan.md) | V6 知识自动化计划 |
| [docs/v7-ecosystem-integration-plan.md](./docs/v7-ecosystem-integration-plan.md) | V7 生态工具计划 |
| [docs/deprecation-candidates-2026-05-28.md](./docs/deprecation-candidates-2026-05-28.md) | 废弃/过时候选清单 |
| [docs/v2-status.md](./docs/v2-status.md) | V2 各任务实际状态 |
| [docs/v3-status.md](./docs/v3-status.md) | V3 各任务实际状态 |
| [docs/bailongma/README.md](./docs/bailongma/README.md) | BaiLongma 设计索引 |

---

## 路线图锁定规则

- **知识库内容不自动改变路线图**。vault/归档内容只能进入候选池，需用户明确批准。
- **禁止 Agent 自行改路线图**。任何路线图变更必须新建 ADR + 用户确认。
- **已完成的版本不得回滚**。除非用户明确说"解锁路线图"。
- **发现计划 bug 时，Agent 可以报告 Roadmap Bug Report，由用户决定是否修改；不得自行改路线图**。

---

| 最后更新 | 2026-06-02（P0/P0.5/P1/P1.5/P2/P2.5/P3 dry-run 001-006 + 008 + 009 + P3 harness 8 artifact + P3.5 soft switch PASS + P7 4 个低优先级 cron job deliver=local 已完成 + BaiLongma Read-only Cockpit Final Polish PASS；V5 保持 MVP_PARTIAL；P3 真实执行仍暂停，hard cutover 仍未批准）|

## HCC v2 代码任务入口（2026-05-29）

以后代码任务默认流程：
Hermes 需求翻译/调度 -> 用户确认 -> 双视角审计划 -> Claude Code 隔离 worktree 执行 -> Codex 双审+测试 -> 用户交付

仅当 HCC v2 修复 3 次仍无法执行或无法通过测试时，降级到旧 code_dev：
Hermes -> Karpathy planner -> Claude Code executor -> Bellard reviewer -> deliver/escalate -> reflect
