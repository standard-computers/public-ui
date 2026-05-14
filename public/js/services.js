const standardUIPrefersSvgIcons = () => window.StandardUI?.prefersSvgIcons?.() !== false;
const getPortalDisplayIcon = (portal = {}) => {
    if (standardUIPrefersSvgIcons()) {
        return portal.svg_icon || portal.icon || "";
    }
    return portal.icon || portal.svg_icon || "";
};
const buildPortalIconElement = (iconMarkup = "", title = "", accent = "") => {
    if (typeof iconMarkup !== "string" || iconMarkup.trim() === "") return null;
    const trimmedIcon = iconMarkup.trim();
    let iconElement;
    if (trimmedIcon.startsWith("https") || trimmedIcon.startsWith("/")) {
        iconElement = document.createElement("img");
        iconElement.src = trimmedIcon;
        iconElement.alt = title;
    } else {
        const parser = new DOMParser();
        const doc = parser.parseFromString(trimmedIcon, "image/svg+xml");
        iconElement = doc.documentElement;
        if (accent && iconElement instanceof SVGElement) {
            iconElement.style.stroke = accent;
        }
    }
    iconElement.classList.add("window-icon");
    return iconElement;
};
const windowStateManager = (() => {
    let stateByKey = {};
    let hasExistingFile = false;
    let loadPromise = null;
    let saveQueue = Promise.resolve();
    let restoreAttempted = false;
    let restoreAttempts = 0;
    let relayModeState = null;
    const buildKey = (serviceId, portalIndex = 0, type = "service", instanceId = "default") => `${type || "service"}::${serviceId || "unknown"}::${portalIndex}::${instanceId || "default"}`;
    const readCookie = (name = "") => {
        const escaped = String(name || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
        if (!match) return null;
        try {
            return decodeURIComponent(match[1]);
        } catch (_) {
            return match[1];
        }
    };
    const sanitizeRecordId = (value = "") => `${value || ""}`.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    const resolveUserRecordId = async () => {
        const cachedUserRecord = typeof modular?.user?.readCachedUserRecord === "function"
            ? modular.user.readCachedUserRecord()
            : null;
        const cachedRecordId = sanitizeRecordId(cachedUserRecord?.id);
        if (cachedRecordId) return cachedRecordId;
        const userRecord = typeof modular?.user?.data === "function"
            ? await modular.user.data()
            : null;
        return sanitizeRecordId(userRecord?.id);
    };
    const getCliClient = () => (typeof window !== "undefined" && window.CLI && typeof window.CLI.send === "function") ? window.CLI : null;
    const waitForCliClient = async (timeoutMs = 5000, intervalMs = 50) => {
        const startedAt = Date.now();
        while ((Date.now() - startedAt) <= timeoutMs) {
            const cliClient = getCliClient();
            if (cliClient) return cliClient;
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        return null;
    };
    const sendStateCommand = async (query, parseJson = true) => {
        if (!query || typeof query !== "string") {
            throw new Error("State command must be a non-empty string");
        }
        const response = await fetch(`/api/cli?_=${Date.now()}`, {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            },
            body: JSON.stringify({query})
        });
        const responseText = await response.text().catch(() => "");
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}${responseText ? ` - ${responseText.slice(0, 200)}` : ""}`);
        }
        if (!parseJson) return responseText;
        const normalizedText = responseText.replace(/^\uFEFF/, "").trim();
        if (!normalizedText) return "";
        try {
            return JSON.parse(normalizedText);
        } catch (_) {
            return responseText;
        }
    };
    const isRelayMode = async () => {
        if (relayModeState !== null) return relayModeState;
        try {
            const response = await fetch("/api/client-context", {
                credentials: "same-origin",
                cache: "no-store"
            });
            if (!response.ok) {
                relayModeState = false;
                return relayModeState;
            }
            const payload = await response.json();
            relayModeState = payload?.isRelayMode === true;
            return relayModeState;
        } catch (_) {
            relayModeState = false;
            return relayModeState;
        }
    };
    const isBadConnectionPayload = (payload) => {
        if (typeof payload !== "string") return false;
        const normalized = payload.trim();
        const upper = normalized.toUpperCase();
        return upper.includes("BAD CONNECTION") || upper.includes("CLIENT CLOSE ERROR") || normalized.includes("/bad-connection") || normalized.startsWith("<!DOCTYPE html>");
    };
    const normalizeStateRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const serializeStateRecord = (value) => JSON.stringify(JSON.stringify(normalizeStateRecord(value)));
    const buildFetchCommand = (userRecordId) => `[cache] <user "${userRecordId}", key "interface-windows">`;
    const buildCreateCommand = (userRecordId, value) => `[cache] + (@${userRecordId}, "interface-windows", ${serializeStateRecord(value)})`;
    const buildUpdateCommand = (userRecordId, value) => `[cache] value ${serializeStateRecord(value)} <user @${userRecordId}, key "interface-windows">`;
    const extractCacheRecord = (payload) => {
        if (!payload) return null;
        if (Array.isArray(payload)) return payload[0] || null;
        if (Array.isArray(payload.cache)) return payload.cache[0] || null;
        if (payload.cache && typeof payload.cache === "object") return payload.cache;
        if (typeof payload === "object" && !Array.isArray(payload)) return payload;
        return null;
    };
    const parseLookupResponse = (payload) => {
        if (payload === 0 || payload === "0" || payload === "" || payload === null || payload === undefined) {
            return {exists: false, value: null};
        }
        if (typeof payload === "string") {
            const trimmed = payload.trim();
            if (!trimmed || trimmed === "0") return {exists: false, value: null};
            try {
                return parseLookupResponse(JSON.parse(trimmed));
            } catch (_) {
                return {exists: true, value: trimmed};
            }
        }
        const record = extractCacheRecord(payload);
        if (!record) return {exists: false, value: null};
        return {exists: true, value: record.value ?? record.VL ?? record.vl ?? null};
    };
    const parseStateValue = (value) => {
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
            return null;
        }
        return (candidate && typeof candidate === "object" && !Array.isArray(candidate)) ? candidate : null;
    };
    const fetchStoredState = async () => {
        const userRecordId = await resolveUserRecordId();
        const cliClient = await waitForCliClient();
        if (!userRecordId || !cliClient) return {exists: false, state: {}};
        const payload = await sendStateCommand(buildFetchCommand(userRecordId), true);
        if (isBadConnectionPayload(payload)) {
            return {exists: false, state: {}, deferred: true};
        }
        const lookup = parseLookupResponse(payload);
        return {
            exists: lookup.exists,
            state: parseStateValue(lookup.value) || {}
        };
    };
    const saveStoredState = async (nextState) => {
        const userRecordId = await resolveUserRecordId();
        const cliClient = await waitForCliClient();
        if (!userRecordId || !cliClient) return false;
        const normalizedState = normalizeStateRecord(nextState);
        const lookupPayload = await sendStateCommand(buildFetchCommand(userRecordId), true);
        if (isBadConnectionPayload(lookupPayload)) {
            return false;
        }
        const lookup = parseLookupResponse(lookupPayload);
        const command = lookup.exists
            ? buildUpdateCommand(userRecordId, normalizedState)
            : buildCreateCommand(userRecordId, normalizedState);
        await sendStateCommand(command, false);
        hasExistingFile = true;
        return true;
    };
    const ensureLoaded = async () => {
        if (!loadPromise) {
            loadPromise = (async () => {
                try {
                    const {exists, state} = await fetchStoredState();
                    stateByKey = normalizeStateRecord(state);
                    hasExistingFile = exists;
                    Object.entries({...stateByKey}).forEach(([key, value]) => {
                        const segments = key.split("::");
                        if (segments.length === 2) {
                            const newKey = buildKey(segments[0], Number.parseInt(segments[1]) || 0, value?.type || "service", value?.instanceId || "default");
                            if (!stateByKey[newKey]) stateByKey[newKey] = {...value, type: value?.type || "service", instanceId: value?.instanceId || "default"};
                            delete stateByKey[key];
                        } else if (segments.length === 3) {
                            const newKey = buildKey(segments[1], Number.parseInt(segments[2]) || 0, segments[0] || value?.type || "service", value?.instanceId || "default");
                            if (!stateByKey[newKey]) stateByKey[newKey] = {...value, type: segments[0] || value?.type || "service", instanceId: value?.instanceId || "default"};
                            delete stateByKey[key];
                        }
                    });
                } catch (err) {
                    console.error("Failed to load interface window state", err);
                }
                return stateByKey;
            })();
        }
        return loadPromise;
    };
    const persistNow = () => {
        saveQueue = saveQueue
            .catch(() => null)
            .then(async () => {
                await ensureLoaded();
                const saved = await saveStoredState(stateByKey);
                if (!saved) {
                    console.error("Failed to save interface window state");
                }
            })
            .catch((err) => {
                console.error("Failed to persist interface window state", err);
            });
        return saveQueue;
    };
    const waitForServicesReady = async (timeout = 5000) => new Promise(resolve => {
        const start = Date.now();
        const check = () => {
            if (Array.isArray(modular?.running) && modular.running.length) return resolve(true);
            if (Date.now() - start > timeout) return resolve(false);
            setTimeout(check, 100);
        };
        check();
    });
    const sanitizeState = (value) => {
        if (value === undefined) return {};
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return {};
        }
    };
    return {
        ensureLoaded,
        sanitizeState,
        getState(serviceId, portalIndex = 0, type = "service", instanceId = "default") {
            const key = buildKey(serviceId, portalIndex, type, instanceId);
            const existing = stateByKey[key];
            if (!existing && type === "service") {
                const legacyKey = `${serviceId || "unknown"}::${portalIndex}`;
                return stateByKey[legacyKey];
            }
            return existing;
        }, saveState(serviceId, portalIndex, snapshot, type = "service", instanceId = "default") {
            if (!serviceId || !snapshot) return;
            ensureLoaded().then(() => {
                const resolvedInstanceId = instanceId || snapshot?.instanceId || "default";
                const key = buildKey(serviceId, portalIndex, snapshot?.type || type, resolvedInstanceId);
                stateByKey[key] = {
                    ...snapshot,
                    serviceId: serviceId ?? snapshot?.serviceId ?? snapshot?.widgetId,
                    portalIndex: portalIndex ?? snapshot?.portalIndex ?? snapshot?.widgetIndex ?? 0,
                    type: snapshot?.type || type,
                    instanceId: resolvedInstanceId
                };
                persistNow();
            });
        }, async applyToPortal(portalInstance) {
            await ensureLoaded();
            const existing = this.getState(portalInstance.serviceId(), portalInstance.portalIndex(), "service", portalInstance.instanceId?.() || "default");
            if (existing) {
                portalInstance.applyWindowState(existing);
            }
        }, async applyToWidget(widgetInstance) {
            await ensureLoaded();
            const existing = this.getState(widgetInstance.id(), widgetInstance.index(), "widget");
            if (existing) {
                widgetInstance.applyWindowState(existing);
            }
        }, async restoreOpenWindows() {
            if (await isRelayMode()) {
                const cliClient = await waitForCliClient(5000, 100);
                if (!cliClient) {
                    restoreAttempted = false;
                    if (restoreAttempts < 5) {
                        setTimeout(() => this.restoreOpenWindows(), 500);
                    }
                    return;
                }
            }
            if (restoreAttempted) return;
            restoreAttempted = true;
            restoreAttempts += 1;
            await ensureLoaded();
            const ready = await waitForServicesReady();
            if (!ready) {
                restoreAttempted = false;
                if (restoreAttempts < 5) {
                    setTimeout(() => this.restoreOpenWindows(), 500);
                }
                return;
            }
            const entries = Object.values(stateByKey || {});
            const dockConfig = entries.find(entry => entry?.type === "widget-config");
            if (dockConfig?.dockPosition && typeof modular?.setWidgetDockPosition === "function") {
                modular.setWidgetDockPosition(dockConfig.dockPosition, {skipPersist: true});
            }
            entries.filter(entry => entry?.open).forEach(entry => {
                if (entry?.type === "widget" && typeof modular?.showWidget === "function") {
                    modular.showWidget(entry.widgetId || entry.serviceId, entry.portalIndex || entry.widgetIndex || 0);
                } else if (typeof modular?.show === "function") {
                    const restoreAsNewInstance = `${entry?.instanceId || "default"}` !== "default";
                    modular.show(entry.serviceId, entry.portalIndex || 0, {
                        newInstance: restoreAsNewInstance,
                        restoreWindowContext: true,
                        instanceId: entry?.instanceId || "default"
                    });
                } else if (typeof modular?.start === "function") {
                    modular.start(entry.serviceId);
                }
            });
        }
    };
})();
const kickOffWindowRestore = () => {
    if (window.StandardServiceLoaderEnabled) return;
    windowStateManager.ensureLoaded().then(() => windowStateManager.restoreOpenWindows());
};
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', kickOffWindowRestore);
} else {
    kickOffWindowRestore();
}
window.StandardAppSettings = window.StandardAppSettings || (() => {
    const schemas = {};
    const loadedValues = {};
    const loadPromises = {};
    const saveQueues = {};
    const sanitizeRecordId = (value = "") => `${value || ""}`.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    const cacheKeyFor = (serviceId = "") => `settings:${serviceId}`;
    const normalizeSchema = (settings = {}) => {
        if (!settings || typeof settings !== "object" || Array.isArray(settings)) return {};
        return Object.fromEntries(Object.entries(settings).filter(([, setting]) => {
            return setting && typeof setting === "object" && !Array.isArray(setting);
        }).map(([name, setting]) => {
            const type = `${setting.type || "text"}`.trim().toLowerCase() || "text";
            return [name, {
                label: `${setting.label || name}`,
                type,
                default: setting.default,
                restrictions: setting.restrictions
            }];
        }));
    };
    const restrictionValues = (setting = {}) => {
        if (`${setting?.type || ""}`.toLowerCase() === "boolean") return [];
        if (Array.isArray(setting?.restrictions)) return setting.restrictions.map(value => `${value}`).filter(value => value !== "");
        return `${setting?.restrictions || ""}`.split(",").map(value => value.trim()).filter(Boolean);
    };
    const normalizeValue = (setting = {}, value) => {
        const type = `${setting?.type || "text"}`.toLowerCase();
        if (type === "boolean") {
            if (value === true || value === "true" || value === 1 || value === "1") return true;
            return false;
        }
        const restrictions = restrictionValues(setting);
        let normalized = value ?? setting?.default ?? "";
        if (type === "number") {
            const parsed = Number.parseFloat(normalized);
            normalized = Number.isFinite(parsed) ? parsed : 0;
        } else {
            normalized = `${normalized ?? ""}`;
        }
        if (restrictions.length) {
            const match = restrictions.find(option => `${option}` === `${normalized}`);
            return match ?? restrictions[0];
        }
        return normalized;
    };
    const defaultValuesFor = (serviceId = "") => {
        const schema = schemas[serviceId] || {};
        return Object.fromEntries(Object.entries(schema).map(([name, setting]) => [name, normalizeValue(setting, setting.default)]));
    };
    const extractCacheRecord = (payload) => {
        if (!payload) return null;
        if (Array.isArray(payload)) return payload[0] || null;
        if (Array.isArray(payload.cache)) return payload.cache[0] || null;
        if (payload.cache && typeof payload.cache === "object") return payload.cache;
        if (typeof payload === "object" && !Array.isArray(payload)) return payload;
        return null;
    };
    const parseLookupResponse = (payload) => {
        if (payload === 0 || payload === "0" || payload === "" || payload === null || payload === undefined) {
            return {exists: false, value: null, recordId: ""};
        }
        if (typeof payload === "string") {
            const trimmed = payload.trim();
            if (!trimmed || trimmed === "0") return {exists: false, value: null, recordId: ""};
            try {
                return parseLookupResponse(JSON.parse(trimmed));
            } catch (_) {
                return {exists: true, value: trimmed, recordId: ""};
            }
        }
        const record = extractCacheRecord(payload);
        if (!record) return {exists: false, value: null, recordId: ""};
        return {
            exists: true,
            value: record.value ?? record.VL ?? record.vl ?? null,
            recordId: sanitizeRecordId(record.id || record.ID || "")
        };
    };
    const parseSettingsValue = (value) => {
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
            return null;
        }
        return (candidate && typeof candidate === "object" && !Array.isArray(candidate)) ? candidate : null;
    };
    const normalizeValuesFor = (serviceId = "", values = {}) => {
        const schema = schemas[serviceId] || {};
        const defaults = defaultValuesFor(serviceId);
        return Object.fromEntries(Object.entries(schema).map(([name, setting]) => {
            const source = values && Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaults[name];
            return [name, normalizeValue(setting, source)];
        }));
    };
    const serializeSettingsValues = (value) => JSON.stringify(JSON.stringify(value && typeof value === "object" && !Array.isArray(value) ? value : {}));
    const resolveUserRecordId = async () => {
        const cachedUserRecord = typeof modular?.user?.readCachedUserRecord === "function"
            ? modular.user.readCachedUserRecord()
            : null;
        const cachedRecordId = sanitizeRecordId(cachedUserRecord?.id);
        if (cachedRecordId) return cachedRecordId;
        const userRecord = typeof modular?.user?.data === "function" ? await modular.user.data() : null;
        return sanitizeRecordId(userRecord?.id);
    };
    const sendCommand = async (query, parseJson = true) => {
        if (typeof window.CLI?.send === "function") return window.CLI.send(query, parseJson);
        const response = await fetch(`/api/cli?_=${Date.now()}`, {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: {"Content-Type": "application/json", "Cache-Control": "no-cache, no-store, must-revalidate"},
            body: JSON.stringify({query})
        });
        const text = await response.text().catch(() => "");
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
        if (!parseJson) return text;
        try {
            return JSON.parse(text.replace(/^\uFEFF/, "").trim());
        } catch (_) {
            return text;
        }
    };
    const fetchCommandFor = (userRecordId, serviceId) => `[cache] <user "${userRecordId}", key "${cacheKeyFor(serviceId)}">`;
    const createCommandFor = (userRecordId, serviceId, values) => `[cache] + (@${userRecordId}, "${cacheKeyFor(serviceId)}", ${serializeSettingsValues(values)})`;
    const updateCommandFor = (userRecordId, serviceId, values, recordId = "") => {
        const filter = recordId ? `id "${recordId}"` : `user @${userRecordId}, key "${cacheKeyFor(serviceId)}"`;
        return `[cache] value ${serializeSettingsValues(values)} <${filter}>`;
    };
    const load = async (serviceId = "", {force = false} = {}) => {
        if (!serviceId) return {};
        if (loadedValues[serviceId] && !force) return {...loadedValues[serviceId]};
        if (!loadPromises[serviceId] || force) {
            loadPromises[serviceId] = (async () => {
                const defaults = defaultValuesFor(serviceId);
                try {
                    const userRecordId = await resolveUserRecordId();
                    if (!userRecordId) {
                        loadedValues[serviceId] = defaults;
                        return loadedValues[serviceId];
                    }
                    const payload = await sendCommand(fetchCommandFor(userRecordId, serviceId), true);
                    const lookup = parseLookupResponse(payload);
                    loadedValues[serviceId] = normalizeValuesFor(serviceId, lookup.exists ? parseSettingsValue(lookup.value) : defaults);
                } catch (error) {
                    console.error(`Failed to load settings for ${serviceId}`, error);
                    loadedValues[serviceId] = defaults;
                }
                return loadedValues[serviceId];
            })();
        }
        return {...(await loadPromises[serviceId])};
    };
    const save = async (serviceId = "", nextValues = {}) => {
        if (!serviceId) return false;
        const values = normalizeValuesFor(serviceId, nextValues);
        saveQueues[serviceId] = (saveQueues[serviceId] || Promise.resolve()).catch(() => null).then(async () => {
            const userRecordId = await resolveUserRecordId();
            if (!userRecordId) return false;
            const payload = await sendCommand(fetchCommandFor(userRecordId, serviceId), true);
            const lookup = parseLookupResponse(payload);
            const command = lookup.exists
                ? updateCommandFor(userRecordId, serviceId, values, lookup.recordId)
                : createCommandFor(userRecordId, serviceId, values);
            await sendCommand(command, false);
            loadedValues[serviceId] = values;
            loadPromises[serviceId] = Promise.resolve(values);
            document.dispatchEvent(new CustomEvent("standard-app-settings-saved", {detail: {serviceId, values}}));
            return true;
        }).catch((error) => {
            console.error(`Failed to save settings for ${serviceId}`, error);
            return false;
        });
        return saveQueues[serviceId];
    };
    const reset = async (serviceId = "") => {
        if (!serviceId) return false;
        try {
            const userRecordId = await resolveUserRecordId();
            if (!userRecordId) return false;
            const payload = await sendCommand(fetchCommandFor(userRecordId, serviceId), true);
            const lookup = parseLookupResponse(payload);
            if (lookup.exists && lookup.recordId) {
                await sendCommand(`[cache] - <id "${lookup.recordId}">`, false);
            }
            const defaults = defaultValuesFor(serviceId);
            loadedValues[serviceId] = defaults;
            loadPromises[serviceId] = Promise.resolve(defaults);
            document.dispatchEvent(new CustomEvent("standard-app-settings-reset", {detail: {serviceId, values: defaults}}));
            return true;
        } catch (error) {
            console.error(`Failed to reset settings for ${serviceId}`, error);
            return false;
        }
    };
    return {
        register(serviceId = "", settings = {}) {
            if (!serviceId) return {};
            schemas[serviceId] = normalizeSchema(settings);
            delete loadedValues[serviceId];
            delete loadPromises[serviceId];
            return {...schemas[serviceId]};
        },
        schema: (serviceId = "") => ({...(schemas[serviceId] || {})}),
        hasSettings: (serviceId = "") => Object.keys(schemas[serviceId] || {}).length > 0,
        defaults: (serviceId = "") => defaultValuesFor(serviceId),
        values: load,
        save,
        reset,
        cacheKeyFor,
        restrictionValues
    };
})();
class Service {
    #service;
    #portals = [];
    #memory = [];
    #portalStructs = [];
    #settings = {};
    #instanceCounter = 0;
    constructor(service, portals, settings = {}) {
        this.#service = service;
        this.#portals = [];
        this.#settings = window.StandardAppSettings?.register?.(service, settings) || {};
        this.#portalStructs = portals.map((p, index) => {
            if (typeof p.setContext === "function") {
                p.setContext(service, index);
            }
            const exported = {...p.exportStruct(), serviceId: service, portalIndex: index};
            if (typeof p.close === "function") {
                p.close();
            }
            return exported;
        });
    }
    name() {
        return this.#service;
    }
    exit() {
        this.#portals.forEach(p => p.close());
        this.#portals = [];
    }
    is(sid) {
        return this.#service === sid;
    }
    show() {
        return this.start(0, {newInstance: false});
    }
    start(index = 0, options = {}) {
        const requestedIndex = Number.isInteger(index) ? index : 0;
        const portalTemplate = this.#portalStructs?.[requestedIndex];
        if (!portalTemplate) return null;
        const shouldCreateNew = options?.newInstance === true;
        const restoreWindowContext = options?.restoreWindowContext ?? !shouldCreateNew;
        let portalInstance = null;
        if (!shouldCreateNew) {
            portalInstance = [...this.#portals].reverse().find(portal => portal?.portalIndex?.() === requestedIndex) || null;
        }
        if (!portalInstance) {
            this.#instanceCounter += 1;
            const instanceId = options?.instanceId || (shouldCreateNew ? `${this.#service}-${requestedIndex}-${this.#instanceCounter}` : "default");
            portalInstance = new Portal({
                ...portalTemplate,
                serviceId: this.#service,
                portalIndex: requestedIndex,
                instanceId,
                restoreWindowContext,
                onCloseInstance: (closingPortal) => {
                    this.#portals = this.#portals.filter(portal => portal !== closingPortal);
                }
            });
            this.#portals.push(portalInstance);
        }
        portalInstance.show();
        return portalInstance;
    }
    refresh() {
        this.#portals.forEach(p => p.refresh());
    }
    settings() {
        return {...this.#settings};
    }
    hide() {
        this.#portals.forEach(p => p.hide());
    }
    interfaceShortcut() {
        const portal = this.#portalStructs?.[0] || {};
        if (portal.internal === true) {
            return null;
        }
        return {
            serviceId: this.#service,
            title: portal.title || this.#service,
            action: typeof portal.action === "function" ? portal.action : null,
            icon: getPortalDisplayIcon(portal),
            svg_icon: portal.svg_icon || "",
            image_icon: portal.icon || ""
        };
    }
    searchablePortals() {
        return (this.#portalStructs || []).map((portal, portalIndex) => ({
            serviceId: this.#service,
            portalIndex,
            title: portal?.title || this.#service,
            hints: Array.isArray(portal?.hints) ? portal.hints : [],
            icon: portal?.icon || "",
            svg_icon: portal?.svg_icon || ""
        }));
    }
}
class Portal {
    #struct;
    #container;
    #windowDiv;
    #windowBody;
    #titleElement;
    #initialRender;
    #savedWindowState;
    #isMaximized = false;
    #preMinimizeState;
    #activeRoute;
    #minimizeButton;
    #maximizeMenuItem;
    #pinMenuItem;
    #pinIcon;
    #unpinIcon;
    #dragState;
    #isPinned = false;
    #afterRenderScheduled = false;
    #resizeObserver = null;
    #lastObservedWindowSize = null;
    #serviceId;
    #portalIndex = 0;
    #instanceId = "default";
    #restoreWindowContext = true;
    #onCloseInstance;
    #hasExplicitPosition = false;
    #windowContext = {};
    #headerElement;
    #iconElement;
    constructor(data) {
        this.#struct = data;
        this.#serviceId = data?.serviceId;
        this.#portalIndex = data?.portalIndex ?? 0;
        this.#instanceId = data?.instanceId || "default";
        this.#restoreWindowContext = data?.restoreWindowContext !== false;
        this.#onCloseInstance = typeof data?.onCloseInstance === "function" ? data.onCloseInstance : null;
        this.#container = document.body;
        this.#build();
    }
    setContext(serviceId, portalIndex = 0) {
        this.#serviceId = serviceId;
        this.#portalIndex = portalIndex;
        this.#struct = {...this.#struct, serviceId, portalIndex};
    }
    serviceId() {
        return this.#serviceId;
    }
    portalIndex() {
        return this.#portalIndex;
    }
    instanceId() {
        return this.#instanceId;
    }
    #windowIconMenuItems() {
        return [{
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>`,
            label: "Refresh",
            action: () => this.refresh()
        }, {
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`,
            label: "Settings",
            action: () => {
                if (typeof window.StandardInternals?.openAppSettings === "function") {
                    window.StandardInternals.openAppSettings(this.#serviceId, {
                        title: this.title(),
                        sourcePortalIndex: this.#portalIndex,
                        sourceInstanceId: this.#instanceId
                    });
                } else {
                    modular?.error?.("Settings viewer is not ready yet");
                }
            }
        }];
    }
    #updateWindowIcon(accent = "") {
        if (!this.#headerElement) return;
        this.#iconElement?.remove?.();
        this.#iconElement = null;
        const nextIcon = buildPortalIconElement(getPortalDisplayIcon(this.#struct), this.title(), accent);
        if (!nextIcon) return;
        nextIcon.popoutmenu(this.#windowIconMenuItems());
        this.#headerElement.insertBefore(nextIcon, this.#titleElement || null);
        this.#iconElement = nextIcon;
    }
    refreshIcon() {
        this.#updateWindowIcon(this.#struct?.accent);
    }
    #isResizable() {
        return !(this.#struct?.resizable === false || this.#struct?.resizable === "false");
    }
    #isMaximizeEnforced() {
        return this.#struct?.maximized === true || this.#struct?.maximized === "true";
    }
    setTitle(title = "") {
        this.#struct = {...this.#struct, title};
        if (this.#titleElement) this.#titleElement.textContent = title;
    }
    title() {
        return this.#struct?.title || "";
    }
    window() {
        return this.#windowDiv;
    }
    body() {
        return this.#windowBody;
    }
    windowState() {
        return {...this.#windowContext};
    }
    setWindowState(nextState = {}, options = {}) {
        const {persist = true, merge = true} = options;
        const safeState = windowStateManager?.sanitizeState?.(nextState ?? {}) ?? {};
        this.#windowContext = merge ? {...this.#windowContext, ...safeState} : safeState;
        if (persist) this.#persistWindowState();
        return this.windowState();
    }
    setWindowDirective(directive, options = {}) {
        return this.setWindowState({directive: directive ?? ""}, options);
    }

    #createRouteContext() {
        const serviceId = this.#serviceId;
        const cache = window.StandardBrowserCache?.createAdapter?.(serviceId) || {
            get: async () => null,
            create: async () => null,
            set: async () => null,
            delete: async () => false,
            list: async () => []
        };
        return {
            portal: this,
            window: this.#windowDiv,
            body: this.#windowBody,
            struct: this.#struct,
            serviceId,
            cache,
            settings: {
                schema: () => window.StandardAppSettings?.schema?.(serviceId) || {},
                defaults: () => window.StandardAppSettings?.defaults?.(serviceId) || {},
                values: (options = {}) => window.StandardAppSettings?.values?.(serviceId, options) || Promise.resolve({}),
                save: (values = {}) => window.StandardAppSettings?.save?.(serviceId, values) || Promise.resolve(false),
                reset: () => window.StandardAppSettings?.reset?.(serviceId) || Promise.resolve(false)
            },
            windowState: {
                get: () => this.windowState(),
                set: (nextState = {}, options = {}) => this.setWindowState(nextState, options),
                setDirective: (directive, options = {}) => this.setWindowDirective(directive, options)
            },
            refresh: () => this.refresh(),
            rerenderRoute: () => this.refresh(),
            render: (content, afterRender) => this.#renderRouteContent(content, afterRender ?? this.#activeRoute?.afterRender)
        };
    }
    #syncWindowBodySize(minBodyHeight = 150) {
        if (!this.#windowDiv || !this.#windowBody) return;
        const bodyStyles = window.getComputedStyle(this.#windowBody);
        const contentContainer = this.#windowBody.parentElement;
        const containerStyles = contentContainer ? window.getComputedStyle(contentContainer) : null;
        const bodyTopOffset = this.#windowBody.offsetTop;
        const containerBottomExtras = containerStyles
            ? this.#readPixelValue(containerStyles.marginBottom)
                + this.#readPixelValue(containerStyles.paddingBottom)
                + this.#readPixelValue(containerStyles.borderBottomWidth)
            : 0;
        const rawBodyHeight = Math.max(this.#windowDiv.clientHeight - bodyTopOffset - containerBottomExtras, minBodyHeight);
        const isBorderBox = bodyStyles.boxSizing === "border-box";
        const verticalPadding = this.#readPixelValue(bodyStyles.paddingTop) + this.#readPixelValue(bodyStyles.paddingBottom) + this.#readPixelValue(bodyStyles.borderTopWidth) + this.#readPixelValue(bodyStyles.borderBottomWidth);
        const resolvedBodyHeight = isBorderBox ? rawBodyHeight : Math.max(rawBodyHeight - verticalPadding, minBodyHeight);
        this.#windowBody.style.width = "100%";
        this.#windowBody.style.maxWidth = "100%";
        this.#windowBody.style.minWidth = "0";
        this.#windowBody.style.minHeight = `${resolvedBodyHeight}px`;
        this.#windowBody.style.maxHeight = `${resolvedBodyHeight}px`;
        this.#windowBody.style.height = `${resolvedBodyHeight}px`;
    }
    #readPixelValue(value) {
        const parsed = Number.parseFloat(value ?? "0");
        return Number.isFinite(parsed) ? parsed : 0;
    }
    #contentBoxWidth(element) {
        if (!(element instanceof HTMLElement)) return 0;
        const computed = window.getComputedStyle(element);
        const horizontalPadding = this.#readPixelValue(computed.paddingLeft) + this.#readPixelValue(computed.paddingRight);
        return Math.max(element.clientWidth - horizontalPadding, 0);
    }
    #shouldNormalizeDescendants(root) {
        if (!(root instanceof HTMLElement) || !(this.#windowBody instanceof HTMLElement)) return false;
        if (!(root === this.#windowBody || this.#windowBody.contains(root))) return false;
        return this.#windowBody.parentElement?.classList?.contains("window-content-barred") === true;
    }
    #syncDescendantDimensions(root, availableWidth = this.#contentBoxWidth(root)) {
        if (!root || !this.#shouldNormalizeDescendants(root)) return;
        const excludedTags = new Set(['IMG', 'SVG', 'PATH', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'LABEL', 'SPAN', 'A', 'CANVAS']);
        Array.from(root.children || []).forEach((child) => {
            if (!(child instanceof HTMLElement)) return;
            if (!excludedTags.has(child.tagName)) {
                child.style.minWidth = "0";
                child.style.maxWidth = "100%";
            }
            this.#syncDescendantDimensions(child, availableWidth);
        });
    }
    #syncPortalLayout(minBodyHeight = 150) {
        this.#syncWindowBodySize(minBodyHeight);
        this.#syncDescendantDimensions(this.#windowBody);
    }
    #runAfterRender() {
        if (typeof this.#activeRoute?.afterRender === "function") {
            const routeContext = this.#createRouteContext();
            this.#activeRoute.afterRender.call(routeContext, this.#windowDiv, routeContext);
        }
    }
    #installResizeObserver() {
        if (this.#resizeObserver || typeof ResizeObserver === "undefined" || !this.#windowDiv) return;
        this.#resizeObserver = new ResizeObserver((entries) => {
            const entry = entries?.[0];
            if (!entry || !this.#windowDiv?.isConnected) return;
            const width = Math.round(entry.contentRect?.width || this.#windowDiv.clientWidth || 0);
            const height = Math.round(entry.contentRect?.height || this.#windowDiv.clientHeight || 0);
            const previous = this.#lastObservedWindowSize;
            if (previous && previous.width === width && previous.height === height) return;
            this.#lastObservedWindowSize = {width, height};
            this.#syncPortalLayout(150);
            this.#scheduleAfterRender();
        });
        this.#resizeObserver.observe(this.#windowDiv);
    }
    #ensureWindowFrameHeight(targetBodyHeight) {
        if (!this.#windowDiv || !this.#windowBody) return;
        const parsedBodyHeight = Number.parseFloat(String(targetBodyHeight ?? this.#windowBody.style.height ?? ""));
        const desiredBodyHeight = Number.isFinite(parsedBodyHeight) && parsedBodyHeight > 0 ? parsedBodyHeight : null;
        if (!desiredBodyHeight) return;
        const contentContainer = this.#windowBody.parentElement;
        const containerStyles = contentContainer ? window.getComputedStyle(contentContainer) : null;
        const bodyTopOffset = this.#windowBody.offsetTop;
        const containerBottomExtras = containerStyles
            ? this.#readPixelValue(containerStyles.marginBottom)
                + this.#readPixelValue(containerStyles.paddingBottom)
                + this.#readPixelValue(containerStyles.borderBottomWidth)
            : 0;
        const frameHeight = Math.ceil(desiredBodyHeight + bodyTopOffset + containerBottomExtras);
        if (frameHeight <= 0) return;
        this.#windowDiv.style.height = `${frameHeight}px`;
        this.#lastObservedWindowSize = {
            width: Math.round(this.#windowDiv.getBoundingClientRect().width || this.#windowDiv.clientWidth || 0),
            height: frameHeight
        };
        this.#syncPortalLayout(150);
    }
    #applyWindowLayout(layout = {}, options = {}) {
        if (!this.#windowDiv) return;
        const {minBodyHeight = 150, syncLayout = true} = options;
        const {width, height, left, top, transform, overflow, transition, bodyHeight} = layout || {};
        if (width !== undefined) this.#windowDiv.style.width = width;
        if (height !== undefined) this.#windowDiv.style.height = height;
        if (left !== undefined) this.#windowDiv.style.left = left;
        if (top !== undefined) this.#windowDiv.style.top = top;
        if (transform !== undefined) this.#windowDiv.style.transform = transform;
        if (overflow !== undefined) this.#windowDiv.style.overflow = overflow;
        if (transition !== undefined) this.#windowDiv.style.transition = transition;
        if (bodyHeight !== undefined && this.#windowBody) {
            this.#windowBody.style.minHeight = bodyHeight;
            this.#windowBody.style.maxHeight = bodyHeight;
            this.#windowBody.style.height = bodyHeight;
        }
        if (syncLayout) this.#syncPortalLayout(minBodyHeight);
    }
    #build() {
        const {
            title, dimensions, accent, background, foreground, icon, actionable, navigation, routes, route, tools
        } = this.#struct;
        const isResizable = this.#isResizable();
        //CREATE WINDOW
        this.#windowDiv = document.createElement('div');
        this.#windowDiv.style.width = `${dimensions[0]}px`
        this.#windowDiv.style.backdropFilter = "blur(10px)"
        this.#windowDiv.classList.add('draggable-window');
        //CREATE TOP BAR WITH BUTTONS AND TITLE
        const navigationBar = document.createElement('div');
        if (this.#struct.horizontal_nav) {
            navigationBar.className = 'window-topbar';
        } else {
            navigationBar.className = 'window-sidebar';
        }
        if (this.#struct.centered_nav) navigationBar.classList.add('centered-nav');
        const header = document.createElement('div');
        header.className = 'window-header';
        this.#headerElement = header;
        const titleElement = document.createElement("div");
        titleElement.className = 'title';
        titleElement.textContent = title;
        this.#titleElement = titleElement;
        if (accent) titleElement.style.color = accent;
        header.appendChild(titleElement);
        this.#updateWindowIcon(accent);
        if (Array.isArray(tools)) {
            tools.forEach(tool => {
                if (!tool || typeof tool !== "object") return;
                const toolButton = document.createElement("div");
                toolButton.classList.add('closer');
                toolButton.title = tool.title || "";
                toolButton.setAttribute("aria-label", tool.title || "Portal tool");
                toolButton.dataset.portalToolTitle = `${tool.title || ""}`.trim().toLowerCase();
                if (typeof tool.icon === "string" && tool.icon.trim() !== "") {
                    const toolIcon = new DOMParser().parseFromString(tool.icon, "image/svg+xml").documentElement;
                    if (accent) toolIcon.style.stroke = accent;
                    toolButton.appendChild(toolIcon);
                }
                toolButton.addEventListener("click", (event) => {
                    event.stopPropagation();
                    if (typeof tool.onclick === "function") {
                        tool.onclick(event, this.#createRouteContext());
                    }
                });
                header.prepend(toolButton);
            });
        }
        if (actionable !== false && isResizable) {
            this.#minimizeButton = document.createElement("div");
            this.#minimizeButton.classList.add('closer', 'minimize-button')
            const minimizeIcon = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><circle cx="12" cy="12" r="6.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`, "image/svg+xml").documentElement;
            if (accent) minimizeIcon.style.stroke = accent;
            this.#minimizeButton.appendChild(minimizeIcon);
            header.prepend(this.#minimizeButton);
            this.#pinIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 16v5M8 5.292c0-.271 0-.407.013-.52a2 2 0 0 1 1.758-1.759c.114-.013.25-.013.52-.013h3.417c.271 0 .407 0 .52.013a2 2 0 0 1 1.759 1.758c.013.114.013.25.013.52c0 .088 0 .131-.003.172a1 1 0 0 1-.48.774c-.034.021-.073.04-.15.08l-.262.13c-.403.202-.605.303-.737.459a1 1 0 0 0-.216.442c-.042.2.002.422.09.864L15 12h.333c.62 0 .93 0 1.185.068a2 2 0 0 1 1.414 1.414c.068.255.068.565.068 1.185c0 .31 0 .465-.034.592a1 1 0 0 1-.707.707c-.127.034-.282.034-.592.034H7.333c-.31 0-.465 0-.592-.034a1 1 0 0 1-.707-.707C6 15.132 6 14.977 6 14.667c0-.62 0-.93.068-1.185a2 2 0 0 1 1.414-1.414C7.737 12 8.047 12 8.667 12H9l.758-3.788c.088-.442.132-.663.09-.864a1 1 0 0 0-.216-.442c-.132-.156-.334-.257-.737-.459l-.262-.13a2 2 0 0 1-.15-.08a1 1 0 0 1-.48-.774C8 5.423 8 5.379 8 5.292"/></svg>`;
            this.#unpinIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m3 21l5-5m5.259 2.871c-3.744-.85-7.28-4.386-8.13-8.13c-.135-.592-.202-.888-.007-1.369c.194-.48.433-.63.909-.927c1.076-.672 2.242-.886 3.451-.78c1.697.151 2.546.226 2.97.005c.423-.22.71-.736 1.286-1.767l.728-1.307c.48-.86.72-1.291 1.285-1.494s.905-.08 1.585.166a5.63 5.63 0 0 1 3.396 3.396c.246.68.369 1.02.166 1.585c-.203.564-.633.804-1.494 1.285l-1.337.745c-1.03.574-1.544.862-1.765 1.289c-.22.428-.14 1.258.02 2.918c.118 1.22-.085 2.394-.766 3.484c-.298.476-.447.714-.928.909c-.48.194-.777.127-1.37-.008" color="currentColor"/></svg>`;
            this.#pinMenuItem = {
                label: this.#isPinned ? 'Unpin' : 'Pin',
                icon: this.#isPinned ? this.#unpinIcon : this.#pinIcon,
                action: () => this.#togglePinned()
            };
            this.#maximizeMenuItem = {
                label: 'Maximize',
                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 17L17 7M17 7H8M17 7V16" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
                action: () => this.#toggleMaximize(),
            };
            this.#minimizeButton.popoutmenu([this.#maximizeMenuItem, {
                label: 'Tile Left',
                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 5.5H18M6 18.5H18M6 5.5V18.5M12 5.5V18.5" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
                action: () => this.tile("left"),
            }, {
                label: 'Tile Right',
                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 5.5H18M6 18.5H18M18 5.5V18.5M12 5.5V18.5" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
                action: () => this.tile("right"),
            }, {
                label: 'Tile Top',
                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 6H18.5M5.5 12H18.5M5.5 6V18M18.5 6V18" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
                action: () => this.tile("top"),
            }, {
                label: 'Tile Bottom',
                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.5 12H18.5M5.5 18H18.5M5.5 6V18M18.5 6V18" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
                action: () => this.tile("bottom"),
            }, {
                label: 'Minimize',
                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 7L7 17M7 17H17M7 17V7" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
                action: () => this.minimize(),
            }, this.#pinMenuItem]);
            this.#minimizeButton.addEventListener("dblclick", (event) => {
                event.stopPropagation();
                this.#toggleMaximize();
            });
        }
        const exiter = document.createElement("div");
        exiter.classList.add('closer')
        exiter.addEventListener("click", () => this.close());
        const closeIcon = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`, "image/svg+xml").documentElement;
        if (accent) closeIcon.style.stroke = accent;
        exiter.appendChild(closeIcon);
        header.prepend(exiter);
        const content = document.createElement('div');
        content.className = (route || this.#struct.horizontal_nav || (routes && routes.length <= 1) ? 'window-content' : 'window-content-barred');
        if (this.#struct.empty === true && content.classList.contains('window-content')) {
            content.style.padding = '0 !important';
        }
        const windowBody = document.createElement('div');
        windowBody.className = 'window-body';
        windowBody.style.minHeight = `${dimensions[1]}px`;
        windowBody.style.maxHeight = `${dimensions[1]}px`;
        windowBody.style.height = `${dimensions[1]}px`;
        this.#windowBody = windowBody;
        const setActiveRoute = (routeContent, afterRender) => {
            this.#activeRoute = {route: routeContent, afterRender};
            this.#renderRouteContent(routeContent, afterRender);
        };
        if (routes && routes.length > 1 || navigation === true) {
            routes.forEach(navItem => {
                const navElement = document.createElement('div');
                navElement.className = 'sidebar-item';
                if (navItem.primary_action && navItem.primary_action === true) {
                    navElement.classList.add('primary-action');
                }
                if (navItem.icon !== undefined && navItem.icon.startsWith("https")) {
                    const img = document.createElement('img');
                    img.src = navItem.icon;
                    img.alt = title;
                    img.className = 'sidebar-icon';
                    navElement.prepend(img);
                } else if (navItem.icon !== undefined && navItem.icon !== "") {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(navItem.icon, "image/svg+xml");
                    navElement.prepend(doc.documentElement);
                }
                const text = document.createElement('span');
                text.innerText = navItem.text;
                navElement.appendChild(text);
                navElement.addEventListener('click', () => {
                    document.querySelectorAll(".sidebar-item").forEach(v => v.classList.remove("active-route"));
                    navElement.classList.add("active-route");
                    const routeResolver = typeof navItem.route === "function" ? () => {
                        const routeContext = this.#createRouteContext();
                        return navItem.route.call(routeContext, this.#struct, routeContext);
                    } : () => navItem.route;
                    setActiveRoute(routeResolver, navItem.afterRender);
                });
                navigationBar.appendChild(navElement);
            });
            this.#initialRender = () => navigationBar.children[0].click();
            content.appendChild(navigationBar);
        } else {
            const routeResolver = typeof route === "function" ? () => {
                const routeContext = this.#createRouteContext();
                return route.call(routeContext, this.#struct, routeContext);
            } : () => route;
            this.#initialRender = () => setActiveRoute(routeResolver, this.#struct.afterRender);
        }
        this.#windowDiv.appendChild(header);
        content.appendChild(windowBody);
        this.#windowDiv.appendChild(content);
        this.#makeDraggable(this.#windowDiv, header);
        this.#windowDiv.portal = this;
        if (background !== undefined) {
            this.#windowDiv.style.background = background;
        }
        if (foreground !== undefined) {
            this.#windowDiv.style.color = foreground;
            titleElement.style.color = foreground;
            const svgs = this.#windowDiv.querySelectorAll('svg');
            svgs.forEach(svg => svg.fill = foreground);
        }
        if (isResizable) {
            const resizer = document.createElement('div');
            resizer.className = 'resizer';
            ['top', 'right', 'bottom', 'left', 'top-right', 'top-left', 'bottom-right', 'bottom-left'].forEach(position => {
                const handle = document.createElement('div');
                handle.className = `resize-handle ${position}`;
                resizer.appendChild(handle);
                const startResize = (e) => {
                    if (this.#isMaximizeEnforced()) return;
                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();
                    const getPoint = (event) => {
                        if (event.touches && event.touches.length > 0) {
                            return {x: event.touches[0].clientX, y: event.touches[0].clientY};
                        }
                        return {x: event.clientX, y: event.clientY};
                    };
                    const {x: startX, y: startY} = getPoint(e);
                    const startWidth = this.#windowDiv.offsetWidth;
                    const startHeight = this.#windowDiv.offsetHeight;
                    const startLeft = this.#windowDiv.offsetLeft;
                    const startTop = this.#windowDiv.offsetTop;
                    const onMove = (moveEvent) => {
                        if (moveEvent.cancelable) moveEvent.preventDefault();
                        const {x, y} = getPoint(moveEvent);
                        const dx = x - startX;
                        const dy = y - startY;
                        const nextLayout = {};
                        if (position.includes('right')) {
                            const newWidth = Math.max(startWidth + dx, 200);
                            nextLayout.width = `${newWidth}px`;
                        }
                        if (position.includes('bottom')) {
                            const newHeight = Math.max(startHeight + dy, 150);
                            nextLayout.height = `${newHeight}px`;
                        }
                        if (position.includes('left')) {
                            const newWidth = Math.max(startWidth - dx, 200);
                            nextLayout.width = `${newWidth}px`;
                            nextLayout.left = `${startLeft + dx}px`;
                        }
                        if (position.includes('top')) {
                            const newHeight = Math.max(startHeight - dy, 150);
                            nextLayout.height = `${newHeight}px`;
                            nextLayout.top = `${startTop + dy}px`;
                        }
                        this.#applyWindowLayout(nextLayout, {minBodyHeight: 150});
                    };
                    const endResize = () => {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('touchmove', onMove);
                        document.removeEventListener('mouseup', endResize);
                        document.removeEventListener('touchend', endResize);
                        document.removeEventListener('touchcancel', endResize);
                        this.#persistWindowState({open: true});
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('touchmove', onMove, {passive: false});
                    document.addEventListener('mouseup', endResize);
                    document.addEventListener('touchend', endResize);
                    document.addEventListener('touchcancel', endResize);
                };
                handle.addEventListener('mousedown', startResize);
                handle.addEventListener('touchstart', startResize, {passive: false});
            });
            this.#windowDiv.appendChild(resizer);
        }
    }
    render(content, afterRender) {
        this.#renderRouteContent(content, afterRender);
    }
    #makeDraggable(element, handle) {
        const dragState = {
            offsetX: 0, offsetY: 0, isDragging: false, disableSelection: (e) => {
                if (!(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                    e.preventDefault();
                }
            }
        };
        const getClientPosition = (event) => {
            if (event.touches && event.touches.length > 0) {
                return {x: event.touches[0].clientX, y: event.touches[0].clientY};
            }
            return {x: event.clientX, y: event.clientY};
        };
        const isInteractiveTarget = (target) => {
            return target?.closest('button, .closer, .resizer, [data-no-drag], a, input, textarea, select, option');
        };
        const startDrag = (e) => {
            if (this.#isPinned || this.#isMaximizeEnforced() || isInteractiveTarget(e.target)) return;
            const {x, y} = getClientPosition(e);
            dragState.offsetX = x - element.offsetLeft;
            dragState.offsetY = y - element.offsetTop;
            dragState.isDragging = true;
            handle.style.cursor = 'grabbing';
            document.addEventListener('selectstart', dragState.disableSelection);
            element.style.transition = 'transform 0.1s ease-in-out';
            element.style.transform = 'scale(0.98)';
            if (e.cancelable) e.preventDefault();
        };
        const moveDrag = (e) => {
            if (dragState.isDragging && !this.#isPinned) {
                const {x, y} = getClientPosition(e);
                element.style.left = `${x - dragState.offsetX}px`;
                element.style.top = `${y - dragState.offsetY}px`;
                if (e.cancelable) e.preventDefault();
            }
        };
        const endDrag = () => {
            if (dragState.isDragging) {
                dragState.isDragging = false;
                handle.style.cursor = this.#isPinned ? 'default' : 'grab';
                element.style.transition = 'transform 0.2s ease-in-out';
                element.style.transform = 'scale(1)';
                document.removeEventListener('selectstart', dragState.disableSelection);
                this.#persistWindowState({open: true});
            }
        };
        handle.addEventListener('mousedown', startDrag);
        handle.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('mousemove', moveDrag);
        document.addEventListener('touchmove', moveDrag, {passive: false});
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
        document.addEventListener('touchcancel', endDrag);
        handle.style.cursor = 'grab';
        this.#dragState = {
            element, handle, ...dragState, onMouseDown: startDrag, onMouseMove: moveDrag, onMouseUp: endDrag
        };
    }
    #togglePinned() {
        this.#setPinnedState(!this.#isPinned);
        if (!this.#dragState) return;
        this.#dragState.isDragging = false;
        this.#dragState.handle.style.cursor = this.#isPinned ? 'default' : 'grab';
        document.removeEventListener('selectstart', this.#dragState.disableSelection);
        this.#persistWindowState();
    }
    show() {
        if (!this.#windowDiv) {
            this.#build();
        }
        const wasAttached = !!this.#windowDiv?.parentElement;
        windowStateManager.applyToPortal(this);
        this.#container.appendChild(this.#windowDiv);
        this.#installResizeObserver();
        if (!wasAttached) this.#ensureWindowFrameHeight(this.#windowBody?.style?.height || this.#struct?.dimensions?.[1]);
        this.#applyCursorCenteredPlacement(wasAttached);
        if (this.#isMaximizeEnforced()) this.#maximizeWindow();
        if (typeof modular?.bringToFront === "function") {
            modular.bringToFront(this.#windowDiv);
        }
        if (!wasAttached) {
            if (this.#initialRender && this.#activeRoute === undefined) {
                requestAnimationFrame(() => this.#initialRender());
            } else if (this.#activeRoute !== undefined) {
                this.#renderRouteContent(this.#activeRoute.route(this.#struct, this.#windowDiv), this.#activeRoute.afterRender);
            }
        }
        this.#persistWindowState({open: true});
    }
    #applyCursorCenteredPlacement(wasAttached) {
        if (wasAttached || this.#hasExplicitPosition || !this.#windowDiv) return;
        const anchor = typeof modular?.preferredPortalCenterPoint === "function"
            ? modular.preferredPortalCenterPoint()
            : null;
        if (!anchor) return;
        const rect = this.#windowDiv.getBoundingClientRect();
        const width = rect.width || this.#windowDiv.offsetWidth;
        const height = rect.height || this.#windowDiv.offsetHeight;
        if (!width || !height) return;
        const margin = 8;
        const maxLeft = Math.max(margin, window.innerWidth - width - margin);
        const maxTop = Math.max(margin, window.innerHeight - height - margin);
        const centeredLeft = anchor.x - (width / 2);
        const centeredTop = anchor.y - (height / 2);
        const left = Math.min(Math.max(centeredLeft, margin), maxLeft);
        const top = Math.min(Math.max(centeredTop, margin), maxTop);
        this.#windowDiv.style.left = `${left}px`;
        this.#windowDiv.style.top = `${top}px`;
    }
    refresh() {
        if (!this.#windowDiv) {
            this.#build();
        }
        if (this.#activeRoute !== undefined) {
            // this.#renderRouteContent(this.#activeRoute.route(this.#struct, this.#windowDiv), this.#activeRoute.afterRender(this.#windowDiv));
            this.#renderRouteContent(this.#activeRoute.route(this.#struct, this.#windowDiv), this.#activeRoute.afterRender);
        } else if (this.#initialRender) {
            this.#initialRender();
        }
    }
    hide() {
        if (this.#windowDiv?.parentElement) {
            this.#persistWindowState({open: false});
            this.#windowDiv.remove();
            if (typeof this.#struct?.onDispose === "function") {
                this.#struct.onDispose();
            }
        }
    }
    minimize(positionOverride) {
        if (this.#windowDiv.classList.contains("minimized")) return;
        const rect = this.#windowDiv.getBoundingClientRect();
        this.#preMinimizeState = {
            left: this.#windowDiv.style.left || `${rect.left}px`,
            top: this.#windowDiv.style.top || `${rect.top}px`,
            transform: this.#windowDiv.style.transform || "scale(1)",
            overflow: this.#windowDiv.style.overflow || "visible",
        };
        const minimizedIndex = modular.minimized ?? 0;
        modular.minimized = minimizedIndex + 1;
        this.#applyWindowLayout({
            transition: "all 100ms",
            transform: "scale(0.3)",
            left: positionOverride?.left ?? "-150px",
            top: positionOverride?.top ?? `${100 * minimizedIndex}px`,
            overflow: "hidden",
        }, {syncLayout: false});
        this.#windowDiv.classList.add("minimized");
        this.#scheduleAfterRender();
        setTimeout(() => {
            const handleClick = _ => {
                this.restoreFromMinimize();
            };
            const handleMouseEnter = _ => {
                this.#windowDiv.style.transform = "scale(0.5)";
            };
            const handleMouseLeave = () => {
                this.#windowDiv.style.transform = "scale(0.3)";
            };
            this.#preMinimizeState.handlers = {handleClick, handleMouseEnter, handleMouseLeave};
            this.#windowDiv.addEventListener('click', handleClick);
            this.#windowDiv.addEventListener('mouseenter', handleMouseEnter);
            this.#windowDiv.addEventListener('mouseleave', handleMouseLeave);
        }, 500);
    }
    restoreFromMinimize() {
        if (!this.#windowDiv.classList.contains("minimized")) return;
        this.#applyWindowLayout({
            transform: this.#preMinimizeState?.transform ?? "scale(1)",
            left: this.#preMinimizeState?.left ?? this.#windowDiv.style.left,
            top: this.#preMinimizeState?.top ?? this.#windowDiv.style.top,
            overflow: this.#preMinimizeState?.overflow ?? "visible",
        }, {minBodyHeight: 150});
        if (this.#preMinimizeState?.handlers) {
            const {handleClick, handleMouseEnter, handleMouseLeave} = this.#preMinimizeState.handlers;
            this.#windowDiv.removeEventListener('click', handleClick);
            this.#windowDiv.removeEventListener('mouseenter', handleMouseEnter);
            this.#windowDiv.removeEventListener('mouseleave', handleMouseLeave);
        }
        this.#windowDiv.classList.remove("minimized");
        modular.minimized = Math.max((modular.minimized ?? 1) - 1, 0);
        this.#scheduleAfterRender();
        this.#persistWindowState();
    }
    #toggleMaximize(topMargin = 50) {
        if (this.#isMaximizeEnforced() && this.#isMaximized) return;
        if (!this.#isMaximized) {
            this.#maximizeWindow(topMargin);
        } else if (this.#savedWindowState) {
            this.#applyWindowLayout({
                transition: "all 150ms ease-in-out",
                width: this.#savedWindowState.width,
                height: this.#savedWindowState.height,
                left: this.#savedWindowState.left,
                top: this.#savedWindowState.top,
                bodyHeight: this.#savedWindowState.body.height,
            }, {minBodyHeight: 150});
            this.#windowBody.style.minHeight = this.#savedWindowState.body.minHeight;
            this.#windowBody.style.maxHeight = this.#savedWindowState.body.maxHeight;
            this.#isMaximized = false;
        }
        this.#updateMaximizeMenuItem();
        this.#scheduleAfterRender();
    }
    #maximizeWindow(topMargin = 50) {
        const bodyMargin = 10;
        const availableHeight = Math.max(window.innerHeight - topMargin - bodyMargin, 200);
        if (!this.#isMaximized) {
            this.#savedWindowState = this.#captureRestoreState();
        }
        this.#windowDiv.classList.remove("minimized");
        this.#applyWindowLayout({
            transform: "scale(1)",
            transition: "all 150ms ease-in-out",
            width: `calc(100vw - ${bodyMargin * 2}px)`,
            left: `${bodyMargin}px`,
            top: `${topMargin}px`,
            height: `${availableHeight}px`,
            overflow: "visible",
        }, {minBodyHeight: 150});
        this.#isMaximized = true;
        this.#updateMaximizeMenuItem();
        this.#scheduleAfterRender();
    }
    tile(direction) {
        if (!this.#windowDiv || this.#isPinned || this.#isMaximizeEnforced()) return;
        const outerMargin = 10;
        const topMargin = 50;
        const bottomMargin = 10;
        const availableWidth = Math.max(window.innerWidth - (outerMargin * 2), 200);
        const availableHeight = Math.max(window.innerHeight - topMargin - bottomMargin, 200);
        const halfWidth = Math.max(availableWidth / 2, 200);
        const halfHeight = Math.max(availableHeight / 2, 150);
        const layouts = {
            left: {
                width: `${halfWidth}px`,
                height: `${availableHeight}px`,
                left: `${outerMargin}px`,
                top: `${topMargin}px`,
            },
            right: {
                width: `${halfWidth}px`,
                height: `${availableHeight}px`,
                left: `${outerMargin + halfWidth}px`,
                top: `${topMargin}px`,
            },
            top: {
                width: `${availableWidth}px`,
                height: `${halfHeight}px`,
                left: `${outerMargin}px`,
                top: `${topMargin}px`,
            },
            bottom: {
                width: `${availableWidth}px`,
                height: `${halfHeight}px`,
                left: `${outerMargin}px`,
                top: `${topMargin + halfHeight}px`,
            }
        };
        const nextLayout = layouts[direction];
        if (!nextLayout) return;
        if (this.#windowDiv.classList.contains("minimized")) {
            this.restoreFromMinimize();
        }
        this.#savedWindowState = this.#captureRestoreState();
        this.#isMaximized = false;
        this.#windowDiv.classList.remove("minimized");
        this.#applyWindowLayout({
            ...nextLayout,
            transform: "scale(1)",
            transition: "all 150ms ease-in-out",
            overflow: "visible",
        }, {minBodyHeight: 150});
        this.#hasExplicitPosition = true;
        this.#updateMaximizeMenuItem();
        this.#scheduleAfterRender();
        this.#persistWindowState({open: true});
    }
    #captureRestoreState() {
        const rect = this.#windowDiv.getBoundingClientRect();
        return {
            width: this.#windowDiv.style.width || `${rect.width}px`,
            height: this.#windowDiv.style.height || `${rect.height}px`,
            left: this.#windowDiv.style.left || `${rect.left}px`,
            top: this.#windowDiv.style.top || `${rect.top}px`,
            body: {
                minHeight: this.#windowBody.style.minHeight,
                maxHeight: this.#windowBody.style.maxHeight,
                height: this.#windowBody.style.height,
            }
        };
    }
    #updateMaximizeMenuItem() {
        if (!this.#maximizeMenuItem) return;
        this.#maximizeMenuItem.label = this.#isMaximized ? "Downsize" : "Maximize";
    }
    #renderRouteContent(routeContent, afterRender) {
        const resolvedRoute = typeof routeContent === "function" ? routeContent() : routeContent;
        const runAfterRender = () => {
            if (typeof afterRender === "function") {
                const routeContext = this.#createRouteContext();
                afterRender.call(routeContext, this.#windowDiv, routeContext);
            }
        };
        const applyContent = (content) => {
            if (content instanceof Node) {
                this.#windowBody.replaceChildren(content);
            } else {
                this.#windowBody.innerHTML = content ?? "";
            }
            this.#syncPortalLayout(150);
            runAfterRender();
        };
        if (resolvedRoute instanceof Promise) {
            resolvedRoute.then(applyContent).catch(_ => this.#windowBody.innerHTML = "Failed to load content");
        } else {
            applyContent(resolvedRoute);
        }
    }
    #scheduleAfterRender() {
        if (this.#afterRenderScheduled) return;
        this.#afterRenderScheduled = true;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this.#afterRenderScheduled = false;
                this.#runAfterRender();
            });
        });
    }
    applyWindowState(state = {}) {
        if (!this.#windowDiv) return;
        const currentContext = windowStateManager?.sanitizeState?.(this.#windowContext ?? {}) ?? {};
        if (this.#restoreWindowContext) {
            const restoredContext = windowStateManager?.sanitizeState?.(state?.context ?? {}) ?? {};
            // Keep newer in-memory context values when restoration resolves after runtime updates.
            this.#windowContext = {...restoredContext, ...currentContext};
        } else {
            this.#windowContext = currentContext;
        }
        const nextLayout = {};
        if (state.width) nextLayout.width = state.width;
        if (state.height) nextLayout.height = state.height;
        if (state.left) {
            nextLayout.left = state.left;
            this.#hasExplicitPosition = true;
        }
        if (state.top) {
            nextLayout.top = state.top;
            this.#hasExplicitPosition = true;
        }
        if (state.bodyHeight && this.#windowBody) nextLayout.bodyHeight = state.bodyHeight;
        this.#applyWindowLayout(nextLayout, {minBodyHeight: 150});
        this.#setPinnedState(state.pinned);
        if (this.#isMaximizeEnforced()) this.#maximizeWindow();
    }
    #setPinnedState(isPinned) {
        this.#isPinned = Boolean(isPinned);
        if (this.#dragState?.handle) {
            this.#dragState.handle.style.cursor = this.#isPinned ? 'default' : 'grab';
        }
        if (this.#pinMenuItem) {
            this.#pinMenuItem.label = this.#isPinned ? 'Unpin' : 'Pin';
            this.#pinMenuItem.icon = this.#isPinned ? this.#unpinIcon : this.#pinIcon;
        }
    }
    #captureWindowState(extra = {}) {
        if (!this.#windowDiv) return null;
        const rect = this.#windowDiv.getBoundingClientRect();
        const bodyHeight = this.#windowBody ? (this.#windowBody.style.height || `${this.#windowBody.getBoundingClientRect().height}px`) : undefined;
        const context = windowStateManager?.sanitizeState?.(this.#windowContext ?? {}) ?? {};
        return {
            serviceId: this.#serviceId,
            portalIndex: this.#portalIndex,
            instanceId: this.#instanceId,
            type: "service",
            left: this.#windowDiv.style.left || `${rect.left}px`,
            top: this.#windowDiv.style.top || `${rect.top}px`,
            width: this.#windowDiv.style.width || `${rect.width}px`,
            height: this.#windowDiv.style.height || `${rect.height}px`,
            bodyHeight,
            pinned: this.#isPinned,
            context,
            open: this.#windowDiv.parentElement !== null, ...extra
        };
    }
    #persistWindowState(extra = {}) {
        const snapshot = this.#captureWindowState(extra);
        if (!snapshot) return;
        windowStateManager?.saveState(this.#serviceId, this.#portalIndex, snapshot, "service", this.#instanceId);
    }
    close() {
        const closedPortal = this;
        this.#resizeObserver?.disconnect?.();
        this.#resizeObserver = null;
        this.hide();
        this.#windowDiv = null;
        this.#windowBody = null;
        this.#initialRender = null;
        this.#activeRoute = null;
        this.#onCloseInstance?.(closedPortal);
        this.#onCloseInstance = null;
    }
    exportStruct() {
        return this.#struct;
    }
}
