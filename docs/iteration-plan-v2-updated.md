# Hermes Pro — 迭代计划兼容索引

> **Closeout Addendum — 2026-06-07**
> UI Slice 1–7 已完成并推送（`faf56f2` / `e0333ee` / `08db860` / `3e21df4` / `3dd12dd` / `de35e6f` / `b612d1a`）。
> Knowledge IPC Migration Slice 0–8B + Closeout + Fix-Applied Declaration 已完成并推送（12 commits: `86b4a8f` / `9c0c808` / `1b87fb4` / `3136ddd` / `cc44a6f` / `eeb4069` / `3842d7e` / `66d0440` / `2229c9a` / `d641370` / `5a27d20` / `600a7fb`）。
> Historical verified state for this Closeout Addendum: `HEAD == origin/hermes-pro-main == 600a7fb7be3e70127377db8fb8ab52fe1f35fed5`；working tree clean；121 files / 3505 tests PASS。
> Latest pushed learning-loop baseline before POST-PUSH-FACT-SYNC-001: `ab0cdb269078`。POST-PUSH-FACT-SYNC correction is local until explicitly pushed; verify current HEAD and origin with `git rev-parse --short=12 HEAD` / `git rev-parse --short=12 origin/hermes-pro-main` / `git rev-list --count origin/hermes-pro-main..HEAD` / `git rev-list --count HEAD..origin/hermes-pro-main`。Do NOT rely on any static HEAD string in this file。Latest verified full test baseline: 132 files / 3754 tests PASS。
> `src/preload/index.ts` 不含 `http://127.0.0.1:8643/knowledge*` raw fetch；`knowledgeSearch` / `knowledgeIngest` / `getGbrainStats` 已全部走 main-process IPC bridge；renderer API method names 与 response shapes 保持兼容；Knowledge / KnowledgeControl screen 行为不变。
> `SCREEN_BOUNDARY_CONTRACT_DIRECT_GATEWAY_FIX_APPLIED = true`。
> `~/.hermes/config.yaml` / `handoff/packs` / `audit` mtime 全程未变；`docs/roadmap-locked-2026-05-28.md` 未触碰。
> 仍需保留的安全护栏：`knowledgeIngest` 仍为 write path，必须由 explicit user action 触发；不得声明 L6 live knowledge flush / HCC Auto Executor / hard cutover / P3 真实执行 已启用。

> 更新日期：2026-06-06（最终计划同步：P7 WeChat/iLink 4 个低优先级 cron job deliver=local 已完成；BaiLongma Read-only Cockpit Final Polish PASS；**P3.5 soft switch KEEP v0.15.1（ADR-20260604-p3-5-soft-switch-decision-keep-v0-15-1）**；**Knowledge Reuse Chain Slice 004-006.9 / 007A-007N / 008A-008M 已完成、6 commits 推送（2f79c75 / 2a8dc08 / cdeea86 / 7c3e89b / d997914 / d5a6469）、closeout base HEAD == d5a6469efd84ba98730c2fa3924e769019756077 == origin/hermes-pro-main；当时工作区 clean；当时全量基线 81 files / 2931 tests PASS**；**MODEL-STRATEGY 001-006B 已完成并推送，006B implementation commit `071b033596bfe07541b48c2aee86188d379d0475`；006B closeout typecheck PASS + 103 files / 3267 tests PASS；全链路 dry-run / read-only / design-only / no-live-config**；V5 保持 MVP_PARTIAL，C4/C5 因生图/视频外部 API 不可控 + 成本不可控暂缓；HCC Auto Executor 未批准、未启动、未接线；P3 真实执行仍暂停；hard cutover 仍未批准；L6 live knowledge flush 未批准；BaiLongma/HCC Productionization NOT APPROVED；Round 2 C 仍冻结；Chain 当前只到 L5 dry-run / prompt-builder，不代表 live knowledgeIngest / live knowledgeSearch / default system prompt injection / Agent subprocess / L6 live flush 已启用）
> 状态：兼容索引，不是唯一计划入口
> 唯一锁定计划入口：[roadmap-locked-2026-05-28.md](./roadmap-locked-2026-05-28.md)
> 当前融合执行参考：[current-fusion-plan-2026-05-30.md](./current-fusion-plan-2026-05-30.md)

---

## 使用规则

本文件保留给旧链接和旧工作流读取。所有真实状态以锁定路线图、`NEXT_STEP.md`、V6/V7 状态文档为准。

知识库内容、桌面归档和外部 GitHub 项目不得自动改变路线图。进入主线必须经过 ADR + 用户确认。

灵魂落地状态以 [soul-hermes-pro-implementation-matrix-2026-06-07.md](./governance/soul-hermes-pro-implementation-matrix-2026-06-07.md) 为守门检查表。修改 `HERMES-SOUL.md`、学习闭环、安全写入路径、prompt 注入、HCC 编排、知识入库、Next Task Context 或 ranking 前，必须先确认该机制当前是机械级、契约级、约定级还是待建；不得把 design-only / dry-run / no runtime 写成 live runtime。

---

## 当前状态快照

| 版本 | 状态 | 说明 |
|------|------|------|
| V1 | ✅ 完成 | 基础可用 |
| V1.5 | ✅ 完成 | 修复阶段 |
| V2 | ✅ 4/5 完成 | Theme / AgentMonitor / MCP / Memory；BaiLongma 移出 |
| V3 | ✅ UI完成 | Knowledge / Vault / Recharts / GBrain stats / Horizon tab |
| V4 | ✅ POC-2 + QA PASS + Read-only Cockpit Final Polish | BaiLongma 只读 POC 完成；Final Polish 已 PASS（typecheck + 46 files / 995 tests PASS）；Productionization NOT APPROVED；报告：`~/.hermes/pipeline-runs/HCC-20260602-BAILONGMA-READONLY-FINAL-POLISH/01-report.md` |
| V5 | ⏸️ MVP_PARTIAL | TEXT_TO_PROMPT_ASSET_PACK_READY；C1/C2/C3 ✅；C4/C5 暂缓（生图/视频外部 API 不可控 + 成本不可控，非技术失败）|
| V6 | ✅ MAIN COMPLETE | 主干 5/5 完成；V6-1/V6-5 为扩展/决策项 |
| V7 | ✅ PARTIAL_COMPLETE | Safari MCP MVP PASS；browser-use DEFER；Mano-P 待定；Ruflo/UI-TARS 暂缓 |

---

## 融合架构摘要

当前确认具备 1+1>2 的主链路：

```text
多入口输入 -> 安全过滤 -> Understand-Anything -> Knowledge/Vault -> GBrain
             -> Hermes Handoff Pack -> 新会话/跨 Agent 续接
             -> BaiLongma Cockpit -> Hermes Core -> P2.5 Safety Foundation
             -> HCC/CodeGraph/Quality Loop
             -> CLI-Anything/Safari MCP -> Artifact Store -> Knowledge/Vault
```

当前瓶颈：

| 瓶颈 | 状态 |
|------|------|
| GBrain typed links | ✅ P1 MVP PASS；dream cycle 仍需产品设计 |
| Hermes Handoff Pack | ✅ P0.5 MVP PASS；P3 dry-run 006/008 已接 HCC handoff payload 与 tmpDir fixture |
| P2.5 Safety Foundation | ✅ PASS；权限/状态机/回滚/pre-flight/Action Gate/审计日志已补齐 |
| P3 HCC real execution | ⏸️ dry-run baseline 001-006 + 008 + 009 + harness 8 artifact + P3.5 soft switch PASS；**Knowledge Reuse Chain Slice 004-006.9 / 007A-007N / 008A-008M 已完成（6 commits，当时全量基线 81 files / 2931 tests PASS）**；HCC Auto Executor 未批准、未启动 |
| MODEL-STRATEGY 001-006B | ✅ PASS；dry-run / read-only / design-only | 001-004C dry-run lane/profile/UI-status helper stack；005A-005C EchoBird-inspired but Hermes-native design descriptors；006A user-configured lane/provider requirements descriptor；006B live config adapter approval contract。Implementation commit `071b033`；typecheck PASS；103 files / 3267 tests PASS；不写 live config、不回显 API key/secret、不接 credential pool/keychain/local runtime |
| Post-task Learning Loop | 🔄 LOOP-001.1 契约硬化 done + LOOP-002 fixture done + LOOP-003 usage-feedback adapter design done + LOOP-004 good pattern → skill candidate design done + LOOP-004b bad pattern → dead-end design done + LOOP-005 local LLM wiki connector design done + LOOP-006 knowledge ingest bridge design done + LOOP-006A human approval anchor + consumer guard routing design done (CONSUMER_ROUTE_MATRIX 9 entries; 20/20 tests; full suite 129 files / 3659 tests PASS) + LOOP-006A.1 / LOOP-006A.2 factual closeout (no new feature) + **LOOP-007 retrieval feedback simulation dry-run done** (pure descriptor + 6 helper + 2 projection + 1 guard + 1 apply-eligibility stub hard-wired to false + 3 candidate fixture + 1 fixture regenerator; no live ranking mutation; no live ranking input write; no Next Task Context write; no knowledgeIngest / knowledgeSearch; no live flush; no audit write; no persistence; no config write; no skill install; no HCC Auto Executor; live ranking 仍未启用) + **LOOP-008 reflection evaluator pure projection done** (pure descriptor + 4 per-source evaluator + 1 batch helper pair + scoring + verdict id + collapse + runtime guard + promotion-eligibility stub hard-wired to false + 3 verdict fixture + 1 fixture regenerator; no live flush; no knowledgeIngest; no knowledgeSearch; no audit write; no persistence; no config write; no Next Task Context write; no live ranking mutation; no skill install; no model runtime; no HCC Auto Executor; isReflectionEvaluatorPromotionEligible hard-wired to false) + **LOOP-009 knowledge quarantine / promotion adapter design-only done** (pure descriptor + 2 decision helper + decision id + collapse + runtime guard + apply-eligibility stub hard-wired to false + 3 decision fixture + 1 fixture regenerator; no live flush; no knowledgeIngest; no knowledgeSearch; no audit write; no persistence; no config write; no Next Task Context write; no live ranking mutation; no skill install; no HCC Auto Executor; no anchor verification; isQuarantinePromotionApplyEligible hard-wired to false) | 已补入审计版闭环：quarantine 默认隔离、provenance/trust/evidence hash、SafetyFlags、ApprovalGate、secret_scan、instruction_scan、human-only review actor、HumanApprovalRef、submitter 矩阵、Chinese instruction scan、hash 格式、extract* pre-review projection、consumer guard 强制 human_approval_ref；LOOP-002 投影 helper + 3 dry-run fixture + 10/10 tests PASS；LOOP-003 纯 descriptor + projection + fingerprint + collapse + 3 fixture + 13/13 tests PASS；LOOP-004 pure projection + fingerprint + collapse + eligibility + registry record + 2 fixture + 14/14 tests PASS；LOOP-004b pure projection + 阈值 classifier + 2 fixture + 16/16 tests PASS；LOOP-005 pure descriptor + 7-lane classifier + projection + fingerprint + collapse + runtime guard + activation eligibility + 3 fixture + 17/17 tests PASS；LOOP-006 7 per-source projection + batch projection + fingerprint + collapse + runtime guard + consumer eligibility + 3 fixture + 16/16 tests PASS；LOOP-006A 6 per-source decision helper + batch helper + decision id + collapse + runtime guard + 9-entry matrix + 3 fixture + 20/20 tests PASS（8 鎖全 false；verified_must_remain_false_in_contract_layer；anchor_verification_owner=consumer_or_anchor_layer）；LOOP-006A.1 CONSUMER_ROUTE_MATRIX 6→9 + 1 條矩陣覆蓋測試；LOOP-006A.2 factual closeout audit 修正文檔與測試口徑一致；**LOOP-007 retrieval feedback simulation dry-run done**：pure descriptor + 6 helper（id/classifier/projection/batch/collapse/guard）+ 1 apply-eligibility stub hard-wired to false + 3 candidate fixture（PASS reject / FAIL reject / manual_review context）+ 1 fixture regenerator（pure I/O）；3 dry-run fixture 全部 proposed_delta=0 / proposed_direction=none；live ranking mutation / ranking input write / Next Task Context write / flush / audit / persistence / config / ingest / search / skill install / model runtime / HCC Auto Executor 全锁 false；**LOOP-008 reflection evaluator pure projection done**：pure descriptor + 4 per-source evaluator（reflection / knowledge_ingest_draft / consumer_route_decision / retrieval_delta_candidate）+ 1 batch helper pair + scoring（0.85 / 0.4 thresholds; hard reject on missing evidence / failed secret scan / failed instruction scan）+ verdict id + collapse + runtime guard + promotion-eligibility stub hard-wired to false + 3 verdict fixture（PASS quarantine / FAIL quarantine / manual_review human_reviewed_candidate）+ 1 fixture regenerator（pure I/O）；PASS / FAIL verdict 全部 trust_band=quarantine 且 trust_score=0.65，manual_review verdict 全部 trust_band=human_reviewed_candidate（verified=false）且 trust_score=1.0；isReflectionEvaluatorPromotionEligible 永远 false；live flush / ingest / search / audit / persistence / config / Next Task Context write / live ranking mutation / skill install / model runtime / HCC Auto Executor 全锁 false；LOOP-008 ⇒ GO LOOP-009 design-only done / 任何 live apply 仍 NOT-GO；**LOOP-009 knowledge quarantine / promotion adapter design-only done**：pure descriptor + 2 decision helper（per-draft / batch）+ decision id + collapse + runtime guard + apply-eligibility stub hard-wired to false + 3 decision fixture（PASS remain_quarantined / FAIL remain_quarantined / manual_review promotion_candidate）+ 1 fixture regenerator（pure I/O）；PASS / FAIL decision 全部 proposed_state=remain_quarantined，manual_review decision 全部 proposed_state=promotion_candidate（verified=false；evaluator_trust_band=human_reviewed_candidate）；isQuarantinePromotionApplyEligible 永远 false；live flush / ingest / search / audit / persistence / config / Next Task Context write / live ranking mutation / skill install / HCC Auto Executor / anchor verification 全锁 false；live apply 仍冻结；后续 → 计划见 [hermes-post-task-learning-loop-plan-2026-06-07.md](./learning-loop/hermes-post-task-learning-loop-plan-2026-06-07.md) |
| BaiLongma/HCC Productionization | 未批准（仅允许只读增强；Final Polish 已 PASS）|
| WeChat/iLink delivery | low_priority_jobs_local_delivery_applied（4 个低优先级 cron job 已切 `deliver=local`；高优先级投递策略仍待独立决策）|

外部项目能力只进入候选/ADR：

| 项目 | 归属 |
|------|------|
| OpenClaw sandbox/allowlist | ADR 候选 |
| OpenHuman Memory Tree / TokenJuice | 架构借鉴，本地实现，不复制代码 |
| Handoff / handoff-agent | 长上下文续接层候选；先做本地 Hermes Handoff Pack，再评估 CLI 试点 |
| Ruflo worker taxonomy | ADR 候选，不替换 cron |
| Dograh STT/TTS | 候选池 |
| Mano-P visual E2E | 待定项目，不推进 |
| MiroFish simulation | 暂缓 |
| ECC harness-native skills/rules/checklists | HCC v2 Auto 后续候选；仅做只读审计与 Hermes 本地重写，不接 runtime；方案见 [ecc-hcc-v2-auto-non-destructive-adoption-plan-2026-06-05.md](./research/ecc-hcc-v2-auto-non-destructive-adoption-plan-2026-06-05.md) |
| EchoBird Model Nexus / Install Repair | PARTIAL GO：模型中心、本地兜底 UX、安装修复、用户自配 provider requirements 已落到 MODEL-STRATEGY 005A/005B/005C/006A；仅 Hermes-native design descriptors，不复制代码、不接 runtime、不写 live config；方案见 [echobird-hermes-optimization-plan-2026-06-06.md](./research/echobird-hermes-optimization-plan-2026-06-06.md) |

---

## 当前下一步

请读取 [NEXT_STEP.md](../NEXT_STEP.md)。当前不应从旧 K/P/融合计划派发任务。

---

## 历史归档

旧版文件已归档：

- [archive/iteration-plan-v2-updated-2026-05-28.md](./archive/iteration-plan-v2-updated-2026-05-28.md)
- `/Users/midoudou/Desktop/知识/Hermes 代码任务/过时计划/`
