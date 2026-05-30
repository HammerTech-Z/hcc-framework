# ADR-20260530: HCC Cockpit Read-only POC — QA Pass

**日期**: 2026-05-30
**状态**: ✅ POC 完成 + QA Hardening Pass | ❌ Productionization NOT APPROVED

---

## 摘要

HCC Cockpit read-only POC 已完成并通过 QA hardening。Productionization 暂不批准。

---

## 文档范围

| 检查项 | 状态 |
|--------|------|
| UI 完成范围 | ✅ |
| 只读 API 调用 | ✅ |
| 执行按钮 disabled | ✅ |
| Mobile responsive | ✅ |
| typecheck | ✅ PASS |
| test | ✅ 19 files / 317 tests PASS |

---

## UI 完成范围

HCC Cockpit 实现了 BaiLongma 三栏驾驶舱布局：

| 面板 | 内容 |
|------|------|
| 左侧 — Focus Stack | 当前 Pipeline Run 选择器 + 统计卡片（runs/playbooks/failed）+ Recent Pipeline Runs 列表 |
| 中间 — Task Canvas | Task Header + Stage Rail（5阶段：发现→方案→修复→验证→交付）+ Conclusion + Readonly Execution Controls |
| 右侧 — Brain UI | Context（gateway/health/agents/cron历史）+ Artifacts + Blockers |
| 底部 — ACUI Event Log | ACUI Synthesis 事件 + Real Events 分组展示 |

### Stage Rail 阶段定义

| 英文 | 中文 |
|------|------|
| discovery / diagnose | 发现 |
| plan | 方案 |
| execute | 修复 |
| verify | 验证 |
| deliver | 交付 |

---

## 数据源范围

| API | 用途 | 读/写 |
|-----|------|--------|
| listPipelineRuns(30) | Pipeline Runs 列表 | 只读 |
| listPlaybooks() | Playbook 列表 | 只读 |
| getCronJobHistory(30) | Cron 历史 | 只读 |
| getEvents(40) | 事件时间线 | 只读 |
| getGatewayState() | Gateway 平台状态 | 只读 |
| checkGatewayHealth() | Gateway 健康检查 | 只读 |

---

## Read-only 边界证据

### 代码级证据

```typescript
// HccCockpit.tsx — 实际调用的 API
window.hermesAPI.listPipelineRuns(30)  // 只读
window.hermesAPI.listPlaybooks()        // 只读
window.hermesAPI.getCronJobHistory(30)  // 只读
window.hermesAPI.getEvents(40)           // 只读
window.hermesAPI.getGatewayState()       // 只读
window.hermesAPI.checkGatewayHealth()    // 只读
```

### 禁止调用的 API（零引用）

| API | 状态 |
|-----|------|
| runPlaybook | ✅ 未调用 |
| createCronJob | ✅ 未调用 |
| pauseCronJob | ✅ 未调用 |
| resumeCronJob | ✅ 未调用 |
| triggerCronJob | ✅ 未调用 |
| knowledgeIngest | ✅ 未调用 |
| addMemoryEntry | ✅ 未调用 |
| writeSoul | ✅ 未调用 |
| readVaultFile | ✅ 未调用 |
| sendMessage | ✅ 未调用 |

### 执行按钮

| 按钮 | 状态 |
|------|------|
| Run playbook | disabled |
| Auto fix | disabled |
| Deliver | disabled |

---

## QA 结果

### UI QA

| 检查项 | 状态 |
|--------|------|
| 三栏布局 | ✅ Focus Stack / Task Canvas / Brain UI |
| 底部 ACUI Event Log | ✅ 存在 |
| tone-dot 可见性 | ✅ 背景色正确显示 |
| Stage rail 移动端 | ✅ scroll-snap + label 隐藏 |
| runId 溢出处理 | ✅ word-break: break-word |
| conclusion 溢出 | ✅ overflow-wrap |
| artifact name 溢出 | ✅ text-overflow ellipsis |
| 响应式断点 | ✅ 1160px / 860px 两级 |
| 执行按钮 | ✅ 全部 disabled |

### Responsive Layout

| 断点 | 布局变化 |
|------|----------|
| > 1160px | 3栏 (230px + minmax + 280px) |
| 861–1160px | 2栏 (210px + flex) + Brain 全宽 |
| ≤ 860px | 1栏堆叠 + Stage label 隐藏 |

---

## 验证命令结果

### typecheck

```
npm run typecheck
> tsc --noEmit -p tsconfig.node.json --composite false  ✅ PASS
> tsc --noEmit -p tsconfig.web.json --composite false   ✅ PASS
```

### test

```
npm test
  Test Files  19 passed (19)
      Tests  317 passed (317)
```

---

## 未实现项

以下功能在 POC 中未实现，需要 Productionization 批准后单独实现：

| 功能 | 原因 |
|------|------|
| runPlaybook 执行 | 需 Productionization ADR + 用户批准 |
| Auto fix 自动修复 | 需 Productionization ADR + 用户批准 |
| Cron 写入（create/pause/resume/trigger） | 需 Productionization ADR + 用户批准 |
| Vault 写入 | 需 Productionization ADR + 用户批准 |
| Memory 写入 | 需 Productionization ADR + 用户批准 |
| Knowledge 写入 | 需 Productionization ADR + 用户批准 |
| WeChat 推送 | 需 Productionization ADR + 用户批准 |
| Model 执行 | 需 Productionization ADR + 用户批准 |
| 自动 cron 变更 | 需 Productionization ADR + 用户批准 |

---

## Productionization 路径

如果未来需要进入自动执行/写入版：

1. 新建 Productionization ADR
2. 用户明确批准
3. 单独实现写入 IPC
4. 单独实现 UI 执行控件
5. 单独 QA + Manual Testing

**当前只读版已满足 POC 目标，不强制要求 Productionization。**

---

## 相关文档

| 文档 | 用途 |
|------|------|
| [ADR-20260529-bailongma-poc2-qa-pass-productionization-not-approved.md](./ADR-20260529-bailongma-poc2-qa-pass-productionization-not-approved.md) | BaiLongma POC-2 QA 结果 |
| [docs/bailongma/README.md](../bailongma/README.md) | BaiLongma 设计索引 |
| [docs/bailongma/03-visual-and-integration.md](../bailongma/03-visual-and-integration.md) | BaiLongma 视觉与集成设计 |
| [docs/roadmap-locked-2026-05-28.md](../roadmap-locked-2026-05-28.md) | 锁定路线图 |

---

*本 ADR 记录 HCC Cockpit 只读 POC 状态，不修改锁定路线图。*
