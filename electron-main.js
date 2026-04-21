require("dotenv").config();

const path = require("path");
const {app, BrowserWindow, ipcMain} = require("electron");
const {startServer, stopServer} = require("./index");

const WINDOW_WIDTH = Math.max(960, Number(process.env.ELECTRON_WINDOW_WIDTH || 1440) || 1440);
const WINDOW_HEIGHT = Math.max(640, Number(process.env.ELECTRON_WINDOW_HEIGHT || 960) || 960);
const WINDOW_MIN_WIDTH = Math.max(800, Number(process.env.ELECTRON_MIN_WIDTH || 1024) || 1024);
const WINDOW_MIN_HEIGHT = Math.max(600, Number(process.env.ELECTRON_MIN_HEIGHT || 720) || 720);
const AUTO_OPEN_DEVTOOLS = process.env.ELECTRON_OPEN_DEVTOOLS === "true";
const START_MAXIMIZED = process.env.ELECTRON_START_MAXIMIZED === "true";

let mainWindow = null;

function installDevToolsShortcuts(window) {
    if (!window || window.isDestroyed()) return;
    window.webContents.on("before-input-event", (event, input) => {
        if (input.type !== "keyDown") return;
        const key = String(input.key || "").toLowerCase();
        const isToggleCombo = key === "f12"
            || (key === "i" && ((input.control && input.shift) || input.meta));
        if (!isToggleCombo) return;
        event.preventDefault();
        window.webContents.toggleDevTools();
    });
}

function createMainWindow(targetUrl) {
    const iconPath = path.join(__dirname, "public", "favicon.ico");
    mainWindow = new BrowserWindow({
        width: WINDOW_WIDTH,
        height: WINDOW_HEIGHT,
        minWidth: WINDOW_MIN_WIDTH,
        minHeight: WINDOW_MIN_HEIGHT,
        autoHideMenuBar: true,
        icon: iconPath,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    installDevToolsShortcuts(mainWindow);

    mainWindow.once("ready-to-show", () => {
        if (!mainWindow) return;
        if (START_MAXIMIZED) {
            mainWindow.maximize();
        }
        mainWindow.show();
        if (AUTO_OPEN_DEVTOOLS) {
            mainWindow.webContents.openDevTools({mode: "detach"});
        }
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    return mainWindow.loadURL(targetUrl).catch((err) => {
        const isRedirectAbort = err?.code === "ERR_ABORTED" || err?.errno === -3;
        if (!isRedirectAbort) {
            throw err;
        }
        const currentUrl = mainWindow?.webContents?.getURL?.() || "";
        if (currentUrl && currentUrl !== targetUrl) {
            return;
        }
        throw err;
    });
}

ipcMain.handle("standard:set-kiosk-mode", (_, enabled) => {
    const window = BrowserWindow.getFocusedWindow() || mainWindow;
    if (!window || window.isDestroyed()) return false;
    const kioskEnabled = enabled === true;
    window.setKiosk(kioskEnabled);
    window.setFullScreen(kioskEnabled);
    return true;
});

async function bootstrapDesktopApp() {
    const preferredUrl = (process.env.ELECTRON_START_URL || "").trim();
    const runtime = preferredUrl ? {url: preferredUrl} : await startServer();
    await createMainWindow(runtime.url);
}

app.whenReady()
    .then(bootstrapDesktopApp)
    .catch((err) => {
        console.error("Failed to start Electron app:", err);
        app.exit(1);
    });

app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length > 0) return;
    const targetUrl = (process.env.ELECTRON_START_URL || "").trim();
    if (targetUrl) {
        await createMainWindow(targetUrl);
        return;
    }
    const runtime = await startServer();
    await createMainWindow(runtime.url);
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("before-quit", () => {
    stopServer().catch((err) => {
        console.error("Failed to stop server during Electron shutdown:", err);
    });
});
