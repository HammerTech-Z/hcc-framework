# Hermes Pro — 下一步行动指南

> **Closeout Addendum — 2026-06-07**
> UI Slice 1–7 已完成并推送（`faf56f2` / `e0333ee` / `08db860` / `3e21df4` / `3dd12dd` / `de35e6f` / `b612d1a`）。
> Knowledge IPC Migration Slice 0–8B + Closeout + Fix-Applied Declaration 已完成并推送（12 commits: `86b4a8f` / `9c0c808` / `1b87fb4` / `3136ddd` / `cc44a6f` / `eeb4069` / `3842d7e` / `66d0440` / `2229c9a` / `d641370` / `5a27d20` / `600a7fb`）。
> Final verified state: `HEAD == origin/hermes-pro-main == 600a7fb7be3e70127377db8fb8ab52fe1f35fed5`；working tree clean；121 files / 3505 tests PASS。
> `src/preload/index.ts` 不含 `http://127.0.0.1:8643/knowledge*` raw fetch；`knowledgeSearch` / `knowledgeIngest` / `getGbrainStats` 已全部走 main-process IPC bridge；renderer API method names 与 response shapes 保持兼容；Knowledge / KnowledgeControl screen 行为不变。
> `SCREEN_BOUNDARY_CONTRACT_DIRECT_GATEWAY_FIX_APPLIED = true`（P0 follow-up 收口）。
> `~/.hermes/config.yaml` / `handoff/packs` / `audit` mtime 全程未变；`docs/roadmap-locked-2026-05-28.md` 未触碰。
> 仍需保留的安全护栏：`knowledgeIngest` 仍为 write path，必须由 explicit user action 触发；不得声明 L6 live knowledge flush / HCC Auto Executor / hard cutover / P3 真实执行 已启用。

| 最后更新 | 2026-06-06（P0/P0.5/P1/P1.5/P2/P2.5/P3 dry-run 001-006 + 008 + 009 + P3 harness 8 artifact + P3.5 upgrade candidate 软切换 + P7 WeChat/iLink 4 个低优先级 cron job deliver=local 已完成 + BaiLongma Read-only Cockpit Final Polish PASS；**P3.5 soft switch 已由用户裁决 KEEP v0.15.1（ADR-20260604-p3-5-soft-switch-decision-keep-v0-15-1）、`hermes` 入口保持指向 candidate v0.15.1、rollback 备份仍可回滚**；**Knowledge Reuse Chain Slice 004-006.9 / 007A-007N / 008A-008M 已完成、6 commits 推送（2f79c75 / 2a8dc08 / cdeea86 / 7c3e89b / d997914 / d5a6469）、当时全量基线 81 files / 2931 tests PASS**；**MODEL-STRATEGY 001-006B 已完成并推送，006B implementation commit `071b033596bfe07541b48c2aee86188d379d0475`；006B closeout typecheck PASS + 103 files / 3267 tests PASS；全链路 dry-run / read-only / design-only / no-live-config，cloud API keys 仍由用户自行配置且不进入 docs/fixtures/descriptors**；**Hermes Pro UI Design Spec 已提交并获用户批准方向（411954b / e171213），8 个 open questions 已锁定默认值，Slice 0 Contract Audit 解锁但仍需单独批准**；V5 保持 MVP_PARTIAL，C4/C5 因生图/视频执行不可控 + 成本不可控暂缓；hard cutover 仍未批准；P3 真实执行仍暂停；HCC Auto Executor 未批准、未启动、未接线；BaiLongma/HCC Productionization NOT APPROVED；Round 2 C 仍冻结；L6 live knowledge flush 未批准；Knowledge Reuse Chain 当前只到 L5 dry-run / prompt-builder，不代表 live knowledgeIngest / live knowledgeSearch / default system prompt injection / Agent subprocess / L6 live flush 已启用）|
| 当前状态 | V1/V2 完成，V3 UI 完成，V4 BaiLongma POC-2 ✅+QA PASS+Read-only Cockpit Final Polish ✅；V6 MAIN COMPLETE；V7 PARTIAL_COMPLETE；Productionization NOT APPROVED；当前执行阶段为 P3 dry-run baseline 001-006 + 008 + 009 + P3 harness + P3.5 soft switch PASS / real execution paused / **soft switch KEEP v0.15.1（2026-06-04 决议）**，参考 `docs/p3-dry-run-baseline-2026-06-01.md` 与 `docs/current-fusion-plan-2026-05-30.md`；**Knowledge Reuse Chain 已完成至 L5 prompt-builder**；**MODEL-STRATEGY 已完成至 006B design-only approval contract，最新全量基线 103 files / 3267 tests PASS**；**UI redesign 部分落地（Slice 0/1/2 已完成，落地态详见 `docs/design/UI-GROUND-TRUTH-2026-06-04.md` §0 同步 2026-06-11）；Slice 3-7 仍未开始，需用户逐 slice 批准；Productionization NOT APPROVED 维持不变** |

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

### HCC Phase B 车道一进度（2026-06-12 状态同步）

> HCC-GO 已于 2026-06-11 签收。Phase B 车道一以"每任务人工发车模式"运行。
> Auto Executor 常驻仍未授权、未启动。车道二（B-5/B-6）仍未开放。

| 任务 | 状态 | closeout / 注记 |
|------|------|----------------|
| B-1 能力/领域注册表空壳 | ✅ 已被 A-6 消耗 | `src/shared/lib/registry/capability-registry.ts` |
| B-2 真实输入路径 scan gate + H-6 | ✅ 已完成 | `docs/closeout/b2-scan-gate-closeout-2026-06-11.md` |
| B-3 Reflection Evaluator Runner | ✅ 已完成 | `docs/closeout/b3-evaluator-closeout-2026-06-11.md` |
| B-4 Live Reflection Writer → Live Flush | ✅ 已完成（2026-06-12） | B-4A/B-4B/B-4C 三段全部落库；apply path 仍未实现 |
| B-4A | ✅ 已完成 | Writer 契约（contract_only） |
| B-4B | ✅ 已完成 | Writer 实现（in-memory + singleton） |
| B-4C Live Flush | ✅ approval gate 已完成 | preflight `b0e12a5` + impl `a15971f`；**apply path 仍未实现** |
| B-5 UI Slice 8 KnowledgeControl 视觉 | ⬜ 车道二（HCC-STABLE 后） | |
| B-6 Mano-P 放弃 ADR + license 审计 | ⬜ 车道二（HCC-STABLE 后） | |

**B-4 拆分**（见 `docs/governance/hcc-go-authorization-2026-06-11.md` §4.4）：
- B-4A：Live Reflection Writer preflight / contract（纯文档，零代码）✅
- B-4B：Writer 实现（唯一 writer + 唯一性测试）✅
- B-4C：Live Flush approval gate（pending_user_approval only）✅；**apply path 仍未实现**（future slice）

**禁项重申**：
- Auto Executor 常驻 ≠ HCC-GO，不得启动
- Live Flush 不得声明已启用
- Phase B 车道二不得开放
- `~/.hermes/**` 不得自动写入

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
| **MODEL-STRATEGY 001-006B** | Model lane / provider requirements / approval contract dry-run chain | ✅ PASS：001 dry-run fixture；002A provider catalog；002B smoke matrix；002C disabled UI descriptor；003A read-only HccCockpit panel；004A rollout simulation；004B rollback preview；004C UI status projection；005A EchoBird taxonomy；005B Hermes-native model-nexus descriptor；005C install/recovery diagnostics；006A user-configured lane/provider requirements descriptor；006B live config adapter approval contract。006B implementation commit `071b033`；typecheck PASS；103 files / 3267 tests PASS；不写 `~/.hermes/config.yaml`，不触 handoff/audit，不回显 API key/secret，不接 credential pool/keychain/local runtime。后续 006C+ live config adapter implementation 必须另批。 |
| **UI Slice 0** | Hermes Pro UI Contract Audit | ✅ 完成（`docs/design/UI-SLICE-0-CONTRACT-AUDIT-2026-06-05.md`）。Knowledge IPC 迁移已完成（三通道 main-process bridge）。Slice 1-2 已落地。 |
| **UI-DOC-SYNC-001** | 文档同步（ground truth / spec / SLICE-0 / contract） | ✅ 完成（2026-06-11 会话，文档与注释级，零代码改动）。见 `docs/closeout/hermes-pro-local-reality-closeout-2026-06-07.md` §UI-DOC-SYNC-001 Closeout Addendum。 |
| **UI-MACOS-001a** | 字体切换 body→system-first | ✅ **已完成**（2026-06-11）。`main.css` `--font-sans` 重写为 system-first（`-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, "Google Sans", sans-serif`）。Google Sans 保留在 fallback 尾部；@font-face 块与 .ttf 字体文件未删除。P1-3 修复。 |
| **UI-CN-001a** | 双语徽章组件 + 状态词统一表 | ✅ **已完成**（2026-06-11）。新增 `StatusBadge` 组件（中文 · English 格式）；`boundary-badge.ts` 双语 label；Layout.tsx topbar 接入；`--hp-state-*` CSS tokens 落地；`StatusBadge.test.tsx` 12 tests；`layout-boundary-badge.test.ts` 同步更新。 |
| **UI-CN-001b** | 只读页固定句中文化 + 确认弹层模板 + 四个高频场景 | ✅ **已完成**（2026-06-11）。3 屏幕双语 disclaimer "本页仅展示状态"；ConfirmDialog 组件；4 个预置场景；15 个 ConfirmDialog 测试。 |
| **UI-MACOS-001b** | Mission 三段式重排 | ✅ **已完成**（2026-06-11）。health summary row + stage track 5 nodes + blockers + next action + 4 collapsible detail sections；旧 STAGES/GUARDRAILS/MissionStat/MissionPanel 移除；MissionCollapsibleSection 新组件。 |
| **UI-CHAT-001a** | Chat-internal command palette overlay | ✅ **已完成**（2026-06-11）：520px centered frosted overlay；bilingual 中文·English；fuzzy filter name/description/CN；4 category groups；↑↓/Enter/Esc；click-outside dismiss；zero global dispatcher；zero IPC/package/main/preload. |
| **UI-CHAT-001b** | 审批栏强化 + 中文正则 | ⏳ **待用户批准**。Preflight：`docs/design/preflight/UI-CHAT-001b-approval-bar.md` |
| **UI-CHAT-001c** | Inspector 三 tab 化 + Chat 引用面板迁入 | ⏳ **待用户批准**。Preflight：`docs/design/preflight/UI-CHAT-001c-inspector-tabs.md` |
| **UI-KNOWLEDGE-001** | secret 脱敏 + 卡片四要素 | ⏳ **待用户批准**。Preflight：`docs/design/preflight/UI-KNOWLEDGE-001-redaction-cards.md` |
| **UI-ARCHIVE-001** | BaiLongma/HccCockpit 归档 | ⏳ **待用户批准**。Preflight：`docs/design/preflight/UI-ARCHIVE-001-dead-code.md` |
| **UI-SHELL-CONTRACT-001** | shell pseudo-view 入合约 | ⏳ **待用户批准**。Preflight：`docs/design/preflight/UI-SHELL-CONTRACT-001.md` |
| **UI-SAFETY-001** | 只读测试 import-graph 硬化 | ✅ **已完成**（2026-06-11）。contract 加 `enforcement` 字段；5 个 read_only view 设为 import-graph；新增 `tests/_helpers/import-graph.ts`；3 个测试文件加 import-graph 断言。installUpdate 已确认无原生确认弹层。 |

> **Productionization NOT APPROVED** — BaiLongma/HCC 仍停留在只读增强与候选设计阶段；写入/执行版必须另批。

> **Mano-P 待定** — Mano-P 已放入待定项目，不是当前计划、不是候选试点。检索到 Mano-P 只能报告待定状态，不得推进实施；UI-TARS/OpenAdapt 也需用户单独授权。

> **P3 执行委派规则（2026-06-04 更新）** — P3 dry-run baseline 001-006 + 008 + 009 已 PASS；P3 harness 8 artifact + P3.5 soft switch 已完成（观察期已结束，2026-06-04 用户裁决 **KEEP v0.15.1**，ADR-20260604-p3-5-soft-switch-decision-keep-v0-15-1；`hermes` 入口保持指向 candidate v0.15.1）；**Knowledge Reuse Chain Slice 004-006.9 / 007A-007N / 008A-008M 已完成、6 commits 推送、当时全量基线 81 files / 2931 tests PASS**。后续项目/代码任务由 Claude Code 按 dry-run 契约执行（产 plan / verifier section / handoff payload / artifact record / Surface B prompt），不接真实执行入口。Hermes 负责需求整理、计划审查、知识检索、Handoff Pack、执行结果归档；不得直接启动 HCC Auto Executor、注册真实执行 IPC、或接 CLI-Anything / Safari MCP 深度动作。Round 2 C 仍冻结；hard cutover 仍未批；L6 live knowledge flush 未批准。008 + 009 + hermes-candidate wrapper + task-dispatch-prompt-builder 已覆盖 Hermes ↔ Claude Code dry-run 状态交换的完整契约链。

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
| [docs/model-strategy/hermes-model-strategy-2026-06-05.md](./docs/model-strategy/hermes-model-strategy-2026-06-05.md) | MODEL-STRATEGY 001-006B dry-run / design-only model lane, provider requirements, and approval contract chain |
| [docs/research/echobird-hermes-optimization-plan-2026-06-06.md](./docs/research/echobird-hermes-optimization-plan-2026-06-06.md) | EchoBird product-pattern reference status for MODEL-STRATEGY 005A-006A |
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

| 最后更新 | 2026-06-06（P0/P0.5/P1/P1.5/P2/P2.5/P3 dry-run 001-006 + 008 + 009 + P3 harness 8 artifact + P3.5 soft switch PASS + P7 4 个低优先级 cron job deliver=local 已完成 + BaiLongma Read-only Cockpit Final Polish PASS + **P3.5 soft switch KEEP v0.15.1（ADR-20260604-p3-5-soft-switch-decision-keep-v0-15-1）** + **Knowledge Reuse Chain Slice 004-006.9 / 007A-007N / 008A-008M 已完成 6 commits 推送、当时全量基线 81 files / 2931 tests PASS** + **MODEL-STRATEGY 001-006B 已完成推送，006B implementation commit `071b033`，typecheck PASS，103 files / 3267 tests PASS，全链路 dry-run / read-only / design-only / no-live-config** + **UI Design Spec 方向已获批、Slice 0 Contract Audit 待单独批准**；V5 保持 MVP_PARTIAL；P3 真实执行仍暂停；hard cutover 仍未批准；HCC Auto Executor 未批准、未启动、未接线；L6 live knowledge flush 未批准；BaiLongma/HCC Productionization NOT APPROVED；Round 2 C 仍冻结）|

## HCC v2 代码任务入口（2026-05-29）

以后代码任务默认流程：
Hermes 需求翻译/调度 -> 用户确认 -> 双视角审计划 -> Claude Code 隔离 worktree 执行 -> Codex 双审+测试 -> 用户交付

仅当 HCC v2 修复 3 次仍无法执行或无法通过测试时，降级到旧 code_dev：
Hermes -> Karpathy planner -> Claude Code executor -> Bellard reviewer -> deliver/escalate -> reflect

> **勘误指针 (2026-06-10)**：本文若引用"物理锁启用 / watchdog / violations.log / electron/ 路径 / 锁已生效"等历史描述，以 `docs/plan/_errata-2026-06-10.md` §H-8 为准，本文不改。
