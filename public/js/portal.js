function showInterfaces() {
    if (document.getElementById("interface-shortcuts")) {
        const container = document.getElementById("interface-shortcuts");
        if (!container) {
            console.warn(`[animateInterfacesIn] container #${containerId} not found`);
            return;
        }
        const icons = Array.from(container.querySelectorAll(".interface-icon"));
        container.classList.remove("none");
        container.style.setProperty("display", "block", "important");
        requestAnimationFrame(() => {
            for (const el of icons) {
                el.style.setProperty("opacity", "0", "important");
                el.style.setProperty("transform", "translateY(16px) scale(0.95)", "important");
                el.style.setProperty("filter", "blur(2px)", "important");
                el.style.setProperty("transition", "opacity 260ms ease, transform 260ms cubic-bezier(.2,.8,.2,1), filter 260ms ease", "important");
                el.style.setProperty("display", "inline-block", "important");
                el.style.setProperty("will-change", "opacity, transform, filter", "important");
            }
            requestAnimationFrame(() => {
                icons.forEach((el, i) => {
                    setTimeout(() => {
                        el.style.setProperty("opacity", "1", "important");
                        el.style.setProperty("transform", "translateY(0) scale(1)", "important");
                        el.style.setProperty("filter", "blur(0)", "important");
                    }, i * 70);
                });
            });
        });
    }
}
function prefersSvgSearchIcons() {
    return window.StandardUI?.prefersSvgIcons?.() !== false;
}
function getSearchResultIconMarkup(portal = {}) {
    const primaryRecordMatch = Array.isArray(portal?.recordMatches) ? portal.recordMatches[0] : null;
    if (primaryRecordMatch?.command === "files") {
        const fileIconPath = window.StandardFiles?.getFileTypeIconPath?.(primaryRecordMatch.record);
        if (fileIconPath) return fileIconPath;
    }
    if (prefersSvgSearchIcons()) return portal.svg_icon || portal.icon || "";
    return portal.icon || portal.svg_icon || "";
}
function buildSearchResultIcon(portal = {}) {
    const iconMarkup = `${getSearchResultIconMarkup(portal) || ""}`.trim();
    if (!iconMarkup) return null;
    if (iconMarkup.startsWith("/") || iconMarkup.startsWith("https")) {
        const image = document.createElement("img");
        image.src = iconMarkup;
        image.alt = portal?.title || "Portal";
        image.className = "search-result-icon-image";
        return image;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "search-result-icon-svg";
    wrapper.innerHTML = iconMarkup;
    const svg = wrapper.querySelector("svg");
    if (svg) {
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
    }
    return wrapper;
}
window.StandardRecordSearch = window.StandardRecordSearch || (() => {
    const NOTE_CONTENT_PREFIX = "__STD_NOTE_B64__:";
    const CACHE_INTERFACE = "com.standard.settings";
    const CACHE_KEY = "search-records";
    const COMMAND_CONFIGS = [
        {command: "[alarms]", key: "alarms", label: "alarms", serviceId: "com.standard.alarms", portalIndex: 0},
        {command: "[categories]", key: "categories", label: "categories", serviceId: "com.standard.calendar", portalIndex: 1},
        {command: "[contacts]", key: "contacts", label: "contacts", serviceId: "com.standard.contacts", portalIndex: 0},
        {command: "[events]", key: "events", label: "events", serviceId: "com.standard.calendar", portalIndex: 0},
        {command: "[files]", key: "files", label: "files", serviceId: "com.standard.files", portalIndex: 0, replaceOnRefresh: true},
        {command: "[notes]", key: "notes", label: "notes", serviceId: "com.standard.notes", portalIndex: 0},
        {command: "[user]", key: "user", label: "user", serviceId: "com.standard.settings", portalIndex: 0}
    ];
    let cacheState = {updatedAt: "", records: {}};
    let cacheLoaded = false;
    const readCache = async () => {
        return window.StandardBrowserCache?.get?.(CACHE_INTERFACE, CACHE_KEY, {format: "json"}) || null;
    };
    const writeCache = async (payload) => {
        return window.StandardBrowserCache?.set?.(CACHE_INTERFACE, CACHE_KEY, payload ?? {}, {format: "json", contentType: "application/json", label: "Search records"});
    };
    const setCacheState = (nextState = {}) => {
        cacheState = {updatedAt: nextState?.updatedAt || "", records: nextState?.records && typeof nextState.records === "object" ? nextState.records : {}};
        cacheLoaded = true;
        document.dispatchEvent(new CustomEvent("standard-record-cache-updated", {detail: cacheState}));
        return cacheState;
    };
    const normalizeRecord = (record = {}) => {
        if (!record || typeof record !== "object" || Array.isArray(record)) return null;
        if (record.id === undefined || record.id === null || `${record.id}`.trim() === "") return null;
        return {...record};
    };
    const decodeNoteContent = (value = "") => {
        const raw = String(value || "");
        if (!raw.startsWith(NOTE_CONTENT_PREFIX)) return raw;
        try {
            const binary = atob(raw.slice(NOTE_CONTENT_PREFIX.length));
            const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
            return new TextDecoder().decode(bytes);
        } catch (_) {
            return "";
        }
    };
    const stripMarkupToPreview = (value = "") => {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = String(value || "");
        return (wrapper.textContent || wrapper.innerText || "").replace(/\s+/g, " ").trim();
    };
    const truncatePreview = (value = "", maxLength = 120) => {
        const normalized = `${value || ""}`.trim();
        if (normalized.length <= maxLength) return normalized;
        return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
    };
    const mergeRecordsById = (existingRecords = [], nextRecords = []) => {
        const existingById = new Map((Array.isArray(existingRecords) ? existingRecords : []).map(normalizeRecord).filter(Boolean).map(record => [`${record.id}`, record]));
        const merged = [];
        (Array.isArray(nextRecords) ? nextRecords : []).forEach((rawRecord) => {
            const normalizedRecord = normalizeRecord(rawRecord);
            if (!normalizedRecord) return;
            const recordId = `${normalizedRecord.id}`;
            merged.push({...existingById.get(recordId), ...normalizedRecord});
            existingById.delete(recordId);
        });
        return merged;
    };
    const getCommandRecords = (key = "") => {
        const records = cacheState?.records?.[key];
        return Array.isArray(records) ? records : [];
    };
    const resolveResponseRecords = (config, response) => {
        if (Array.isArray(response)) return response;
        if (!response || typeof response !== "object") return null;
        if (Array.isArray(response?.[config.key])) return response[config.key];
        const firstArrayEntry = Object.values(response).find(Array.isArray);
        return Array.isArray(firstArrayEntry) ? firstArrayEntry : null;
    };
    const collectSearchableValues = (value, collector = [], seen = new WeakSet()) => {
        if (value === null || value === undefined) return collector;
        if (typeof value === "string") {
            const normalized = value.replace(/\s+/g, " ").trim();
            if (normalized) collector.push(normalized);
            return collector;
        }
        if (typeof value === "number" || typeof value === "boolean") {
            collector.push(`${value}`);
            return collector;
        }
        if (Array.isArray(value)) {
            value.forEach(entry => collectSearchableValues(entry, collector, seen));
            return collector;
        }
        if (typeof value === "object") {
            if (seen.has(value)) return collector;
            seen.add(value);
            Object.values(value).forEach(entry => collectSearchableValues(entry, collector, seen));
        }
        return collector;
    };
    const buildRecordLabel = (record = {}) => {
        const preferredKeys = ["name", "title", "firstname", "lastname", "displayName", "username", "timestamp", "created", "path", "email", "phone"];
        const parts = preferredKeys.map(key => record?.[key]).filter(value => value !== undefined && value !== null && `${value}`.trim() !== "").slice(0, 3).map(value => `${value}`.trim());
        if (parts.length) return parts.join(" ");
        const firstValue = collectSearchableValues(record).find(Boolean);
        return firstValue || `Record ${record?.id ?? ""}`.trim();
    };
    const buildRecordPrimaryLabel = (record = {}) => {
        const firstName = `${record?.firstname || ""}`.trim();
        const lastName = `${record?.lastname || ""}`.trim();
        const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
        if (fullName) return fullName;
        const preferredKeys = ["name", "title", "filename", "displayName", "username"];
        for (const key of preferredKeys) {
            const value = `${record?.[key] || ""}`.trim();
            if (value) return value;
        }
        const pathValue = `${record?.path || record?.file || ""}`.trim();
        if (pathValue) {
            const pathSegments = pathValue.split("/").filter(Boolean);
            return pathSegments[pathSegments.length - 1] || pathValue;
        }
        return buildRecordLabel(record);
    };
    const buildRecordSecondaryLabel = (record = {}, primaryLabel = "") => {
        if (`${record?.content || ""}`.trim()) {
            const decodedContent = truncatePreview(stripMarkupToPreview(decodeNoteContent(record.content)));
            if (decodedContent && decodedContent !== primaryLabel) return decodedContent;
        }
        const candidates = [record?.path, record?.email, record?.phone, record?.timestamp, record?.created, record?.username, record?.content, record?.description];
        for (const candidate of candidates) {
            const value = `${candidate || ""}`.replace(/\s+/g, " ").trim();
            if (value && value !== primaryLabel) return value;
        }
        const otherValues = collectSearchableValues(record).filter(value => value !== primaryLabel);
        return otherValues.find(Boolean) || "";
    };
    const getPortalConfigs = (portal = {}) => COMMAND_CONFIGS.filter(config => {
        return config.serviceId === portal?.serviceId && (config.portalIndex ?? 0) === (portal?.portalIndex ?? 0);
    });
    const getCommandConfigByKey = (key = "") => COMMAND_CONFIGS.find(config => config.key === key);
    const refreshCommandConfig = async (config, {merge = false} = {}) => {
        if (!config) return cacheState;
        await window.StandardRecordSearch.loadCache();
        const nextCacheRecords = {...(cacheState?.records || {})};
        const response = await CLI.send(config.command);
        const resolvedRecords = resolveResponseRecords(config, response);
        if (Array.isArray(resolvedRecords)) {
            nextCacheRecords[config.key] = merge ? mergeRecordsById(nextCacheRecords[config.key], resolvedRecords) : resolvedRecords.map(normalizeRecord).filter(Boolean);
        }
        const nextState = setCacheState({updatedAt: new Date().toISOString(), records: nextCacheRecords});
        try {
            await writeCache(nextState);
        } catch (error) {
            console.error("Failed to persist search records cache:", error);
        }
        return nextState;
    };
    return {
        configs: COMMAND_CONFIGS,
        async loadCache({force = false} = {}) {
            if (cacheLoaded && !force) return cacheState;
            try {
                const cachedPayload = await readCache();
                return setCacheState(cachedPayload || {updatedAt: "", records: {}});
            } catch (error) {
                console.error("Failed to load search records cache:", error);
                return setCacheState(cacheState);
            }
        },
        async refresh({onProgress} = {}) {
            await this.loadCache();
            const nextCacheRecords = {...(cacheState?.records || {})};
            for (let index = 0; index < COMMAND_CONFIGS.length; index += 1) {
                const config = COMMAND_CONFIGS[index];
                if (typeof onProgress === "function") {
                    try {
                        onProgress(index + 1, COMMAND_CONFIGS.length, config);
                    } catch (_) {
                    }
                }
                try {
                    const response = await CLI.send(config.command);
                    const resolvedRecords = resolveResponseRecords(config, response);
                    if (Array.isArray(resolvedRecords)) nextCacheRecords[config.key] = config.replaceOnRefresh ? resolvedRecords.map(normalizeRecord).filter(Boolean) : mergeRecordsById(nextCacheRecords[config.key], resolvedRecords);
                } catch (error) {
                    console.error(`Failed to refresh ${config.command}:`, error);
                }
            }
            const nextState = setCacheState({updatedAt: new Date().toISOString(), records: nextCacheRecords});
            try {
                await writeCache(nextState);
            } catch (error) {
                console.error("Failed to persist search records cache:", error);
            }
            return nextState;
        },
        async refreshKey(key = "", options = {}) {
            const config = getCommandConfigByKey(key);
            if (!config) return cacheState;
            return refreshCommandConfig(config, options);
        },
        async refreshFiles() {
            return this.refreshKey("files");
        },
        getCache() {
            return cacheState;
        },
        hasPortalConfig(portal = {}) {
            return getPortalConfigs(portal).length > 0;
        },
        getPortalMatches(portal = {}, query = "") {
            const normalizedQuery = `${query || ""}`.trim().toLowerCase();
            if (!normalizedQuery) return [];
            const matches = [];
            getPortalConfigs(portal).forEach((config) => {
                getCommandRecords(config.key).forEach((record) => {
                    const matchingValues = [...new Set(
                        collectSearchableValues(record).filter(value => value.toLowerCase().includes(normalizedQuery))
                    )];
                    if (!matchingValues.length) return;
                    matches.push({command: config.key, id: record?.id, label: buildRecordLabel(record), primaryLabel: buildRecordPrimaryLabel(record), secondaryLabel: buildRecordSecondaryLabel(record, buildRecordPrimaryLabel(record)), values: matchingValues.slice(0, 3), record});
                });
            });
            return matches.slice(0, 3);
        }
    };
})();
window.StandardRecordSearch.loadCache();
window.StandardFilesRefreshCache = () => {
    const refreshFiles = window.StandardRecordSearch?.refreshFiles;
    if (typeof refreshFiles !== "function") return Promise.resolve(null);
    return refreshFiles.call(window.StandardRecordSearch).catch(error => {
        console.error("Failed to refresh files cache:", error);
        return null;
    });
};
function searchablePortals() {
    const servicePortals = (modular.running || []).flatMap((service) => {
        if (typeof service?.searchablePortals !== "function") return [];
        return service.searchablePortals().map((portal) => ({...portal, hints: Array.isArray(portal?.hints) ? portal.hints : []}));
    }).filter((portal) => {
        return portal.hints.length > 0 || window.StandardRecordSearch?.hasPortalConfig?.(portal);
    });
    return [...servicePortals, {serviceId: "interfaces", portalIndex: 0, title: "Interfaces", hints: ["interfaces", "interface"], icon: "/icons/interfaces/settings.png", svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>`, action: showInterfaces}];
}
let activeSearchResultIndex = -1;
let articleSearchRequestVersion = 0;
let activeArticleSearchController = null;
let clientContextPromise = null;
let searchFilterMode = "";
let searchFilterAnimating = false;
const SEARCH_DESCRIPTION_PREFIX = "description:";
function abortActiveArticleSearchController() {
    if (!activeArticleSearchController) return;
    const controller = activeArticleSearchController;
    activeArticleSearchController = null;
    if (!controller.signal?.aborted) controller.abort();
}
function cancelActiveArticleSearch({clearLoading = false} = {}) {
    articleSearchRequestVersion++;
    abortActiveArticleSearchController();
    if (clearLoading) document.getElementById("search-status")?.isLoading?.(false);
}
function beginArticleSearchRequest() {
    abortActiveArticleSearchController();
    if (typeof AbortController !== "function") return null;
    activeArticleSearchController = new AbortController();
    return activeArticleSearchController;
}
function finishArticleSearchRequest(controller) {
    if (controller && activeArticleSearchController === controller) activeArticleSearchController = null;
}
function isAbortError(error) {
    return error?.name === "AbortError";
}
function getClientContext() {
    if (!clientContextPromise) clientContextPromise = fetch("/api/client-context", {cache: "no-store"}).then(response => response.ok ? response.json() : {}).catch(() => ({}));
    return clientContextPromise;
}
function articleImageUrl(articleId = "") {
    const normalizedId = `${articleId || ""}`.trim();
    return normalizedId ? `/api/records/images/${encodeURIComponent(normalizedId)}?cb=${encodeURIComponent(`${normalizedId}-${Date.now()}`)}` : "";
}
function getSearchResultElements() {
    return Array.from(document.querySelectorAll("#search-results .search-result"));
}
function syncActiveSearchResult({scrollIntoView = false} = {}) {
    const results = getSearchResultElements();
    results.forEach((element, index) => {
        const isActive = index === activeSearchResultIndex;
        element.dataset.active = isActive ? "true" : "false";
        element.setAttribute("aria-selected", isActive ? "true" : "false");
        element.style.backgroundColor = isActive ? "var(--secondary-bg)" : "";
        element.style.boxShadow = isActive ? "var(--shadow)" : "";
        element.style.transform = isActive ? "scale(1.02)" : "";
        if (isActive && scrollIntoView) element.scrollIntoView({block: "nearest"});
    });
}
function resetActiveSearchResult() {
    activeSearchResultIndex = -1;
    syncActiveSearchResult();
}
function setActiveSearchResult(index, options = {}) {
    const results = getSearchResultElements();
    if (!results.length) {
        resetActiveSearchResult();
        return;
    }
    const maxIndex = results.length - 1;
    activeSearchResultIndex = Math.max(0, Math.min(index, maxIndex));
    syncActiveSearchResult(options);
}
function moveActiveSearchResult(delta = 1) {
    const results = getSearchResultElements();
    if (!results.length) return;
    if (activeSearchResultIndex < 0) {
        setActiveSearchResult(delta > 0 ? 0 : results.length - 1, {scrollIntoView: true});
        return;
    }
    const nextIndex = (activeSearchResultIndex + delta + results.length) % results.length;
    setActiveSearchResult(nextIndex, {scrollIntoView: true});
}
function activateActiveSearchResult() {
    const results = getSearchResultElements();
    const activeElement = results[activeSearchResultIndex];
    if (activeElement) {
        activeElement.click();
        return true;
    }
    return false;
}
function formatCalculatorResult(value) {
    if (!Number.isFinite(value)) return "";
    const normalized = Object.is(value, -0) ? 0 : value;
    if (Number.isInteger(normalized)) return `${normalized}`;
    return `${Number.parseFloat(normalized.toFixed(12))}`;
}
function evaluateCalculatorExpression(rawQuery = "") {
    const expression = `${rawQuery || ""}`.trim();
    if (expression.length < 3 || expression.length > 120) return null;
    if (!/[0-9]/.test(expression) || !/[+\-*/%^()]/.test(expression)) return null;
    if (!/^[0-9+\-*/%^().\s]+$/.test(expression)) return null;
    const tokens = [];
    let index = 0;
    while (index < expression.length) {
        const char = expression[index];
        if (/\s/.test(char)) {
            index += 1;
            continue;
        }
        if (/[+\-*/%^()]/.test(char)) {
            tokens.push({type: "operator", value: char});
            index += 1;
            continue;
        }
        if (/[0-9.]/.test(char)) {
            let value = "";
            let dotCount = 0;
            while (index < expression.length && /[0-9.]/.test(expression[index])) {
                if (expression[index] === ".") dotCount += 1;
                value += expression[index];
                index += 1;
            }
            if (dotCount > 1 || value === ".") return null;
            tokens.push({type: "number", value: Number.parseFloat(value)});
            continue;
        }
        return null;
    }
    if (!tokens.length) return null;
    let cursor = 0;
    const peek = () => tokens[cursor] || null;
    const take = (value) => {
        if (peek()?.value !== value) return false;
        cursor += 1;
        return true;
    };
    const parseExpression = () => parseAddSubtract();
    const parsePrimary = () => {
        const token = peek();
        if (!token) return null;
        if (take("+")) return parsePrimary();
        if (take("-")) {
            const value = parsePrimary();
            return value === null ? null : -value;
        }
        if (take("(")) {
            const value = parseExpression();
            if (value === null || !take(")")) return null;
            return value;
        }
        if (token.type === "number") {
            cursor += 1;
            return token.value;
        }
        return null;
    };
    const parsePower = () => {
        const left = parsePrimary();
        if (left === null) return null;
        if (take("^")) {
            const right = parsePower();
            return right === null ? null : left ** right;
        }
        return left;
    };
    const parseMultiplyDivide = () => {
        let value = parsePower();
        if (value === null) return null;
        while (peek() && ["*", "/", "%"].includes(peek().value)) {
            const operator = peek().value;
            cursor += 1;
            const right = parsePower();
            if (right === null) return null;
            if (operator === "*") value *= right;
            if (operator === "/") value /= right;
            if (operator === "%") value %= right;
        }
        return value;
    };
    function parseAddSubtract() {
        let value = parseMultiplyDivide();
        if (value === null) return null;
        while (peek() && ["+", "-"].includes(peek().value)) {
            const operator = peek().value;
            cursor += 1;
            const right = parseMultiplyDivide();
            if (right === null) return null;
            if (operator === "+") value += right;
            if (operator === "-") value -= right;
        }
        return value;
    }
    const result = parseExpression();
    if (result === null || cursor !== tokens.length) return null;
    const formattedResult = formatCalculatorResult(result);
    if (!formattedResult) return null;
    return {expression, result: formattedResult};
}
function renderCalculatorSearchResult(calculation) {
    if (!calculation) return;
    renderSearchResult({
        title: calculation.result,
        svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V13.5Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V18Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V13.5Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V18Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm2.498-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0 0 12 2.25Z" /></svg>`,
        action: () => {
            navigator.clipboard?.writeText?.(calculation.result);
        }
    }, `${calculation.expression} = ${calculation.result}`);
}
function escapeArticleSearchValue(value = "") {
    return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim();
}
function getArticleSearchTerms(rawQuery = "") {
    const normalizedQuery = String(rawQuery || "").replace(/\s+/g, " ").trim();
    if (!normalizedQuery) return [];
    const terms = normalizedQuery.split(" ").map(term => term.trim()).filter(Boolean);
    if (terms.length > 1) terms.push(normalizedQuery);
    return [...new Set(terms)];
}
function getSearchInputState(rawValue = "") {
    const value = String(rawValue || "");
    if (searchFilterMode === "description") return {query: value, articleField: "description", filtered: true};
    if (value.toLowerCase().startsWith(SEARCH_DESCRIPTION_PREFIX)) return {query: value.slice(SEARCH_DESCRIPTION_PREFIX.length), articleField: "description", filtered: true};
    return {query: value, articleField: "title", filtered: false};
}
function buildArticleSearchCommand(rawQuery = "", field = "title") {
    const terms = getArticleSearchTerms(rawQuery);
    if (!terms.length) return "";
    const articleField = field === "description" ? "description" : "title";
    const articleCondition = terms.map((term, index) => `${index === 0 ? `${articleField} ` : ""}CONTAINS "${escapeArticleSearchValue(term)}" IGNORE CASE`).join(" OR ");
    return `[articles] <${articleCondition}, LIMIT 10>`;
}
function levenshteinDistance(left = "", right = "") {
    const a = String(left || "").toLowerCase();
    const b = String(right || "").toLowerCase();
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let previous = Array.from({length: b.length + 1}, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
        const current = [i];
        for (let j = 1; j <= b.length; j += 1) {
            const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + substitutionCost);
        }
        previous = current;
    }
    return previous[b.length];
}
function resolveArticleRecords(response) {
    if (Array.isArray(response)) return response;
    if (!response || typeof response !== "object") return [];
    if (Array.isArray(response.articles)) return response.articles;
    const firstArrayEntry = Object.values(response).find(Array.isArray);
    return Array.isArray(firstArrayEntry) ? firstArrayEntry : [];
}
async function sendArticleCliCommand(command = "", {signal = null} = {}) {
    const normalizedCommand = String(command || "").trim();
    if (!normalizedCommand) return "";
    const usePost = normalizedCommand.length > 1500;
    const url = usePost ? `/api/cli?_=${Date.now()}` : `/api/cli?query=${encodeURIComponent(normalizedCommand)}&_=${Date.now()}`;
    const options = {method: usePost ? "POST" : "GET", cache: "no-store", headers: {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}};
    if (signal) options.signal = signal;
    if (usePost) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify({query: normalizedCommand});
    }
    const response = await fetch(url, options);
    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText.slice(0, 200)}` : ""}`);
    }
    const responseText = await response.text();
    const normalizedText = responseText.replace(/^\uFEFF/, "").trim();
    if (!normalizedText) return "";
    try {
        return JSON.parse(normalizedText);
    } catch (_) {
        return responseText;
    }
}
function buildArticlePortal(article = {}) {
    const title = `${article?.title || ""}`.trim() || "Untitled Article";
    return {title, svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25A8.966 8.966 0 0 1 18 3.75c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>`, recordMatches: [{command: "articles", id: article?.id, primaryLabel: title, secondaryLabel: `${article?.description || article?.link || article?.source || ""}`.trim(), record: article}]};
}
function enhanceArticleSearchResultIcon(result, article = {}, requestVersion = 0) {
    const articleId = `${article?.id || ""}`.trim();
    if (!result || !articleId) return;
    getClientContext().then((context = {}) => {
        if (context?.isRelayMode === true || requestVersion !== articleSearchRequestVersion) return;
        const nextIconUrl = articleImageUrl(articleId);
        if (!nextIconUrl) return;
        const probe = new Image();
        probe.onload = () => {
            if (requestVersion !== articleSearchRequestVersion || !document.body.contains(result)) return;
            const iconContainer = result.querySelector(".search-result-icon");
            if (!iconContainer) return;
            iconContainer.innerHTML = "";
            const image = document.createElement("img");
            image.src = nextIconUrl;
            image.alt = article?.title || "Article";
            image.className = "search-result-icon-image";
            iconContainer.append(image);
        };
        probe.src = nextIconUrl;
    });
}
async function appendArticleSearchResults(rawQuery = "", requestVersion = 0, articleField = "title", {signal = null} = {}) {
    const command = buildArticleSearchCommand(rawQuery, articleField);
    if (!command) return [];
    try {
        const response = await sendArticleCliCommand(command, {signal});
        if (requestVersion !== articleSearchRequestVersion) return [];
        const normalizedQuery = String(rawQuery || "").replace(/\s+/g, " ").trim();
        const sortField = articleField === "description" ? "description" : "title";
        const articles = resolveArticleRecords(response).filter(article => article && typeof article === "object").sort((left, right) => {
            const leftDistance = levenshteinDistance(left?.[sortField] || "", normalizedQuery);
            const rightDistance = levenshteinDistance(right?.[sortField] || "", normalizedQuery);
            if (leftDistance !== rightDistance) return leftDistance - rightDistance;
            return `${left?.title || ""}`.localeCompare(`${right?.title || ""}`);
        });
        articles.forEach(article => {
            const result = renderSearchResult(buildArticlePortal(article));
            enhanceArticleSearchResultIcon(result, article, requestVersion);
        });
        return articles;
    } catch (error) {
        if (isAbortError(error)) return [];
        if (requestVersion === articleSearchRequestVersion) console.error("Failed to search articles:", error);
        return [];
    }
}
function renderCachedSearchResults(rawQuery = "") {
    const query = String(rawQuery || "").trim().toLowerCase();
    const matchingPortals = searchablePortals().map((portal) => {
        const recordMatches = window.StandardRecordSearch?.getPortalMatches?.(portal, query) || [];
        const matchingHint = (portal.hints || []).find((hint) => hint.toLowerCase().includes(query));
        const exactHint = (portal.hints || []).find((hint) => hint.toLowerCase() === query);
        return {
            portal: {...portal, recordMatches},
            matchingHint,
            exactHint,
            hasMatch: Boolean(matchingHint) || recordMatches.length > 0
        };
    }).filter(({hasMatch}) => Boolean(hasMatch));
    const calculation = evaluateCalculatorExpression(rawQuery);
    renderCalculatorSearchResult(calculation);
    matchingPortals.forEach(({portal, matchingHint}) => {
        renderSearchResult(portal, matchingHint);
    });
    if (calculation || matchingPortals.length) {
        setActiveSearchResult(0);
    } else {
        resetActiveSearchResult();
    }
    return {calculation, matchingPortals};
}
function renderArticleSearchResults(rawQuery = "", requestVersion = 0, cachedSearch = {}, articleField = "title", options = {}) {
    return appendArticleSearchResults(rawQuery, requestVersion, articleField, options).then((articles) => {
        if (requestVersion !== articleSearchRequestVersion) return [];
        const hasCachedResults = Boolean(cachedSearch?.calculation) || Boolean(cachedSearch?.matchingPortals?.length);
        if (!hasCachedResults && articles.length) setActiveSearchResult(0);
        return articles;
    });
}
function openPortal(portal) {
    const primaryRecordMatch = Array.isArray(portal?.recordMatches) ? portal.recordMatches[0] : null;
    if (primaryRecordMatch?.command === "articles") {
        const article = primaryRecordMatch?.record || {};
        if (typeof window.StandardInternals?.openArticle === "function") {
            window.StandardInternals.openArticle(article);
        } else {
            modular.start("com.standard.internals");
            setTimeout(() => window.StandardInternals?.openArticle?.(article), 100);
        }
        return;
    }
    if (primaryRecordMatch?.command === "notes") {
        if (primaryRecordMatch?.record && typeof window.StandardNotes?.openNote === "function") {
            window.StandardNotes.openNote(primaryRecordMatch.record);
            return;
        }
    }
    if (primaryRecordMatch?.command === "events") {
        if (primaryRecordMatch?.record && typeof window.StandardCalendar?.openEvent === "function") {
            window.StandardCalendar.openEvent(primaryRecordMatch.record);
            return;
        }
    }
    if (primaryRecordMatch?.command === "categories") {
        if (typeof window.StandardCalendar?.openCategories === "function") {
            window.StandardCalendar.openCategories();
            return;
        }
    }
    if (primaryRecordMatch?.command === "contacts") {
        if (primaryRecordMatch?.record && typeof window.StandardContacts?.openContact === "function") {
            window.StandardContacts.openContact(primaryRecordMatch.record);
            return;
        }
    }
    if (primaryRecordMatch?.command === "alarms") {
        if (primaryRecordMatch?.record && typeof window.StandardAlarms?.openAlarm === "function") {
            window.StandardAlarms.openAlarm(primaryRecordMatch.record);
            return;
        }
    }
    if (primaryRecordMatch?.command === "files") {
        const filePath = `${primaryRecordMatch?.record?.path || ""}`.trim();
        if (filePath && typeof window.StandardFiles?.openFilePath === "function") {
            window.StandardFiles.openFilePath(filePath);
            return;
        }
    }
    if (typeof portal?.action === "function") {
        portal.action();
        return;
    }
    if (!portal?.serviceId) return;
    if ((portal.portalIndex || 0) === 0) {
        modular.start(portal.serviceId);
    } else {
        modular.show(portal.serviceId, portal.portalIndex);
    }
}
function renderSearchResult(portal, matchingHint) {
    const result = document.createElement("div");
    result.className = "search-result pointer medium-margin-bottom block bordered radius small-shadowed hover-zoom hover-shadowed background-background padded";
    result.setAttribute("role", "option");
    result.setAttribute("aria-selected", "false");
    const recordMatches = Array.isArray(portal?.recordMatches) ? portal.recordMatches : [];
    const primaryRecordMatch = recordMatches[0] || null;
    const icon = buildSearchResultIcon(portal);
    if (icon) {
        const iconContainer = document.createElement("div");
        iconContainer.className = "search-result-icon";
        iconContainer.append(icon);
        result.append(iconContainer);
    }
    const body = document.createElement("div");
    body.className = "search-result-body";
    const title = document.createElement("div");
    title.textContent = primaryRecordMatch?.primaryLabel || portal.title || "";
    body.append(title);
    if (recordMatches.length) {
        const records = document.createElement("div");
        records.className = "search-result-records faded";
        const primaryLine = document.createElement("div");
        primaryLine.textContent = primaryRecordMatch?.secondaryLabel || "";
        if (primaryLine.textContent) records.append(primaryLine);
        body.append(records);
    }
    if (matchingHint && !recordMatches.length) {
        const hint = document.createElement("div");
        hint.className = "faded no-events";
        hint.textContent = `${matchingHint}`;
        body.append(hint);
    }
    result.append(body);
    result.onclick = () => {
        cancelActiveArticleSearch({clearLoading: true});
        openPortal(portal);
        document.getElementById("search-box").value = "";
        clearSearchFilterPrefix();
        document.getElementById("search-results").empty();
        resetActiveSearchResult();
        document.getElementById("search-box").blur();
    };
    document.getElementById("search-results").append(result);
    return result;
}
document.getElementById("search-box").addEventListener("keydown", event => {
    if (event.key === "Backspace" && searchFilterMode === "description" && event.target.value === "" && !searchFilterAnimating) {
        event.preventDefault();
        removeSearchFilterPrefix();
        return;
    }
    if (event.key === "ArrowDown") {
        event.preventDefault();
        moveActiveSearchResult(1);
        return;
    }
    if (event.key === "ArrowUp") {
        event.preventDefault();
        moveActiveSearchResult(-1);
        return;
    }
    if (event.key === "Enter") {
        if (activateActiveSearchResult()) event.preventDefault();
        return;
    }
    if (event.key === "Escape") {
        event.preventDefault();
        event.target.blur();
    }
});
function setSearchFilterPrefixVisible(visible) {
    const prefix = document.getElementById("search-filter-prefix");
    if (!prefix) return;
    prefix.classList.toggle("hidden", !visible);
    prefix.classList.remove("removing");
}
function activateSearchFilterPrefix() {
    const searchBox = document.getElementById("search-box");
    if (!searchBox || searchFilterMode === "description") return;
    const value = String(searchBox.value || "");
    if (!value.toLowerCase().startsWith(SEARCH_DESCRIPTION_PREFIX)) return;
    searchFilterMode = "description";
    searchBox.value = value.slice(SEARCH_DESCRIPTION_PREFIX.length);
    setSearchFilterPrefixVisible(true);
}
function removeSearchFilterPrefix() {
    const searchBox = document.getElementById("search-box");
    const prefix = document.getElementById("search-filter-prefix");
    if (!searchBox) return;
    searchFilterAnimating = true;
    if (prefix) prefix.classList.add("removing");
    window.setTimeout(() => {
        searchFilterMode = "";
        searchFilterAnimating = false;
        setSearchFilterPrefixVisible(false);
        searchBox.value = "description";
        searchBox.classList.remove("search-filter-backspace");
        void searchBox.offsetWidth;
        searchBox.classList.add("search-filter-backspace");
        updateSearchResults();
    }, 140);
}
function clearSearchFilterPrefix() {
    searchFilterMode = "";
    searchFilterAnimating = false;
    setSearchFilterPrefixVisible(false);
    document.getElementById("search-box")?.classList.remove("search-filter-backspace");
}
function updateSearchResults() {
    const searchStatus = document.getElementById("search-status");
    const searchBox = document.getElementById("search-box");
    const searchResults = document.getElementById("search-results");
    abortActiveArticleSearchController();
    const currentArticleSearchVersion = ++articleSearchRequestVersion;
    searchStatus.isLoading();
    activateSearchFilterPrefix();
    const searchState = getSearchInputState(searchBox.value);
    const rawQuery = searchState.query.trim();
    const query = rawQuery.toLowerCase();
    searchResults.empty();
    if (!query) {
        resetActiveSearchResult();
        searchStatus.isLoading(false);
        return;
    }
    let cachedSearch = {calculation: null, matchingPortals: []};
    try {
        cachedSearch = searchState.filtered ? {calculation: null, matchingPortals: []} : renderCachedSearchResults(rawQuery);
    } catch (error) {
        console.error("Failed to search cached records:", error);
        resetActiveSearchResult();
    }
    const articleSearchController = beginArticleSearchRequest();
    renderArticleSearchResults(rawQuery, currentArticleSearchVersion, cachedSearch, searchState.articleField, {
        signal: articleSearchController?.signal || null
    }).finally(() => {
        finishArticleSearchRequest(articleSearchController);
        if (currentArticleSearchVersion === articleSearchRequestVersion) searchStatus.isLoading(false);
    });
}
document.getElementById("search-box").addEventListener("input", () => {
    updateSearchResults();
});
function updateTime() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeString = `${hours.toString()}:${minutes} ${ampm}`;
    document.getElementById('live-time').innerText = timeString;
}
updateTime();
setInterval(updateTime, 1000);
function initGlobalFileDrop(onFiles) {
    if (window.__stdGlobalFileDropInitialized) return;
    window.__stdGlobalFileDropInitialized = true;
    let dragDepth = 0;
    function activate(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        document.body.classList.add("drag-active");
    }
    function deactivate(e) {
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.remove("drag-active");
        dragDepth = 0;
    }
    document.addEventListener("dragenter", (e) => {
        dragDepth++;
        activate(e);
    });
    document.addEventListener("dragover", activate);
    document.addEventListener("dragleave", (e) => {
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) deactivate(e);
    });
    document.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length) onFiles(Array.from(dt.files));
        deactivate(e);
    });
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => e.preventDefault());
}
let globalDropUploadInFlight = false;
initGlobalFileDrop(async (files) => {
    if (globalDropUploadInFlight) {
        modular.error("Another file upload is already in progress");
        return;
    }
    const droppedFiles = Array.from(files || []);
    if (!droppedFiles.length) return;
    globalDropUploadInFlight = true;
    try {
        if (typeof window.StandardFilesUploadSelectedFiles === "function") {
            await window.StandardFilesUploadSelectedFiles(droppedFiles, {multiFileProgress: droppedFiles.length > 1});
            return;
        }
        const defaultDirectory = String(modular?.working_directory || "Documents").trim().replace(/\\/g, "/").replace(/\/+$/, "").replace(/^\/+/, "") || "Documents";
        const multiProgress = droppedFiles.length > 1 && typeof window.StandardUploads?.createMultiFileProgress === "function" ? window.StandardUploads.createMultiFileProgress(droppedFiles) : null;
        try {
            for (let index = 0; index < droppedFiles.length; index++) {
                const file = droppedFiles[index];
                const uploadUrl = `/api/upload?directory=${encodeURIComponent(defaultDirectory)}`;
                if (typeof window.StandardUploads?.uploadFile === "function") {
                    const response = await window.StandardUploads.uploadFile(file, uploadUrl, {label: `Uploading ${file.name || "file"}`, suppressProgress: !!multiProgress, onProgress: multiProgress ? progress => multiProgress.update({currentIndex: index, file, loaded: progress?.loaded || 0, total: progress?.total || file.size || 0, indeterminate: !!progress?.indeterminate}) : null});
                    if (!response?.ok) {
                        modular.error(`Upload failed (${response?.status || 0})`);
                        return;
                    }
                } else {
                    if (multiProgress) multiProgress.update({currentIndex: index, file, loaded: 0, total: file.size || 0, indeterminate: true});
                    const formData = new FormData();
                    formData.append("file", file);
                    const res = await fetch(uploadUrl, {method: "POST", body: formData});
                    if (!res.ok) {
                        modular.error(`Upload failed (${res.status})`);
                        return;
                    }
                    if (multiProgress) multiProgress.update({currentIndex: index, file, loaded: file.size || 1, total: file.size || 1});
                }
            }
        } finally {
            if (multiProgress) multiProgress.hide();
        }
        modular.refresh("com.standard.files");
        await window.StandardFilesRefreshCache?.();
    } finally {
        globalDropUploadInFlight = false;
    }
});
let serviceWindowCache = [];
function getSearchFocusProtectedRect() {
    const nodes = [
        document.querySelector("#search-box-container .search-box-field"),
        document.getElementById("interface-shortcuts")
    ].filter(node => node && window.getComputedStyle(node).display !== "none");
    const rects = nodes.map(node => node.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
    if (!rects.length) return null;
    const margin = 24;
    return {
        left: Math.max(0, Math.min(...rects.map(rect => rect.left)) - margin),
        top: Math.max(0, Math.min(...rects.map(rect => rect.top)) - margin),
        right: Math.min(window.innerWidth, Math.max(...rects.map(rect => rect.right)) + margin),
        bottom: Math.min(window.innerHeight, Math.max(...rects.map(rect => rect.bottom)) + margin)
    };
}
function rectsOverlap(left, top, width, height, rect) {
    if (!rect) return false;
    return left < rect.right && left + width > rect.left && top < rect.bottom && top + height > rect.top;
}
function getParkedServiceWindowPosition(win, index, lanes, protectedRect, margin) {
    const scale = 0.3;
    const visualWidth = Math.max(90, win.offsetWidth * scale);
    const visualHeight = Math.max(56, win.offsetHeight * scale);
    const side = index % 2 === 0 ? "left" : "right";
    const lane = lanes[side];
    const left = side === "left" ? margin : Math.max(margin, window.innerWidth - win.offsetWidth - margin);
    let top = lane.top;
    const visualLeft = left + ((win.offsetWidth - visualWidth) / 2);
    if (rectsOverlap(visualLeft, top + ((win.offsetHeight - visualHeight) / 2), visualWidth, visualHeight, protectedRect)) top = protectedRect.bottom + margin - ((win.offsetHeight - visualHeight) / 2);
    if (top + visualHeight > window.innerHeight - margin) top = Math.max(margin, (protectedRect?.top ?? window.innerHeight) - visualHeight - margin);
    lane.top = top + visualHeight + margin;
    return {left, top};
}
function parkServiceWindows() {
    const windows = Array.from(document.querySelectorAll('.draggable-window:not(.minimized)'));
    if (!windows.length) return;
    if (!serviceWindowCache.length) {
        serviceWindowCache = windows.map(win => {
            const rect = win.getBoundingClientRect();
            return {element: win, left: win.style.left || `${rect.left}px`, top: win.style.top || `${rect.top}px`};
        });
    }
    const margin = 16;
    const protectedRect = getSearchFocusProtectedRect();
    const lanes = {left: {top: margin}, right: {top: margin}};
    windows.forEach((win, index) => {
        win.classList.add('service-window-parked');
        const target = getParkedServiceWindowPosition(win, index, lanes, protectedRect, margin);
        const targetTop = target.top;
        const targetLeft = target.left;
        win.style.top = `${targetTop}px`;
        win.style.left = `${targetLeft}px`;
        if (win.portal && typeof win.portal.minimize === "function") win.portal.minimize({left: win.style.left, top: win.style.top});
    });
}
function restoreServiceWindows() {
    if (!serviceWindowCache.length) return;
    serviceWindowCache.forEach(({element, left, top}) => {
        if (!document.body.contains(element)) return;
        if (element.portal && typeof element.portal.restoreFromMinimize === "function") {
            element.portal.restoreFromMinimize();
        } else {
            element.classList.remove('minimized');
            element.style.transform = 'scale(1)';
            element.style.overflow = 'visible';
        }
        element.style.left = left;
        element.style.top = top;
        element.classList.remove('service-window-parked');
    });
    serviceWindowCache = [];
}
function getOpenPortalWindows() {
    return Array.from(document.querySelectorAll(".draggable-window:not(.widget-window)"))
        .filter(element => document.body.contains(element) && !element.classList.contains("minimized"))
        .sort((a, b) => {
            const aZ = Number.parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
            const bZ = Number.parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
            return aZ - bZ;
        });
}
function focusSearchBoxForTyping() {
    const searchBox = document.getElementById("search-box");
    if (!searchBox) return null;
    parkServiceWindows();
    searchBox.focus();
    return searchBox;
}
function getFocusedPortalToolByTitle(title = "") {
    const focusedWindow = document.querySelector(".draggable-window.window-focused:not(.widget-window)");
    if (!focusedWindow) return null;
    const normalizedTitle = `${title || ""}`.trim().toLowerCase();
    if (!normalizedTitle) return null;
    return focusedWindow.querySelector(`[data-portal-tool-title='${normalizedTitle}'], [aria-label='${title}'], [title='${title}']`);
}
function getFocusedPortalSaveTool() {
    return getFocusedPortalToolByTitle("Save");
}
function getFocusedPortalEditTool() {
    return getFocusedPortalToolByTitle("Edit");
}
function getFocusedPortalSearchTool() {
    return getFocusedPortalToolByTitle("Search");
}
function getFocusedPortalWindow() {
    return document.querySelector(".draggable-window.window-focused:not(.widget-window)");
}
let lastHandledTileShortcutDirection = "";
function tileFocusedPortalFromShortcut(e) {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
    const tileDirectionByKey = {
        ArrowLeft: "left",
        Left: "left",
        ArrowRight: "right",
        Right: "right",
        ArrowUp: "top",
        Up: "top",
        ArrowDown: "bottom",
        Down: "bottom"
    };
    const tileDirection = tileDirectionByKey[e.key];
    if (!tileDirection) return false;
    if (e.type === "keyup" && lastHandledTileShortcutDirection === tileDirection) {
        lastHandledTileShortcutDirection = "";
        e.preventDefault();
        return true;
    }
    const activeElement = document.activeElement;
    const interactiveSelector = "input, textarea, button, select, [contenteditable='true'], [role='textbox']";
    if (activeElement?.matches?.(interactiveSelector)) return false;
    const focusedWindow = getFocusedPortalWindow();
    if (!focusedWindow?.portal || typeof focusedWindow.portal.tile !== "function") return false;
    e.preventDefault();
    focusedWindow.portal.tile(tileDirection);
    lastHandledTileShortcutDirection = e.type === "keydown" ? tileDirection : "";
    return true;
}
document.addEventListener("keydown", function (e) {
    const activeElement = document.activeElement;
    const interactiveSelector = "input, textarea, button, select, [contenteditable='true'], [role='textbox']";
    const interactiveFocused = activeElement?.matches?.(interactiveSelector);
    if (e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "s") {
        const saveTool = getFocusedPortalSaveTool();
        e.preventDefault();
        if (saveTool) {
            saveTool.click();
        } else {
            modular.error("No save in this app");
        }
        return;
    }
    if (e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "m") {
        const editTool = getFocusedPortalEditTool();
        e.preventDefault();
        if (editTool) {
            editTool.click();
        } else {
            modular.error("No edit in this app");
        }
        return;
    }
    if (e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "g") {
        const searchTool = getFocusedPortalSearchTool();
        e.preventDefault();
        if (searchTool) {
            searchTool.click();
        } else {
            modular.error("No search in this app");
        }
        return;
    }
    if (tileFocusedPortalFromShortcut(e)) return;
    if (e.altKey && e.key.toLowerCase() === "w" && !e.ctrlKey && !e.metaKey && !e.shiftKey && !interactiveFocused) {
        const focusedWindow = getFocusedPortalWindow();
        if (focusedWindow?.portal && typeof focusedWindow.portal.hide === "function") {
            e.preventDefault();
            focusedWindow.portal.hide();
            return;
        }
    }
    if (e.altKey && e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey && !e.shiftKey && !interactiveFocused) {
        const openPortalWindows = getOpenPortalWindows();
        if (openPortalWindows.length) {
            const focusedWindow = getFocusedPortalWindow();
            const focusedIndex = openPortalWindows.indexOf(focusedWindow);
            const nextWindow = openPortalWindows[(focusedIndex + 1 + openPortalWindows.length) % openPortalWindows.length];
            if (nextWindow && typeof modular?.bringToFront === "function") {
                e.preventDefault();
                modular.bringToFront(nextWindow);
                return;
            }
        }
    }
    if (e.ctrlKey && !e.shiftKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "f") {
        const searchBox = focusSearchBoxForTyping();
        if (searchBox) {
            e.preventDefault();
        }
        return;
    }
}, true);
document.addEventListener("keyup", function (e) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "Up" && e.key !== "Down") return;
    tileFocusedPortalFromShortcut(e);
}, true);
document.getElementById("search-box")?.addEventListener("blur", restoreServiceWindows);
document.querySelector(".status-indicator").popoutmenu([{
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>`,
    label: "Refresh",
    action: () => location.reload()
}, {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
    label: "Disconnect",
    destructive: true,
    action: () => window.location = "/logout"
}]);