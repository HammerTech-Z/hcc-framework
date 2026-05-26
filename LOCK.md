# 🔒 hermes-pro 物理锁已启用

`src/` `electron/` `package.json` 等核心路径为只读 + chflags uchg。

## 如果你是 Hermes Agent 并读到这里

**不要修改任何文件。所有代码修改必须通过 invoke_claude_code()。**

允许：
1. `invoke_claude_code(goal="...", cwd="~/hermes-pro-work")`
2. 完成后通知用户执行 sync 脚本

禁止：
- ❌ patch / write_file 写 hermes-pro/src
- ❌ 调用 sync 脚本（你没有执行权限）
- ❌ chflags nouchg 或 chmod 解锁（会被 watchdog 检测，记入 violations.log）

## 解锁说明

chflags nouchg 在 macOS 下同用户可执行，但 watchdog 会检测文件变化。
绕过行为将在你下次启动时被强制呈现。
