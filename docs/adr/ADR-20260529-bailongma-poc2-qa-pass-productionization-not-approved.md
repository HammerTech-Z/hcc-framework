# ADR-20260529: BaiLongma POC-2 QA PASS - Productionization NOT APPROVED

**日期**: 2026-05-29
**状态**: ✅ POC-2 完成 + Manual QA PASS | ❌ Productionization NOT APPROVED

---

## 摘要

BaiLongma POC-2 已通过 Manual QA（2026-05-29），但 Productionization 暂不批准。

---

## POC-2 结果

| 检查项 | 状态 |
|--------|------|
| IPC handler 注册 | ✅ 修复完成 |
| is-remote-only-mode 真实实现 | ✅ 已接 hermes.ts::isRemoteOnlyMode() |
| 只读 fallback handlers | ✅ get-gateway-state/check-gateway-health/list-vault-files/get-cron-job-history/get-events 返回空数据 |
| list-cron-jobs 真实实现 | ✅ |
| typecheck | ✅ PASS |
| build | ✅ PASS |
| dev mode | ✅ PASS |
| Manual QA | ✅ 8/8 PASS |

---

## Productionization 决策

**用户选择**: 3d - 暂不批准 Productionization

**理由**:
- BaiLongma 当前只允许 read-only 增强
- 完整功能 Productionization 需单独 HCC v2 闭环 + 用户确认

---

## 当前允许范围

| 类别 | 状态 |
|------|------|
| 只读增强方向（3a） | ✅ 允许继续 read-only POC/只读增强 |
| 写 IPC（create/remove/pause/resume/trigger）| ❌ 不批准 |
| Memory/Vault/Knowledge 写入 | ❌ 不批准 |
| WeChat/model/chat 调用 | ❌ 不批准 |
| 新增 write IPC | ❌ 不批准 |
| 完整功能 Productionization | ❌ 暂不批准 |

---

## 约束

- 每个 BaiLongma 任务需单独走 HCC v2 / QA 闭环确认
- Productionization 批准需单独 ADR + 用户确认

---

## 后续行动

| 优先级 | 任务 | 状态 |
|--------|------|------|
| ~~P0~~ | ~~BaiLongma Manual QA~~ | ✅ 已完成 |
| ~~P1~~ | ~~路线图锁定确认~~ | ✅ 已完成 |
| P2 | V6 知识自动化任务排序 | 🔄 进行中 |

---

*本 ADR 由 HCC v2 流程生成，run_id: HCC-20260529-155110-bailongma-poc2-manual-qa*