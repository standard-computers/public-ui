const {contextBridge, ipcRenderer} = require("electron");

contextBridge.exposeInMainWorld("StandardElectron", {
    setKioskMode: (enabled) => ipcRenderer.invoke("standard:set-kiosk-mode", enabled === true),
    setFocusedService: (serviceId) => ipcRenderer.send("standard:focused-service", String(serviceId || "")),
    onArticleLinkShortcut: (callback) => {
        if (typeof callback !== "function") return () => {};
        const handler = () => callback();
        ipcRenderer.on("standard:article-link-shortcut", handler);
        return () => ipcRenderer.removeListener("standard:article-link-shortcut", handler);
    }
});
