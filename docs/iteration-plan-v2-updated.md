# Hermes Pro — 迭代计划兼容索引

> 更新日期：2026-05-30
> 状态：兼容索引，不是唯一计划入口
> 唯一计划入口：[roadmap-locked-2026-05-28.md](./roadmap-locked-2026-05-28.md)

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
| V4 | ✅ POC-2 + QA PASS | BaiLongma 只读 POC 完成；Productionization NOT APPROVED |
| V5 | ⏸️ MVP_PARTIAL | TEXT_TO_PROMPT_ASSET_PACK_READY；C4/C5 等待 API key |
| V6 | ✅ MAIN COMPLETE | 主干 5/5 完成；V6-1/V6-5 为扩展/决策项 |
| V7 | ✅ PARTIAL_COMPLETE | Safari MCP MVP PASS；browser-use DEFER；Ruflo/Mano-P/UI-TARS 暂缓 |

---

## 融合架构摘要

当前确认具备 1+1>2 的主链路：

```text
CodeGraph -> GBrain -> Horizon -> Vault/Knowledge -> Understand -> BaiLongma/HCC -> Safari MCP
```

当前瓶颈：

| 瓶颈 | 状态 |
|------|------|
| GBrain typed links + dream cycle | 未实现，需产品设计 |
| BaiLongma/HCC Productionization | 未批准 |
| WeChat/iLink delivery | mitigated_pending_observation |

外部项目能力只进入候选/ADR：

| 项目 | 归属 |
|------|------|
| OpenClaw sandbox/allowlist | ADR 候选 |
| OpenHuman Memory Tree / TokenJuice | 架构借鉴，本地实现，不复制代码 |
| Ruflo worker taxonomy | ADR 候选，不替换 cron |
| Dograh STT/TTS | 候选池 |
| Mano-P visual E2E | 硬件暂缓 |
| MiroFish simulation | 暂缓 |

---

## 当前下一步

请读取 [NEXT_STEP.md](../NEXT_STEP.md)。当前不应从旧 K/P/融合计划派发任务。

---

## 历史归档

旧版文件已归档：

- [archive/iteration-plan-v2-updated-2026-05-28.md](./archive/iteration-plan-v2-updated-2026-05-28.md)
- `/Users/midoudou/Desktop/知识/Hermes 代码任务/过时计划/`
