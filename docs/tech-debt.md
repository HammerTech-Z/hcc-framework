# Tech Debt Inventory

Last Updated: 2026-05-28

## Format

| Field | Description |
|-------|-------------|
| ID | TD-{DOMAIN}-{NNN} |
| Title | Short description |
| Status | backlog / in-progress / monitoring / wontfix / done |
| Owner | Assignee |
| Estimate | T-shirt size (XS/S/M/L/XL) |
| Risk | Critical/High/Medium/Low |
| Dependency | Blocked by which TD |
| Priority | P1/P2/P3 |

---

## Active

### TD-SEC-001: API key renderer 暴露
- **Title**: API key 传递到 renderer，暴露于 renderer process
- **Status**: backlog
- **Owner**: unassigned
- **Estimate**: M
- **Risk**: High
- **Dependency**: None
- **Priority**: P1
- **Notes**: 上游 2429cd5 安全改进目标。实现：main process 做 key resolve，renderer 只拿 hasApiKey flag，SSH tunnel 通过 IPC 传 key。

### TD-FS-001: macOS ACL 阻塞 main 二进制转正
- **Title**: macOS 上 Electron app 无法通过 macOS notarization
- **Status**: backlog
- **Owner**: unassigned
- **Estimate**: XL
- **Risk**: High
- **Dependency**: None
- **Priority**: P2
- **Notes**: 根因未知，需先复现并定位是 ACL/签名/notarization 问题。

### TD-PERSIST-001: Theme 持久化 localStorage → electron-store
- **Title**: Theme 设置用 localStorage，需迁移到 electron-store
- **Status**: backlog
- **Owner**: unassigned
- **Estimate**: S
- **Risk**: Low
- **Dependency**: None
- **Priority**: P1
- **Notes**: Sprint 3 目标。electron-store 更安全，跨窗口一致。

### TD-PERSIST-002: Memory MEMORY.md → SQLite
- **Title**: 记忆系统从文件迁移到 SQLite
- **Status**: backlog
- **Owner**: unassigned
- **Estimate**: L
- **Risk**: Medium
- **Dependency**: None
- **Priority**: P2
- **Notes**: Sprint 3 准备 / Sprint 5 切换。SQLite 支持向量搜索（TEXT embedding），文件不支持。

### TD-OP-001: pipeline-runs 无自动清理
- **Title**: pipeline-runs 目录无限增长
- **Status**: backlog
- **Owner**: unassigned
- **Estimate**: XS
- **Risk**: Low
- **Dependency**: None
- **Priority**: P3
- **Notes**: 建议添加 max-age 或 max-count 清理策略。

### TD-OP-002: HCC 阶段 1-4 未在代码中定义
- **Title**: HCC 阶段定义缺失，hardcoded 值分散
- **Status**: backlog
- **Owner**: unassigned
- **Estimate**: S
- **Risk**: Medium
- **Dependency**: None
- **Priority**: P3
- **Notes**: 4 个阶段应在代码中统一定义，避免 magic number。

### TD-BUILD-001: better-sqlite3 native module rebuild
- **Title**: better-sqlite3 native module 在 Day 1 测试失败
- **Status**: done
- **Owner**: unassigned
- **Estimate**: XS
- **Risk**: Medium
- **Dependency**: None
- **Priority**: P3
- **Notes**: 已通过 electron-rebuild 或 native-ext-loader 解决。保留供后续调试参考。

### TD-MODEL-001: Gemma 4 E4B 未拉取 vs model-strategy
- **Title**: Gemma 4 E4B 未拉取 vs model-strategy 规划冲突
- **Status**: blocked
- **Owner**: unassigned
- **Estimate**: M
- **Risk**: High
- **Dependency**: None
- **Priority**: P2
- **Notes**: Sprint 2 需决策：E4B 本地模型策略 vs API-only。影响 model-strategy.md 方向。

---

## Monitoring (No Action Required)

### TD-OBS-001: WeChat 限流
- **Title**: WeChat 消息限流观察
- **Status**: monitoring
- **Owner**: unassigned
- **Estimate**: N/A
- **Risk**: Low
- **Dependency**: None
- **Priority**: P3
- **Notes**: 已有 backoff 机制。不需要额外行动，持续监控。

### TD-OBS-002: Mano-P 暂缓
- **Title**: Mano-P 任务暂缓
- **Status**: wontfix
- **Owner**: unassigned
- **Estimate**: N/A
- **Risk**: N/A
- **Dependency**: None
- **Priority**: P3
- **Notes**: 决定不做。硬件不满足要求（内存/存储）。

---

## Done

- TD-BUILD-001 (2026-05-28)
