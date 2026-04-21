let modular = {
    windowFocusSetup: false,
    highestZ: 1000,
    minimized: 0,
    lastPointerPosition: null,
    lastClickPosition: null,
    widgetDockPosition: "bottom-right",
    titleMessageRestoreTimer: null,
    titleMessageOriginal: null,
    widgets: [],
    working_directory: "Documents",
    colors: [
        {name: "Pure Blood", color: "#F71735", secondary: "#AF1807"},
        {name: "Scarlet", color: "#FE0000", secondary: "#E21807"},
        {name: "Red", color: "#E21807", secondary: "#AF1807"},
        {name: "Brick", color: "#A01823", secondary: "#B11B27"},
        {name: "Burnt Orange", color: "#F2542D", secondary: "#F26D2D"},
        {name: "Bright Orange", color: "#FF4523", secondary: "#bb3216"},
        {name: "Orange", color: "#F28123", secondary: "#F48A23"},
        {name: "Yellow", color: "#FFD23F", secondary: "#FFE13F"},
        {name: "Warm Yellow", color: "#FFC13D", secondary: "#F7C04A"},
        {name: "Mustard", color: "#EFCA08", secondary: "#d7b607"},
        {name: "Fungi", color: "#38A169", secondary: "#2FAE69"},
        {name: "Chill", color: "#138A36", secondary: "#039419"},
        {name: "Nice Green", color: "#1EB533", secondary: "#1ED02B"},
        {name: "Sea Green", color: "#00A6A6", secondary: "#028181"},
        {name: "Baby Azul", color: "#00A7E1", secondary: "#00A7FF"},
        {name: "Blue Green", color: "#07A0C3", secondary: "#0583c5"},
        {name: "Standard Blue", color: "#0c92c2", secondary: "#0583c5"},
        {name: "Sapphire Blue", color: "#1C6E8C", secondary: "#1C83A4"},
        {name: "Purple Blue", color: "#345995", secondary: "#4271be"},
        {name: "Facebook Blue", color: "#0066F1", secondary: "#1977F1"},
        {name: "Hard Blue", color: "#0000FF", secondary: "#002BFF"},
        {name: "Night Blue", color: "#011470", secondary: "#001587"},
        {name: "Pink", color: "#EE4266", secondary: "#EE5D98"},
        {name: "Coral", color: "#FF6663", secondary: "#FD8684"},
        {name: "Barbie Pink", color: "#D72483", secondary: "#EE3483"},
        {name: "Magenta", color: "#CB429F", secondary: "#E64EAA"},
        {name: "Ruby", color: "#D81E5B", secondary: "#E64B7A"},
        {name: "Light Plum", color: "#9448BC", secondary: "#B630DB"},
        {name: "Purple", color: "#5F0A87", secondary: "#6E2EA0"},
        {name: "Midnight", color: "#0d0564", secondary: "#120a7e"},
        {name: "Black", color: "#000000", secondary: "#323232"},
        {name: "Black", color: "#272727", secondary: "#353535"},
        {name: "Coffee", color: "#653837", secondary: "#6F4824"},
        {name: "Dark Slate", color: "#28464B", secondary: "#28464B"},
        {name: "Concrete", color: "#728095", secondary: "#7F8C9A"},
        {name: "Off", color: "#ededed", secondary: "#d1d1d1"},
        {name: "Normal", color: "#fff", secondary: "#EEEEEE"},
        {name: "Dark Gray", color: "darkgray", secondary: "#d3d3d3"},
    ],
    icons: {
        save: `<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><style>.s0 { fill: #000000 }</style><path class="s0" d="m16.59 10q-0.02 0-0.04 0-0.02 0-0.04 0.01-0.02 0-0.04 0-0.03 0-0.05 0.01h-2.14c-2.35 0-4.28 1.96-4.28 4.34v19.74c0 2.38 1.93 4.34 4.28 4.34h1.36q0.05 0.01 0.1 0.01 0.04 0 0.09 0 0.05 0 0.1 0 0.04 0 0.09-0.01h15.96q0.04 0.01 0.09 0.01 0.05 0 0.09 0 0.05 0 0.1 0 0.05 0 0.09-0.01h1.37c2.35 0 4.28-1.96 4.28-4.34v-16.58q0-0.13-0.03-0.25-0.02-0.12-0.07-0.24-0.05-0.11-0.13-0.21-0.07-0.1-0.16-0.19l-7-6.31q-0.08-0.08-0.17-0.13-0.09-0.06-0.19-0.1-0.1-0.03-0.21-0.05-0.1-0.02-0.21-0.02h-0.58q-0.05-0.01-0.1-0.01-0.04-0.01-0.09-0.01-0.05 0-0.1 0.01-0.04 0-0.09 0.01h-12.07q-0.02-0.01-0.05-0.01-0.03 0-0.05-0.01-0.03 0-0.05 0-0.03 0-0.06 0zm-2.31 2.39h1.16v4.34c0 1.51 1.24 2.76 2.73 2.76h9.33c1.49 0 2.72-1.25 2.72-2.76v-3.59l5.45 4.91v16.05c0 1.1-0.86 1.97-1.95 1.97h-0.39v-9.08c0-1.51-1.23-2.76-2.72-2.76h-13.22c-1.49 0-2.72 1.25-2.72 2.76v9.08h-0.39c-1.09 0-1.95-0.87-1.95-1.97v-19.74c0-1.1 0.86-1.97 1.95-1.97zm3.5 0h10.11v4.34c0 0.23-0.16 0.39-0.39 0.39h-9.33c-0.23 0-0.39-0.16-0.39-0.39zm-0.39 14.21h13.22c0.23 0 0.39 0.16 0.39 0.39v9.08h-14v-9.08c0-0.23 0.16-0.39 0.39-0.39z"/></svg>`,
        delete: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.35" stroke="currentColor"><g transform="scale(0.9) translate(1.333 1.333)"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 6.75h15 M6.375 6.75l1.05 12.075A2.25 2.25 0 0 0 9.669 21h4.662a2.25 2.25 0 0 0 2.244-2.175L17.625 6.75 M9 6.75V4.875A1.125 1.125 0 0 1 10.125 3.75h3.75A1.125 1.125 0 0 1 15 4.875V6.75" /></g></svg>`
    },
    resolveLegacyServiceRoute: (sId, index = 0) => {
        if (sId !== "com.standard.editor") return {serviceId: sId, portalIndex: index ?? 0};
        const portalIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
        const byPortalIndex = {
            0: "com.standard.editor.text",
            1: "com.standard.editor.text",
            2: "com.standard.editor.sheet",
            3: "com.standard.editor.slides",
            4: "com.standard.editor.code",
            5: "com.standard.editor.code",
        };
        return {serviceId: byPortalIndex[portalIndex] || "com.standard.editor.text", portalIndex: 0};
    },
    findPortalWindow: (serviceId, portalIndex = 0) => {
        const normalizedPortalIndex = Number.isFinite(Number(portalIndex)) ? Number(portalIndex) : 0;
        return [...Array.from(document.querySelectorAll(".draggable-window"))].reverse().find((windowNode) => windowNode?.portal?.serviceId?.() === serviceId && windowNode?.portal?.portalIndex?.() === normalizedPortalIndex) || null;
    },
    ensurePortalFront: (serviceId, portalIndex = 0) => {
        if (typeof modular?.bringToFront !== "function") return;
        const windowNode = modular.findPortalWindow(serviceId, portalIndex);
        if (windowNode) modular.bringToFront(windowNode);
    },
    start: (sId, options = {}) => {
        const route = modular.resolveLegacyServiceRoute(sId, options?.portalIndex ?? 0);
        const targetServiceId = route?.serviceId || sId;
        const targetPortalIndex = Number.isFinite(Number(route?.portalIndex)) ? Number(route.portalIndex) : 0;
        if (sId !== null) {
            for (let i = 0; i < modular.running.length; i++) {
                const ls = modular.running[i];
                if (ls.is(targetServiceId)) {
                    const portalInstance = ls.start(targetPortalIndex, {newInstance: false, ...(options || {})});
                    modular.ensurePortalFront(targetServiceId, targetPortalIndex);
                    return portalInstance;
                }
            }
        } else {
            console.error("modular.start() expects argument as Service ID. None provided");
        }
    },
    show: (sId, index, options = {}) => {
        const route = modular.resolveLegacyServiceRoute(sId, index);
        const targetServiceId = route?.serviceId || sId;
        const targetPortalIndex = Number.isFinite(Number(route?.portalIndex)) ? Number(route.portalIndex) : 0;
        if (sId !== null) {
            for (let i = 0; i < modular.running.length; i++) {
                const ls = modular.running[i];
                if (ls.is(targetServiceId)) {
                    const portalInstance = ls.start(targetPortalIndex, {newInstance: true, ...(options || {})});
                    modular.ensurePortalFront(targetServiceId, targetPortalIndex);
                    return portalInstance;
                }
            }
        } else {
            console.error("modular.start() expects argument as Service ID. None provided");
        }
    },
    register: (service) => {
        if (!this.windowFocusSetup) {
            this.windowFocusSetup = true;
            document.addEventListener("pointermove", (event) => {
                if (event.pointerType === "mouse") modular.lastPointerPosition = {x: event.clientX, y: event.clientY};
            });
            document.addEventListener("mousedown", (event) => {
                modular.lastClickPosition = {x: event.clientX, y: event.clientY};
                const windowDiv = event.target.closest(".draggable-window");
                if (windowDiv) modular.bringToFront(windowDiv);
            });
            document.addEventListener("touchstart", (event) => {
                const touch = event.touches?.[0];
                if (touch) modular.lastClickPosition = {x: touch.clientX, y: touch.clientY};
            }, {passive: true});
        }
        if (service instanceof Service) {
            if (modular.running === undefined) modular.running = [];
            modular.running.push(service);
            modular.renderInterfaceShortcuts();
            return service;
        }
    },
    preferredPortalCenterPoint: () => {
        const isTouchDisplay = (navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || ("ontouchstart" in window);
        const isMobileViewport = window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
        if (isTouchDisplay || isMobileViewport) return modular.lastClickPosition;
        return modular.lastPointerPosition || modular.lastClickPosition;
    },
    registerWidget: (widget) => {
        if (widget instanceof Widget) {
            if (!Array.isArray(modular.widgets)) modular.widgets = [];
            modular.widgets.push(widget);
            return widget;
        }
    },

    renderInterfaceShortcuts: () => {
        const container = document.getElementById("interface-shortcuts");
        if (!container) return;
        const services = (modular.running || []).map(service => service?.interfaceShortcut?.()).filter(shortcut => shortcut?.serviceId && shortcut?.icon);
        container.innerHTML = "";
        services.forEach(shortcut => {
            const icon = document.createElement("div");
            icon.className = "interface-icon inline segue";
            icon.title = shortcut.title || shortcut.serviceId;
            icon.setAttribute("service", shortcut.serviceId);
            if (typeof shortcut.action === "function") icon._launchAction = shortcut.action;
            const iconMarkup = shortcut.icon || "";
            if (iconMarkup.trim().startsWith("<svg")) {
                const parsed = new DOMParser().parseFromString(iconMarkup, "image/svg+xml").documentElement;
                parsed.setAttribute("aria-hidden", "true");
                icon.appendChild(parsed);
            } else {
                const img = document.createElement("img");
                img.src = iconMarkup;
                img.alt = shortcut.title || shortcut.serviceId;
                icon.appendChild(img);
            }
            container.appendChild(icon);
        });
    },
    refreshPortalIcons: () => {
        document.querySelectorAll(".draggable-window").forEach((windowNode) => {
            windowNode?.portal?.refreshIcon?.();
        });
    },
    refresh: (sId) => {
        if (sId !== null) {
            for (let i = 0; i < modular.running.length; i++) {
                const ls = modular.running[i];
                if (ls.is(sId)) {
                    ls.refresh();
                }
            }
        } else {
            console.error("modular.refresh() expects argument as Service ID. None provided");
        }
    },
    hide: (sId) => {
        if (sId !== null) {
            for (let i = 0; i < modular.running.length; i++) {
                const ls = modular.running[i];
                if (ls.is(sId)) {
                    ls.hide();
                }
            }
        } else {
            console.error("modular.hide() expects argument as Service ID. None provided");
        }
    },
    showWidget: (wId, index = 0) => {
        if (!wId) return;
        (modular.widgets || []).forEach(widget => {
            if (widget?.is?.(wId) && widget.index() === (index ?? 0)) {
                widget.show();
            }
        });
    },
    hideWidget: (wId) => {
        if (!wId) return;
        (modular.widgets || []).forEach(widget => {
            if (widget?.is?.(wId)) {
                widget.hide();
            }
        });
    },
    exit: (sId) => {
        if (sId !== null) {
            modular.running = (modular.running || []).filter(ls => {
                if (ls.is(sId)) {
                    ls.exit();
                    return false;
                }
                return true;
            });
        } else {
            console.error("modular.exit() expects argument as Service ID. None provided");
        }
    },
    get: (query) => {
        const s = query.split("=");
        if (s.length % 2 === 0) {
        } else {
            console.error("Invalid argument at modular.get(). Expects argument as 'property=value'")
        }
    },
    user: {
        readCookie: (name) => {
            const escaped = String(name || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
            if (!match) return null;
            try {
                return decodeURIComponent(match[1]);
            } catch (_) {
                return match[1];
            }
        },
        normalizeRecord: (payload) => {
            if (!payload) return null;
            let record = null;
            if (Array.isArray(payload)) record = payload[0] || null;
            else if (Array.isArray(payload.user)) record = payload.user[0] || null;
            else if (payload.user && typeof payload.user === "object") record = payload.user;
            else if (typeof payload === "object" && !Array.isArray(payload)) record = payload;
            if (!record || typeof record !== "object" || Array.isArray(record)) return null;
            const normalized = {...record};
            if ((normalized.settings === undefined || normalized.settings === null || normalized.settings === "") && normalized.theme !== undefined) {
                normalized.settings = normalized.theme;
            }
            if ((normalized.theme === undefined || normalized.theme === null || normalized.theme === "") && normalized.settings !== undefined) {
                normalized.theme = normalized.settings;
            }
            return normalized;
        },
        hasUsableSettings: (userRecord) => {
            return Boolean(modular.user.parseSettings(userRecord?.settings) || modular.user.parseSettings(userRecord?.theme));
        },
        readCachedUserRecord: () => modular.user.normalizeRecord(window.__stdUserRecordCache || null),
        cacheUserRecord: (userRecord) => {
            const normalizedRecord = modular.user.normalizeRecord(userRecord);
            if (!normalizedRecord) return;
            window.__stdUserRecordCache = normalizedRecord;
        },
        parseSettings: (value) => {
            let candidate = value;
            for (let attempt = 0; attempt < 3; attempt += 1) {
                if (!candidate) return null;
                if (typeof candidate === "object" && !Array.isArray(candidate)) return candidate;
                if (typeof candidate !== "string") return null;
                const trimmed = candidate.trim();
                if (!trimmed) return null;
                try {
                    candidate = JSON.parse(trimmed);
                    continue;
                } catch (_) {
                }
                try {
                    candidate = JSON.parse(trimmed.replace(/\\"/g, "\"").replace(/\\\\/g, "\\"));
                    continue;
                } catch (_) {
                }
                if ((trimmed.startsWith("{\\\"") || trimmed.includes("\\\"")) && trimmed.endsWith("}")) {
                    try {
                        candidate = JSON.parse(trimmed.replace(/\\"/g, "\"").replace(/\\\\/g, "\\"));
                        continue;
                    } catch (_) {
                    }
                }
                return null;
            }
            return (candidate && typeof candidate === "object" && !Array.isArray(candidate)) ? candidate : null;
        },
        id: () => {
            const userId = modular.user.readCookie("uid");
            if (userId) return userId;
        },
        fetchThemePayload: async () => {
            const res = await fetch("/api/user/theme", {credentials: "same-origin", cache: "no-store"});
            if (!res.ok) {
                console.error("Failed to fetch /api/user/theme:", res.status);
                return null;
            }
            return await res.json();
        },
        data: async () => {
            const cachedRecord = modular.user.readCachedUserRecord();
            if (cachedRecord && typeof cachedRecord === "object" && modular.user.hasUsableSettings(cachedRecord)) {
                return cachedRecord;
            }
            const themePayload = await modular.user.fetchThemePayload();
            const themedUserRecord = modular.user.normalizeRecord(themePayload?.user || themePayload);
            if (themedUserRecord && typeof themedUserRecord === "object") {
                modular.user.cacheUserRecord(themedUserRecord);
                return themedUserRecord;
            }
            const res = await fetch("/api/user", {credentials: "same-origin", cache: "no-store"});
            if (!res.ok) {
                console.error("Failed to fetch /api/user:", res.status);
                return null;
            }
            const userRecord = modular.user.normalizeRecord(await res.json());
            if (userRecord && typeof userRecord === "object" && modular.user.hasUsableSettings(userRecord)) {
                modular.user.cacheUserRecord(userRecord);
            }
            return userRecord;
        },
        theme: async () => {
            const cachedRecord = modular.user.readCachedUserRecord();
            const cachedSettings = modular.user.parseSettings(cachedRecord?.settings) || modular.user.parseSettings(cachedRecord?.theme);
            if (cachedSettings && typeof cachedSettings === "object") {
                return cachedSettings;
            }
            const themePayload = await modular.user.fetchThemePayload();
            const payloadTheme = modular.user.parseSettings(themePayload?.theme);
            const themedUserRecord = modular.user.normalizeRecord(themePayload?.user || themePayload);
            if (themedUserRecord && typeof themedUserRecord === "object") {
                modular.user.cacheUserRecord(themedUserRecord);
            }
            if (payloadTheme && typeof payloadTheme === "object") {
                return payloadTheme;
            }
            const userRecord = await modular.user.data();
            const parsedSettings = modular.user.parseSettings(userRecord?.settings) || modular.user.parseSettings(userRecord?.theme);
            if (parsedSettings && typeof parsedSettings === "object") {
                modular.user.cacheUserRecord(userRecord);
                return parsedSettings;
            }
            return null;
        }
    },
    putPublicValue(sId, key, value) {
    },
    publicValue(sId, key) {
    },
    setWidgetDockPosition: (position, options = {}) => {
        const allowed = ["top-left", "top-right", "bottom-left", "bottom-right"];
        if (!allowed.includes(position)) return modular.widgetDockPosition;
        modular.widgetDockPosition = position;
        if (!options.skipPersist && typeof windowStateManager?.saveState === "function") {
            windowStateManager.saveState("__widget-config__", 0, {dockPosition: position, type: "widget-config", open: false}, "widget-config");
        }
        modular.dockWidgets();
        return modular.widgetDockPosition;
    },
    dockWidgets: (position) => {
        const allowed = ["top-left", "top-right", "bottom-left", "bottom-right"];
        const chosenPosition = allowed.includes(position) ? position : modular.widgetDockPosition;
        modular.widgetDockPosition = chosenPosition;
        const widgets = (modular.widgets || []).filter(widget => widget?.isOpen?.());
        if (!widgets.length) return;
        const margin = 12;
        const fromRight = chosenPosition.includes("right");
        const fromBottom = chosenPosition.includes("bottom");
        let cursorY = fromBottom ? window.innerHeight - margin : margin;
        widgets.forEach(widget => {
            const {width, height} = widget.getDimensions();
            const left = fromRight ? Math.max(margin, window.innerWidth - width - margin) : margin;
            const top = fromBottom ? Math.max(margin, cursorY - height) : cursorY;
            widget.setPosition(left, top, chosenPosition);
            cursorY = fromBottom ? top - margin : cursorY + height + margin;
        });
    },
    announce: (type, message) => {
        const text = `${message ?? ""}`.trim();
        pushMessage(type, message);
        if (!text || typeof document === "undefined") return;
        if (modular.titleMessageOriginal === null) {
            modular.titleMessageOriginal = document.title;
        }
        document.title = text;
        if (modular.titleMessageRestoreTimer) {
            clearTimeout(modular.titleMessageRestoreTimer);
        }
        modular.titleMessageRestoreTimer = setTimeout(() => {
            if (modular.titleMessageOriginal !== null) {
                document.title = modular.titleMessageOriginal;
            }
            modular.titleMessageOriginal = null;
            modular.titleMessageRestoreTimer = null;
        }, 15000);
    },
    error: m => modular.announce("error", m),
    success: m => modular.announce("success", m),
    message: m => pushMessage("", m),
    bringToFront: (element) => {
        if (!element) return;
        document.querySelectorAll('.draggable-window.window-focused').forEach(windowDiv => {
            if (windowDiv !== element) {
                windowDiv.classList.remove('window-focused');
            }
        });
        element.classList.add('window-focused');
        modular.highestZ += 1;
        element.style.zIndex = `${modular.highestZ}`;
    }
}
if (typeof window !== "undefined") {
    window.addEventListener("resize", () => modular.dockWidgets());
}
document.addEventListener("click", (event) => {
    const trigger = event.target.closest(".segue[service]");
    if (!trigger) return;
    if (typeof trigger._launchAction === "function") {
        trigger._launchAction();
        return;
    }
    modular.show(trigger.getAttribute("service"), 0);
});

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => modular.renderInterfaceShortcuts());
} else {
    modular.renderInterfaceShortcuts();
}
