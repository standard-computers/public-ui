(async () => {
    let default_settings_options = {
        name: "Default",
        font_family: "",
        bold_font: false,
        transparency: true,
        shadows: true,
        font_size: 16,
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
        hide_shortcuts: false,
        kiosk_mode: false,
        media_widget: true,
        video_widget: true,
    }
    window.StandardUI = window.StandardUI || {};
    window.StandardUI.defaultTheme = {...default_settings_options};
    let ui_settings_options = {...default_settings_options};
    const user_theme = window.StandardUI?.currentTheme || await modular.user.theme();
    if(user_theme != null) ui_settings_options = {...default_settings_options, ...user_theme};
    const BACKGROUND_IMAGE_CACHE_KEY = "ui-background";
    const BACKGROUND_IMAGE_CACHE_INTERFACE = "com.standard.settings";
    const BACKGROUND_IMAGE_META_KEY = "ui-background-meta";
    let latestDeviceInfo = null;
    const defaultDeviceInfo = {serial: "Unknown", config: {}, network: {}, storage: {}, volume: {}};
    const getDeviceInfo = () => CLI.send("status").then((response) => {
        latestDeviceInfo = response;
        return response;
    }).catch(() => {
        latestDeviceInfo = defaultDeviceInfo;
        return defaultDeviceInfo;
    });
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
    const docsRoot = "/documentation/R1";
    let docsMap = null;
    let documentationHistory = [];
    let documentationHistoryIndex = -1;
    let activeDocumentationEntry = null;
    let documentationViewerRequestVersion = 0;
    let standardsRequestVersion = 0;
    let sharedThemes = [];
    let themeTestTimer = null;
    let themeTestCountdownTimer = null;
    const escapeHtml = (value = "") => `${value}`.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[character] || character));
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
    const STANDARD_SHEETS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon brick" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" /></svg>`;
    const INTERFACES_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>`;
    const fallbackPlatformInterfaces = [
        {serviceId: "com.standard.internals", title: "Internals", icon: "/icons/interfaces/cli.png", internal: true},
        {serviceId: "com.standard.integrator", title: "Integrator", icon: "/icons/interfaces/cli.png", internal: true},
        {serviceId: "com.standard.stopwatch", title: "Stopwatch", icon: "/icons/interfaces/alarms.png", internal: true},
        {serviceId: "com.standard.files", title: "Files", icon: "/icons/interfaces/files.png"},
        {serviceId: "com.standard.calendar", title: "Calendar", icon: "/icons/interfaces/calendar.png"},
        {serviceId: "com.standard.contacts", title: "Contacts", icon: "/icons/interfaces/contacts.png"},
        {serviceId: "com.standard.email", title: "Email", icon: "/icons/interfaces/email.png"},
        {serviceId: "com.standard.alarms", title: "Alarms", icon: "/icons/interfaces/alarms.png"},
        {serviceId: "com.standard.maps", title: "Maps", icon: "/icons/interfaces/maps.png"},
        {serviceId: "com.standard.notes", title: "Notes", icon: "/icons/interfaces/notes.png"},
        {serviceId: "com.standard.weather", title: "Weather", icon: "/icons/interfaces/weather.png"},
        {serviceId: "com.standard.boards", title: "Boards", icon: "/icons/interfaces/whiteboard.png"},
        {serviceId: "com.standard.editor.text", title: "Text Editor", icon: "/icons/interfaces/editor.png"},
        {serviceId: "com.standard.editor.sheet", title: "Sheets", icon: "/icons/interfaces/editor.png"},
        {serviceId: "com.standard.editor.slides", title: "Slides", icon: "/icons/interfaces/editor.png"},
        {serviceId: "com.standard.editor.code", title: "Code Editor", icon: "/icons/interfaces/editor.png"},
        {serviceId: "com.standard.cli", title: "CLI", icon: "/icons/interfaces/cli.png"},
        {serviceId: "com.standard.settings", title: "Settings", icon: "/icons/interfaces/settings.png", required: true},
    ];
    const getPlatformInterfaces = () => {
        const interfaces = typeof window.StandardPlatformInterfaces?.all === "function" ? window.StandardPlatformInterfaces.all() : fallbackPlatformInterfaces;
        return interfaces.filter(item => item?.serviceId && item?.title);
    };
    const isPlatformInterfaceEnabled = (serviceId) => {
        if (typeof window.StandardPlatformInterfaces?.isEnabled === "function") {
            return window.StandardPlatformInterfaces.isEnabled(serviceId);
        }
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
        return icon.startsWith("<svg") ? icon : `<img src="${escapeHtml(icon)}" style="cover" alt="${escapeHtml(app.title || "")}" />`;
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
            Object.entries(value).forEach(([key, childValue]) => {
                flattenStandardRow(childValue, prefix ? `${prefix}.${key}` : key, output);
            });
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
            if (entries.length && entries.every(([, value]) => value && typeof value === "object" && !Array.isArray(value))) {
                return entries.map(([key, value]) => flattenStandardRow(value, "", {key}));
            }
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
        return [
            headers.map(escapeCsvValue).join(","),
            ...rows.map((row) => headers.map((header) => escapeCsvValue(row?.[header] ?? "")).join(","))
        ].join("\n");
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
    const getDocumentationSections = () => {
        if (!docsMap) return [];
        return Object.keys(docsMap).filter(key => /^\d+$/.test(key)).sort((a, b) => Number(a) - Number(b)).map((key) => docsMap[key]).filter(section => section?.name && Array.isArray(section.files));
    };
    const getDocumentationFileName = (fileEntry) => {
        if (typeof fileEntry === "string") return fileEntry;
        if (fileEntry && typeof fileEntry.name === "string") return fileEntry.name;
        return "";
    };
    const getDocumentationFiles = (section) => {
        if (!section || !Array.isArray(section.files)) return [];
        return section.files.map((fileEntry) => ({
            ...((fileEntry && typeof fileEntry === "object") ? fileEntry : {}),
            name: getDocumentationFileName(fileEntry)
        })).filter(({name}) => !!name);
    };
    const encodePathSegment = (segment = "") => encodeURIComponent(segment).replace(/%2F/g, "/");
    const buildDocumentationFileUrl = (sectionName = "", fileName = "") => {
        return `${docsRoot}/${encodePathSegment(sectionName)}/${encodePathSegment(fileName)}.html`;
    };
    const getDocumentationEntry = (sectionName = "", fileName = "") => {
        const section = getDocumentationSections().find(({name}) => name === sectionName);
        if (!section) return null;
        const file = getDocumentationFiles(section).find(({name}) => name === fileName);
        if (!file) return null;
        return {section: section.name, file: file.name, url: buildDocumentationFileUrl(section.name, file.name)};
    };
    const updateDocumentationHeader = () => {
        const backButton = document.getElementById("home-doc-nav-back");
        if (backButton) backButton.disabled = documentationHistoryIndex <= 0;
        const forwardButton = document.getElementById("home-doc-nav-forward");
        if (forwardButton) forwardButton.disabled = documentationHistoryIndex >= (documentationHistory.length - 1);
    };
    const renderDocumentationSelectors = () => {
        const sectionSelect = document.getElementById("home-documentation-section-select");
        const fileSelect = document.getElementById("home-documentation-file-select");
        if (!sectionSelect || !fileSelect) return;
        const sections = getDocumentationSections();
        sectionSelect.innerHTML = `<option value="">Select section</option>${sections.map((section) => `<option value="${section.name}">${section.name}</option>`).join("")}`;
        sectionSelect.value = activeDocumentationEntry?.section || "";
        const activeSection = sections.find(({name}) => name === activeDocumentationEntry?.section);
        if (!activeSection) {
            fileSelect.innerHTML = `<option value="">Select file</option>`;
            fileSelect.value = "";
            fileSelect.disabled = true;
            return;
        }
        const sectionFiles = getDocumentationFiles(activeSection);
        fileSelect.disabled = false;
        fileSelect.innerHTML = `<option value="">Select file</option>${sectionFiles.map(({name}) => `<option value="${name}">${name}</option>`).join("")}`;
        fileSelect.value = activeDocumentationEntry?.file || "";
    };
    const renderDocumentationViewer = async () => {
        const viewerRoot = document.getElementById("home-documentation-viewer");
        if (!viewerRoot) return;
        if (!activeDocumentationEntry) {
            viewerRoot.innerHTML = div({style: "faded", content: "Select a documentation file to preview it here."});
            return;
        }
        const requestVersion = ++documentationViewerRequestVersion;
        viewerRoot.innerHTML = `<div id="home-documentation-content" class="home-documentation-content bordered radius padded fill"></div>`;
        const contentRoot = document.getElementById("home-documentation-content");
        if (!contentRoot) return;
        contentRoot.innerHTML = div({style: "faded", content: "Loading documentation..."});
        try {
            const response = await fetch(activeDocumentationEntry.url);
            if (!response.ok) throw new Error(`Failed to load documentation (${response.status})`);
            const markup = await response.text();
            if (requestVersion !== documentationViewerRequestVersion) return;
            contentRoot.replaceChildren();
            const parser = new DOMParser();
            const parsed = parser.parseFromString(markup, "text/html");
            const sourceNodes = parsed.body ? Array.from(parsed.body.childNodes) : [];
            const fragment = document.createDocumentFragment();
            sourceNodes.forEach((node) => fragment.appendChild(node.cloneNode(true)));
            contentRoot.appendChild(fragment);
        } catch (_) {
            if (requestVersion !== documentationViewerRequestVersion) return;
            contentRoot.innerHTML = div({style: "faded", content: "Unable to load documentation file."});
        }
    };
    const renderDocumentationRoute = () => {
        renderDocumentationSelectors();
        renderDocumentationViewer();
        updateDocumentationHeader();
    };
    const setActiveDocumentationEntry = (entry, addToHistory = true) => {
        if (!entry) return;
        activeDocumentationEntry = entry;
        if (addToHistory) {
            documentationHistory = documentationHistory.slice(0, documentationHistoryIndex + 1);
            documentationHistory.push(entry);
            documentationHistoryIndex = documentationHistory.length - 1;
        }
        renderDocumentationRoute();
    };
    const openDocumentationEntry = (sectionName = "", fileName = "", addToHistory = true) => {
        const entry = getDocumentationEntry(sectionName, fileName);
        if (!entry) return;
        setActiveDocumentationEntry(entry, addToHistory);
    };
    const initializeDocumentationRoute = () => {
        const root = document.getElementById("home-documentation-root");
        if (!root) return;
        const backButton = document.getElementById("home-doc-nav-back");
        if (backButton) {
            backButton.onclick = () => {
                if (documentationHistoryIndex <= 0) return;
                documentationHistoryIndex -= 1;
                activeDocumentationEntry = documentationHistory[documentationHistoryIndex];
                renderDocumentationRoute();
            };
        }
        const forwardButton = document.getElementById("home-doc-nav-forward");
        if (forwardButton) {
            forwardButton.onclick = () => {
                if (documentationHistoryIndex >= (documentationHistory.length - 1)) return;
                documentationHistoryIndex += 1;
                activeDocumentationEntry = documentationHistory[documentationHistoryIndex];
                renderDocumentationRoute();
            };
        }
        const sectionSelect = document.getElementById("home-documentation-section-select");
        if (sectionSelect) {
            sectionSelect.onchange = (event) => {
                const sectionName = event.target?.value;
                if (!sectionName) return;
                const section = getDocumentationSections().find(({name}) => name === sectionName);
                const firstFileName = getDocumentationFileName(section?.files?.[0]);
                if (!firstFileName) return;
                openDocumentationEntry(sectionName, firstFileName);
            };
        }
        const fileSelect = document.getElementById("home-documentation-file-select");
        if (fileSelect) fileSelect.onchange = (event) => {
            const fileName = event.target?.value;
            if (!fileName || !activeDocumentationEntry?.section) return;
            openDocumentationEntry(activeDocumentationEntry.section, fileName);
        };
        const openExternalButton = document.getElementById("home-doc-open-external");
        if (openExternalButton) {
            openExternalButton.onclick = () => {
                if (!activeDocumentationEntry?.url) return;
                window.open(activeDocumentationEntry.url, "_blank");
            };
        }
        fetch(`${docsRoot}/map.json`).then((response) => {
            if (!response.ok) throw new Error(`Failed to load map.json (${response.status})`);
            return response.json();
        }).then((map) => {
            docsMap = map;
            const firstSection = getDocumentationSections()[0];
            if (!firstSection) {
                renderDocumentationRoute();
                return;
            }
            const firstFileName = getDocumentationFileName(firstSection.files[0]);
            if (!firstFileName) {
                renderDocumentationRoute();
                return;
            }
            openDocumentationEntry(firstSection.name, firstFileName);
        }).catch(() => {
            if (document.getElementById("home-documentation-viewer")) document.getElementById("home-documentation-viewer").innerHTML = div({style: "faded", content: "Unable to load documentation map."});
        });
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
                    window.StandardInternals.openImageSource(source, {
                        title: entry.label || cacheKey,
                        path: `cache/${interfaceName}/${cacheKey}`,
                        isObjectUrl: true,
                        revokePrevious: true,
                        sourceNode: triggerNode
                    });
                } else {
                    modular.start("com.standard.internals");
                    modular.error("Internals viewer is not ready yet");
                }
                return;
            }
            const value = await window.StandardBrowserCache?.get?.(interfaceName, cacheKey, {
                format: entry.format || "",
                responseType: entry.kind === "blob" ? "blob" : ""
            });
            const decoded = value instanceof Blob
                ? `Binary cache entry\n\nInterface: ${interfaceName}\nKey: ${cacheKey}\nType: ${entry.contentType || value.type || "application/octet-stream"}\nSize: ${formatBytes(entry.size || value.size || 0)}`
                : (typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2));
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
            const detail = [
                entry.interfaceName,
                entry.kind || "cache",
                entry.contentType || "",
                formatBytes(entry.size || 0),
                formatCacheTimestamp(entry.updatedAt || "")
            ].filter(Boolean).map(escapeHtml).join(" · ");
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
            const runningOptions = Array.from(interfaceSelect.options || []).map(option => ({label: option.textContent || option.value, value: option.value}));
            const optionMap = new Map();
            optionMap.set("", "All cached interfaces");
            runningOptions.forEach(option => {
                if (option.value) optionMap.set(option.value, option.label || option.value);
            });
            cachedInterfaces.forEach(interfaceName => {
                if (!optionMap.has(interfaceName)) optionMap.set(interfaceName, interfaceName);
            });
            interfaceSelect.innerHTML = Array.from(optionMap.entries()).map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
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
                button({style: "tiny float-right inner-radius small-margin-left no-margin-top", title: "View as sheet", icon: STANDARD_SHEETS_ICON, onclick: event => openStandardDataInSheets(reference, name, event?.target)}),
                button({style: "tiny float-right no-margin inner-radius", content: "Data", onclick: event => openStandardDataInInternals(reference, event?.target)}),
                div({style: "inline margin-bottom", content: div({style: "brick", content: `<strong>${escapeHtml(name)}</strong><span class="faded"> ${escapeHtml(reference)}</span>`})}),
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
    const applyBackgroundImage = (backgroundImageFileName) => {
        const rawValue = backgroundImageFileName === true
            ? (window.StandardUI?.currentBackgroundImageSource || window.StandardUI?.getAppliedBackgroundImageUrl?.() || "")
            : `${backgroundImageFileName || ""}`.trim();
        const imageUrl = rawValue && !rawValue.startsWith("data:") && !rawValue.startsWith("blob:") && !rawValue.startsWith("http://") && !rawValue.startsWith("https://") && !rawValue.startsWith("/")
            ? `/api/user-data/${encodeURIComponent(rawValue)}?t=${Date.now()}`
            : rawValue;
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
            if (typeof modular?.user?.writeUserCookie === "function") {
                modular.user.writeUserCookie({...((currentUserRecord && typeof currentUserRecord === "object") ? currentUserRecord : {}), userid: safeUserId, settings: payload});
            }
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
        return div({
            style: "colors settings-theme-colors",
            content: children(themeColors.map(({name, color}) => div({
                style: "color-option animated",
                background: color,
                primary: color,
                secondary: color,
                title: `${name}: ${color}`,
                content: div({style: "color-name no-wrap hidden", content: name})
            })))
        });
    };
    const renderThemeMetricPreview = (themeData = {}) => {
        const metrics = [
            {label: "Font", value: themeData.font_size, suffix: "px"},
            {label: "Radius", value: themeData.border_radius, suffix: "px"},
            {label: "Border", value: themeData.border_width, suffix: "px"}
        ].filter(({value}) => value !== undefined && value !== null && value !== "");
        if (!metrics.length) return "";
        return div({
            style: "settings-theme-metrics faded center",
            content: children(metrics.map(({label, value, suffix}) => div({
                style: "inline border inner-radius tiny small-padding space-right tiny-text",
                content: `${label} ${escapeHtml(value)}${suffix}`
            })))
        });
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
                themeNode.dispatchEvent(new MouseEvent("contextmenu", {
                    bubbles: true,
                    cancelable: true,
                    clientX: event.clientX,
                    clientY: event.clientY
                }));
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
        inputDialogue({
            title: "Save Theme",
            placeholder: "Theme name",
            confirmation: async (_, value) => {
                const name = `${value || ""}`.trim();
                if (!name) {
                    modular.error("Theme name is required");
                    return;
                }
                try {
                    const currentUserRecord = await getCurrentUserRecord();
                    const rawUserId = `${modular.user.id() || currentUserRecord?.userid || currentUserRecord?.id || ""}`.trim();
                    const response = await fetch("/api/themes", {
                        method: "POST",
                        credentials: "same-origin",
                        cache: "no-store",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({
                            name,
                            user: rawUserId,
                            data: cloneThemeData(ui_settings_options)
                        })
                    });
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
        const saved = await saveSettings({
            successMessage: ui_settings_options.kiosk_mode ? "Kiosk mode enabled" : "Kiosk mode disabled"
        });
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
    const getCurrentUserRecord = async () => {
        try {
            const selectedUserRecord = normalizeCurrentUserRecord(await modular.user.data());
            if (selectedUserRecord) return selectedUserRecord;
        } catch (_) {
        }
        const sessionUserId = `${modular.user.id() || ""}`.trim();
        if (!sessionUserId) return null;
        try {
            const allUsersResponse = await CLI.send("[user]");
            const allUsers = Array.isArray(allUsersResponse?.user)
                ? allUsersResponse.user
                : Array.isArray(allUsersResponse)
                    ? allUsersResponse
                    : [];
            return allUsers.find(userRecord => `${userRecord?.userid || ""}`.trim() === sessionUserId) || null;
        } catch (_) {
            return null;
        }
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
        const metadata = {
            format,
            mimeType: `${file?.type || ""}`.trim() || `image/${format}`,
            updatedAt: new Date().toISOString()
        };
        await window.StandardBrowserCache?.set?.(BACKGROUND_IMAGE_CACHE_INTERFACE, BACKGROUND_IMAGE_CACHE_KEY, file, {
            format,
            contentType: metadata.mimeType,
            label: "Background image"
        });
        await window.StandardBrowserCache?.set?.(BACKGROUND_IMAGE_CACHE_INTERFACE, BACKGROUND_IMAGE_META_KEY, metadata, {
            format: "json",
            contentType: "application/json",
            label: "Background image metadata"
        });
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
        if (format) {
            await window.StandardBrowserCache?.delete?.(BACKGROUND_IMAGE_CACHE_INTERFACE, BACKGROUND_IMAGE_CACHE_KEY, {format});
        }
        await window.StandardBrowserCache?.delete?.(BACKGROUND_IMAGE_CACHE_INTERFACE, BACKGROUND_IMAGE_META_KEY, {format: "json"});
    };
    const getAppliedBackgroundImageUrl = () => {
        if (typeof window.StandardUI?.getAppliedBackgroundImageUrl === "function") {
            return window.StandardUI.getAppliedBackgroundImageUrl() || "";
        }
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
            confirmationDialogue({
                title: "Remove Background Image",
                content: "You're sure you want to remove the current background image?",
                confirmation: async () => {
                    modular.message("Removing background image...");
                    try {
                        await deleteBackgroundImageCache();
                        ui_settings_options.background_image = false;
                        if (window.StandardUI?.currentBackgroundImageSource?.startsWith?.("blob:")) {
                            URL.revokeObjectURL(window.StandardUI.currentBackgroundImageSource);
                        }
                        if (window.StandardUI) window.StandardUI.currentBackgroundImageSource = "";
                        refreshUITheme();
                        renderBackgroundImageThumbnail();
                        await saveSettings({
                            successMessage: "Background image removed",
                            errorMessage: "Unable to save background image removal"
                        });
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
    const buildProfileImageUrl = (recordId = "") => {
        const safeRecordId = sanitizeUserRecordId(recordId);
        return safeRecordId ? `/api/records/images/${encodeURIComponent(safeRecordId)}?cb=${safeRecordId}-${getPeopleProfileImageCacheKey(safeRecordId)}` : "";
    };
    const checkPeopleProfileImageExists = async (recordId = "") => {
        const profileImageUrl = buildProfileImageUrl(recordId);
        if (!profileImageUrl) return false;
        try {
            const response = await fetch(profileImageUrl, {
                credentials: "same-origin",
                cache: "no-store"
            });
            return response.ok;
        } catch (_) {
            return false;
        }
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
            const uploadResponse = typeof window.StandardUploads?.uploadFile === "function"
                ? await window.StandardUploads.uploadFile(file, `/api/upload/temp/${encodeURIComponent(userRecordId)}`, {
                    label: `Uploading ${file.name || "profile photo"}`
                })
                : await fetch(`/api/upload/temp/${encodeURIComponent(userRecordId)}`, {
                    method: "POST",
                    body: (() => {
                        const formData = new FormData();
                        formData.append("file", file, file.name || "profile-photo");
                        return formData;
                    })()
                }).then(async response => ({
                    ok: response.ok,
                    status: response.status,
                    responseText: await response.text()
                }));
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
    const renderPeopleRoute = async () => {
        const routeRoot = document.getElementById("settings-people-route");
        if (!routeRoot) return;
        routeRoot.innerHTML = div({style: "faded padded", content: "Loading user..."});
        const userRecord = await getCurrentUserRecord();
        const userRecordId = await getCurrentUserRecordId(userRecord);
        const hasProfileImage = userRecordId ? await checkPeopleProfileImageExists(userRecordId) : false;
        const displayName = buildPeopleDisplayName(userRecord || {});
        const username = buildPeopleUsername(userRecord || {});
        const email = `${userRecord?.email || ""}`.trim();
        const profileImageUrl = hasProfileImage ? buildProfileImageUrl(userRecordId) : "";
        routeRoot.innerHTML = div({style: "padded", content: children([
            div({style: "secondary-bordered radius padded shadowed", content: children([
                button({
                    id: "people-profile-photo-button",
                    style: `naked no-margin ${hasProfileImage ? "" : "background-secondary"} round float-left space-right`,
                    content: hasProfileImage
                        ? img({src: profileImageUrl, style: "round cover medium-icon", alt: displayName, width: 56, height: 56})
                        : `<svg class="text-foreground" xmlns="http://www.w3.org/2000/svg" width="56" height="56" fill="none" viewBox="0 0 24 24" stroke-width="1.35" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75a17.933 17.933 0 0 1-7.499-1.632Z" /></svg>`,
                    width: 56,
                    height: 56
                }),
                div({style: "small-padding-top", content: children([
                    div({style: "bold", content: displayName}),
                    div({style: "faded", content: username}),
                    email ? div({style: "faded small-padding-top", content: email}) : ""
                ])})
            ])}),
            !userRecord ? div({style: "faded small-padding", content: "No selected user record was returned for this session."}) : ""
        ])});
        const photoButton = document.getElementById("people-profile-photo-button");
        if (!photoButton) return;
        if (peopleProfileFileInput) {
            peopleProfileFileInput.remove();
            peopleProfileFileInput = null;
        }
        const fileInput = document.createElement("input");
        peopleProfileFileInput = fileInput;
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);
        photoButton.style.cursor = "pointer";
        photoButton.onclick = () => fileInput.click();
        fileInput.onchange = async () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            const didUpload = await uploadPeopleProfilePhoto(file, userRecord);
            fileInput.value = "";
            fileInput.remove();
            if (peopleProfileFileInput === fileInput) peopleProfileFileInput = null;
            if (didUpload) {
                renderPeopleRoute();
            }
        };
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
            dimensions: [850, 700],
            navigation: false,
            svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`,
            icon: "/icons/interfaces/settings.png",
            routes: [
                {
                    text: "People",
                    icon: `<svg class="text-foreground small-icon" width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 20V19C5 15.134 8.13401 12 12 12V12C15.866 12 19 15.134 19 19V20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
                    route: () => div({id: "settings-people-route", content: div({style: "faded padded", content: "Loading user..."})}),
                    afterRender: () => {
                        renderPeopleRoute();
                    }
                }, {
                    text: "Notifications",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>`,
                    route: () => div({style: "padded", content: children([
                            div({style: "spacer"}),
                            switcher({style: "float-right", id: "bold-text", checked: ui_settings_options.bold_font}),
                            label({style: "faded", content: "SMS"}),
                            em({style: "faded", content: "Device will send SMS alerts"}),
                            div({style: "big-spacer"}),
                            switcher({style: "float-right", id: "bold-text", checked: ui_settings_options.bold_font}),
                            label({style: "faded", content: "Email"}),
                            em({style: "faded", content: "Device will send Email alerts"}),
                            div({style: "big-spacer"}),
                            switcher({style: "float-right", id: "bold-text", checked: ui_settings_options.bold_font}),
                            label({style: "faded", content: "Spoken"}),
                            em({style: "faded", content: "Device can speak notifications"}),
                        ])
                    })
                }, {
                    text: "Appearance",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" /></svg>`,
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
                            switcher({id: "use_svgs", style: "float-right", checked: ui_settings_options.use_svg_icons}),
                            label({style: "faded", content: "Use SVG Icons"}),
                            em({content: "Window icons will be shape outlines"}),
                            div({style: "big-spacer"}),
                            label({style: "faded", content: "Font Size"}),
                            numbers({id: "font_size", min: 10, max: 24, reference: "--radius"}),
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
                        loadSharedThemes();
                        renderBackgroundImageThumbnail();
                    }
                }, {
                    text: "Behavior",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M4.867 19.125h.008v.008h-.008v-.008Z" /></svg>`,
                    route: () => div({style: "padded adjust-top", content: children([
                            div({style: "spacer"}),
                            switcher({id: "interface-state", checked: ui_settings_options.interface_state}),
                            label({style: "faded", content: "Save Interface State"}),
                            div({style: "big-spacer"}),
                            switcher({id: "hide-shortcuts", checked: ui_settings_options.hide_shortcuts}),
                            label({style: "faded", content: "Hide Shortcuts"}),
                            div({style: "big-spacer"}),
                            switcher({id: "kiosk-mode", checked: ui_settings_options.kiosk_mode === true}),
                            label({style: "faded", content: "Kiosk Mode"}),
                            em({style: "faded", content: "Make browser full screen"}),
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
                        document.getElementById("hide-shortcuts").addEventListener("change", _ => {
                            ui_settings_options.hide_shortcuts = !ui_settings_options.hide_shortcuts;
                            saveSettings();
                        });
                        document.getElementById("kiosk-mode").addEventListener("change", event => {
                            updateKioskMode(event.target?.checked === true);
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
                    text: "Device Info",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>`,
                    route: () => div({style: "list spaced padded", content: () => {
                            return getDeviceInfo().then((deviceInfo) => {
                                const config = deviceInfo?.config || {};
                                const network = deviceInfo?.network || {};
                                return children([
                                    div({style: "secondary-bordered radius padded", content: children([
                                            div({style: "float-left space-right",
                                                content: `<svg class="text-green small-icon" width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 19.51L12.01 19.4989" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M2 8C8 3.5 16 3.5 22 8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M5 12C9 9 15 9 19 12" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M8.5 15.5C10.7504 14.1 13.2498 14.0996 15.5001 15.5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`
                                            }),
                                            div({style: "", content: "WiFi"}),
                                            div({style: "faded", content: network.active_interface || "Unavailable"}),
                                        ])
                                    }),
                                    div({style: "spacer"}),
                                    div({style: "secondary-bordered radius padded", content: children([
                                            div({style: "float-left space-right",
                                                content: `<svg class="text-blue small-icon" width="24px" height="24px" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.75 8L17.25 16.5L11.75 22V2L17.25 7.5L6.75 16" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`
                                            }),
                                            div({style: "", content: "Bluetooth"}),
                                            div({style: "faded", content: "Unknown"}),
                                        ])
                                    }),
                                    div({style: "spacer"}),
                                    div({style: "border radius", content: children([
                                            strong({style: "inline space-right", content: "Device ID"}),
                                            div({style: "inline", content: deviceInfo.serial || "Unknown"}),
                                        ])
                                    }),
                                    div({style: "border radius spaced", content: children([
                                            strong({style: "inline space-right", content: "Manufactured"}),
                                            div({style: "inline", content: config.name || "Unknown"}),
                                        ])
                                    }),
                                    div({style: "border radius spaced", content: children([
                                            strong({style: "inline space-right", content: "Software Version"}),
                                            div({style: "inline", content: config.version || "Unknown"}),
                                        ])
                                    }),
                                    div({style: "border radius spaced", content: children([
                                            strong({style: "inline space-right", content: "Master"}),
                                            div({style: "inline", content: `${config.master}`}),
                                        ])
                                    }),
                                    div({style: "border radius spaced", content: children([
                                            strong({style: "inline space-right", content: "Device Mode"}),
                                            div({style: "inline", content: config.mode || "Unknown"}),
                                        ])
                                    }),
                                    div({style: "border radius spaced", content: children([
                                            strong({style: "inline space-right", content: "Relay"}),
                                            div({style: "inline", content: config.relay || "Unknown"}),
                                        ])
                                    }),
                                    div({style: "border radius spaced", content: children([
                                            strong({style: "inline space-right", content: "Local Port"}),
                                            div({style: "inline", content: `${config.server_port || "Unknown"}`}),
                                        ])
                                    }),
                                    div({style: "border radius spaced", content: children([
                                            strong({style: "inline space-right", content: "Web Port"}),
                                            div({style: "inline", content: `${config.gui_host || "Unknown"}`}),
                                        ])
                                    }),
                                    div({style: "border radius spaced", content: children([
                                            button({style: "tiny inner-radius inline space-right", content: "Download", onclick: () => downloadDeviceInfo()}),
                                            button({style: "tiny inner-radius inline", content: "Get Support"}),
                                        ])
                                    })
                                ]);
                            });
                        }
                    })
                }, {
                    text: "History",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75h1.5m9 0h-9" /></svg>`,
                    route: () => {
                        const interfaces = (modular.running || []).map((service) => {
                            const shortcut = service?.interfaceShortcut?.();
                            return {
                                label: shortcut?.title ?? "",
                                value: shortcut ? service?.name?.() ?? "" : ""
                            };
                        }).filter((option) => option.label && option.value);
                        return div({style: "small-padding", content: children([
                            div({style: "margin-bottom", content: children([
                                select({id: "home-history-interface-select", style: "home-documentation-select small-margin-right", options: interfaces}),
                                select({id: "home-history-mode-select", style: "home-documentation-select small-margin-right", options: [{label: "Cache", value: "Cache"}, {label: "Use", value: "Use"}]}),
                                button({id: "home-history-refresh-cache", style: "tiny inner-radius small-margin-right", content: "Refresh"}),
                                button({id: "home-history-clear-cache", style: "tiny inner-radius", content: "Clear"})
                            ])}),
                            div({id: "home-history-cache-list", style: "brick padded", content: div({style: "faded small-padding", content: "Select Cache mode to browse cached files."})})
                        ])});
                    },
                    afterRender: () => initializeHistoryRoute()
                }, {
                    text: "Manual",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>`,
                    route: () => div({id: "home-documentation-root", style: "small-padding", content: children([
                        div({style: "brick no-wrap", content: children([
                            div({style: "inline margin-right", content: children([
                                button({id: "home-doc-nav-back", style: "small naked hover-zoom",
                                    disabled: true,
                                    icon: `<svg class="smaller-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>`
                                }),
                                button({id: "home-doc-nav-forward", style: "small naked hover-zoom",
                                    disabled: true,
                                    icon: `<svg class="smaller-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>`
                                })
                            ])}),
                            div({style: "inline margin-right", content: h({level: 3, id: "home-documentation-title", style: "very-small-padding-top padding-left inline", content: "Documentation"})}),
                            div({style: "inline small-margin-right faded", content: `<select id="home-documentation-section-select" class="home-documentation-select inline"><option value="">Select section</option></select>`}),
                            div({style: "inline faded", content: `<select id="home-documentation-file-select" class="home-documentation-select inline"><option value="">Select file</option></select>`}),
                        ])}),
                        div({id: "home-documentation-viewer", style: "brick small-padding-top padding-right", content: div({style: "faded padding-top margin-top", content: "Loading documentation..."})})
                    ])}),
                    afterRender: () => initializeDocumentationRoute()
                }, {
                    text: "Standards",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>`,
                    route: () => div({
                        id: "home-standards-root",
                        style: "small-padding",
                        content: children([
                            div({style: "brick small-margin-bottom", content: h({level: 3, content: "Standards"})}),
                            div({id: "home-standards-list", style: "brick", content: div({style: "faded small-padding", content: "Loading standards..."})})
                        ])
                    }),
                    afterRender: () => initializeStandardsRoute()
                }
            ]
        })
    ]));
})();
