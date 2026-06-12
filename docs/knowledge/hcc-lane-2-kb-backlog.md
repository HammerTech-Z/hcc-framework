# HCC 车道二 — 知识库 Phase 4-5-8 延后注册

> 注册时间：2026-06-12
> 来源：Hermes Pro 知识库架构优化计划 Phase 0-3 已完成，Phase 4-5-8 因涉及 IPC/cron 配置变更，延后至 HCC 车道二执行
> 前置条件：HCC Phase B 车道一完成 + HCC-STABLE

---

## 任务清单

### B-7: Phase 4 — Obsidian 读桥

**目标**：agent 能从 Obsidian Vault 读取内容，跨库搜索返回双库结果。

**技术范围**：
- 新增 `src/shared/lib/vault-bridge.ts`（读写桥，Phase 4 仅实现读路径）
- 修改 `src/main/knowledge-ipc-handlers.ts` — 添加 Obsidian 读路径
- 新增 `tests/vault-bridge.test.ts`

**验收标准**：
- [ ] `listVaultFiles` IPC 可列出 Obsidian vault 文件
- [ ] `readVaultFile` IPC 可读取 Obsidian vault 内容
- [ ] `knowledgeSearch` 扩展支持 `includeObsidian` 参数
- [ ] 零写入 Obsidian vault
- [ ] typecheck + vitest PASS

**风险**：修改 IPC handlers，与 Knowledge IPC Migration 有交集 — 需确认 Migration Slice closeout 已稳定（`600a7fb`）后再动。

---

### B-8: Phase 5 — Cron 消费闭环

**目标**：cron-C 增加"从 cron-B 提取可操作条目"步骤，解决只写不读。

**技术范围**：
- 修改 `~/.hermes/cron/` 中 cron-C job 的 prompt，增加 cron-B 消费步骤
- 提取结果写入 `concepts/` 和 `learning-direction.md`
- 新增"知识飞轮健康度"指标：ingested → refined → synthesized → used

**验收标准**：
- [ ] cron-C 运行时读取最新 cron-B 文件
- [ ] 提取的可操作条目写入 `concepts/` 目录
- [ ] `learning-direction.md` 反映最新 cron-B 分析
- [ ] 零新增 cron job（复用现有 schedule）
- [ ] cron 配置变更需 ADR + 用户确认

**风险**：修改 cron prompt，可能影响现有调度 — 需先在 dry-run 模式验证。

---

### B-9: Phase 8 — Obsidian 写桥

**目标**：双向同步。agent 写入 Hermes Vault → 传播到 Obsidian Vault；人工 Obsidian 修改 → 检测到变更。

**技术范围**：
- 扩展 `vault-bridge.ts` 添加写路径（draft → review → approve → write）
- 冲突检测：双库同文件变更时标记为人工解决
- 新增 `tests/vault-bridge-write.test.ts`
- 新增 `docs/adr/ADR-obsidian-bridge-write.md`

**验收标准**：
- [ ] agent 写入 Hermes Vault → Obsidian 可见变更
- [ ] Obsidian 人工编辑 → Hermes agent 可检测
- [ ] 冲突检测正确标记
- [ ] 零数据丢失
- [ ] typecheck + vitest PASS

**风险**：写路径需要完整审批链（draft → review → approve → write），与现有 Knowledge Chain L5 dry-run 边界一致。

---

## 执行顺序

```
车道一完成 → HCC-STABLE → 车道二开放
  → B-7 (Obsidian 读桥)
  → B-8 (Cron 消费闭环) [可与 B-7 并行]
  → B-9 (Obsidian 写桥) [依赖 B-7]
```

## 已完成的 Phase（不入 HCC）

| Phase | 说明 | 状态 |
|-------|------|------|
| 0 | 双库审计 | ✅ 已完成 |
| 1 | wikilink-resolver | ✅ 已完成 |
| 2 | staleness-scorer + contradiction-probe | ✅ 已完成 |
| 3 | ADR vault 重组 | ✅ 已完成 |
| 6 | decomposition-engine | ✅ 已完成 |
| 7 | synthesis-engine | ✅ 已完成 |

---

*关联：`docs/adr/ADR-20260612-vault-reorganization.md`, `docs/knowledge/vault-health-report-2026-06-12.md`, `docs/governance/hcc-go-authorization-2026-06-11.md`*
