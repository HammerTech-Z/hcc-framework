# Local Harness Dirty Policy — Preflight — 2026-06-12

> `.claude/settings.json` 本地 harness config 的處理策略。不修改、不提交、不 push。

## 1. 当前事实

| 维度 | 状态 |
|------|------|
| HEAD | `0efb442` |
| origin/hermes-pro-main | `0efb442` |
| HEAD ≡ origin | ✅ 已 push |
| 唯一 dirty | `.claude/settings.json` (modified) |
| 文件类型 | Claude/Cozempic harness config（不属于 Hermes Pro 项目产物） |
| 修改内容 | Cozempic hook schema v10 → v12；7 个 `command` 值加 `export COZEMPIC_NO_AUTO_INIT=1` |
| 是否曾 commit 到 Hermes Pro 项目历史 | ❌ 否（24 batch 全部排除） |
| lock-verify | PASS=46 |
| 所有 src/tests/package clean | ✅ |

## 2. `.claude/settings.json` 属性

| 判断維度 | 結論 |
|---------|------|
| 是否 Hermes/HCC 项目代码 | ❌ 不是 |
| 是否 Hermes/HCC 项目文档 | ❌ 不是 |
| 是否 HCC-STABLE 证据链的一部分 | ❌ 不是 |
| 是否 plan §3 允许/禁止表涵盖 | ❌ 不在表内 |
| 实质归属 | **Cozempic 自身维护的钩子 schema 升级**，由 `cozempic guard --reload-self` 自动注入 |
| 危险性 | 低：纯 shell 命令前缀 + schema tag 变更；不改变钩子语义实质 |
| 是否影响 Hermes Pro 代码/测试/typecheck/lock | 不影响 |

## 3. 处理选项

| 选项 | 描述 | 风险 | 推荐度 |
|------|------|------|--------|
| **A 保留本地 dirty，继续排除** | 不 commit、不 restore；未来所有 batch 继续排除 | 无 | ⭐⭐⭐ 推荐 |
| **B 用户明确授权后 restore** | `git restore .claude/settings.json` 回滚到 v10 schema | **高**：destructive，可能破坏 Cozempic 当前 v12 钩子运行；回滚后 Cozempic guard 重复 spawn 风险 | ❌ 禁止（除非用户独立 GO destructive restore） |
| **C 独立 commit harness config** | 独立 batch 提交 | **高**：污染 Hermes Pro 项目历史；新 clone 开发者还愿后仍会被各自 Cozempic 安裝覆写 | ❌ 不推荐 |

## 4. 推荐：A — 保留本地 dirty

**理由**：

1. `.claude/settings.json` 不屬於 Hermes Pro 項目代碼或文檔——它是 Claude Code 個人/全局鉤子配置，由 Cozempic 自動維護，不應進入倉庫歷史。
2. 獨立提交無語義價值。commit `chore: bump cozempic hook schema v10 → v12` 對 Hermes Pro 項目無審計意義；其他開發者 clone 此倉後仍會由各自 Cozempic 安裝重新生成自身版本的 settings.json。
3. 24 batch 歷史已成功排除此文件，無需改動。
4. 恢復為 destructive。`git restore .claude/settings.json` 會把 Cozempic 當前在用的 v12 鉤子回滾到 v10，可能破壞當前 Cozempic 自身運行。

## 5. 风险

| 风险 | 评估 |
|------|------|
| restore 后 Cozempic guard 重複 spawn | 高——v12 的 `COZEMPIC_NO_AUTO_INIT=1` 环境变量隔离是 Cozempic 0.6+ 设计意图；回滚可能导致 guard 重复 spawn |
| commit 污染项目历史 | 高——Hermes Pro 项目历史是干净的（24 batch 全排除）；加入 harness config 是污染 |
| 不做任何动作 | 最低——保留当前 dirty 状态为已知、稳定、已解释的本地配置 |
| 未来 audit 误判 this dirty | 低——本文档即为可追踪的书面解释 |

## 6. Bellard-perspective

**Minimal action is no action.** `.claude/settings.json` 是 Cozempic 的内部 harness 表格。它在本地存在、本地修改、本地排除。不应该进入任何一个项目 commit。不应该被 `git restore` 破坏。不应该被 `git add` 提交。它是"恰好在该目录的文件"，不是"该项目的文件"。Bellard 原则：不改、不提交、不移除——让它作为本地配置文件安静存在。

审计结论：**No action。文件保留为本地 dirty；所有 future batch 继续排除。最小行为 = 零行为。**

## 7. Karpathy-perspective

**Dirty is known, stable, explained.** 这个配置文件的 dirty 情况已经在整个 2026-06-12 session 中被明确解释。每一次 preflight、每一次 commit、每一次 audit 都明确排除它。这不是"未知 dirty"——它是已知、稳定、可预见的本地配置。Karpathy 原则：`data drift` 不应进入仓库；这个文件是 drift，不是 data。

审计结论：**Documented exclusion。本文档作为排除记录。未来 audit 引用本文档即可跳过该文件。**

## 8. 后续规则

1. 所有今後 batch 繼續排除 `.claude/settings.json`
2. 如需全新 clone：新環境不會有這個 dirty（新環境由 Cozempic 重新生成）
3. 如需 restore：用户名 确 GO `git restore .claude/settings.json`——**谨慎**，可能破坏 Cozempic 当前 hook schema
4. 本文档不修改任何文件；本文档本身后续可独立 commit 为 docs batch

## 9. 修订

- 2026-06-12 v1：Local harness dirty policy preflight。
