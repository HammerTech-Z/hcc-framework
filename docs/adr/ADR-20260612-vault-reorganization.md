# ADR-20260612: Vault 索引重组

> 状态：提案 | 创建：2026-06-12

---

## 背景

Phase 0 审计发现：

1. **死目录**：concepts/ (2 文件)、patterns/ (1 文件)、design/ (1 文件)、creative/ (1 文件)、pitfalls/ (1 文件)、synthesis/ (0 文件) — 全部低于最低 3 文件门槛。
2. **关联断裂**：cron-B 文件中声明的 `[[关联]]` 链接大多不存在，concepts/ 仅 3 条实际条目。
3. **索引不同步**：index.md 声称的目录树与实际文件内容不匹配。
4. **无合成层**：虽有 12 个主题在两库中都有覆盖，但无跨主题合成页面。

## 提案：Funes 3 层模型适配

借鉴 [Funes](https://github.com/ulyssestenn/funes) 的 sources → concepts → topics 三层模型，将 Hermes Vault 重组为：

```
vault/wiki/
├── raw/           # 层1: 原始源材料（flywheel-*.md, horizon-*.md, cron-*.md）
├── concepts/      # 层2: 原子概念页，一概念一文件
├── synthesis/     # 层3: 跨概念合成页，一主题一文件
├── tools/         # 工具知识（维持现有）
├── codebase/      # 项目代码快照（维持现有）
├── decisions/     # ADR 决策记录（维持现有）
├── learning/      # 学习笔记（维持现有）
├── design/        # UI 设计基线（维持现有）
├── creative/      # AI 视频/编剧笔记（维持现有）
├── patterns/      # 最佳实践（激活）
├── pitfalls/      # 踩坑记录（激活）
├── index.md       # 标注层级的全局目录
└── log.md         # 追加式变更日志
```

### 三层定义

| 层 | 目录 | 写入源 | 示例 |
|---|------|--------|------|
| 1 - Sources | `raw/` | Horizon cron、人工笔记、cron-A 新闻 | `flywheel-20260612.md` |
| 2 - Concepts | `concepts/` | cron-B 提取、人工编写 | `delegate_task.md`, `mcp-protocol.md` |
| 3 - Synthesis | `synthesis/` | Phase 7 合成引擎、人工编写 | `agent-architecture-overview.md` |

### index.md 增强

每个条目增加层级标记：

```markdown
- [L1] raw/flywheel-20260612.md — 每日知识飞轮原始记录
- [L2] concepts/delegate_task.md — 委托任务模式概念页
- [L3] synthesis/agent-orchestration.md — Agent 编排跨主题合成
```

### 命名规范

- Concepts: `{概念名-kebab-case}.md`
- Synthesis: `{主题名-kebab-case}-overview.md` 或 `{主题名-kebab-case}-synthesis.md`

---

## 影响范围

- **index.md**：需重新生成，标注层级
- **死目录**：concepts/ 从 2 文件补到 ≥ 3；patterns/pitfalls/design/creative 各补到 ≥ 3
- **raw/ 目录**：将现有 `flywheel-*.md` 移入或建立符号链接
- **零代码变更**：纯文档/命名规范调整

## 替代方案

1. **不做任何改变**：维持现状，死目录继续死
2. **合并死目录**：将 patterns/pitfalls/design/creative 合并为一个 `misc/`
3. **全量重构**：按 Obsidian vault 的 `wiki/entities/ concepts/ sources/ queries/ comparisons/ synthesis/` 结构完全重建

**推荐**：本提案（Funes 3 层 + 激发现有目录），改动最小且有清晰升级路径。

## 审批要求

- [ ] 批准 3 层模型
- [ ] 批准新增 `vault/wiki/synthesis/` 目录
- [ ] 批准 index.md 层级标记格式
- [ ] 批准命名规范

## 执行条件

本 ADR 获批后，执行需用户显式确认以下写入操作：
1. 新建 `synthesis/` 目录
2. 重写 `index.md`
3. 为死目录补足最低 3 个文件（可为 stub，标注 `<!-- stub -->`）

## 不执行的影响

- concepts/ 持续关联断裂
- synthesis/ 缺失意味着跨主题合成无固定存放位置
- index.md 与实际内容持续不同步
- 知识库"只写不读"问题无法从结构层面缓解

---

*关联：`docs/knowledge/vault-health-report-2026-06-12.md`, `src/shared/lib/vault-auditor.ts`, Phase 7 synthesis-engine*
