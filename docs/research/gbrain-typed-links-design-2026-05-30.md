# GBrain Typed Links + Dream Cycle 设计文档

> 版本：v0.2 Revised
> 日期：2026-05-30
> 状态：草案 — 不修改锁定路线图；用户确认后才可进入实现
> 前置：V6 MAIN COMPLETE；HCC Cockpit Read-only POC 已提交
>
> **修订说明（v0.2）**：根据设计复核报告，MVP 范围已精简。dream cycle、LLM 推理、持久化全部移入 Future Work。

---

## 摘要

本文档描述 V6-1 GBrain typed links + dream cycle 的产品/数据模型设计。

**设计分两阶段**：
1. **MVP**（本文档第一部分）— typed links read-only，纯内存计算，用户可看 link 列表
2. **Future Work**（本文档第二部分）— dream cycle、持久化、自动写入、更多 relation_type

MVP 不需要 ADR。Future Work 需要独立 ADR + 用户确认后才能进入实现。

---

# 第一部分：MVP 设计

## 1. 背景与当前缺口

### 1.1 GBrain 现状

Knowledge 页面中 GBrain tab 当前仅显示：
- 总 pages / chunks 统计
- 按类型分布（wiki/skills/failure-lessons/raw）
- 周频次时间线（Recharts）

**没有**：
- 碎片知识之间的关联关系
- 跨 vault 文件的语义链接
- 失败经验的闭环利用

### 1.2 为什么是瓶颈

Hermes Pro 知识链路：

```
CodeGraph → GBrain → Horizon → Vault/Knowledge → Understand → BaiLongma/HCC
```

当前链路是**线性**的：每个节点单向输出给下一个节点。碎片知识 → 吸收 → 使用 → 变现 的闭环缺少"关系层"。typed links 补上这个缺口。

### 1.3 设计目标（MVP）

帮用户回答这个问题：

> "我最近关注了什么？这些关注点之间的关系是什么？"

MVP 只做一件事：**在 GBrain tab 新增 Links 子 tab，展示高可靠性规则推断的 typed links**。

---

## 2. MVP 产品目标

### 2.1 typed links（read-only）

- 用户能看知识碎片之间的关联
- 每条 link 可溯源（evidence）
- 4 种高可靠性 relation_type（见 4.2）
- 纯内存计算，不持久化

### 2.2 非目标（MVP）

| 非目标 | 原因 |
|--------|------|
| 不做 dream cycle | MVP 范围，等 typed links 稳定后再评估 |
| 不做 LLM 推理 | evidence 不可控，胡乱联想风险高 |
| 不做持久化 | MVP 纯内存计算 |
| 不做自动写入 Vault | MVP read-only |
| 不做自动 cron | MVP 用户手动刷新 |
| 不修改 locked roadmap | 设计文档归档于 docs/research/ |

---

## 3. Typed Links 数据模型（MVP）

### 3.1 字段设计

```typescript
interface TypedLink {
  // 唯一标识（内存中生成，非持久ID）
  id: string;

  // 链接的两端
  sourceId: string;    // 格式：vault://{file_path}
  targetId: string;

  // 关系类型（MVP 只有 4 种）
  relationType: "elaborates" | "supersedes" | "depends_on" | "repeats";

  // 推断置信度 [0, 1]
  confidence: number;

  // 推断证据片段（原文引用，必填）
  evidence: string;

  // 元信息
  createdAt: string;    // ISO 8601
  sourceKind: "vault_file" | "understand_result" | "horizon_summary" | "failure_lesson";
  targetKind: "vault_file" | "understand_result" | "horizon_summary" | "failure_lesson";
}
```

### 3.2 MVP relation_type（4 种）

| relation_type | 含义 | 推断规则 | 可靠性 |
|---------------|------|---------|--------|
| `elaborates` | A 细化/展开 B | 文件路径继承：`wiki/ai/xxx.md` → `wiki/ai/deepseek/xxx.md` | ✅ 高 |
| `supersedes` | A 是 B 的更新版本 | Horizon 摘要覆盖某 vault 文件 | ✅ 高 |
| `depends_on` | A 依赖 B 的结论 | 从 Understand 输出依赖链直接提取 | ✅ 高 |
| `repeats` | A 与 B 内容重复 | 向量相似度 > 0.85（使用已有 embedding，无新增依赖）| ⚠️ 中 |

**暂缓的 relation_type**（移入 Future Work）：`supports`、`contradicts`、`applies_to_project`、`applies_to_manga`、`blocked_by`、`learned_from_failure`、`related_to_trend`、`suggests_exploration`。

### 3.3 推断策略（MVP）

**不依赖 LLM 推理**，使用规则 + 向量相似度：

1. **文件路径继承**：同目录/子目录的 vault 文件 → `elaborates`
2. **Horizon → vault**：Horizon 摘要与某 vault 文件主题重合 → `supersedes`
3. **Understand 依赖链**：`depends_on` 直接从 Understand 输出提取
4. **向量相似度**：余弦相似度 > 0.85 → `repeats`（使用现有 embedding）

### 3.4 安全规则（MVP）

- **evidence 必填**：无原文引用不生成 link
- **confidence 阈值**：confidence < 0.7 的 link 默认折叠
- **只读**：用户可看 link 列表，不可修改

---

## 4. 与现有模块关系（MVP）

| 模块 | 与 typed links 的关系 |
|------|---------------------|
| **GBrain stats** | Links 子 tab 叠加在现有 stats 之上 |
| **Knowledge ingest** | 新 ingest 的文件参与 typed links 推断 |
| **Vault** | typed links 指向 vault://{path}；不修改 vault 内容 |
| **Understand** | Understand 结果参与 `depends_on` 推断 |
| **Horizon** | Horizon 摘要参与 `supersedes` 推断 |
| **HCC Cockpit** | Read-only 显示 typed links 状态 |

---

## 5. MVP UI 设计

### 5.1 GBrain Tab 新增 Links 子 Tab

```
GBrain tab
  ├── Stats（现有）
  ├── Links（新增）← typed links read-only
  └── Timeline（现有）
```

### 5.2 Links 子 Tab 内容

| 内容 | 说明 |
|------|------|
| Link 列表 | 按 relation_type 分组显示 |
| 每条 Link | source → relation → target + evidence + confidence |
| 阈值控制 | 可折叠 confidence < 0.7 的 link |
| 刷新按钮 | 用户手动刷新（不自动 cron） |
| 说明文字 | "以下链接由规则推断生成，confidence < 0.7 已折叠" |

### 5.3 不改动的范围

- 不改 Hermes Pro 主 IPC
- 不新增 preload handler
- 不新增 cron job
- 不写 Vault/Knowledge
- 不改 locked roadmap

---

## 6. MVP 验收标准

| ID | 标准 | 验证方式 |
|----|------|---------|
| AC-1 | 每条 typed link 有 evidence 片段（原文引用） | evidence 字段非空 |
| AC-2 | confidence < 0.7 的 link 默认折叠 | UI 显示阈值控制 |
| AC-3 | MVP 只含 4 种 relation_type | 代码/文档审查 |
| AC-4 | typed links 不修改 vault 文件内容 | links 指向 vault://，不写入 vault |
| AC-5 | 纯内存计算，不持久化 | 无 JSON/SQLite 写入 |

---

## 7. ADR 判断（MVP）

**MVP 不需要 ADR**。

理由：
- 纯 read-only（不改数据）
- 纯内存计算（不持久化）
- 不新增依赖
- 不改 schema

**Future Work 需要 ADR**（见第二部分）。

---

# 第二部分：Future Work

> 以下内容不在 MVP scope 内。等 MVP 稳定后，通过独立 ADR + 用户确认后才能进入实现。

## 8. dream cycle

### 8.1 目标

周期性离线处理：将碎片知识中的隐含模式"浮现"出来。

```
dream_cycle():
  1. 收集过去 N 天的知识增量
  2. 提取失败经验中的根因关键词
  3. 提取 Understand 结果中的 action items
  4. 与已有 typed links 聚合
  5. 生成关注点摘要（草稿，不自动上线）
  6. 输出：dream_summary.md（需用户 review）
```

### 8.2 dream cycle 输出

| 输出 | 用途 | 是否自动上线 |
|------|------|------------|
| `dream_summary.md` | 用户 review 后手动确认 | ❌ 草稿 |
| typed links 候选 | 用户 review 后可一键采纳或拒绝 | ❌ 候选 |
| 关注点时间线 | 显示 GBrain 中 | ✅ 只读 |
| 失败闭环报告 | 失败经验如何参与学习 | ✅ 只读 |

### 8.3 dream cycle 需要 ADR 的原因

| 问题 | 原因 |
|------|------|
| 输出路径 | 草稿存哪里？`~/.hermes/dream_drafts/` vs `vault/dream/` |
| 自动运行 | 是否挂靠 Horizon cron？用户手动触发？ |
| 与 Vault 关系 | 草稿确认后是否写入 Vault？ |
| relation_type 扩展 | `learned_from_failure`/`blocked_by` 需 failure-lessons 结构化解析 |

### 8.4 防胡乱联想规则（未来实现时必须满足）

1. **无 LLM 推理**：所有推断基于规则 + 向量相似度，有 evidence 才写 link
2. **evidence 必填**：每条 link 必须有原文引用，否则不可见
3. **用户 review 门**：dream_summary 草稿不上线，需用户确认后才进入 vault
4. **失败经验单独展示**：不混入常规 links，单独分区块

---

## 9. 扩展 relation_type（Future Work）

> 以下 9 种 relation_type 不在 MVP scope 内。

| relation_type | 含义 | 进入条件 |
|---------------|------|---------|
| `supports` | A 支持 B 的观点 | 需 LLM 或明确的观点引用规则 |
| `contradicts` | A 与 B 矛盾 | 需 LLM 或明确的矛盾引用规则 |
| `learned_from_failure` | A 是从 B 的失败中学到的 | 需 failure-lessons 结构化解析 + ADR |
| `applies_to_project` | A 适用于某项目 | 正则匹配项目名误报率高，暂缓 |
| `applies_to_manga` | A 适用于某漫画 | 同上 |
| `blocked_by` | A 被 B 阻塞 | 需 failure-lessons 结构化解析 |
| `related_to_trend` | A 与当前热点相关 | Horizon summary + 时序分析，胡乱联想风险最高 |
| `suggests_exploration` | A 建议探索方向 | K3 + 聚合，无明确 evidence 规则 |

---

## 10. 持久化方案（Future Work）

> 需要独立 ADR + 用户确认后才能实施。

### 10.1 方案选项

| 方案 | 说明 | 是否需要 ADR |
|------|------|------------|
| 不持久化 | 每次内存重算（MVP 方案）| ❌ 不需要 |
| JSON 文件 | `~/.hermes/typed-links.json` | ✅ 需要 |
| SQLite | 需 schema 变更 | ✅ 需要 |

### 10.2 持久化后影响

- 每次 Knowledge ingest 时增量更新 vs 每日重算
- 用户可删除/修改 link vs 纯只读
- 与 Vault/Knowledge 双向同步

---

## 11. 自动写入 Vault（Future Work）

> 需要独立 ADR + 用户确认后才能实施。

| 问题 | 方案选项 |
|------|---------|
| 写入权限 | A) 不允许，只读；B) 用户确认后写入 |
| 写入路径 | A) `vault/dream/`；B) `vault/links/` |
| 更新策略 | A) 用户手动确认后写入；B) 自动写入（需高置信度） |

---

## 12. 自动 cron 运行（Future Work）

> 需要独立 ADR + 用户确认后才能实施。

| 问题 | 方案选项 |
|------|---------|
| 运行频率 | A) 每日；B) 每周；C) 用户手动触发 |
| 挂靠位置 | A) 挂靠 Horizon cron；B) 独立 cron job；C) 用户手动触发 |
| 通知方式 | A) HCC Cockpit 状态更新；B) 消息通知；C) 无通知 |

---

## 13. Future Work ADR 最小范围

如果用户批准 MVP 后继续推进，需要以下 ADR：

### ADR-1：typed links 持久化方案

| 内容 | 方案选项 |
|------|---------|
| 存储层 | A) JSON 文件（`~/.hermes/typed-links.json`）；B) SQLite（需 schema 变更）；C) 不持久化 |
| 更新策略 | A) 每次 Knowledge ingest 时增量更新；B) 每日重算；C) 用户手动触发 |

### ADR-2：dream cycle 运行方案

| 内容 | 方案选项 |
|------|---------|
| 运行方式 | A) 用户手动触发；B) 挂靠 Horizon cron；C) 独立 cron |
| 输出路径 | A) `~/.hermes/dream_drafts/`；B) `vault/dream/`（需 Vault 写入） |
| 与 Vault 关系 | A) 草稿需用户确认后才写 Vault；B) 不写入 Vault |

### ADR-3：扩展 relation_type

| relation_type | 进入条件 |
|---------------|---------|
| `learned_from_failure` | failure-lessons 结构化解析规则确定后 |
| `repeats` 阈值调整 | MVP 稳定后根据实际误报率调整 |

---

## 14. 下一步流程

```
当前状态：设计草案（v0.2）
    ↓
用户 review 本文档（2-3 天内）
    ↓
若批准 → MVP 进入实现（不需要 ADR）
    ↓
MVP 实现 + 稳定后（1-2 周）
    ↓
若继续 → 启动 ADR-1（持久化）+ ADR-2（dream cycle）
    ↓
ADR 批准 → Future Work 进入实现（作为 V6 扩展，非主干）
    ↓
若不批准 → 本文档归档，不进入实现
```

---

## 15. 相关文档

| 文档 | 关系 |
|------|------|
| [docs/v6-knowledge-automation-plan.md](../v6-knowledge-automation-plan.md) | V6-1 在 V6 计划中标记为"需产品决策" |
| [docs/roadmap-locked-2026-05-28.md](../roadmap-locked-2026-05-28.md) | V6-1 暂缓，不修改此路线图 |
| [docs/adr/ADR-20260530-external-agent-capability-adoption.md](../adr/ADR-20260530-external-agent-capability-adoption.md) | 外部项目能力借鉴参考；ADR 仍为草案 |
| [docs/bailongma/README.md](../bailongma/README.md) | BaiLongma / HCC 与 typed links 的关系 |
| [src/renderer/src/screens/Knowledge/Knowledge.tsx](../../src/renderer/src/screens/Knowledge/Knowledge.tsx) | GBrain tab 现有实现 |

---

*本文档是 V6-1 设计草案（v0.2），MVP 不修改锁定路线图，不需要 ADR。等用户确认后才可进入实现阶段。*