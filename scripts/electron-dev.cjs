// Launcher for electron-vite dev: patches electron module resolution
// Fixes Electron 39 + pnpm issue where require('electron') returns binary path

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Find the real electron binary
const electronPkg = require.resolve('electron/package.json');
const electronDir = path.dirname(electronPkg);
const pathFile = path.join(electronDir, 'path.txt');
const executable = path.join(electronDir, 'dist', fs.readFileSync(pathFile, 'utf-8').trim());

// Build environment: exclude node_modules/electron from PATH resolution
const modulePath = path.join(__dirname, '..');
const filteredNpmPath = (process.env.NODE_PATH || '')
  .split(path.delimiter)
  .filter(p => !p.includes(path.sep + 'electron' + path.sep))
  .concat(path.join(modulePath, 'node_modules'))
  .filter(Boolean)
  .join(path.delimiter);

const env = {
  ...process.env,
  NODE_PATH: filteredNpmPath,
  NODE_OPTIONS: '', // Clear any suspect options
};

// Pass through to electron-vite dev
const args = process.argv.slice(2);
if (args.length === 0) {
  args.push('dev');
}

const child = spawn('npx', ['electron-vite', ...args], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env,
});

child.on('close', (code) => {
  process.exit(code);
});
