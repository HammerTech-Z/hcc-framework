# hermes-pro electron-vite + electron 兼容性问题

## 问题描述

hermes-pro（Electron 桌面应用）在启动时崩溃，报错：

```
[MAIN UNCAUGHT] TypeError: Cannot read properties of undefined (reading 'whenReady')
    at Object.<anonymous> (/Users/midoudou/hermes-pro/out/main/index.js:11277:18)
```

## 环境信息

```
hermes-desktop@0.3.6
electron: ^40.10.1 (从 ^39.2.6 升级)
electron-vite: ^5.0.0
vite: ^7.2.6
node: v24.15.0
macOS: Darwin 25.5.0 (Apple Silicon)
```

## 复现步骤

```bash
cd ~/hermes-pro
npm install  # 已执行
npm run dev  # 或 npm run start
# 报错崩溃
```

## 根本原因分析

1. **electron-vite 5.x 改变了 externalize 机制**
   - 编译时，`require('electron')` 被标记为 external
   - 运行时，`require('electron')` 返回字符串路径 `/path/to/Electron.app/...` 而非 electron API 对象

2. **electron 40.x 包结构变化**
   - `index.js` 变成安装脚本（返回可执行文件路径）
   - 不再直接导出 electron API

3. **验证**
   ```javascript
   // node -e 测试
   const m = require('electron');
   console.log(typeof m);  // "string"
   console.log(m);         // "/path/to/Electron.app/Contents/MacOS/Electron"
   ```

## 尝试过的修复

| 方案 | 结果 | 说明 |
|------|------|------|
| 删除 node_modules/electron 重新安装 | ❌ | electron 40.x 仍然返回字符串 |
| 降级到 electron 39.2.6 | ❌ | 网络超时，无法下载 |
| 设置 `externalizeDeps: false` | ❌ | 无效 |
| 手动修改编译后代码 | ❌ | 治标不治本 |

## 关键代码位置

### 编译后代码（问题点）
```javascript
// out/main/index.js:24
const require$$1$2 = require("electron");  // 返回字符串！

// out/main/index.js:11277
require$$1$2.app.whenReady().then(() => {  // 崩溃点
```

### 源代码（正常）
```typescript
// src/main/index.ts
import { app, ... } from "electron";  // 正确导入 app

app.whenReady().then(() => {  // 应该用 app
```

## 历史对比

| 时间 | electron | electron-vite | 状态 |
|------|----------|---------------|------|
| 035cf9f commit | ^39.2.6 | ^5.0.0 | ✅ 未知是否测试 |
| 当前 | ^40.10.1 | ^5.0.0 | ❌ 崩溃 |

## 项目结构

```
hermes-pro/
├── src/
│   ├── main/index.ts          # Electron main process
│   ├── preload/index.ts      # preload scripts
│   └── renderer/src/         # React UI
├── electron.vite.config.ts
├── package.json
└── out/                       # 编译输出
```

## electron-vite 配置

```typescript
// electron.vite.config.ts
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['better-sqlite3']
      }
    }
  },
  preload: {},
  renderer: {
    resolve: { alias: { '@renderer': resolve('src/renderer/src') } },
    plugins: [tailwindcss(), react()]
  }
})
```

## git 历史

```
035cf9f P1 工程债收尾：修复setConfigValue返回值+SSE流关闭保护
11904ee Update package.json
e2f544a Windows Support
1d1d2d5 Merge pull request #68 from ComicBit/ssh-tunnel
```

## 期望行为

1. `npm run dev` 或 `npm run start` 能正常启动 hermes-pro 窗口
2. AgentMonitor 面板显示健康状态、vault 内容、cron 运行历史等

## 需要解决的疑问

1. electron-vite 5.x 与 electron 40.x 是否有已知的兼容性问题？
2. 是否有配置方式让 electron-vite 5.x 正确处理 electron 40.x？
3. 是否需要降级 electron 到 39.x？还是升级 electron-vite 到某个版本？
4. 是否有其他已知的 work-around？

## 联系方式

- 项目路径：`~/hermes-pro`
- 运行环境：macOS Apple Silicon
- Node 版本：v24.15.0