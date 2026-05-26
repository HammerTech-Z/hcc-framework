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
| 2 | AgentMonitor 增强 | 待启动 | **待启动（下一个）** | |
| 3 | MCP 管理 UI | 待启动 | 待启动 | |
| 4 | Memory 编辑器 | 待启动 | 待启动 | 需 schema 设计先行 |
| 5 | BaiLongma 落地 | 待启动 | 待启动 | 风险最高，放最后 |

## 记录历史

- 2026-05-26：初版创建，基于代码调查校准 V2.1 状态
