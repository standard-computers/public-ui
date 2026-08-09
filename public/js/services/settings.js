(async () => {

    let default_settings_options = {
        name: "Default",
        font_family: "",
        bold_font: false,
        transparency: true,
        shadows: true,
        font_size: 16,
        shortcut_icon_size: 28,
        foreground: "#3e3e3e",
        primary: "#001922",
        secondary: "",
        background: "#d1d1d1",
        background_image: undefined,
        border_color: "#afafaf",
        border_radius: 10,
        border_width: 1,
        interface_state: true,
        use_svg_icons: true,
        use_cursor: true,
        grid_background: false,
        hide_shortcuts: false,
        kiosk_mode: false,
        disable_bar: false,
        media_widget: true,
        video_widget: true,
    }

    window.StandardUI = window.StandardUI || {};
    window.StandardUI.defaultTheme = {...default_settings_options};
    let ui_settings_options = {...default_settings_options};
    const user_theme = window.StandardUI?.currentTheme || await modular.user.theme();
    if(user_theme != null) ui_settings_options = {...default_settings_options, ...user_theme};
    const interfaceIconSizes = [28, 32, 36, 40, 44, 48];
    const interfaceIconSizePicker = () => div({
        style: "number-picker no-scroll",
        id: "shortcut_icon_size",
        content: children(interfaceIconSizes.map(size => div({
            style: `number animated ${Number(ui_settings_options.shortcut_icon_size) === size ? "selected-number" : ""}`.trim(),
            content: size,
            value: size
        })))
    });
    const BACKGROUND_IMAGE_CACHE_KEY = "ui-background";
    const BACKGROUND_IMAGE_CACHE_INTERFACE = "com.standard.settings";
    const BACKGROUND_IMAGE_META_KEY = "ui-background-meta";
    let latestDeviceInfo = null;
    const defaultDeviceInfo = {serial: "Unknown", config: {}, network: {}, storage: {}, volume: {}};

    const getDeviceInfo = () => {
        const sharedStatus = window.StandardDeviceStatus;
        const statusPromise = sharedStatus?.data
            ? Promise.resolve(sharedStatus.data)
            : sharedStatus?.promise;
        return Promise.resolve(statusPromise || defaultDeviceInfo).then((response) => {
            latestDeviceInfo = response || defaultDeviceInfo;
            return latestDeviceInfo;
        }).catch(() => {
            latestDeviceInfo = defaultDeviceInfo;
            return defaultDeviceInfo;
        });
    };

    const downloadDeviceInfo = () => {
        if (!latestDeviceInfo) return;
        const payload = JSON.stringify(latestDeviceInfo, null, 2);
        const blob = new Blob([payload], {type: "application/json"});
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = "device-status.json";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(href);
    };

    const formatStorageBytes = (value) => {
        const bytes = Number(value);
        if (!Number.isFinite(bytes) || bytes < 0) return "Unavailable";
        if (bytes === 0) return "0 B";
        const units = ["B", "KB", "MB", "GB", "TB"];
        const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        const amount = bytes / (1024 ** unitIndex);
        return `${amount.toLocaleString(undefined, {maximumFractionDigits: unitIndex === 0 ? 0 : 1})} ${units[unitIndex]}`;
    };

    let standardsRequestVersion = 0;
    let sharedThemes = [];
    let themeTestTimer = null;
    let themeTestCountdownTimer = null;

    const escapeHtml = (value = "") => `${value}`.replace(/[&<>"']/g, (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[character] || character));

    const parseStandardsResponse = (raw = "") => {
        const text = `${raw || ""}`;
        const matches = [...text.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z0-9_]+)/g)];
        const seen = new Set();
        return matches.map(([, name, reference]) => ({name, reference})).filter(({name}) => {
            const key = name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    const INTERFACES_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"/></svg>`;

    const getPlatformInterfaces = () => {
        const interfaces = typeof window.StandardPlatformInterfaces?.all === "function" ? window.StandardPlatformInterfaces.all() : [];
        return interfaces.filter(item => item?.serviceId && item?.title && item.serviceId !== "com.standard.internals");
    };

    const isPlatformInterfaceEnabled = (serviceId) => {
        if (typeof window.StandardPlatformInterfaces?.isEnabled === "function") return window.StandardPlatformInterfaces.isEnabled(serviceId);
        return true;
    };

    const openInterfaceSettings = async (app = {}) => {
        const serviceId = String(app?.serviceId || "").trim();
        if (!serviceId) return;
        if (typeof window.StandardInternals?.openAppSettings !== "function") {
            modular.start("com.standard.internals");
            for (let attempt = 0; attempt < 20; attempt += 1) {
                if (typeof window.StandardInternals?.openAppSettings === "function") break;
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        if (typeof window.StandardInternals?.openAppSettings === "function") {
            window.StandardInternals.openAppSettings(serviceId, {title: app?.title || serviceId});
        } else {
            modular.error("Settings viewer is not ready yet");
        }
    };

    const renderInterfaceIcon = (app) => {
        const icon = `${app?.icon || ""}`.trim();
        if (!icon) return INTERFACES_ICON;
        return icon.startsWith("<svg") ? icon : `<img src="${escapeHtml(icon)}" style="cover" alt="${escapeHtml(app.title || "")}"/>`;
    };

    const renderInterfacesList = () => {
        const root = document.getElementById("settings-interfaces-list");
        if (!root) return;
        root.innerHTML = getPlatformInterfaces().map((app) => {
            const serviceId = escapeHtml(app.serviceId);
            const enabled = isPlatformInterfaceEnabled(app.serviceId);
            return div({style: `settings-interface-item bordered radius ${enabled ? "" : "settings-interface-disabled"}`, content: children([
                div({style: "settings-interface-row pointer", data: serviceId, content: children([
                    div({style: "settings-interface-icon", content: renderInterfaceIcon(app)}),
                    div({style: "settings-interface-copy", content: children([
                        div({style: "settings-interface-title", content: escapeHtml(app.title)}),
                        div({style: "settings-interface-id faded", content: serviceId})
                    ])}),
                    div({style: "settings-interface-state faded", content: enabled ? "Enabled" : "Disabled"})
                ])}),
                div({style: "settings-interface-drawer", data: serviceId, content: children([
                    div({style: "settings-interface-drawer-inner padded", content: children([
                        div({style: "settings-interface-toggle float-right", content: children([
                            switcher({id: `settings-interface-enabled-${serviceId}`, checked: enabled})
                        ])}),
                        button({style: "tiny inner-radius", data: serviceId, content: "Settings"}),
                    ])})
                ])})
            ])});
        }).join("");
        root.querySelectorAll(".settings-interface-row").forEach((row) => {
            row.onclick = () => {
                const item = row.closest(".settings-interface-item");
                if (!item) return;
                root.querySelectorAll(".settings-interface-item.open").forEach((openItem) => {
                    if (openItem !== item) openItem.classList.remove("open");
                });
                item.classList.toggle("open");
            };
        });
        root.querySelectorAll(".settings-interface-drawer button[data]").forEach((settingsButton) => {
            settingsButton.onclick = (event) => {
                event.stopPropagation();
                const serviceId = settingsButton.getAttribute("data") || "";
                const app = getPlatformInterfaces().find(item => item.serviceId === serviceId) || {serviceId};
                if (typeof window.StandardAppSettings?.hasSettings === "function" && !window.StandardAppSettings.hasSettings(serviceId)) {
                    alertDialogue({title: "Settings", content: "This interfaces does not have any settings"});
                    return;
                }
                void openInterfaceSettings(app);
            };
        });
        getPlatformInterfaces().forEach((app) => {
            const inputId = `settings-interface-enabled-${app.serviceId}`;
            const toggle = document.getElementById(inputId);
            if (!toggle) return;
            if (app.required) toggle.disabled = true;
            toggle.onchange = async (event) => {
                const enabled = event.target?.checked === true;
                if (typeof window.StandardPlatformInterfaces?.setEnabled !== "function") return;
                const savedEnabled = await window.StandardPlatformInterfaces.setEnabled(app.serviceId, enabled);
                event.target.checked = savedEnabled;
                renderInterfacesList();
                modular.success(savedEnabled ? `${app.title} enabled` : `${app.title} disabled`);
            };
        });
    };

    const initializeInterfacesRoute = async () => {
        const root = document.getElementById("settings-interfaces-list");
        if (!root) return;
        root.innerHTML = div({style: "faded small-padding", content: "Loading interfaces..."});
        try {
            if (typeof window.StandardPlatformInterfaces?.load === "function") {
                await window.StandardPlatformInterfaces.load();
            }
            renderInterfacesList();
        } catch (_) {
            root.innerHTML = div({style: "faded small-padding", content: "Unable to load interfaces."});
        }
    };

    const HOST_CONFIG_FIELDS = [
        {name: "name", defaultValue: "standard", readable: true, editable: false, description: "The host's product or installation name."},
        {name: "version", defaultValue: "1.0.0", readable: true, editable: false, description: "The version of the Standard host software currently running."},
        {name: "master", defaultValue: true, readable: true, editable: false, description: "Whether this host operates as the master node."},
        {name: "server_port", defaultValue: 9002, readable: true, editable: false, description: "The TCP port used by the host server."},
        {name: "server_bind_address", defaultValue: "0.0.0.0", readable: true, editable: false, description: "The network address on which the host server listens; 0.0.0.0 accepts connections on every interface."},
        {name: "mode", defaultValue: "client", readable: true, editable: false, description: "The host's operating role, such as client or server."},
        {name: "relay", defaultValue: "relay.standardcomputers.net", readable: true, editable: false, description: "The relay service used to route remote Standard connections."},
        {name: "ai_host", defaultValue: "http://127.0.0.1:11434/api/generate", readable: true, editable: true, description: "The HTTP endpoint used to generate responses with the configured AI model."},
        {name: "voice", defaultValue: "en_GB-northern_english_male-medium", readable: true, editable: true, description: "The text-to-speech voice identifier used for spoken responses."},
        {name: "model", defaultValue: "standard || phi", readable: true, editable: true, description: "The AI model the host uses when generating responses."},
        {name: "sms", defaultValue: true, readable: true, editable: true, description: "Allows the host to use SMS messaging features."},
        {name: "email", defaultValue: true, readable: true, editable: true, description: "Allows the host to use email features."},
        {name: "spoken", defaultValue: true, readable: true, editable: true, description: "Allows the host to produce spoken responses."},
        {name: "remote_changes", defaultValue: true, readable: true, editable: true, description: "Allows configuration and data changes requested through remote connections."},
        {name: "cli_output", defaultValue: true, readable: true, editable: true, description: "Allows command-line output to be returned to connected clients."},
        {name: "smtp_enabled", defaultValue: true, readable: true, editable: true, description: "Enables the SMTP service used to send and receive email; the email standard must be loaded."},
        {name: "nas_enabled", defaultValue: false, readable: true, editable: false, description: "Whether network-attached storage integration is enabled."},
        {name: "preload_articles", defaultValue: false, readable: true, editable: true, description: "Loads bulletin articles in advance so they are ready for use."},
        {name: "release_cadence", defaultValue: 86400, readable: true, editable: true, description: "The interval in seconds between bulletin and software update checks."},
        {name: "indexing_cadence", defaultValue: 21600, readable: true, editable: true, description: "The interval in seconds between file-indexing runs."},
        {name: "relay_response_timeout", defaultValue: 30, readable: true, editable: true, description: "The number of seconds the relay waits for a command response."}
    ];

    const isBooleanConfigField = (field) => typeof field.defaultValue === "boolean";

    const normalizeConfigBoolean = (value) => value === true || value === 1 || `${value}`.trim().toLowerCase() === "true";

    const escapeConfigValue = (value) => `"${String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

    const configDisplayValue = (field, values = {}) => {
        if (!field.readable) return "Not available";
        return Object.prototype.hasOwnProperty.call(values, field.name) ? values[field.name] : field.defaultValue;
    };

    const saveHostConfigValue = async (field, value, inputNode) => {
        if (!field?.editable) return;
        if (inputNode) inputNode.disabled = true;
        try {
            const response = await CLI.send(`$config: ${field.name}: ${escapeConfigValue(value)}`);
            if (typeof response === "string" && /^(UNKNOWN|INVALID|FAILED|EMAIL STANDARD)/i.test(response.trim())) throw new Error(response);
            modular.success(`${field.name} updated`);
            await initializeConfigRoute();
        } catch (error) {
            console.error(`Failed to update config value ${field.name}:`, error);
            modular.error(`Unable to update ${field.name}`);
            if (inputNode) inputNode.disabled = false;
        }
    };

    const renderConfigField = (field, values) => {
        const value = configDisplayValue(field, values);
        const labelMarkup = label({input: `host-config-${field.name}`, style: "inline small-padding-top", title: field.description, content: escapeHtml(field.name)});
        let control;
        if (!field.readable) {
            control = div({style: "faded align-right small-padding-top", title: field.description, content: "Not available"});
        } else if (field.editable && isBooleanConfigField(field)) {
            control = switcher({id: `host-config-${field.name}`, style: "align-right", checked: normalizeConfigBoolean(value), onchange: event => saveHostConfigValue(field, event.target?.checked === true, event.target)});
        } else if (field.editable) {
            const inputType = typeof field.defaultValue === "number" ? "number" : "text";
            control = input({id: `host-config-${field.name}`, type: inputType, value: `${value}`, title: `${field.description} Changes are saved when you leave the field.`, onchange: event => saveHostConfigValue(field, event.target?.value ?? "", event.target)});
        } else {
            control = div({style: "align-right small-padding-top", title: field.description, content: escapeHtml(`${value}`)});
        }
        return div({style: "bi border radius padded spaced", title: field.description, content: children([labelMarkup, control])});
    };

    const initializeConfigRoute = async () => {
        const root = document.getElementById("settings-config-list");
        if (!root) return;
        root.innerHTML = div({style: "faded small-padding", content: "Loading host config..."});
        try {
            const response = await CLI.send("$config");
            const values = response && typeof response === "object" && !Array.isArray(response) ? (response.config && typeof response.config === "object" ? response.config : response) : {};
            root.innerHTML = HOST_CONFIG_FIELDS.map(field => renderConfigField(field, values)).join("");
        } catch (error) {
            console.error("Failed to load host config:", error);
            root.innerHTML = div({style: "faded small-padding", content: "Unable to load host config."});
        }
    };

    const parseStandardDataPayload = (response) => {
        if (typeof response !== "string") return response;
        try {
            return JSON.parse(response);
        } catch (_) {
            return response;
        }
    };

    const flattenStandardRow = (value, prefix = "", output = {}) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            Object.entries(value).forEach(([key, childValue]) => flattenStandardRow(childValue, prefix ? `${prefix}.${key}` : key, output));
            return output;
        }
        output[prefix || "value"] = Array.isArray(value) ? JSON.stringify(value) : (value ?? "");
        return output;
    };

    const normalizeStandardRows = (standardData) => {
        if (Array.isArray(standardData)) return standardData.map((item) => flattenStandardRow(item));
        if (standardData && typeof standardData === "object") {
            const nestedArray = Object.values(standardData).find(Array.isArray);
            if (nestedArray) return nestedArray.map((item) => flattenStandardRow(item));
            const entries = Object.entries(standardData);
            if (entries.length && entries.every(([, value]) => value && typeof value === "object" && !Array.isArray(value))) return entries.map(([key, value]) => flattenStandardRow(value, "", {key}));
            return [flattenStandardRow(standardData)];
        }
        return [{value: standardData ?? ""}];
    };

    const escapeCsvValue = (value = "") => {
        const text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
    };

    const standardDataToCsv = (standardData) => {
        const rows = normalizeStandardRows(standardData);
        const headers = [];
        rows.forEach((row) => Object.keys(row).forEach((key) => {
            if (!headers.includes(key)) headers.push(key);
        }));
        if (!headers.length) headers.push("value");
        return [headers.map(escapeCsvValue).join(","), ...rows.map((row) => headers.map((header) => escapeCsvValue(row?.[header] ?? "")).join(","))].join("\n");
    };

    const waitForSheetsCsvLoader = async () => {
        if (typeof window.StandardSheets?.openCsvContent === "function") return window.StandardSheets.openCsvContent;
        modular.start("com.standard.editor.sheet");
        for (let attempt = 0; attempt < 20; attempt += 1) {
            if (typeof window.StandardSheets?.openCsvContent === "function") return window.StandardSheets.openCsvContent;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return null;
    };

    const formatBytes = (value = 0) => {
        const bytes = Number(value) || 0;
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatCacheTimestamp = (value = "") => {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString();
    };

    const openCacheFileInInternals = async (entry = {}, triggerNode = null) => {
        const interfaceName = entry?.interfaceName || "";
        const cacheKey = entry?.key || "";
        if (!interfaceName || !cacheKey) return;
        try {
            if (entry.kind === "image") {
                const source = await window.StandardBrowserCache?.get?.(interfaceName, cacheKey, {format: entry.format || "", responseType: "objectUrl"});
                if (!source) throw new Error("Cache image not found");
                if (typeof window.StandardInternals?.openImageSource === "function") {
                    window.StandardInternals.openImageSource(source, {title: entry.label || cacheKey, path: `cache/${interfaceName}/${cacheKey}`, isObjectUrl: true, revokePrevious: true, sourceNode: triggerNode});
                } else {
                    modular.start("com.standard.internals");
                    modular.error("Internals viewer is not ready yet");
                }
                return;
            }
            const value = await window.StandardBrowserCache?.get?.(interfaceName, cacheKey, {format: entry.format || "", responseType: entry.kind === "blob" ? "blob" : ""});
            const decoded = value instanceof Blob ? `Binary cache entry\n\nInterface: ${interfaceName}\nKey: ${cacheKey}\nType: ${entry.contentType || value.type || "application/octet-stream"}\nSize: ${formatBytes(entry.size || value.size || 0)}` : (typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2));
            if (typeof window.StandardInternals?.openTextContent === "function") {
                window.StandardInternals.openTextContent(`cache/${interfaceName}/${cacheKey}`, decoded, {readOnly: true, sourceNode: triggerNode});
            } else {
                modular.start("com.standard.internals");
                modular.error("Internals viewer is not ready yet");
            }
        } catch (_) {
            modular.error("Unable to open cache file");
        }
    };

    const openStandardDataInInternals = async (standardReference = "", triggerNode = null) => {
        const normalizedReference = `${standardReference || ""}`.trim();
        if (!normalizedReference) return;
        try {
            const response = await CLI.send(`[${normalizedReference}]`);
            const standardData = parseStandardDataPayload(response);
            if (typeof window.StandardInternals?.openStandardData !== "function") {
                modular.start("com.standard.internals");
                for (let attempt = 0; attempt < 20; attempt += 1) {
                    if (typeof window.StandardInternals?.openStandardData === "function") break;
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            if (typeof window.StandardInternals?.openStandardData === "function") {
                window.StandardInternals.openStandardData(normalizedReference, standardData, {sourceNode: triggerNode});
            } else {
                modular.error("Internals data viewer is not ready yet");
            }
        } catch (_) {
            modular.error("Unable to load standard data");
        }
    };

    const openStandardDataInSheets = async (standardReference = "", standardName = "", triggerNode = null) => {
        const normalizedReference = `${standardReference || ""}`.trim();
        if (!normalizedReference) return;
        try {
            const response = await CLI.send(`[${normalizedReference}]`);
            const standardData = parseStandardDataPayload(response);
            const openCsvContent = await waitForSheetsCsvLoader();
            if (typeof openCsvContent !== "function") {
                modular.error("Sheets viewer is not ready yet");
                return;
            }
            openCsvContent(standardDataToCsv(standardData), {title: `${standardName || normalizedReference} Data`, sourceNode: triggerNode});
        } catch (_) {
            modular.error("Unable to load standard data as sheet");
        }
    };

    const deleteCacheEntry = async (entry = {}) => {
        if (!entry.interfaceName || !entry.key) return;
        try {
            await window.StandardBrowserCache?.delete?.(entry.interfaceName, entry.key, {format: entry.format || ""});
            modular.success("Cache entry deleted");
            initializeHistoryRoute();
        } catch (_) {
            modular.error("Unable to delete cache entry");
        }
    };

    const renderHistoryList = (entries = [], mode = "Use") => {
        const historyList = document.getElementById("home-history-cache-list");
        if (!historyList) return;
        if (mode !== "Cache") {
            historyList.innerHTML = div({style: "faded small-padding", content: "Select Cache mode to browse cached files."});
            return;
        }
        if (!entries.length) {
            historyList.innerHTML = div({style: "faded small-padding", content: "No browser cache entries found."});
            return;
        }
        historyList.innerHTML = div({content: entries.map((entry, index) => {
            const label = escapeHtml(entry.label || entry.key || "Cache entry");
            const detail = [entry.interfaceName, entry.kind || "cache", entry.contentType || "", formatBytes(entry.size || 0), formatCacheTimestamp(entry.updatedAt || "")].filter(Boolean).map(escapeHtml).join(" · ");
            const source = entry.source ? `<div class="faded" style="font-size:12px;margin-top:4px;">${escapeHtml(entry.source)}</div>` : "";
            return `<div class="padded radius bordered hover-background align-left fill" data-cache-index="${index}">
                <div style="display:flex;gap:8px;align-items:flex-start;justify-content:space-between;">
                    <button type="button" class="naked pointer align-left" data-cache-open="${index}" style="flex:1;color:inherit;">
                        <strong>${label}</strong>
                        <div class="faded" style="font-size:12px;margin-top:4px;">${detail}</div>
                        ${source}
                    </button>
                    <button type="button" class="tiny inner-radius" data-cache-delete="${index}" title="Delete cache entry">Delete</button>
                </div>
            </div>`;
        }).join("")});
        historyList.querySelectorAll("[data-cache-open]").forEach((node) => {
            const entry = entries[Number(node.getAttribute("data-cache-open"))];
            node.onclick = () => openCacheFileInInternals(entry, node);
        });
        historyList.querySelectorAll("[data-cache-delete]").forEach((node) => {
            const entry = entries[Number(node.getAttribute("data-cache-delete"))];
            node.onclick = event => {
                event.preventDefault();
                event.stopPropagation();
                deleteCacheEntry(entry);
            };
        });
    };

    const getHistoryInterfaceOptions = () => (modular.running || []).map((service) => {
        const shortcut = service?.interfaceShortcut?.();
        return {label: shortcut?.title ?? "", value: shortcut ? service?.name?.() ?? "" : ""};
    }).filter((option) => option.label && option.value);

    const initializeHistoryRoute = () => {
        const interfaceSelect = document.getElementById("home-history-interface-select");
        const modeSelect = document.getElementById("home-history-mode-select");
        const historyList = document.getElementById("home-history-cache-list");
        const refreshButton = document.getElementById("home-history-refresh-cache");
        const clearButton = document.getElementById("home-history-clear-cache");
        if (!interfaceSelect || !modeSelect || !historyList) return;
        let requestVersion = 0;
        const populateInterfaces = async () => {
            const cachedEntries = await window.StandardBrowserCache?.list?.() || [];
            const cachedInterfaces = Array.from(new Set(cachedEntries.map(entry => entry.interfaceName).filter(Boolean))).sort((left, right) => left.localeCompare(right));
            const runningOptions = getHistoryInterfaceOptions();
            const optionMap = new Map();
            optionMap.set("", "All cached interfaces");
            runningOptions.forEach(option => {
                if (option.value) optionMap.set(option.value, option.label || option.value);
            });
            cachedInterfaces.forEach(interfaceName => {
                if (!optionMap.has(interfaceName)) optionMap.set(interfaceName, interfaceName);
            });
            setDropdownOptions(interfaceSelect, Array.from(optionMap.entries()).map(([value, label]) => ({value, label})));
        };
        const refreshCacheList = async () => {
            const mode = modeSelect.value;
            const selectedInterface = interfaceSelect.value;
            if (mode !== "Cache") {
                renderHistoryList([], mode);
                return;
            }
            const currentRequest = ++requestVersion;
            historyList.innerHTML = div({style: "faded small-padding", content: "Loading browser cache..."});
            try {
                const entries = await window.StandardBrowserCache?.list?.({interfaceName: selectedInterface}) || [];
                if (currentRequest !== requestVersion) return;
                renderHistoryList(entries, mode);
            } catch (_) {
                if (currentRequest !== requestVersion) return;
                historyList.innerHTML = div({style: "faded small-padding", content: "Unable to load browser cache."});
            }
        };
        populateInterfaces().then(refreshCacheList).catch(refreshCacheList);
        interfaceSelect.onchange = refreshCacheList;
        modeSelect.onchange = refreshCacheList;
        if (refreshButton) refreshButton.onclick = () => populateInterfaces().then(refreshCacheList).catch(refreshCacheList);
        if (clearButton) clearButton.onclick = async () => {
            const selectedInterface = interfaceSelect.value;
            try {
                const removedCount = await window.StandardBrowserCache?.clear?.({interfaceName: selectedInterface}) || 0;
                modular.success(removedCount ? "Browser cache cleared" : "No cache entries to clear");
                await populateInterfaces();
                await refreshCacheList();
            } catch (_) {
                modular.error("Unable to clear browser cache");
            }
        };
    };

    const initializeStandardsRoute = async () => {
        const listRoot = document.getElementById("home-standards-list");
        if (!listRoot) return;
        const currentRequest = ++standardsRequestVersion;
        listRoot.innerHTML = div({style: "faded small-padding", content: "Loading standards..."});
        try {
            const standardsResponse = await CLI.send("stds", false);
            if (currentRequest !== standardsRequestVersion) return;
            const standards = parseStandardsResponse(standardsResponse);
            if (!standards.length) {
                listRoot.innerHTML = div({style: "faded small-padding", content: "No standards returned."});
                return;
            }
            listRoot.innerHTML = standards.map(({name, reference}, index) => div({style: "brick bordered radius padded small-margin-bottom shadowed", content: children([
                button({style: "tiny float-right inner-radius small-margin-left no-margin-top", title: "View as sheet", icon: modular.icons.sheets, onclick: event => openStandardDataInSheets(reference, name, event?.target)}),
                button({style: "tiny float-right no-margin inner-radius", content: "Data", onclick: event => openStandardDataInInternals(reference, event?.target)}),
                div({style: "inline margin-bottom", content: div({style: "brick", content: children([
                            strong({content: escapeHtml(name)}),
                            div({style: "faded inline margin-left", content: escapeHtml(reference)})
                        ])
                })}),
                div({id: `home-standards-detail-${index}`, style: "faded small-padding", content: "Loading details..."})
            ])})).join("");
            await Promise.all(standards.map(async ({name, reference}, index) => {
                const detailRoot = document.getElementById(`home-standards-detail-${index}`);
                if (!detailRoot) return;
                try {
                    const detailsResponse = await CLI.send(`stds ${name}`, false);
                    if (currentRequest !== standardsRequestVersion) return;
                    const details = `${detailsResponse || ""}`.trim();
                    detailRoot.innerHTML = `<pre class="small-padding bordered inner-radius shadowed no-wrap" style="white-space: pre-wrap; margin: 0;">${escapeHtml(details || `${name}: ${reference}`)}</pre>`;
                } catch (_) {
                    if (currentRequest !== standardsRequestVersion) return;
                    detailRoot.innerHTML = div({style: "faded", content: "Unable to load details."});
                }
            }));
        } catch (_) {
            if (currentRequest !== standardsRequestVersion) return;
            listRoot.innerHTML = div({style: "faded small-padding", content: "Unable to load standards."});
        }
    };

    const STANDARD_MAKER_FIELD_ID = (name = "") => `standard-maker-${name}`;
    const STANDARD_CONSTRAINT_TYPES = ["string", "bool", "int", "double", "char", "array"];
    const STANDARD_ACCESS_TYPES = ["public", "protected", "private", "global"];
    let standardMakerRowIndex = 0;

    const openStandardMaker = () => modular.show("com.standard.settings", 2, {newInstance: true});

    const renderStandardMakerRow = (mode = "standard") => {
        if (mode === "definition") {
            return `<div class="standard-maker-row standard-maker-definition-row">
                <input class="standard-maker-definition-name" type="text" placeholder="name" aria-label="Definition name">
                <input class="standard-maker-definition-value" type="text" placeholder="Stored value" aria-label="Stored value">
                <button type="button" class="tiny inner-radius standard-maker-remove" title="Remove definition" aria-label="Remove definition">×</button>
            </div>`;
        }
        const requiredId = `${STANDARD_MAKER_FIELD_ID("required")}-${standardMakerRowIndex++}`;
        return `<div class="standard-maker-row standard-maker-constraint-row">
            ${dropdown({style: "standard-maker-access", ariaLabel: "Access type", value: "protected", options: STANDARD_ACCESS_TYPES.map(type => ({label: type, value: type}))})}
            <input class="standard-maker-name" type="text" placeholder="field_name" aria-label="Constraint name">
            ${dropdown({style: "standard-maker-type", ariaLabel: "Constraint type", options: STANDARD_CONSTRAINT_TYPES.map(type => ({label: type, value: type}))})}
            <input class="standard-maker-reference" type="text" placeholder="REF" aria-label="Constraint reference" maxlength="12">
            <div class="standard-maker-required" title="Require a value">${switcher({id: requiredId, style: "standard-maker-required-control", content: "Required"})}</div>
            <button type="button" class="tiny inner-radius standard-maker-remove" title="Remove constraint" aria-label="Remove constraint">×</button>
        </div>`;
    };

    const getStandardMakerPortalRoot = (portal = null) => portal?.body?.() || document;

    const syncStandardMakerMode = (portal = null, {resetRows = false} = {}) => {
        const root = getStandardMakerPortalRoot(portal);
        const mode = root.querySelector(`#${STANDARD_MAKER_FIELD_ID("mode")}`)?.value || "standard";
        const list = root.querySelector(`#${STANDARD_MAKER_FIELD_ID("rows")}`);
        const helper = root.querySelector(`#${STANDARD_MAKER_FIELD_ID("helper")}`);
        if (!list) return;
        if (helper) helper.textContent = mode === "definition"
            ? "Definitions restrict a field to a small set of named values."
            : "Constraints describe the fields stored in each record.";
        if (resetRows || !list.children.length) list.innerHTML = renderStandardMakerRow(mode);
        list.querySelectorAll(".standard-maker-remove").forEach(buttonNode => {
            buttonNode.onclick = () => {
                buttonNode.closest(".standard-maker-row")?.remove();
                if (!list.children.length) list.innerHTML = renderStandardMakerRow(mode);
                syncStandardMakerMode(portal);
            };
        });
    };

    const initializeStandardMaker = function () {
        const portal = this.portal;
        const root = getStandardMakerPortalRoot(portal);
        const modeSelect = root.querySelector(`#${STANDARD_MAKER_FIELD_ID("mode")}`);
        const addButton = root.querySelector(`#${STANDARD_MAKER_FIELD_ID("add-row")}`);
        if (modeSelect) modeSelect.onchange = () => syncStandardMakerMode(portal, {resetRows: true});
        if (addButton) addButton.onclick = () => {
            const list = root.querySelector(`#${STANDARD_MAKER_FIELD_ID("rows")}`);
            list?.insertAdjacentHTML("beforeend", renderStandardMakerRow(modeSelect?.value || "standard"));
            syncStandardMakerMode(portal);
            list?.lastElementChild?.querySelector("input")?.focus?.();
        };
        syncStandardMakerMode(portal);
        root.querySelector(`#${STANDARD_MAKER_FIELD_ID("name")}`)?.focus?.();
    };

    const normalizeStandardIdentifier = (value = "") => String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const normalizeStandardReference = (value = "") => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    const quoteStandardValue = (value = "") => `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    const standardMakerCommandFailed = response => response === 0 || response === false || /^(0|false|failed|error|invalid|unknown)\b/i.test(`${response ?? ""}`.trim());

    const buildStandardMakerContent = (root) => {
        const mode = root.querySelector(`#${STANDARD_MAKER_FIELD_ID("mode")}`)?.value || "standard";
        const name = normalizeStandardIdentifier(root.querySelector(`#${STANDARD_MAKER_FIELD_ID("name")}`)?.value);
        const reference = normalizeStandardReference(root.querySelector(`#${STANDARD_MAKER_FIELD_ID("reference")}`)?.value);
        const history = root.querySelector(`#${STANDARD_MAKER_FIELD_ID("history")}`)?.checked === true;
        if (!name || !reference) throw new Error("Enter a valid name and reference");
        const rows = Array.from(root.querySelectorAll(".standard-maker-row")).map(row => {
            if (mode === "definition") {
                const definitionName = normalizeStandardIdentifier(row.querySelector(".standard-maker-definition-name")?.value);
                const definitionValue = String(row.querySelector(".standard-maker-definition-value")?.value || "").trim();
                if (!definitionName || !definitionValue) return "";
                return `    def ${definitionName} ${quoteStandardValue(definitionValue)}`;
            }
            const access = row.querySelector(".standard-maker-access")?.value || "protected";
            const constraintName = normalizeStandardIdentifier(row.querySelector(".standard-maker-name")?.value);
            const type = row.querySelector(".standard-maker-type")?.value || "string";
            const constraintReference = normalizeStandardReference(row.querySelector(".standard-maker-reference")?.value);
            const required = row.querySelector(".standard-maker-required input")?.checked === true;
            if (!constraintName || !constraintReference) return "";
            return `    ${access} ${constraintName} ${type} ${constraintReference}${required ? " *" : ""}`;
        }).filter(Boolean);
        if (!rows.length) throw new Error(mode === "definition" ? "Add at least one definition" : "Add at least one constraint");
        return {name, content: `${history ? "!" : ""}${name}: ${reference} {\n${rows.join("\n")}\n}\n`};
    };

    const saveCreatedStandard = async (_, context = {}) => {
        const portal = context?.portal;
        const root = getStandardMakerPortalRoot(portal);
        try {
            const standard = buildStandardMakerContent(root);
            if (typeof window.StandardUploads?.saveFile !== "function") throw new Error("File saving is unavailable");
            const relativePath = `Documents/${standard.name}.stds`;
            const hostPath = `/home/standard-system/${relativePath}`;
            let savedToDocuments = false;
            let workflowError = null;
            try {
                const response = await window.StandardUploads.saveFile(standard.content, hostPath, {label: `Creating ${standard.name}`});
                if (!response?.ok) throw new Error("Unable to save the Standard file");
                savedToDocuments = true;
                const importResponse = await CLI.send(`import "${hostPath}"`, false);
                if (standardMakerCommandFailed(importResponse)) {
                    throw new Error("The Standard file was saved but could not be imported");
                }
                const reloadResponse = await CLI.send("reload standards", false);
                if (standardMakerCommandFailed(reloadResponse)) {
                    throw new Error("The Standard was imported but standards could not be reloaded");
                }
            } catch (error) {
                workflowError = error;
            }
            if (savedToDocuments) {
                try {
                    const removeResponse = await CLI.send(CLI.buildFilesCommand("remove", relativePath), false);
                    if (standardMakerCommandFailed(removeResponse)) {
                        throw new Error("The Standard was created but its temporary file could not be removed from Documents");
                    }
                } catch (error) {
                    if (!workflowError) workflowError = error;
                    else console.error("Unable to remove temporary Standard file:", error);
                }
            }
            if (workflowError) throw workflowError;
            portal?.close?.();
            modular.success(`${standard.name} created`);
            await initializeStandardsRoute();
        } catch (error) {
            modular.error(error?.message || "Unable to create Standard");
        }
    };

    const applyBackgroundImage = (backgroundImageFileName) => {
        const rawValue = backgroundImageFileName === true ? (window.StandardUI?.currentBackgroundImageSource || window.StandardUI?.getAppliedBackgroundImageUrl?.() || "") : `${backgroundImageFileName || ""}`.trim();
        const imageUrl = rawValue && !rawValue.startsWith("data:") && !rawValue.startsWith("blob:") && !rawValue.startsWith("http://") && !rawValue.startsWith("https://") && !rawValue.startsWith("/") ? `/api/user-data/${encodeURIComponent(rawValue)}?t=${Date.now()}` : rawValue;
        if (typeof window.StandardUI?.applyResolvedBackgroundImage === "function") {
            window.StandardUI.applyResolvedBackgroundImage(imageUrl);
            return;
        }
        const targets = [document.documentElement, document.body];
        if (imageUrl) {
            targets.forEach(target => {
                target.style.backgroundImage = `url("${imageUrl}")`;
                target.style.backgroundSize = "cover";
                target.style.backgroundPosition = "center center";
                target.style.backgroundRepeat = "no-repeat";
                target.style.backgroundAttachment = "fixed";
            });
            document.body.style.minHeight = "100vh";
        } else {
            targets.forEach(target => {
                target.style.backgroundImage = "none";
                target.style.backgroundAttachment = "scroll";
            });
        }
    };

    const refreshUITheme = (os) => {
        let temp = ui_settings_options;
        if (os) temp = os;
        document.documentElement.style.setProperty("--fs", `${temp.font_size}px`);
        document.documentElement.style.setProperty("--interface-shortcut-icon-size", `${temp.shortcut_icon_size}px`);
        document.documentElement.style.setProperty("--fg", temp.foreground);
        document.documentElement.style.setProperty("--primary", temp.primary);
        document.documentElement.style.setProperty("--secondary", temp.secondary);
        document.documentElement.style.setProperty("--bg", temp.background);
        document.documentElement.style.setProperty("--border", temp.border_color);
        document.documentElement.style.setProperty("--radius", `${temp.border_radius}px`);
        const shadowsEnabled = temp.shadows !== false;
        document.documentElement.style.setProperty("--small-shadow", shadowsEnabled ? "0 4px 12px rgba(5, 5, 5, 0.08)" : "none");
        document.documentElement.style.setProperty("--shadow", shadowsEnabled ? "0 8px 32px rgba(0, 0, 0, 0.1)" : "none");
        document.documentElement.style.setProperty("--darker-shadow", shadowsEnabled ? "4px 4px 10px rgba(0, 0, 0, 0.3)" : "none");
        applyBackgroundImage(temp.background_image);
    }

    const saveSettings = async ({successMessage = "Settings saved", errorMessage = "Unable to save settings"} = {}) => {
        try {
            const currentUserRecord = await getCurrentUserRecord();
            const rawUserId = `${modular.user.id() || currentUserRecord?.userid || ""}`.trim();
            const safeUserId = rawUserId.toLowerCase().replace(/[^a-z0-9_-]/g, "");
            if (!safeUserId) throw new Error("Missing user ID");
            const payload = JSON.stringify(JSON.stringify(ui_settings_options));
            await CLI.send(`[user] settings ${payload} <userid "${safeUserId}">`, false);
            if (typeof modular?.user?.cacheUserRecord === "function") {
                modular.user.cacheUserRecord({
                    ...((currentUserRecord && typeof currentUserRecord === "object") ? currentUserRecord : {}),
                    userid: safeUserId,
                    settings: payload,
                    theme: payload
                });
            }
            if (typeof modular?.user?.writeUserCookie === "function") modular.user.writeUserCookie({...((currentUserRecord && typeof currentUserRecord === "object") ? currentUserRecord : {}), userid: safeUserId, settings: payload});
            await window.StandardUI?.refreshTheme?.({force: true, maxAttempts: 0});
            modular.success(successMessage);
            return true;
        } catch (err) {
            console.error("Failed to save settings:", err);
            modular.error(errorMessage);
            return false;
        }
    }

    const cloneThemeData = (themeData = {}) => JSON.parse(JSON.stringify(themeData || {}));

    const normalizeSharedThemeData = (theme = {}) => {
        const candidate = theme?.data ?? theme?.theme ?? theme?.settings;
        if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) return cloneThemeData(candidate);
        if (typeof candidate !== "string") return null;
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
        } catch (_) {
        }
        return null;
    };

    const loadSharedThemes = async () => {
        try {
            const response = await fetch(`/themes.json?t=${Date.now()}`, {cache: "no-store"});
            if (!response.ok) throw new Error(`Theme repo failed (${response.status})`);
            const payload = await response.json();
            sharedThemes = Array.isArray(payload?.themes) ? payload.themes : [];
        } catch (err) {
            console.error("Failed to load themes:", err);
            sharedThemes = [];
        }
        renderSharedThemes();
    };

    const renderThemeColorPreview = (themeData = {}) => {
        const themeColors = [
            {name: "Font", color: themeData.foreground},
            {name: "Accent", color: themeData.primary},
            {name: "Background", color: themeData.background},
            {name: "Border", color: themeData.border_color}
        ].filter(({color}) => `${color || ""}`.trim());
        if (!themeColors.length) return "";
        return div({style: "colors settings-theme-colors", content: children(themeColors.map(({name, color}) => div({style: "color-option animated", background: color, primary: color, secondary: color, title: `${name}: ${color}`, content: div({style: "color-name no-wrap hidden", content: name})})))});
    };

    const renderThemeMetricPreview = (themeData = {}) => {
        const metrics = [
            {label: "Font", value: themeData.font_size, suffix: "px"},
            {label: "Icons", value: themeData.shortcut_icon_size, suffix: "px"},
            {label: "Radius", value: themeData.border_radius, suffix: "px"},
            {label: "Border", value: themeData.border_width, suffix: "px"}
        ].filter(({value}) => value !== undefined && value !== null && value !== "");
        if (!metrics.length) return "";
        return div({style: "settings-theme-metrics faded center", content: children(metrics.map(({label, value, suffix}) => div({style: "inline border inner-radius tiny small-padding space-right tiny-text", content: `${label} ${escapeHtml(value)}${suffix}`})))});
    };

    const renderSharedThemes = () => {
        const list = document.getElementById("settings-themes-list");
        if (!list) return;
        if (!sharedThemes.length) {
            list.innerHTML = div({style: "faded small-padding", content: "No themes saved yet."});
            return;
        }
        list.innerHTML = children(sharedThemes.map((theme, index) => {
            const themeData = normalizeSharedThemeData(theme) || {};
            return div({
                style: "settings-theme-option bordered radius padded spaced hover-zoom hover-shadow pointer max-width",
                index: index + 1,
                content: children([
                    strong({content: escapeHtml(theme?.name || "Untitled Theme")}),
                    div({style: "spacer"}),
                    renderThemeColorPreview(themeData),
                    div({style: "spacer"}),
                    renderThemeMetricPreview(themeData)
                ])
            });
        }));
        list.querySelectorAll(".settings-theme-option").forEach((themeNode) => {
            themeNode.contextmenu([
                {label: "Test", action: (_, event, target) => {
                    const index = Number(themeNode.getAttribute("item-index")) - 1;
                    testSharedTheme(sharedThemes[index]);
                }},
                {label: "Apply", action: (_, event, target) => {
                    const index = Number(themeNode.getAttribute("item-index")) - 1;
                    applySharedTheme(sharedThemes[index]);
                }}
            ]);
            themeNode.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                themeNode.dispatchEvent(new MouseEvent("contextmenu", {bubbles: true, cancelable: true, clientX: event.clientX, clientY: event.clientY}));
            });
        });
    };

    const cancelThemeTestTimers = () => {
        if (themeTestTimer) clearTimeout(themeTestTimer);
        if (themeTestCountdownTimer) clearInterval(themeTestCountdownTimer);
        themeTestTimer = null;
        themeTestCountdownTimer = null;
    };

    const testSharedTheme = (theme) => {
        const themeData = normalizeSharedThemeData(theme);
        if (!themeData) {
            modular.error("Theme data is unavailable");
            return;
        }
        cancelThemeTestTimers();
        const previousTheme = cloneThemeData(ui_settings_options);
        ui_settings_options = {...default_settings_options, ...themeData};
        refreshUITheme();
        renderBackgroundImageThumbnail();
        let remaining = 10;
        modular.message(`Testing ${theme?.name || "theme"} for ${remaining} seconds`);
        themeTestCountdownTimer = setInterval(() => {
            remaining -= 1;
            if (remaining > 0) modular.message(`Theme test ends in ${remaining} seconds`);
        }, 1000);
        themeTestTimer = setTimeout(() => {
            cancelThemeTestTimers();
            ui_settings_options = previousTheme;
            refreshUITheme();
            renderBackgroundImageThumbnail();
            modular.message("Theme test ended");
        }, 10000);
    };

    const applySharedTheme = async (theme) => {
        const themeData = normalizeSharedThemeData(theme);
        if (!themeData) {
            modular.error("Theme data is unavailable");
            return;
        }
        cancelThemeTestTimers();
        ui_settings_options = {...default_settings_options, ...themeData};
        refreshUITheme();
        renderBackgroundImageThumbnail();
        await saveSettings({successMessage: "Theme applied"});
    };

    const saveSharedTheme = () => {
        inputDialogue({title: "Save Theme", placeholder: "Theme name", confirmation: async (_, value) => {
                const name = `${value || ""}`.trim();
                if (!name) {
                    modular.error("Theme name is required");
                    return;
                }
                try {
                    const currentUserRecord = await getCurrentUserRecord();
                    const rawUserId = `${modular.user.id() || currentUserRecord?.userid || currentUserRecord?.id || ""}`.trim();
                    const response = await fetch("/api/themes", {method: "POST", credentials: "same-origin", cache: "no-store", headers: {"Content-Type": "application/json"}, body: JSON.stringify({name, user: rawUserId, data: cloneThemeData(ui_settings_options)})});
                    if (!response.ok) throw new Error(`Theme save failed (${response.status})`);
                    const payload = await response.json();
                    sharedThemes = Array.isArray(payload?.themes) ? payload.themes : [...sharedThemes, payload?.theme].filter(Boolean);
                    renderSharedThemes();
                    modular.success("Theme saved");
                } catch (err) {
                    console.error("Failed to save theme:", err);
                    modular.error("Unable to save theme");
                }
            }
        });
    };

    const updateKioskMode = async (enabled = false) => {
        ui_settings_options.kiosk_mode = enabled === true;
        const applied = await window.StandardUI?.setKioskMode?.(ui_settings_options.kiosk_mode);
        if (!applied && ui_settings_options.kiosk_mode) {
            modular.error("Unable to enable kiosk mode");
            ui_settings_options.kiosk_mode = false;
            const kioskToggle = document.getElementById("kiosk-mode");
            if (kioskToggle) kioskToggle.checked = false;
            return false;
        }
        const saved = await saveSettings({successMessage: ui_settings_options.kiosk_mode ? "Kiosk mode enabled" : "Kiosk mode disabled"});
        if (!saved) {
            ui_settings_options.kiosk_mode = !ui_settings_options.kiosk_mode;
            const kioskToggle = document.getElementById("kiosk-mode");
            if (kioskToggle) kioskToggle.checked = ui_settings_options.kiosk_mode;
            await window.StandardUI?.setKioskMode?.(ui_settings_options.kiosk_mode);
            return false;
        }
        return true;
    };

    let peopleProfileFileInput = null;
    const peopleProfileImageCacheKeys = {};

    const getPeopleProfileImageCacheKey = (recordId) => {
        const cacheKey = peopleProfileImageCacheKeys[String(recordId)];
        return cacheKey ?? "cached";
    };

    const bumpPeopleProfileImageCacheKey = (recordId) => {
        if (!recordId) return;
        peopleProfileImageCacheKeys[String(recordId)] = Date.now();
    };

    const normalizeCurrentUserRecord = (payload) => {
        if (!payload) return null;
        if (Array.isArray(payload)) return payload[0] || null;
        if (Array.isArray(payload.user)) return payload.user[0] || null;
        if (payload.user && typeof payload.user === "object") return payload.user;
        if (typeof payload === "object") return payload;
        return null;
    };

    const sanitizeUserRecordId = (value = "") => `${value || ""}`.trim().replace(/[^a-zA-Z0-9_-]/g, "");

    const getAllUserRecords = async () => {
        try {
            const response = await CLI.send("[user]");
            return Array.isArray(response?.user) ? response.user : Array.isArray(response) ? response : [];
        } catch (_) {
            return [];
        }
    };

    const userRecordsMatch = (left = null, right = null) => {
        if (!left || !right) return false;
        return ["id", "userid", "username"].some(key => {
            const leftValue = `${left?.[key] || ""}`.trim();
            const rightValue = `${right?.[key] || ""}`.trim();
            return leftValue && rightValue && leftValue === rightValue;
        });
    };

    const getCurrentUserRecord = async (availableUsers = null) => {
        const allUsers = Array.isArray(availableUsers) ? availableUsers : null;
        try {
            const selectedUserRecord = normalizeCurrentUserRecord(await modular.user.data());
            if (selectedUserRecord) return allUsers?.find(userRecord => userRecordsMatch(userRecord, selectedUserRecord)) || selectedUserRecord;
        } catch (_) {
        }
        const sessionUserId = `${modular.user.id() || ""}`.trim();
        if (!sessionUserId) return null;
        const users = allUsers || await getAllUserRecords();
        return users.find(userRecord => `${userRecord?.userid || ""}`.trim() === sessionUserId) || null;
    };

    const getCurrentUserRecordId = async (userRecord = null) => {
        const candidateRecord = normalizeCurrentUserRecord(userRecord) || normalizeCurrentUserRecord(typeof modular?.user?.readCachedUserRecord === "function" ? modular.user.readCachedUserRecord() : null);
        const candidateRecordId = sanitizeUserRecordId(candidateRecord?.id);
        if (candidateRecordId) return candidateRecordId;
        const selectedUserRecord = normalizeCurrentUserRecord(await getCurrentUserRecord());
        return sanitizeUserRecordId(selectedUserRecord?.id);
    };

    const sanitizeBackgroundImageFormat = (value = "") => `${value || ""}`.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

    const inferBackgroundImageFormat = (file = {}) => {
        const extensionMatch = `${file?.name || ""}`.match(/\.([a-zA-Z0-9]+)$/);
        const extension = sanitizeBackgroundImageFormat(extensionMatch ? extensionMatch[1] : "");
        if (extension) return extension === "jpg" ? "jpeg" : extension;
        const typeSuffix = sanitizeBackgroundImageFormat(`${file?.type || ""}`.split("/")[1] || "");
        return typeSuffix || "png";
    };

    const createBackgroundImageObjectUrl = (file) => {
        try {
            return URL.createObjectURL(file);
        } catch (_) {
            return "";
        }
    };

    const saveBackgroundImageCache = async (file) => {
        const previousMetadata = await loadBackgroundImageMetadata();
        const previousFormat = sanitizeBackgroundImageFormat(previousMetadata?.format || "");
        const format = inferBackgroundImageFormat(file);
        const metadata = {format, mimeType: `${file?.type || ""}`.trim() || `image/${format}`, updatedAt: new Date().toISOString()};
        await window.StandardBrowserCache?.set?.(BACKGROUND_IMAGE_CACHE_INTERFACE, BACKGROUND_IMAGE_CACHE_KEY, file, {format, contentType: metadata.mimeType, label: "Background image"});
        await window.StandardBrowserCache?.set?.(BACKGROUND_IMAGE_CACHE_INTERFACE, BACKGROUND_IMAGE_META_KEY, metadata, {format: "json", contentType: "application/json", label: "Background image metadata"});
        if (previousFormat && previousFormat !== format) {
            try {
                await window.StandardBrowserCache?.delete?.(BACKGROUND_IMAGE_CACHE_INTERFACE, BACKGROUND_IMAGE_CACHE_KEY, {format: previousFormat});
            } catch (_) {
            }
        }
        return metadata;
    };

    const loadBackgroundImageMetadata = async () => {
        try {
            return await window.StandardBrowserCache?.get?.(BACKGROUND_IMAGE_CACHE_INTERFACE, BACKGROUND_IMAGE_META_KEY, {format: "json"});
        } catch (error) {
            console.error("Failed to load background image metadata:", error);
            return null;
        }
    };

    const deleteBackgroundImageCache = async () => {
        const metadata = await loadBackgroundImageMetadata();
        const format = sanitizeBackgroundImageFormat(metadata?.format || "");
        if (format) await window.StandardBrowserCache?.delete?.(BACKGROUND_IMAGE_CACHE_INTERFACE, BACKGROUND_IMAGE_CACHE_KEY, {format});
        await window.StandardBrowserCache?.delete?.(BACKGROUND_IMAGE_CACHE_INTERFACE, BACKGROUND_IMAGE_META_KEY, {format: "json"});
    };

    const getAppliedBackgroundImageUrl = () => {
        if (typeof window.StandardUI?.getAppliedBackgroundImageUrl === "function") return window.StandardUI.getAppliedBackgroundImageUrl() || "";
        const targets = [document.body, document.documentElement];
        for (const target of targets) {
            if (!target) continue;
            const value = window.getComputedStyle(target).backgroundImage || target.style.backgroundImage || "";
            const match = value.match(/^url\((.*)\)$/i);
            if (!match) continue;
            return match[1].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
        }
        return "";
    };

    const renderBackgroundImageThumbnail = () => {
        const previewRoot = document.getElementById("settings-background-image-preview");
        if (!previewRoot) return;
        previewRoot.replaceChildren();
        if (ui_settings_options.background_image !== true) return;
        const appliedBackgroundImageUrl = getAppliedBackgroundImageUrl();
        if (!appliedBackgroundImageUrl) return;
        const label = document.createElement("div");
        label.className = "faded small-padding";
        label.textContent = "Selected background image";
        const thumbnailButton = document.createElement("button");
        thumbnailButton.type = "button";
        thumbnailButton.className = "naked bordered radius padded hover-shadowed hover-zoom";
        thumbnailButton.style.display = "inline-block";
        const image = document.createElement("img");
        image.src = appliedBackgroundImageUrl;
        image.alt = "Selected background image";
        image.className = "radius";
        image.style.display = "block";
        image.style.width = "180px";
        image.style.height = "110px";
        image.style.objectFit = "cover";
        thumbnailButton.appendChild(image);
        thumbnailButton.onclick = () => {
            confirmationDialogue({title: "Remove Background Image", content: "You're sure you want to remove the current background image?", confirmation: async () => {
                    modular.message("Removing background image...");
                    try {
                        await deleteBackgroundImageCache();
                        ui_settings_options.background_image = false;
                        if (window.StandardUI?.currentBackgroundImageSource?.startsWith?.("blob:")) URL.revokeObjectURL(window.StandardUI.currentBackgroundImageSource);
                        if (window.StandardUI) window.StandardUI.currentBackgroundImageSource = "";
                        refreshUITheme();
                        renderBackgroundImageThumbnail();
                        await saveSettings({successMessage: "Background image removed", errorMessage: "Unable to save background image removal"});
                    } catch (error) {
                        console.error("Failed to remove background image:", error);
                        modular.error("Unable to remove background image");
                    }
                }
            });
        };
        previewRoot.append(label, thumbnailButton);
    };

    const buildPeopleDisplayName = (userRecord = {}) => {
        const firstName = `${userRecord.firstname || ""}`.trim();
        const middleName = `${userRecord.middlename || ""}`.trim();
        const lastName = `${userRecord.lastname || ""}`.trim();
        const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
        if (fullName) return fullName;
        const fallbackKeys = ["name", "displayName", "full_name", "username", "email", "userid", "id"];
        for (const key of fallbackKeys) {
            const value = `${userRecord?.[key] || ""}`.trim();
            if (value) return value;
        }
        return "Unknown User";
    };

    const buildPeopleUsername = (userRecord = {}) => {
        const rawUsername = `${userRecord.username || userRecord.userid || userRecord.userId || userRecord.id || userRecord.email || modular.user.id() || ""}`.trim();
        return rawUsername || "Unavailable";
    };

    let selectedPeopleUserRecord = null;

    const openPeopleUser = (userRecord = {}) => {
        selectedPeopleUserRecord = {...userRecord};
        modular.show("com.standard.settings", 3, {newInstance: true});
    };

    const formatPeopleBirthdate = (value = "") => {
        const birthdate = `${value || ""}`.trim();
        if (!birthdate) return "";
        const yearFirst = birthdate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (yearFirst) return `${yearFirst[2].padStart(2, "0")}/${yearFirst[3].padStart(2, "0")}/${yearFirst[1]}`;
        const monthFirst = birthdate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (monthFirst) return `${monthFirst[1].padStart(2, "0")}/${monthFirst[2].padStart(2, "0")}/${monthFirst[3]}`;
        const parsedBirthdate = new Date(birthdate);
        if (Number.isNaN(parsedBirthdate.getTime())) return birthdate;
        return `${String(parsedBirthdate.getUTCMonth() + 1).padStart(2, "0")}/${String(parsedBirthdate.getUTCDate()).padStart(2, "0")}/${parsedBirthdate.getUTCFullYear()}`;
    };

    const renderPeopleUserPortal = () => {
        const userRecord = selectedPeopleUserRecord || {};
        const recordId = sanitizeUserRecordId(userRecord?.id);
        const displayName = buildPeopleDisplayName(userRecord);
        const detailValue = value => `${value || ""}`.trim();
        const details = [
            detailValue(userRecord.username || userRecord.userid) && div({style: "small-padding faded", content: escapeHtml(detailValue(userRecord.username || userRecord.userid))}),
            detailValue(userRecord.phone) && div({style: "small-padding faded", content: escapeHtml(detailValue(userRecord.phone))}),
            detailValue(userRecord.email) && div({style: "small-padding faded", content: escapeHtml(detailValue(userRecord.email))}),
            detailValue(userRecord.address) && div({style: "small-padding", content: escapeHtml(detailValue(userRecord.address)).replace(/\s*,\s*/g, "<br>")}),
            detailValue(userRecord.birthday) && div({style: "small-padding faded", content: escapeHtml(formatPeopleBirthdate(userRecord.birthday))})
        ].filter(Boolean);
        return div({content: children([
            div({style: "center large-margin-top large-margin-bottom", content: children([
                recordId && userRecord.__hasPeopleProfileImage
                    ? img({style: "contact-image real-large-icon round inline", src: buildProfileImageUrl(recordId), alt: displayName})
                    : div({style: "background-secondary round real-large-icon inline", content: buildPeopleFallbackPhoto(120)})
            ])}),
            div({style: "small-padding bold large-margin-top", content: escapeHtml(displayName)}),
            ...details
        ])});
    };

    const ADD_PERSON_FIELDS = [
        {property: "firstname", label: "First Name"},
        {property: "lastname", label: "Last Name"},
        {property: "birthday", label: "Birthday", input: dateInput},
        {property: "username", label: "Username"},
        {property: "email", label: "Email", type: "email"},
        {property: "phone", label: "Phone", input: phoneInput},
        {property: "address", label: "Address"}
    ];

    const escapePeopleCliValue = (value = "") => String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    const getAddPersonFieldId = (property = "") => `settings-add-person-${property}`;
    const getModifyPersonFieldId = (property = "") => `settings-modify-person-${property}`;

    const renderPersonField = (field = {}, idForProperty = getAddPersonFieldId, userRecord = {}) => div({content: children([
        div({style: "bold small-padding", content: field.label || field.property}),
        div({style: "padded", content: (field.input || input)({
            id: idForProperty(field.property),
            style: "undecorated no-padding fill",
            type: field.type || "text",
            value: field.property === "birthday" ? formatPeopleBirthdate(userRecord[field.property]) : userRecord[field.property]
        })})
    ])});

    const renderAddPersonField = (field = {}) => renderPersonField(field);
    const renderModifyPersonField = (field = {}) => renderPersonField(field, getModifyPersonFieldId, selectedPeopleUserRecord || {});

    const saveAddedPerson = async (_, context = {}) => {
        const portal = context?.portal;
        const portalRoot = portal?.body?.() || document;
        const fields = ADD_PERSON_FIELDS.map(field => ({
            ...field,
            input: portalRoot.querySelector(`#${getAddPersonFieldId(field.property)}`)
        }));
        if (fields.some(field => !field.input)) {
            modular.error("Unable to read the person form");
            return;
        }
        const values = fields.map(field => `"${escapePeopleCliValue(field.input.value.trim())}"`);
        const command = `[user] + (@, ${values.join(", ")}, "", "", @, @)`;
        try {
            const response = await CLI.send(command, false);
            if (response === 0) {
                modular.error("Failed to create person");
                return;
            }
            portal?.close?.();
            modular.success("Person created");
            void renderPeopleRoute();
        } catch (error) {
            console.error("Failed to create person:", error);
            modular.error("Unable to create person");
        }
    };

    const openAddPersonPortal = () => modular.show("com.standard.settings", 1, {newInstance: true});

    const saveModifiedPerson = async (_, context = {}) => {
        const portal = context?.portal;
        const portalRoot = portal?.body?.() || document;
        const recordId = sanitizeUserRecordId(selectedPeopleUserRecord?.id);
        if (!recordId) {
            modular.error("Unable to identify the person");
            return;
        }
        const fields = ADD_PERSON_FIELDS.map(field => ({
            ...field,
            input: portalRoot.querySelector(`#${getModifyPersonFieldId(field.property)}`)
        }));
        if (fields.some(field => !field.input)) {
            modular.error("Unable to read the person form");
            return;
        }
        try {
            const responses = await Promise.all(fields.map(field => CLI.send(
                `[user] ${field.property} "${escapePeopleCliValue(field.input.value.trim())}" <id "${escapePeopleCliValue(recordId)}">`,
                false
            )));
            if (responses.some(response => response === 0)) {
                modular.error("Failed to update one or more person fields");
                return;
            }
            selectedPeopleUserRecord = {
                ...selectedPeopleUserRecord,
                ...Object.fromEntries(fields.map(field => [field.property, field.input.value.trim()]))
            };
            portal?.close?.();
            modular.success("Person updated");
            void renderPeopleRoute();
        } catch (error) {
            console.error("Failed to update person:", error);
            modular.error("Unable to update person");
        }
    };

    const openModifyPersonPortal = (_, context = {}) => {
        context?.portal?.hide?.();
        modular.show("com.standard.settings", 4, {newInstance: true});
    };

    const deleteModifiedPerson = (_, context = {}) => {
        if (selectedPeopleUserRecord?.__isPrimaryUser) return;
        const portal = context?.portal;
        const displayName = buildPeopleDisplayName(selectedPeopleUserRecord || {});
        confirmationDialogue({
            title: "Delete Person",
            destructive: true,
            content: `You're sure you want to delete ${displayName}?`,
            confirmation: async () => {
                const recordId = sanitizeUserRecordId(selectedPeopleUserRecord?.id);
                if (!recordId) {
                    modular.error("Unable to identify the person");
                    return;
                }
                try {
                    const allUsers = await getAllUserRecords();
                    if (!allUsers.length) {
                        modular.error("Unable to verify the primary user");
                        return;
                    }
                    if (userRecordsMatch(selectedPeopleUserRecord, allUsers[0])) {
                        modular.error("The primary user cannot be deleted");
                        return;
                    }
                    const response = await CLI.send(`[user] - <id "${escapePeopleCliValue(recordId)}">`, false);
                    if (response === 0) {
                        modular.error("Failed to delete person");
                        return;
                    }
                    portal?.close?.();
                    selectedPeopleUserRecord = null;
                    modular.success("Person deleted");
                    void renderPeopleRoute();
                } catch (error) {
                    console.error("Failed to delete person:", error);
                    modular.error("Unable to delete person");
                }
            }
        });
    };

    const buildProfileImageUrl = (recordId = "") => {
        const safeRecordId = sanitizeUserRecordId(recordId);
        return safeRecordId ? `/api/records/images/${encodeURIComponent(safeRecordId)}?cb=${safeRecordId}-${getPeopleProfileImageCacheKey(safeRecordId)}` : "";
    };

    const checkPeopleProfileImageExists = async (recordId = "") => {
        const profileImageUrl = buildProfileImageUrl(recordId);
        if (!profileImageUrl) return false;
        return new Promise(resolve => {
            const profileImage = new Image();
            profileImage.onload = () => resolve(profileImage.naturalWidth > 0 && profileImage.naturalHeight > 0);
            profileImage.onerror = () => resolve(false);
            profileImage.src = profileImageUrl;
        });
    };
    const buildPeopleFallbackPhoto = (size = 56) => `<span class="round cover" aria-hidden="true" style="display:block;width:${size}px;height:${size}px;background-image:url('/images/blank_contact.png');background-position:center;background-repeat:no-repeat;background-size:cover"></span>`;

    const renderPeopleUserTile = async (userRecord = {}) => {
        const recordId = sanitizeUserRecordId(userRecord?.id);
        const hasProfileImage = recordId ? await checkPeopleProfileImageExists(recordId) : false;
        const displayName = buildPeopleDisplayName(userRecord);
        const username = buildPeopleUsername(userRecord);
        const email = `${userRecord?.email || ""}`.trim();
        return div({
            style: "settings-people-user-tile secondary-bordered inner-radius padded small-margin-top pointer",
            onclick: event => {
                if (event.target.closest("button")) return;
                openPeopleUser({...userRecord, __hasPeopleProfileImage: hasProfileImage});
            },
            content: children([
            button({
                style: `people-user-photo-button naked no-margin ${hasProfileImage ? "" : "people-user-photo-default background-secondary"} round`,
                data: recordId,
                title: `Change ${displayName}'s photo`,
                content: hasProfileImage
                    ? img({src: buildProfileImageUrl(recordId), style: "people-user-photo-image round cover", alt: displayName, width: 48, height: 48})
                    : "",
                width: 48,
                height: 48
            }),
            div({style: "settings-people-user-copy", content: children([
                div({style: "bold", content: escapeHtml(displayName)}),
                div({style: "faded", content: escapeHtml(username)}),
                email ? div({style: "faded", content: escapeHtml(email)}) : ""
            ])})
        ])});
    };

    const uploadPeopleProfilePhoto = async (file, userRecord = null) => {
        if (!(file instanceof File)) return false;
        if (!file.type || !file.type.startsWith("image/")) {
            modular.error("Please choose an image file");
            return false;
        }
        const userRecordId = await getCurrentUserRecordId(userRecord);
        if (!userRecordId) {
            modular.error("Unable to find the current user record");
            return false;
        }
        try {
            const uploadResponse = typeof window.StandardUploads?.uploadFile === "function" ? await window.StandardUploads.uploadFile(file, `/api/upload/temp/${encodeURIComponent(userRecordId)}`, {label: `Uploading ${file.name || "profile photo"}`}) : await fetch(`/api/upload/temp/${encodeURIComponent(userRecordId)}`, {method: "POST", body: (() => {
                const formData = new FormData();
                formData.append("file", file, file.name || "profile-photo");
                return formData;
            })()}).then(async response => ({ok: response.ok, status: response.status, responseText: await response.text()}));
            if (!uploadResponse.ok) {
                modular.error(`Profile image upload failed (${uploadResponse.status})`);
                return false;
            }
            bumpPeopleProfileImageCacheKey(userRecordId);
            modular.success("Profile image updated");
            return true;
        } catch (err) {
            console.error("Failed to upload profile image:", err);
            modular.error("Unable to upload profile image");
            return false;
        }
    };

    const bindPeopleProfilePhotoButton = (photoButton, userRecord = null) => {
        if (!photoButton || !userRecord) return;
        photoButton.style.cursor = "pointer";
        photoButton.onclick = () => {
            if (peopleProfileFileInput) peopleProfileFileInput.remove();
            const fileInput = document.createElement("input");
            peopleProfileFileInput = fileInput;
            fileInput.type = "file";
            fileInput.accept = "image/*";
            fileInput.style.display = "none";
            document.body.appendChild(fileInput);
            fileInput.onchange = async () => {
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;
                const didUpload = await uploadPeopleProfilePhoto(file, userRecord);
                fileInput.value = "";
                fileInput.remove();
                if (peopleProfileFileInput === fileInput) peopleProfileFileInput = null;
                if (didUpload) void renderPeopleRoute();
            };
            fileInput.click();
        };
    };

    const renderPeopleRoute = async () => {
        const routeRoot = document.getElementById("settings-people-route");
        if (!routeRoot) return;
        routeRoot.innerHTML = div({style: "faded padded", content: "Loading user..."});
        const allUsers = await getAllUserRecords();
        const userRecord = await getCurrentUserRecord(allUsers);
        const primaryUser = allUsers[0] || null;
        const selectedUser = userRecord ? {...userRecord, __isPrimaryUser: userRecordsMatch(userRecord, primaryUser)} : null;
        const userRecordId = await getCurrentUserRecordId(userRecord);
        const hasProfileImage = userRecordId ? await checkPeopleProfileImageExists(userRecordId) : false;
        const displayName = buildPeopleDisplayName(userRecord || {});
        const username = buildPeopleUsername(userRecord || {});
        const email = `${userRecord?.email || ""}`.trim();
        const profileImageUrl = hasProfileImage ? buildProfileImageUrl(userRecordId) : "";
        const otherUsers = allUsers
            .filter(candidate => !userRecordsMatch(candidate, userRecord))
            .map(candidate => ({...candidate, __isPrimaryUser: userRecordsMatch(candidate, primaryUser)}));
        const userTiles = await Promise.all(otherUsers.map(renderPeopleUserTile));
        routeRoot.innerHTML = div({style: "padded", content: children([
            div({
                style: "secondary-bordered radius padded shadowed pointer",
                onclick: event => {
                    if (event.target.closest("button")) return;
                    openPeopleUser({...selectedUser, __hasPeopleProfileImage: hasProfileImage});
                },
                content: children([
                button({
                    id: "people-profile-photo-button",
                    style: `naked no-margin ${hasProfileImage ? "" : "background-secondary"} round float-left space-right`,
                    content: hasProfileImage
                        ? img({src: profileImageUrl, style: "round cover medium-icon", alt: displayName, width: 56, height: 56})
                        : buildPeopleFallbackPhoto(),
                    width: 56,
                    height: 56
                }),
                div({style: "small-padding-top", content: children([
                    div({style: "bold", content: escapeHtml(displayName)}),
                    div({style: "faded", content: escapeHtml(username)}),
                    email ? div({style: "faded small-padding-top", content: escapeHtml(email)}) : ""
                ])})
            ])}),
            div({
                id: "settings-people-list",
                style: "margin-top",
                content: userTiles.length ? children(userTiles) : div({style: "faded small-padding", content: "No other users."})
            }),
            button({id: "settings-add-person", style: "secondary medium-margin-top", type: "button", content: "Add Person", onclick: openAddPersonPortal}),
            !userRecord ? div({style: "faded small-padding", content: "No selected user record was returned for this session."}) : ""
        ])});
        const photoButton = document.getElementById("people-profile-photo-button");
        if (!photoButton) return;
        bindPeopleProfilePhotoButton(photoButton, userRecord);
        routeRoot.querySelectorAll(".people-user-photo-button").forEach(tilePhotoButton => {
            const recordId = sanitizeUserRecordId(tilePhotoButton.getAttribute("data"));
            const tileUserRecord = otherUsers.find(candidate => sanitizeUserRecordId(candidate?.id) === recordId);
            bindPeopleProfilePhotoButton(tilePhotoButton, tileUserRecord);
        });
    };

    const pickBackgroundImage = () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.onchange = async () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            if (!file.type || !file.type.startsWith("image/")) {
                modular.error("Please choose an image file");
                return;
            }
            try {
                modular.message("Saving background image...");
                await saveBackgroundImageCache(file);
                const previewUrl = createBackgroundImageObjectUrl(file);
                if (window.StandardUI?.currentBackgroundImageSource?.startsWith?.("blob:")) {
                    URL.revokeObjectURL(window.StandardUI.currentBackgroundImageSource);
                }
                if (window.StandardUI) window.StandardUI.currentBackgroundImageSource = previewUrl;
                ui_settings_options.background_image = true;
                refreshUITheme();
                renderBackgroundImageThumbnail();
                await saveSettings({successMessage: "Background image updated"});
            } catch (err) {
                console.error("Failed to upload background image:", err);
                modular.error("Unable to upload background image");
            }
        };
        fileInput.click();
    }
    
    modular.register(new Service("com.standard.settings", [
        new Portal({
            title: "Settings",
            hints: ["settings", "config"],
            dimensions: [750, 550],
            navigation: false,
            svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>`,
            icon: "/icons/interfaces/settings.png",
            routes: [
                {
                    text: "People",
                    icon: `<svg class="text-foreground small-icon" width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 20V19C5 15.134 8.13401 12 12 12V12C15.866 12 19 15.134 19 19V20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
                    route: () => div({id: "settings-people-route", content: div({style: "faded padded", content: "Loading user..."})}),
                    afterRender: () => renderPeopleRoute()
                }, {
                    text: "Appearance",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z"/></svg>`,
                    route: () => div({style: "padded adjust-top", content: children([
                            div({content: children([
                                    button({style: "tiny inner-radius brick spaced float-right", content: "Use Defaults",
                                        onclick: () => {
                                            ui_settings_options = {...default_settings_options};
                                            refreshUITheme();
                                            renderBackgroundImageThumbnail();
                                            saveSettings();
                                        }
                                    }),
                                    button({style: "tiny inner-radius brick spaced float-right small-margin-right", content: "Save Theme", onclick: () => saveSharedTheme()}),
                                ])
                            }),
                            div({style: "big-spacer"}),
                            label({style: "faded", content: "Themes"}),
                            div({id: "settings-themes-list", style: "brick small-padding-top", content: div({style: "faded small-padding", content: "Loading themes..."})}),
                            div({style: "big-spacer"}),
                            label({style: "faded", content: "Font"}),
                            div({style: "big-spacer"}),
                            switcher({id: "transparency", style: "float-right", checked: ui_settings_options.transparency}),
                            label({style: "faded", content: "Transparency"}),
                            div({style: "big-spacer"}),
                            switcher({id: "shadows", style: "float-right", checked: ui_settings_options.shadows !== false}),
                            label({style: "faded", content: "Shadows"}),
                            div({style: "big-spacer"}),
                            switcher({id: "grid-background", style: "float-right", checked: ui_settings_options.grid_background === true}),
                            label({style: "faded", content: "Grid Background"}),
                            div({style: "big-spacer"}),
                            switcher({id: "use_svgs", style: "float-right", checked: ui_settings_options.use_svg_icons}),
                            label({style: "faded", content: "Use SVG Icons"}),
                            em({content: "Window icons will be shape outlines"}),
                            div({style: "big-spacer"}),
                            label({style: "faded", content: "Font Size"}),
                            numbers({id: "font_size", min: 10, max: 24, reference: "--radius"}),
                            div({style: "big-spacer"}),
                            label({style: "faded", content: "Interface Icon Size"}),
                            em({content: "Changes each interface icon below the search input"}),
                            interfaceIconSizePicker(),
                            div({style: "big-spacer"}),
                            label({style: "faded", content: "Font Color"}),
                            colorPicker({id: "foreground", colors: modular.colors}),
                            div({style: "big-spacer"}),
                            label({style: "faded", content: "Accent Color"}),
                            colorPicker({id: "primary", colors: modular.colors}),
                            div({style: "big-spacer"}),
                            label({style: "faded", content: "Background"}),
                            colorPicker({id: "background", colors: modular.colors}),
                            div({style: "spacer"}),
                            button({content: "Pick Background Image", onclick: () => pickBackgroundImage()}),
                            div({id: "settings-background-image-preview"}),
                            div({style: "big-spacer"}),
                            label({style: "faded", content: "Border Color"}),
                            colorPicker({id: "border_color", colors: modular.colors}),
                            div({style: "big-spacer"}),
                            label({style: "faded", content: "Border Radius"}),
                            numbers({id: "border_radius", min: 0, max: 25, inc: 1, reference: "--radius"}),
                            div({style: "big-spacer"}),
                            label({style: "faded", content: "Border Thickness"}),
                            numbers({id: "border_width", min: 1, max: 4, inc: 1, reference: "--border-width"}),
                            div({style: "big-spacer"}),
                        ])
                    }),
                    afterRender: () => {
                        document.querySelectorAll(".color-option").forEach(co => {
                            co.addEventListener("mouseenter", () => {
                                let s = Object.assign({}, ui_settings_options);
                                s[co.parentElement.getAttribute("id")] = window.getComputedStyle(co).getPropertyValue("background-color");
                                refreshUITheme(s);
                            });
                            co.addEventListener("mouseleave", () => refreshUITheme());
                            co.addEventListener("click", () => {
                                ui_settings_options[co.parentElement.getAttribute("id")] = window.getComputedStyle(co).getPropertyValue("background-color");
                                refreshUITheme();
                                saveSettings();
                            });
                        });
                        document.querySelectorAll(".number").forEach(n => {
                            n.addEventListener("mouseenter", () => {
                                let os = Object.assign({}, ui_settings_options);
                                os[n.parentElement.getAttribute("id")] = parseInt(n.getAttribute("value"));
                                refreshUITheme(os)
                            });
                            n.addEventListener("mouseleave", () => refreshUITheme());
                        })
                        document.querySelectorAll(".number").forEach(n => n.addEventListener("click", () => {
                            document.querySelectorAll(".number").forEach(v => v.classList.remove("selected-number"));
                            n.classList.add("selected-number");
                            ui_settings_options[n.parentElement.getAttribute("id")] = parseInt(n.getAttribute("value"));
                            refreshUITheme();
                            saveSettings();
                        }));
                        document.getElementById("use_svgs")?.addEventListener("change", () => {
                            ui_settings_options.use_svg_icons = !ui_settings_options.use_svg_icons;
                            saveSettings();
                        });
                        document.getElementById("transparency")?.addEventListener("change", () => {
                            ui_settings_options.transparency = !ui_settings_options.transparency;
                            saveSettings();
                        });
                        document.getElementById("shadows")?.addEventListener("change", () => {
                            ui_settings_options.shadows = !ui_settings_options.shadows;
                            refreshUITheme();
                            saveSettings();
                        });
                        document.getElementById("grid-background")?.addEventListener("change", (event) => {
                            ui_settings_options.grid_background = event.target.checked;
                            window.StandardUI?.setGridBackground?.(ui_settings_options.grid_background);
                            saveSettings();
                        });
                        loadSharedThemes();
                        renderBackgroundImageThumbnail();
                    }
                }, {
                    text: "Behavior",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M4.867 19.125h.008v.008h-.008v-.008Z"/></svg>`,
                    route: () => div({style: "padded adjust-top", content: children([
                            div({style: "spacer"}),
                            switcher({id: "interface-state", checked: ui_settings_options.interface_state}),
                            label({style: "faded", content: "Save Interface State"}),
                            div({style: "big-spacer"}),
                            switcher({id: "use-cursor", checked: ui_settings_options.use_cursor !== false}),
                            label({style: "faded", content: "Use Cursor"}),
                            div({style: "big-spacer"}),
                            switcher({id: "hide-shortcuts", checked: ui_settings_options.hide_shortcuts}),
                            label({style: "faded", content: "Hide Shortcuts"}),
                            div({style: "big-spacer"}),
                            switcher({id: "kiosk-mode", checked: ui_settings_options.kiosk_mode === true}),
                            label({style: "faded", content: "Kiosk Mode"}),
                            em({style: "faded", content: "Make browser full screen"}),
                            div({style: "big-spacer"}),
                            switcher({id: "disable-bar", checked: ui_settings_options.disable_bar === true}),
                            label({style: "faded", content: "Disable Bar"}),
                            div({style: "big-spacer"}),
                            switcher({id: "use-player-widget", checked: ui_settings_options.interface_state}),
                            label({style: "faded", content: "Use Player Widget"}),
                            em({style: "faded", content: "Widget to control active media"}),
                            div({style: "big-spacer"}),
                            switcher({id: "use-video-widget", checked: ui_settings_options.interface_state}),
                            label({style: "faded", content: "Use Video Widget"}),
                            em({style: "faded", content: "Widget to stream video and control"})
                        ])
                    }),
                    afterRender: () => {
                        document.getElementById("use-cursor").addEventListener("change", event => {
                            ui_settings_options.use_cursor = event.target?.checked === true;
                            window.StandardUI?.setUseCursor?.(ui_settings_options.use_cursor);
                            saveSettings();
                        });
                        document.getElementById("hide-shortcuts").addEventListener("change", _ => {
                            ui_settings_options.hide_shortcuts = !ui_settings_options.hide_shortcuts;
                            saveSettings();
                        });
                        document.getElementById("kiosk-mode").addEventListener("change", event => {
                            updateKioskMode(event.target?.checked === true);
                        });
                        document.getElementById("disable-bar").addEventListener("change", event => {
                            ui_settings_options.disable_bar = event.target?.checked === true;
                            window.StandardUI?.setDisableBar?.(ui_settings_options.disable_bar);
                            saveSettings({successMessage: ui_settings_options.disable_bar ? "Bar disabled" : "Bar enabled"});
                        });
                    }
                }, {
                    text: "Interfaces",
                    icon: INTERFACES_ICON,
                    route: () => div({id: "settings-interfaces-root", style: "small-padding", content: children([
                        div({style: "brick small-margin-bottom", content: h({level: 3, content: "Interfaces"})}),
                        div({id: "settings-interfaces-list", style: "settings-interfaces-list", content: div({style: "faded small-padding", content: "Loading interfaces..."})})
                    ])}),
                    afterRender: () => initializeInterfacesRoute()
                }, {
                    text: "Config",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 6.75h15M4.5 12h15m-15 5.25h15"/><circle cx="8" cy="6.75" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="10" cy="17.25" r="1.5" fill="currentColor" stroke="none"/></svg>`,
                    route: () => div({id: "settings-config-root", style: "small-padding", content: children([
                        div({style: "brick small-margin-bottom", content: children([
                            button({style: "tiny inner-radius float-right", content: "Refresh", onclick: () => initializeConfigRoute()}),
                            h({level: 3, content: "Host Config"}),
                            div({style: "faded", content: "Hover over a setting for details. Editable values are saved when changed."})
                        ])}),
                        div({id: "settings-config-list", style: "brick", content: div({style: "faded small-padding", content: "Loading host config..."})})
                    ])}),
                    afterRender: () => initializeConfigRoute()
                }, {
                    text: "Device Info",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/></svg>`,
                    route: () => div({style: "list spaced padded", content: () => {
                            return getDeviceInfo().then((deviceInfo) => {
                                const config = deviceInfo?.config || {};
                                const network = deviceInfo?.network || {};
                                const storage = deviceInfo?.storage || {};
                                const totalBytes = Number(storage.disk_total_bytes);
                                const availableBytes = Number(storage.disk_available_bytes);
                                const hasStorageInfo = Number.isFinite(totalBytes) && totalBytes > 0 && Number.isFinite(availableBytes) && availableBytes >= 0;
                                const usedBytes = hasStorageInfo ? Math.max(0, Math.min(totalBytes, totalBytes - availableBytes)) : 0;
                                const usedPercent = hasStorageInfo ? Math.round((usedBytes / totalBytes) * 100) : 0;
                                return children([
                                    div({style: "secondary-bordered radius padded", content: children([
                                        div({style: "small-margin-bottom", content: children([
                                            strong({style: "space-right", content: "Device Storage"}),
                                            div({style: "faded float-right", content: hasStorageInfo ? `${usedPercent}% used` : "Unavailable"})
                                        ])}),
                                        `<div class="service-loader-bar" role="progressbar" aria-label="Device storage used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${usedPercent}"><div class="service-loader-bar-progress" style="width:${usedPercent}%"></div></div>`,
                                        div({style: "faded small-padding-top", content: hasStorageInfo ? `${formatStorageBytes(availableBytes)} available of ${formatStorageBytes(totalBytes)}` : "Storage information is unavailable."})
                                    ])}),
                                    div({style: "spacer"}),
                                    div({style: "secondary-bordered radius padded", content: children([
                                            div({style: "float-left space-right", content: `<svg class="text-green small-icon" width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 19.51L12.01 19.4989" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M2 8C8 3.5 16 3.5 22 8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M5 12C9 9 15 9 19 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M8.5 15.5C10.7504 14.1 13.2498 14.0996 15.5001 15.5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`}),
                                            div({style: "", content: "WiFi"}),
                                            div({style: "faded", content: network.active_interface || "Unavailable"}),
                                        ])
                                    }),
                                    div({style: "spacer"}),
                                    div({style: "secondary-bordered radius padded", content: children([
                                        div({style: "float-left space-right", content: `<svg class="text-blue small-icon" width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.75 8L17.25 16.5L11.75 22V2L17.25 7.5L6.75 16" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`}),
                                        div({style: "", content: "Bluetooth"}), div({style: "faded", content: "Unknown"})
                                    ])}),
                                    div({style: "spacer"}),
                                    div({style: "border radius", content: children([strong({style: "inline space-right", content: "Device ID"}), div({style: "inline", content: deviceInfo.serial || "Unknown"})])}),
                                    div({style: "border radius spaced", content: children([strong({style: "inline space-right", content: "Manufactured"}), div({style: "inline", content: config.name || "Unknown"})])}),
                                    div({style: "border radius spaced", content: children([strong({style: "inline space-right", content: "Software Version"}), div({style: "inline", content: config.version || "Unknown"})])}),
                                    div({style: "border radius spaced", content: children([strong({style: "inline space-right", content: "Master"}), div({style: "inline", content: `${config.master}`})])}),
                                    div({style: "border radius spaced", content: children([strong({style: "inline space-right", content: "Device Mode"}), div({style: "inline", content: config.mode || "Unknown"})])}),
                                    div({style: "border radius spaced", content: children([strong({style: "inline space-right", content: "Relay"}), div({style: "inline", content: config.relay || "Unknown"})])}),
                                    div({style: "border radius spaced", content: children([strong({style: "inline space-right", content: "Local Port"}), div({style: "inline", content: `${config.server_port || "Unknown"}`})])}),
                                    div({style: "border radius spaced", content: children([strong({style: "inline space-right", content: "Web Port"}), div({style: "inline", content: `${config.gui_host || "Unknown"}`})])}),
                                    div({style: "border radius spaced", content: children([button({style: "tiny inner-radius inline space-right", content: "Download", onclick: () => downloadDeviceInfo()}), button({style: "tiny inner-radius inline", content: "Get Support"})])})
                                ]);
                            });
                        }
                    })
                }, {
                    text: "History",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75h1.5m9 0h-9"/></svg>`,
                    route: () => {
                        const interfaces = getHistoryInterfaceOptions();
                        return div({style: "small-padding", content: children([
                            div({style: "margin-bottom", content: children([
                                dropdown({id: "home-history-interface-select", style: "home-history-select small-margin-right", ariaLabel: "Interface", options: [{label: "All cached interfaces", value: ""}, ...interfaces]}),
                                dropdown({id: "home-history-mode-select", style: "home-history-select small-margin-right", ariaLabel: "History mode", options: [{label: "Cache", value: "Cache"}, {label: "Use", value: "Use"}]}),
                                button({id: "home-history-refresh-cache", style: "tiny inner-radius small-margin-right", content: "Refresh"}),
                                button({id: "home-history-clear-cache", style: "tiny inner-radius", content: "Clear"})
                            ])}),
                            div({id: "home-history-cache-list", style: "brick padded", content: div({style: "faded small-padding", content: "Select Cache mode to browse cached files."})})
                        ])});
                    },
                    afterRender: () => initializeHistoryRoute()
                }, {
                    text: "Standards",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>`,
                    route: () => div({
                        id: "home-standards-root",
                        style: "small-padding",
                        content: children([
                            div({style: "brick small-margin-bottom settings-standards-heading", content: children([
                                h({level: 3, content: "Standards"}),
                                button({id: "settings-create-standard", type: "button", style: "tiny inner-radius", content: "Create Standard", onclick: openStandardMaker})
                            ])}),
                            div({id: "home-standards-list", style: "brick", content: div({style: "faded small-padding", content: "Loading standards..."})})
                        ])
                    }),
                    afterRender: () => initializeStandardsRoute()
                }
            ]
        }),
        new Portal({
            title: "Add Person",
            internal: true,
            dimensions: [420, 620],
            navigation: false,
            tools: [{title: "Save", icon: modular.icons.save, onclick: saveAddedPerson}],
            route: () => div({
                style: "large-padding-top small-padding fill",
                content: children([
                    div({style: "faded small-padding", content: "Enter the new person's user details."}),
                    ...ADD_PERSON_FIELDS.map(renderAddPersonField),
                    div({style: "spacer"})
                ])
            }),
            afterRender: function () {
                this.portal?.body?.().querySelector(`#${getAddPersonFieldId("firstname")}`)?.focus?.();
            }
        }),
        new Portal({
            title: "Create Standard",
            internal: true,
            dimensions: [620, 420],
            navigation: false,
            hints: ["create a standard", "create standard"],
            tools: [{
                title: "Save",
                icon: modular.icons.save,
                onclick: saveCreatedStandard
            }],
            route: () => div({style: "large-padding-top padded", content: children([
                    div({style: "standard-maker-basics", content: children([
                        div({content: children([
                            label({input: STANDARD_MAKER_FIELD_ID("mode"), content: "Kind"}),
                            dropdown({id: STANDARD_MAKER_FIELD_ID("mode"), options: [{label: "Standard", value: "standard"}, {label: "Standard definition", value: "definition"}]})
                        ])}),
                        div({content: children([
                            label({input: STANDARD_MAKER_FIELD_ID("name"), content: "Name"}),
                            input({id: STANDARD_MAKER_FIELD_ID("name"), type: "text", placeholder: "vehicle"})
                        ])}),
                        div({content: children([
                            label({input: STANDARD_MAKER_FIELD_ID("reference"), content: "Reference"}),
                            input({id: STANDARD_MAKER_FIELD_ID("reference"), type: "text", placeholder: "VHL", maxlength: 12})
                        ])})
                    ])}),
                    div({style: "standard-maker-history", content: switcher({
                        id: STANDARD_MAKER_FIELD_ID("history"),
                        style: "no-margin",
                        content: "Track record changes"
                    })}),
                    div({id: STANDARD_MAKER_FIELD_ID("helper"), style: "faded small-padding", content: "Constraints describe the fields stored in each record."}),
                    div({id: STANDARD_MAKER_FIELD_ID("rows"), style: "standard-maker-rows", content: renderStandardMakerRow("standard")}),
                    button({id: STANDARD_MAKER_FIELD_ID("add-row"), type: "button", style: "tiny inner-radius medium-margin-top", content: "Add row"})
                ])
            }),
            afterRender: initializeStandardMaker
        }),
        new Portal({
            title: "View Person",
            internal: true,
            dimensions: [350, 400],
            auto_height: true,
            navigation: false,
            resizable: false,
            tools: [
                {
                    title: "Modify",
                    icon: modular.icons.modify,
                    onclick: openModifyPersonPortal
                }
            ],
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 1 0-2.636 6.364M16.5 12V8.25"/></svg>`,
            route: renderPeopleUserPortal,
            afterRender: function () {
                this.portal?.setTitle?.(buildPeopleDisplayName(selectedPeopleUserRecord || {}));
            }
        }),
        new Portal({
            title: "Modify Person",
            internal: true,
            dimensions: [420, 620],
            navigation: false,
            tools: [
                {
                    title: "Delete",
                    icon: modular.icons.delete,
                    onclick: deleteModifiedPerson
                },
                {
                    title: "Save",
                    icon: modular.icons.save,
                    onclick: saveModifiedPerson
                }
            ],
            route: () => div({
                style: "large-padding-top small-padding fill",
                content: children([
                    div({style: "faded small-padding", content: "Modify the person's user details."}),
                    ...ADD_PERSON_FIELDS.map(renderModifyPersonField),
                    div({style: "spacer"})
                ])
            }),
            afterRender: function () {
                if (selectedPeopleUserRecord?.__isPrimaryUser) {
                    this.portal?.window?.().querySelector('[data-portal-tool-title="delete"]')?.remove?.();
                }
                this.portal?.body?.().querySelector(`#${getModifyPersonFieldId("firstname")}`)?.focus?.();
            }
        })
    ]));
})();
