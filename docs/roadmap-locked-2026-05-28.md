# Hermes Pro — 锁定版路线图（2026-05-28 重基线）

> 版本：Locked Roadmap v1.0
> 生效日期：2026-05-28
> 锁定规则：禁止 Agent 自行修改；变更需新建 ADR + 用户确认

---

## 路线图锁定声明

本文档是 Hermes Pro 的**唯一锁定计划**（Locked Roadmap）。

- **知识库内容不自动改变路线图**。vault/Desktop知识/归档文档只能进入候选池（Candidate Pool），需 ADR + 用户确认才能进入锁定主线。
- **禁止 Agent 自行修改路线图**。任何路线图变更必须新建 ADR，并等待用户确认。
- **已完成的版本不得回滚**。除非用户明确说"解锁路线图"。

---

## 整体计划架构

```mermaid
flowchart LR
    subgraph LOCKED["锁定主线"]
        V1[V1 基础可用<br/>✅ 完成]
        V2[V2 效率提升<br/>✅ 4/5]
        V3[V3 知识赋能<br/>✅ UI完成]
        V4[V4 BaiLongma<br/>POC-2✅+QA PASS]
        V5[V5 变现检验<br/>⏸️ MVP_PARTIAL]
        V6[V6 知识自动化<br/>✅ MAIN COMPLETE]
        V7[V7 生态工具融合<br/>✅ PARTIAL_COMPLETE]
    end

    V1 --> V2 --> V3 --> V4 --> V5 --> V6 --> V7

    V3 -.->|"迁移:UI展示→真实飞轮"| V6

    subgraph MIGRATED["从旧计划迁移"]
        OLD_V4[原V4生态工具]
    end
    OLD_V4 -.->|"迁移:CLI/Ruflo/Mano/OpenHuman"| V7

    subgraph CANDIDATE["候选输入池"]
        KB[知识库内容<br/>vault/归档]
        VAULT[Vault内容]
        ALTS[替代候选<br/>UI-TARS等]
    end

    subgraph APPROVAL["变更流程"]
        ADR[ADR文档]
        USER[用户确认]
        BUG[Bug Report]
    end

    KB --> ADR
    VAULT --> ADR
    ALTS --> ADR
    BUG --> ADR
    ADR --> USER
    USER --> CHANGE
    CHANGE -.->|修改| LOCKED

    style V1 fill:#90EE90
    style V2 fill:#90EE90
    style V3 fill:#90EE90
    style V4 fill:#98FB98
    style V5 fill:#FFFACD
    style V6 fill:#90EE90
    style V7 fill:#98FB98
    style OLD_V4 fill:#FFE4B5
    style CANDIDATE fill:#E0E0E0
    style APPROVAL fill:#E8F4FD
    style CHANGE fill:#FFB6C1
    style BUG fill:#FFFACD
```

**图例说明**：
- 知识库内容（KB/VAULT）不能直接进入锁定主线，必须经过 ADR + 用户确认。
- 替代候选（ALTS）同样需经过此流程。
- Bug Report 只能通过 ADR + 用户确认修改 Locked Roadmap，不能直接进入 V6/V7。
- 锁定主线（LOCKED）只能通过 ADR + 用户批准后修改。

---

## V1-V7 总览表

| 版本 | 口号 | 状态 | 核心产出 |
|------|------|------|---------|
| **V1** | 基础可用 | ✅ 完成 | GBrain修复 + 启动修复 + PlaybookRunner + U-A/llm-checker |
| **V1.5** | 修复阶段 | ✅ 完成 | IPC审计 + any清理 + execSync→spawn + i18n四语言 |
| **V2** | 效率提升 | ✅ 4/5 完成 | Theme + AgentMonitor + MCP + Memory；BaiLongma移出 |
| **V3** | 知识赋能 | ✅ UI完成 | Knowledge页面 + Vault增强 + Recharts + GBrain stats + Horizon tab |
| **V4** | BaiLongma认知编排 | ✅ POC-2+QA PASS | Layer 1-3 + POC-1 + POC-2 + typecheck通过 + Manual QA PASS；Productionization NOT APPROVED |
| **V5** | 变现检验 | ⏸️ MVP_PARTIAL | C1/C2/C3 ✅；C4/C5 等待 API key；Dograh/TTS 待替代方案 |
| **V6** | 知识自动化补完 | ✅ MAIN COMPLETE | 主干 5/5 完成；V6-1/V6-5 扩展/决策项待定 |
| **V7** | 生态工具融合 | ✅ PARTIAL_COMPLETE | Safari MCP MVP PASS；browser-use DEFER；Ruflo/Mano-P/UI-TARS 暂缓 |

---

## V3 未完成 → V6 映射表

原 V3 计划中 UI 已完成、自动化后续迁移到 V6 的内容。V6 主干已完成，剩余仅为扩展/产品决策项：

| 原任务 | 当前状态 | 迁移到V6 | 原因 |
|--------|---------|---------|------|
| GBrain typed links + dream cycle | ❌ 未实现 | V6 扩展 | 需额外产品设计，未进入主干实施 |
| Horizon cron 自动入vault + 评分阈值 | ✅ 已验证 | V6 主干 | cron deliver:local PASS，输出写入 vault |
| K3 学习方向每周自动更新 | ✅ 已验证 | V6 主干 | K3 cron 已创建，manual trigger PASS |
| SQLite/Filesystem/Git MCP 配齐 | ✅ 已完成 | V6 主干 | Filesystem/Git MCP Connected，runtime validation PASS |
| HCC流程入主线 | ⏸️ 产品决策 | V6 扩展 | 阶段1-4是否代码化需用户确认 |
| CodeGraph / codebase-memory-mcp 重新索引 | ✅ 已验证 | V6 主干 | nodes=2078, edges=3588, status=ready |

详见 [v6-knowledge-automation-plan.md](./v6-knowledge-automation-plan.md)

---

## 原V4未完成 → V7 映射表

| 原任务 | 当前状态 | 迁移到V7 | 原因 |
|--------|---------|---------|------|
| CLI-Anything / Safari MCP | ✅ MVP PASS | V7 | Safari MCP 已接入 Hermes，smoke test PASS |
| Ruflo loop-workers | ⏸️ 暂缓 | V7 候选 | Hermes cron问题在业务层，非调度层；只借鉴 worker taxonomy，不替换 cron |
| Mano-P | ⏸️ 候选暂缓 | V7 | 候选暂缓：当前M5 16GB不满足Mano-P本地部署内存要求（需M4+ 32GB） |
| OpenHuman Memory Tree | ⏸️ 架构候选 | V7 候选 | 从未进入实施；可借鉴 Memory Tree/TokenJuice，需设计定义 |
| 每日知识摘要自动推送 | ❌ 未实现 | ~~V7~~ → Delivery | V7-5 已从 V7 主线解绑，归入 Delivery/Reliability 独立任务池（见 ADR-20260530） |

**GUI-VLA 方向备注**：Mano-P 暂缓，UI-TARS Desktop 进入候选池，需单独试点验证后才能进入锁定路线图。

**外部 Agent 能力萃取备注**：OpenClaw sandbox/allowlist、OpenHuman Memory Tree/TokenJuice、Ruflo worker taxonomy 已形成 ADR 草案；未获用户批准前只保留为候选或架构借鉴，不直接进入锁定主线。

详见 [v7-ecosystem-integration-plan.md](./v7-ecosystem-integration-plan.md)

---

## 变更规则

1. **不允许 Agent 自行改路线图**。Agent 发现需变更时，必须新建 ADR 说明原因和建议。
2. **不允许知识库内容自动改路线图**。vault/归档/替代候选只能进入候选池，不能直接写入锁定主线。
3. **任何路线图变更必须新建 ADR**，并等待用户确认后才能修改本文档。
4. **已锁定版本不降级**。已完成的任务标记为完成，不得回滚。
5. **解锁条件**：用户明确说"解锁路线图"后，方可修改本文档。
6. **Roadmap Bug Report 通道**：如果 Agent 发现路线图存在链接错误、事实错误、状态冲突或会误导执行的问题，允许向用户提交 Roadmap Bug Report。报告只能包含问题、证据、建议修正，不得直接修改锁定路线图。用户确认后，按 ADR + 用户确认流程修改。

---

## 当前唯一下一步

> **P0：BaiLongma Manual QA ✅ 已完成（2026-05-29）**
>
> **P1：路线图锁定确认 ✅ 已完成**
>
> **✅ P2：V6 MAIN COMPLETE（V6-1/V6-5 扩展/决策项暂缓）**

---

## 相关文档

| 文档 | 用途 |
|------|------|
| [NEXT_STEP.md](../NEXT_STEP.md) | 下一步行动指南 |
| [CONTEXT.md](../CONTEXT.md) | 项目上下文 |
| [v2-status.md](./v2-status.md) | V2 各任务实际状态 |
| [v3-status.md](./v3-status.md) | V3 各任务实际状态 |
| [v6-knowledge-automation-plan.md](./v6-knowledge-automation-plan.md) | V6 知识自动化计划 |
| [v7-ecosystem-integration-plan.md](./v7-ecosystem-integration-plan.md) | V7 生态工具计划 |
| [deprecation-candidates-2026-05-28.md](./deprecation-candidates-2026-05-28.md) | 废弃/过时候选清单 |
| [bailongma/README.md](./bailongma/README.md) | BaiLongma 设计索引 |

---

*本文档是锁定版路线图。任何修改必须通过 ADR + 用户确认。*
