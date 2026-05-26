// Electron 30+ 兼容垫片
// 核心检测：process.versions.electron 存在 = Electron 运行时（main/preload 都有）
// process.versions.electron 不存在 = Node.js（electron-vite 构建校验阶段）
const isElectronRuntime = typeof process !== 'undefined' &&
  process.versions && typeof process.versions.electron === 'string';

if (isElectronRuntime) {
  // Electron 运行时（main 或 preload）
  let electron;
  try { electron = require('electron'); } catch { electron = null; }
  // require('electron') 在 Electron 39 返回 npm 包路径字符串，无真实 API
  // 只能通过判断 contextBridge 是否存在来区分 preload
  const hasContextBridge = electron && typeof electron.contextBridge !== 'undefined';
  if (hasContextBridge) {
    // preload：返回真实 electron
    module.exports = electron;
  } else {
    // main：用 shim（npm 包遮蔽了真实 API）
    module.exports = {
      app: {
        isPackaged: false,
        getPath: () => process.cwd(),
        setAppUserModelId: () => {},
        getVersion: () => '0.0.0',
        getName: () => 'Hermes',
        name: 'Hermes',
        whenReady: () => Promise.resolve(),
        on: () => {},
        quit: () => {},
      },
      shell: { openExternal: () => Promise.resolve() },
      BrowserWindow: class {
        constructor() { this.webContents = { send: () => {}, on: () => {}, setWindowOpenHandler: () => {}, toggleDevTools: () => {} }; }
        loadURL() { return Promise.resolve(); }
        loadFile() { return Promise.resolve(); }
        setFullScreen() {}
        isFullScreen() { return false; }
        on() { return this; }
        getAllWindows() { return []; }
        static getAllWindows() { return []; }
      },
      ipcMain: { handle: () => {}, on: () => {}, removeListener: () => {}, removeAllListeners: () => {} },
      Menu: { buildFromTemplate: () => ({ popup: () => {} }), setApplicationMenu: () => {} },
      Notification: class { constructor() { this.on = () => {}; } show() {} },
      dialog: { showMessageBox: () => Promise.resolve({ response: 0 }) },
    };
    setInterval(() => {}, 60000);
  }
} else {
  // Node.js 构建环境：返回空对象避免崩溃
  module.exports = {};
}
