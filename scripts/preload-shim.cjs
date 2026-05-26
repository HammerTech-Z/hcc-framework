// Preload: 直接从 Electron ASAR 加载真实 contextBridge/ipcRenderer
let electron;
try {
  const path = require('path');
  // 找 electron.asar 路径
  const electronModule = require.resolve('electron');
  const asarPath = electronModule.replace('index.js', 'electron.asar');
  electron = require(asarPath);
  if (!electron || !electron.contextBridge) electron = null;
} catch (e) { electron = null; }

// fallback: 返回带 contextBridge 的 fake 对象
if (!electron) {
  electron = {
    contextBridge: { exposeInMainWorld: (n, o) => { globalThis[n] = o; } },
    ipcRenderer: { invoke: () => Promise.resolve(), on: () => () => {}, removeListener: () => {} },
  };
}

module.exports = electron;
