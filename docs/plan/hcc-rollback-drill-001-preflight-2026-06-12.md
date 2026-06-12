# HCC-ROLLBACK-DRILL-001 Preflight — G-3 Rollback Drill

> HCC-ROLLBACK-DRILL-001 preflight。G-3 rollback drill 的審批文檔。**僅 preflight，不執行**。
> 不開放任何紅線項。

## 1. 目標

滿足 HCC-STABLE 條件 4：**至少 1 次回滾演練 PASS**（故意中止一個任務，worktree 回滾後基線測試全綠）。

HCC-STABLE 定義原文（plan v3.2 §0）：
> ③ 至少 1 次回滾演練 PASS（故意中止一個任務，worktree 回滾後基線測試全綠）

## 2. 獨立 worktree 方案

### 2.1 隔離目標路徑

| 項目 | 路徑 |
|---|---|
| Main 倉 | `~/hermes-pro`（**不碰**——所有現有文件均 uchg） |
| 獨立 worktree | `~/hermes-pro/.claude/worktrees/hcc-rollback-drill-001/` |
| 分支 | `hcc-rollback-drill-001-20260612` |
| 基點 | `a2982ca`（HEAD at preflight creation time） |

### 2.2 Worktree 創建

```bash
cd ~/hermes-pro
git worktree add .claude/worktrees/hcc-rollback-drill-001/ \
  -b hcc-rollback-drill-001-20260612 \
  a2982ca
```

**不觸碰 main 倉**。Worktree 內的操作不影響 `~/hermes-pro` 的鎖定文件。

## 3. 故意中止任務設計

### 3.1 任務設計（最小可回滾）

| 屬性 | 值 |
|---|---|
| 任務 ID | `HCC-ROLLBACK-DRILL-001` |
| 任務類型 | rollback drill（非真實功能變更） |
| 目標 | 在獨立 worktree 中故意寫入 1 個 fixture 文件 + 1 contract test，然後模擬中止並回滾 |
| 生產文件 | **不碰**任何 `src/main/**` / `src/renderer/**` / `src/screens/**` / `package.json` |

### 3.2 步驟

1. **Initialize**：進入 worktree，確認工作區 clean
2. **Write**：新增 1 個 fixture 文件（`tests/fixtures/learning-loop/ll020-rollback-drill.json`）+ 1 個 contract test（`tests/learning-loop/hcc-rollback-drill-001.test.ts`），各 ~30 行
3. **Verify**：運行 `npx vitest run tests/learning-loop/hcc-rollback-drill-001.test.ts` + `npm run typecheck` + `git diff --check` → 確認新增文件通過測試
4. **ABORT**：故意中斷任務（模擬不可恢復的失敗場景，如檢測到不合法 import）
5. **Rollback**：
   - `git restore --staged --worktree .`（丟棄 worktree 內所有未 commit 的變更，含暫存區與工作區）
   - `git clean -fd -- tests/fixtures/learning-loop/ll020-rollback-drill.json tests/learning-loop/hcc-rollback-drill-001.test.ts`（刪除 drill 期間新增的 untracked 文件）
   - `git status --short` → **必須為空**（確認 worktree 恢復 clean）
6. **Re-verify**：運行**全量** `npx vitest run --config vitest.config.ts` + `npm run typecheck` + `git diff --check` + `bash ~/hermes-pro-work/scripts/lock-verify.sh` → 基線測試全綠
7. **Report**：在 main 倉產出報告（`docs/closeout/hcc-rollback-drill-001-closeout-2026-06-12.md`）——**closeout report 不在 drill 本體中產生**；如要落庫，必須作為後續獨立 docs batch

### 3.3 不執行內容

| 禁項 | 理由 |
|---|---|
| 不 commit | rollback drill 為暫態，不寫入歷史 |
| 不 push | 永不 |
| 不改 main 倉任何文件 | worktree 隔離 |
| 不寫 `~/.hermes/**` | 紅線守恆 |
| 不啟動 runtime / dev server / HCC Auto Executor | 紅線守恆 |

## 4. Restore / Cleanup 流程

```bash
# 從 main 倉目錄執行：
cd ~/hermes-pro

# 1. 刪除 worktree：
git worktree remove .claude/worktrees/hcc-rollback-drill-001/ --force

# 2. 刪除分支（本地）：
git branch -D hcc-rollback-drill-001-20260612

# 3. 確認 main 倉仍 clean：
git status --short -uall
# 期望輸出：僅 `.claude/settings.json` 的 M

# 4. 驗證基線仍全綠：
npx vitest run --config vitest.config.ts
npm run typecheck
bash ~/hermes-pro-work/scripts/lock-verify.sh
```

## 5. 驗證命令（rollback drill 的 PASS 判據）

| 階段 | 命令 | 期望 |
|---|---|---|
| Pre-abort 驗證 | `npx vitest run tests/learning-loop/hcc-rollback-drill-001.test.ts --config vitest.config.ts` | PASS |
| Pre-abort 驗證 | `npm run typecheck` | node + web PASS |
| Pre-abort 驗證 | `git diff --check` | clean |
| Post-rollback 驗證 | `npx vitest run --config vitest.config.ts` | **全量基線測試全綠**（約 134+ tests） |
| Post-rollback 驗證 | `npm run typecheck` | node + web PASS |
| Post-rollback 驗證 | `git diff --check` | clean |
| Post-rollback 驗證 | `bash ~/hermes-pro-work/scripts/lock-verify.sh` | PASS=46 |
| Post-rollback 驗證 | `ls ~/.hermes/config.yaml ~/.hermes/SOUL.md` 等 mtime | **未變** |

**PASS 判據**：Post-rollback 驗證全部綠 = rollback drill PASS = G-3 1/1。

## 6. 不寫 ~/.hermes 的證明方式

- **Pre-drill baseline**：記錄 `~/.hermes/config.yaml` / `SOUL.md` / `handoff/packs` / `audit` 的 mtime
- **Drill 執行後**：比對 mtime → 全部未變
- **證明**：B-3 closeout §7 格式的 mtime 實測表（epoch + human-readable）
- **鎖保證**：lock-verify.sh PASS=46 證明 main 倉受保護文件未被觸碰

## 7. 紅線表（asserted by preflight + plan）

| 紅線 | 狀態 | 來源 |
|---|---|---|
| **apply path** | ❌ 未開放 | B-4C runtime guard 白名單只接受 `pending_user_approval` |
| **Auto Executor 常駐** | ❌ 未授權 | plan A-5 §1.6 + HCC-GO §2.2 |
| **Phase B 車道二** | ❌ 未開放 | plan v3.2 + HCC-GO §2.2；**本 drill 完成不自動開放** |
| **Live Ranking mutation** | ❌ 未開放 | LOOP-007 凍結 |
| **Live Flush 已啟用** | ❌ 未啟用 | B-4C closeout §10 已重申 |
| **改 main 倉** | ❌ 未改 | worktree 隔離；main 倉所有文件 uchg + lock-verify |
| **寫 ~/.hermes/** | ❌ 未寫 | mtime audit 證明 |
| **git push** | ❌ 未執行 | Phase A 全鏈未 push |

## 8. HCC-STABLE 完整條件回顧

| # | 條件 | 狀態 | 補齊後 |
|---|------|------|--------|
| 1 | 連續 5 真實任務 | ⚠️ 5/5（最低門檻） | 5/5 |
| 2 | 零紅線違規 | ✅ | ✅ |
| 2' | ~/.hermes 乾淨 | ✅ | ✅ |
| 3 | 全鏈 artifact 齊 | ✅（HCC-AUDIT-001 已補齊） | ✅ |
| 4 | 1 次回滾演練 PASS | ❌ **0/1** → **1/1（本 drill）** | ✅ |
| 5 | quarantine 100% | ✅ 6/6 | ✅ |
| 6 | 零自確認 | ✅ | ✅ |

**本 drill 完成後，HCC-STABLE 六條件全部達標**（按本審計最低門檻解讀）。**仍需用戶單獨裁決 HCC-STABLE**。

## 9. 邊界

| 約束 | 守 |
|---|---|
| 不修改 src/** | ✅（worktree 隔離；僅新增 fixture + contract test，完成後恢復為空） |
| 不修改 tests/** 既有 | ✅（僅 worktree 內新增 + 回滾後消失） |
| 不修改 package.json / package-lock.json | ✅ |
| 不修改 CONTEXT.md / NEXT_STEP.md / .claude/settings.json | ✅ |
| 不寫 ~/.hermes/** | ✅ |
| 不啟動 runtime / dev server / HCC Auto Executor | ✅ |
| 不 push | ✅ |

## 10. 下一步

1. 用戶審閱 + GO HCC-ROLLBACK-DRILL-001 execution
2. 執行 rollback drill（worktree + abort + verify + cleanup）
3. 產出 1 份 rollback drill report（`docs/closeout/hcc-rollback-drill-001-closeout-2026-06-12.md`）
4. G-3 1/1 → 用戶單獨裁決 HCC-STABLE 是否達標 → 用戶決定是否開通車道二
5. **本 preflight 不導致任何紅線項自動開放**

## 11. 修訂

- 2026-06-12 v1：HCC-ROLLBACK-DRILL-001 preflight — G-3 rollback drill 審批文檔。
