(() => {
    const serviceScripts = [
        "/js/services/internals.js",
        "/js/services/files.js",
        "/js/services/calendar.js",
        "/js/services/contacts.js",
        "/js/services/alarms.js",
        "/js/services/maps.js",
        "/js/services/notes.js",
        "/js/services/weather.js",
        "/js/services/boards.js",
        "/js/services/editor.text.js",
        "/js/services/editor.sheet.js",
        "/js/services/editor.slides.js",
        "/js/services/editor.code.js",
        "/js/services/cli.js",
        "/js/services/settings.js",
    ];
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
        if ((normalized.settings === undefined || normalized.settings === null || normalized.settings === "") && normalized.theme !== undefined) {
            normalized.settings = normalized.theme;
        }
        if ((normalized.theme === undefined || normalized.theme === null || normalized.theme === "") && normalized.settings !== undefined) {
            normalized.theme = normalized.settings;
        }
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
            if (userRecord) {
                cacheUserRecord(userRecord);
            }
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
        const total = serviceScripts.length;
        let loaded = 0;
        let startupFinished = false;
        const failures = [];
        let recordsFinished = false;
        const showLoader = () => loader.classList.remove("hidden");
        const hideLoader = () => loader.classList.add("hidden");
        const updateProgress = (currentUrl = "") => {
            const percent = Math.round((loaded / total) * 100);
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
        const loadScript = (url) => new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = url;
            script.async = false;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load ${url}`));
            document.head.appendChild(script);
        });
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
                await records.refresh({
                    onProgress: (current, count, config) => {
                        bar.style.width = "100%";
                        text.textContent = `Platform ready - loading ${config?.label || config?.key || "records"}`;
                        status.textContent = `Search records ${current}/${count}`;
                    }
                });
            } catch (error) {
                console.error("Failed to load startup records", error);
            }
            recordsFinished = true;
            updateProgress();
        };
        const loadSequentially = async () => {
            showLoader();
            for (const url of serviceScripts) {
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
