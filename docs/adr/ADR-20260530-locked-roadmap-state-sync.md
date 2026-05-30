# ADR-20260530: Locked Roadmap State Sync

> **ADR ID**: ADR-20260530-locked-roadmap-state-sync
> **日期**: 2026-05-30
> **决策者**: 用户（已确认）
> **类型**: 事实状态同步

---

## 背景

`docs/roadmap-locked-2026-05-28.md` 是 Hermes Pro 的唯一锁定计划入口（Locked Roadmap v1.0）。

该文档自 2026-05-28 基线以来，以下版本状态已通过后续 commit 和 pipeline-runs 验证更新，但 roadmap-locked 本身尚未同步：

| 版本 | roadmap-locked 状态 | 实际状态（已验证）|
|------|---------------------|-------------------|
| V5 | ⏳ 未启动 | ⏸️ MVP_PARTIAL（TEXT_TO_PROMPT_ASSET_PACK_READY；C1/C2/C3 ✅；C4/C5 等 API key）|
| V6 | ⏳ 待启动 | ✅ MAIN COMPLETE（V6-2/V6-3/V6-4/V6-6 + DeepSeek 401 全 PASS）|
| V7 | ⏳ 待启动 | ✅ PARTIAL_COMPLETE（Safari MCP MVP PASS；browser-use DEFER；其他暂缓）|

**核心问题**：路线图状态落后于实际执行状态，会误导后续任务判断。

---

## 决策

**允许本次只做事实状态同步**，不改变路线图方向、优先级或架构决策。

修复目标：
- 将 V5/V6/V7 状态与已验证的 pipeline-runs 成果对齐
- P2 当前下一步从"进行中"更新为"已完成"
- 标注 V7-5 已从 V7 主线解绑
- 不夸大完成度（保留 MVP_PARTIAL / PARTIAL_COMPLETE 字样）

---

## 修改项

### 1. V5 状态（lines 28, 66, 93）
| 位置 | 当前值 | 修改为 |
|------|--------|--------|
| Mermaid 文字 | `V5[V5 变现检验<br/>未启动]` | `V5[V5 变现检验<br/>⏸️ MVP_PARTIAL]` |
| Mermaid 颜色 | `fill:#D3D3D3` | `fill:#FFFACD`（暖黄=部分/待资源）|
| 总览表 | `⏳ 未启动` | `⏸️ MVP_PARTIAL` |

### 2. V6 状态（lines 29, 67, 94）
| 位置 | 当前值 | 修改为 |
|------|--------|--------|
| Mermaid 文字 | `V6[V6 知识自动化<br/>待启动]` | `V6[V6 知识自动化<br/>✅ MAIN COMPLETE]` |
| Mermaid 颜色 | `fill:#D3D3D3` | `fill:#90EE90`（绿=完成）|
| 总览表 | `⏳ 待启动` | `✅ MAIN COMPLETE` |

### 3. V7 状态（lines 30, 68, 95）
| 位置 | 当前值 | 修改为 |
|------|--------|--------|
| Mermaid 文字 | `V7[V7 生态工具融合<br/>待启动]` | `V7[V7 生态工具融合<br/>✅ PARTIAL_COMPLETE]` |
| Mermaid 颜色 | `fill:#D3D3D3` | `fill:#98FB98`（浅绿=部分完成）|
| 总览表 | `⏳ 待启动` | `✅ PARTIAL_COMPLETE` |

### 4. P2 当前下一步（line 149）
| 当前值 | 修改为 |
|--------|--------|
| `P2：V6 知识自动化任务排序（进行中）` | `✅ P2：V6 MAIN COMPLETE（V6-1/V6-5 扩展/决策项暂缓）` |

### 5. V7-5 标注
在 V7 说明或原V4未完成→V7映射表中注明：
> V7-5（每日知识摘要自动推送）：已从 V7 主线解绑，归入 Delivery/Reliability 独立任务池

---

## 非目标（不做什么）

- ❌ 不批准 BaiLongma Productionization
- ❌ 不启动 V5 C4/C5（等待 API key）
- ❌ 不启动 V7 云端试点（Mano-P/UI-TARS 需用户授权）
- ❌ 不标 WeChat/iLink fully resolved（保持 mitigated_pending_observation）
- ❌ 不将 V5/V7 标为 fully complete（保留 MVP_PARTIAL / PARTIAL_COMPLETE）
- ❌ 不修改源码/配置/secret

---

## 证据来源

| 来源 | 验证内容 |
|------|----------|
| commit c4dd688 | V5 TEXT_TO_PROMPT_ASSET_PACK_READY；C1/C2/C3 ✅ |
| commit a25abf6 | V6 main complete — V6-2/V6-3/V6-4/V6-6 all PASS |
| commit df9ec96 | V7 PARTIAL_COMPLETE；Safari MCP MVP PASS |
| NEXT_STEP.md（已修正）| V6 MAIN COMPLETE；V5 MVP_PARTIAL；V7 PARTIAL_COMPLETE |
| ADR-20260530-v7-5-delivery-unbind.md | V7-5 已解绑至 Delivery/Reliability |
| WeChat/iLink remediation run | mitigated_pending_observation |

---

## 风险

**路线图颜色/状态改变可能被误读为全部完成**。

缓解措施：
1. V5 使用暖黄色（partial）而非全完成绿
2. V7 使用浅绿色（partial_complete）而非全完成绿
3. 状态列始终保留 `PARTIAL` / `PARTIAL_COMPLETE` 字样
4. 说明列中明确写 "C4/C5 等待 API key" / "browser-use DEFER" 等限制条件

---

## 验证

修改后需确认：
- `rg "V5.*未启动|V6.*待启动|V7.*待启动" docs/roadmap-locked-2026-05-28.md` → 0 matches
- `npm run typecheck` → PASS（如有渲染相关改动）
- git diff 不包含 `src/` 目录