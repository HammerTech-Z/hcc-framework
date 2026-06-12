# HCC-B5 UI Slice 8 KnowledgeControl — Preflight — 2026-06-12

> Phase B 车道二 逐任务 preflight。B-5：KnowledgeControl 视觉收尾（UI Slice 8）。
> 不实现代码。不启动 dev server。不开放任何执行红线。
> 上一批：VAULT-FEATURE-A3 (`63e1827`) + report refresh (`b7be1bc`)；typecheck 已恢复 PASS。

## 1. B-5 目标

对 `KnowledgeControl` 屏幕做视觉收尾，补齐 HCC-STABLE 车道二计划中的 UI Slice 8：

- 基于已有 preflight 文档 `docs/design/preflight/UI-KNOWLEDGE-001-redaction-cards.md` 中的设计规格
- 实现 secret 脱敏 + 卡片四要素（列标题 / 摘要 / 时间戳 / 来源）
- 视觉一致性：与 UI closeout batch（A/C/D/E/F/G/H groups）风格对標
- **不破坏 read-only boundary**（KnowledgeControl 为 inspect tab mapping 屏幕，不改 write path）

## 2. 当前 UI 基线与相关文件清单

### 2.1 核心屏幕文件

| 文件 | 位置 | 当前状态 | B-5 范围 |
|------|------|---------|---------|
| `KnowledgeControl.tsx` | `src/renderer/src/screens/KnowledgeControl/` | 7755 B；含 `readOnlyDisclaimer` 中文横幅 + BoundaryBadge | **允许修改** |
| `knowledge-control-model.ts` | `src/renderer/src/screens/KnowledgeControl/` | 7753 B；含 `buildKnowledgeControlItem` | **允许修改**（若视觉结构调整需额外 props） |
| `KnowledgeControl/components/*` | `src/renderer/src/screens/KnowledgeControl/components/` | 5 个组件（inspect tab 子组件） | **允许修改** |
| `main.css` | `src/renderer/src/assets/` | UI closeout style bundle（B-4C 已提交） | **允许追加**（卡片/脱敏/列标题样式） |
| `Knowledge.tsx` | `src/screens/Knowledge/` | 9008 B；含知识项展示 | **不修改**（read-only boundary：Knowledge.tsx 为 write-path 屏幕，B-5 范围外） |

### 2.2 相关 preflight 文档

| 文件 | 内容 |
|------|------|
| `docs/design/preflight/UI-KNOWLEDGE-001-redaction-cards.md` | B-5 设计规格源：secret 脱敏 + Card Layout（column labels, summary, timestamp, source） |
| `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` | UI 整体设计规范 |
| `docs/design/UI-GROUND-TRUTH-2026-06-04.md` | UI 落地态 ground truth |

### 2.3 相关测试文件

| 文件 | 内容 |
|------|------|
| `tests/knowledge-control-readonly.test.ts` | 9 tests：确保 KnowledgeControl 屏幕不经 IPC/runtime 读取外部执行或写 ~/.hermes |
| `tests/layout-boundary-badge.test.ts` | boundary-badge 逻辑测试（已提交 B-2 batch） |

### 2.4 KnowledgeControl 组件树

```
KnowledgeControl.tsx
├── readOnlyDisclaimer (中文横幅：本页仅展示知识库状态)
├── BoundaryBadge (read-only label)
├── components/KnowledgeControlTab.tsx (inspect tab wrapper)
└── // B-5 需新增的卡片视觉层
```

## 3. Implementation 另批允许修改的候选文件

| 文件 | 修改范围 | 行数估算 |
|------|---------|---------|
| `src/renderer/src/screens/KnowledgeControl/KnowledgeControl.tsx` | 加 readOnlyDisclaimer 中文横幅 inline / 加卡片列标签 + 排版 | +15 ~ +25 |
| `src/renderer/src/screens/KnowledgeControl/knowledge-control-model.ts` | 若需额外 props（摘要/时间戳/来源）→ 追加 interface 字段 | +5 ~ +10 |
| `src/renderer/src/screens/KnowledgeControl/components/*` | 卡片布局组件化（Card / CardRow） | +30 ~ +40 (若新增组件；否则 inline 在 KnowledgeControl.tsx) |
| `src/renderer/src/assets/main.css` | 卡片样式 + 列标题样式 + 脱敏标记样式（`--hp-card-*` / `--hp-redacted-*` CSS tokens） | +20 ~ +30 |
| `tests/knowledge-control-readonly.test.ts` | 追加 readOnlyDisclaimer 断言 + card layout 断言 | +10 ~ +15 |

**总计**：4-5 个文件 / +80 ~ +120 行。

**禁止修改**：`src/screens/Knowledge/Knowledge.tsx`（write-path）、`src/main/**`、`src/preload/**`、`package.json`、任何不在 B-5 范围内的文件。

## 4. 测试计划

### 4.1 Pre-implementation 基线

| 测试 | 期望 |
|------|------|
| `npm run typecheck` (node + web) | PASS |
| `npx vitest run tests/knowledge-control-readonly.test.ts` | 9/9 PASS |
| `npx vitest run tests/layout-boundary-badge.test.ts` | 22/22 PASS |
| `git diff --check` | clean |
| `bash ~/hermes-pro-work/scripts/lock-verify.sh` | PASS=46 |

### 4.2 Implementation 後验证

| 测试 | 期望 |
|------|------|
| `npm run typecheck` (node + web) | PASS |
| `npx vitest run tests/knowledge-control-readonly.test.ts` | **≥9 PASS**（所有现有测试仍 PASS；新增 readOnlyDisclaimer + card layout 断言） |
| `npx vitest run tests/layout-boundary-badge.test.ts` | 22/22 PASS |
| `git diff --check` | clean |
| `bash ~/hermes-pro-work/scripts/lock-verify.sh` | PASS=46 |

### 4.3 Post-implementation 全量基线

| 测试 | 期望 |
|------|------|
| `npx vitest run --config vitest.config.ts` | 所有现有测试仍 PASS（不降 baseline） |
| `npm run typecheck` (node + web) | PASS |

## 5. Playwright / Browser Verification Plan

| 验证项 | 方法 |
|------|------|
| KnowledgeControl 卡片布局是否正确 | `npm run dev` → `openwolf designqc --routes /knowledgeControl` → 读截屏 |
| Secret 脱敏是否生效 | 截屏验证：vault 内容中的 API key / secret 只显示占位符 |
| 列标签是否可見 | 截屏验证：每行卡片含摘要/时间戳/来源/类型 4 列 |

**注意**：Playwright 验证在 B-5 implementation 阶段执行，本 preflight 只计划。

## 6. 风险点

| 风险 | 缓解措施 |
|------|---------|
| 破坏 KnowledgeControl read-only boundary | `tests/knowledge-control-readonly.test.ts` 中有 9 个测试验证该边界，包括 transitive import check |
| 引入 knowledge write path | 不改 `Knowledge.tsx`（write path）；不改 `knowledgeIngest` handler |
| 风格不匹配现有 UI closeout | 使用 `main.css` 中已有的 `--hp-*` CSS tokens；参考 StatusBadge/ConfirmDialog 视觉风格 |
| renderer-only 改动引入 runtime 依赖 | 零新 IPC；不改 preload/main 通道 |
| 打开 Auto Executor / apply path | 不触发；B-5 纯视觉，renderer-only |

## 7. 红线

| 禁项 | 来源 |
|------|------|
| **写 `~/.hermes/**`** | P0-1 LOCK.md + lock-verify |
| **启用 Live Flush auto-apply** | B-4C closeout §10 |
| **开放 Live Ranking mutation** | LOOP-007 冻结 |
| **启动 Auto Executor 常驻** | plan A-5 §1.6 + HCC-GO §2.2 |
| **启动 apply path** | B-4C runtime guard 白名单 |
| **改 `Knowledge.tsx`（write path）** | 不改 |
| **改 `src/main/**` / `src/preload/**`** | 不改 |
| **改 `package.json` / `package-lock.json`** | 不改 |
| **改 `.claude/settings.json` / `CONTEXT.md` / `NEXT_STEP.md`** | 不改 |
| **`git push`** | Phase A 全链未 push |

## 8. HCC-STABLE 关系

- HCC-STABLE 已于 2026-06-12 用户签收达標（`b2db6a2`）。
- Phase B 车道二允许进入逐任务 preflight。
- **本 preflight 不等于 B-5 执行批准**。用户需独立 GO B-5 implementation。
- 每个后续任务仍需用户单独 GO。

## 9. 修订

- 2026-06-12 v1：HCC-B5 UI Slice 8 KnowledgeControl preflight。
