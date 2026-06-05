(() => {
    const platformInterfaces = [
        {serviceId: "com.standard.internals", title: "Internals", script: "/js/services/internals.js", icon: "/icons/interfaces/cli.png", internal: true},
        {serviceId: "com.standard.integrator", title: "Integrator", script: "/js/services/integrator.js", icon: "/icons/interfaces/cli.png", internal: true},
        {serviceId: "com.standard.stopwatch", title: "Stopwatch", script: "/js/services/stopwatch.js", icon: "/icons/interfaces/alarms.png", internal: true},
        {serviceId: "com.standard.files", title: "Files", script: "/js/services/files.js", icon: "/icons/interfaces/files.png"},
        {serviceId: "com.standard.calendar", title: "Calendar", script: "/js/services/calendar.js", icon: "/icons/interfaces/calendar.png"},
        {serviceId: "com.standard.contacts", title: "Contacts", script: "/js/services/contacts.js", icon: "/icons/interfaces/contacts.png"},
        {serviceId: "com.standard.email", title: "Email", script: "/js/services/email.js", icon: "/icons/interfaces/email.png"},
        {serviceId: "com.standard.alarms", title: "Alarms", script: "/js/services/alarms.js", icon: "/icons/interfaces/alarms.png"},
        {serviceId: "com.standard.maps", title: "Maps", script: "/js/services/maps.js", icon: "/icons/interfaces/maps.png"},
        {serviceId: "com.standard.notes", title: "Notes", script: "/js/services/notes.js", icon: "/icons/interfaces/notes.png"},
        {serviceId: "com.standard.weather", title: "Weather", script: "/js/services/weather.js", icon: "/icons/interfaces/weather.png"},
        {serviceId: "com.standard.boards", title: "Boards", script: "/js/services/boards.js", icon: "/icons/interfaces/whiteboard.png"},
        {serviceId: "com.standard.editor.text", title: "Text Editor", script: "/js/services/editor.text.js", icon: "/icons/interfaces/editor.png"},
        {serviceId: "com.standard.editor.sheet", title: "Sheets", script: "/js/services/editor.sheet.js", icon: "/icons/interfaces/editor.png"},
        {serviceId: "com.standard.editor.slides", title: "Slides", script: "/js/services/editor.slides.js", icon: "/icons/interfaces/editor.png"},
        {serviceId: "com.standard.editor.code", title: "Code Editor", script: "/js/services/editor.code.js", icon: "/icons/interfaces/editor.png"},
        {serviceId: "com.standard.cli", title: "CLI", script: "/js/services/cli.js", icon: "/icons/interfaces/cli.png"},
        {serviceId: "com.standard.settings", title: "Settings", script: "/js/services/settings.js", icon: "/icons/interfaces/settings.png", required: true},
    ];
    const widgetScripts = [
        "/js/services/widgets/player.widget.js",
        "/js/services/widgets/video.widget.js",
        "/js/services/widgets/weather.widget.js"
    ];
    const serviceScripts = platformInterfaces.map(({script}) => script);
    const SERVICE_SCRIPT_CACHE_INTERFACE = "service-loader";
    const SERVICE_SCRIPT_CACHE_VERSION = "v1";
    const ENABLED_APPS_CACHE_KEY = "enabled-apps";
    const buildServiceScriptCacheKey = (url = "") => `${SERVICE_SCRIPT_CACHE_VERSION}:${url}`;
    const supportsServiceScriptCache = () => {
        try {
            return typeof window.StandardBrowserCache?.available === "function" && window.StandardBrowserCache.available();
        } catch (_) {
            return false;
        }
    };
    const getCachedServiceScriptSource = async (url) => {
        if (!supportsServiceScriptCache()) return null;
        try {
            const cached = await window.StandardBrowserCache.get(SERVICE_SCRIPT_CACHE_INTERFACE, buildServiceScriptCacheKey(url), {format: "js"});
            return typeof cached === "string" && cached.trim() ? cached : null;
        } catch (error) {
            console.warn(`Failed to read cached service script ${url}`, error);
            return null;
        }
    };
    const cacheServiceScriptSource = async (url, source) => {
        if (!supportsServiceScriptCache() || typeof source !== "string") return false;
        try {
            await window.StandardBrowserCache.set(SERVICE_SCRIPT_CACHE_INTERFACE, buildServiceScriptCacheKey(url), source, {
                format: "js",
                contentType: "text/javascript; charset=utf-8",
                label: url,
                source: "service-loader"
            });
            return true;
        } catch (error) {
            console.warn(`Failed to cache service script ${url}`, error);
            return false;
        }
    };
    const deleteCachedServiceScriptSource = async (url) => {
        if (!supportsServiceScriptCache()) return false;
        try {
            return await window.StandardBrowserCache.delete(SERVICE_SCRIPT_CACHE_INTERFACE, buildServiceScriptCacheKey(url), {format: "js"});
        } catch (_) {
            return false;
        }
    };
    const isLikelyJavaScript = (source = "", contentType = "") => {
        const type = `${contentType || ""}`.toLowerCase();
        const trimmed = `${source || ""}`.trimStart();
        if (type.includes("text/html") || trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) return false;
        return true;
    };
    const fetchServiceScriptSource = async (url) => {
        const response = await fetch(url, {credentials: "same-origin", cache: "no-cache"});
        const source = await response.text().catch(() => "");
        if (!response.ok) throw new Error(`Failed to load ${url}: HTTP ${response.status}${source ? ` - ${source.slice(0, 120)}` : ""}`);
        if (!isLikelyJavaScript(source, response.headers.get("content-type") || "")) throw new Error(`Failed to load ${url}: response was not JavaScript`);
        await cacheServiceScriptSource(url, source);
        return source;
    };
    const warmServiceScriptCache = async (url) => {
        if (!supportsServiceScriptCache()) return;
        try {
            await fetchServiceScriptSource(url);
        } catch (error) {
            console.warn(`Failed to warm service script cache for ${url}`, error);
        }
    };
    const loadNetworkServiceScript = (url) => new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = url;
        script.async = false;
        script.onload = () => {
            void warmServiceScriptCache(url);
            resolve(true);
        };
        script.onerror = () => reject(new Error(`Failed to load ${url}`));
        document.head.appendChild(script);
    });
    const executeServiceScriptSource = (url, source) => new Promise((resolve, reject) => {
        if (typeof source !== "string" || !source.trim() || !isLikelyJavaScript(source)) {
            reject(new Error(`Cached script ${url} is empty`));
            return;
        }
        const blobUrl = URL.createObjectURL(new Blob([source], {type: "text/javascript"}));
        const script = document.createElement("script");
        script.async = false;
        script.src = blobUrl;
        script.dataset.serviceScriptSrc = url;
        script.onload = () => {
            URL.revokeObjectURL(blobUrl);
            resolve(true);
        };
        script.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error(`Failed to execute cached script ${url}`));
        };
        document.head.appendChild(script);
    });
    const isServiceScriptLoaded = (script) => Array.from(document.scripts || []).some((node) => node.dataset?.serviceScriptSrc === script || node.getAttribute("src") === script || node.src.endsWith(script));
    const serviceScriptLoadPromises = new Map();
    const loadCachedServiceScript = (url) => {
        if (!url) return Promise.resolve(false);
        if (isServiceScriptLoaded(url)) return Promise.resolve(true);
        if (serviceScriptLoadPromises.has(url)) return serviceScriptLoadPromises.get(url);
        const promise = (async () => {
            const source = await getCachedServiceScriptSource(url);
            if (!source) return loadNetworkServiceScript(url);
            return executeServiceScriptSource(url, source);
        })().catch(async (error) => {
            if (supportsServiceScriptCache()) {
                console.warn(`Cached service script load failed for ${url}; refreshing from server`, error);
                await deleteCachedServiceScriptSource(url);
                return loadNetworkServiceScript(url);
            }
            throw error;
        });
        serviceScriptLoadPromises.set(url, promise);
        return promise;
    };
    const normalizeEnabledAppsRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const serializeEnabledAppsRecord = (value) => JSON.stringify(JSON.stringify(normalizeEnabledAppsRecord(value)));
    const sanitizeRecordId = (value = "") => `${value || ""}`.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    const extractCacheRecord = (payload) => {
        if (!payload) return null;
        if (Array.isArray(payload)) return payload[0] || null;
        if (Array.isArray(payload.cache)) return payload.cache[0] || null;
        if (payload.cache && typeof payload.cache === "object") return payload.cache;
        if (typeof payload === "object" && !Array.isArray(payload)) return payload;
        return null;
    };
    const parseCacheLookupResponse = (payload) => {
        if (payload === 0 || payload === "0" || payload === "" || payload === null || payload === undefined) return {exists: false, value: null, recordId: ""};
        if (typeof payload === "string") {
            const trimmed = payload.trim();
            if (!trimmed || trimmed === "0") return {exists: false, value: null, recordId: ""};
            try {
                return parseCacheLookupResponse(JSON.parse(trimmed));
            } catch (_) {
                return {exists: true, value: trimmed, recordId: ""};
            }
        }
        const record = extractCacheRecord(payload);
        if (!record) return {exists: false, value: null, recordId: ""};
        return {exists: true, value: record.value ?? record.VL ?? record.vl ?? null, recordId: sanitizeRecordId(record.id || record.ID || "")};
    };
    const parseEnabledAppsValue = (value) => {
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
    const sendEnabledAppsCommand = async (query, parseJson = true) => {
        const response = await fetch(`/api/cli?_=${Date.now()}`, {method: "POST", credentials: "same-origin", cache: "no-store", headers: {"Content-Type": "application/json", "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}, body: JSON.stringify({query})});
        const responseText = await response.text().catch(() => "");
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${responseText.slice(0, 200)}`);
        if (!parseJson) return responseText;
        const normalizedText = responseText.replace(/^\uFEFF/, "").trim();
        if (!normalizedText) return "";
        try {
            return JSON.parse(normalizedText);
        } catch (_) {
            return responseText;
        }
    };
    const resolveEnabledAppsUserRecordId = async () => {
        const cachedUserRecord = typeof modular?.user?.readCachedUserRecord === "function" ? modular.user.readCachedUserRecord() : null;
        const cachedRecordId = sanitizeRecordId(cachedUserRecord?.id);
        if (cachedRecordId) return cachedRecordId;
        const userRecord = typeof modular?.user?.data === "function" ? await modular.user.data() : null;
        return sanitizeRecordId(userRecord?.id);
    };
    const createEnabledAppsManager = () => {
        let state = {};
        let hasExistingRecord = false;
        let loadPromise = null;
        let saveQueue = Promise.resolve();
        const defaultState = () => Object.fromEntries(platformInterfaces.map(({serviceId}) => [serviceId, true]));
        const loadInterfaceScript = (app) => {
            if (!app?.script) return Promise.resolve(false);
            return loadCachedServiceScript(app.script);
        };
        const buildFetchCommand = (userRecordId) => `[cache] <user "${userRecordId}", key "${ENABLED_APPS_CACHE_KEY}">`;
        const buildCreateCommand = (userRecordId, value) => `[cache] + (@${userRecordId}, "${ENABLED_APPS_CACHE_KEY}", ${serializeEnabledAppsRecord(value)})`;
        const buildUpdateCommand = (userRecordId, value, recordId = "") => {
            const filter = recordId ? `id "${recordId}"` : `user @${userRecordId}, key "${ENABLED_APPS_CACHE_KEY}"`;
            return `[cache] value ${serializeEnabledAppsRecord(value)} <${filter}>`;
        };
        const load = async () => {
            if (!loadPromise) {
                loadPromise = (async () => {
                    const defaults = defaultState();
                    try {
                        const userRecordId = await resolveEnabledAppsUserRecordId();
                        if (!userRecordId) {
                            state = defaults;
                            return state;
                        }
                        const payload = await sendEnabledAppsCommand(buildFetchCommand(userRecordId), true);
                        const lookup = parseCacheLookupResponse(payload);
                        hasExistingRecord = lookup.exists;
                        state = {...defaults, ...normalizeEnabledAppsRecord(parseEnabledAppsValue(lookup.value))};
                    } catch (error) {
                        console.error("Failed to load enabled app settings", error);
                        state = defaults;
                    }
                    platformInterfaces.filter(({required}) => required).forEach(({serviceId}) => {
                        state[serviceId] = true;
                    });
                    return state;
                })();
            }
            return loadPromise;
        };
        const save = (nextState = state) => {
            saveQueue = saveQueue.catch(() => null).then(async () => {
                const userRecordId = await resolveEnabledAppsUserRecordId();
                if (!userRecordId) return false;
                const normalizedState = normalizeEnabledAppsRecord(nextState);
                platformInterfaces.filter(({required}) => required).forEach(({serviceId}) => {
                    normalizedState[serviceId] = true;
                });
                const lookupPayload = await sendEnabledAppsCommand(buildFetchCommand(userRecordId), true);
                const lookup = parseCacheLookupResponse(lookupPayload);
                hasExistingRecord = lookup.exists;
                const command = hasExistingRecord ? buildUpdateCommand(userRecordId, normalizedState, lookup.recordId) : buildCreateCommand(userRecordId, normalizedState);
                await sendEnabledAppsCommand(command, false);
                state = {...normalizedState};
                hasExistingRecord = true;
                return true;
            }).catch((error) => {
                console.error("Failed to save enabled app settings", error);
                return false;
            });
            return saveQueue;
        };
        return {
            all: () => platformInterfaces.map((item) => ({...item})),
            load,
            state: () => ({...state}),
            isEnabled: (serviceId) => state?.[serviceId] !== false,
            async setEnabled(serviceId, enabled) {
                await load();
                const app = platformInterfaces.find(item => item.serviceId === serviceId);
                if (!app) return false;
                state[serviceId] = app.required ? true : enabled !== false;
                await save(state);
                if (state[serviceId] === false && typeof modular?.exit === "function") {
                    modular.exit(serviceId);
                } else if (state[serviceId] !== false) {
                    try {
                        await loadInterfaceScript(app);
                    } catch (error) {
                        console.error(error);
                    }
                }
                if (typeof modular?.renderInterfaceShortcuts === "function") modular.renderInterfaceShortcuts();
                return state[serviceId] !== false;
            }
        };
    };
    window.StandardPlatformInterfaces = window.StandardPlatformInterfaces || createEnabledAppsManager();
    const normalizeUserRecord = (payload) => {
        if (!payload) return null;
        let record = null;
        if (Array.isArray(payload)) record = payload[0] || null;
        else if (Array.isArray(payload.user)) record = payload.user[0] || null;
        else if (payload.user && typeof payload.user === "object") record = payload.user;
        else if (typeof payload === "object" && !Array.isArray(payload)) record = payload;
        if (!record || typeof record !== "object" || Array.isArray(record)) return null;
        const normalized = {...record};
        const normalizedUserId = `${normalized.userid || normalized.userId || normalized.id || ""}`.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
        if (normalizedUserId) {
            normalized.userid = normalizedUserId;
            if (!normalized.userId) normalized.userId = normalizedUserId;
        }
        if ((normalized.settings === undefined || normalized.settings === null || normalized.settings === "") && normalized.theme !== undefined) normalized.settings = normalized.theme;
        if ((normalized.theme === undefined || normalized.theme === null || normalized.theme === "") && normalized.settings !== undefined) normalized.theme = normalized.settings;
        return normalized;
    };
    const parseSettings = (value) => {
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
    const getThemeFromUserCookie = () => {
        const userRecord = normalizeUserRecord(window.__stdUserRecordCache || null);
        return parseSettings(userRecord?.settings) || parseSettings(userRecord?.theme);
    };
    const cacheUserRecord = (userRecord) => {
        const normalized = normalizeUserRecord(userRecord);
        if (!normalized) return;
        window.__stdUserRecordCache = normalized;
    };
    const fetchStartupTheme = async () => {
        try {
            const response = await fetch("/api/user/theme", {
                credentials: "same-origin",
                cache: "no-store"
            });
            if (!response.ok) {
                console.error("Failed to fetch /api/user/theme:", response.status);
                return null;
            }
            const payload = await response.json();
            const userRecord = normalizeUserRecord(payload?.user);
            if (userRecord) cacheUserRecord(userRecord);
            return parseSettings(payload?.theme) || parseSettings(userRecord?.settings) || parseSettings(userRecord?.theme);
        } catch (error) {
            console.error("Failed to fetch startup theme", error);
            return null;
        }
    };
    document.addEventListener("DOMContentLoaded", () => {
        const loader = document.getElementById("service-loader");
        const interfaceShortcuts = document.getElementById("interface-shortcuts");
        loader.classList.add("fixed", "bottomed");
        const status = document.getElementById("service-loader-status");
        const text = document.getElementById("service-loader-text");
        const bar = document.getElementById("service-loader-bar");
        if (!loader || !status || !text || !bar) return;
        interfaceShortcuts?.classList.remove("none");
        let total = serviceScripts.length + widgetScripts.length;
        let loaded = 0;
        let startupFinished = false;
        const failures = [];
        let recordsFinished = false;
        const showLoader = () => loader.classList.remove("hidden");
        const hideLoader = () => loader.classList.add("hidden");
        const updateProgress = (currentUrl = "") => {
            const percent = Math.round((loaded / Math.max(total, 1)) * 100);
            bar.style.width = `${percent}%`;
            status.textContent = `${percent}% complete`;
            if (loaded === total && startupFinished && recordsFinished) {
                if (failures.length) {
                    text.textContent = failures.length === 1 ? `${failures[0]} failed` : "Some services failed to load";
                    status.textContent = `${percent}% complete - ${failures.length} failure${failures.length === 1 ? "" : "s"}`;
                } else {
                    text.textContent = "All services loaded";
                    status.textContent = "100% complete";
                }
                setTimeout(hideLoader, 500);
            } else if (currentUrl) {
                text.textContent = `Loading ${currentUrl}`;
            }
        };
        const loadScript = (url) => loadCachedServiceScript(url);
        const waitForCondition = async (predicate, {timeoutMs = 10000, intervalMs = 50} = {}) => {
            const start = Date.now();
            while (Date.now() - start <= timeoutMs) {
                try {
                    if (predicate()) return true;
                } catch (_) {
                }
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }
            return false;
        };
        const getCliClient = () => {
            if (typeof window.CLI?.send === "function") return window.CLI;
            if (typeof CLI !== "undefined" && typeof CLI?.send === "function") return CLI;
            return null;
        };
        const runRecordLoadingPhase = async () => {
            const records = window.StandardRecordSearch;
            if (!records || typeof records.refresh !== "function") {
                recordsFinished = true;
                updateProgress();
                return;
            }
            const cliReady = await waitForCondition(() => Boolean(getCliClient()), {timeoutMs: 5000});
            if (!cliReady) {
                recordsFinished = true;
                console.warn("CLI did not become ready before record loading phase");
                updateProgress();
                return;
            }
            showLoader();
            bar.style.width = "100%";
            text.textContent = "Platform ready";
            status.textContent = "Loading search records";
            try {
                await records.refresh({onProgress: (current, count, config) => {bar.style.width = "100%";text.textContent = `Platform ready - loading ${config?.label || config?.key || "records"}`;status.textContent = `Search records ${current}/${count}`;}});
            } catch (error) {
                console.error("Failed to load startup records", error);
            }
            recordsFinished = true;
            updateProgress();
        };
        const loadSequentially = async () => {
            showLoader();
            await window.StandardPlatformInterfaces.load();
            const enabledServiceScripts = platformInterfaces.filter(({serviceId, required}) => required || window.StandardPlatformInterfaces.isEnabled(serviceId)).map(({script}) => script);
            total = widgetScripts.length + enabledServiceScripts.length;
            for (const url of [...widgetScripts, ...enabledServiceScripts]) {
                updateProgress(url);
                try {
                    await loadScript(url);
                } catch (err) {
                    failures.push(url);
                    console.error(err);
                }
                loaded += 1;
                updateProgress();
            }
            text.textContent = "Applying theme";
            status.textContent = "Finishing startup";
            const startupTheme = await fetchStartupTheme();
            const cookieTheme = startupTheme || getThemeFromUserCookie();
            const fallbackTheme = window.StandardUI?.defaultTheme ? {...window.StandardUI.defaultTheme} : null;
            const themeToApply = cookieTheme || fallbackTheme;
            if (themeToApply && typeof applyThemeData === "function") {
                try {
                    await applyThemeData(themeToApply);
                } catch (err) {
                    console.error("Failed to apply theme during startup", err);
                }
            } else if (typeof window.StandardUI?.refreshTheme === "function") {
                try {
                    await window.StandardUI.refreshTheme({maxAttempts: 1, retryDelayMs: 200});
                } catch (err) {
                    console.error("Failed to apply theme during startup", err);
                }
            }
            startupFinished = true;
            updateProgress();
            await runRecordLoadingPhase();
            if (typeof windowStateManager?.restoreOpenWindows === "function") {
                await windowStateManager.restoreOpenWindows(true);
            }
        };
        loadSequentially();
    });
})();
