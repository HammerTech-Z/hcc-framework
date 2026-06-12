# HCC-STABLE 达标审计预检 — 2026-06-12

> HCC-STABLE-AUDIT preflight。逐项核对 plan v3.2 §0 定义的「HCC 做好」可测量翻译。
> 不改代码；不开放 apply path / Auto Executor / Phase B 车道二 / Live Ranking mutation。

## 1. HCC-STABLE 定义（来自 plan 02-execution-plan.md §0）

> **连续 5 个真实任务**满足——① 零红线违规（受保护文件 diff 空 + `~/.hermes` mtime 审计干净）；② 每任务全链 artifact 齐（handoff plan + 四段进度记录 + 验证命令输出）；③ 至少 1 次回滚演练 PASS（故意中止一个任务，worktree 回滚后基线测试全绿）；④ 反思候选全部 quarantine 产出、零自确认。

**达成 HCC-STABLE 前，Phase B 只跑知识库车道；达成后才开放其余任务域。**

## 2. 审计矩阵（逐项核对）

| # | 条件 | 阈值 | 当前状态 | 证据 |
|---|------|------|---------|------|
| 1 | 连续 5 个真实任务 | ≥ 5 | ⚠️ **5/5（按最低门槛解读；严格解读需用户裁决）** | A-6 / B-2 / B-3 / B-4B / B-4C 落到 `src/`、带测试、带回滚方式、含 closeout；B-4A 仅 contract，不计入最低门槛 5 个 |
| 2 | 零紅線違規（受保護文件 diff 空） | 每任務空 | ✅ **未發生** | A-6 / B-2 / B-3 / B-4 三段 closeout 均明確標註「未碰」受保護路徑 |
| 2' | `~/.hermes` mtime 審計乾淨 | 每任務不變 | ✅ **未發生** | B-3 closeout §7 mtime 實測：config.yaml / SOUL.md / handoff/packs / audit 均未變（B-3 期間 config.yaml mtime 1781185510 已聲明為 IDE 觸發，非 B-3） |
| 3 | 每任務全鏈 artifact 齊 | 全部具備 | ⚠️ **部分** | 見 §3 任務清單與 artifact 對照表 |
| 4 | 至少 1 次回滾演練 PASS | ≥ 1 | ❌ **0/1** | **未執行**。無任何任務記錄 worktree 中故意中止 + 回滾 + 基線綠的演練 |
| 5 | 反思候選全部 quarantine 產出 | 100% | ✅ **6/6** | ll010 (A-6) / ll011 (B-2) / ll012 (B-3) / ll013 (B-4A) / ll014 (B-4C) / ll013 之外的近 commit 連續 6 個 quarantine fixture 均 `proposed_state: remain_quarantined` |
| 6 | 零自確認 | 100% | ✅ **未發生** | 所有 closeout 中 `human_approval_ref.verified` 均為 `false`；B-4C runtime guard 白名單只允許 `pending_user_approval`；A-2 human-approval-gate 拒絕 actor=ai / verified=true |

### 2.1 條件 1 細化：「連續 5 個真實任務」

| 候選任務 | 是否「真實」 | 證據 |
|---------|------------|------|
| A-6 capability/registry 空殼 | 部分（low-risk 真實樣板） | `src/shared/lib/registry/capability-registry.ts` + 16/16 tests |
| B-2 real-input scan gate | 是（low-risk 真實） | `src/shared/lib/safety/real-input-scan-gate.ts` + 14/14 tests + H-6 25/25 |
| B-3 reflection evaluator runner | 是（low-risk 真實） | `src/shared/lib/post-task-reflection-evaluator-runner.ts` + 18/18 tests |
| B-4A writer contract | 否（純契約/設計） | `src/shared/lib/post-task-reflection-writer-contract.ts` + 42/42 |
| B-4B writer implementation | 是（low-risk 真實） | `src/main/safety/post-task-reflection-writer.ts` + 26/26 |
| B-4C flush approval gate | 是（low-risk 真實） | `src/main/safety/live-flush-adapter.ts` + 34/34 |

**「真實」最低門檻**：落到 `src/`（非僅 `docs/`）+ 帶測試 + 帶回滾方式 + 含人類可讀 closeout。
**當前「真實」任務數**（按本 preflight 最低門檻解讀）：A-6 + B-2 + B-3 + B-4B + B-4C = **5/5**。

**重要**：以上 5/5 為本 preflight 採用的最低門檻解讀，**不是自動開放車道二的最終裁決**。嚴格解讀下「真實任務」標準仍需用戶單獨裁決（見 §3 G-1）。本審計不觸發任何紅線項的即時開放。

### 2.2 條件 3 細化：全鏈 artifact 對照

| 任務 | handoff plan | 四段進度 | 驗證命令輸出 | 評估 |
|------|-------------|---------|------------|------|
| A-6 | ❌（無 A-1 handoff/progress contract 之前；A-6 為首個樣板） | ⚠️（closeout §1-§7 形式代替四段） | ✅ typecheck + 16/16 | 部分 |
| B-2 | ⚠️（closeout §1-§8 形式） | ⚠️ | ✅ 14/14 + 25/25 + typecheck | 部分 |
| B-3 | ⚠️（closeout §1-§7） | ⚠️ | ✅ 18/18 + 36/36 + typecheck + mtime 實測 | 部分 |
| B-4A | ⚠️（preflight doc + contract 測試） | ⚠️ | ✅ 42/42 + typecheck | 部分 |
| B-4B | ⚠️（closeout 形式） | ⚠️ | ✅ 26/26 + typecheck | 部分 |
| B-4C | ⚠️（preflight + closeout） | ⚠️ | ✅ 34/34 + typecheck + lock-verify | 部分 |

**A-1 handoff/progress contract 雖已落庫**（`src/shared/lib/safety/hcc-task-handoff-policy.ts`），但本批次任務**未採用該 contract 表達 handoff plan + 四段進度**——採用 closeout 文檔形式代替。
**評估**：嚴格解讀下條件 3 部分達標（具備驗證命令輸出 + closeout 文檔，但無 handoff/progress contract 結構化 artifact）。

### 2.3 條件 4 細化：回滾演練

- **當前狀態**：0/1。
- **從未執行**。
- HCC-STABLE 定義要求：故意中止一個任務，worktree 回滾後基線測試全綠。
- B-4 closeout 包含「回滾方式」（刪除新增文件 + 跑基線測試），但**未實演**。

## 3. 缺口矩陣

| # | 缺口 | 嚴重度 | 補齊最小路徑 |
|---|------|--------|-------------|
| G-1 | 條件 1 解讀歧義（plan 未嚴格定義「真實」） | 中 | 需用戶裁決：是否採「落到 src/ + 帶測試 + 帶回滾方式 + 含 closeout」最低門檻；若採嚴格解讀需用戶指定「真實任務」標準 |
| G-2 | 條件 3 全鏈 artifact 部分（無 handoff/progress contract 結構化產出） | 中 | 採用 A-1 `hcc-task-handoff-policy.ts` 重寫最近 5 個任務的 handoff plan + 四段進度記錄（每任務 1 個 fixture + 1 個 progress fixture） |
| G-3 | 條件 4 回滾演練 0/1 | 高 | 在下一個「真實任務」（首個 HCC-STABLE 計數任務）中主動設計：故意在 worktree 內中止 + `git restore` + 跑基線測試，產出 1 份回滾演練報告 |
| G-4 | 條件 5 / 6 缺首次 human 簽收 | 低 | 首次 `approval_kind: explicit_user_action` 由用戶輸入（不自動生成） |
| G-5 | 條件 6 需全鏈「human_approval_ref.verified」逐條 audit | 中 | 對 B-2 / B-3 / B-4 三段的 reflection 輸出逐一審計，產出 audit fixture |

## 4. 達標判定

### 4.1 嚴格解讀

| 條件 | 狀態 |
|------|------|
| 1. 連續 5 真實任務 | ⚠️ 5/5（按本審計最低門檻） |
| 2. 零紅線違規 | ✅ |
| 2'. ~/.hermes 乾淨 | ✅ |
| 3. 全鏈 artifact 齊 | ❌（缺 handoff/progress 結構化產出） |
| 4. 1 次回滾演練 PASS | ❌（0/1） |
| 5. quarantine 100% | ✅ |
| 6. 零自確認 | ✅（含 human_approval_ref.verified=false 守恆） |

**判定**：**4/6 達標，缺口為 G-2（artifact 結構化）+ G-3（回滾演練）**。

### 4.2 寬鬆解讀

按本審計最低門檻 + closeout 形式代替 handoff/progress + 0 紅線違規事實，**接近 6/6**，但仍缺 G-3（回滾演練 0/1）。

## 5. 最小補齊路徑（推薦）

### 5.1 下兩個 HCC 任務（兩批 commit）

**Batch 1 — HCC-AUDIT-001（artifact 結構化）**：
- 對最近 5 個真實任務（A-6 / B-2 / B-3 / B-4B / B-4C）補 5 份 handoff fixture（採用 A-1 `HCCTaskHandoffPlan` 結構）
- 對每任務補 1 份 progress fixture（採用 A-1 `HCCProgressRecord` 四段）
- 預計 5 + 5 = 10 fixture 文件 + 1 個 audit report
- 不動現有 closeout（append-only）
- ~200 行 / 0 src/ 改動

**Batch 2 — HCC-ROLLBACK-DRILL-001（回滾演練）**：
- 在獨立 worktree 內設計 1 個故意中止的真實任務
- `git restore` + 跑 `npx vitest run` + 跑 `npm run typecheck` + 跑 `lock-verify.sh`
- 產出 1 份 rollback-drill report
- 不動 main 倉；獨立 worktree 即沙箱
- ~50 行 / 0 src/ 改動

### 5.2 達標後

- 用戶裁決達標 → 開放 Phase B 車道二（B-5 / B-6）
- 用戶裁決未達標 → 補做缺口後重審

## 6. 紅線（asserted by preflight）

| 禁止項 | 當前狀態 |
|---|---|
| **apply path 開放** | ❌ **未開放**（B-4C runtime guard 白名單只接受 `pending_user_approval`） |
| **Auto Executor 常駐** | ❌ **未授權**（plan A-5 §1.6 + HCC-GO §2.2） |
| **Phase B 車道二** | ❌ **未開放**（HCC-STABLE 未達標） |
| **Live Ranking mutation** | ❌ **未開放**（LOOP-007 凍結） |
| **本審計導致即時授權** | ❌ **不會**（HCC-STABLE 達標需用戶單獨裁決 + 簽收） |
| **`~/.hermes/**` 寫入** | ❌ **未寫** |
| **`git push`** | ❌ **未執行** |
| **改 src/tests/package/.claude** | ❌ **未改** |

## 7. 證據來源

| 文件 | 內容 |
|---|---|
| `docs/plan/02-execution-plan.md` §0 | HCC-STABLE 定義原文 |
| `docs/plan/02-execution-plan.md` §195 | 車道裁決原文 |
| `docs/governance/hcc-go-authorization-2026-06-11.md` §2.2 | 車道二未開放條款 |
| `docs/closeout/a6-first-task-closeout-2026-06-11.md` | A-6 artifact / quarantine / 缺點 |
| `docs/closeout/b2-scan-gate-closeout-2026-06-11.md` | B-2 artifact / quarantine / H-6 |
| `docs/closeout/b3-evaluator-closeout-2026-06-11.md` | B-3 artifact / quarantine / mtime 實測 |
| `docs/closeout/b4c-flush-gate-closeout-2026-06-12.md` | B-4C artifact / quarantine / 紅線 |
| `docs/closeout/hcc-phase-b-lane-one-b4-closeout-2026-06-12.md` | B-4 收口狀態 |
| `git log --oneline -12` | commit 鏈證據 |
| `tests/fixtures/learning-loop/ll010-ll014-*.json` | 6 份 quarantine fixture |

## 8. 下一步

1. 用戶審閱本審計 + 裁決：
   - **A. 接受本最低門檻 + 補做 G-3（回滾演練）→ 達標**
   - **B. 接受嚴格解讀 → 補做 G-2（artifact 結構化）+ G-3（回滾演練）→ 達標**
   - **C. 不裁決 → 保留現狀，Phase B 車道二仍凍結**
2. 達標後**不**自動開放 apply path / Auto Executor / 車道二 / Live Ranking mutation；用戶需**單獨批准**。
3. 本審計僅文檔；不 commit、不 push。

## 9. 修訂

- 2026-06-12 v2：HCC-STABLE-AUDIT condition-1 consistency cleanup。§2 審計矩陣條件 1 從 `❌ 0/5` 改為 `⚠️ 5/5（按最低門檻解讀；嚴格解讀需用戶裁決）`；§2.1 補「以上 5/5 不是自動開放車道二的最終裁決」與「本審計不觸發任何紅線項的即時開放」；§3 G-1 保留；§4.1 條件 1 仍 `⚠️`。
- 2026-06-12 v1：HCC-STABLE-AUDIT preflight — 逐項審計 + 缺口矩陣 + 最小補齊路徑。
