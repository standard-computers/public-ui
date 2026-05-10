(() => {
    const CACHE_NAME = "standard-browser-cache-v1";
    const INDEX_KEY = "standard-browser-cache-index-v1";
    const CACHE_URL_PREFIX = "/__standard_browser_cache__";

    const supportsBrowserCache = () => typeof window !== "undefined" && "caches" in window && typeof localStorage !== "undefined";
    const nowIso = () => new Date().toISOString();
    const asString = value => `${value ?? ""}`.trim();
    const safeIdPart = value => encodeURIComponent(asString(value) || "default");
    const buildEntryId = (interfaceName, key, format = "") => [asString(interfaceName), asString(key), asString(format)].join("::");
    const buildRequestUrl = (interfaceName, key, format = "") => {
        const params = new URLSearchParams();
        if (format) params.set("format", format);
        return `${window.location.origin}${CACHE_URL_PREFIX}/${safeIdPart(interfaceName)}/${safeIdPart(key)}${params.toString() ? `?${params}` : ""}`;
    };
    const readIndex = () => {
        try {
            const parsed = JSON.parse(localStorage.getItem(INDEX_KEY) || "{}");
            return parsed && typeof parsed === "object" && parsed.entries && typeof parsed.entries === "object"
                ? parsed
                : {version: 1, entries: {}};
        } catch (_) {
            return {version: 1, entries: {}};
        }
    };
    const writeIndex = index => {
        try {
            localStorage.setItem(INDEX_KEY, JSON.stringify({
                version: 1,
                updatedAt: nowIso(),
                entries: index?.entries && typeof index.entries === "object" ? index.entries : {}
            }));
        } catch (_) {
        }
    };
    const inferKind = (contentType = "", format = "") => {
        const type = `${contentType || ""}`.toLowerCase();
        const extension = `${format || ""}`.toLowerCase();
        if (type.includes("application/json") || extension === "json") return "json";
        if (type.startsWith("image/") || /^(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(extension)) return "image";
        if (type.startsWith("text/") || ["txt", "html", "css", "js", "md", "csv"].includes(extension)) return "text";
        return "blob";
    };
    const blobToDataUrl = blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(reader.error || new Error("Failed to read cache blob"));
        reader.readAsDataURL(blob);
    });
    const responseFromValue = (value, {format = "", contentType = "", label = "", source = ""} = {}) => {
        if (value instanceof Response) {
            return {response: value, size: Number(value.headers.get("content-length")) || 0, contentType: value.headers.get("content-type") || contentType || "application/octet-stream", label, source};
        }
        if (value instanceof Blob) {
            return {
                response: new Response(value, {headers: {"Content-Type": contentType || value.type || "application/octet-stream"}}),
                size: value.size || 0,
                contentType: contentType || value.type || "application/octet-stream",
                label,
                source
            };
        }
        if (typeof value === "string") {
            const resolvedType = contentType || (format === "json" ? "application/json" : "text/plain; charset=utf-8");
            return {
                response: new Response(value, {headers: {"Content-Type": resolvedType}}),
                size: value.length,
                contentType: resolvedType,
                label,
                source
            };
        }
        const json = JSON.stringify(value ?? {}, null, 2);
        return {
            response: new Response(json, {headers: {"Content-Type": contentType || "application/json"}}),
            size: json.length,
            contentType: contentType || "application/json",
            label,
            source
        };
    };
    const openCache = async () => {
        if (!supportsBrowserCache()) throw new Error("Browser cache is unavailable");
        return caches.open(CACHE_NAME);
    };
    const getResponse = async (interfaceName, key, options = {}) => {
        const cache = await openCache();
        const request = new Request(buildRequestUrl(interfaceName, key, options.format || ""), {method: "GET"});
        return cache.match(request);
    };
    const read = async (interfaceName, key, options = {}) => {
        const response = await getResponse(interfaceName, key, options);
        if (!response) return null;
        const responseType = options.responseType || "";
        if (responseType === "response") return response;
        if (responseType === "blob") return response.blob();
        if (responseType === "dataUrl") return blobToDataUrl(await response.blob());
        if (responseType === "objectUrl") return URL.createObjectURL(await response.blob());
        const contentType = `${response.headers.get("content-type") || ""}`.toLowerCase();
        if (responseType === "json" || options.format === "json" || contentType.includes("application/json")) {
            return response.json();
        }
        return response.text();
    };
    const write = async (interfaceName, key, value, options = {}) => {
        const normalizedInterface = asString(interfaceName);
        const normalizedKey = asString(key);
        if (!normalizedInterface) throw new Error("Cache interface is required");
        if (!normalizedKey) throw new Error("Cache key is required");
        const format = asString(options.format || "");
        const prepared = responseFromValue(value, options);
        const response = prepared.response;
        const cache = await openCache();
        const requestUrl = buildRequestUrl(normalizedInterface, normalizedKey, format);
        await cache.put(new Request(requestUrl, {method: "GET"}), response.clone());
        const contentType = prepared.contentType || response.headers.get("content-type") || "application/octet-stream";
        const index = readIndex();
        const id = buildEntryId(normalizedInterface, normalizedKey, format);
        const existing = index.entries[id] || {};
        index.entries[id] = {
            id,
            interfaceName: normalizedInterface,
            key: normalizedKey,
            format,
            label: asString(options.label || prepared.label || existing.label || normalizedKey),
            source: asString(options.source || prepared.source || existing.source || ""),
            contentType,
            kind: inferKind(contentType, format),
            size: Number(options.size || prepared.size || existing.size || 0),
            url: requestUrl,
            createdAt: existing.createdAt || nowIso(),
            updatedAt: nowIso()
        };
        writeIndex(index);
        return {...index.entries[id]};
    };
    const remove = async (interfaceName, key, options = {}) => {
        const normalizedInterface = asString(interfaceName);
        const normalizedKey = asString(key);
        const format = asString(options.format || "");
        const cache = await openCache();
        const deleted = await cache.delete(new Request(buildRequestUrl(normalizedInterface, normalizedKey, format), {method: "GET"}));
        const index = readIndex();
        delete index.entries[buildEntryId(normalizedInterface, normalizedKey, format)];
        writeIndex(index);
        return deleted;
    };
    const list = async ({interfaceName = "", kind = ""} = {}) => {
        const index = readIndex();
        return Object.values(index.entries || {})
            .filter(entry => !interfaceName || entry.interfaceName === interfaceName)
            .filter(entry => !kind || entry.kind === kind)
            .sort((left, right) => `${right.updatedAt || ""}`.localeCompare(`${left.updatedAt || ""}`));
    };
    const clear = async ({interfaceName = ""} = {}) => {
        const entries = await list({interfaceName});
        await Promise.all(entries.map(entry => remove(entry.interfaceName, entry.key, {format: entry.format}).catch(() => false)));
        return entries.length;
    };
    const createAdapter = interfaceName => ({
        get: (key, options = {}) => read(interfaceName, key, options),
        create: (key, value, options = {}) => write(interfaceName, key, value, options),
        set: (key, value, options = {}) => write(interfaceName, key, value, options),
        delete: (key, options = {}) => remove(interfaceName, key, options),
        list: (options = {}) => list({...options, interfaceName}),
        clear: () => clear({interfaceName})
    });

    window.StandardBrowserCache = {
        available: supportsBrowserCache,
        get: read,
        getResponse,
        set: write,
        create: write,
        delete: remove,
        list,
        clear,
        createAdapter,
        blobToDataUrl
    };
})();
