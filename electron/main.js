const { app, BrowserWindow, shell, session, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer } = require('./server');

function getIconPath() {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'icon.ico'),
        path.join(process.resourcesPath, 'ALED.jpg')
      ]
    : [
        path.join(__dirname, '..', 'build', 'icon.ico'),
        path.join(__dirname, '..', 'ALED.jpg')
      ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function getPaths() {
  const staticRoot = app.isPackaged ? app.getAppPath() : path.join(__dirname, '..');
  // Packaged: keep aled_data.json + data/ next to the .exe (portable folder). Dev: project root.
  const dataRoot = app.isPackaged ? path.dirname(app.getPath('exe')) : path.join(__dirname, '..');
  return { staticRoot, dataRoot };
}

function ensureDataLayout(staticRoot, dataRoot) {
  fs.mkdirSync(path.join(dataRoot, 'data'), { recursive: true });
  const quotesSrc = path.join(staticRoot, 'data', 'quotes.js');
  const quotesDest = path.join(dataRoot, 'data', 'quotes.js');
  if (fs.existsSync(quotesSrc) && !fs.existsSync(quotesDest)) {
    fs.copyFileSync(quotesSrc, quotesDest);
  }
}

let mainWindow;
let serverPort;

function createWindow(port) {
  const icon = getIconPath();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    ...(icon ? { icon } : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.loadURL(`http://127.0.0.1:${port}/`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      const childIcon = getIconPath();
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          ...(childIcon ? { icon: childIcon } : {}),
          webPreferences: { nodeIntegration: false, contextIsolation: true }
        }
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Default Electron menu (File / Edit / …) looks like a dev shell; hide it on Windows/Linux.
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  }

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'fullscreen') {
      return true;
    }
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'fullscreen');
  });

  const { staticRoot, dataRoot } = getPaths();
  ensureDataLayout(staticRoot, dataRoot);
  serverPort = await startServer({ dataRoot, staticRoot });
  createWindow(serverPort);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(serverPort);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
