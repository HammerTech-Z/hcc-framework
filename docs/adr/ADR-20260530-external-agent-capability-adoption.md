# ADR-20260530-external-agent-capability-adoption

> ADR：架构决策记录
> 编号：ADR-20260530-external-agent-capability-adoption
> 日期：2026-05-30
> 状态：草案（待用户确认）
> 规则：本文档是草案，批准后更新 locked roadmap；不批准则归档，不修改任何路线图

---

## 1. 背景

Hermes Pro 当前智能助手+智能知识库架构链路（CodeGraph→GBrain→Horizon→Vault/Knowledge→Understand→BaiLongma/HCC）已验证健康，但存在以下短板：

- **Memory 缺自动整理/压缩**：无 TokenJuice 式压缩层，无行为账本
- **HCC worker 化不足**：stage_5 executor 无角色分离，无 trajectory learning
- **Delivery/channel 权限边界不足**：IPC handler 无 sandbox/allowlist
- **Voice 入口缺失**：无 STT/TTS

同期审计了 6 个外部 GitHub 项目（Ruflo、OpenHuman、MiroFish、OpenClaw、Dograh、Mano-P）的架构，筛选出可借鉴能力。

---

## 2. 决策问题

Q1：是否借鉴 OpenClaw sandbox/allowlist 安全模型设计 Hermes IPC 权限边界？
Q2：是否借鉴 OpenHuman TokenJuice + Memory Tree 架构设计 Hermes Memory 压缩层和层级摘要？
Q3：是否借鉴 Ruflo worker taxonomy + trajectory learning 设计 HCC stage_5 executor 角色分离和行为账本？
Q4：是否将 Dograh STT/TTS 可插拔设计列入 V5 语音入口候选池？
Q5：是否将 Mano-P visual E2E testing 接口列入 UI 自动化测试备选方案？

---

## 3. 备选方案

### A：全部批准（激进路线）

**方案**：ADR 批准后，将上述 5 项全部纳入对应版本（V6/V7/V5）路线图。

**优点**：快速补强短板，架构一致性高。
**缺点**：一次引入 5 项，变更范围大，可能影响当前 V4 BaiLongma POC-2 收尾节奏。

### B：只批准 Architecture 借鉴，不修改路线图（保守路线）

**方案**：Hermes 可以"架构借鉴"外部项目的设计思路，在本地实现类似功能，但不做正式路线图纳入。

**优点**：灵活、低风险、不锁定 roadmap。
**缺点**：无正式路线图承诺，可能下次又被当成新发现。

### C：全部暂缓，候选池归档（最保守）

**方案**：所有外部项目能力只归档到 `docs/research/external-agent-capability-map-2026-05-30.md`，不进入路线图。

**优点**：零变更风险，专注当前主线。
**缺点**：短板持续存在。

### D：选择性批准（推荐）

**方案**：
1. ✅ 批准 OpenClaw sandbox/allowlist → V6-7 权限边界设计（ADR 候选）
2. ✅ 批准 OpenHuman TokenJuice + Memory Tree 架构 → 本地实现，不修改路线图
3. ✅ 批准 Ruflo worker taxonomy → V6-5 HCC mainline 设计（ADR 候选）
4. ⏸️ Dograh STT/TTS → V5 语音需求激活后评估（候选池）
5. ⏸️ Mano-P visual E2E → 等硬件升级（候选池）

**优点**：优先级清晰，变更范围可控。
**缺点**：需两次 ADR 审批。

---

## 4. 建议选择方案 D（选择性批准）

理由：
1. OpenClaw 和 Ruflo 涉及架构设计变更，需要 ADR + 用户确认后才能修改 locked roadmap
2. OpenHuman 架构可本地实现，不改路线图
3. Dograh 和 Mano-P 依赖外部条件（V5 语音需求、硬件升级），不适合现在强行推进

---

## 5. 影响评估

### OpenClaw sandbox/allowlist → V6-7

| 影响项 | 说明 |
|--------|------|
| V6/V7 路线图 | 需要修改 V6-7 或新增 V6-7 权限边界任务 |
| Hermes 架构 | IPC handler 增加权限检查，影响所有 handler |
| 迁移成本 | 中等，需要新增权限配置层 |
| 风险 | 权限边界设计复杂度高，需明确 scope |

### OpenHuman TokenJuice + Memory Tree → 本地实现

| 影响项 | 说明 |
|--------|------|
| 路线图 | 不修改，只做架构借鉴 |
| Hermes 内存设计 | 新增压缩层 + 层级摘要 |
| 迁移成本 | 低，可在 Memory 模块内迭代 |
| 风险 | 低，架构借鉴不涉及代码复制 |

### Ruflo worker taxonomy → V6-5 HCC mainline

| 影响项 | 说明 |
|--------|------|
| V6 路线图 | 需要修改 V6-5 HCC 流程入主线任务 |
| HCC 阶段定义 | stage_5 新增 executor/reviewer contract |
| 迁移成本 | 中等，需修改 PlaybookRunner |
| 风险 | 中，角色分离可能增加 HCC 复杂度 |

---

## 6. 不采纳项及理由

| 项目 | 不采纳理由 |
|------|----------|
| MiroFish simulation + report generation | 架构差距大，与 Hermes 当前阶段不匹配 |
| OpenHuman 代码复制 | GPL/专属许可证风险，架构借鉴足够 |
| Dograh STT/TTS 现在实施 | V5 暂缓，语音需求非 P0 |
| Mano-P 现在实施 | 硬件不满足（16GB < 32GB）|

---

## 7. 下一步

1. **用户选择方案**（A/B/C/D）
2. 批准后更新 `docs/roadmap-locked-2026-05-28.md` 对应任务
3. 未批准则归档本文档，不修改任何路线图

---

*ADR 草案 — 需要用户确认后才能生效。*