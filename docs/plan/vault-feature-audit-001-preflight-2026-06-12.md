# VAULT-FEATURE-AUDIT-001 Preflight — Stray Feature Batch 审核 — 2026-06-12

> 19 个 vault/ADR/KB stray 正式 feature batch 审核预检。**不删除、不移动、不提交任何 stray**；不改代码。
> 上一批：VAULT-STRAY-TRIAGE-001（落库 `0f3060e`，user pick = A 独立 batch 审核）。
> 背景：HCC-STABLE 已签收达标并落库（`b2db6a2`）；stray 污染 `npm run typecheck`（1 文件 3 errors）。

## 1. 19 Stray 正式归属表

| # | 文件 | 归属组 | 角色 |
|---|------|--------|------|
| 1 | `src/shared/lib/vault-auditor.ts` | A1 | vault 健康审计模块 |
| 2 | `src/shared/lib/vault-bridge-auditor.ts` | A1 | vault bridge 审计模块 |
| 3 | `docs/knowledge/vault-health-report-2026-06-12.md` | A1 | vault 审计报告样本 |
| 4 | `docs/knowledge/vault-health-report-template.md` | A1 | vault 审计报告模板 |
| 5 | `tests/vault-auditor.test.ts` | A1 | vault-auditor 单元测试 |
| 6 | `tests/vault-bridge-auditor.test.ts` | A1 | vault-bridge-auditor 单元测试 |
| 7 | `tests/vault-health-audit-real.test.ts` | A1 | vault-health 真实数据 audit 测试 |
| 8 | `src/shared/lib/contradiction-probe.ts` | A2 | KB 流水线——矛盾探测 |
| 9 | `src/shared/lib/decomposition-engine.ts` | A2 | KB 流水线——分解引擎 |
| 10 | `src/shared/lib/staleness-scorer.ts` | A2 | KB 流水线——陈旧度评分 |
| 11 | `src/shared/lib/synthesis-engine.ts` | A2 | KB 流水线——合成引擎 |
| 12 | `src/shared/lib/wikilink-resolver.ts` | A2 | KB 流水线——内部链接解析 |
| 13 | `tests/contradiction-probe.test.ts` | A2 | contradiction-probe 单元测试 |
| 14 | `tests/decomposition-engine.test.ts` | A2 | decomposition-engine 单元测试 |
| 15 | `tests/staleness-scorer.test.ts` | A2 | staleness-scorer 单元测试 |
| 16 | `tests/synthesis-engine.test.ts` | A2 | synthesis-engine 单元测试 |
| 17 | `tests/wikilink-resolver.test.ts` | A2 | wikilink-resolver 单元测试 |
| 18 | `docs/knowledge/hcc-lane-2-kb-backlog.md` | A3 | KB 车道二 backlog |
| 19 | `docs/adr/ADR-20260612-vault-reorganization.md` | A3 | vault reorganization ADR |

**组归属计数**：A1 = 7、A2 = 10、A3 = 2；总和 = 19 ✓

## 2. 建议分组

### A1: vault audit（docs + modules + tests）

7 文件。包含 vault 健康审计核心模块（`vault-auditor` / `vault-bridge-auditor`）+ 报告样本/模板 + 3 个单元测试。

**预期 commit message**: `feat(vault): add vault audit module + report template`

### A2: KB pipeline（modules + tests）

10 文件。包含 5 个 KB 处理流水线模块 + 5 个对应单元测试。

**预期 commit message**: `feat(kb): add KB processing pipeline (5 modules + 5 tests)`

### A3: ADR / backlog docs

2 文件。vault reorganization ADR + 车道二 KB backlog。

**预期 commit message**: `docs(adr): add vault reorganization ADR and lane-2 KB backlog`

## 3. typecheck Fail 修复计划

### 3.1 根因

| 文件 | 行 | 错误码 | 描述 |
|------|----|--------|------|
| `src/shared/lib/wikilink-resolver.ts` | 6 | TS6133 × 3 | `parseWikilinks` / `resolveWikilinks` / `WikilinkStatus` import 未使用 |

**仅 1 个文件 3 errors**。其余 18 个 stray typecheck PASS（无 errors）。

### 3.2 修复方案

**最小修复**：在 `src/shared/lib/wikilink-resolver.ts` 内部加调用方，激活被 import 但未用的 3 个符号。

- **不要**删除 import（会让 A2 测试 `tests/wikilink-resolver.test.ts` 失败——测试可能依赖这 3 个符号的 API）
- **不要**重写为 placeholder（`as any` 之类）
- **不要**改 test 文件绕过

**预期最小改动**：
1. 在 `wikilink-resolver.ts` 添加一个 `resolveAllWikilinks(input: string): WikilinkStatus[]` 函数（exported），内部调用 3 个 import 的符号
2. 在 A2 commit 范围内，确保 `tests/wikilink-resolver.test.ts` 已有该函数的测试覆盖；若无，新增 1 个测试

**禁止**：
- 不做无关重构
- 不动其他 stray 文件
- 不改 A1 / A3 任何文件

### 3.3 修复影响

- A2 commit typecheck PASS（wikilink-resolver.ts 改后）
- A1 / A3 commit typecheck PASS（原本就 PASS）
- 完整 main repo typecheck PASS（stray 全收后）

## 4. 每组允许提交文件清单

### A1 commit (7 files)

```
src/shared/lib/vault-auditor.ts
src/shared/lib/vault-bridge-auditor.ts
docs/knowledge/vault-health-report-2026-06-12.md
docs/knowledge/vault-health-report-template.md
tests/vault-auditor.test.ts
tests/vault-bridge-auditor.test.ts
tests/vault-health-audit-real.test.ts
```

### A2 commit (10 files, +1 typecheck fix)

```
src/shared/lib/contradiction-probe.ts
src/shared/lib/decomposition-engine.ts
src/shared/lib/staleness-scorer.ts
src/shared/lib/synthesis-engine.ts
src/shared/lib/wikilink-resolver.ts            # 含 TS6133 修复
tests/contradiction-probe.test.ts
tests/decomposition-engine.test.ts
tests/staleness-scorer.test.ts
tests/synthesis-engine.test.ts
tests/wikilink-resolver.test.ts               # 验证修复后仍 PASS
```

### A3 commit (2 files)

```
docs/adr/ADR-20260612-vault-reorganization.md
docs/knowledge/hcc-lane-2-kb-backlog.md
```

## 5. 每组测试计划

### A1 测试计划

| 测试 | 期望 |
|------|------|
| `npx vitest run tests/vault-auditor.test.ts tests/vault-bridge-auditor.test.ts tests/vault-health-audit-real.test.ts` | All PASS |
| `npm run typecheck` | PASS |
| `bash ~/hermes-pro-work/scripts/lock-verify.sh` | PASS=46 |

### A2 测试计划

| 测试 | 期望 |
|------|------|
| `npx vitest run tests/contradiction-probe.test.ts tests/decomposition-engine.test.ts tests/staleness-scorer.test.ts tests/synthesis-engine.test.ts tests/wikilink-resolver.test.ts` | All PASS |
| 验证 wikilink-resolver.ts TS6133 已消 | console.error / grep 检查无 unused imports 警告 |
| `npm run typecheck` | **PASS**（修复後） |
| `bash ~/hermes-pro-work/scripts/lock-verify.sh` | PASS=46 |

### A3 测试计划

| 测试 | 期望 |
|------|------|
| A3 是 docs-only | 无需 vitest 验证 |
| `git diff --check` | clean |
| `bash ~/hermes-pro-work/scripts/lock-verify.sh` | PASS=46 |

### Post-3-commit 整体验证

| 测试 | 期望 |
|------|------|
| `npm run typecheck` (全项目) | **PASS**（所有 stray 修复後） |
| `npx vitest run --config vitest.config.ts` (全量) | All PASS |
| `git status --short -uall` | 僅 `.claude/settings.json` |
| `bash ~/hermes-pro-work/scripts/lock-verify.sh` | PASS=46 |

## 6. 预计 commit 拆分建议

**3 个独立 commit**（顺序提交）：

```
A2 → A1 → A3
```

| 顺序 | 原因 |
|------|------|
| **A2 先提交** | 修复 `src/shared/lib/wikilink-resolver.ts` TS6133，**恢复主仓 `npm run typecheck` gate**。后续 A1 / A3 commit 可在 clean typecheck baseline 上验证 |
| **A1 后提交** | vault 审计独立模块；A2 已修复 wikilink，主仓 typecheck 已 PASS；A1 提交后 typecheck 仍 PASS（vault-auditor 系列本身无 TS errors） |
| **A3 最后** | 文档类，无运行时依赖；typecheck 与 lock-verify 仍 PASS |

**每个 commit 必须独立可验证**（单组 typecheck + vitest PASS）。

## 7. 红线

| 禁项 | 來源 |
|------|------|
| 不刪除 stray | 用户未授权 destructive |
| 不移动 stray | 用户未授权 mv |
| 不写 `~/.hermes/**` | P0-1 LOCK.md + lock-verify |
| 不開放 apply path | B-4C runtime guard 白名單 |
| 不授權 Auto Executor 常驻 | plan A-5 §1.6 + HCC-GO §2.2 |
| 不開放 Live Ranking mutation | LOOP-007 凍結 |
| 不開放 Live Flush auto-apply | B-4C closeout §10 |
| 不 push | Phase A 全鏈未 push |
| 不改 `CONTEXT.md` / `NEXT_STEP.md` / `package.json` / `package-lock.json` / `.claude/settings.json` | 本批仅 vault feature batch + docs/plan |
| 不做无关重构 | Karpathy §2 + Karpathy §3 |

## 8. HCC-STABLE 已达標事實不受影響

| 維度 | 狀態 |
|------|------|
| HCC-STABLE 6 條件證據 | ✅ 落庫 `b2db6a2`（closeout + status sync） |
| G-2 structured artifacts | ✅ `a2982ca` |
| G-3 rollback drill | ✅ `712b73f` |
| 19 stray 與 HCC-STABLE 證據鏈關係 | **無關**——stray 不屬於 HCC-STABLE 證據範圍 |
| HCC-STABLE 達標結論 | ✅ 不變 |
| 本 vault feature batch 完成後 | HCC-STABLE 仍達標（不退步） |

## 9. B-5/B-6 等待 vault feature batch 收口

| 任務 | 狀態 | 阻塞原因 |
|------|------|---------|
| B-5 UI Slice 8 KnowledgeControl 視覺 | ⏸️ 暫停 preflight | 等 vault feature batch 收口（A1/A2/A3 commit 完）+ typecheck PASS |
| B-6 Mano-P ADR + license 審計 | ⏸️ 暫停 preflight | 等 vault feature batch 收口；可能與 #19 ADR-20260612-vault-reorganization 需先 reconcile |

**stray 處理策略確定後**：vault feature batch（A1+A2+A3 收口）→ B-5 preflight → B-6 preflight。

## 10. 驗證

| Gate | Result |
|---|---|
| `git status --short -uall` | `.claude/settings.json` + 19 vault strays + 1 untracked preflight doc |
| `npm run typecheck` | ❌ FAIL（污染，預期；非本批 gate） |
| `lock-verify.sh` | PASS=46 |
| `git diff --check` | PASS |
| `commit` / `push` | ❌ 未執行 |
| 不刪除 / 不移動 / 不提交 stray | ✅ |

## 11. 下一步

1. 用戶審閱本 preflight + 裁決 A1/A2/A3 拆分（接受 / 調整）
2. 用戶 GO A2 commit → KB 5 模組 + 5 tests + wikilink-resolver TS6133 修復；恢復主倉 typecheck PASS
3. 用戶 GO A1 commit → vault-auditor / vault-bridge-auditor / 報告 / tests 收口（typecheck 仍 PASS）
4. 用戶 GO A3 commit → vault-reorganization ADR + lane-2 KB backlog
5. 3 commit 收口後，typecheck 全項目 PASS
6. 後續：B-5 preflight → B-6 preflight

## 12. 修訂

- 2026-06-12 v2：commit order 修正 + 测试计划同步。A2 → A1 → A3 顺序；A2 先修 wikilink-resolver TS6133 恢复 typecheck gate；A1 后续在 clean baseline 上提交。
- 2026-06-12 v1：VAULT-FEATURE-AUDIT-001 preflight — 19 stray 正式歸屬表 + 3 組拆分 + typecheck 修復計劃 + 紅線 + 不影響 HCC-STABLE 聲明。
