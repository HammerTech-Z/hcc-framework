# upstream-cherry-pick-results.md

## ADR-001: upstream 安全补丁处理实战记录

Date: 2026-05-27

## Context

需要评估 2026-05-27 前上游 fathah/hermes-desktop 的 19 个 commit，
判断 Hermes Pro 是否需要 cherry-pick。

## Decision

逐个 commit 评估，记录 cherry-pick 结果。

## Result

| # | Commit | Type | Cherry-pick | Reason |
|---|--------|------|-------------|--------|
| 1 | 0a5ee3a | chore | ❌ | v2 分支，Hermes Pro 基于 v3 |
| 2 | b88a3fa | feat | ❌ | v2 功能，Hermes Pro 无此模块 |
| 3 | 3a8c9d1 | feat | ❌ | v2 功能 |
| 4 | 57e2f40 | feat | ❌ | v2 功能 |
| 5 | 9f1b2c3 | fix | ❌ | v2 fix |
| 6 | 2429cd5 | security | ⚠️ PARTIAL | 需要 TD-SEC-001，apiKey 暴露风险 |
| 7 | d87e6a1 | feat | ❌ | v2 功能 |
| 8 | 8c4d5e2 | feat | ❌ | v2 功能 |
| 9 | 1f9a3b7 | feat | ❌ | v2 功能 |
| 10 | 5e3d8c1 | fix | ❌ | v2 fix |
| 11 | c12f4d8 | chore | ❌ | v2 配置 |
| 12 | 0d9e5f6 | feat | ❌ | v2 功能 |
| 13 | a71b3c9 | fix | ❌ | v2 fix |
| 14 | 2c8d1e4 | feat | ❌ | v2 功能 |
| 15 | 8f3a2b5 | chore | ❌ | v2 配置 |
| 16 | e94c7d3 | feat | ❌ | v2 功能 |
| 17 | 5b9d8e1 | fix | ❌ | v2 fix |
| 18 | 3d7f1a9 | refactor | ❌ | v2 refactor |
| 19 | 6a2b4c8 | chore | ❌ | v2 配置 |

## Summary

- Total: 19 commits
- Cherry-pick success: 0/19 (0%)
- Partial (needs follow-up): 1/19 (TD-SEC-001)
- Not applicable: 19/19 (v2-specific)

## Conclusion

Hermes Pro 与上游版本差异过大，版本同步不现实。
安全补丁需逐案评估后手动实现。

Status: ACCEPTED
