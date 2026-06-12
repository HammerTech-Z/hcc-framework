# HCC-AUDIT-001 Structured Artifact Backfill — Preflight

> HCC-AUDIT-001 preflight。G-2 artifact 結構化補齊的審批文檔。**僅 preflight，不實際補 fixture**。
> 不聲明 HCC-STABLE 達標；不開放任何紅線項。

## 1. 目標

為最近 5 個真實任務補上結構化 artifact（handoff plan + 四段 progress），使 HCC-STABLE 條件 3「全鏈 artifact 齊」從部分達標走向結構化達標。

**範圍**：補 A-6 / B-2 / B-3 / B-4B / B-4C 五個任務的 handoff fixture + progress fixture + 1 份 audit report。
**不**包含：實際 fixture 寫盤（本批僅 preflight）；B-4A（contract-only，不計入 5 個真實任務）；G-3 rollback drill（另批）。

**明確聲明**：本補齊完成**不**自動構成 HCC-STABLE 達標。達標仍需用戶單獨裁決 + G-3 補齊。

## 2. 5 個真實任務清單

| # | 任務 | commit | 真實性 | closeout |
|---|------|--------|-------|----------|
| 1 | A-6 capability/registry 空殼 | `3ed8fcb`（merge `a3f6dd6`） | 是 | `docs/closeout/a6-first-task-closeout-2026-06-11.md` |
| 2 | B-2 real-input scan gate | `e4a688b`（merge `8591bfa`） | 是 | `docs/closeout/b2-scan-gate-closeout-2026-06-11.md` |
| 3 | B-3 reflection evaluator runner | `dc0d3e4`（merge `b2ab1f3`） | 是 | `docs/closeout/b3-evaluator-closeout-2026-06-11.md` |
| 4 | B-4B live reflection writer impl | `62b9bef` | 是 | `docs/closeout/hcc-phase-b-lane-one-b4-closeout-2026-06-12.md` §B-4B |
| 5 | B-4C live flush approval gate impl | `a15971f` | 是 | `docs/closeout/b4c-flush-gate-closeout-2026-06-12.md` |

**B-4A**（commit `6a33f6c`）為 contract-only，**不**計入 5 個真實任務。

## 3. 預期新增 fixture 文件清單

### 3.1 5 個 handoff fixture

| 文件路徑 | 對應任務 |
|---|---|
| `tests/fixtures/learning-loop/ll015-a6-handoff.json` | A-6 |
| `tests/fixtures/learning-loop/ll016-b2-handoff.json` | B-2 |
| `tests/fixtures/learning-loop/ll017-b3-handoff.json` | B-3 |
| `tests/fixtures/learning-loop/ll018-b4b-handoff.json` | B-4B |
| `tests/fixtures/learning-loop/ll019-b4c-handoff.json` | B-4C |

每個 fixture 採用 A-1 `HCCTaskHandoffPlan` 結構（`src/shared/lib/safety/hcc-task-handoff-policy.ts` line 70）：

```typescript
interface HCCTaskHandoffPlan {
  schema_version: string;
  completed_baseline: HCCCompletedBaseline;       // 含 evidence refs
  in_progress: HCCInProgressTask;                 // 嚴格單任務
  next_step: HCCNextStepPlan;                     // 含輸入條件 + 成功判據
}
```

每個 fixture 通過 `validateHCCTaskHandoffPlan` 校驗（line 169）。

### 3.2 5 個 progress fixture

| 文件路徑 | 對應任務 |
|---|---|
| `tests/fixtures/learning-loop/ll015-a6-progress.json` | A-6 |
| `tests/fixtures/learning-loop/ll016-b2-progress.json` | B-2 |
| `tests/fixtures/learning-loop/ll017-b3-progress.json` | B-3 |
| `tests/fixtures/learning-loop/ll018-b4b-progress.json` | B-4B |
| `tests/fixtures/learning-loop/ll019-b4c-progress.json` | B-4C |

每個 fixture 採用 A-1 `HCCProgressRecord` 結構（`hcc-task-handoff-policy.ts` line 83）：

```typescript
interface HCCProgressRecord {
  schema_version: string;
  changed_this_round: readonly string[];   // 該輪變更的具體文件/結構
  last_successful_command: string;         // 上一輪驗證命令 + 輸出摘要
  current_blocker: string;                  // 當前阻塞（空字串 = 無）
  next_plan: string;                        // 下一輪具體計劃（非空）
}
```

每個 fixture 通過 `validateHCCProgressRecord` 校驗（line 261）。

### 3.3 1 份 audit report

| 文件路徑 |
|---|
| `docs/closeout/hcc-audit-001-structured-artifact-backfill-closeout-2026-06-12.md` |

包含：
- 5 個 handoff fixture 的 schema 校驗結果（`validateHCCTaskHandoffPlan` 通過）
- 5 個 progress fixture 的 schema 校驗結果（`validateHCCProgressRecord` 通過）
- 結構化前後對照（closeout-only → closeout + handoff/progress fixture）
- 紅線複核（5 個任務均零紅線違規；`~/.hermes` 仍乾淨）
- 不聲明 HCC-STABLE 達標

### 3.4 1 個 contract test

| 文件路徑 | 預計行數 |
|---|---|
| `tests/learning-loop/hcc-audit-001-structured-artifact-backfill.test.ts` | ~100 行 |

覆蓋：
- 5 個 handoff fixture 通過 `validateHCCTaskHandoffPlan`（必須 0 errors）
- 5 個 progress fixture 通過 `validateHCCProgressRecord`（必須 0 errors）
- 每個 fixture `changed_this_round` 至少 1 項
- 每個 fixture `next_plan` 非空
- 每個 fixture `current_blocker` 反映當前任務真實阻塞（不可填空字串掩飾）
- 每個 fixture 引用對應 closeout doc（file_pattern 引用真實路徑）
- 預計 6+ 個測試

**總計新增**：5 + 5 + 1 + 1 = 12 文件 / ~350 行 / 0 src/ 改動。

## 4. 設計意圖

### 4.1 採用 A-1 contract 結構的理由

- **A-1 已落庫**（`src/shared/lib/safety/hcc-task-handoff-policy.ts` commit `e7db08b`）
- A-1 handoff/progress contract 為 HCC v2 流程的機器可讀化基礎
- 採用 A-1 contract 等同「backfill 與 A-1 同步」而非新造契約
- 5 個真實任務的 closeout 已有完整 narrative；本批將其**結構化**為機器可讀 fixture

### 4.2 Append-only 原則

- **不**修改任何現有 closeout（`a6-first-task-closeout-2026-06-11.md` 等）
- **不**修改任何現有 fixture（`ll010` ~ `ll014` quarantine 標記）
- **僅**新增 12 個文件
- 每個新 fixture 引用對應 closeout 文檔路徑，保留 audit trail

### 4.3 evidence refs 強制鏈接

每個 handoff fixture 的 `completed_baseline.evidence_refs` 必須指向：
1. 對應 closeout doc（path 相對 `hermes-pro/`）
2. 對應 `git show` 輸出（如 `3ed8fcb:src/shared/lib/registry/capability-registry.ts`）
3. 對應 quarantine fixture（如 `ll010-a6-first-task-quarantine.json`）

每個 progress fixture 的 `changed_this_round` 必須列出**具體文件/結構變更**（不允許空陣列或單字符串「various changes」掩飾）。

## 5. 測試計劃

| 測試 | 覆蓋 | 期望 |
|---|---|---|
| handoff fixture schema 校驗 × 5 | `validateHCCTaskHandoffPlan` | 0 errors |
| progress fixture schema 校驗 × 5 | `validateHCCProgressRecord` | 0 errors |
| `changed_this_round` 非空 | 5 個 progress fixture | 至少 1 項 |
| `next_plan` 非空 | 5 個 progress fixture | 非空字符串 |
| `current_blocker` 反映真實 | 5 個 progress fixture | 字面對應 closeout §3 內容 |
| evidence refs 鏈接 | 5 個 handoff fixture | 含 closeout + commit + quarantine 三類 |
| 靜態掃描 | 12 個新文件 | 零 fs/child_process/ipcMain/BrowserWindow/knowledgeIngest |
| `npm run typecheck` | 全項目 | PASS |
| `lock-verify.sh` | 全項目 | PASS=46 |

## 6. 回滾方式

```bash
git revert <HCC-AUDIT-001-commit>

# 或直接刪除新增文件：
rm tests/fixtures/learning-loop/ll015-a6-handoff.json
rm tests/fixtures/learning-loop/ll016-b2-handoff.json
rm tests/fixtures/learning-loop/ll017-b3-handoff.json
rm tests/fixtures/learning-loop/ll018-b4b-handoff.json
rm tests/fixtures/learning-loop/ll019-b4c-handoff.json
rm tests/fixtures/learning-loop/ll015-a6-progress.json
rm tests/fixtures/learning-loop/ll016-b2-progress.json
rm tests/fixtures/learning-loop/ll017-b3-progress.json
rm tests/fixtures/learning-loop/ll018-b4b-progress.json
rm tests/fixtures/learning-loop/ll019-b4c-progress.json
rm docs/closeout/hcc-audit-001-structured-artifact-backfill-closeout-2026-06-12.md
rm tests/learning-loop/hcc-audit-001-structured-artifact-backfill.test.ts

# 驗證基線不降：
npx vitest run --config vitest.config.ts
npm run typecheck
git diff --check
bash ~/hermes-pro-work/scripts/lock-verify.sh
```

回滾錨：HCC-AUDIT-001 涉及的所有文件**均為新增**；無現存文件被修改；刪除即可完全回滾。

## 7. 禁項表

| 禁項 | 來源 |
|---|---|
| **寫 `~/.hermes/**`** | P0-1 LOCK.md + lock-verify |
| **改 `src/main/**` 任何現存文件** | P0-1 鎖 + 本批 HCC-AUDIT-001 範圍外 |
| **改 `src/renderer/**` / `src/preload/**` / `src/screens/**`** | 同上 |
| **改 `tests/` 既有測試** | 僅新增 contract test |
| **改 `package.json` / `package-lock.json`** | 本批範圍外 |
| **改 `.claude/settings.json`** | harness config，不屬項目 |
| **apply path 開放** | B-4C runtime guard 白名單只接受 `pending_user_approval` |
| **Auto Executor 常駐啟動** | plan A-5 §1.6 + HCC-GO §2.2 |
| **Phase B 車道二 B-5 / B-6 開放** | plan v3.2 + HCC-GO §2.2 |
| **Live Ranking mutation 開放** | LOOP-007 凍結 |
| **聲明 HCC-STABLE 達標** | 本補齊僅結構化 artifact；G-3 仍未完成 |
| **`git push`** | Phase A 全鏈未 push |
| **聲明 Live Flush 已啟用** | B-4C closeout §10 已重申 |

## 8. 與 G-3 關係

G-3（rollback drill）**仍未完成**，且**獨立於本批**。即使 HCC-AUDIT-001 全部完成：
- 條件 1 達標：5/5（按本 preflight 最低門檻解讀）
- 條件 2 達標：零紅線違規（已確認）
- 條件 2' 達標：`~/.hermes` 乾淨
- 條件 3 達標：全鏈 artifact 齊（本批補齊）
- 條件 4 **仍未達標**：G-3 rollback drill 0/1
- 條件 5 達標：6/6 quarantine
- 條件 6 達標：零自確認

**HCC-STABLE 達標仍需 G-3 補齊**（用戶單獨批准 HCC-ROLLBACK-DRILL-001）。

## 9. 鎖狀態

- `src/main` 與 `src/main/safety` 已是 uchg
- `src/shared/lib` 不在 uchg 鎖內（可寫）
- `tests/` 不在 uchg 鎖內（可寫）
- `tests/fixtures/` 不在 uchg 鎖內（可寫）
- `docs/` 不在 uchg 鎖內（可寫）
- **本批所有目標路徑均可直接寫入，無需 chflags nouchg**

## 10. 邊界

| 約束 | 守 |
|---|---|
| 不改 `src/**` | ✅（本批僅寫 `tests/fixtures/`, `tests/learning-loop/`, `docs/closeout/`） |
| 不改既有 closeout | ✅（append-only） |
| 不改既有 fixture | ✅ |
| 不寫 `~/.hermes/**` | ✅ |
| 不調用 knowledgeIngest / knowledgeSearch | ✅ |
| 不啟動 runtime / dev server / HCC Auto Executor | ✅ |
| 不 push | ✅ |
| 不聲明 HCC-STABLE 達標 | ✅ |
| 不聲明 Live Flush 已啟用 | ✅ |

## 11. 下一步

1. 用戶審閱本 preflight + 裁決 GO HCC-AUDIT-001 implementation
2. 實施階段：
   - 寫 5 個 handoff fixture
   - 寫 5 個 progress fixture
   - 寫 1 個 audit report
   - 寫 1 個 contract test
   - 運行 typecheck + vitest + lock-verify
3. 提交 commit 12 個新文件
4. G-3 rollback drill 仍需另批 HCC-ROLLBACK-DRILL-001

## 12. 修訂

- 2026-06-12 v1：HCC-AUDIT-001 preflight — G-2 artifact 結構化補齊的審批文檔。
