# 🔒 hermes-pro 物理锁 — 真实机制说明

> 修订日期：2026-06-11（任务卡 P0-1 真相修复）
> 修订人：Claude Code（基于 `ls -lO` 实测，禁止文学化描述）

## 1. 真实状态（实测，非设计目标）

| 项 | 实测值 |
| --- | --- |
| 锁机制 | macOS `chflags uchg`（用户不可变标志位） |
| 检测器 | **无**（无 watchdog / launchd / `violations.log`） |
| audit/hook | **无**（不写 `~/.hermes/audit/`，无任何旁路监测） |
| 解锁路径 | 同用户可 `chflags nouchg`（非安全屏障，仅防误改） |
| 被锁文件 | 实测**仅** `src/main/config.ts` 有 uchg；`src/renderer`、`src/screens` 为历史 `r-xr-xr-x` 目录权限（**非** uchg） |
| `electron/` 目录 | **不存在**（LOCK.md v1 误写，本版移除） |

**结论**：当前为**部分生效 + 弱约束**。"已被强制呈现"等说法是设计目标，**不是已生效事实**。

## 2. 真实被锁 / 被约束范围

```bash
# 实测 (2026-06-11)
ls -lO ~/hermes-pro/src
# src/renderer  dr-xr-xr-x  (历史权限，非 uchg)
# src/screens   dr-xr-xr-x  (历史权限，非 uchg)
# src/main      drwxr-xr-x  (目录无 uchg，但内部 config.ts 有 uchg)
ls -lO ~/hermes-pro/src/main/config.ts
# -rw-r--r-- uchg  (单一文件被锁)
```

**注意**：目录级 uchg 不会自动递归；目录无 uchg 但目录权限位 `r-x` 仍可阻止写。本仓 `src/renderer`、`src/screens` 是后者。

## 3. 工具脚本（work 仓，不在 main 仓）

| 脚本 | 作用 |
| --- | --- |
| `~/hermes-pro-work/scripts/lock-enforce.sh` | 施加 / 解除 chflags uchg。无参数打印 usage；`--apply` / `--unlock` 需真实 TTY 且输入 `APPLY` / `UNLOCK` 确认后真跑 |
| `~/hermes-pro-work/scripts/lock-verify.sh` | 断言 `src/main`、`src/renderer`、`src/screens`、`package.json` 均有 uchg，**只读不写** |

### 用法

```bash
# 状态查询（推荐先跑）
bash ~/hermes-pro-work/scripts/lock-enforce.sh --status

# 真上锁（用户手动执行，Claude Code 不代跑）
bash ~/hermes-pro-work/scripts/lock-enforce.sh --apply

# 解锁（同用户，临时改文件用）
bash ~/hermes-pro-work/scripts/lock-enforce.sh --unlock

# 验证
bash ~/hermes-pro-work/scripts/lock-verify.sh
```

## 4. 给 Hermes Agent / Claude Code 的硬约束

1. **不得**直接写 `~/hermes-pro/src/**`、`~/hermes-pro/package.json`。
2. **不得**执行 `chflags nouchg` 或 `chmod` 解锁（无 watchdog 检测，但仍违反本 LOCK.md 范围约束与灵魂 §3/§6/§10/§12）。
3. **不得**调用 `lock-enforce.sh --apply` 或 `--unlock`（脚本要求 TTY + 输入确认，本约束禁止触发该意图；非 TTY 环境下脚本自身会拒绝并 exit=2）。
4. 所有代码改动走 `~/hermes-pro-work` 仓，sync 由用户手动执行。
5. **不得**创建或写入 `~/.hermes/**`（家目录下的 hermes 配置目录，即红线区；与 `~/hermes-pro/` 仓库根不同）。

## 5. 设计目标 vs 现状（透明声明）

| 设计目标 | 现状 |
| --- | --- |
| `src/main`、`src/renderer`、`src/screens`、`package.json` 全 uchg | ❌ 仅 `src/main/config.ts` 单文件 uchg；其他靠历史目录权限 |
| watchdog 检测 nouchg 行为 | ❌ 未实装 |
| `violations.log` 记入绕过 | ❌ 未实装 |
| sync 脚本由 Hermes Agent 调用 | ❌ 未实装，且按本约束 #3 不应实装 |

**这是 P0-1 阶段任务的输入事实**。如要推进"全路径 uchg + 强制约束"，须开新任务卡（建议 P1 段），不在本任务范围。

## 6. 变更史

- 2026-06-11 v2：移除 watchdog / violations.log / electron/ 等文学化描述；改为实测状态；引入 lock-enforce.sh / lock-verify.sh 真实工具路径。
- v1：原始描述（与实测不符，作废）。
