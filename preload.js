const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("StandardElectron", {
    setKioskMode: (enabled) => ipcRenderer.invoke("standard:set-kiosk-mode", enabled === true)
});
