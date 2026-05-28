# V2 各任务实际状态

> 创建日期：2026-05-26
> 用途：校准快照记录与代码事实的差异，指导后续迭代

---

## V2.1 Theme 选择器

| 项目 | 内容 |
|------|------|
| 快照描述 | "6 套主题已就绪，需 UI 选择器" |
| **实际状态** | ✅ **已有完整实现** |
| 实现内容 | 2 套主题（dark/light）+ system 跟随；ThemeProvider（React Context）；Settings 页面 3 按钮选择器；i18n 四语言（en/zh-CN/es/pt-BR）；localStorage 持久化 |
| 差异原因 | 快照中的"6 套"可能是早期规划目标，从未实现到代码。代码中只有 `[data-theme="dark"]` 和 `[data-theme="light"]` 两套 CSS 变量 |
| 结论 | V2.1 目标已达成，无需额外开发 |
| 未来扩展 | CSS 变量体系已就绪（38 变量/套），如需扩展更多主题，只需在 main.css 添加 `[data-theme="xxx"]` 块，并在 THEME_OPTIONS 中注册 |

### 已知问题（非 V2 范围）

⚠️ **持久化使用 localStorage**，而非 `electron-store` 或 `~/.hermes/config.json`。隐患：用户清除浏览器数据或 `webPreferences` 变更时设置丢失。建议 V3+ 迁移到 electron-store 或通过 IPC 写入 `~/.hermes/config.json`。

---

## V2 迭代计划校准

| 优先级 | 任务 | 原状态 | 校准后状态 | 说明 |
|--------|------|--------|-----------|------|
| 1 | Theme 选择器 | 待开发 | ✅ 已有完整实现 | 仅需记录，无需开发 |
| 2 | AgentMonitor 增强 | 待启动 | ✅ 3 commits: CSS 类化 + i18n 四语言 + 实时执行面板 | |
| 3 | MCP 管理 UI | 待启动 | ✅ 5 commits: IPC 四通道 + i18n + Settings section + CRUD + 测试连接 | |
| 4 | Memory 编辑器 | 待启动 | ✅ 已有完整实现（CRUD + i18n + 容量指示 + 7 provider 集成） | |
| 5 | BaiLongma 落地 | 待启动 | ⏸️ 移出 V2，待设计定义后重新排期 | 2026-05-26 审计时代码中零实现；2026-05-28 已从 V2 移出并在 V4 完成设计闭环和 POC-2 |

### 2026-05-28 追加注释（重基线后）

**历史判断（2026-05-26）**：审计时 BaiLongma 在代码中零实现。
**当前状态（2026-05-28）**：BaiLongma 已从 V2 移出并在 V4 完成设计闭环和 POC-2。Layer 1-3 + POC-1 + POC-2 已实现，typecheck 通过，Manual QA 待执行。

---

## V2.4 Memory 编辑器

| 项目 | 内容 |
|------|------|
| 快照描述 | "Agent/User 内存可视化编辑" |
| **实际状态** | ✅ **已有完整实现** |
| 实现内容 | 后端 `src/main/memory.ts`（207行），5 个 IPC 通道（读/增/改/删/写 profile）；UI `Memory.tsx`（612行），三标签页（Agent Memory / User Profile / Providers）；内联 textarea 编辑 + 新增 + 删除确认 + 保存；容量指示条双条（2000+1375 字符上限）；统计数据（会话数/消息数/条目数）；7 个第三方 Memory Provider 集成（honcho/hindsight/mem0/retaindb/supermemory/byterover/holographic）；i18n 四语言完整覆盖 |
| 差异原因 | 快照描述与实现基本一致，无需额外开发 |
| 结论 | V2.4 目标已达成，无需额外开发 |

### 未来增强（非 V2 范围）

- **搜索/筛选**：当前 15 条条目，需求不急迫
- **自定义排序**：目前按 index 顺序
- **批量操作**：多选删除/移动
- **版本历史**：建议放 V3 知识赋能阶段
- **Understand → Memory 自动写入**：vault 与 memory 打通

---

### 已知问题（非 V2 范围）

⚠️ **存储使用纯文本文件 `MEMORY.md`**，无结构化字段、无索引、无版本。`§` 分隔在内容包含 § 时会出错。建议 V3+ 迁移到 SQLite（已有 `state.db` 可用）。

---

## V2.5 BaiLongma 落地

| 项目 | 内容 |
|------|------|
| 快照描述 | "智能面板 + ACUI 协议" |
| **实际状态** | ⏸️ **移出 V2，待设计定义后重新排期** |
| 差异原因 | HANDOFF.md 声称的 4 项前置工作（6 套主题 CSS、ThemeProvider 扩展、6 个按钮选择器、构建通过）与代码事实不符：实际只有 2 套主题（dark/light）+ 3 个按钮（system/light/dark）。BaiLongma 本身和 ACUI 协议在代码中零实现。 |

### 调查结论（2026-05-26）

- **代码中零实现**：`src/` 中 0 文件匹配，`git log` 中 0 次提交
- **HANDOFF.md 声称的 4 项前置工作与代码事实不符**：实际只有 2 套主题 + 3 个按钮
- **ACUI 协议**：无定义、无规范、无接口、无文档
- **玻璃拟态面板**：无任何代码或 CSS（`backdrop-filter` 在项目中不存在）

### 决策：移出 V2

BaiLongma 需要先完成以下设计文档后再排期：
1. **BaiLongma 范围定义文档**（它到底是什么、解决什么问题、用户场景）
2. **ACUI 协议规范**（全称、消息格式、通信方式、与现有 IPC 的关系）
3. **视觉设计稿**（玻璃拟态风格的具体视觉方案）
4. **集成方案**（与 Chat / Monitor / Playbooks 的关系）

建议排期：V3 或 V4，取决于设计定义的完成时间。

---

## 记录历史

- 2026-05-26：初版创建，基于代码调查校准 V2.1 状态
- 2026-05-26：标记 V2.2 AgentMonitor 增强完成
- 2026-05-26：标记 V2.3 MCP 管理 UI 完成
- 2026-05-26：基于代码调查标记 V2.4 Memory 编辑器为已有完整实现
- 2026-05-26：调查后标记 V2.5 BaiLongma 移出 V2，待设计定义后重新排期
- 2026-05-28：追加注释，BaiLongma 已在 V4 完成设计闭环和 POC-2，只读验证尚未通过 Manual QA
