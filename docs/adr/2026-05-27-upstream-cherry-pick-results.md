# ADR: Upstream Cherry-Pick Results (2026-05-27)

## Status
Accepted

## Context
- 上游 fathah/hermes-desktop 在 2026-05 从 0.3.6 跳到 0.5.1
- 319 commits 的产品级重构(删除 playbook-runner、新增 kanban/model-discovery/ssh-remote/hermes-auth)
- 上游和 Hermes Pro 的产品方向已不同

## Decision
采用 cherry-pick 路线,只吸收安全补丁和通用修复,放弃完整 merge。

## Results
- 候选 19 个(6 security + 13 likely)
- 实际 pick:6 个(5 security + 1 likely)
- 跳过:13 个(冲突涉及 SSH tunnel / Chat 模块 / preload API / 平台特定逻辑)
- 成功率:31.6%
- Maybe 桶 51 个未执行(基于 Likely 桶低成功率推断)

## Consequences
### Positive
- 获得 5 个核心安全补丁(navigation harden / askpass / IPC validation / env validation / crypto)
- 新增 4 个安全基础设施文件
- 用代码证据确认 Hermes Pro 与上游已完全分家

### Negative
- TD-SEC-001:API key renderer 暴露需手动实现等效保护
- 物理 main 分支因 ACL 问题暂未转正(TD-FS-001)

### Strategic
- Hermes Pro 正式独立维护
- upstream remote 保留仅供安全公告监控
- 后续不做版本同步,安全补丁逐案评估
