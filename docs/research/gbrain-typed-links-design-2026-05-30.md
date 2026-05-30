# GBrain Typed Links + Dream Cycle 设计文档

> 版本：v0.1 Draft
> 日期：2026-05-30
> 状态：草案 — 不修改锁定路线图；用户确认后才可进入实现
> 前置：V6 MAIN COMPLETE；HCC Cockpit Read-only POC 已提交

---

## 1. 背景与当前缺口

### 1.1 GBrain 现状

Knowledge 页面中 GBrain tab 当前仅显示：
- 总 pages / chunks 统计
- 按类型分布（wiki/skills/failure-lessons/raw）
- 周频次时间线（Recharts）

**没有：**
- 碎片知识之间的关联关系
- 跨 vault 文件的语义链接
- 失败经验的闭环利用
- 近期关注点的反推

### 1.2 为什么是瓶颈

Hermes Pro 知识链路：

```
CodeGraph → GBrain → Horizon → Vault/Knowledge → Understand → BaiLongma/HCC
```

当前链路是**线性**的：每个节点单向输出给下一个节点。碎片知识 → 吸收 → 使用 → 变现 的闭环缺少"关系层"。即：

- 用户积累了碎片（Knowledge ingest）
- 但碎片之间没有链接，无法看到关系网络
- Horizon 产出每日摘要，但摘要与 vault 历史知识之间没有关联
- Understand 分析结果是一次性的，没有沉淀为可复用关系
- 失败经验（failure-lessons）只存储，未参与学习方向推导

### 1.3 设计目标

帮用户回答这个问题：

> "我最近关注了什么？这些关注点之间的关系是什么？为什么系统推断我对 X 方向感兴趣？"

---

## 2. 产品目标

### 2.1 typed links

在 GBrain 中增加**类型化链接**——指明碎片知识 A 和碎片知识 B 之间的语义关系。

- 用户能看知识图谱，而非孤立碎片
- 每条 link 可溯源（evidence）
- 区分关系类型（支持/矛盾/细化/依赖等）

### 2.2 dream cycle

周期性离线处理：将碎片知识中的隐含模式"浮现"出来。

- 每日/每周运行一次（类似 Horizon cron）
- 从 vault 历史 + failure-lessons + Understand 结果中推断关注点
- 不做自动写入，仅生成摘要供用户 review
- 失败经验参与学习方向推导

### 2.3 与 V6 主干的区别

V6 已完成的是**数据入口自动化**：
- Horizon cron → vault 写入
- K3 → learning-direction.md 写入
- GBrain stats（已有，只读）

V6-1 补的是**关系推理层**：
- typed links 是横跨 vault 的语义关系图
- dream cycle 是周期性的模式浮现

---

## 3. 非目标

| 非目标 | 原因 |
|--------|------|
| 不做新学习 track | 已有 K3 满足 |
| 不替代 Vault/Knowledge | typed links 是 Vault 之上的关系层 |
| 不启动 HCC Productionization | HCC Cockpit Read-only 已满足监控需求 |
| 不接 OpenHuman Memory Tree 代码 | 只借鉴架构；代码不复制 |
| 不做自动写入主线 | 需单独 ADR 批准 |
| 不修改锁定路线图 | 设计文档归档于 docs/gbrain/ |

---

## 4. Typed Links 数据模型

### 4.1 最小字段设计

```typescript
interface TypedLink {
  // 唯一标识
  id: string;

  // 链接的两端
  sourceId: string;    // 格式：vault://{file_path} 或 gbrain://{chunk_id}
  targetId: string;

  // 关系类型（见 4.2）
  relationType: RelationType;

  // 推断置信度 [0, 1]
  confidence: number;

  // 推断证据片段（原文引用）
  evidence: string;

  // 元信息
  createdAt: string;    // ISO 8601
  sourceKind: "vault_file" | "understand_result" | "horizon_summary" | "failure_lesson" | "knowledge_chunk";
  targetKind: "vault_file" | "understand_result" | "horizon_summary" | "failure_lesson" | "knowledge_chunk";

  // 可选：关联的 HCC task / session
  contextTaskId?: string;
  contextSessionId?: string;
}
```

### 4.2 relation_type 候选

| relation_type | 含义 | evidence 来源 |
|---------------|------|-------------|
| `supports` | A 支持 B 的观点 | Understand 总结 / Knowledge search 结果 |
| `contradicts` | A 与 B 矛盾 | Knowledge search 结果中的相反结论 |
| `elaborates` | A 细化/展开 B | vault 文件继承关系 |
| `depends_on` | A 依赖 B 的结论 | Understand 依赖链 |
| `repeats` | A 与 B 内容重复 | Knowledge chunk 相似度检测 |
| `supersedes` | A 是 B 的更新版本 | Horizon 摘要覆盖 |
| `applies_to_project` | A 适用于某项目 | Understand 结果 + 项目名识别 |
| `applies_to_manga` | A 适用于某漫画 | failure-lessons 中的漫画关联 |
| `blocked_by` | A 被 B 阻塞 | failure-lessons 中的失败原因链 |
| `learned_from_failure` | A 是从 B 的失败中学到的 | failure-lessons → 新理解 |
| `related_to_trend` | A 与当前热点相关 | Horizon summary + GBrain 时序分析 |
| `suggests_exploration` | A 建议探索方向 | K3 learning direction + typed links 聚合 |

### 4.3 推断策略（初始版本）

**不依赖 LLM 推理**，使用规则+向量相似度混合：

1. **文件路径继承**：`wiki/ai/xxx.md` → `wiki/ai/deepseek/xxx.md` → `elaborates`
2. **Horizon → vault**：Horizon 摘要覆盖某 vault 文件 → `supersedes`
3. **failure-lessons → Understand**：失败经验中提到的概念出现在 Understand 结果 → `learned_from_failure`
4. **Understand 依赖链**：`depends_on` 直接从 Understand 输出中提取
5. **向量相似度**：余弦相似度 > 0.85 → `repeats`
6. **项目/漫画名识别**：从文件名/内容中正则匹配项目代号/漫画名 → `applies_to_project`

---

## 5. Dream Cycle 概念设计

### 5.1 输入

| 来源 | 内容 |
|------|------|
| Vault 历史（近 N 天） | 新增/修改的 vault 文件 |
| failure-lessons | 过去一周的失败记录 |
| Understand 结果 | 近期 Understand 分析摘要 |
| Horizon 摘要 | 每日 Horizon 摘要 |
| typed links（已有） | 已推断的关系网络 |

### 5.2 处理（夜间/周期性）

```
dream_cycle():
  1. 收集过去 N 天的知识增量
  2. 提取失败经验中的根因关键词
  3. 提取 Understand 结果中的 action items
  4. 与已有 typed links 聚合
  5. 生成关注点摘要（不上线，等待 review）
  6. 输出：dream_summary.md（不上线）+ 关系更新候选
```

### 5.3 输出

| 输出 | 用途 | 是否自动上线 |
|------|------|------------|
| `dream_summary.md` | 用户 review 后手动确认 | ❌ 草稿，需用户确认 |
| typed links 候选 | 用户 review 后可一键采纳或拒绝 | ❌ 候选，需用户确认 |
| 关注点时间线 | 显示 GBrain 中 | ✅ 只读 |
| 失败闭环报告 | 失败经验如何参与学习 | ✅ 只读 |

### 5.4 如何避免胡乱总结

1. **无 LLM 推理**：所有推断基于规则 + 向量相似度，有 evidence 才写 link
2. **confidence 阈值**：confidence < 0.7 的 link 不展示（或默认折叠）
3. **evidence 必填**：每条 link 必须有原文引用，否则不可见
4. **用户 review 门**：dream_summary 草稿不上线，需用户确认后才进入 vault
5. **失败经验单独展示**：不混入常规 links，单独分区块

### 5.5 失败经验闭环

当前 failure-lessons 目录只存储失败记录，没有利用。

dream cycle 补全闭环：

```
failure-lessons/[date].md
    ↓ 提取根因关键词 + 关联项目
    ↓
learned_from_failure links
    ↓
dream_summary 中包含 "从失败中学到：..."
    ↓
用户 review → 确认后 → 可进入 K3 learning direction
```

---

## 6. 与现有模块关系

### 6.1 模块关系图

```
CodeGraph ──────────────────────────────────────┐
                                                   │
GBrain ─────┬── typed links ──→ [GBrain 图谱 UI]  │
            │                                     │
            └── dream cycle ──→ dream_summary ──→ [用户 review] ──→ K3/Learning Direction
                                                   │
Horizon ────→ 每日摘要 ──→ supersedes links ──┤
                                                   │
Vault/Knowledge ── ingest ──→ 碎片知识 ────────────┤
                                                   │
Understand ──→ 分析结果 ──→ elaborates/depends_on links ─┘
                                                   │
failure-lessons ──→ learned_from_failure links ───┘
```

### 6.2 详细关系

| 模块 | 与 typed links / dream cycle 的关系 |
|------|-----------------------------------|
| **GBrain stats** | typed links 图谱叠加在现有 stats 之上；dream cycle 输出显示在 stats timeline |
| **Knowledge ingest** | 新 ingest 的文件立即参与 typed links 推断 |
| **Vault** | typed links 指向 vault://{path}；不修改 vault 内容 |
| **Understand** | Understand 结果参与 elaborates / depends_on links 推断 |
| **Horizon** | Horizon 摘要参与 supersedes / related_to_trend links |
| **failure-lessons** | 参与 learned_from_failure / blocked_by links |
| **K3 / learning-direction** | dream_summary 可被用户引用，但不自动写入 |
| **BaiLongma / HCC** | typed links 可作为 HCC context 来源（只读）；HCC Cockpit Read-only 监控 dream cycle 运行状态 |
| **HCC Cockpit** | 可显示 dream cycle 最近运行时间和状态（只读） |

### 6.3 不侵入的边界

- GBrain typed links 是 Vault 之上的视图层，不修改 Vault 文件
- dream cycle 输出默认草稿，不自动进入 Vault/Knowledge
- 不修改 Horizon cron 逻辑
- 不修改 Understand 逻辑
- 不修改 HCC stage 定义

---

## 7. 外部能力借鉴边界

### 7.1 借鉴来源

| 外部项目 | 借鉴内容 | 不借鉴内容 |
|----------|----------|------------|
| **OpenHuman Memory Tree** | 层级摘要架构（短期→中期→长期）；不复制 Rust 代码 | TokenJuice 具体实现 |
| **OpenHuman TokenJuice** | 压缩策略概念；不复制具体压缩算法 | TokenJuice 闭源实现 |
| **Ruflo trajectory learning** | action ledger 概念（记录成功/失败模式）；不复制 TypeScript 代码 | Ruflo worker taxonomy 具体实现 |
| **OpenClaw allowlist** | 权限边界设计思路（channel 权限分层）；不复制 allowlist 具体条目 | channel 安全模型代码 |

### 7.2 借鉴原则

1. **架构借鉴 > 代码复制**：只借鉴数据结构和处理流程概念
2. **外部项目 ADR 前不入主线**：ADR 未批准，相关借鉴只记录在设计文档中
3. **GPL/AGPL 代码不复制**：MiroFish（MiroFish License）不借鉴具体算法
4. **TokenJuice 闭源**：TokenJuice 服务不接入，只借鉴"分层压缩"概念

---

## 8. 最小 POC 建议

### 8.1 POC Scope（只设计，不实现）

**POC 1: typed links read-only preview**

- 数据源：现有 vault 文件 + Understand 结果（不新增 API）
- 推断：基于文件路径继承 + Horizon supersedes（规则推断）
- UI：在 GBrain tab 新增 "Links" 子 tab，仅显示 read-only link list
- 存储：内存中计算，不持久化（或持久化到单独 JSON，需另开 ADR）
- 限制：不含 dream cycle，不含 LLM 推理

**POC 2: dream cycle 生成草稿（CLI 可选）**

- 运行方式：用户手动触发或 Horizon cron 触发（不新建 cron）
- 输出：`~/.hermes/hermes-pro/default/dream_summary_draft.md`
- UI：不改 Hermes Pro UI；仅在 GBrain tab 显示 "dream summary 草稿待 review"
- 存储：文件落盘，需用户手动 copy 到 vault

### 8.2 POC 限制

- 不修改 Hermes Pro 主 IPC
- 不新增 preload handler
- 不新增 cron job
- 不写 Vault/Knowledge（dream_summary 草稿路径与 vault 分开）
- 不改 locked roadmap

---

## 9. 验收标准

| ID | 标准 | 验证方式 |
|----|------|----------|
| AC-1 | 每条 typed link 有 evidence 片段（原文引用） | link 对象 evidence 字段非空 |
| AC-2 | confidence < 0.7 的 link 默认折叠或隐藏 | UI 显示阈值控制 |
| AC-3 | failure-lessons 中的失败记录参与 links 推断 | 生成 link 中 relation_type 含 learned_from_failure |
| AC-4 | dream_summary 草稿需用户手动确认才可上线 | 输出路径与 vault 分开，默认草稿 |
| AC-5 | typed links 不修改 vault 文件内容 | links 指向 vault://{path}，不写入 vault |
| AC-6 | 用户能解释某关注点为何被推断出来 | dream_summary 中含推断依据 |
| AC-7 | 不把无 evidence 推断写成 facts | 无 evidence 不生成 link |

---

## 10. 风险与待用户决策

| ID | 问题 | 选项 |
|----|------|------|
| R-1 | typed links 是否允许持久化到 SQLite / JSON | A) 不持久化，每次计算；B) 持久化到 JSON（需 ADR）；C) 持久化到 SQLite（需 ADR） |
| R-2 | dream_summary 草稿存哪里 | A) ~/.hermes/dream_drafts/（与 vault 分开）；B) vault/dream/（需 Vault 写入 ADR） |
| R-3 | 是否允许 dream cycle 自动化运行 | A) 用户手动触发；B) 挂靠 Horizon cron 运行（需 cron ADR） |
| R-4 | 是否允许 typed links 写入 Vault/Knowledge | A) 不允许，只读；B) 用户确认后写入（需 Vault 写入 ADR） |
| R-5 | 是否进入 V6 扩展主线 | A) 暂缓，用户 review 后决定；B) 进入 V6 扩展，需 ADR 批准 |

---

## 11. 下一步建议

```
当前状态：设计草案
    ↓
用户 review 本文档（2-3 天内）
    ↓
若批准 → 新建 ADR（typed links 持久化方案 + dream cycle 运行方案）
    ↓
ADR 批准 → V6-1 进入实现（作为 V6 扩展，非主干）
    ↓
若不批准 → 本文档归档，不进入实现
```

---

## 12. 相关文档

| 文档 | 关系 |
|------|------|
| [docs/v6-knowledge-automation-plan.md](../v6-knowledge-automation-plan.md) | V6-1 在 V6 计划中标记为"需产品决策" |
| [docs/roadmap-locked-2026-05-28.md](../roadmap-locked-2026-05-28.md) | V6-1 暂缓，不修改此路线图 |
| [docs/adr/ADR-20260530-external-agent-capability-adoption.md](../adr/ADR-20260530-external-agent-capability-adoption.md) | 外部项目能力借鉴参考；ADR 仍为草案 |
| [docs/bailongma/README.md](../bailongma/README.md) | BaiLongma / HCC 与 typed links 的关系 |
| [docs/adr/ADR-20260530-hcc-cockpit-readonly-poc.md](../adr/ADR-20260530-hcc-cockpit-readonly-poc.md) | HCC Cockpit Read-only 是 typed links 的只读 context 来源 |
| [src/renderer/src/screens/Knowledge/Knowledge.tsx](../../src/renderer/src/screens/Knowledge/Knowledge.tsx) | GBrain tab 现有实现 |

---

*本文档是 V6-1 设计草案，不修改锁定路线图。用户确认后才可进入实现阶段。*
