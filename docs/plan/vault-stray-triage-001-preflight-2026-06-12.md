# VAULT-STRAY-TRIAGE-001 Preflight — Stray 文件归属审计 — 2026-06-12

> 主仓 19 个 vault/ADR/KB untracked stray 的归属预检。
> **不删除、不修改、不提交任何 stray**；不改代码。
> 背景：HCC-STABLE 已签收达标并落库（`b2db6a2`）；车道二可进入逐任务 preflight，但 stray 污染 typecheck，需先做归属审计。

## 1. 19 Stray 文件清单

| # | 文件 | mtime（之前批次核对） | 大小 | 类别 |
|---|------|---------------------|------|------|
| 1 | `docs/adr/ADR-20260612-vault-reorganization.md` | 19:3x | — | ADR doc |
| 2 | `docs/knowledge/hcc-lane-2-kb-backlog.md` | — | — | KB doc |
| 3 | `docs/knowledge/vault-health-report-2026-06-12.md` | 19:52 | — | KB doc |
| 4 | `docs/knowledge/vault-health-report-template.md` | — | — | KB doc |
| 5 | `src/shared/lib/contradiction-probe.ts` | — | — | TS module |
| 6 | `src/shared/lib/decomposition-engine.ts` | — | — | TS module |
| 7 | `src/shared/lib/staleness-scorer.ts` | — | — | TS module |
| 8 | `src/shared/lib/synthesis-engine.ts` | — | — | TS module |
| 9 | `src/shared/lib/vault-auditor.ts` | 19:36 | 16213 B | TS module |
| 10 | `src/shared/lib/vault-bridge-auditor.ts` | 19:37 | 12673 B | TS module |
| 11 | `src/shared/lib/wikilink-resolver.ts` | — | 9986 B | TS module |
| 12 | `tests/contradiction-probe.test.ts` | — | — | test |
| 13 | `tests/decomposition-engine.test.ts` | — | — | test |
| 14 | `tests/staleness-scorer.test.ts` | — | — | test |
| 15 | `tests/synthesis-engine.test.ts` | — | — | test |
| 16 | `tests/vault-auditor.test.ts` | 19:35 | 15330 B | test |
| 17 | `tests/vault-bridge-auditor.test.ts` | 19:36 | 9986 B | test |
| 18 | `tests/vault-health-audit-real.test.ts` | 19:5x | — | test |
| 19 | `tests/wikilink-resolver.test.ts` | — | — | test |

## 2. 文件级归属推断

| # | 文件 | 推测任务归属 | 推测 |
|---|------|------------|------|
| 1 | `ADR-20260612-vault-reorganization.md` | 车道二 B-6 Mano-P ADR 预备 / vault reorganization task | ADR 命名匹配 B-6 plan 标记「放弃 ADR」+ license 审计；推测为 vault reorganization slice 的预备 ADR |
| 2 | `hcc-lane-2-kb-backlog.md` | 车道二 KB backlog 文档 | 命名直指 lane-2，可能为车道二 KB 内容的后备清单 |
| 3-4 | `vault-health-report-*.md` | vault 审计 / health 报告 | 与 vault-auditor / vault-bridge-auditor 配套的报告/模板 |
| 5-8 | `contradiction-probe.ts` / `decomposition-engine.ts` / `staleness-scorer.ts` / `synthesis-engine.ts` | vault 知识库 KB 引擎（推论） | 命名风格指向 KB 处理流水线（探测/分解/评分/合成）；推测为 KB vault 任务的核心模块 |
| 9-10 | `vault-auditor.ts` / `vault-bridge-auditor.ts` | vault 审计模块 | 名义直白；与 #18 test 配套 |
| 11 | `wikilink-resolver.ts` | KB 内部链接解析 | 与 KB 模块互补 |
| 12-19 | 8 個 test 文件 | 与對應 src/ 一一對應 | 標準 vitest pattern |
| 18 | `vault-health-audit-real.test.ts` | vault-health-report 配套实测 test | 與 #3 配套 |
| 19 | `wikilink-resolver.test.ts` | 與 wikilink-resolver.ts 配套 | 與 #11 配套 |

**整體推測**：19 個 stray 屬於 **2 個未提交任務**：
- **任務 A：vault 審計**（vault-auditor.ts、vault-bridge-auditor.ts、vault-health-report × 2、vault-auditor.test.ts、vault-bridge-auditor.test.ts、vault-health-audit-real.test.ts，共 7 個）
- **任務 B：KB 處理流水線**（contradiction-probe / decomposition-engine / staleness-scorer / synthesis-engine / wikilink-resolver + 對應 4 個 test + hcc-lane-2-kb-backlog + ADR-20260612-vault-reorganization，共 12 個）

但均不屬於 HCC-STABLE 6 條件證據範圍——不影響 HCC-STABLE 已達標事實。

## 3. typecheck fail 歸因

| Error 來源 | 位置 | TS 錯誤碼 | 計數 |
|----------|------|----------|------|
| `src/shared/lib/wikilink-resolver.ts` | line 6 | TS6133 | 3 |
| 描述 | `parseWikilinks`、`resolveWikilinks`、`WikilinkStatus` 3 個 import 未使用 |

**僅 1 個文件污染 typecheck**。其餘 18 個 stray typecheck PASS。`lock-verify.sh PASS=46`、`vitest 152 files / 4143 tests PASS` 證明 main repo 鎖與測試套件未受污染。

## 4. 處理選項

| 選項 | 描述 | 風險 | 推薦度 |
|------|------|------|--------|
| **A：獨立 vault feature batch 審核並修復** | 用戶逐一審核 #5-#19，補 typecheck 錯誤、補測試、新增 ADR + closeout，提交 | 低（destructive 為 0） | ⭐⭐⭐ 推薦 |
| **B：移動到隔離 worktree/臨時目錄** | `mkdir ~/hermes-vault-pending && mv` 19 個文件到該目錄，等用戶處理 | 中（mv 操作但非刪除） | ⭐⭐ 備選 |
| **C：用戶明確授權後刪除** | 假設用戶判斷 stray 為已廢棄，授權 `rm` | **高**（destructive、不可恢復） | ❌ 禁止——本 preflight 不授權 destructive |

**推薦方案**：
1. **短中期**：A（獨立 vault feature batch）—— 不 destructive；保留 stray 內容；用戶逐一審核歸屬後正規化進主倉或標記為 WIP/pending 隔離
2. **中長期**：若用戶判斷某些 stray 為已廢棄，可走 C 但需獨立 `GO C 刪除` 批次
3. **應急**：若用戶需立刻清空工作區，採 B 的變體（移動到 `~/hermes-vault-pending/` 而非刪除）

## 5. 推薦流程

```
# Step 1：建立隔離目錄（不影響主倉）
mkdir -p ~/hermes-vault-pending/

# Step 2（可選）：用戶確認歸屬後，mv stray 到隔離目錄
mv docs/adr/ADR-20260612-vault-reorganization.md ~/hermes-vault-pending/
mv docs/knowledge/hcc-lane-2-kb-backlog.md ~/hermes-vault-pending/
mv docs/knowledge/vault-health-report-2026-06-12.md ~/hermes-vault-pending/
mv docs/knowledge/vault-health-report-template.md ~/hermes-vault-pending/
mv src/shared/lib/contradiction-probe.ts ~/hermes-vault-pending/
# ... 共 19 個 mv 命令

# Step 3：驗證主倉 typecheck
npm run typecheck      # 預期 PASS（wikilink-resolver.ts 不在主倉）

# Step 4：用戶對 19 個 stray 逐一定歸屬：
# - 歸 A（vault feature batch）：提交 19 個文件 + 補 closeout
# - 歸 B（KB 流水線）：提交 13 個文件
# - 歸 C（廢棄）：用戶獨立 GO 刪除批次
```

**重要**：本 preflight **不執行**任何 mv 或 rm。所有操作均需用戶獨立 GO。

## 6. 不影響 HCC-STABLE 已達標事實

| 維度 | 狀態 |
|------|------|
| HCC-STABLE 6 條件證據 | ✅ 已落庫 `b2db6a2`（closeout + status sync） |
| G-2 structured artifacts | ✅ `a2982ca` |
| G-3 rollback drill | ✅ `712b73f` |
| 19 stray 與 HCC-STABLE 關係 | **無關**——stray 不屬於 HCC-STABLE 證據鏈 |
| HCC-STABLE 達標結論 | ✅ 不變 |

## 7. B-5/B-6 暫不執行

| 車道二任務 | 狀態 | 阻塞原因 |
|----------|------|---------|
| B-5 UI Slice 8 KnowledgeControl 視覺 | ⏸️ 暫停 preflight | 主倉 typecheck 被 stray 污染（wikilink-resolver TS6133）；正式 preflight 需先歸屬 stray |
| B-6 Mano-P ADR + license 審計 | ⏸️ 暫停 preflight | 可能與 #1 ADR-20260612-vault-reorganization.md 衝突；用戶需先決定該 ADR 歸屬 |

**stray 處理策略確定前，不進 B-5 / B-6 preflight**。

## 8. 紅線

| 禁項 | 來源 |
|------|------|
| 不刪除 stray | 用戶未授權 destructive |
| 不提交 stray | 本批僅 preflight |
| 不寫 `~/.hermes/**` | P0-1 LOCK.md + lock-verify |
| 不 push | Phase A 全鏈未 push |
| 不修改 `src/**` / `tests/**` / `docs/adr/**` / `docs/knowledge/**` / `CONTEXT.md` / `NEXT_STEP.md` / `package.json` / `package-lock.json` / `.claude/settings.json` | 本批僅 preflight |
| 不開放 apply path / Auto Executor / Live Ranking mutation / Live Flush auto-apply | 紅線守恆 |

## 9. 驗證

| Gate | Result |
|---|---|
| `git status --short -uall` | `.claude/settings.json` + 19 vault strays + 1 untracked preflight doc |
| `npm run typecheck` | ❌ FAIL（污染，預期；非本批 gate） |
| `lock-verify.sh` | PASS=46 |
| `git diff --check` | PASS |
| 1 個文件污染 typecheck | `src/shared/lib/wikilink-resolver.ts` |
| 其餘 18 個 stray typecheck | PASS |
| `commit` / `push` | ❌ 未執行 |

## 10. 下一步

1. 用戶審閱本 preflight + 裁決處理選項（A / B / C）
2. **若 A**：用戶逐一定歸屬後，新一輪 vault feature batch 提交
3. **若 B**：用戶授權 mv 操作，本批獨立執行隔離
4. **若 C**：用戶獨立 `GO 刪除` 批次
5. stray 處理後，重新進 B-5 / B-6 preflight

## 11. 修訂

- 2026-06-12 v1：VAULT-STRAY-TRIAGE-001 preflight — 19 個 stray 歸屬審計 + 處理選項 + 不影響 HCC-STABLE 已達標聲明。
