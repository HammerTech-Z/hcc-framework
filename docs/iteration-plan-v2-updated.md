# Hermes Pro — 迭代计划兼容索引

> 更新日期：2026-06-04（最终计划同步：P7 WeChat/iLink 4 个低优先级 cron job deliver=local 已完成；BaiLongma Read-only Cockpit Final Polish PASS；**P3.5 soft switch KEEP v0.15.1（ADR-20260604-p3-5-soft-switch-decision-keep-v0-15-1）**；**Knowledge Reuse Chain Slice 004-006.9 / 007A-007N / 008A-008M 已完成、6 commits 推送（2f79c75 / 2a8dc08 / cdeea86 / 7c3e89b / d997914 / d5a6469）、closeout base HEAD == d5a6469efd84ba98730c2fa3924e769019756077 == origin/hermes-pro-main；当时工作区 clean；全量基线 81 files / 2931 tests PASS**；V5 保持 MVP_PARTIAL，C4/C5 因生图/视频外部 API 不可控 + 成本不可控暂缓；HCC Auto Executor 未批准、未启动、未接线；P3 真实执行仍暂停；hard cutover 仍未批准；L6 live knowledge flush 未批准；BaiLongma/HCC Productionization NOT APPROVED；Round 2 C 仍冻结；Chain 当前只到 L5 dry-run / prompt-builder，不代表 live knowledgeIngest / live knowledgeSearch / default system prompt injection / Agent subprocess / L6 live flush 已启用）
> 状态：兼容索引，不是唯一计划入口
> 唯一锁定计划入口：[roadmap-locked-2026-05-28.md](./roadmap-locked-2026-05-28.md)
> 当前融合执行参考：[current-fusion-plan-2026-05-30.md](./current-fusion-plan-2026-05-30.md)

---

## 使用规则

本文件保留给旧链接和旧工作流读取。所有真实状态以锁定路线图、`NEXT_STEP.md`、V6/V7 状态文档为准。

知识库内容、桌面归档和外部 GitHub 项目不得自动改变路线图。进入主线必须经过 ADR + 用户确认。

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
| P3 HCC real execution | ⏸️ dry-run baseline 001-006 + 008 + 009 + harness 8 artifact + P3.5 soft switch PASS；**Knowledge Reuse Chain Slice 004-006.9 / 007A-007N / 008A-008M 已完成（6 commits，全量基线 81 files / 2931 tests PASS）**；HCC Auto Executor 未批准、未启动 |
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

---

## 当前下一步

请读取 [NEXT_STEP.md](../NEXT_STEP.md)。当前不应从旧 K/P/融合计划派发任务。

---

## 历史归档

旧版文件已归档：

- [archive/iteration-plan-v2-updated-2026-05-28.md](./archive/iteration-plan-v2-updated-2026-05-28.md)
- `/Users/midoudou/Desktop/知识/Hermes 代码任务/过时计划/`
