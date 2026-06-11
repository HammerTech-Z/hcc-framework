# 任务卡 [P0-1]：物理锁真相修复（真锁最小版）

## 来源：docs/plan/02-execution-plan.md §Phase 0 P0-1（v3.2）
## 裁决：用户已批 (a) 真锁（2026-06-10）；watchdog/violations.log 降为 v2，本卡不做
## 灵魂约束：§12（设计目标≠现状）、§8、§4（完成配可重跑验证）、修改规则第 5 条

## 红线（本任务专属）
- 不 commit / push（产物就位后报批）
- 不写 `~/.hermes/` 任何文件
- 不锁 `~/hermes-pro-work`（work 仓必须保持可写）
- 不在本卡内实现 watchdog / launchd / violations.log（v2 范围，写进 LOCK.md 即算越界）
- 脚本在 work 仓编写；上锁动作本身由用户在 main 仓手动执行（脚本只提供命令，不代跑 chflags）

## 输入事实
- supplement #3 S14：实测无 uchg / 无 Hermes watchdog / 无 violations.log；LOCK.md 描述与实际冲突（H-1）
- LOCK.md 现声称锁 `src/` `electron/` `package.json`
- renderer 目录现有 dr-xr-x 目录权限（来历不明，脚本须兼容：先记录现状再上锁）

## 期望产出
1. `scripts/lock-enforce.sh`——对 `src/ electron/ package.json` 递归 `chflags uchg`；执行前打印将锁定的路径清单并要求交互确认；自带 `--unlock` 反向模式（sync 流程用）
2. `scripts/lock-verify.sh`——断言三路径 uchg 全在（`ls -lO` 解析），任一缺失退出码非 0 并列出缺失项
3. `LOCK.md` 重写——只描述真实生效的机制（chflags + 两脚本 + sync 流程"解锁→覆盖→重锁"三步）；v2 候选（watchdog/violations.log）单独一段标注"未实装"
4. 四段进度记录（GOV-006 格式）：changed_this_round / last_successful_command / current_blocker / next_plan

## 验证（可独立重跑）
```bash
# 用户在 main 仓手动执行 enforce 后：
bash scripts/lock-verify.sh && echo PASS          # 期望 PASS
touch ~/hermes-pro/src/main/index.ts 2>&1         # 期望 Operation not permitted
bash scripts/lock-enforce.sh --unlock && touch ~/hermes-pro/src/main/index.ts && \
  git -C ~/hermes-pro checkout -- src/main/index.ts && bash scripts/lock-enforce.sh
                                                   # 期望解锁-写入-还原-重锁全链通
stat -f "%m" ~/.hermes/config.yaml                 # 期望与开工前一致
git -C ~/hermes-pro-work status --short -uall      # 期望仅新增 2 脚本 + LOCK.md 改动
```

## 收口：Preflight Report（Findings / Files / Boundary / Tests / Commit recommendation），commit 等用户批

## PASS 即登记
- B1 闸 `no_hermes_writes` 证据行：lock-verify.sh 输出 + touch 失败输出
- 附录零 H-1 状态 ⬜ → ✅
