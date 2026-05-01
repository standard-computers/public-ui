(() => {
    const SERVICE_ID = "com.standard.editor.sheet";
    const DEFAULT_SHEET_ROWS = 25;
    const DEFAULT_SHEET_COLUMNS = 12;
    const SHEET_ROW_GROWTH = 25;
    const SHEET_COLUMN_GROWTH = 6;
    const SHEET_SCROLL_BUFFER = 120;
    const SHEET_ROW_HEADER_WIDTH = 46;
    const SHEET_HEADER_HEIGHT = 36;
    const SHEET_DEFAULT_ROW_HEIGHT = 36;
    const SHEET_MIN_ROW_HEIGHT = 28;
    const SHEET_MAX_ROW_HEIGHT = 160;
    const SHEET_MIN_CELL_WIDTH = 72;
    const SHEET_DEFAULT_MAX_CELL_WIDTH = 180;
    const SHEET_MAX_CELL_WIDTH = 720;
    const SHEET_MIN_GRID_HEIGHT = 180;
    const sheetCellValues = {};
    const sheetCellStyles = {};
    const sheetCellTypes = {};
    const sheetCellLinks = {};
    const sheetCellLocks = {};
    const sheetColumnWidths = {};
    const sheetRowHeights = {};
    let sheetRows = DEFAULT_SHEET_ROWS;
    let sheetColumns = DEFAULT_SHEET_COLUMNS;
    let activeSheetCell = "A1";
    let activeSheetRow = null;
    let activeSheetColumn = null;
    let activeSheetRangeStart = null;
    let activeSheetRangeEnd = null;
    let activeSheetFilePath = "";
    let skipNextSheetStateRestore = false;
    let isGrowingSheetGrid = false;
    let sheetArrowNavigationBound = false;
    let isDraggingSheetSelection = false;
    let sheetSelectionAnchor = null;
    let activeSheetResize = null;
    const sheetResolvedColorCache = new Map();
    const SHEET_TEXT_COLORS = [
        {label: "Default", value: ""},
        {label: "Ink", value: "var(--fg)"},
        {label: "Blue", value: "var(--blue)"},
        {label: "Green", value: "var(--green)"},
        {label: "Orange", value: "var(--orange)"},
        {label: "Red", value: "var(--red)"}
    ];
    const SHEET_FILL_COLORS = [
        {label: "None", value: ""},
        {label: "Paper", value: "var(--bg)"},
        {label: "Soft", value: "var(--secondary-bg)"},
        {label: "Blue", value: "#dbeafe"},
        {label: "Green", value: "#dcfce7"},
        {label: "Yellow", value: "#fef3c7"}
    ];
    const SHEET_ALIGN_ICONS = {
        left: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" d="M4 6.5h16M4 10.5h10M4 14.5h16M4 18.5h10" /></svg>`,
        center: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" d="M4 6.5h16M7 10.5h10M4 14.5h16M7 18.5h10" /></svg>`,
        right: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" d="M4 6.5h16M10 10.5h10M4 14.5h16M10 18.5h10" /></svg>`
    };
    const SHEET_LINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" style="fill:none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path fill="none" style="fill:none" stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>`;
    const SHEET_LOCK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>`;
    const SHEET_UNLOCK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>`;
    const SHEET_CELL_TYPES = [
        {label: "Auto", value: ""},
        {label: "Text", value: "text"},
        {label: "Number", value: "number"},
        {label: "Date", value: "date"}
    ];

    const findSheetWindow = () => [...Array.from(document.querySelectorAll(".draggable-window"))]
        .reverse()
        .find((windowNode) => windowNode?.portal?.serviceId?.() === SERVICE_ID) || null;
    const findSheetPortal = () => findSheetWindow()?.portal;
    const isSheetWindowShown = () => {
        const sheetWindow = findSheetWindow();
        return !!(sheetWindow
            && sheetWindow.parentElement
            && !sheetWindow.classList.contains("minimized")
            && sheetWindow.classList.contains("window-focused"));
    };
    const normalizeSheetFilePath = (rawPath = "") => String(rawPath || "").replace(/^\/home\/standard-system\//, "").replace(/^\/+/, "");
    const getSheetFileName = (rawPath = "") => String(rawPath || "").split("/").pop() || "";
    const getSheetFileDirectory = (rawPath = "") => {
        const normalizedPath = normalizeSheetFilePath(rawPath);
        if (!normalizedPath.includes("/")) return "";
        return normalizedPath.split("/").slice(0, -1).join("/");
    };
    const ensureSheetExtension = (rawName = "") => /\.sprdshts$/i.test(String(rawName || "")) ? String(rawName || "") : `${String(rawName || "")}.sprdshts`;
    const sanitizeSheetFileName = (rawName = "") => {
        const trimmedName = String(rawName || "").trim().replace(/\\/g, "/");
        const baseName = trimmedName.split("/").pop() || "";
        const withoutLeadingDots = baseName.replace(/^\.+/, "");
        return ensureSheetExtension(withoutLeadingDots.replace(/[^a-zA-Z0-9._-]/g, ""));
    };
    const clearSheetCellValues = () => {
        Object.keys(sheetCellValues).forEach((key) => delete sheetCellValues[key]);
    };
    const clearSheetCellStyles = () => {
        Object.keys(sheetCellStyles).forEach((key) => delete sheetCellStyles[key]);
    };
    const clearSheetCellTypes = () => {
        Object.keys(sheetCellTypes).forEach((key) => delete sheetCellTypes[key]);
    };
    const clearSheetCellLinks = () => {
        Object.keys(sheetCellLinks).forEach((key) => delete sheetCellLinks[key]);
    };
    const clearSheetCellLocks = () => {
        Object.keys(sheetCellLocks).forEach((key) => delete sheetCellLocks[key]);
    };
    const clearSheetColumnWidths = () => {
        Object.keys(sheetColumnWidths).forEach((key) => delete sheetColumnWidths[key]);
    };
    const clearSheetRowHeights = () => {
        Object.keys(sheetRowHeights).forEach((key) => delete sheetRowHeights[key]);
    };
    const normalizeSheetDimensionPayload = (rawDimensions = {}, maxCount = 0, minValue = 0, maxValue = Number.POSITIVE_INFINITY) => {
        if (!rawDimensions || typeof rawDimensions !== "object" || Array.isArray(rawDimensions)) return {};
        return Object.fromEntries(Object.entries(rawDimensions).flatMap(([rawIndex, rawValue]) => {
            const index = Number.parseInt(rawIndex, 10);
            const value = Number(rawValue);
            if (!Number.isInteger(index) || index < 0 || index >= maxCount) return [];
            if (!Number.isFinite(value)) return [];
            return [[String(index), Math.min(maxValue, Math.max(minValue, Math.round(value)))]];
        }));
    };
    const buildSheetDimensionPayload = (source = {}, maxCount = 0, defaultValue = 0) => Object.fromEntries(
        Object.entries(source).flatMap(([rawIndex, rawValue]) => {
            const index = Number.parseInt(rawIndex, 10);
            const value = Number(rawValue);
            if (!Number.isInteger(index) || index < 0 || index >= maxCount) return [];
            if (!Number.isFinite(value) || Math.round(value) === Math.round(defaultValue)) return [];
            return [[String(index), Math.round(value)]];
        })
    );
    const normalizeSheetCellStyle = (rawStyle = {}) => {
        if (!rawStyle || typeof rawStyle !== "object" || Array.isArray(rawStyle)) return {};
        const normalizedStyle = {};
        const align = String(rawStyle.textAlign || rawStyle.a || "").trim().toLowerCase();
        if (["left", "center", "right"].includes(align)) normalizedStyle.textAlign = align;
        const fontWeight = rawStyle.fontWeight === "bold" || rawStyle.b === 1 || rawStyle.b === true ? "bold" : "";
        if (fontWeight) normalizedStyle.fontWeight = fontWeight;
        const fontStyle = rawStyle.fontStyle === "italic" || rawStyle.i === 1 || rawStyle.i === true ? "italic" : "";
        if (fontStyle) normalizedStyle.fontStyle = fontStyle;
        const textDecoration = rawStyle.textDecoration === "underline" || rawStyle.u === 1 || rawStyle.u === true ? "underline" : "";
        if (textDecoration) normalizedStyle.textDecoration = textDecoration;
        const color = String(rawStyle.color || rawStyle.c || "").trim();
        if (color && color !== "transparent") normalizedStyle.color = color;
        const backgroundColor = String(rawStyle.backgroundColor || rawStyle.g || "").trim();
        if (backgroundColor && backgroundColor !== "transparent") normalizedStyle.backgroundColor = backgroundColor;
        const rawFontSize = rawStyle.fontSize || rawStyle.s || "";
        const numericFontSize = Number(String(rawFontSize).replace(/px$/i, ""));
        if (Number.isFinite(numericFontSize) && numericFontSize >= 8 && numericFontSize <= 72) {
            normalizedStyle.fontSize = `${numericFontSize}px`;
        }
        return normalizedStyle;
    };
    const encodeSheetCellStyle = (rawStyle = {}) => {
        const normalizedStyle = normalizeSheetCellStyle(rawStyle);
        const encodedStyle = {};
        if (normalizedStyle.textAlign) encodedStyle.a = normalizedStyle.textAlign;
        if (normalizedStyle.fontWeight === "bold") encodedStyle.b = 1;
        if (normalizedStyle.fontStyle === "italic") encodedStyle.i = 1;
        if (normalizedStyle.textDecoration === "underline") encodedStyle.u = 1;
        if (normalizedStyle.color) encodedStyle.c = normalizedStyle.color;
        if (normalizedStyle.backgroundColor) encodedStyle.g = normalizedStyle.backgroundColor;
        if (normalizedStyle.fontSize) encodedStyle.s = Number(String(normalizedStyle.fontSize).replace(/px$/i, ""));
        return encodedStyle;
    };
    const normalizeSheetCellType = (rawType = "") => {
        const normalizedType = String(rawType?.type || rawType || "").trim().toLowerCase();
        return ["text", "number", "date"].includes(normalizedType) ? normalizedType : "";
    };
    const normalizeSheetHyperlinkUrl = (rawUrl = "") => {
        const trimmedUrl = String(rawUrl || "").trim();
        if (!trimmedUrl) return "";
        if (/^(https?:|mailto:|tel:)/i.test(trimmedUrl)) return trimmedUrl;
        if (/^[#/]/.test(trimmedUrl)) return trimmedUrl;
        return `https://${trimmedUrl}`;
    };
    const getSheetCellStyle = (cellReference = "") => normalizeSheetCellStyle(sheetCellStyles[cellReference]);
    const setSheetCellStyle = (cellReference = "", nextStyle = {}) => {
        const encodedStyle = encodeSheetCellStyle(nextStyle);
        if (Object.keys(encodedStyle).length) {
            sheetCellStyles[cellReference] = encodedStyle;
        } else {
            delete sheetCellStyles[cellReference];
        }
    };
    const getSheetCellType = (cellReference = "") => normalizeSheetCellType(sheetCellTypes[cellReference]);
    const setSheetCellType = (cellReference = "", nextType = "") => {
        const encodedType = normalizeSheetCellType(nextType);
        if (encodedType) {
            sheetCellTypes[cellReference] = encodedType;
        } else {
            delete sheetCellTypes[cellReference];
        }
    };
    const getSheetCellLink = (cellReference = "") => normalizeSheetHyperlinkUrl(sheetCellLinks[cellReference]);
    const setSheetCellLink = (cellReference = "", rawUrl = "") => {
        const normalizedUrl = normalizeSheetHyperlinkUrl(rawUrl);
        if (normalizedUrl) {
            sheetCellLinks[cellReference] = normalizedUrl;
        } else {
            delete sheetCellLinks[cellReference];
        }
    };
    const isSheetCellLocked = (cellReference = "") => sheetCellLocks[cellReference] === true || sheetCellLocks[cellReference] === 1;
    const setSheetCellLocked = (cellReference = "", isLocked = false) => {
        if (isLocked) {
            sheetCellLocks[cellReference] = 1;
        } else {
            delete sheetCellLocks[cellReference];
        }
    };
    const buildSheetStylesPayload = () => Object.fromEntries(Object.entries(sheetCellStyles).map(([cell, style]) => [cell, encodeSheetCellStyle(style)]).filter(([, style]) => Object.keys(style).length));
    const buildSheetTypesPayload = () => Object.fromEntries(Object.entries(sheetCellTypes).map(([cell, type]) => [cell, normalizeSheetCellType(type)]).filter(([, type]) => type));
    const buildSheetLinksPayload = () => Object.fromEntries(Object.entries(sheetCellLinks).map(([cell, link]) => [cell, normalizeSheetHyperlinkUrl(link)]).filter(([, link]) => link));
    const buildSheetLocksPayload = () => Object.fromEntries(Object.keys(sheetCellLocks).filter((cell) => isSheetCellLocked(cell)).map((cell) => [cell, 1]));
    const captureActiveSheetInput = () => {
        const activeElement = document.activeElement;
        const id = String(activeElement?.id || "");
        if (id.startsWith("sheet-cell-")) {
            const cellReference = id.replace("sheet-cell-", "");
            sheetCellValues[cellReference] = activeElement.value;
        }
    };
    const getDefaultSheetColumnWidth = () => {
        const gridWrap = document.getElementById("editor-sheet-grid-wrap");
        const gridPanel = document.querySelector(".editor-sheet-grid-panel");
        const availableGridWidth = Math.max(
            Math.floor(gridWrap?.clientWidth || gridPanel?.getBoundingClientRect?.().width || 0),
            SHEET_ROW_HEADER_WIDTH
        );
        return Math.max(
            SHEET_MIN_CELL_WIDTH,
            Math.min(
                SHEET_DEFAULT_MAX_CELL_WIDTH,
                Math.floor((availableGridWidth - SHEET_ROW_HEADER_WIDTH) / Math.max(sheetColumns, 1))
            )
        );
    };
    const buildSheetPayload = () => ({
        format: "std.sheet.v1",
        fileName: getSheetFileName(activeSheetFilePath).replace(/\.sprdshts$/i, "") || "spreadsheet",
        updatedAt: new Date().toISOString(),
        rows: sheetRows,
        columns: sheetColumns,
        cells: {...sheetCellValues},
        styles: buildSheetStylesPayload(),
        types: buildSheetTypesPayload(),
        links: buildSheetLinksPayload(),
        locked: buildSheetLocksPayload(),
        columnWidths: buildSheetDimensionPayload(sheetColumnWidths, sheetColumns, getDefaultSheetColumnWidth()),
        rowHeights: buildSheetDimensionPayload(sheetRowHeights, sheetRows, SHEET_DEFAULT_ROW_HEIGHT),
        activeSheetCell,
        activeSheetRow,
        activeSheetColumn
    });
    const parseSheetPayload = (rawPayload = {}) => {
        clearSheetCellValues();
        clearSheetCellStyles();
        clearSheetCellTypes();
        clearSheetCellLinks();
        clearSheetCellLocks();
        clearSheetColumnWidths();
        clearSheetRowHeights();
        const payloadCells = rawPayload?.cells;
        if (payloadCells && typeof payloadCells === "object") {
            Object.entries(payloadCells).forEach(([cell, value]) => {
                sheetCellValues[cell] = String(value ?? "");
            });
        } else if (rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)) {
            Object.entries(rawPayload).forEach(([cell, value]) => {
                if (/^[A-Z]+\d+$/.test(cell)) sheetCellValues[cell] = String(value ?? "");
            });
        }
        const payloadStyles = rawPayload?.styles;
        if (payloadStyles && typeof payloadStyles === "object" && !Array.isArray(payloadStyles)) {
            Object.entries(payloadStyles).forEach(([cell, style]) => {
                setSheetCellStyle(cell, style);
            });
        }
        const payloadTypes = rawPayload?.types;
        if (payloadTypes && typeof payloadTypes === "object" && !Array.isArray(payloadTypes)) {
            Object.entries(payloadTypes).forEach(([cell, type]) => {
                setSheetCellType(cell, type);
            });
        }
        const payloadLinks = rawPayload?.links;
        if (payloadLinks && typeof payloadLinks === "object" && !Array.isArray(payloadLinks)) {
            Object.entries(payloadLinks).forEach(([cell, link]) => {
                setSheetCellLink(cell, link);
            });
        }
        const payloadLocks = rawPayload?.locked || rawPayload?.locks;
        if (payloadLocks && typeof payloadLocks === "object" && !Array.isArray(payloadLocks)) {
            Object.entries(payloadLocks).forEach(([cell, locked]) => {
                setSheetCellLocked(cell, locked === true || locked === 1);
            });
        }
        activeSheetCell = String(rawPayload?.activeSheetCell || "A1");
        activeSheetRow = Number.isInteger(rawPayload?.activeSheetRow) ? rawPayload.activeSheetRow : null;
        activeSheetColumn = Number.isInteger(rawPayload?.activeSheetColumn) ? rawPayload.activeSheetColumn : null;
        sheetRows = Number.isInteger(rawPayload?.rows) && rawPayload.rows > 0 ? rawPayload.rows : DEFAULT_SHEET_ROWS;
        sheetColumns = Number.isInteger(rawPayload?.columns) && rawPayload.columns > 0 ? rawPayload.columns : DEFAULT_SHEET_COLUMNS;
        Object.assign(sheetColumnWidths, normalizeSheetDimensionPayload(rawPayload?.columnWidths, sheetColumns, SHEET_MIN_CELL_WIDTH, SHEET_MAX_CELL_WIDTH));
        Object.assign(sheetRowHeights, normalizeSheetDimensionPayload(rawPayload?.rowHeights, sheetRows, SHEET_MIN_ROW_HEIGHT, SHEET_MAX_ROW_HEIGHT));
    };
    const updateSheetPortalTitle = () => {
        const sheetPortal = findSheetPortal();
        if (sheetPortal?.setTitle) {
            sheetPortal.setTitle(activeSheetFilePath ? getSheetFileName(activeSheetFilePath) : "Sheet");
        }
    };
    const saveSheetPortalState = () => {
        const portal = findSheetPortal();
        if (!portal || typeof portal.setWindowState !== "function") return;
        portal.setWindowState({
            directive: activeSheetFilePath,
            cells: {...sheetCellValues},
            styles: buildSheetStylesPayload(),
            types: buildSheetTypesPayload(),
            links: buildSheetLinksPayload(),
            locked: buildSheetLocksPayload(),
            columnWidths: buildSheetDimensionPayload(sheetColumnWidths, sheetColumns, getDefaultSheetColumnWidth()),
            rowHeights: buildSheetDimensionPayload(sheetRowHeights, sheetRows, SHEET_DEFAULT_ROW_HEIGHT),
            activeSheetCell,
            activeSheetRow,
            activeSheetColumn,
            rows: sheetRows,
            columns: sheetColumns
        });
        updateSheetPortalTitle();
    };
    const restoreSheetPortalState = () => {
        if (skipNextSheetStateRestore) {
            skipNextSheetStateRestore = false;
            return;
        }
        const state = findSheetPortal()?.windowState?.() || {};
        parseSheetPayload({
            cells: state?.cells || {},
            styles: state?.styles || {},
            types: state?.types || {},
            links: state?.links || {},
            locked: state?.locked || {},
            columnWidths: state?.columnWidths || {},
            rowHeights: state?.rowHeights || {},
            activeSheetCell: state?.activeSheetCell,
            activeSheetRow: state?.activeSheetRow,
            activeSheetColumn: state?.activeSheetColumn,
            rows: state?.rows,
            columns: state?.columns
        });
        activeSheetFilePath = normalizeSheetFilePath(state?.directive || "");
        updateSheetPortalTitle();
    };
    const saveSheetToPath = async (targetPath = "") => {
        const normalizedPath = normalizeSheetFilePath(targetPath);
        if (!normalizedPath) {
            modular.error("File name is required");
            return false;
        }
        captureActiveSheetInput();
        const payload = buildSheetPayload();
        const serializedSheet = JSON.stringify(payload);
        const bytes = new TextEncoder().encode(serializedSheet);
        const fileName = getSheetFileName(normalizedPath);
        const directory = getSheetFileDirectory(normalizedPath);
        const uploadPath = directory ? `/api/upload?directory=${encodeURIComponent(directory)}` : "/api/upload";
        const sheetFile = new File([bytes], fileName, {type: "application/octet-stream"});
        let saved = false;
        if (typeof window.StandardUploads?.uploadFile === "function") {
            const response = await window.StandardUploads.uploadFile(sheetFile, uploadPath, {
                label: `Saving ${fileName}`
            });
            saved = !!response?.ok;
        } else {
            const formData = new FormData();
            formData.append("file", sheetFile);
            const response = await fetch(uploadPath, {method: "POST", body: formData});
            saved = response.ok;
        }
        if (!saved) {
            modular.error("Unable to save spreadsheet");
            return false;
        }
        activeSheetFilePath = normalizedPath;
        saveSheetPortalState();
        updateSheetPortalTitle();
        modular.success(`Saved ${normalizedPath} (${bytes.length} bytes)`);
        return true;
    };
    const saveNewSheetToDocuments = () => {
        inputDialogue({
            title: "File name",
            placeholder: "spreadsheet.sprdshts",
            value: "spreadsheet.sprdshts",
            confirmation: async (_, inputFileName) => {
                if (!modular.validateFileName(inputFileName)) return;
                const safeFileName = sanitizeSheetFileName(inputFileName) || "spreadsheet.sprdshts";
                await saveSheetToPath(`Documents/${safeFileName}`);
            }
        });
    };
    const saveLoadedSheet = async () => {
        if (!activeSheetFilePath) {
            saveNewSheetToDocuments();
            return;
        }
        await saveSheetToPath(activeSheetFilePath);
    };
    const applySheetPayload = (rawPath = "", payload = null) => {
        const sheetPath = normalizeSheetFilePath(rawPath);
        if (!sheetPath) return false;
        parseSheetPayload(payload && typeof payload === "object" ? payload : {});
        activeSheetFilePath = sheetPath;
        window.StandardPlastic?.removeInlineStyleEditor?.(false);
        skipNextSheetStateRestore = true;
        modular.start(SERVICE_ID);
        saveSheetPortalState();
        refreshSheetCells();
        updateSheetPortalTitle();
        return true;
    };
    const openSheetFilePath = async (rawPath = "", sourceNode = null) => {
        const sheetPath = normalizeSheetFilePath(rawPath);
        if (!sheetPath) return false;
        try {
            const response = await fetch(`/api/files/download?path=${encodeURIComponent(sheetPath)}`);
            if (!response.ok) throw new Error("Unable to read spreadsheet");
            const buffer = await response.arrayBuffer();
            return applySheetPayload(sheetPath, JSON.parse(new TextDecoder().decode(buffer)));
        } catch (_) {
            modular.error("Unable to open spreadsheet");
            return false;
        }
    };
    window.StandardSheets = window.StandardSheets || {};
    window.StandardSheets.openSheetPath = (rawPath = "", sourceNode = null) => openSheetFilePath(rawPath, sourceNode);
    window.StandardSheets.openSheetPayload = (rawPath = "", payload = null, sourceNode = null) => applySheetPayload(rawPath, payload, sourceNode);
    window.StandardSheets.openFreshSheetEditor = (sourceNode = null) => {
        clearSheetCellValues();
        clearSheetCellStyles();
        clearSheetCellTypes();
        clearSheetCellLinks();
        clearSheetCellLocks();
        clearSheetColumnWidths();
        clearSheetRowHeights();
        window.StandardPlastic?.removeInlineStyleEditor?.(false);
        activeSheetCell = "A1";
        activeSheetRow = null;
        activeSheetColumn = null;
        activeSheetFilePath = "";
        sheetRows = DEFAULT_SHEET_ROWS;
        sheetColumns = DEFAULT_SHEET_COLUMNS;
        sheetGridScrollBound = false;
        isGrowingSheetGrid = false;
        skipNextSheetStateRestore = true;
        modular.show(SERVICE_ID, 0, {newInstance: true});
        saveSheetPortalState();
        refreshSheetCells();
        updateSheetPortalTitle();
        return true;
    };

    const getSheetColumnLabel = (columnIndex = 0) => {
        let value = columnIndex + 1;
        let label = "";
        while (value > 0) {
            const remainder = (value - 1) % 26;
            label = String.fromCharCode(65 + remainder) + label;
            value = Math.floor((value - 1) / 26);
        }
        return label;
    };
    const getSheetCellReference = (rowIndex = 0, columnIndex = 0) => `${getSheetColumnLabel(columnIndex)}${rowIndex + 1}`;
    const parseSheetColumnLabel = (columnLabel = "") => {
        let value = 0;
        const normalizedLabel = String(columnLabel || "").toUpperCase();
        for (let index = 0; index < normalizedLabel.length; index += 1) {
            value = (value * 26) + (normalizedLabel.charCodeAt(index) - 64);
        }
        return Math.max(0, value - 1);
    };
    const parseSheetCellReference = (cellReference = "A1") => {
        const match = /^([A-Z]+)(\d+)$/i.exec(String(cellReference || ""));
        if (!match) return {rowIndex: 0, columnIndex: 0};
        return {
            rowIndex: Math.max(0, Number(match[2]) - 1),
            columnIndex: parseSheetColumnLabel(match[1])
        };
    };
    const getSheetCellInput = (cellReference = "") => document.getElementById(`sheet-cell-${cellReference}`);
    const getSheetCellWrap = (cellReference = "") => document.getElementById(`editor-sheet-cell-wrap-${cellReference}`);
    const isSheetRangeSelectionActive = () => !!(activeSheetRangeStart && activeSheetRangeEnd);
    const clearActiveSheetRange = () => {
        activeSheetRangeStart = null;
        activeSheetRangeEnd = null;
    };
    const setActiveSheetRange = (startReference = "", endReference = "") => {
        activeSheetRangeStart = String(startReference || "").toUpperCase() || null;
        activeSheetRangeEnd = String(endReference || "").toUpperCase() || null;
    };
    const collectSheetCells = () => [...new Set([
        ...Object.keys(sheetCellValues),
        ...Object.keys(sheetCellStyles),
        ...Object.keys(sheetCellTypes),
        ...Object.keys(sheetCellLinks),
        ...Object.keys(sheetCellLocks)
    ])].map((cellReference) => ({
        cellReference,
        value: sheetCellValues[cellReference] ?? "",
        style: sheetCellStyles[cellReference],
        type: sheetCellTypes[cellReference],
        link: sheetCellLinks[cellReference],
        locked: sheetCellLocks[cellReference]
    }));
    const restoreSheetCells = (cells = []) => {
        clearSheetCellValues();
        clearSheetCellStyles();
        clearSheetCellTypes();
        clearSheetCellLinks();
        clearSheetCellLocks();
        cells.forEach(({cellReference, value, style, type, link, locked}) => {
            sheetCellValues[cellReference] = String(value ?? "");
            if (style && typeof style === "object") sheetCellStyles[cellReference] = {...style};
            if (type) setSheetCellType(cellReference, type);
            if (link) setSheetCellLink(cellReference, link);
            if (locked) setSheetCellLocked(cellReference, true);
        });
    };
    const getSheetColumnWidth = (columnIndex = 0) => Math.min(
        SHEET_MAX_CELL_WIDTH,
        Math.max(
            SHEET_MIN_CELL_WIDTH,
            Number(sheetColumnWidths[columnIndex]) || getDefaultSheetColumnWidth()
        )
    );
    const getSheetRowHeight = (rowIndex = 0) => Math.min(
        SHEET_MAX_ROW_HEIGHT,
        Math.max(
            SHEET_MIN_ROW_HEIGHT,
            Number(sheetRowHeights[rowIndex]) || SHEET_DEFAULT_ROW_HEIGHT
        )
    );
    const buildSheetGridTemplate = () => [
        `${SHEET_ROW_HEADER_WIDTH}px`,
        ...Array.from({length: sheetColumns}, (_, columnIndex) => `${getSheetColumnWidth(columnIndex)}px`)
    ].join(" ");
    const shiftSheetDimensionMap = (source = {}, startIndex = 0, delta = 0, maxCount = 0) => {
        const nextDimensions = {};
        Object.entries(source).forEach(([rawIndex, rawValue]) => {
            const index = Number.parseInt(rawIndex, 10);
            if (!Number.isInteger(index)) return;
            const nextIndex = index >= startIndex ? index + delta : index;
            if (nextIndex < 0 || nextIndex >= maxCount) return;
            nextDimensions[String(nextIndex)] = rawValue;
        });
        Object.keys(source).forEach((key) => delete source[key]);
        Object.assign(source, nextDimensions);
    };
    const measureSheetTextWidth = (text = "", referenceNode = null) => {
        const canvas = measureSheetTextWidth.canvas || (measureSheetTextWidth.canvas = document.createElement("canvas"));
        const context = canvas.getContext("2d");
        if (!context) return String(text || "").length * 8;
        const computed = window.getComputedStyle(referenceNode || document.body);
        context.font = computed.font || `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
        return context.measureText(String(text || "")).width;
    };
    const autoSizeSheetColumn = (columnIndex = 0) => {
        const headerNode = document.getElementById(`editor-sheet-column-${columnIndex}`);
        let targetWidth = measureSheetTextWidth(getSheetColumnLabel(columnIndex), headerNode) + 24;
        for (let rowIndex = 0; rowIndex < sheetRows; rowIndex += 1) {
            const cellReference = getSheetCellReference(rowIndex, columnIndex);
            const cellInput = getSheetCellInput(cellReference);
            const cellValue = getSheetCellDisplayValue(cellReference);
            targetWidth = Math.max(targetWidth, measureSheetTextWidth(cellValue, cellInput) + 18);
        }
        sheetColumnWidths[columnIndex] = Math.min(SHEET_MAX_CELL_WIDTH, Math.max(SHEET_MIN_CELL_WIDTH, Math.ceil(targetWidth)));
        syncSheetGridLayout();
        refreshSheetCells();
        saveSheetPortalState();
    };
    const autoSizeSheetRow = (rowIndex = 0) => {
        let targetHeight = SHEET_DEFAULT_ROW_HEIGHT;
        const rowNode = document.getElementById(`editor-sheet-data-row-${rowIndex}`);
        for (let columnIndex = 0; columnIndex < sheetColumns; columnIndex += 1) {
            const cellReference = getSheetCellReference(rowIndex, columnIndex);
            const cellInput = getSheetCellInput(cellReference);
            const computed = window.getComputedStyle(cellInput || rowNode || document.body);
            const fontSize = Number.parseFloat(computed.fontSize || "14") || 14;
            const lineHeight = Number.parseFloat(computed.lineHeight || "") || Math.ceil(fontSize * 1.35);
            const paddingTop = Number.parseFloat(computed.paddingTop || "0") || 0;
            const paddingBottom = Number.parseFloat(computed.paddingBottom || "0") || 0;
            targetHeight = Math.max(targetHeight, Math.ceil(lineHeight + paddingTop + paddingBottom));
        }
        sheetRowHeights[rowIndex] = Math.min(SHEET_MAX_ROW_HEIGHT, Math.max(SHEET_MIN_ROW_HEIGHT, targetHeight));
        syncSheetGridLayout();
        refreshSheetCells();
        saveSheetPortalState();
    };
    const createSheetResizeHandle = (axis = "column", index = 0) => div({
        id: `editor-sheet-${axis}-resize-${index}`,
        style: `editor-sheet-resize-handle editor-sheet-resize-handle-${axis}`,
        content: ""
    });
    const buildSheetGridRows = () => {
        const tableRows = [];
        const headerRow = [div({style: "editor-sheet-cell-header editor-sheet-row-header editor-sheet-corner-cell", content: ""})];
        for (let columnIndex = 0; columnIndex < sheetColumns; columnIndex += 1) {
            headerRow.push(div({
                id: `editor-sheet-column-${columnIndex}`,
                style: "editor-sheet-cell-header editor-sheet-selectable-header",
                content: children([
                    div({style: "editor-sheet-header-label", content: getSheetColumnLabel(columnIndex)}),
                    createSheetResizeHandle("column", columnIndex)
                ])
            }));
        }
        tableRows.push(div({id: "editor-sheet-header-row", style: "editor-sheet-row", content: children(headerRow)}));
        for (let rowIndex = 0; rowIndex < sheetRows; rowIndex += 1) {
            const rowCells = [div({
                id: `editor-sheet-row-${rowIndex}`,
                style: "editor-sheet-cell-header editor-sheet-row-header editor-sheet-selectable-header",
                content: children([
                    div({style: "editor-sheet-header-label", content: String(rowIndex + 1)}),
                    createSheetResizeHandle("row", rowIndex)
                ])
            })];
            for (let columnIndex = 0; columnIndex < sheetColumns; columnIndex += 1) {
                const cellReference = getSheetCellReference(rowIndex, columnIndex);
                rowCells.push(div({
                    id: `editor-sheet-cell-wrap-${cellReference}`,
                    style: "editor-sheet-cell",
                    content: children([
                        input({id: `sheet-cell-${cellReference}`, style: "editor-sheet-cell-input", value: ""}),
                        div({style: "editor-sheet-cell-lock-indicator", content: SHEET_LOCK_ICON})
                    ])
                }));
            }
            tableRows.push(div({id: `editor-sheet-data-row-${rowIndex}`, style: "editor-sheet-row", content: children(rowCells)}));
        }
        return tableRows;
    };
    const rebuildSheetGridDom = () => {
        const grid = document.getElementById("editor-sheet-grid");
        const gridWrap = document.getElementById("editor-sheet-grid-wrap");
        if (!grid) return;
        captureActiveSheetInput();
        const scrollTop = gridWrap?.scrollTop ?? 0;
        const scrollLeft = gridWrap?.scrollLeft ?? 0;
        grid.empty();
        buildSheetGridRows().forEach((rowNode) => grid.append(rowNode));
        if (gridWrap) {
            gridWrap.scrollTop = scrollTop;
            gridWrap.scrollLeft = scrollLeft;
        }
        updateSheetGridColumnCount();
        bindSheetInteractions();
        syncSheetGridLayout();
        refreshSheetCells();
    };
    const moveActiveSheetRangeBy = (rowDelta = 0, columnDelta = 0) => {
        const anchorReference = activeSheetRangeStart || activeSheetCell;
        const edgeReference = activeSheetRangeEnd || activeSheetCell;
        const edgePosition = parseSheetCellReference(edgeReference);
        const nextRow = Math.min(Math.max(edgePosition.rowIndex + rowDelta, 0), sheetRows - 1);
        const nextColumn = Math.min(Math.max(edgePosition.columnIndex + columnDelta, 0), sheetColumns - 1);
        const nextReference = getSheetCellReference(nextRow, nextColumn);
        activeSheetCell = nextReference;
        activeSheetRow = null;
        activeSheetColumn = null;
        setActiveSheetRange(anchorReference, nextReference);
    };
    const isCellInActiveSheetRange = (cellReference = "") => isSheetRangeSelectionActive()
        && getSheetRangeReferences(activeSheetRangeStart, activeSheetRangeEnd).includes(String(cellReference || "").toUpperCase());
    const getSheetSelectionLabel = () => {
        if (isSheetRangeSelectionActive()) {
            return activeSheetRangeStart === activeSheetRangeEnd
                ? activeSheetRangeStart
                : `${activeSheetRangeStart}:${activeSheetRangeEnd}`;
        }
        return activeSheetCell;
    };
    const getActiveSheetCellReferences = () => {
        if (Number.isInteger(activeSheetColumn)) {
            return Array.from({length: sheetRows}, (_, rowIndex) => getSheetCellReference(rowIndex, activeSheetColumn));
        }
        if (Number.isInteger(activeSheetRow)) {
            return Array.from({length: sheetColumns}, (_, columnIndex) => getSheetCellReference(activeSheetRow, columnIndex));
        }
        if (isSheetRangeSelectionActive()) {
            return getSheetRangeReferences(activeSheetRangeStart, activeSheetRangeEnd);
        }
        return activeSheetCell ? [activeSheetCell] : [];
    };
    const readSheetInputValue = (cellReference = "") => {
        const input = getSheetCellInput(cellReference);
        return input ? input.value : "";
    };
    const resolveSheetColor = (rawColor = "") => {
        const colorValue = String(rawColor || "").trim();
        if (!colorValue) return "";
        if (sheetResolvedColorCache.has(colorValue)) return sheetResolvedColorCache.get(colorValue);
        const probe = document.createElement("div");
        probe.style.color = colorValue;
        probe.style.display = "none";
        document.body.appendChild(probe);
        const resolvedColor = getComputedStyle(probe).color || colorValue;
        probe.remove();
        sheetResolvedColorCache.set(colorValue, resolvedColor);
        return resolvedColor;
    };
    const getSheetToolbarContrastColor = (rawColor = "") => {
        const resolvedColor = resolveSheetColor(rawColor);
        const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(resolvedColor);
        if (!match) return "";
        const red = Number(match[1]);
        const green = Number(match[2]);
        const blue = Number(match[3]);
        const brightness = ((red * 299) + (green * 587) + (blue * 114)) / 1000;
        return brightness < 140 ? "#ffffff" : "#111111";
    };
    const applySheetStyleToSelection = (updater = {}) => {
        const selectedReferences = getActiveSheetCellReferences();
        if (!selectedReferences.length) return;
        selectedReferences.forEach((cellReference) => {
            const currentStyle = getSheetCellStyle(cellReference);
            const nextStyle = typeof updater === "function"
                ? updater({...currentStyle}, cellReference)
                : {...currentStyle, ...(updater || {})};
            setSheetCellStyle(cellReference, nextStyle);
            applySheetCellStyle(cellReference);
        });
        updateSheetToolbarState();
        saveSheetPortalState();
    };
    const applySheetTypeToSelection = (nextType = "") => {
        const selectedReferences = getActiveSheetCellReferences();
        if (!selectedReferences.length) return;
        selectedReferences.forEach((cellReference) => {
            setSheetCellType(cellReference, nextType);
        });
        refreshSheetCells();
        saveSheetPortalState();
    };
    const applySheetLinkToSelection = (rawUrl = "") => {
        const selectedReferences = getActiveSheetCellReferences();
        if (!selectedReferences.length) return false;
        const normalizedUrl = normalizeSheetHyperlinkUrl(rawUrl);
        selectedReferences.forEach((cellReference) => {
            setSheetCellLink(cellReference, normalizedUrl);
            applySheetCellStyle(cellReference);
        });
        updateSheetToolbarState();
        saveSheetPortalState();
        return true;
    };
    const toggleSheetCellLock = (cellReference = activeSheetCell, shouldLock = true) => {
        const cellInput = getSheetCellInput(cellReference);
        if (cellInput && document.activeElement === cellInput) {
            sheetCellValues[cellReference] = readSheetInputValue(cellReference);
            cellInput.blur();
        }
        setActiveSheetCell(cellReference);
        setSheetCellLocked(cellReference, shouldLock);
        refreshSheetCells();
        saveSheetPortalState();
    };
    const getSheetSelectionCellType = () => {
        const selectedReferences = getActiveSheetCellReferences();
        if (!selectedReferences.length) return "";
        const types = [...new Set(selectedReferences.map((cellReference) => getSheetCellType(cellReference)))];
        return types.length === 1 ? types[0] : "__mixed__";
    };
    const setSheetToolbarButtonState = (buttonNode, isActive = false) => {
        if (!buttonNode) return;
        buttonNode.className = `${isActive ? "tiny primary" : ""} naked align-bottom small-margin-right inner-radius`.trim();
    };
    const syncSheetToolbarIconColor = (buttonNode) => {
        if (!buttonNode) return;
        buttonNode.querySelectorAll("svg path").forEach((pathNode) => {
            if (!pathNode.hasAttribute("stroke")) pathNode.setAttribute("fill", "currentColor");
        });
    };
    const updateSheetToolbarState = () => {
        const activeStyle = getSheetCellStyle(activeSheetCell);
        const fontFamilySelect = document.getElementById("editor-sheet-font-family");
        const fontSizeSelect = document.getElementById("editor-sheet-font-size");
        const boldButton = document.getElementById("editor-sheet-style-bold");
        const italicButton = document.getElementById("editor-sheet-style-italic");
        const underlineButton = document.getElementById("editor-sheet-style-underline");
        const textColorButton = document.getElementById("editor-sheet-style-color");
        const backgroundColorButton = document.getElementById("editor-sheet-style-background");
        const alignmentButton = document.getElementById("editor-sheet-style-align");
        const linkButton = document.getElementById("editor-sheet-style-link");
        const typeSelect = document.getElementById("editor-sheet-cell-type");
        if (fontFamilySelect) fontFamilySelect.value = "Inter";
        if (fontSizeSelect) fontSizeSelect.value = String((activeStyle.fontSize || "12px").replace(/px$/i, ""));
        setSheetToolbarButtonState(boldButton, activeStyle.fontWeight === "bold");
        setSheetToolbarButtonState(italicButton, activeStyle.fontStyle === "italic");
        setSheetToolbarButtonState(underlineButton, activeStyle.textDecoration === "underline");
        setSheetToolbarButtonState(linkButton, !!getSheetCellLink(activeSheetCell));
        syncSheetToolbarIconColor(boldButton);
        syncSheetToolbarIconColor(italicButton);
        syncSheetToolbarIconColor(underlineButton);
        syncSheetToolbarIconColor(linkButton);
        if (textColorButton) {
            const resolvedTextColor = resolveSheetColor(activeStyle.color || "");
            textColorButton.className = `${activeStyle.color ? "tiny primary" : ""} naked align-bottom small-margin-right inner-radius`.trim();
            textColorButton.style.color = resolvedTextColor || "";
            textColorButton.style.backgroundColor = "";
            textColorButton.style.borderColor = "";
            syncSheetToolbarIconColor(textColorButton);
        }
        if (backgroundColorButton) {
            const resolvedBackgroundColor = resolveSheetColor(activeStyle.backgroundColor || "");
            backgroundColorButton.className = `${activeStyle.backgroundColor ? "tiny primary" : ""} naked align-bottom small-margin-right inner-radius`.trim();
            backgroundColorButton.style.backgroundColor = resolvedBackgroundColor || "";
            backgroundColorButton.style.color = resolvedBackgroundColor ? getSheetToolbarContrastColor(activeStyle.backgroundColor) : "";
            backgroundColorButton.style.borderColor = resolvedBackgroundColor || "";
            syncSheetToolbarIconColor(backgroundColorButton);
        }
        if (alignmentButton) {
            const alignment = activeStyle.textAlign || "left";
            alignmentButton.innerHTML = SHEET_ALIGN_ICONS[alignment] || SHEET_ALIGN_ICONS.left;
            alignmentButton.className = `${activeStyle.textAlign ? "tiny primary" : ""} naked align-bottom small-margin-right inner-radius`.trim();
        }
        if (typeSelect) typeSelect.value = getSheetSelectionCellType();
    };
    const applySheetCellStyle = (cellReference = "") => {
        const cellInput = getSheetCellInput(cellReference);
        const cellWrap = getSheetCellWrap(cellReference);
        if (!cellInput || !cellWrap) return;
        const style = getSheetCellStyle(cellReference);
        const isLocked = isSheetCellLocked(cellReference);
        cellWrap.style.backgroundColor = style.backgroundColor || "";
        cellInput.style.color = style.color || "";
        cellInput.style.textAlign = style.textAlign || "";
        cellInput.style.fontWeight = style.fontWeight || "";
        cellInput.style.fontStyle = style.fontStyle || "";
        cellInput.style.textDecoration = style.textDecoration || "";
        cellInput.style.fontSize = style.fontSize || "";
        cellInput.readOnly = isLocked;
        cellInput.setAttribute("aria-readonly", isLocked ? "true" : "false");
        cellWrap.classList.toggle("editor-sheet-cell-locked", isLocked);
        const lockIndicator = cellWrap.querySelector(".editor-sheet-cell-lock-indicator");
        if (lockIndicator) lockIndicator.setAttribute("aria-hidden", isLocked ? "false" : "true");
        const linkUrl = getSheetCellLink(cellReference);
        cellInput.classList.toggle("editor-sheet-cell-link", !!linkUrl);
        if (linkUrl) {
            cellInput.dataset.hyperlink = linkUrl;
            if (!style.color) cellInput.style.color = "#2563eb";
            if (!style.textDecoration) cellInput.style.textDecoration = "underline";
        } else {
            cellInput.removeAttribute("data-hyperlink");
        }
        if (isLocked) {
            cellInput.title = linkUrl ? "Locked; Ctrl+click to open link" : "Locked";
        } else if (linkUrl) {
            cellInput.title = "Ctrl+click to open link";
        } else {
            cellInput.removeAttribute("title");
        }
        cellWrap.dataset.styled = Object.keys(style).length || linkUrl ? "1" : "0";
    };
    const openSheetHyperlink = (cellReference = "") => {
        const linkUrl = getSheetCellLink(cellReference);
        if (!linkUrl) return false;
        window.open(linkUrl, "_blank", "noopener,noreferrer");
        return true;
    };
    const showSheetHyperlinkDialogue = (cellReference = activeSheetCell) => {
        if (cellReference && !isCellInActiveSheetRange(cellReference)) setActiveSheetCell(cellReference);
        inputDialogue({
            title: "Hyperlink",
            placeholder: "Link",
            value: getSheetCellLink(cellReference),
            confirmation: (_, linkValue) => {
                applySheetLinkToSelection(linkValue);
            }
        });
        return true;
    };
    const parseSheetFormulaArguments = (text = "") => {
        const source = String(text || "");
        const result = [];
        let depth = 0;
        let current = "";
        for (let index = 0; index < source.length; index += 1) {
            const char = source[index];
            if (char === "(") depth += 1;
            if (char === ")") depth = Math.max(0, depth - 1);
            if (char === "," && depth === 0) {
                result.push(current.trim());
                current = "";
                continue;
            }
            current += char;
        }
        if (current.trim() || source.includes(",")) result.push(current.trim());
        return result;
    };
    const toSheetNumericValue = (value) => {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : null;
    };
    const isSheetStringLiteral = (value = "") => {
        const text = String(value || "").trim();
        return /^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.test(text);
    };
    const parseSheetStringLiteral = (value = "") => {
        const text = String(value || "").trim();
        if (/^"(?:[^"\\]|\\.)*"$/.test(text)) {
            try {
                return JSON.parse(text);
            } catch (_) {
                return text.slice(1, -1);
            }
        }
        if (/^'(?:[^'\\]|\\.)*'$/.test(text)) return text.slice(1, -1).replace(/\\'/g, "'");
        return text;
    };
    const encodeSheetFormulaValue = (value) => {
        if (typeof value === "string") return JSON.stringify(value);
        if (typeof value === "number") return Number.isFinite(value) ? String(value) : '"#ERR"';
        if (typeof value === "boolean") return value ? "1" : "0";
        if (value === null || typeof value === "undefined") return '""';
        return JSON.stringify(String(value));
    };
    const toSheetTextValue = (value) => {
        if (value === null || typeof value === "undefined") return "";
        return String(value);
    };
    const formatSheetDateValue = (value) => {
        const textValue = String(value ?? "").trim();
        if (!textValue) return "";
        const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(textValue)
            ? new Date(`${textValue}T00:00:00`)
            : new Date(textValue);
        if (Number.isNaN(dateValue.getTime())) return textValue;
        return dateValue.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    };
    const getSheetRangeReferences = (startReference = "", endReference = "") => {
        const start = parseSheetCellReference(String(startReference || "").toUpperCase());
        const end = parseSheetCellReference(String(endReference || "").toUpperCase());
        const minRow = Math.min(start.rowIndex, end.rowIndex);
        const maxRow = Math.max(start.rowIndex, end.rowIndex);
        const minColumn = Math.min(start.columnIndex, end.columnIndex);
        const maxColumn = Math.max(start.columnIndex, end.columnIndex);
        const references = [];
        for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
            for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
                references.push(getSheetCellReference(rowIndex, columnIndex));
            }
        }
        return references;
    };
    const parseSheetRangeToken = (token = "") => {
        const cleanedToken = String(token || "").trim().toUpperCase();
        const cellRangeMatch = /^([A-Z]+\d+):([A-Z]+\d+)$/i.exec(cleanedToken);
        if (cellRangeMatch) {
            return {
                kind: "cell",
                references: getSheetRangeReferences(cellRangeMatch[1], cellRangeMatch[2])
            };
        }
        const columnRangeMatch = /^([A-Z]+):([A-Z]+)$/i.exec(cleanedToken);
        if (columnRangeMatch) {
            const startColumn = parseSheetColumnLabel(columnRangeMatch[1]);
            const endColumn = parseSheetColumnLabel(columnRangeMatch[2]);
            const minColumn = Math.min(startColumn, endColumn);
            const maxColumn = Math.max(startColumn, endColumn);
            const references = [];
            for (let rowIndex = 0; rowIndex < sheetRows; rowIndex += 1) {
                for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
                    references.push(getSheetCellReference(rowIndex, columnIndex));
                }
            }
            return {kind: "column", references};
        }
        return null;
    };
    const getSheetArgumentValue = (token = "", visited = new Set()) => {
        const cleanedToken = String(token || "").trim();
        if (!cleanedToken) return "";
        if (isSheetStringLiteral(cleanedToken)) return parseSheetStringLiteral(cleanedToken);
        if (/^[A-Z]+\d+$/i.test(cleanedToken)) return evaluateSheetCell(cleanedToken.toUpperCase(), new Set(visited));
        return evaluateSheetExpressionValue(cleanedToken, new Set(visited));
    };
    const getSheetRangeValues = (token = "", visited = new Set()) => {
        const range = parseSheetRangeToken(token);
        if (!range) return null;
        return range.references.map((reference) => evaluateSheetCell(reference, new Set(visited)));
    };
    const roundSheetNumber = (value, digits = 0) => {
        const numericValue = toSheetNumericValue(value);
        const precision = Math.trunc(toSheetNumericValue(digits) ?? 0);
        if (numericValue === null) return "#ERR";
        const factor = 10 ** Math.abs(precision);
        if (!Number.isFinite(factor) || factor === 0) return "#ERR";
        if (precision >= 0) return Math.round(numericValue * factor) / factor;
        return Math.round(numericValue / factor) * factor;
    };
    const getSheetTodayValue = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };
    const lookupSheetValue = (argumentTokens = [], visited = new Set()) => {
        if (argumentTokens.length < 2) return "#ERR";
        const lookupValue = getSheetArgumentValue(argumentTokens[0], new Set(visited));
        const lookupRangeToken = String(argumentTokens[1] || "").trim();
        const lookupRange = parseSheetRangeToken(lookupRangeToken);
        if (!lookupRange) return "#ERR";
        const lookupReferences = lookupRange.references;
        let resultReferences = lookupReferences;
        if (argumentTokens.length >= 3) {
            const resultRangeToken = String(argumentTokens[2] || "").trim();
            const resultRange = parseSheetRangeToken(resultRangeToken);
            if (!resultRange) return "#ERR";
            resultReferences = resultRange.references;
            if (resultReferences.length !== lookupReferences.length) return "#ERR";
        } else if (lookupRange.kind === "cell") {
            const lookupRangeMatch = /^([A-Z]+\d+):([A-Z]+\d+)$/i.exec(lookupRangeToken);
            if (!lookupRangeMatch) return "#ERR";
            const start = parseSheetCellReference(lookupRangeMatch[1]);
            const end = parseSheetCellReference(lookupRangeMatch[2]);
            const width = Math.abs(end.columnIndex - start.columnIndex) + 1;
            const height = Math.abs(end.rowIndex - start.rowIndex) + 1;
            if (width >= 2) {
                const minRow = Math.min(start.rowIndex, end.rowIndex);
                const maxRow = Math.max(start.rowIndex, end.rowIndex);
                const minColumn = Math.min(start.columnIndex, end.columnIndex);
                for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
                    const currentValue = evaluateSheetCell(getSheetCellReference(rowIndex, minColumn), new Set(visited));
                    if (String(currentValue) === String(lookupValue)) {
                        return evaluateSheetCell(getSheetCellReference(rowIndex, minColumn + 1), new Set(visited));
                    }
                }
                return "#N/A";
            }
            if (height >= 2) {
                const minRow = Math.min(start.rowIndex, end.rowIndex);
                const minColumn = Math.min(start.columnIndex, end.columnIndex);
                const maxColumn = Math.max(start.columnIndex, end.columnIndex);
                for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
                    const currentValue = evaluateSheetCell(getSheetCellReference(minRow, columnIndex), new Set(visited));
                    if (String(currentValue) === String(lookupValue)) {
                        return evaluateSheetCell(getSheetCellReference(minRow + 1, columnIndex), new Set(visited));
                    }
                }
                return "#N/A";
            }
        }
        for (let index = 0; index < lookupReferences.length; index += 1) {
            const currentValue = evaluateSheetCell(lookupReferences[index], new Set(visited));
            if (String(currentValue) === String(lookupValue)) {
                return evaluateSheetCell(resultReferences[index], new Set(visited));
            }
        }
        return "#N/A";
    };
    const evaluateSheetExpressionValue = (expressionText = "", visited = new Set()) => {
        let expression = String(expressionText || "").trim();
        if (expression === "") return 0;
        if (isSheetStringLiteral(expression)) return parseSheetStringLiteral(expression);
        if (/^[A-Z]+\d+$/i.test(expression)) return evaluateSheetCell(expression.toUpperCase(), new Set(visited));
        if (parseSheetRangeToken(expression)) return "#ERR";
        while (true) {
            const functionMatch = /([A-Z]+)\(([^()]*)\)/i.exec(expression);
            if (!functionMatch) break;
            const functionName = functionMatch[1].toUpperCase();
            const argumentTokens = parseSheetFormulaArguments(functionMatch[2]);
            const numericValues = [];
            const argumentValues = [];
            argumentTokens.forEach((token) => {
                const cleanedToken = String(token || "").trim();
                if (!cleanedToken) return;
                const rangeValues = getSheetRangeValues(cleanedToken, new Set(visited));
                if (rangeValues) {
                    rangeValues.forEach((value) => argumentValues.push(value));
                } else {
                    argumentValues.push(getSheetArgumentValue(cleanedToken, new Set(visited)));
                }
                const range = parseSheetRangeToken(cleanedToken);
                if (range) {
                    range.references.forEach((reference) => {
                        const referencedValue = evaluateSheetCell(reference, new Set(visited));
                        const numericValue = toSheetNumericValue(referencedValue);
                        if (numericValue !== null) numericValues.push(numericValue);
                    });
                    return;
                }
                const tokenValue = getSheetArgumentValue(cleanedToken, new Set(visited));
                const numericValue = toSheetNumericValue(tokenValue);
                if (functionName === "COUNT") {
                    if (numericValue !== null) numericValues.push(numericValue);
                    return;
                }
                numericValues.push(numericValue ?? 0);
            });
            let functionValue = "#ERR";
            if (functionName === "SUM") functionValue = numericValues.reduce((total, value) => total + value, 0);
            if (functionName === "AVERAGE") functionValue = numericValues.length ? (numericValues.reduce((total, value) => total + value, 0) / numericValues.length) : 0;
            if (functionName === "MIN") functionValue = numericValues.length ? Math.min(...numericValues) : 0;
            if (functionName === "MAX") functionValue = numericValues.length ? Math.max(...numericValues) : 0;
            if (functionName === "COUNT") functionValue = numericValues.length;
            if (functionName === "LEFT") {
                const textValue = toSheetTextValue(argumentValues[0]);
                const length = Math.max(0, Math.trunc(toSheetNumericValue(argumentValues[1]) ?? 0));
                functionValue = textValue.slice(0, length);
            }
            if (functionName === "RIGHT") {
                const textValue = toSheetTextValue(argumentValues[0]);
                const length = Math.max(0, Math.trunc(toSheetNumericValue(argumentValues[1]) ?? 0));
                functionValue = length ? textValue.slice(-length) : "";
            }
            if (functionName === "TODAY") functionValue = getSheetTodayValue();
            if (functionName === "TRIM") functionValue = toSheetTextValue(argumentValues[0]).trim().replace(/\s+/g, " ");
            if (functionName === "CONCAT") functionValue = argumentValues.map((value) => toSheetTextValue(value)).join("");
            if (functionName === "MID") {
                const textValue = toSheetTextValue(argumentValues[0]);
                const startIndex = Math.max(1, Math.trunc(toSheetNumericValue(argumentValues[1]) ?? 1));
                const stopIndex = Math.max(startIndex, Math.trunc(toSheetNumericValue(argumentValues[2]) ?? startIndex));
                functionValue = textValue.slice(startIndex - 1, stopIndex);
            }
            if (functionName === "LOOKUP") functionValue = lookupSheetValue(argumentTokens, new Set(visited));
            if (functionName === "CEIL") {
                const numericValue = toSheetNumericValue(argumentValues[0]);
                functionValue = numericValue === null ? "#ERR" : Math.ceil(numericValue);
            }
            if (functionName === "FLOOR") {
                const numericValue = toSheetNumericValue(argumentValues[0]);
                functionValue = numericValue === null ? "#ERR" : Math.floor(numericValue);
            }
            if (functionName === "ROUND") functionValue = roundSheetNumber(argumentValues[0], argumentValues[1]);
            if (functionValue === "#ERR" || (typeof functionValue === "number" && !Number.isFinite(functionValue))) return "#ERR";
            expression = expression.slice(0, functionMatch.index) + encodeSheetFormulaValue(functionValue) + expression.slice(functionMatch.index + functionMatch[0].length);
        }
        expression = expression.trim();
        if (isSheetStringLiteral(expression)) return parseSheetStringLiteral(expression);
        if (expression === "#N/A") return "#N/A";
        expression = expression.replace(/[A-Z]+\d+/gi, (reference) => {
            const referencedValue = evaluateSheetCell(reference.toUpperCase(), new Set(visited));
            const numericValue = toSheetNumericValue(referencedValue);
            return String(numericValue ?? 0);
        });
        if (!/^[0-9+\-*/().\s]+$/.test(expression)) return "#ERR";
        try {
            const value = Function(`"use strict"; return (${expression});`)();
            return Number.isFinite(value) ? value : "#ERR";
        } catch (_error) {
            return "#ERR";
        }
    };
    const evaluateSheetCell = (cellReference = "", visited = new Set()) => {
        if (visited.has(cellReference)) return 0;
        visited.add(cellReference);
        const rawValue = String(sheetCellValues[cellReference] ?? "").trim();
        const cellType = getSheetCellType(cellReference);
        if (!rawValue.startsWith("=")) {
            if (rawValue === "") return "";
            if (cellType === "text" || cellType === "date") return rawValue;
            const numericValue = Number(rawValue);
            return Number.isFinite(numericValue) ? numericValue : rawValue;
        }
        if (cellType === "text") return rawValue;
        const evaluatedValue = evaluateSheetExpressionValue(rawValue.slice(1), new Set(visited));
        if (cellType === "number") {
            const numericValue = Number(evaluatedValue);
            return Number.isFinite(numericValue) ? numericValue : evaluatedValue;
        }
        return evaluatedValue;
    };
    const getSheetCellDisplayValue = (cellReference = "") => {
        const rawValue = String(sheetCellValues[cellReference] ?? "");
        const cellType = getSheetCellType(cellReference);
        const evaluatedValue = evaluateSheetCell(cellReference);
        if (cellType === "text") return rawValue;
        if (cellType === "number") {
            const numericValue = Number(rawValue.startsWith("=") ? evaluatedValue : rawValue);
            return Number.isFinite(numericValue) ? String(numericValue) : String(rawValue.startsWith("=") ? evaluatedValue : rawValue);
        }
        if (cellType === "date") return formatSheetDateValue(rawValue.startsWith("=") ? evaluatedValue : rawValue);
        return String(evaluatedValue);
    };
    const writeSheetEditorBar = () => {
        const cellLabel = document.getElementById("editor-sheet-active-cell");
        const formulaInput = document.getElementById("editor-sheet-formula");
        if (cellLabel) cellLabel.textContent = getSheetSelectionLabel();
        if (formulaInput && document.activeElement !== formulaInput) {
            formulaInput.value = sheetCellValues[activeSheetCell] ?? "";
        }
        if (formulaInput) {
            const isLocked = isSheetCellLocked(activeSheetCell);
            formulaInput.readOnly = isLocked;
            formulaInput.classList.toggle("editor-sheet-formula-locked", isLocked);
            formulaInput.title = isLocked ? "Locked cell" : "";
        }
        updateSheetToolbarState();
    };
    const updateSheetSelectionStyles = () => {
        document.querySelectorAll(".editor-sheet-cell-input.active").forEach((cellNode) => cellNode.classList.remove("active"));
        document.querySelectorAll(".editor-sheet-cell-header.active, .editor-sheet-cell.active").forEach((node) => node.classList.remove("active"));
        if (Number.isInteger(activeSheetColumn)) {
            const columnHeader = document.getElementById(`editor-sheet-column-${activeSheetColumn}`);
            if (columnHeader) columnHeader.classList.add("active");
            for (let rowIndex = 0; rowIndex < sheetRows; rowIndex += 1) {
                const cellReference = getSheetCellReference(rowIndex, activeSheetColumn);
                const cellInput = getSheetCellInput(cellReference);
                if (cellInput) cellInput.classList.add("active");
            }
            return;
        }
        if (Number.isInteger(activeSheetRow)) {
            const rowHeader = document.getElementById(`editor-sheet-row-${activeSheetRow}`);
            if (rowHeader) rowHeader.classList.add("active");
            for (let columnIndex = 0; columnIndex < sheetColumns; columnIndex += 1) {
                const cellReference = getSheetCellReference(activeSheetRow, columnIndex);
                const cellInput = getSheetCellInput(cellReference);
                if (cellInput) cellInput.classList.add("active");
            }
            return;
        }
        if (isSheetRangeSelectionActive()) {
            getSheetRangeReferences(activeSheetRangeStart, activeSheetRangeEnd).forEach((cellReference) => {
                const cellInput = getSheetCellInput(cellReference);
                if (cellInput) cellInput.classList.add("active");
            });
            return;
        }
        const activeInput = getSheetCellInput(activeSheetCell);
        if (activeInput) activeInput.classList.add("active");
    };
    const refreshSheetCells = () => {
        for (let rowIndex = 0; rowIndex < sheetRows; rowIndex += 1) {
            for (let columnIndex = 0; columnIndex < sheetColumns; columnIndex += 1) {
                const cellReference = getSheetCellReference(rowIndex, columnIndex);
                const cellInput = getSheetCellInput(cellReference);
                if (!cellInput) continue;
                const isFocused = document.activeElement === cellInput;
                cellInput.value = isFocused ? (sheetCellValues[cellReference] ?? "") : getSheetCellDisplayValue(cellReference);
                applySheetCellStyle(cellReference);
            }
        }
        updateSheetSelectionStyles();
        writeSheetEditorBar();
    };
    const setActiveSheetCell = (cellReference = "A1") => {
        activeSheetCell = cellReference;
        activeSheetRow = null;
        activeSheetColumn = null;
        clearActiveSheetRange();
        writeSheetEditorBar();
        updateSheetSelectionStyles();
    };
    const setActiveSheetRow = (rowIndex = 0) => {
        activeSheetRow = rowIndex;
        activeSheetColumn = null;
        activeSheetCell = getSheetCellReference(rowIndex, 0);
        clearActiveSheetRange();
        writeSheetEditorBar();
        updateSheetSelectionStyles();
    };
    const setActiveSheetColumn = (columnIndex = 0) => {
        activeSheetColumn = columnIndex;
        activeSheetRow = null;
        activeSheetCell = getSheetCellReference(0, columnIndex);
        clearActiveSheetRange();
        writeSheetEditorBar();
        updateSheetSelectionStyles();
    };
    const insertSheetRowAt = (rowIndex = 0) => {
        captureActiveSheetInput();
        const nextRowIndex = Math.max(0, Math.min(rowIndex, sheetRows));
        const shiftedCells = collectSheetCells().map(({cellReference, value, style, type, link, locked}) => {
            const position = parseSheetCellReference(cellReference);
            const targetRowIndex = position.rowIndex >= nextRowIndex ? position.rowIndex + 1 : position.rowIndex;
            return {
                cellReference: getSheetCellReference(targetRowIndex, position.columnIndex),
                value,
                style,
                type,
                link,
                locked
            };
        });
        sheetRows += 1;
        shiftSheetDimensionMap(sheetRowHeights, nextRowIndex, 1, sheetRows);
        restoreSheetCells(shiftedCells);
        setActiveSheetRow(Math.min(nextRowIndex, sheetRows - 1));
        rebuildSheetGridDom();
        saveSheetPortalState();
    };
    const deleteSheetRowAt = (rowIndex = 0) => {
        if (sheetRows <= 1) return;
        captureActiveSheetInput();
        const nextRowIndex = Math.max(0, Math.min(rowIndex, sheetRows - 1));
        const shiftedCells = collectSheetCells().flatMap(({cellReference, value, style, type, link, locked}) => {
            const position = parseSheetCellReference(cellReference);
            if (position.rowIndex === nextRowIndex) return [];
            const targetRowIndex = position.rowIndex > nextRowIndex ? position.rowIndex - 1 : position.rowIndex;
            return [{
                cellReference: getSheetCellReference(targetRowIndex, position.columnIndex),
                value,
                style,
                type,
                link,
                locked
            }];
        });
        sheetRows = Math.max(1, sheetRows - 1);
        delete sheetRowHeights[nextRowIndex];
        shiftSheetDimensionMap(sheetRowHeights, nextRowIndex + 1, -1, sheetRows);
        restoreSheetCells(shiftedCells);
        setActiveSheetRow(Math.min(nextRowIndex, sheetRows - 1));
        rebuildSheetGridDom();
        saveSheetPortalState();
    };
    const insertSheetColumnAt = (columnIndex = 0) => {
        captureActiveSheetInput();
        const nextColumnIndex = Math.max(0, Math.min(columnIndex, sheetColumns));
        const shiftedCells = collectSheetCells().map(({cellReference, value, style, type, link, locked}) => {
            const position = parseSheetCellReference(cellReference);
            const targetColumnIndex = position.columnIndex >= nextColumnIndex ? position.columnIndex + 1 : position.columnIndex;
            return {
                cellReference: getSheetCellReference(position.rowIndex, targetColumnIndex),
                value,
                style,
                type,
                link,
                locked
            };
        });
        sheetColumns += 1;
        shiftSheetDimensionMap(sheetColumnWidths, nextColumnIndex, 1, sheetColumns);
        restoreSheetCells(shiftedCells);
        setActiveSheetColumn(Math.min(nextColumnIndex, sheetColumns - 1));
        rebuildSheetGridDom();
        saveSheetPortalState();
    };
    const deleteSheetColumnAt = (columnIndex = 0) => {
        if (sheetColumns <= 1) return;
        captureActiveSheetInput();
        const nextColumnIndex = Math.max(0, Math.min(columnIndex, sheetColumns - 1));
        const shiftedCells = collectSheetCells().flatMap(({cellReference, value, style, type, link, locked}) => {
            const position = parseSheetCellReference(cellReference);
            if (position.columnIndex === nextColumnIndex) return [];
            const targetColumnIndex = position.columnIndex > nextColumnIndex ? position.columnIndex - 1 : position.columnIndex;
            return [{
                cellReference: getSheetCellReference(position.rowIndex, targetColumnIndex),
                value,
                style,
                type,
                link,
                locked
            }];
        });
        sheetColumns = Math.max(1, sheetColumns - 1);
        delete sheetColumnWidths[nextColumnIndex];
        shiftSheetDimensionMap(sheetColumnWidths, nextColumnIndex + 1, -1, sheetColumns);
        restoreSheetCells(shiftedCells);
        setActiveSheetColumn(Math.min(nextColumnIndex, sheetColumns - 1));
        rebuildSheetGridDom();
        saveSheetPortalState();
    };
    const openSheetCellStyleEditor = (cellReference = "A1", event = null) => {
        if (!isCellInActiveSheetRange(cellReference)) setActiveSheetCell(cellReference);
        if (typeof window.StandardPlastic?.showInlineStyleEditor !== "function") return;
        window.StandardPlastic.showInlineStyleEditor({
            title: `${getSheetSelectionLabel()} Style`,
            x: event?.clientX ?? 0,
            y: event?.clientY ?? 0,
            value: getSheetCellStyle(cellReference),
            onchange: (nextStyle = {}) => {
                applySheetStyleToSelection(nextStyle);
            }
        });
    };
    const bindSheetToolbar = () => {
        const fontSizeSelect = document.getElementById("editor-sheet-font-size");
        const boldButton = document.getElementById("editor-sheet-style-bold");
        const italicButton = document.getElementById("editor-sheet-style-italic");
        const underlineButton = document.getElementById("editor-sheet-style-underline");
        const textColorButton = document.getElementById("editor-sheet-style-color");
        const backgroundColorButton = document.getElementById("editor-sheet-style-background");
        const alignmentButton = document.getElementById("editor-sheet-style-align");
        const linkButton = document.getElementById("editor-sheet-style-link");
        const typeSelect = document.getElementById("editor-sheet-cell-type");
        if (fontSizeSelect && fontSizeSelect.dataset.bound !== "1") {
            fontSizeSelect.dataset.bound = "1";
            fontSizeSelect.addEventListener("change", (event) => {
                const nextSize = String(event?.target?.value || "").trim();
                applySheetStyleToSelection((style) => ({
                    ...style,
                    fontSize: nextSize ? `${nextSize}px` : ""
                }));
            });
        }
        if (boldButton && boldButton.dataset.bound !== "1") {
            boldButton.dataset.bound = "1";
            boldButton.addEventListener("click", (event) => {
                event.preventDefault();
                applySheetStyleToSelection((style) => ({
                    ...style,
                    fontWeight: style.fontWeight === "bold" ? "" : "bold"
                }));
            });
        }
        if (italicButton && italicButton.dataset.bound !== "1") {
            italicButton.dataset.bound = "1";
            italicButton.addEventListener("click", (event) => {
                event.preventDefault();
                applySheetStyleToSelection((style) => ({
                    ...style,
                    fontStyle: style.fontStyle === "italic" ? "" : "italic"
                }));
            });
        }
        if (underlineButton && underlineButton.dataset.bound !== "1") {
            underlineButton.dataset.bound = "1";
            underlineButton.addEventListener("click", (event) => {
                event.preventDefault();
                applySheetStyleToSelection((style) => ({
                    ...style,
                    textDecoration: style.textDecoration === "underline" ? "" : "underline"
                }));
            });
        }
        if (textColorButton && textColorButton.dataset.bound !== "1") {
            textColorButton.dataset.bound = "1";
            textColorButton.popoutmenu(SHEET_TEXT_COLORS.map((colorOption) => ({
                label: colorOption.label,
                icon: `<div class="inline round small-icon space-right" style="background:${colorOption.value || "transparent"};border:1px solid var(--border)"></div>`,
                action: () => applySheetStyleToSelection((style) => ({
                    ...style,
                    color: colorOption.value || ""
                }))
            })));
        }
        if (backgroundColorButton && backgroundColorButton.dataset.bound !== "1") {
            backgroundColorButton.dataset.bound = "1";
            backgroundColorButton.popoutmenu(SHEET_FILL_COLORS.map((colorOption) => ({
                label: colorOption.label,
                icon: `<div class="inline round small-icon space-right" style="background:${colorOption.value || "transparent"};border:1px solid var(--border)"></div>`,
                action: () => applySheetStyleToSelection((style) => ({
                    ...style,
                    backgroundColor: colorOption.value || ""
                }))
            })));
        }
        if (alignmentButton && alignmentButton.dataset.bound !== "1") {
            alignmentButton.dataset.bound = "1";
            alignmentButton.popoutmenu([
                {
                    label: "Align Left",
                    icon: SHEET_ALIGN_ICONS.left,
                    action: () => applySheetStyleToSelection((style) => ({...style, textAlign: "left"}))
                },
                {
                    label: "Align Center",
                    icon: SHEET_ALIGN_ICONS.center,
                    action: () => applySheetStyleToSelection((style) => ({...style, textAlign: "center"}))
                },
                {
                    label: "Align Right",
                    icon: SHEET_ALIGN_ICONS.right,
                    action: () => applySheetStyleToSelection((style) => ({...style, textAlign: "right"}))
                }
            ]);
        }
        if (linkButton && linkButton.dataset.bound !== "1") {
            linkButton.dataset.bound = "1";
            linkButton.addEventListener("click", (event) => {
                event.preventDefault();
                showSheetHyperlinkDialogue(activeSheetCell);
            });
        }
        if (typeSelect && typeSelect.dataset.bound !== "1") {
            typeSelect.dataset.bound = "1";
            typeSelect.addEventListener("change", (event) => {
                applySheetTypeToSelection(String(event?.target?.value || ""));
            });
        }
        updateSheetToolbarState();
    };
    const updateSheetGridColumnCount = () => {
        const gridWrap = document.getElementById("editor-sheet-grid-wrap");
        const grid = document.getElementById("editor-sheet-grid");
        [gridWrap, grid].forEach((node) => {
            if (!node) return;
            node.style.setProperty("--editor-sheet-columns", String(sheetColumns));
        });
    };
    const syncSheetGridLayout = () => {
        const sheetWorkspace = document.querySelector(".editor-sheet-workspace");
        const gridPanel = document.querySelector(".editor-sheet-grid-panel");
        const gridWrap = document.getElementById("editor-sheet-grid-wrap");
        const grid = document.getElementById("editor-sheet-grid");
        if (!sheetWorkspace || !gridPanel || !gridWrap || !grid) return;
        const workspaceRect = sheetWorkspace.getBoundingClientRect();
        const panelRect = gridPanel.getBoundingClientRect();
        const workspaceStyles = window.getComputedStyle(sheetWorkspace);
        const workspaceBottomPadding = Number.parseFloat(workspaceStyles.paddingBottom || "0") || 0;
        const availableGridHeight = Math.max(
            Math.floor(workspaceRect.bottom - panelRect.top - workspaceBottomPadding),
            SHEET_MIN_GRID_HEIGHT
        );
        [gridPanel, gridWrap].forEach((node) => {
            node.style.minHeight = `${availableGridHeight}px`;
            node.style.maxHeight = `${availableGridHeight}px`;
            node.style.height = `${availableGridHeight}px`;
        });
        const gridTemplate = buildSheetGridTemplate();
        [gridWrap, grid].forEach((node) => {
            node.style.setProperty("--editor-sheet-row-header-width", `${SHEET_ROW_HEADER_WIDTH}px`);
            node.style.setProperty("--editor-sheet-grid-template", gridTemplate);
        });
        const headerRow = document.getElementById("editor-sheet-header-row");
        if (headerRow) headerRow.style.height = `${SHEET_HEADER_HEIGHT}px`;
        for (let rowIndex = 0; rowIndex < sheetRows; rowIndex += 1) {
            const rowNode = document.getElementById(`editor-sheet-data-row-${rowIndex}`);
            if (!rowNode) continue;
            rowNode.style.height = `${getSheetRowHeight(rowIndex)}px`;
        }
        updateSheetGridColumnCount();
    };
    const appendSheetColumnNodes = (columnIndex = 0) => {
        const headerRow = document.getElementById("editor-sheet-header-row");
        if (headerRow && !document.getElementById(`editor-sheet-column-${columnIndex}`)) {
            headerRow.append(div({
                id: `editor-sheet-column-${columnIndex}`,
                style: "editor-sheet-cell-header editor-sheet-selectable-header",
                content: children([
                    div({style: "editor-sheet-header-label", content: getSheetColumnLabel(columnIndex)}),
                    createSheetResizeHandle("column", columnIndex)
                ])
            }));
        }
        for (let rowIndex = 0; rowIndex < sheetRows; rowIndex += 1) {
            const rowNode = document.getElementById(`editor-sheet-data-row-${rowIndex}`);
            if (!rowNode) continue;
            const cellReference = getSheetCellReference(rowIndex, columnIndex);
            if (document.getElementById(`sheet-cell-${cellReference}`)) continue;
            rowNode.append(div({
                id: `editor-sheet-cell-wrap-${cellReference}`,
                style: "editor-sheet-cell",
                content: children([
                    input({id: `sheet-cell-${cellReference}`, style: "editor-sheet-cell-input", value: ""}),
                    div({style: "editor-sheet-cell-lock-indicator", content: SHEET_LOCK_ICON})
                ])
            }));
        }
    };
    const appendSheetRowNodes = (rowIndex = 0) => {
        const grid = document.getElementById("editor-sheet-grid");
        if (!grid || document.getElementById(`editor-sheet-data-row-${rowIndex}`)) return;
        const rowCells = [div({
            id: `editor-sheet-row-${rowIndex}`,
            style: "editor-sheet-cell-header editor-sheet-row-header editor-sheet-selectable-header",
            content: children([
                div({style: "editor-sheet-header-label", content: String(rowIndex + 1)}),
                createSheetResizeHandle("row", rowIndex)
            ])
        })];
        for (let columnIndex = 0; columnIndex < sheetColumns; columnIndex += 1) {
            const cellReference = getSheetCellReference(rowIndex, columnIndex);
            rowCells.push(div({
                id: `editor-sheet-cell-wrap-${cellReference}`,
                style: "editor-sheet-cell",
                content: children([
                    input({id: `sheet-cell-${cellReference}`, style: "editor-sheet-cell-input", value: ""}),
                    div({style: "editor-sheet-cell-lock-indicator", content: SHEET_LOCK_ICON})
                ])
            }));
        }
        grid.append(div({id: `editor-sheet-data-row-${rowIndex}`, style: "editor-sheet-row", content: children(rowCells)}));
    };
    const growSheetRows = (count = SHEET_ROW_GROWTH) => {
        const startRow = sheetRows;
        sheetRows += count;
        for (let rowIndex = startRow; rowIndex < sheetRows; rowIndex += 1) appendSheetRowNodes(rowIndex);
        bindSheetInteractions();
        syncSheetGridLayout();
        refreshSheetCells();
        saveSheetPortalState();
    };
    const growSheetColumns = (count = SHEET_COLUMN_GROWTH) => {
        const startColumn = sheetColumns;
        sheetColumns += count;
        for (let columnIndex = startColumn; columnIndex < sheetColumns; columnIndex += 1) appendSheetColumnNodes(columnIndex);
        updateSheetGridColumnCount();
        bindSheetInteractions();
        syncSheetGridLayout();
        refreshSheetCells();
        saveSheetPortalState();
    };
    const maybeGrowSheetGrid = () => {
        const gridWrap = document.getElementById("editor-sheet-grid-wrap");
        if (!gridWrap || isGrowingSheetGrid) return;
        const nearBottom = (gridWrap.scrollTop + gridWrap.clientHeight) >= (gridWrap.scrollHeight - SHEET_SCROLL_BUFFER);
        const nearRight = (gridWrap.scrollLeft + gridWrap.clientWidth) >= (gridWrap.scrollWidth - SHEET_SCROLL_BUFFER);
        if (!nearBottom && !nearRight) return;
        isGrowingSheetGrid = true;
        if (nearBottom) growSheetRows();
        if (nearRight) growSheetColumns();
        isGrowingSheetGrid = false;
    };
    const bindSheetGridScrollGrowth = () => {
        const gridWrap = document.getElementById("editor-sheet-grid-wrap");
        if (!gridWrap || gridWrap.dataset.scrollGrowthBound === "1") return;
        gridWrap.dataset.scrollGrowthBound = "1";
        updateSheetGridColumnCount();
        gridWrap.addEventListener("scroll", maybeGrowSheetGrid);
    };
    const bindSheetArrowNavigation = () => {
        if (sheetArrowNavigationBound) return;
        sheetArrowNavigationBound = true;
        document.addEventListener("keydown", (event) => {
            if (!document.getElementById("editor-sheet-grid-wrap")) return;
            if (!isSheetWindowShown()) return;
            const activeElement = document.activeElement;
            const activeElementId = String(activeElement?.id || "");
            if (activeElementId.startsWith("sheet-cell-") || activeElementId === "editor-sheet-formula") return;
            if (activeElement && ((activeElement.tagName === "INPUT") || (activeElement.tagName === "TEXTAREA") || activeElement.isContentEditable)) return;
            if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                if (Number.isInteger(activeSheetRow) || Number.isInteger(activeSheetColumn)) return;
                if (isSheetCellLocked(activeSheetCell)) return;
                const targetInput = getSheetCellInput(activeSheetCell);
                if (!targetInput) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                sheetCellValues[activeSheetCell] = event.key;
                targetInput.focus();
                targetInput.value = event.key;
                targetInput.setSelectionRange(event.key.length, event.key.length);
                writeSheetEditorBar();
                saveSheetPortalState();
                return;
            }
            if (event.key === "Delete") {
                if (Number.isInteger(activeSheetRow) || Number.isInteger(activeSheetColumn)) return;
                if (isSheetCellLocked(activeSheetCell)) return;
                event.preventDefault();
                sheetCellValues[activeSheetCell] = "";
                refreshSheetCells();
                saveSheetPortalState();
                return;
            }
            if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            event.preventDefault();
            const rowDelta = event.key === "ArrowUp" ? -1 : (event.key === "ArrowDown" ? 1 : 0);
            const columnDelta = event.key === "ArrowLeft" ? -1 : (event.key === "ArrowRight" ? 1 : 0);
            if (event.shiftKey) {
                moveActiveSheetRangeBy(rowDelta, columnDelta);
                writeSheetEditorBar();
                updateSheetSelectionStyles();
                saveSheetPortalState();
                return;
            }
            const activePosition = parseSheetCellReference(activeSheetCell);
            const nextRow = Math.min(Math.max(activePosition.rowIndex + rowDelta, 0), sheetRows - 1);
            const nextColumn = Math.min(Math.max(activePosition.columnIndex + columnDelta, 0), sheetColumns - 1);
            setActiveSheetCell(getSheetCellReference(nextRow, nextColumn));
            saveSheetPortalState();
        });
    };
    const bindSheetInteractions = () => {
        if (document.body?.dataset.sheetSelectionBound !== "1") {
            document.body.dataset.sheetSelectionBound = "1";
            document.addEventListener("mouseup", () => {
                if (!isDraggingSheetSelection) return;
                isDraggingSheetSelection = false;
                sheetSelectionAnchor = null;
                updateSheetSelectionStyles();
                saveSheetPortalState();
            });
        }
        if (document.body?.dataset.sheetResizeBound !== "1") {
            document.body.dataset.sheetResizeBound = "1";
            document.addEventListener("mousemove", (event) => {
                if (!activeSheetResize) return;
                event.preventDefault();
                const nextSize = activeSheetResize.startSize + (activeSheetResize.axis === "column"
                    ? event.clientX - activeSheetResize.startPointer
                    : event.clientY - activeSheetResize.startPointer);
                if (activeSheetResize.axis === "column") {
                    sheetColumnWidths[activeSheetResize.index] = Math.min(SHEET_MAX_CELL_WIDTH, Math.max(SHEET_MIN_CELL_WIDTH, Math.round(nextSize)));
                } else {
                    sheetRowHeights[activeSheetResize.index] = Math.min(SHEET_MAX_ROW_HEIGHT, Math.max(SHEET_MIN_ROW_HEIGHT, Math.round(nextSize)));
                }
                syncSheetGridLayout();
            });
            document.addEventListener("mouseup", () => {
                if (!activeSheetResize) return;
                document.body.classList.remove("editor-sheet-resizing-columns", "editor-sheet-resizing-rows");
                activeSheetResize = null;
                refreshSheetCells();
                saveSheetPortalState();
            });
        }
        for (let rowIndex = 0; rowIndex < sheetRows; rowIndex += 1) {
            for (let columnIndex = 0; columnIndex < sheetColumns; columnIndex += 1) {
                const cellReference = getSheetCellReference(rowIndex, columnIndex);
                const cellInput = getSheetCellInput(cellReference);
                if (!cellInput || cellInput.dataset.bound === "1") continue;
                cellInput.dataset.bound = "1";
                cellInput.addEventListener("mousedown", (event) => {
                    if (event.button !== 0) return;
                    if (activeSheetCell !== cellReference) return;
                    isDraggingSheetSelection = true;
                    sheetSelectionAnchor = cellReference;
                });
                cellInput.addEventListener("mouseenter", () => {
                    if (!isDraggingSheetSelection || !sheetSelectionAnchor) return;
                    setActiveSheetRange(sheetSelectionAnchor, cellReference);
                    updateSheetSelectionStyles();
                });
                cellInput.addEventListener("focus", () => {
                    if (isDraggingSheetSelection && sheetSelectionAnchor) return;
                    setActiveSheetCell(cellReference);
                    cellInput.value = sheetCellValues[cellReference] ?? "";
                });
                cellInput.addEventListener("click", (event) => {
                    if (!event.ctrlKey) return;
                    if (!openSheetHyperlink(cellReference)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    cellInput.blur();
                });
                cellInput.contextmenu([
                    {
                        label: "Hyperlink",
                        icon: SHEET_LINK_ICON,
                        action: () => showSheetHyperlinkDialogue(cellReference)
                    },
                    {
                        label: "Lock Cell",
                        icon: SHEET_LOCK_ICON,
                        visible: () => !isSheetCellLocked(cellReference),
                        action: () => toggleSheetCellLock(cellReference, true)
                    },
                    {
                        label: "Unlock Cell",
                        icon: SHEET_UNLOCK_ICON,
                        visible: () => isSheetCellLocked(cellReference),
                        action: () => toggleSheetCellLock(cellReference, false)
                    },
                    {
                        label: "Style",
                        action: (_, event) => openSheetCellStyleEditor(cellReference, event)
                    }
                ]);
                cellInput.addEventListener("blur", () => {
                    if (isSheetCellLocked(cellReference)) {
                        refreshSheetCells();
                        saveSheetPortalState();
                        return;
                    }
                    sheetCellValues[cellReference] = readSheetInputValue(cellReference);
                    refreshSheetCells();
                    saveSheetPortalState();
                });
                cellInput.addEventListener("keydown", (event) => {
                    if (isSheetCellLocked(cellReference) && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                        event.preventDefault();
                        return;
                    }
                    if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        cellInput.blur();
                        return;
                    }
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    sheetCellValues[cellReference] = readSheetInputValue(cellReference);
                    refreshSheetCells();
                    saveSheetPortalState();
                    cellInput.blur();
                });
            }
            const rowHeader = document.getElementById(`editor-sheet-row-${rowIndex}`);
            if (rowHeader && rowHeader.dataset.bound !== "1") {
                rowHeader.dataset.bound = "1";
                rowHeader.addEventListener("click", () => setActiveSheetRow(rowIndex));
                rowHeader.addEventListener("contextmenu", () => setActiveSheetRow(rowIndex));
                rowHeader.contextmenu([
                    {
                        label: "Insert Row Above",
                        action: () => insertSheetRowAt(rowIndex)
                    },
                    {
                        label: "Insert Row Below",
                        action: () => insertSheetRowAt(rowIndex + 1)
                    },
                    "separator",
                    {
                        label: "Delete Row",
                        destructive: true,
                        action: () => deleteSheetRowAt(rowIndex)
                    }
                ]);
            }
            const rowResizeHandle = document.getElementById(`editor-sheet-row-resize-${rowIndex}`);
            if (rowResizeHandle && rowResizeHandle.dataset.bound !== "1") {
                rowResizeHandle.dataset.bound = "1";
                rowResizeHandle.addEventListener("mousedown", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    activeSheetResize = {
                        axis: "row",
                        index: rowIndex,
                        startPointer: event.clientY,
                        startSize: getSheetRowHeight(rowIndex)
                    };
                    document.body.classList.add("editor-sheet-resizing-rows");
                });
                rowResizeHandle.addEventListener("dblclick", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    autoSizeSheetRow(rowIndex);
                });
            }
        }
        for (let columnIndex = 0; columnIndex < sheetColumns; columnIndex += 1) {
            const columnHeader = document.getElementById(`editor-sheet-column-${columnIndex}`);
            if (columnHeader && columnHeader.dataset.bound !== "1") {
                columnHeader.dataset.bound = "1";
                columnHeader.addEventListener("click", () => setActiveSheetColumn(columnIndex));
                columnHeader.addEventListener("contextmenu", () => setActiveSheetColumn(columnIndex));
                columnHeader.contextmenu([
                    {
                        label: "Insert Column Left",
                        action: () => insertSheetColumnAt(columnIndex)
                    },
                    {
                        label: "Insert Column Right",
                        action: () => insertSheetColumnAt(columnIndex + 1)
                    },
                    "separator",
                    {
                        label: "Delete Column",
                        destructive: true,
                        action: () => deleteSheetColumnAt(columnIndex)
                    }
                ]);
            }
            const columnResizeHandle = document.getElementById(`editor-sheet-column-resize-${columnIndex}`);
            if (columnResizeHandle && columnResizeHandle.dataset.bound !== "1") {
                columnResizeHandle.dataset.bound = "1";
                columnResizeHandle.addEventListener("mousedown", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    activeSheetResize = {
                        axis: "column",
                        index: columnIndex,
                        startPointer: event.clientX,
                        startSize: getSheetColumnWidth(columnIndex)
                    };
                    document.body.classList.add("editor-sheet-resizing-columns");
                });
                columnResizeHandle.addEventListener("dblclick", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    autoSizeSheetColumn(columnIndex);
                });
            }
        }
        const formulaInput = document.getElementById("editor-sheet-formula");
        if (formulaInput && formulaInput.dataset.bound !== "1") {
            formulaInput.dataset.bound = "1";
            formulaInput.addEventListener("input", () => {
                if (isSheetCellLocked(activeSheetCell)) {
                    formulaInput.value = sheetCellValues[activeSheetCell] ?? "";
                    return;
                }
                sheetCellValues[activeSheetCell] = formulaInput.value;
                const activeInput = getSheetCellInput(activeSheetCell);
                if (activeInput && document.activeElement === activeInput) {
                    activeInput.value = formulaInput.value;
                }
                saveSheetPortalState();
            });
            formulaInput.addEventListener("keydown", (event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (isSheetCellLocked(activeSheetCell)) {
                    formulaInput.value = sheetCellValues[activeSheetCell] ?? "";
                    getSheetCellInput(activeSheetCell)?.focus();
                    return;
                }
                refreshSheetCells();
                saveSheetPortalState();
                getSheetCellInput(activeSheetCell)?.focus();
            });
        }
        bindSheetGridScrollGrowth();
        bindSheetArrowNavigation();
        bindSheetToolbar();
        refreshSheetCells();
        saveSheetPortalState();
    };

    modular.register(new Service(SERVICE_ID, [
        new Portal({
            title: "Sheet",
            hints: ["sheets", "new sheet", "create sheet", "make a sheet"],
            dimensions: [1000, 740],
            horizontal_nav: true,
            centered_nav: true,
            tools: [{
                title: "Save",
                icon: modular.icons.save,
                onclick: () => {
                    saveLoadedSheet();
                }
            }],
            svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" /></svg>`,
            icon: "/icons/sprdshts.png",
            route: () => {
                restoreSheetPortalState();
                return div({style: "large-padding-top editor-portal-shell", content: children([
                        div({style: "editor-sheet-shell", content: children([
                                div({id: "editor-text-toolbar", style: "bordered shadowed radius small-padding", content: div({style: "faded", content: children([
                                            select({id: "editor-sheet-font-family", style: "small-margin-right inner-radius", value: "Inter", options: [{label: "Inter", value: "Inter"}]}),
                                            select({id: "editor-sheet-font-size", style: "small-margin-right inner-radius", value: "12",
                                                options: [
                                                    {label: "8", value: "8"},
                                                    {label: "9", value: "9"},
                                                    {label: "10", value: "10"},
                                                    {label: "11", value: "11"},
                                                    {label: "12", value: "12"},
                                                    {label: "14", value: "14"},
                                                    {label: "16", value: "16"},
                                                    {label: "18", value: "18"},
                                                    {label: "20", value: "20"},
                                                    {label: "22", value: "22"},
                                                    {label: "24", value: "24"},
                                                    {label: "26", value: "26"},
                                                    {label: "28", value: "28"},
                                                    {label: "36", value: "36"},
                                                    {label: "48", value: "48"},
                                                    {label: "72", value: "72"},
                                                ]
                                            }),
                                            button({id: "editor-sheet-style-bold", style: "naked align-bottom small-margin-right inner-radius", title: "Bold", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 5.7519531 2.0039062 A 0.750075 0.750075 0 0 0 5.0019531 2.7539062 L 5.0019531 11.703125 A 0.750075 0.750075 0 0 0 5.0019531 11.757812 L 5.0078125 21.257812 A 0.750075 0.750075 0 0 0 5.7578125 22.007812 L 13.505859 22.007812 C 16.534311 22.007812 19.005859 19.536265 19.005859 16.507812 C 19.005859 14.261755 17.639043 12.332811 15.701172 11.480469 C 17.057796 10.528976 18.005859 9.0314614 18.005859 7.2558594 C 18.005859 4.3643887 15.645377 2.0039063 12.753906 2.0039062 L 5.7519531 2.0039062 z M 6.5019531 3.5039062 L 12.753906 3.5039062 C 14.834436 3.5039063 16.505859 5.17533 16.505859 7.2558594 C 16.505859 9.3363887 14.834436 11.007813 12.753906 11.007812 L 6.5019531 11.007812 L 6.5019531 3.5039062 z M 6.5019531 12.507812 L 12.753906 12.507812 L 13.505859 12.507812 C 15.723408 12.507812 17.505859 14.290264 17.505859 16.507812 C 17.505859 18.725361 15.723408 20.507812 13.505859 20.507812 L 6.5058594 20.507812 L 6.5019531 12.507812 z"/></svg>`}),
                                            button({id: "editor-sheet-style-italic", style: "naked align-bottom small-margin-right inner-radius", title: "Italicize", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 10 2.0078125 L 10 3.5078125 L 10.75 3.5078125 L 13.119141 3.5078125 L 9.3417969 20.503906 L 6.7558594 20.503906 L 6.0058594 20.503906 L 6.0058594 22.003906 L 6.7558594 22.003906 L 13.255859 22.003906 L 14.005859 22.003906 L 14.005859 20.503906 L 13.255859 20.503906 L 10.878906 20.503906 L 14.65625 3.5078125 L 17.25 3.5078125 L 18 3.5078125 L 18 2.0078125 L 17.25 2.0078125 L 10.75 2.0078125 L 10 2.0078125 z"/></svg>`}),
                                            button({id: "editor-sheet-style-underline", style: "naked align-bottom small-margin-right inner-radius", title: "Underline", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 6.0058594 2 L 6.0058594 2.75 L 6.0058594 12.585938 C 6.0058594 15.618894 8.7446099 18.001953 12.003906 18.001953 C 15.263203 18.001953 18.003906 15.618893 18.003906 12.585938 L 18.003906 2.75 L 18.003906 2 L 16.503906 2 L 16.503906 2.75 L 16.503906 12.585938 C 16.503906 14.706981 14.54261 16.501953 12.003906 16.501953 C 9.4652032 16.501953 7.5058594 14.70698 7.5058594 12.585938 L 7.5058594 2.75 L 7.5058594 2 L 6.0058594 2 z M 4.9980469 20.003906 L 4.9980469 21.503906 L 5.7480469 21.503906 L 18.251953 21.503906 L 19.001953 21.503906 L 19.001953 20.003906 L 18.251953 20.003906 L 5.7480469 20.003906 L 4.9980469 20.003906 z"/></svg>`}),
                                            button({id: "editor-sheet-style-color", style: "naked align-bottom small-margin-right inner-radius", title: "Foreground", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 12.017578 2 A 0.750075 0.750075 0 0 0 11.294922 2.4941406 L 6.0507812 16.996094 A 0.75065194 0.75065194 0 1 0 7.4628906 17.505859 L 8.3691406 14.998047 L 15.638672 14.998047 L 16.546875 17.505859 A 0.750075 0.750075 0 1 0 17.957031 16.996094 L 12.705078 2.4941406 A 0.750075 0.750075 0 0 0 12.017578 2 z M 12 4.9550781 L 15.095703 13.498047 L 8.9121094 13.498047 L 12 4.9550781 z M 5.7480469 20.003906 A 0.750075 0.750075 0 1 0 5.7480469 21.503906 L 18.251953 21.503906 A 0.750075 0.750075 0 1 0 18.251953 20.003906 L 5.7480469 20.003906 z"/></svg>`}),
                                            button({id: "editor-sheet-style-background", style: "naked align-bottom small-margin-right inner-radius", title: "Background", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 9.0996094 -0.00390625 A 0.750075 0.750075 0 0 0 8.578125 1.2832031 L 9.9414062 2.6484375 L 3.0214844 9.5722656 C 1.6862427 10.90878 1.6862427 13.097079 3.0214844 14.433594 L 9.5683594 20.984375 C 10.904906 22.320922 13.094894 22.322395 14.431641 20.984375 L 21.880859 13.53125 A 0.750075 0.750075 0 0 0 21.880859 12.472656 L 9.6386719 0.22265625 A 0.750075 0.750075 0 0 0 9.0996094 -0.00390625 z M 11.001953 3.7089844 L 20.289062 13.001953 L 13.371094 19.923828 C 12.60784 20.687809 11.39236 20.687282 10.628906 19.923828 L 4.0820312 13.373047 C 3.319273 12.609561 3.319273 11.396299 4.0820312 10.632812 L 11.001953 3.7089844 z M 8 13.25 A 0.75 0.75 0 0 0 8 14.75 A 0.75 0.75 0 0 0 8 13.25 z M 12 13.25 A 0.75 0.75 0 0 0 12 14.75 A 0.75 0.75 0 0 0 12 13.25 z M 16 13.25 A 0.75 0.75 0 0 0 16 14.75 A 0.75 0.75 0 0 0 16 13.25 z M 10 15.25 A 0.75 0.75 0 0 0 10 16.75 A 0.75 0.75 0 0 0 10 15.25 z M 14 15.25 A 0.75 0.75 0 0 0 14 16.75 A 0.75 0.75 0 0 0 14 15.25 z M 22 17 C 21.596 17 21.232875 17.301656 20.796875 17.972656 C 20.360875 18.643656 20 19.282 20 20 C 20 21.105 20.895 22 22 22 C 23.105 22 24 21.105 24 20 C 24 19.282 23.639125 18.643656 23.203125 17.972656 C 22.767125 17.301656 22.404 17 22 17 z M 12 17.25 A 0.75 0.75 0 0 0 12 18.75 A 0.75 0.75 0 0 0 12 17.25 z"/></svg>`}),
                                            button({id: "editor-sheet-style-align", style: "naked align-bottom small-margin-right inner-radius", title: "Alignment", icon: SHEET_ALIGN_ICONS.left}),
                                            button({id: "editor-sheet-style-link", style: "naked align-bottom small-margin-right inner-radius", title: "Hyperlink", icon: SHEET_LINK_ICON}),
                                            div({style: "inline bordered-right small-margin-right small-margin-left", content: " "}),
                                            select({
                                                id: "editor-sheet-cell-type",
                                                style: "small-margin-right inner-radius",
                                                value: "",
                                                options: [
                                                    {label: "Mixed", value: "__mixed__", disabled: true},
                                                    ...SHEET_CELL_TYPES
                                                ]
                                            }),
                                            button({id: "editor-sheet-make-chart", style: "naked align-bottom small-margin-right inner-radius", title: "Chart", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" /></svg>`}),
                                        ])})
                                }),
                                div({style: "padding-left padding-right padding-bottom editor-sheet-workspace", content: children([
                                        div({style: "bordered-left bordered-bottom bordered-right adjust-top-more shadowed radius-bottom-left radius-bottom-right small-padding editor-sheet-toolbar", content: children([
                                                div({id: "editor-sheet-active-cell", style: "editor-sheet-active-cell", content: activeSheetCell}),
                                                input({id: "editor-sheet-formula", style: "editor-sheet-formula border-green-focus", placeholder: "=A1+B1"})
                                            ])
                                        }),
                                        div({style: "editor-sheet-grid-panel small-margin-top", content: div({id: "editor-sheet-grid-wrap", style: "editor-sheet-grid-wrap bordered radius", content: div({id: "editor-sheet-grid", content: children(buildSheetGridRows())})})})
                                    ])
                                })
                            ])
                        })
                    ])
                });
            },
            afterRender: () => {
                syncSheetGridLayout();
                bindSheetInteractions();
                saveSheetPortalState();
                updateSheetPortalTitle();
            }
        })
    ]));
})();
