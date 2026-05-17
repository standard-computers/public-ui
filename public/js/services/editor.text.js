(async () => {
    const SERVICE_ID = "com.standard.editor.text";
    const TEXT_FONT_FAMILIES = window.StandardUI?.fontFamilies || ["Inter", "Georgia", "Times New Roman", "Courier New", "Verdana"];
    const TEXT_FONT_SIZES = ["8", "9", "10", "11", "12", "14", "16", "18", "20", "22", "24", "26", "28", "36", "48", "72"];
    const TEXT_TEXT_COLORS = [
        {label: "Default", value: ""},
        {label: "Ink", value: "var(--fg)"},
        {label: "Blue", value: "var(--blue)"},
        {label: "Green", value: "var(--green)"},
        {label: "Orange", value: "var(--orange)"},
        {label: "Red", value: "var(--red)"}
    ];
    const TEXT_BACKGROUND_COLORS = [
        {label: "None", value: ""},
        {label: "Paper", value: "var(--bg)"},
        {label: "Soft", value: "var(--secondary-bg)"},
        {label: "Blue", value: "#dbeafe"},
        {label: "Green", value: "#dcfce7"},
        {label: "Yellow", value: "#fef3c7"}
    ];
    const TEXT_HIGHLIGHT_COLOR = "#fef08a";
    const TEXT_DOCUMENT_CONTENT_PREFIX = "__STD_TEXT_EDITOR_B64__:";
    const TEXT_DOCUMENT_VIEW_SETTINGS_KEY = "std.textEditor.documentViewSettings";
    const TEXT_PAGE_VIEW_WIDTH = "8.5in";
    const TEXT_PAGE_VIEW_MIN_HEIGHT = "11in";
    const TEXT_PAGE_VIEW_PADDING = "0.75in";
    const TEXT_PAGE_VIEW_GAP = "28px";
    const TEXT_PAGE_VIEW_WIDTH_PX = 816;
    const TEXT_PAGE_VIEW_HEIGHT_PX = 1056;
    const TEXT_PAGE_VIEW_PADDING_PX = 72;
    const TEXT_PAGE_VIEW_GAP_PX = 28;
    const TEXT_PAGE_VIEW_CONTENT_HEIGHT_PX = TEXT_PAGE_VIEW_HEIGHT_PX - (TEXT_PAGE_VIEW_PADDING_PX * 2);
    const TEXT_PAGE_VIEW_BREAK_SPACER_PX = (TEXT_PAGE_VIEW_PADDING_PX * 2) + TEXT_PAGE_VIEW_GAP_PX;
    const TEXT_INPUT_SYNC_DEBOUNCE_MS = 120;
    const TEXT_LINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" style="fill:none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path fill="none" style="fill:none" stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>`;
    const TEXT_TABLE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 5.25h16.5v13.5H3.75V5.25Zm0 4.5h16.5M3.75 14.25h16.5M9.25 5.25v13.5M14.75 5.25v13.5" /></svg>`;
    const TEXT_SHAPE_ICON = `<svg class="small-icon text-color" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><rect x="3.75" y="4.5" width="7.5" height="7.5" rx="1.25" /><circle cx="16.75" cy="8.25" r="3.75" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 19.5h12l-6-6-6 6Z" /></svg>`;
    const TEXT_SHAPE_OPTIONS = [{
        type: "rectangle",
        label: "Rectangle",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><rect x="4" y="6" width="16" height="12" rx="1.5" /></svg>`
    }, {
        type: "rounded-rectangle",
        label: "Rounded Rectangle",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><rect x="4" y="6" width="16" height="12" rx="4" /></svg>`
    }, {
        type: "ellipse",
        label: "Ellipse",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><ellipse cx="12" cy="12" rx="8" ry="5.5" /></svg>`
    }, {
        type: "triangle",
        label: "Triangle",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linejoin="round" d="M12 4 21 20H3L12 4Z" /></svg>`
    }, {
        type: "diamond",
        label: "Diamond",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linejoin="round" d="M12 3 21 12 12 21 3 12 12 3Z" /></svg>`
    }];
    const TEXT_ALIGN_ICONS = {
        left: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" d="M4 6.5h16M4 10.5h10M4 14.5h16M4 18.5h10" /></svg>`,
        center: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" d="M4 6.5h16M7 10.5h10M4 14.5h16M7 18.5h10" /></svg>`,
        right: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" d="M4 6.5h16M10 10.5h10M4 14.5h16M10 18.5h10" /></svg>`
    };
    let activeTextEditorFilePath = "";
    let activeTextEditorContent = "";
    let savedTextSelectionRange = null;
    let textEditorSelectionChangeBound = false;
    let activeTextImageFrame = null;
    let activeTextImageResizeState = null;
    let activeTextShapeFrame = null;
    let activeTextShapeResizeState = null;
    let activeTextShapeMoveState = null;
    let activeTextTableResizeState = null;
    let activeTextTableResizeHandle = null;
    let activeTextPageViewEnabled = false;
    let textEditorDeferredSyncTimer = null;
    const resolvedTextColorCache = new Map();
    const findTextPortal = () => [...Array.from(document.querySelectorAll(".draggable-window"))]
        .reverse()
        .find((windowNode) => windowNode?.portal?.serviceId?.() === SERVICE_ID)
        ?.portal;
    const findTextPortalNode = (portal = findTextPortal(), selector = "") => {
        return portal?.window?.()?.querySelector?.(selector) || document.querySelector(selector);
    };
    const prioritizePortalDomForLegacyLookups = (portal = null) => {
        const windowNode = portal?.window?.();
        const parentNode = windowNode?.parentElement;
        if (!windowNode || !parentNode || parentNode.firstElementChild === windowNode) return;
        parentNode.insertBefore(windowNode, parentNode.firstElementChild);
        if (typeof modular?.bringToFront === "function") modular.bringToFront(windowNode);
    };
    const findTextEditorNode = (portal = findTextPortal()) => findTextPortalNode(portal, "#editor-text-content");
    const findTextEditorStage = (portal = findTextPortal()) => findTextPortalNode(portal, "#editor-text-stage");
    const findTextEditorPageBackdrop = (portal = findTextPortal()) => findTextPortalNode(portal, "#editor-text-page-backdrop");
    const findTextEditorPageMeasure = (portal = findTextPortal()) => findTextPortalNode(portal, "#editor-text-page-measure");
    const normalizeTextFilePath = (rawPath = "") => String(rawPath || "").replace(/^\/home\/standard-system\//, "").replace(/^\/+/, "");
    const getTextFileName = (rawPath = "") => String(rawPath || "").split("/").pop() || "Text";
    const getTextFileExtension = (rawPath = "") => {
        const fileName = getTextFileName(rawPath).toLowerCase();
        return fileName.includes(".") ? fileName.split(".").pop() : "";
    };
    const isPlainTextFilePath = (rawPath = "") => getTextFileExtension(rawPath) === "txt";
    const getDefaultTextDocumentPageViewPreference = (rawPath = "") => !isPlainTextFilePath(rawPath);
    const getTextFileDirectory = (rawPath = "") => {
        const normalizedPath = normalizeTextFilePath(rawPath);
        if (!normalizedPath.includes("/")) return "";
        return normalizedPath.split("/").slice(0, -1).join("/");
    };
    const readStoredTextDocumentViewSettings = () => {
        try {
            const rawSettings = window.localStorage?.getItem(TEXT_DOCUMENT_VIEW_SETTINGS_KEY);
            if (!rawSettings) return {};
            const parsedSettings = JSON.parse(rawSettings);
            return parsedSettings && typeof parsedSettings === "object" ? parsedSettings : {};
        } catch (_) {
            return {};
        }
    };
    const writeStoredTextDocumentViewSettings = (settings = {}) => {
        try {
            window.localStorage?.setItem(TEXT_DOCUMENT_VIEW_SETTINGS_KEY, JSON.stringify(settings));
            return true;
        } catch (_) {
            return false;
        }
    };
    const getStoredTextDocumentPageViewPreference = (rawPath = "") => {
        const normalizedPath = normalizeTextFilePath(rawPath);
        if (!normalizedPath) return null;
        const settings = readStoredTextDocumentViewSettings();
        return typeof settings[normalizedPath]?.pageViewEnabled === "boolean"
            ? settings[normalizedPath].pageViewEnabled
            : null;
    };
    const persistTextDocumentPageViewPreference = (rawPath = "", enabled = activeTextPageViewEnabled) => {
        const normalizedPath = normalizeTextFilePath(rawPath);
        if (!normalizedPath) return false;
        const settings = readStoredTextDocumentViewSettings();
        settings[normalizedPath] = {
            ...(settings[normalizedPath] && typeof settings[normalizedPath] === "object" ? settings[normalizedPath] : {}),
            pageViewEnabled: !!enabled
        };
        return writeStoredTextDocumentViewSettings(settings);
    };
    const loadTextDocumentPageViewPreference = (rawPath = "", fallback = false) => {
        if (isPlainTextFilePath(rawPath)) {
            activeTextPageViewEnabled = false;
            return activeTextPageViewEnabled;
        }
        const storedPreference = getStoredTextDocumentPageViewPreference(rawPath);
        activeTextPageViewEnabled = typeof storedPreference === "boolean" ? storedPreference : !!fallback;
        return activeTextPageViewEnabled;
    };
    const shouldHideTextEditorBar = (rawPath = "") => {
        const extension = getTextFileExtension(rawPath);
        return extension === "txt" || extension === "md";
    };
    const isRichTextDocument = (rawPath = activeTextEditorFilePath) => !shouldHideTextEditorBar(rawPath);
    const escapeTextHtml = (value = "") => `${value ?? ""}`.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[character] || character));
    const isSelectionInsideTextEditor = (selection = window.getSelection()) => {
        const editorNode = findTextEditorNode();
        if (!editorNode || !selection?.rangeCount) return false;
        return editorNode.contains(selection.getRangeAt(0).commonAncestorContainer);
    };
    const encodeTextDocumentContent = (value = "") => {
        const bytes = new TextEncoder().encode(String(value || ""));
        let binary = "";
        bytes.forEach((byte) => {
            binary += String.fromCharCode(byte);
        });
        return `${TEXT_DOCUMENT_CONTENT_PREFIX}${btoa(binary)}`;
    };
    const decodeTextDocumentContent = (value = "") => {
        const raw = String(value || "");
        if (!raw.startsWith(TEXT_DOCUMENT_CONTENT_PREFIX)) return raw;
        try {
            const binary = atob(raw.slice(TEXT_DOCUMENT_CONTENT_PREFIX.length));
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            return new TextDecoder().decode(bytes);
        } catch (_) {
            return "";
        }
    };
    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(reader.error || new Error("Failed to read image data"));
        reader.readAsDataURL(file);
    });
    const getTextPageBreakSpacers = (rootNode = findTextEditorNode()) => {
        if (!rootNode?.querySelectorAll) return [];
        return Array.from(rootNode.querySelectorAll(".editor-text-page-break-spacer"));
    };
    const getTextEditorDefaultLineHeight = (rootNode = findTextEditorNode()) => {
        if (!rootNode) return 0;
        const computedStyle = getComputedStyle(rootNode);
        const lineHeight = parseFloat(computedStyle.lineHeight);
        if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;
        const fontSize = parseFloat(computedStyle.fontSize);
        return Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.5 : 0;
    };
    const clearTextEditorPageBreakSpacers = (rootNode = findTextEditorNode()) => {
        getTextPageBreakSpacers(rootNode).forEach((spacerNode) => spacerNode.remove());
    };
    const isTextPageBreakSpacer = (node) => node?.nodeType === Node.ELEMENT_NODE && node.classList?.contains("editor-text-page-break-spacer");
    const getTextEditorNodeVisualHeight = (node, rootNode = findTextEditorNode()) => {
        if (!node || !rootNode) return 0;
        const fallbackLineHeight = getTextEditorDefaultLineHeight(rootNode);
        if (node.nodeType === Node.TEXT_NODE) {
            const range = document.createRange();
            range.selectNodeContents(node);
            const rect = range.getBoundingClientRect();
            range.detach?.();
            return rect.height || fallbackLineHeight;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return 0;
        if (node.tagName === "BR") return fallbackLineHeight;
        const computedStyle = getComputedStyle(node);
        const marginTop = parseFloat(computedStyle.marginTop) || 0;
        const marginBottom = parseFloat(computedStyle.marginBottom) || 0;
        const measuredHeight = (node.offsetHeight || 0) + marginTop + marginBottom;
        if (measuredHeight > 0) return measuredHeight;
        const tagName = String(node.tagName || "").toUpperCase();
        if (["DIV", "P", "LI"].includes(tagName) || node.querySelector?.("br")) {
            return fallbackLineHeight + marginTop + marginBottom;
        }
        return measuredHeight;
    };
    const unwrapTextEditorImageFrames = (rootNode) => {
        if (!rootNode?.querySelectorAll) return;
        rootNode.querySelectorAll(".editor-text-image-frame").forEach((frameNode) => {
            const imageNode = frameNode.querySelector("img");
            if (!imageNode) {
                frameNode.remove();
                return;
            }
            const cleanImageNode = imageNode.cloneNode(true);
            cleanImageNode.removeAttribute("data-editor-image-selected");
            cleanImageNode.style.maxWidth = cleanImageNode.style.maxWidth || "100%";
            cleanImageNode.style.height = cleanImageNode.style.height || "auto";
            cleanImageNode.style.display = cleanImageNode.style.display || "block";
            cleanImageNode.style.cursor = "pointer";
            frameNode.replaceWith(cleanImageNode);
        });
    };
    const serializeTextEditorRichContent = (textArea = findTextEditorNode()) => {
        if (!textArea) return activeTextEditorContent;
        const clone = textArea.cloneNode(true);
        clone.querySelectorAll(".editor-text-page-break-spacer").forEach((spacerNode) => spacerNode.remove());
        unwrapTextEditorImageFrames(clone);
        clone.querySelectorAll(".editor-text-image-handle").forEach((handleNode) => handleNode.remove());
        clone.querySelectorAll(".editor-text-table-resize-handle").forEach((handleNode) => handleNode.remove());
        clone.querySelectorAll(".editor-text-search-marker").forEach((markerNode) => markerNode.remove());
        clone.querySelectorAll("[data-editor-image-selected=\"1\"]").forEach((node) => node.removeAttribute("data-editor-image-selected"));
        clone.querySelectorAll(".editor-text-shape-frame").forEach((node) => {
            node.removeAttribute("data-editor-shape-selected");
            node.style.outline = "";
            node.style.boxShadow = "";
        });
        return clone.innerHTML;
    };
    const readTextEditorContent = (textArea = findTextEditorNode()) => {
        if (!textArea) return activeTextEditorContent;
        return isRichTextDocument() ? serializeTextEditorRichContent(textArea) : textArea.innerText;
    };
    const cleanTextEditorPrintClone = (clone) => {
        if (!clone?.querySelectorAll) return clone;
        clone.querySelectorAll(".editor-text-page-break-spacer, .editor-text-image-handle, .editor-text-table-resize-handle, .editor-text-search-marker").forEach((node) => node.remove());
        unwrapTextEditorImageFrames(clone);
        clone.querySelectorAll("script, iframe, object, embed").forEach((node) => node.remove());
        clone.querySelectorAll("*").forEach((node) => {
            node.removeAttribute("contenteditable");
            Array.from(node.attributes || []).forEach((attribute) => {
                if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
            });
        });
        clone.querySelectorAll("[data-editor-image-selected=\"1\"]").forEach((node) => node.removeAttribute("data-editor-image-selected"));
        clone.querySelectorAll(".editor-text-shape-frame").forEach((node) => {
            node.removeAttribute("data-editor-shape-selected");
            node.style.outline = "";
            node.style.boxShadow = "";
            node.style.cursor = "";
        });
        return clone;
    };
    const buildTextEditorPrintDocument = (portal = findTextPortal()) => {
        const textArea = findTextEditorNode(portal);
        const state = portal?.windowState?.() || {};
        const filePath = normalizeTextFilePath(state?.directive || activeTextEditorFilePath || "");
        const title = getTextFileName(filePath || "Text");
        const richDocument = isRichTextDocument(filePath);
        let printBody = "";
        if (textArea) {
            const clone = cleanTextEditorPrintClone(textArea.cloneNode(true));
            printBody = richDocument
                ? clone.innerHTML
                : `<pre class="plain-text-document">${escapeTextHtml(clone.innerText || clone.textContent || "")}</pre>`;
        } else {
            const fallbackContent = typeof state?.cachedContent === "string" ? state.cachedContent : activeTextEditorContent;
            printBody = richDocument
                ? fallbackContent
                : `<pre class="plain-text-document">${escapeTextHtml(fallbackContent)}</pre>`;
        }
        return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title></title>
<style>
@page { size: letter; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; color: #111827; }
body { font-family: Inter, Arial, sans-serif; font-size: 12pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.print-document { box-sizing: border-box; width: 100%; min-height: 100vh; padding: 0.75in; overflow-wrap: anywhere; }
.plain-text-document { margin: 0; white-space: pre-wrap; font: 10.5pt/1.45 "Courier New", monospace; overflow-wrap: anywhere; }
p, div { break-inside: auto; }
img, svg, table, blockquote, pre { max-width: 100%; break-inside: avoid; }
img { height: auto; }
table { border-collapse: collapse; width: auto; }
td, th { border: 1px solid #d1d5db; padding: 6px; vertical-align: top; }
a { color: #1d4ed8; text-decoration: underline; }
.editor-text-shape-frame { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
</style>
</head>
<body><main class="print-document">${printBody || "<br>"}</main></body>
</html>`;
    };
    const printTextEditorDocument = async (portal = findTextPortal()) => {
        const textArea = findTextEditorNode(portal);
        if (!textArea && !activeTextEditorContent) {
            modular.error("Nothing to print");
            return false;
        }
        restoreEditorWindowState(portal);
        activeTextEditorContent = readTextEditorContent(textArea);
        syncEditorWindowState(portal);
        const printFrame = document.createElement("iframe");
        printFrame.style.position = "fixed";
        printFrame.style.right = "0";
        printFrame.style.bottom = "0";
        printFrame.style.width = "0";
        printFrame.style.height = "0";
        printFrame.style.border = "0";
        printFrame.style.opacity = "0";
        printFrame.setAttribute("aria-hidden", "true");
        document.body.appendChild(printFrame);
        const frameWindow = printFrame.contentWindow;
        const frameDocument = frameWindow?.document;
        if (!frameWindow || !frameDocument) {
            printFrame.remove();
            modular.error("Unable to prepare document for printing");
            return false;
        }
        const cleanup = () => window.setTimeout(() => printFrame.remove(), 500);
        frameWindow.addEventListener("afterprint", cleanup, {once: true});
        frameDocument.open();
        frameDocument.write(buildTextEditorPrintDocument(portal));
        frameDocument.close();
        await frameDocument.fonts?.ready?.catch?.(() => {});
        await Promise.all(Array.from(frameDocument.images || []).map((imageNode) => {
            if (imageNode.complete) return Promise.resolve();
            return new Promise((resolve) => {
                imageNode.onload = resolve;
                imageNode.onerror = resolve;
            });
        }));
        try {
            frameWindow.focus();
            frameWindow.print();
            window.setTimeout(cleanup, 30000);
            return true;
        } catch (_) {
            cleanup();
            modular.error("Unable to print this document");
            return false;
        }
    };
    const createTextEditorImageHandle = (position = "se") => {
        const handleNode = document.createElement("span");
        const offsets = {
            nw: {left: "-6px", top: "-6px", cursor: "nwse-resize"},
            ne: {right: "-6px", top: "-6px", cursor: "nesw-resize"},
            sw: {left: "-6px", bottom: "-6px", cursor: "nesw-resize"},
            se: {right: "-6px", bottom: "-6px", cursor: "nwse-resize"}
        };
        const resolvedOffset = offsets[position] || offsets.se;
        handleNode.className = "editor-text-image-handle";
        handleNode.dataset.resizeHandle = position;
        handleNode.contentEditable = "false";
        handleNode.style.position = "absolute";
        handleNode.style.width = "10px";
        handleNode.style.height = "10px";
        handleNode.style.borderRadius = "999px";
        handleNode.style.background = "var(--blue)";
        handleNode.style.border = "2px solid var(--bg)";
        handleNode.style.boxShadow = "0 0 0 1px rgba(15, 23, 42, 0.15)";
        handleNode.style.zIndex = "2";
        handleNode.style.userSelect = "none";
        Object.entries(resolvedOffset).forEach(([key, value]) => {
            handleNode.style[key] = value;
        });
        return handleNode;
    };
    const clearActiveTextImageSelection = ({skipSync = false} = {}) => {
        if (!activeTextImageFrame) return;
        activeTextImageFrame.style.outline = "";
        activeTextImageFrame.style.boxShadow = "";
        activeTextImageFrame.querySelectorAll(".editor-text-image-handle").forEach((handleNode) => handleNode.remove());
        activeTextImageFrame.removeAttribute("data-editor-image-selected");
        activeTextImageFrame = null;
        activeTextImageResizeState = null;
        if (!skipSync) syncTextEditorStateFromDom();
    };
    const selectTextEditorImageFrame = (frameNode) => {
        if (!frameNode) return;
        if (activeTextImageFrame === frameNode) return;
        clearActiveTextImageSelection();
        clearActiveTextShapeSelection({skipSync: true});
        activeTextImageFrame = frameNode;
        frameNode.dataset.editorImageSelected = "1";
        frameNode.style.outline = "2px solid var(--blue)";
        frameNode.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.12)";
        ["nw", "ne", "sw", "se"].forEach((position) => frameNode.appendChild(createTextEditorImageHandle(position)));
        updateTextToolbarState();
    };
    const isTextEditorShapeOnTop = (frameNode) => frameNode?.dataset?.textWrap === "overlay";
    const clearActiveTextShapeSelection = ({skipSync = false} = {}) => {
        if (!activeTextShapeFrame) return;
        activeTextShapeFrame.style.outline = "";
        activeTextShapeFrame.style.boxShadow = "";
        activeTextShapeFrame.querySelectorAll(".editor-text-image-handle").forEach((handleNode) => handleNode.remove());
        activeTextShapeFrame.removeAttribute("data-editor-shape-selected");
        activeTextShapeFrame = null;
        activeTextShapeResizeState = null;
        activeTextShapeMoveState = null;
        if (!skipSync) syncTextEditorStateFromDom();
    };
    const selectTextEditorShapeFrame = (frameNode) => {
        if (!frameNode) return;
        if (activeTextShapeFrame === frameNode) return;
        clearActiveTextImageSelection({skipSync: true});
        clearActiveTextShapeSelection({skipSync: true});
        activeTextShapeFrame = frameNode;
        frameNode.dataset.editorShapeSelected = "1";
        frameNode.style.outline = "2px solid var(--blue)";
        frameNode.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.12)";
        ["nw", "ne", "sw", "se"].forEach((position) => frameNode.appendChild(createTextEditorImageHandle(position)));
        updateTextToolbarState();
    };
    const getTextEditorShapePathMarkup = (shapeType = "rectangle") => {
        if (shapeType === "ellipse") return `<ellipse cx="50" cy="50" rx="46" ry="32" />`;
        if (shapeType === "triangle") return `<path d="M50 4 L96 96 H4 Z" />`;
        if (shapeType === "diamond") return `<path d="M50 4 L96 50 L50 96 L4 50 Z" />`;
        if (shapeType === "rounded-rectangle") return `<rect x="5" y="12" width="90" height="76" rx="14" />`;
        return `<rect x="5" y="16" width="90" height="68" rx="4" />`;
    };
    const normalizeTextEditorShapeFrame = (frameNode) => {
        if (!frameNode) return;
        const width = Math.max(24, Number.parseFloat(frameNode.style.width || frameNode.dataset.shapeWidth || "") || (frameNode.dataset.shapeType === "triangle" || frameNode.dataset.shapeType === "diamond" ? 140 : 170));
        const height = Math.max(24, Number.parseFloat(frameNode.style.height || frameNode.dataset.shapeHeight || "") || (frameNode.dataset.shapeType === "triangle" || frameNode.dataset.shapeType === "diamond" ? 140 : 110));
        frameNode.classList.add("editor-text-shape-frame");
        frameNode.contentEditable = "false";
        frameNode.dataset.textWrap = isTextEditorShapeOnTop(frameNode) ? "overlay" : "inline";
        frameNode.style.display = "inline-block";
        frameNode.style.width = `${Math.round(width)}px`;
        frameNode.style.height = `${Math.round(height)}px`;
        frameNode.style.maxWidth = isTextEditorShapeOnTop(frameNode) ? "" : "100%";
        frameNode.style.margin = isTextEditorShapeOnTop(frameNode) ? "0" : "8px 0";
        frameNode.style.verticalAlign = "middle";
        frameNode.style.lineHeight = "0";
        frameNode.style.userSelect = "none";
        frameNode.style.cursor = isTextEditorShapeOnTop(frameNode) ? "move" : "pointer";
        if (isTextEditorShapeOnTop(frameNode)) {
            frameNode.style.position = "absolute";
            frameNode.style.zIndex = frameNode.style.zIndex || "3";
            frameNode.style.left = frameNode.style.left || "0px";
            frameNode.style.top = frameNode.style.top || "0px";
        } else {
            frameNode.style.position = "relative";
            frameNode.style.left = "";
            frameNode.style.top = "";
            frameNode.style.zIndex = "";
        }
        const svgNode = frameNode.querySelector("svg");
        if (svgNode) {
            svgNode.setAttribute("width", "100%");
            svgNode.setAttribute("height", "100%");
            svgNode.setAttribute("viewBox", "0 0 100 100");
            svgNode.setAttribute("preserveAspectRatio", "none");
            svgNode.style.display = "block";
            svgNode.style.pointerEvents = "none";
        }
    };
    const createTextEditorShapeFrame = (shapeType = "rectangle") => {
        const frameNode = document.createElement("span");
        const width = shapeType === "triangle" || shapeType === "diamond" ? 140 : 170;
        const height = shapeType === "triangle" || shapeType === "diamond" ? 140 : 110;
        frameNode.className = "editor-text-shape-frame";
        frameNode.dataset.shapeType = shapeType;
        frameNode.dataset.shapeWidth = String(width);
        frameNode.dataset.shapeHeight = String(height);
        frameNode.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" fill="rgba(76, 139, 245, 0.18)" stroke="#1f2937" stroke-width="2">${getTextEditorShapePathMarkup(shapeType)}</svg>`;
        normalizeTextEditorShapeFrame(frameNode);
        return frameNode;
    };
    const ensureTextEditorShapeFrames = (rootNode = findTextEditorNode()) => {
        if (!rootNode?.querySelectorAll) return;
        rootNode.querySelectorAll(".editor-text-shape-frame").forEach(normalizeTextEditorShapeFrame);
    };
    const applyTextEditorShapeWrapMode = (frameNode, onTop = false) => {
        const textArea = findTextEditorNode();
        if (!frameNode || !textArea) return false;
        if (onTop) {
            const frameRect = frameNode.getBoundingClientRect();
            const editorRect = textArea.getBoundingClientRect();
            frameNode.dataset.textWrap = "overlay";
            frameNode.style.position = "absolute";
            frameNode.style.left = `${Math.max(0, Math.round(frameRect.left - editorRect.left + textArea.scrollLeft))}px`;
            frameNode.style.top = `${Math.max(0, Math.round(frameRect.top - editorRect.top + textArea.scrollTop))}px`;
        } else {
            frameNode.dataset.textWrap = "inline";
        }
        normalizeTextEditorShapeFrame(frameNode);
        selectTextEditorShapeFrame(frameNode);
        syncTextEditorStateFromDom();
        return true;
    };
    const setTextEditorShapeColor = (frameNode, property = "fill", color = "") => {
        const svgNode = frameNode?.querySelector?.("svg");
        const nextColor = String(color || "").trim();
        if (!svgNode || !nextColor) return false;
        svgNode.setAttribute(property, nextColor);
        selectTextEditorShapeFrame(frameNode);
        syncTextEditorStateFromDom();
        return true;
    };
    const showTextEditorShapeColorDialogue = (frameNode, property = "fill", title = "Shape color", placeholder = "#4c8bf5") => {
        const svgNode = frameNode?.querySelector?.("svg");
        if (!svgNode) return false;
        inputDialogue({
            title,
            placeholder,
            value: svgNode.getAttribute(property) || placeholder,
            confirmation: (_, rawValue) => setTextEditorShapeColor(frameNode, property, rawValue)
        });
        return true;
    };
    const insertTextEditorShape = (shapeType = "rectangle") => {
        const textArea = findTextEditorNode();
        if (!textArea || !isRichTextDocument()) return false;
        const frameNode = createTextEditorShapeFrame(shapeType);
        insertNodeAtTextCaret(textArea, frameNode);
        selectTextEditorShapeFrame(frameNode);
        textArea.focus();
        rememberTextSelection();
        syncTextEditorStateFromDom();
        return true;
    };
    const deleteTextEditorShape = (frameNode = activeTextShapeFrame) => {
        if (!frameNode?.classList?.contains("editor-text-shape-frame")) return false;
        if (activeTextShapeFrame === frameNode) clearActiveTextShapeSelection({skipSync: true});
        frameNode.remove();
        syncTextEditorStateFromDom();
        return true;
    };
    const normalizeTextEditorImageNode = (imageNode) => {
        if (!imageNode) return;
        imageNode.alt = String(imageNode.getAttribute("alt") || "Embedded image").slice(0, 200);
        imageNode.loading = "lazy";
        imageNode.draggable = false;
        imageNode.style.display = "block";
        imageNode.style.height = imageNode.style.height || "auto";
        imageNode.style.maxWidth = "100%";
        imageNode.style.cursor = "pointer";
    };
    const createTextEditorImageFrame = (imageNode) => {
        if (!imageNode) return null;
        normalizeTextEditorImageNode(imageNode);
        const frameNode = document.createElement("span");
        frameNode.className = "editor-text-image-frame";
        frameNode.contentEditable = "false";
        frameNode.style.position = "relative";
        frameNode.style.display = "inline-block";
        frameNode.style.maxWidth = "100%";
        frameNode.style.margin = "8px 0";
        frameNode.style.verticalAlign = "middle";
        frameNode.style.lineHeight = "0";
        frameNode.style.borderRadius = "10px";
        frameNode.style.userSelect = "none";
        imageNode.style.borderRadius = imageNode.style.borderRadius || "10px";
        if (!imageNode.style.width && imageNode.hasAttribute("width")) {
            imageNode.style.width = `${Number(imageNode.getAttribute("width")) || ""}px`;
        }
        frameNode.appendChild(imageNode);
        return frameNode;
    };
    const ensureTextEditorImageFrames = (rootNode = findTextEditorNode()) => {
        if (!rootNode?.querySelectorAll) return;
        rootNode.querySelectorAll("img").forEach((imageNode) => {
            if (imageNode.closest(".editor-text-image-frame")) {
                normalizeTextEditorImageNode(imageNode);
                return;
            }
            const frameNode = createTextEditorImageFrame(imageNode.cloneNode(true));
            if (frameNode) imageNode.replaceWith(frameNode);
        });
    };
    const normalizeTextEditorTables = (rootNode = findTextEditorNode()) => {
        if (!rootNode?.querySelectorAll) return;
        rootNode.querySelectorAll("table").forEach((tableNode) => {
            tableNode.classList.add("editor-text-table");
            tableNode.querySelectorAll("th, td").forEach((cellNode) => {
                cellNode.classList.add("editor-text-table-cell");
                if (!cellNode.childNodes.length) cellNode.appendChild(document.createElement("br"));
            });
        });
    };
    const createTextEditorTable = (rowCount = 3, columnCount = 3) => {
        const rows = Math.max(1, Math.min(Number(rowCount) || 3, 10));
        const columns = Math.max(1, Math.min(Number(columnCount) || 3, 10));
        const tableNode = document.createElement("table");
        tableNode.className = "editor-text-table";
        tableNode.style.width = "100%";
        tableNode.style.tableLayout = "fixed";
        const tbodyNode = document.createElement("tbody");
        Array.from({length: rows}).forEach(() => {
            const rowNode = document.createElement("tr");
            Array.from({length: columns}).forEach(() => {
                const cellNode = document.createElement("td");
                cellNode.className = "editor-text-table-cell";
                cellNode.appendChild(document.createElement("br"));
                rowNode.appendChild(cellNode);
            });
            tbodyNode.appendChild(rowNode);
        });
        tableNode.appendChild(tbodyNode);
        return tableNode;
    };
    const placeCaretInTextTable = (tableNode) => {
        const firstCell = tableNode?.querySelector?.("th, td");
        if (!firstCell) return false;
        return placeCaretAtStart(firstCell);
    };
    const insertTextEditorTable = (rowCount = 3, columnCount = 3) => {
        const textArea = findTextEditorNode();
        if (!textArea || !isRichTextDocument()) return false;
        restoreTextSelection();
        textArea.focus();
        const selection = window.getSelection();
        const tableNode = createTextEditorTable(rowCount, columnCount);
        const trailingParagraph = createTextEditorParagraphBreak();
        const insertAfter = (targetNode) => {
            if (targetNode?.parentNode) targetNode.after(tableNode, trailingParagraph);
            else textArea.append(tableNode, trailingParagraph);
            placeCaretInTextTable(tableNode);
            rememberTextSelection();
            syncTextEditorStateFromDom();
            return true;
        };
        if (!selection?.rangeCount || !isSelectionInsideTextEditor(selection)) {
            return insertAfter(textArea.lastChild);
        }
        const range = selection.getRangeAt(0);
        range.collapse(false);
        const lineNode = findTextLineNode(range.startContainer, textArea);
        if (lineNode && lineNode !== textArea && lineNode.parentNode === textArea) return insertAfter(lineNode);
        textArea.append(tableNode, trailingParagraph);
        placeCaretInTextTable(tableNode);
        rememberTextSelection();
        syncTextEditorStateFromDom();
        return true;
    };
    const insertNodeAtTextCaret = (targetNode, insertedNode) => {
        if (!targetNode || !insertedNode) return false;
        targetNode.focus();
        restoreTextSelection();
        const selection = window.getSelection();
        if (!selection?.rangeCount) {
            targetNode.appendChild(insertedNode);
            const trailingBreak = document.createElement("br");
            targetNode.appendChild(trailingBreak);
            const range = document.createRange();
            range.setStartAfter(insertedNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            savedTextSelectionRange = range.cloneRange();
            return true;
        }
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(insertedNode);
        const trailingBreak = document.createElement("br");
        range.setStartAfter(insertedNode);
        range.collapse(true);
        range.insertNode(trailingBreak);
        range.setStartAfter(trailingBreak);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        savedTextSelectionRange = range.cloneRange();
        return true;
    };
    const insertImageFileIntoTextEditor = async (file) => {
        const textArea = findTextEditorNode();
        if (!textArea || !file || !isRichTextDocument()) return false;
        try {
            const src = await readFileAsDataUrl(file);
            if (!src) return false;
            const imageNode = document.createElement("img");
            imageNode.src = src;
            imageNode.alt = file.name || "Embedded image";
            const frameNode = createTextEditorImageFrame(imageNode);
            if (!frameNode) return false;
            insertNodeAtTextCaret(textArea, frameNode);
            selectTextEditorImageFrame(frameNode);
            textArea.focus();
            rememberTextSelection();
            syncTextEditorStateFromDom();
            return true;
        } catch (_) {
            modular.error("Unable to load image");
            return false;
        }
    };
    const hasEmbeddedTextEditorImage = (content = "") => /<img[\s\S]*?>/i.test(String(content || ""));
    const encodeTextEditorContentForSave = (content = "") => {
        const normalizedContent = String(content ?? "");
        return isRichTextDocument() && hasEmbeddedTextEditorImage(normalizedContent)
            ? encodeTextDocumentContent(normalizedContent)
            : normalizedContent;
    };
    const decodeTextEditorLoadedContent = (content = "") => {
        return isRichTextDocument() ? decodeTextDocumentContent(String(content ?? "")) : String(content ?? "");
    };
    const writeTextEditorContent = (textArea = findTextEditorNode(), content = activeTextEditorContent) => {
        if (!textArea) return;
        const nextContent = String(content ?? "");
        if (isRichTextDocument()) {
            if (textArea.innerHTML !== nextContent) textArea.innerHTML = nextContent;
            ensureTextEditorImageFrames(textArea);
            ensureTextEditorShapeFrames(textArea);
            normalizeTextEditorTables(textArea);
            prepareEditorLinks(textArea);
            return;
        }
        if (textArea.textContent !== nextContent) textArea.textContent = nextContent;
    };
    const getActiveTextEditorState = () => ({
        directive: activeTextEditorFilePath,
        cachedContent: activeTextEditorContent,
        pageViewEnabled: activeTextPageViewEnabled
    });
    const setTextEditorPortalState = (portal = findTextPortal(), options = {}) => {
        if (!portal || typeof portal.setWindowState !== "function") return;
        portal.setWindowState(getActiveTextEditorState(), options);
    };
    const syncEditorWindowState = (portal = findTextPortal()) => {
        setTextEditorPortalState(portal);
    };
    const restoreEditorWindowState = (portal = findTextPortal()) => {
        const state = portal?.windowState?.() || {};
        if (state?.directive) activeTextEditorFilePath = normalizeTextFilePath(state.directive);
        if (typeof state?.cachedContent === "string") activeTextEditorContent = state.cachedContent;
        loadTextDocumentPageViewPreference(
            activeTextEditorFilePath,
            typeof state?.pageViewEnabled === "boolean" ? state.pageViewEnabled : getDefaultTextDocumentPageViewPreference(activeTextEditorFilePath)
        );
    };
    const updateTextEditorPortalTitle = (editorPortal = findTextPortal()) => {
        if (editorPortal?.setTitle) {
            editorPortal.setTitle(activeTextEditorFilePath ? getTextFileName(activeTextEditorFilePath) : "Text");
        }
    };
    const rememberTextSelection = () => {
        const selection = window.getSelection();
        if (!isSelectionInsideTextEditor(selection)) return;
        savedTextSelectionRange = selection.getRangeAt(0).cloneRange();
    };
    const restoreTextSelection = () => {
        const selection = window.getSelection();
        const editorNode = findTextEditorNode();
        if (!editorNode) return false;
        if (savedTextSelectionRange
            && editorNode.contains(savedTextSelectionRange.commonAncestorContainer)
            && !savedTextSelectionRange.commonAncestorContainer?.closest?.(".editor-text-image-frame, .editor-text-shape-frame")) {
            selection.removeAllRanges();
            selection.addRange(savedTextSelectionRange.cloneRange());
            return true;
        }
        const range = document.createRange();
        range.selectNodeContents(editorNode);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        savedTextSelectionRange = range.cloneRange();
        return true;
    };
    const getTextCaretRect = (range) => {
        if (!range) return null;
        const rect = range.getBoundingClientRect();
        if (rect && (rect.width || rect.height)) return rect;
        const markerNode = document.createElement("span");
        markerNode.style.display = "inline-block";
        markerNode.style.width = "1px";
        markerNode.style.height = "1em";
        markerNode.style.lineHeight = "1em";
        markerNode.style.pointerEvents = "none";
        markerNode.style.opacity = "0";
        const markerRange = range.cloneRange();
        markerRange.insertNode(markerNode);
        const markerRect = markerNode.getBoundingClientRect();
        markerNode.remove();
        markerRange.detach?.();
        return markerRect;
    };
    const scrollTextEditorCaretIntoView = (portal = findTextPortal(), range = savedTextSelectionRange) => {
        const editorNode = findTextEditorNode(portal);
        const scrollContainer = portal?.body?.() || editorNode?.closest?.(".window-body");
        if (!editorNode || !scrollContainer || typeof scrollContainer.scrollTo !== "function") return false;
        const caretRect = getTextCaretRect(range);
        if (!caretRect) return false;
        const containerRect = scrollContainer.getBoundingClientRect();
        const verticalPadding = 28;
        const horizontalPadding = 28;
        let nextTop = scrollContainer.scrollTop;
        let nextLeft = scrollContainer.scrollLeft;
        if (caretRect.bottom > containerRect.bottom - verticalPadding) {
            nextTop += caretRect.bottom - containerRect.bottom + verticalPadding;
        } else if (caretRect.top < containerRect.top + verticalPadding) {
            nextTop -= containerRect.top + verticalPadding - caretRect.top;
        }
        if (caretRect.right > containerRect.right - horizontalPadding) {
            nextLeft += caretRect.right - containerRect.right + horizontalPadding;
        } else if (caretRect.left < containerRect.left + horizontalPadding) {
            nextLeft -= containerRect.left + horizontalPadding - caretRect.left;
        }
        const maxTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
        const maxLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
        nextTop = Math.max(0, Math.min(nextTop, maxTop));
        nextLeft = Math.max(0, Math.min(nextLeft, maxLeft));
        if (nextTop === scrollContainer.scrollTop && nextLeft === scrollContainer.scrollLeft) return true;
        scrollContainer.scrollTo({top: nextTop, left: nextLeft, behavior: "smooth"});
        return true;
    };
    const focusTextEditorAtEnd = (portal = findTextPortal()) => {
        const editorNode = findTextEditorNode(portal);
        if (!editorNode) return false;
        editorNode.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editorNode);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        savedTextSelectionRange = range.cloneRange();
        updateTextToolbarState();
        requestAnimationFrame(() => scrollTextEditorCaretIntoView(portal, savedTextSelectionRange));
        return true;
    };
    const getActiveTextSelectionRange = () => {
        const editorNode = findTextEditorNode();
        const selection = window.getSelection();
        if (!editorNode || !selection?.rangeCount || !isSelectionInsideTextEditor(selection)) return null;
        const range = selection.getRangeAt(0);
        if (range.collapsed) return null;
        return range;
    };
    const hasHighlightedTextSelection = () => !!getActiveTextSelectionRange()?.toString?.().trim();
    const getTextSelectionPlainText = () => String(getActiveTextSelectionRange()?.toString?.() || "");
    const normalizeHyperlinkUrl = (rawUrl = "") => {
        const trimmedUrl = String(rawUrl || "").trim();
        if (!trimmedUrl) return "";
        if (/^(https?:|mailto:|tel:)/i.test(trimmedUrl)) return trimmedUrl;
        if (/^[#/]/.test(trimmedUrl)) return trimmedUrl;
        return `https://${trimmedUrl}`;
    };
    const prepareEditorLinkNode = (linkNode) => {
        if (!linkNode) return;
        linkNode.target = "_blank";
        linkNode.rel = "noopener noreferrer";
    };
    const prepareEditorLinks = (rootNode = findTextEditorNode()) => {
        if (!rootNode?.querySelectorAll) return;
        rootNode.querySelectorAll("a[href]").forEach(prepareEditorLinkNode);
    };
    const applyTextEditorHyperlink = (labelText = "", rawUrl = "") => {
        const textArea = findTextEditorNode();
        const url = normalizeHyperlinkUrl(rawUrl);
        const text = String(labelText || "").trim();
        if (!textArea || !isRichTextDocument() || !url || !text) return false;
        restoreTextSelection();
        const selection = window.getSelection();
        if (!selection?.rangeCount) return false;
        const range = selection.getRangeAt(0);
        if (!textArea.contains(range.commonAncestorContainer)) return false;
        const linkNode = document.createElement("a");
        linkNode.href = url;
        linkNode.textContent = text;
        prepareEditorLinkNode(linkNode);
        range.deleteContents();
        range.insertNode(linkNode);
        range.setStartAfter(linkNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        savedTextSelectionRange = range.cloneRange();
        syncTextEditorStateFromDom();
        return true;
    };
    const showTextEditorHyperlinkDialogue = ({allowEmptyText = false} = {}) => {
        if (!isRichTextDocument()) return false;
        restoreTextSelection();
        const selectedText = getTextSelectionPlainText().trim();
        if (!selectedText && !allowEmptyText) return false;
        rememberTextSelection();
        inputDialogue({
            title: "Hyperlink",
            titleholder: "Text",
            title_entry: true,
            title_value: selectedText,
            placeholder: "Link",
            confirmation: (textValue, linkValue) => {
                if (!applyTextEditorHyperlink(textValue, linkValue)) modular.error("Enter text and a link");
            }
        });
        return true;
    };
    const getTextSelectionOffsets = (rootNode = findTextEditorNode()) => {
        if (!(rootNode instanceof HTMLElement)) return null;
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return null;
        const range = selection.getRangeAt(0);
        if (!rootNode.contains(range.startContainer) || !rootNode.contains(range.endContainer)) return null;
        const startRange = range.cloneRange();
        startRange.selectNodeContents(rootNode);
        startRange.setEnd(range.startContainer, range.startOffset);
        const endRange = range.cloneRange();
        endRange.selectNodeContents(rootNode);
        endRange.setEnd(range.endContainer, range.endOffset);
        return {start: startRange.toString().length, end: endRange.toString().length};
    };
    const getDuplicateTextLineDownEdit = (value = "", selectionStart = 0, selectionEnd = selectionStart) => {
        const content = String(value ?? "");
        const start = Math.max(0, Math.min(Number(selectionStart) || 0, content.length));
        const end = Math.max(start, Math.min(Number(selectionEnd) || start, content.length));
        const effectiveEnd = end > start && content[end - 1] === "\n" ? end - 1 : end;
        const lineStart = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
        const lineEndIndex = content.indexOf("\n", effectiveEnd);
        const lineEnd = lineEndIndex >= 0 ? lineEndIndex : content.length;
        const duplicatedText = content.slice(lineStart, lineEnd);
        const insertion = `\n${duplicatedText}`;
        const duplicateStart = lineEnd + 1;
        const duplicateEnd = duplicateStart + duplicatedText.length;
        const nextValue = `${content.slice(0, lineEnd)}${insertion}${content.slice(lineEnd)}`;
        if (start !== end) return {value: nextValue, selectionStart: duplicateStart, selectionEnd: duplicateEnd};
        const caretColumn = start - lineStart;
        const caretOffset = duplicateStart + Math.min(caretColumn, duplicatedText.length);
        return {value: nextValue, selectionStart: caretOffset, selectionEnd: caretOffset};
    };
    const resolveTextSelectionPoint = (rootNode, targetOffset = 0) => {
        const safeOffset = Math.max(0, Number(targetOffset) || 0);
        const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, {
            acceptNode: (node) => {
                if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
                if (node.nodeType === Node.ELEMENT_NODE && String(node.tagName || "").toUpperCase() === "BR") return NodeFilter.FILTER_ACCEPT;
                return NodeFilter.FILTER_SKIP;
            }
        });
        let traversed = 0;
        let currentNode = walker.nextNode();
        while (currentNode) {
            if (currentNode.nodeType === Node.TEXT_NODE) {
                const length = currentNode.textContent?.length || 0;
                if (safeOffset <= traversed + length) return {node: currentNode, offset: safeOffset - traversed};
                traversed += length;
            } else {
                if (safeOffset <= traversed + 1) {
                    const parentNode = currentNode.parentNode || rootNode;
                    const childIndex = Array.from(parentNode.childNodes).indexOf(currentNode);
                    return {node: parentNode, offset: childIndex + (safeOffset > traversed ? 1 : 0)};
                }
                traversed += 1;
            }
            currentNode = walker.nextNode();
        }
        return {node: rootNode, offset: rootNode.childNodes.length};
    };
    const restoreTextEditorSelectionOffsets = (rootNode, start = 0, end = start) => {
        const selection = window.getSelection();
        if (!selection || !(rootNode instanceof HTMLElement)) return false;
        const startPoint = resolveTextSelectionPoint(rootNode, start);
        const endPoint = resolveTextSelectionPoint(rootNode, end);
        const range = document.createRange();
        range.setStart(startPoint.node, startPoint.offset);
        range.setEnd(endPoint.node, endPoint.offset);
        selection.removeAllRanges();
        selection.addRange(range);
        savedTextSelectionRange = range.cloneRange();
        return true;
    };
    const buildTextEditorSearchIndex = (rootNode = findTextEditorNode()) => {
        if (!(rootNode instanceof HTMLElement)) return "";
        const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, {
            acceptNode: (node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.classList?.contains("editor-text-page-break-spacer")
                        || node.classList?.contains("editor-text-search-marker")
                        || node.classList?.contains("editor-text-image-handle")
                        || node.classList?.contains("editor-text-table-resize-handle")) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return String(node.tagName || "").toUpperCase() === "BR"
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_SKIP;
                }
                if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
                return NodeFilter.FILTER_SKIP;
            }
        });
        let indexedText = "";
        let currentNode = walker.nextNode();
        while (currentNode) {
            indexedText += currentNode.nodeType === Node.TEXT_NODE ? (currentNode.textContent || "") : "\n";
            currentNode = walker.nextNode();
        }
        return indexedText;
    };
    const createTextEditorSearchMatches = (query = "", portal = findTextPortal()) => {
        const textArea = findTextEditorNode(portal);
        const needle = String(query || "").trim();
        if (!textArea || !needle) return [];
        const documentText = buildTextEditorSearchIndex(textArea);
        const haystack = documentText.toLowerCase();
        const lowerNeedle = needle.toLowerCase();
        const matches = [];
        let index = haystack.indexOf(lowerNeedle);
        while (index >= 0 && matches.length < 50) {
            const before = documentText.slice(Math.max(0, index - 28), index).replace(/\s+/g, " ").trim();
            const matchText = documentText.slice(index, index + needle.length).replace(/\s+/g, " ");
            const after = documentText.slice(index + needle.length, index + needle.length + 36).replace(/\s+/g, " ").trim();
            matches.push({
                index,
                length: needle.length,
                label: `${matches.length + 1}. ${matchText}`,
                detail: `${before ? `${before} ` : ""}${matchText}${after ? ` ${after}` : ""}`.trim()
            });
            index = haystack.indexOf(lowerNeedle, index + Math.max(needle.length, 1));
        }
        return matches;
    };
    const scrollToTextEditorSearchMatch = (match = null, portal = findTextPortal()) => {
        const textArea = findTextEditorNode(portal);
        if (!textArea || !match || !Number.isFinite(match.index)) return false;
        const start = match.index;
        const end = start + (match.length || 0);
        textArea.focus();
        if (!restoreTextEditorSelectionOffsets(textArea, start, end)) return false;
        const selection = window.getSelection();
        if (!selection?.rangeCount) return false;
        const markerRange = selection.getRangeAt(0).cloneRange();
        markerRange.collapse(true);
        const markerNode = document.createElement("span");
        markerNode.className = "editor-text-search-marker";
        markerNode.contentEditable = "false";
        markerNode.setAttribute("aria-hidden", "true");
        markerRange.insertNode(markerNode);
        markerNode.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});
        window.setTimeout(() => {
            markerNode.remove();
            restoreTextEditorSelectionOffsets(textArea, start, end);
        }, 700);
        return true;
    };
    const showTextEditorSearchDialogue = (portal = findTextPortal(), anchorNode = null) => {
        const textArea = findTextEditorNode(portal);
        if (!textArea) return false;
        const selectedText = getTextSelectionPlainText().trim();
        const initialValue = selectedText && !selectedText.includes("\n") ? selectedText : "";
        if (typeof searchDialogue === "function") {
            searchDialogue({
                title: "Search",
                placeholder: "Find text",
                value: initialValue,
                confirmText: "Search",
                anchor: anchorNode,
                matches: (query) => createTextEditorSearchMatches(query, portal),
                preview: (_, match) => scrollToTextEditorSearchMatch(match, portal),
                confirmation: (query, match, matches) => {
                    const selectedMatch = match || matches?.[0] || createTextEditorSearchMatches(query, portal)[0];
                    if (!scrollToTextEditorSearchMatch(selectedMatch, portal)) modular.error("No matches found");
                }
            });
            return true;
        }
        inputDialogue({
            title: "Search",
            placeholder: "Find text",
            value: initialValue,
            confirmation: (_, query) => {
                const match = createTextEditorSearchMatches(query, portal)[0];
                if (!scrollToTextEditorSearchMatch(match, portal)) modular.error("No matches found");
            }
        });
        return true;
    };
    const findTextLineNode = (node, rootNode = findTextEditorNode()) => {
        if (!node || !rootNode) return null;
        let current = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
        while (current && current !== rootNode) {
            if (current.nodeType === Node.ELEMENT_NODE && current.tagName === "LI") return current;
            if (current.parentNode === rootNode) return current;
            current = current.parentNode;
        }
        return rootNode.firstChild || null;
    };
    const placeCaretInTextNode = (targetNode, atEnd = false) => {
        if (!targetNode) return false;
        const selection = window.getSelection();
        const range = document.createRange();
        if (targetNode.nodeType === Node.TEXT_NODE) {
            range.setStart(targetNode, atEnd ? targetNode.textContent.length : 0);
        } else {
            range.selectNodeContents(targetNode);
            range.collapse(!atEnd);
        }
        range.collapse(!atEnd);
        selection.removeAllRanges();
        selection.addRange(range);
        savedTextSelectionRange = range.cloneRange();
        return true;
    };
    const duplicateRichTextLineDown = (textArea = findTextEditorNode()) => {
        const selection = window.getSelection();
        if (!textArea || !selection?.rangeCount || !isSelectionInsideTextEditor(selection)) return false;
        const range = selection.getRangeAt(0);
        let nodesToDuplicate = [];
        if (range.collapsed) {
            nodesToDuplicate = [findTextLineNode(range.startContainer, textArea)].filter(Boolean);
        } else {
            nodesToDuplicate = Array.from(textArea.childNodes || [])
                .filter((node) => !isTextPageBreakSpacer(node) && range.intersectsNode(node));
            if (!nodesToDuplicate.length) nodesToDuplicate = [findTextLineNode(range.startContainer, textArea)].filter(Boolean);
        }
        if (!nodesToDuplicate.length) {
            const paragraphNode = createTextEditorParagraphBreak();
            textArea.appendChild(paragraphNode);
            placeCaretInTextNode(paragraphNode);
            return true;
        }
        const duplicates = nodesToDuplicate.map((node) => node.cloneNode(true));
        const needsLeadingBreak = nodesToDuplicate.some((node) => {
            if (node.nodeType === Node.TEXT_NODE) return true;
            return node.nodeType === Node.ELEMENT_NODE && !["DIV", "P", "LI", "UL", "OL", "TABLE", "BLOCKQUOTE"].includes(node.tagName);
        });
        const insertedNodes = needsLeadingBreak ? [document.createElement("br"), ...duplicates] : duplicates;
        nodesToDuplicate[nodesToDuplicate.length - 1].after(...insertedNodes);
        if (range.collapsed) placeCaretInTextNode(duplicates[0]);
        else {
            const duplicateRange = document.createRange();
            duplicateRange.setStartBefore(duplicates[0]);
            duplicateRange.setEndAfter(duplicates[duplicates.length - 1]);
            selection.removeAllRanges();
            selection.addRange(duplicateRange);
            savedTextSelectionRange = duplicateRange.cloneRange();
        }
        return true;
    };
    const duplicateTextEditorLineDown = (textArea = findTextEditorNode()) => {
        if (!textArea) return false;
        textArea.focus();
        restoreTextSelection();
        if (isRichTextDocument()) return duplicateRichTextLineDown(textArea);
        const selectionOffsets = getTextSelectionOffsets(textArea) || {start: 0, end: 0};
        const edit = getDuplicateTextLineDownEdit(textArea.innerText || textArea.textContent || "", selectionOffsets.start, selectionOffsets.end);
        textArea.textContent = edit.value;
        restoreTextEditorSelectionOffsets(textArea, edit.selectionStart, edit.selectionEnd);
        return true;
    };
    const getTextTableCellAtSelection = () => {
        const selection = window.getSelection();
        const editorNode = findTextEditorNode();
        if (!editorNode || !selection?.rangeCount || !isSelectionInsideTextEditor(selection)) return null;
        const range = selection.getRangeAt(0);
        if (!range.collapsed) return null;
        const node = range.startContainer?.nodeType === Node.TEXT_NODE
            ? range.startContainer.parentElement
            : range.startContainer;
        const cellNode = node?.closest?.("th, td") || null;
        return cellNode && editorNode.contains(cellNode) ? cellNode : null;
    };
    const isTextTableCellCaretAtEnd = (cellNode) => {
        const selection = window.getSelection();
        if (!cellNode || !selection?.rangeCount) return false;
        const range = selection.getRangeAt(0);
        if (!range.collapsed) return false;
        const afterRange = document.createRange();
        afterRange.selectNodeContents(cellNode);
        try {
            afterRange.setStart(range.endContainer, range.endOffset);
        } catch (_) {
            afterRange.detach?.();
            return false;
        }
        const remainingText = String(afterRange.toString() || "").replace(/\u200B/g, "").trim();
        afterRange.detach?.();
        return remainingText.length === 0;
    };
    const getNextTextTableCell = (cellNode) => {
        const rowNode = cellNode?.parentElement;
        const tableNode = cellNode?.closest?.("table");
        if (!rowNode || !tableNode) return null;
        const columnIndex = Array.from(rowNode.cells).indexOf(cellNode);
        if (columnIndex < rowNode.cells.length - 1) return rowNode.cells[columnIndex + 1];
        const nextRow = rowNode.nextElementSibling;
        if (nextRow?.cells?.length) return nextRow.cells[0];
        const columnCount = Math.max(1, rowNode.cells.length || tableNode.rows[0]?.cells?.length || 1);
        const newRow = document.createElement("tr");
        Array.from({length: columnCount}).forEach(() => newRow.appendChild(createTextTableCell()));
        rowNode.after(newRow);
        return newRow.cells[0] || null;
    };
    const moveTextTableCaretToNextCell = () => {
        const cellNode = getTextTableCellAtSelection();
        if (!cellNode || !isTextTableCellCaretAtEnd(cellNode)) return false;
        const nextCell = getNextTextTableCell(cellNode);
        if (!nextCell) return false;
        placeCaretAtStart(nextCell);
        return true;
    };
    const insertTextEditorTab = (textArea = findTextEditorNode()) => {
        if (!textArea) return false;
        textArea.focus();
        restoreTextSelection();
        if (moveTextTableCaretToNextCell()) return true;
        if (document.execCommand("insertText", false, "\t")) return true;
        const selection = window.getSelection();
        if (!selection?.rangeCount || !isSelectionInsideTextEditor(selection)) return false;
        const range = selection.getRangeAt(0);
        const tabNode = document.createTextNode("\t");
        range.deleteContents();
        range.insertNode(tabNode);
        range.setStartAfter(tabNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        savedTextSelectionRange = range.cloneRange();
        return true;
    };
    const resolveTextColor = (rawColor = "") => {
        const colorValue = String(rawColor || "").trim();
        if (!colorValue || colorValue === "transparent") return "";
        if (resolvedTextColorCache.has(colorValue)) return resolvedTextColorCache.get(colorValue);
        const probe = document.createElement("div");
        probe.style.color = colorValue;
        probe.style.position = "absolute";
        probe.style.opacity = "0";
        probe.style.pointerEvents = "none";
        document.body.appendChild(probe);
        const resolvedColor = getComputedStyle(probe).color || colorValue;
        probe.remove();
        resolvedTextColorCache.set(colorValue, resolvedColor);
        return resolvedColor;
    };
    const getTextToolbarContrastColor = (rawColor = "") => {
        const resolvedColor = resolveTextColor(rawColor);
        const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(resolvedColor);
        if (!match) return "";
        const red = Number(match[1]);
        const green = Number(match[2]);
        const blue = Number(match[3]);
        const brightness = ((red * 299) + (green * 587) + (blue * 114)) / 1000;
        return brightness < 140 ? "#ffffff" : "#111111";
    };
    const setTextToolbarButtonState = (buttonNode, isActive = false) => {
        if (!buttonNode) return;
        buttonNode.className = `${isActive ? "tiny primary" : ""} naked align-bottom small-margin-right inner-radius`.trim();
    };
    const syncTextToolbarIconColor = (buttonNode) => {
        if (!buttonNode) return;
        buttonNode.querySelectorAll("svg path").forEach((pathNode) => {
            if (!pathNode.hasAttribute("stroke")) pathNode.setAttribute("fill", "currentColor");
        });
    };
    const getTextSelectionStyleTarget = () => {
        const editorNode = findTextEditorNode();
        const selection = window.getSelection();
        if (!editorNode || !isSelectionInsideTextEditor(selection) || !selection.rangeCount) return editorNode;
        const selectedCells = getSelectedTextTableCells();
        if (selectedCells.length) return selectedCells[0];
        let node = selection.getRangeAt(0).startContainer;
        if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
        return node?.nodeType === Node.ELEMENT_NODE ? node : editorNode;
    };
    const rangeContainsNodeContents = (range, node) => {
        if (!range || !node) return false;
        const nodeRange = document.createRange();
        nodeRange.selectNodeContents(node);
        const containsStart = range.compareBoundaryPoints(Range.START_TO_START, nodeRange) <= 0;
        const containsEnd = range.compareBoundaryPoints(Range.END_TO_END, nodeRange) >= 0;
        nodeRange.detach?.();
        return containsStart && containsEnd;
    };
    const getSelectedTextTableCells = () => {
        const editorNode = findTextEditorNode();
        const selection = window.getSelection();
        if (!editorNode || !selection?.rangeCount || !isSelectionInsideTextEditor(selection)) return [];
        const range = selection.getRangeAt(0);
        if (range.collapsed) return [];
        return Array.from(editorNode.querySelectorAll("th, td")).filter((cellNode) => {
            if (!range.intersectsNode(cellNode)) return false;
            const startCell = range.startContainer?.nodeType === Node.TEXT_NODE
                ? range.startContainer.parentElement?.closest?.("th, td")
                : range.startContainer?.closest?.("th, td");
            const endCell = range.endContainer?.nodeType === Node.TEXT_NODE
                ? range.endContainer.parentElement?.closest?.("th, td")
                : range.endContainer?.closest?.("th, td");
            if (startCell === cellNode && endCell === cellNode) {
                const selectedText = String(range.toString() || "").replace(/\s+/g, " ").trim();
                const cellText = String(cellNode.innerText || cellNode.textContent || "").replace(/\s+/g, " ").trim();
                if (selectedText && selectedText === cellText) return true;
            }
            return rangeContainsNodeContents(range, cellNode);
        });
    };
    const getLegacyTextFontSizeCssValue = (legacyValue = "") => {
        const legacySize = Number(legacyValue) || 3;
        if (legacySize <= 1) return "8px";
        if (legacySize === 2) return "10px";
        if (legacySize === 3) return "12px";
        if (legacySize === 4) return "16px";
        if (legacySize === 5) return "22px";
        if (legacySize === 6) return "36px";
        return "48px";
    };
    const applyTextTableCellStyleCommand = (command, value = null) => {
        const selectedCells = getSelectedTextTableCells();
        if (!selectedCells.length) return false;
        selectedCells.forEach((cellNode) => {
            const style = getComputedStyle(cellNode);
            const fontWeightValue = Number(style.fontWeight);
            const isBold = style.fontWeight === "bold" || Number.isFinite(fontWeightValue) && fontWeightValue >= 600;
            const textDecorationLine = String(style.textDecorationLine || style.textDecoration || "");
            if (command === "bold") cellNode.style.fontWeight = isBold ? "normal" : "700";
            else if (command === "italic") cellNode.style.fontStyle = style.fontStyle === "italic" || style.fontStyle === "oblique" ? "normal" : "italic";
            else if (command === "underline") cellNode.style.textDecoration = textDecorationLine.includes("underline") ? "none" : "underline";
            else if (command === "fontName") cellNode.style.fontFamily = value || "";
            else if (command === "fontSize") cellNode.style.fontSize = getLegacyTextFontSizeCssValue(value);
            else if (command === "fontSizePx") cellNode.style.fontSize = `${normalizeTextFontSizeInput(value)}px`;
            else if (command === "foreColor") cellNode.style.color = !value || value === "inherit" ? "" : value;
            else if (command === "hiliteColor" || command === "backColor") cellNode.style.backgroundColor = !value || value === "transparent" ? "" : value;
            else if (command === "justifyLeft") cellNode.style.textAlign = "left";
            else if (command === "justifyCenter") cellNode.style.textAlign = "center";
            else if (command === "justifyRight") cellNode.style.textAlign = "right";
        });
        return true;
    };
    const getTextSelectionBlockTarget = (node) => {
        const editorNode = findTextEditorNode();
        let current = node;
        while (current && current !== editorNode) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                const display = getComputedStyle(current).display;
                if (["TD", "TH"].includes(current.tagName)) return current;
                if (display === "block" || display === "list-item" || current.tagName === "DIV" || current.tagName === "P") return current;
            }
            current = current.parentElement;
        }
        return editorNode;
    };
    const getTextSelectionListTarget = (node = getTextSelectionStyleTarget()) => {
        const editorNode = findTextEditorNode();
        let current = node;
        while (current && current !== editorNode) {
            if (current.nodeType === Node.ELEMENT_NODE && ["UL", "OL"].includes(current.tagName)) return current;
            current = current.parentElement;
        }
        return null;
    };
    const getTextSelectionListItem = (node = getTextSelectionStyleTarget()) => {
        const editorNode = findTextEditorNode();
        let current = node;
        while (current && current !== editorNode) {
            if (current.nodeType === Node.ELEMENT_NODE && current.tagName === "LI") return current;
            current = current.parentElement;
        }
        return null;
    };
    const placeCaretAtStart = (targetNode) => {
        if (!targetNode) return;
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(targetNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        savedTextSelectionRange = range.cloneRange();
    };
    const createTextEditorParagraphBreak = () => {
        const paragraphNode = document.createElement("div");
        paragraphNode.appendChild(document.createElement("br"));
        return paragraphNode;
    };
    const applyTextListStyle = (listTagName = "UL", listStyleType = "") => {
        const textArea = findTextEditorNode();
        if (!textArea || shouldHideTextEditorBar(activeTextEditorFilePath)) return false;
        const normalizedTagName = String(listTagName || "UL").toUpperCase() === "OL" ? "OL" : "UL";
        const targetCommand = normalizedTagName === "OL" ? "insertOrderedList" : "insertUnorderedList";
        restoreTextSelection();
        textArea.focus();
        document.execCommand("styleWithCSS", false, true);
        const activeList = getTextSelectionListTarget();
        if (!activeList || activeList.tagName !== normalizedTagName) {
            document.execCommand(targetCommand, false, null);
        }
        const nextList = getTextSelectionListTarget() || activeList;
        if (nextList) {
            nextList.style.listStyleType = listStyleType || "";
            if (normalizedTagName === "OL") {
                nextList.type = "";
            }
        }
        rememberTextSelection();
        syncTextEditorStateFromDom();
        return true;
    };
    const exitTextListItem = (listItemNode) => {
        const textArea = findTextEditorNode();
        const parentList = listItemNode?.parentElement;
        if (!textArea || !listItemNode || !parentList || !["UL", "OL"].includes(parentList.tagName)) return false;
        const nextSiblings = [];
        let siblingNode = listItemNode.nextElementSibling;
        while (siblingNode) {
            nextSiblings.push(siblingNode);
            siblingNode = siblingNode.nextElementSibling;
        }
        const nextList = nextSiblings.length ? document.createElement(parentList.tagName) : null;
        if (nextList) {
            nextList.style.cssText = parentList.style.cssText;
            if (parentList.getAttribute("type")) nextList.setAttribute("type", parentList.getAttribute("type"));
            nextSiblings.forEach((childNode) => nextList.appendChild(childNode));
        }
        const paragraphNode = createTextEditorParagraphBreak();
        parentList.parentNode.insertBefore(paragraphNode, parentList.nextSibling);
        if (nextList) paragraphNode.parentNode.insertBefore(nextList, paragraphNode.nextSibling);
        listItemNode.remove();
        if (!parentList.children.length) parentList.remove();
        placeCaretAtStart(paragraphNode);
        syncTextEditorStateFromDom();
        return true;
    };
    const handleTextEditorEnterKey = (event) => {
        if (event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
        const listItemNode = getTextSelectionListItem();
        if (!listItemNode) return;
        const itemText = String(listItemNode.textContent || "").replace(/\u200B/g, "").trim();
        const itemHasMedia = !!listItemNode.querySelector("img, table, ul, ol");
        if (itemText || itemHasMedia) return;
        event.preventDefault();
        exitTextListItem(listItemNode);
    };
    const mapComputedFontSizeToToolbarValue = (rawFontSize = "") => {
        const numericValue = Number(String(rawFontSize || "").replace(/px$/i, ""));
        if (!Number.isFinite(numericValue)) return "12";
        return `${Math.round(numericValue * 10) / 10}`.replace(/\.0$/, "");
    };
    const normalizeTextFontSizeInput = (rawFontSize = "") => {
        const numericValue = Number(String(rawFontSize || "").replace(/px$/i, "").trim());
        if (!Number.isFinite(numericValue)) return "";
        const boundedValue = Math.max(1, Math.min(400, numericValue));
        return `${Math.round(boundedValue * 10) / 10}`.replace(/\.0$/, "");
    };
    const getLegacyTextFontSizeValue = (rawFontSize = "") => {
        const numericValue = Number(String(rawFontSize || "").replace(/px$/i, ""));
        if (!Number.isFinite(numericValue)) return "3";
        if (numericValue <= 9) return "1";
        if (numericValue <= 11) return "2";
        if (numericValue <= 13) return "3";
        if (numericValue <= 18) return "4";
        if (numericValue <= 24) return "5";
        if (numericValue <= 36) return "6";
        return "7";
    };
    const normalizeFontFamilyForToolbar = (fontFamily = "") => {
        const primaryFont = String(fontFamily || "").split(",")[0].replace(/^["']|["']$/g, "").trim();
        return TEXT_FONT_FAMILIES.includes(primaryFont) ? primaryFont : (primaryFont || "Inter");
    };
    const updateTextToolbarState = () => {
        const editorNode = findTextEditorNode();
        const fontFamilySelect = document.getElementById("editor-sheet-font-family");
        const fontSizeSelect = document.getElementById("editor-sheet-font-size");
        const boldButton = document.getElementById("editor-sheet-style-bold");
        const italicButton = document.getElementById("editor-sheet-style-italic");
        const underlineButton = document.getElementById("editor-sheet-style-underline");
        const linkButton = document.getElementById("editor-sheet-style-link");
        const textColorButton = document.getElementById("editor-sheet-style-color");
        const backgroundColorButton = document.getElementById("editor-sheet-style-background");
        const alignmentButton = document.getElementById("editor-sheet-style-align");
        const highlightButton = document.getElementById("editor-sheet-style-highlight");
        const listButton = document.getElementById("editor-sheet-style-list");
        if (!editorNode || shouldHideTextEditorBar(activeTextEditorFilePath)) return;
        const styleTarget = getTextSelectionStyleTarget();
        const style = getComputedStyle(styleTarget || editorNode);
        const blockStyle = getComputedStyle(getTextSelectionBlockTarget(styleTarget));
        const activeList = getTextSelectionListTarget(styleTarget);
        const activeLink = styleTarget?.closest?.("a[href]");
        const fontWeightValue = Number(style.fontWeight);
        const isBold = style.fontWeight === "bold" || Number.isFinite(fontWeightValue) && fontWeightValue >= 600;
        const textDecorationLine = String(style.textDecorationLine || style.textDecoration || "");
        const textColor = style.color && style.color !== "rgba(0, 0, 0, 0)" ? style.color : "";
        const backgroundColor = style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)" ? style.backgroundColor : "";
        const alignment = ["center", "right"].includes(blockStyle.textAlign) ? blockStyle.textAlign : "left";
        if (fontFamilySelect) window.StandardUI?.setSearchComboBoxValue?.(fontFamilySelect, normalizeFontFamilyForToolbar(style.fontFamily));
        if (fontSizeSelect) window.StandardUI?.setSearchComboBoxValue?.(fontSizeSelect, mapComputedFontSizeToToolbarValue(style.fontSize));
        setTextToolbarButtonState(boldButton, isBold);
        setTextToolbarButtonState(italicButton, style.fontStyle === "italic" || style.fontStyle === "oblique");
        setTextToolbarButtonState(underlineButton, textDecorationLine.includes("underline"));
        setTextToolbarButtonState(linkButton, !!activeLink);
        syncTextToolbarIconColor(boldButton);
        syncTextToolbarIconColor(italicButton);
        syncTextToolbarIconColor(underlineButton);
        syncTextToolbarIconColor(linkButton);
        if (textColorButton) {
            textColorButton.className = `${textColor ? "tiny primary" : ""} naked align-bottom small-margin-right inner-radius`.trim();
            textColorButton.style.color = textColor || "";
            textColorButton.style.backgroundColor = "";
            textColorButton.style.borderColor = "";
            syncTextToolbarIconColor(textColorButton);
        }
        if (backgroundColorButton) {
            backgroundColorButton.className = `${backgroundColor ? "tiny primary" : ""} naked align-bottom small-margin-right inner-radius`.trim();
            backgroundColorButton.style.backgroundColor = backgroundColor || "";
            backgroundColorButton.style.color = backgroundColor ? getTextToolbarContrastColor(backgroundColor) : "";
            backgroundColorButton.style.borderColor = backgroundColor || "";
            syncTextToolbarIconColor(backgroundColorButton);
        }
        if (alignmentButton) {
            alignmentButton.innerHTML = TEXT_ALIGN_ICONS[alignment] || TEXT_ALIGN_ICONS.left;
            alignmentButton.className = `${alignment !== "left" ? "tiny primary" : ""} naked align-bottom small-margin-right inner-radius`.trim();
        }
        if (highlightButton) {
            const highlightResolved = resolveTextColor(backgroundColor);
            const isHighlighted = !!highlightResolved && highlightResolved === resolveTextColor(TEXT_HIGHLIGHT_COLOR);
            highlightButton.className = `${isHighlighted ? "tiny primary" : ""} naked align-bottom small-margin-right inner-radius`.trim();
            highlightButton.style.backgroundColor = isHighlighted ? highlightResolved : "";
            highlightButton.style.color = isHighlighted ? getTextToolbarContrastColor(TEXT_HIGHLIGHT_COLOR) : "";
            highlightButton.style.borderColor = isHighlighted ? highlightResolved : "";
            syncTextToolbarIconColor(highlightButton);
        }
        if (listButton) {
            setTextToolbarButtonState(listButton, !!activeList);
            syncTextToolbarIconColor(listButton);
        }
    };
    const runTextEditorStateSync = (portal = findTextPortal()) => {
        restoreEditorWindowState(portal);
        activeTextEditorContent = readTextEditorContent(findTextEditorNode(portal));
        if (activeTextPageViewEnabled) applyTextEditorPageView(true, findTextEditorNode(portal), portal);
        syncEditorWindowState(portal);
        updateTextToolbarState();
    };
    const syncTextEditorStateFromDom = ({deferHeavyWork = false, portal = findTextPortal()} = {}) => {
        if (!deferHeavyWork) {
            if (textEditorDeferredSyncTimer) {
                window.clearTimeout(textEditorDeferredSyncTimer);
                textEditorDeferredSyncTimer = null;
            }
            runTextEditorStateSync(portal);
            return;
        }
        updateTextToolbarState();
        if (textEditorDeferredSyncTimer) window.clearTimeout(textEditorDeferredSyncTimer);
        textEditorDeferredSyncTimer = window.setTimeout(() => {
            textEditorDeferredSyncTimer = null;
            runTextEditorStateSync(portal);
        }, TEXT_INPUT_SYNC_DEBOUNCE_MS);
    };
    const execTextEditorCommand = (command, value = null) => {
        const textArea = findTextEditorNode();
        if (!textArea || shouldHideTextEditorBar(activeTextEditorFilePath)) return false;
        restoreTextSelection();
        textArea.focus();
        if (applyTextTableCellStyleCommand(command, value)) {
            rememberTextSelection();
            syncTextEditorStateFromDom();
            return true;
        }
        document.execCommand("styleWithCSS", false, true);
        const didApply = value === null
            ? document.execCommand(command, false, null)
            : document.execCommand(command, false, value);
        rememberTextSelection();
        syncTextEditorStateFromDom();
        return didApply;
    };
    const execTextEditorFontSize = (rawFontSize = "12") => {
        const normalizedFontSize = normalizeTextFontSizeInput(rawFontSize);
        const textArea = findTextEditorNode();
        if (!normalizedFontSize || !textArea || shouldHideTextEditorBar(activeTextEditorFilePath)) {
            updateTextToolbarState();
            return false;
        }
        restoreTextSelection();
        textArea.focus();
        if (applyTextTableCellStyleCommand("fontSizePx", normalizedFontSize)) {
            rememberTextSelection();
            syncTextEditorStateFromDom();
            return true;
        }
        textArea.querySelectorAll('font[size="7"]').forEach((node) => {
            node.dataset.editorPreserveFontSize = "1";
        });
        document.execCommand("styleWithCSS", false, false);
        const didApply = document.execCommand("fontSize", false, "7");
        textArea.querySelectorAll('font[size="7"]').forEach((node) => {
            if (node.dataset.editorPreserveFontSize === "1") {
                delete node.dataset.editorPreserveFontSize;
                return;
            }
            node.removeAttribute("size");
            node.style.fontSize = `${normalizedFontSize}px`;
        });
        rememberTextSelection();
        syncTextEditorStateFromDom();
        return didApply;
    };
    const bindTextToolbarButtonFocus = (buttonNode) => {
        if (!buttonNode || buttonNode.dataset.selectionBound === "1") return;
        buttonNode.dataset.selectionBound = "1";
        buttonNode.addEventListener("mousedown", (event) => {
            event.preventDefault();
            rememberTextSelection();
        });
    };
    const renderTextEditorPageBackdrop = (pageCount = 1, stageNode = findTextEditorStage(), backdropNode = findTextEditorPageBackdrop()) => {
        if (!stageNode || !backdropNode) return false;
        const totalPages = Math.max(1, Number(pageCount) || 1);
        const renderedPageCount = Number(backdropNode.dataset.renderedPageCount || 0);
        if (renderedPageCount !== totalPages) {
            backdropNode.innerHTML = Array.from({length: totalPages}, (_, index) => {
                return `<div class="editor-text-page-card" data-page-number="${index + 1}" style="height:${TEXT_PAGE_VIEW_HEIGHT_PX}px;"></div>`;
            }).join("");
            backdropNode.dataset.renderedPageCount = String(totalPages);
        }
        stageNode.classList.toggle("editor-text-stage-page-view", activeTextPageViewEnabled);
        return true;
    };
    const ensureTextEditorPageWindowFits = (portal = findTextPortal()) => {
        if (!activeTextPageViewEnabled || !portal || typeof portal.applyWindowState !== "function") return false;
        const windowNode = portal.window?.();
        const bodyNode = portal.body?.();
        if (!(windowNode instanceof HTMLElement) || !(bodyNode instanceof HTMLElement)) return false;
        const windowRect = windowNode.getBoundingClientRect();
        const bodyWidth = bodyNode.clientWidth || bodyNode.getBoundingClientRect().width || 0;
        const missingWidth = Math.ceil(TEXT_PAGE_VIEW_WIDTH_PX - bodyWidth);
        if (missingWidth <= 0) return false;
        const nextWidth = Math.ceil((windowRect.width || windowNode.clientWidth || 0) + missingWidth);
        const nextState = {width: `${nextWidth}px`};
        const currentLeft = Number.parseFloat(windowNode.style.left || `${windowRect.left || 0}`);
        if (Number.isFinite(currentLeft) && nextWidth < window.innerWidth) {
            nextState.left = `${Math.max(10, Math.min(currentLeft, window.innerWidth - nextWidth - 10))}px`;
        } else if (nextWidth >= window.innerWidth) {
            nextState.left = "10px";
        }
        portal.applyWindowState(nextState);
        return true;
    };
    const paginateTextEditorFlow = (textArea = findTextEditorNode()) => {
        if (!textArea) return 1;
        clearTextEditorPageBreakSpacers(textArea);
        if (!activeTextPageViewEnabled) return 1;
        let currentPageHeight = 0;
        let pageCount = 1;
        Array.from(textArea.childNodes).forEach((node) => {
            if (isTextPageBreakSpacer(node)) return;
            const nodeHeight = getTextEditorNodeVisualHeight(node, textArea);
            if (!nodeHeight) return;
            if (currentPageHeight > 0 && currentPageHeight + nodeHeight > TEXT_PAGE_VIEW_CONTENT_HEIGHT_PX) {
                const spacerNode = document.createElement("div");
                spacerNode.className = "editor-text-page-break-spacer";
                spacerNode.contentEditable = "false";
                spacerNode.style.height = `${TEXT_PAGE_VIEW_BREAK_SPACER_PX}px`;
                spacerNode.style.pointerEvents = "none";
                spacerNode.style.userSelect = "none";
                textArea.insertBefore(spacerNode, node);
                currentPageHeight = 0;
                pageCount += 1;
            }
            currentPageHeight += nodeHeight;
        });
        const totalContentHeight = Math.max(0, (textArea.scrollHeight || 0) - (TEXT_PAGE_VIEW_PADDING_PX * 2));
        const pagesFromScrollHeight = totalContentHeight > 0
            ? Math.ceil(totalContentHeight / TEXT_PAGE_VIEW_CONTENT_HEIGHT_PX)
            : 1;
        pageCount = Math.max(pageCount, pagesFromScrollHeight);
        return pageCount;
    };
    const applyTextEditorPageView = (enabled = activeTextPageViewEnabled, textArea = findTextEditorNode(), portal = findTextPortal()) => {
        if (!textArea) return false;
        const stageNode = findTextEditorStage(portal);
        const backdropNode = findTextEditorPageBackdrop(portal);
        const measureNode = findTextEditorPageMeasure(portal);
        const pageViewEnabled = !!enabled;
        const requiredPages = pageViewEnabled ? paginateTextEditorFlow(textArea) : 1;
        const totalPageHeight = requiredPages > 0
            ? (requiredPages * TEXT_PAGE_VIEW_HEIGHT_PX) + ((requiredPages - 1) * TEXT_PAGE_VIEW_GAP_PX)
            : TEXT_PAGE_VIEW_HEIGHT_PX;
        if (!pageViewEnabled) clearTextEditorPageBreakSpacers(textArea);
        renderTextEditorPageBackdrop(requiredPages, stageNode, backdropNode);
        textArea.classList.toggle("editor-text-page-view", pageViewEnabled);
        if (stageNode) {
            stageNode.style.width = pageViewEnabled ? TEXT_PAGE_VIEW_WIDTH : "";
            stageNode.style.maxWidth = pageViewEnabled ? TEXT_PAGE_VIEW_WIDTH : "";
            stageNode.style.minWidth = pageViewEnabled ? TEXT_PAGE_VIEW_WIDTH : "";
            stageNode.style.minHeight = pageViewEnabled ? `${totalPageHeight}px` : "";
            stageNode.style.height = "";
            stageNode.style.margin = pageViewEnabled ? `${TEXT_PAGE_VIEW_GAP} auto calc(${TEXT_PAGE_VIEW_GAP} * 1.5)` : "";
            stageNode.style.position = pageViewEnabled ? "relative" : "";
            stageNode.style.overflow = pageViewEnabled ? "visible" : "";
        }
        if (measureNode) {
            measureNode.style.display = "none";
            measureNode.style.height = "0";
        }
        if (backdropNode) {
            backdropNode.style.display = pageViewEnabled ? "flex" : "none";
            backdropNode.style.minHeight = pageViewEnabled ? `${totalPageHeight}px` : "";
        }
        const bodyNode = portal?.body?.();
        if (bodyNode) bodyNode.style.overflowX = pageViewEnabled ? "auto" : "";
        textArea.style.width = pageViewEnabled ? TEXT_PAGE_VIEW_WIDTH : "";
        textArea.style.maxWidth = pageViewEnabled ? TEXT_PAGE_VIEW_WIDTH : "";
        textArea.style.minWidth = pageViewEnabled ? TEXT_PAGE_VIEW_WIDTH : "";
        textArea.style.minHeight = pageViewEnabled ? `${totalPageHeight}px` : "";
        textArea.style.height = pageViewEnabled ? `${totalPageHeight}px` : "";
        textArea.style.padding = pageViewEnabled ? TEXT_PAGE_VIEW_PADDING : "";
        textArea.style.margin = pageViewEnabled ? "0" : "";
        textArea.style.backgroundColor = pageViewEnabled ? "transparent" : "";
        textArea.style.backgroundImage = "";
        textArea.style.backgroundOrigin = "";
        textArea.style.backgroundClip = "";
        textArea.style.backgroundRepeat = "";
        textArea.style.backgroundSize = "";
        textArea.style.border = "";
        textArea.style.borderRadius = "";
        textArea.style.boxShadow = "";
        textArea.style.color = pageViewEnabled ? "#111827" : "";
        textArea.style.lineHeight = pageViewEnabled ? "1.5" : "";
        textArea.style.boxSizing = "border-box";
        textArea.style.position = pageViewEnabled ? "relative" : "";
        textArea.style.zIndex = pageViewEnabled ? "1" : "";
        textArea.style.top = "";
        textArea.style.left = "";
        textArea.style.right = "";
        textArea.style.overflowY = pageViewEnabled ? "visible" : "";
        if (pageViewEnabled) requestAnimationFrame(() => ensureTextEditorPageWindowFits(portal));
        return true;
    };
    const formatTextEditorStatNumber = (value = 0) => Math.max(0, Number(value) || 0).toLocaleString();
    const getTextEditorStatsText = (textArea = findTextEditorNode()) => {
        if (!textArea) return "";
        const clone = textArea.cloneNode(true);
        clone.querySelectorAll(".editor-text-page-break-spacer, .editor-text-search-marker, .editor-text-image-handle, .editor-text-table-resize-handle").forEach((node) => node.remove());
        clone.querySelectorAll(".editor-text-shape-frame").forEach((node) => node.remove());
        return clone.innerText || clone.textContent || "";
    };
    const getTextEditorPageCount = (portal = findTextPortal()) => {
        const backdropNode = findTextEditorPageBackdrop(portal);
        const renderedPages = Number(backdropNode?.dataset?.renderedPageCount || 0);
        if (renderedPages > 0) return renderedPages;
        return Math.max(1, backdropNode?.querySelectorAll?.(".editor-text-page-card")?.length || 1);
    };
    const renderTextEditorStatsMenuContent = (portal = findTextPortal()) => {
        const statsText = getTextEditorStatsText(findTextEditorNode(portal));
        const trimmedText = statsText.trim();
        const wordCount = trimmedText ? trimmedText.split(/\s+/).filter(Boolean).length : 0;
        const characterCount = statsText.length;
        const pageCount = getTextEditorPageCount(portal);
        return children([
            div({style: "editor-text-menu-stats-label", content: "Document stats"}),
            div({style: "editor-text-menu-stats-grid", content: children([
                div({content: children([`<strong>${formatTextEditorStatNumber(wordCount)}</strong>`, `<span>Words</span>`])}),
                div({content: children([`<strong>${formatTextEditorStatNumber(characterCount)}</strong>`, `<span>Characters</span>`])}),
                div({content: children([`<strong>${formatTextEditorStatNumber(pageCount)}</strong>`, `<span>Pages</span>`])})
            ])})
        ]);
    };
    const toggleTextEditorPageView = (enabled = !activeTextPageViewEnabled, portal = findTextPortal()) => {
        activeTextPageViewEnabled = isPlainTextFilePath(activeTextEditorFilePath) ? false : !!enabled;
        if (activeTextEditorFilePath) persistTextDocumentPageViewPreference(activeTextEditorFilePath, activeTextPageViewEnabled);
        applyTextEditorPageView(activeTextPageViewEnabled, findTextEditorNode(portal), portal);
        syncEditorWindowState(portal);
        updateTextToolbarState();
        return activeTextPageViewEnabled;
    };
    const getTextTableContext = (targetNode) => {
        const editorNode = findTextEditorNode();
        const cellNode = targetNode?.closest?.("th, td") || null;
        const tableNode = cellNode?.closest?.("table") || targetNode?.closest?.("table") || null;
        if (!editorNode || !tableNode || !editorNode.contains(tableNode)) return null;
        const rowNode = cellNode?.parentElement || null;
        const rowIndex = rowNode ? Array.from(tableNode.rows).indexOf(rowNode) : -1;
        const columnIndex = cellNode ? Array.from(rowNode?.cells || []).indexOf(cellNode) : -1;
        return {tableNode, rowNode, cellNode, rowIndex, columnIndex};
    };
    const hasTextTableContext = (_, targetNode) => !!getTextTableContext(targetNode);
    const createTextTableCell = () => {
        const cellNode = document.createElement("td");
        cellNode.className = "editor-text-table-cell";
        cellNode.appendChild(document.createElement("br"));
        return cellNode;
    };
    const syncTextTableEdit = () => {
        normalizeTextEditorTables();
        rememberTextSelection();
        syncTextEditorStateFromDom();
    };
    const insertTextTableRow = (targetNode, after = true) => {
        const context = getTextTableContext(targetNode);
        if (!context?.tableNode) return false;
        const sourceRow = context.rowNode || context.tableNode.rows[context.tableNode.rows.length - 1];
        const columnCount = Math.max(1, sourceRow?.cells?.length || context.tableNode.rows[0]?.cells?.length || 1);
        const rowNode = document.createElement("tr");
        Array.from({length: columnCount}).forEach(() => rowNode.appendChild(createTextTableCell()));
        if (sourceRow) sourceRow[after ? "after" : "before"](rowNode);
        else context.tableNode.appendChild(rowNode);
        placeCaretAtStart(rowNode.cells[Math.max(0, Math.min(context.columnIndex, columnCount - 1))]);
        syncTextTableEdit();
        return true;
    };
    const insertTextTableColumn = (targetNode, after = true) => {
        const context = getTextTableContext(targetNode);
        if (!context?.tableNode) return false;
        const targetColumn = Math.max(0, context.columnIndex);
        Array.from(context.tableNode.rows).forEach((rowNode) => {
            const cellNode = createTextTableCell();
            const referenceCell = rowNode.cells[targetColumn] || rowNode.cells[rowNode.cells.length - 1];
            if (referenceCell) referenceCell[after ? "after" : "before"](cellNode);
            else rowNode.appendChild(cellNode);
        });
        const focusRow = context.tableNode.rows[Math.max(0, context.rowIndex)] || context.tableNode.rows[0];
        placeCaretAtStart(focusRow?.cells?.[after ? targetColumn + 1 : targetColumn]);
        syncTextTableEdit();
        return true;
    };
    const deleteTextTableRow = (targetNode) => {
        const context = getTextTableContext(targetNode);
        if (!context?.rowNode) return false;
        if (context.tableNode.rows.length <= 1) {
            context.tableNode.remove();
        } else {
            const nextFocusRow = context.rowNode.nextElementSibling || context.rowNode.previousElementSibling;
            context.rowNode.remove();
            placeCaretAtStart(nextFocusRow?.cells?.[Math.max(0, context.columnIndex)] || nextFocusRow?.cells?.[0]);
        }
        syncTextTableEdit();
        return true;
    };
    const deleteTextTableColumn = (targetNode) => {
        const context = getTextTableContext(targetNode);
        if (!context?.tableNode || context.columnIndex < 0) return false;
        const rowNodes = Array.from(context.tableNode.rows);
        if ((rowNodes[0]?.cells?.length || 0) <= 1) {
            context.tableNode.remove();
        } else {
            rowNodes.forEach((rowNode) => rowNode.cells[context.columnIndex]?.remove());
            const focusRow = context.tableNode.rows[Math.max(0, Math.min(context.rowIndex, context.tableNode.rows.length - 1))];
            placeCaretAtStart(focusRow?.cells?.[Math.max(0, context.columnIndex - 1)] || focusRow?.cells?.[0]);
        }
        syncTextTableEdit();
        return true;
    };
    const deleteTextTable = (targetNode) => {
        const context = getTextTableContext(targetNode);
        if (!context?.tableNode) return false;
        const paragraphNode = createTextEditorParagraphBreak();
        context.tableNode.replaceWith(paragraphNode);
        placeCaretAtStart(paragraphNode);
        syncTextTableEdit();
        return true;
    };
    const getTextTableResizeHandle = () => {
        if (activeTextTableResizeHandle) return activeTextTableResizeHandle;
        activeTextTableResizeHandle = document.createElement("div");
        activeTextTableResizeHandle.className = "editor-text-table-resize-handle";
        activeTextTableResizeHandle.contentEditable = "false";
        document.body.appendChild(activeTextTableResizeHandle);
        activeTextTableResizeHandle.addEventListener("mousedown", (event) => {
            const cellNode = activeTextTableResizeHandle._cellNode;
            const tableNode = cellNode?.closest?.("table");
            const mode = activeTextTableResizeHandle.dataset.resizeMode;
            if (!cellNode || !tableNode || !mode) return;
            event.preventDefault();
            event.stopPropagation();
            const rowNode = cellNode.parentElement;
            activeTextTableResizeState = {
                mode,
                tableNode,
                rowNode,
                columnIndex: Array.from(rowNode.cells).indexOf(cellNode),
                startX: event.clientX,
                startY: event.clientY,
                startWidth: cellNode.getBoundingClientRect().width,
                startHeight: rowNode.getBoundingClientRect().height
            };
            activeTextTableResizeHandle.classList.add("is-dragging");
        });
        return activeTextTableResizeHandle;
    };
    const hideTextTableResizeHandle = () => {
        if (!activeTextTableResizeHandle || activeTextTableResizeState) return;
        activeTextTableResizeHandle.classList.remove("is-visible", "is-column", "is-row");
        activeTextTableResizeHandle._cellNode = null;
    };
    const updateTextTableResizeHover = (event) => {
        if (activeTextTableResizeState) return;
        const textArea = findTextEditorNode();
        if (activeTextTableResizeHandle?.contains?.(event.target)) return;
        const cellNode = event.target?.closest?.("th, td");
        if (!textArea || !cellNode || !textArea.contains(cellNode) || !cellNode.closest("table")) {
            hideTextTableResizeHandle();
            return;
        }
        const cellRect = cellNode.getBoundingClientRect();
        const tableRect = cellNode.closest("table").getBoundingClientRect();
        const nearRight = Math.abs(event.clientX - cellRect.right) <= 6;
        const nearBottom = Math.abs(event.clientY - cellRect.bottom) <= 6;
        if (!nearRight && !nearBottom) {
            hideTextTableResizeHandle();
            return;
        }
        const handleNode = getTextTableResizeHandle();
        handleNode._cellNode = cellNode;
        handleNode.dataset.resizeMode = nearRight ? "column" : "row";
        handleNode.classList.toggle("is-column", nearRight);
        handleNode.classList.toggle("is-row", !nearRight);
        handleNode.classList.add("is-visible");
        if (nearRight) {
            handleNode.style.left = `${Math.round(cellRect.right - 3)}px`;
            handleNode.style.top = `${Math.round(tableRect.top)}px`;
            handleNode.style.width = "6px";
            handleNode.style.height = `${Math.round(tableRect.height)}px`;
        } else {
            handleNode.style.left = `${Math.round(tableRect.left)}px`;
            handleNode.style.top = `${Math.round(cellRect.bottom - 3)}px`;
            handleNode.style.width = `${Math.round(tableRect.width)}px`;
            handleNode.style.height = "6px";
        }
    };
    const resizeTextTable = (event) => {
        if (!activeTextTableResizeState) return;
        event.preventDefault();
        const state = activeTextTableResizeState;
        if (state.mode === "column") {
            const nextWidth = Math.max(36, state.startWidth + event.clientX - state.startX);
            Array.from(state.tableNode.rows).forEach((rowNode) => {
                const cellNode = rowNode.cells[state.columnIndex];
                if (cellNode) cellNode.style.width = `${Math.round(nextWidth)}px`;
            });
        } else if (state.rowNode) {
            const nextHeight = Math.max(28, state.startHeight + event.clientY - state.startY);
            state.rowNode.style.height = `${Math.round(nextHeight)}px`;
        }
    };
    const showTextTablePicker = (buttonNode) => {
        if (!buttonNode) return false;
        const existingPicker = document.querySelector(".editor-text-table-picker");
        if (existingPicker) existingPicker.remove();
        const pickerNode = document.createElement("div");
        pickerNode.className = "custom-context-menu editor-text-table-picker";
        pickerNode.innerHTML = `<div class="editor-text-table-picker-grid"></div><div class="editor-text-table-picker-label">1 x 1</div>`;
        const gridNode = pickerNode.querySelector(".editor-text-table-picker-grid");
        const labelNode = pickerNode.querySelector(".editor-text-table-picker-label");
        const maxRows = 8;
        const maxColumns = 8;
        let selectedRows = 1;
        let selectedColumns = 1;
        Array.from({length: maxRows}).forEach((_, rowIndex) => {
            Array.from({length: maxColumns}).forEach((__, columnIndex) => {
                const cellNode = document.createElement("button");
                cellNode.type = "button";
                cellNode.className = "editor-text-table-picker-cell";
                cellNode.dataset.row = String(rowIndex + 1);
                cellNode.dataset.column = String(columnIndex + 1);
                cellNode.setAttribute("aria-label", `${rowIndex + 1} by ${columnIndex + 1} table`);
                gridNode.appendChild(cellNode);
            });
        });
        const updateSelection = (rows, columns) => {
            selectedRows = rows;
            selectedColumns = columns;
            labelNode.textContent = `${rows} x ${columns}`;
            gridNode.querySelectorAll(".editor-text-table-picker-cell").forEach((cellNode) => {
                const row = Number(cellNode.dataset.row) || 0;
                const column = Number(cellNode.dataset.column) || 0;
                cellNode.classList.toggle("is-selected", row <= rows && column <= columns);
            });
        };
        pickerNode.addEventListener("mousemove", (event) => {
            const cellNode = event.target?.closest?.(".editor-text-table-picker-cell");
            if (!cellNode) return;
            updateSelection(Number(cellNode.dataset.row) || 1, Number(cellNode.dataset.column) || 1);
        });
        pickerNode.addEventListener("click", (event) => {
            const cellNode = event.target?.closest?.(".editor-text-table-picker-cell");
            if (!cellNode) return;
            event.preventDefault();
            event.stopPropagation();
            pickerNode.remove();
            insertTextEditorTable(selectedRows, selectedColumns);
        });
        const closePicker = (event) => {
            if (pickerNode.contains(event.target) || buttonNode.contains(event.target)) return;
            pickerNode.remove();
            document.removeEventListener("mousedown", closePicker, true);
        };
        document.body.appendChild(pickerNode);
        const rect = buttonNode.getBoundingClientRect();
        pickerNode.style.left = `${rect.left}px`;
        pickerNode.style.top = `${rect.bottom + 6}px`;
        requestAnimationFrame(() => {
            updateSelection(1, 1);
            const pickerRect = pickerNode.getBoundingClientRect();
            if (pickerRect.right > window.innerWidth) pickerNode.style.left = `${Math.max(8, window.innerWidth - pickerRect.width - 8)}px`;
            if (pickerRect.bottom > window.innerHeight) pickerNode.style.top = `${Math.max(8, rect.top - pickerRect.height - 6)}px`;
        });
        document.addEventListener("mousedown", closePicker, true);
        return true;
    };
    const bindTextEditorInteractions = (portal = findTextPortal()) => {
        const windowNode = portal?.window?.();
        const findInPortal = (selector) => windowNode?.querySelector?.(selector) || document.querySelector(selector);
        const textArea = findTextEditorNode(portal);
        const fontFamilySelect = findInPortal("#editor-sheet-font-family");
        const fontSizeSelect = findInPortal("#editor-sheet-font-size");
        const boldButton = findInPortal("#editor-sheet-style-bold");
        const italicButton = findInPortal("#editor-sheet-style-italic");
        const underlineButton = findInPortal("#editor-sheet-style-underline");
        const linkButton = findInPortal("#editor-sheet-style-link");
        const textColorButton = findInPortal("#editor-sheet-style-color");
        const backgroundColorButton = findInPortal("#editor-sheet-style-background");
        const alignmentButton = findInPortal("#editor-sheet-style-align");
        const highlightButton = findInPortal("#editor-sheet-style-highlight");
        const listButton = findInPortal("#editor-sheet-style-list");
        const shapeButton = findInPortal("#editor-sheet-style-shape");
        const imageButton = findInPortal("#editor-sheet-style-image");
        const tableButton = findInPortal("#editor-sheet-style-table");
        const otherButton = findInPortal("#editor-sheet-style-other");
        if (!textArea || textArea.dataset.bound === "1") return;
        textArea.dataset.bound = "1";
        textArea.addEventListener("keydown", (event) => {
            if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key?.toLowerCase?.() === "k") {
                if (hasHighlightedTextSelection()) {
                    event.preventDefault();
                    showTextEditorHyperlinkDialogue();
                }
                return;
            }
            if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key?.toLowerCase?.() === "d") {
                event.preventDefault();
                duplicateTextEditorLineDown(textArea);
                rememberTextSelection();
                syncTextEditorStateFromDom();
                return;
            }
            if (event.key === "Escape") {
                clearActiveTextImageSelection();
                clearActiveTextShapeSelection();
                return;
            }
            if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                insertTextEditorTab(textArea);
                rememberTextSelection();
                syncTextEditorStateFromDom();
                return;
            }
            handleTextEditorEnterKey(event);
        });
        textArea.contextmenu([{
            label: "Hyperlink",
            icon: TEXT_LINK_ICON,
            visible: () => hasHighlightedTextSelection() && isRichTextDocument(),
            action: () => showTextEditorHyperlinkDialogue()
        },
            {
                label: "Add Row Above",
                icon: TEXT_TABLE_ICON,
                visible: hasTextTableContext,
                action: (_, __, target) => insertTextTableRow(target, false)
            },
            {
                label: "Add Row Below",
                icon: TEXT_TABLE_ICON,
                visible: hasTextTableContext,
                action: (_, __, target) => insertTextTableRow(target, true)
            },
            {
                label: "Add Column Left",
                icon: TEXT_TABLE_ICON,
                visible: hasTextTableContext,
                action: (_, __, target) => insertTextTableColumn(target, false)
            },
            {
                label: "Add Column Right",
                icon: TEXT_TABLE_ICON,
                visible: hasTextTableContext,
                action: (_, __, target) => insertTextTableColumn(target, true)
            },
            "separator",
            {
                label: "Delete Row",
                icon: TEXT_TABLE_ICON,
                visible: hasTextTableContext,
                destructive: true,
                action: (_, __, target) => deleteTextTableRow(target)
            },
            {
                label: "Delete Column",
                icon: TEXT_TABLE_ICON,
                visible: hasTextTableContext,
                destructive: true,
                action: (_, __, target) => deleteTextTableColumn(target)
            },
            {
                label: "Delete Table",
                icon: TEXT_TABLE_ICON,
                visible: hasTextTableContext,
                destructive: true,
                action: (_, __, target) => deleteTextTable(target)
            }], "table, th, td");
        textArea.addEventListener("contextmenu", (event) => {
            const frameNode = event.target?.closest?.(".editor-text-shape-frame");
            if (!frameNode || !textArea.contains(frameNode)) return;
            selectTextEditorShapeFrame(frameNode);
        }, true);
        textArea.contextmenu([{
            className: "context-menu-item-switch",
            visible: (_, target) => !!target?.closest?.(".editor-text-shape-frame"),
            get content() {
                return children([
                    div({content: children([
                        switcher({id: "editor-text-shape-wrap-toggle", style: "menu-switcher float-right", checked: isTextEditorShapeOnTop(activeTextShapeFrame)}),
                        `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon space-right" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 7.5h15M4.5 12h9M4.5 16.5h15" /><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.25h3.75v3.75h-3.75z" /></svg>`,
                        `<span>On Top</span>`
                    ])})
                ]);
            },
            action: (_, __, target) => {
                const frameNode = target?.closest?.(".editor-text-shape-frame") || activeTextShapeFrame;
                applyTextEditorShapeWrapMode(frameNode, !isTextEditorShapeOnTop(frameNode));
            }
        }, {
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 9.0996094 -0.00390625 A 0.750075 0.750075 0 0 0 8.578125 1.2832031 L 9.9414062 2.6484375 L 3.0214844 9.5722656 C 1.6862427 10.90878 1.6862427 13.097079 3.0214844 14.433594 L 9.5683594 20.984375 C 10.904906 22.320922 13.094894 22.322395 14.431641 20.984375 L 21.880859 13.53125 A 0.750075 0.750075 0 0 0 21.880859 12.472656 L 9.6386719 0.22265625 A 0.750075 0.750075 0 0 0 9.0996094 -0.00390625 z M 11.001953 3.7089844 L 20.289062 13.001953 L 13.371094 19.923828 C 12.60784 20.687809 11.39236 20.687282 10.628906 19.923828 L 4.0820312 13.373047 C 3.319273 12.609561 3.319273 11.396299 4.0820312 10.632812 L 11.001953 3.7089844 z"/></svg>`,
            label: "Background Color",
            visible: (_, target) => !!target?.closest?.(".editor-text-shape-frame"),
            action: (_, __, target) => showTextEditorShapeColorDialogue(target?.closest?.(".editor-text-shape-frame") || activeTextShapeFrame, "fill", "Background color", "rgba(76, 139, 245, 0.18)")
        }, {
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5h15M7 16 17 6" /></svg>`,
            label: "Border Color",
            visible: (_, target) => !!target?.closest?.(".editor-text-shape-frame"),
            action: (_, __, target) => showTextEditorShapeColorDialogue(target?.closest?.(".editor-text-shape-frame") || activeTextShapeFrame, "stroke", "Border color", "#1f2937")
        }, {
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`,
            label: "Delete",
            destructive: true,
            visible: (_, target) => !!target?.closest?.(".editor-text-shape-frame"),
            action: (_, __, target) => deleteTextEditorShape(target?.closest?.(".editor-text-shape-frame") || activeTextShapeFrame)
        }], ".editor-text-shape-frame");
        textArea.addEventListener("paste", async (event) => {
            const clipboard = event.clipboardData;
            const imageItems = Array.from(clipboard?.items || []).filter((item) => item.type?.startsWith("image/"));
            if (!imageItems.length || !isRichTextDocument()) return;
            event.preventDefault();
            rememberTextSelection();
            for (const item of imageItems) {
                const file = item.getAsFile();
                if (!file) continue;
                await insertImageFileIntoTextEditor(file);
            }
        });
        textArea.addEventListener("input", () => {
            rememberTextSelection();
            syncTextEditorStateFromDom({deferHeavyWork: true, portal});
        });
        textArea.addEventListener("keyup", () => {
            rememberTextSelection();
            updateTextToolbarState();
        });
        textArea.addEventListener("mouseup", () => {
            rememberTextSelection();
            updateTextToolbarState();
        });
        textArea.addEventListener("focus", () => {
            rememberTextSelection();
            updateTextToolbarState();
        });
        textArea.addEventListener("click", (event) => {
            const linkNode = event.target?.closest?.("a[href]");
            if (linkNode && textArea.contains(linkNode)) {
                event.preventDefault();
                event.stopPropagation();
                window.open(linkNode.href, "_blank", "noopener,noreferrer");
                return;
            }
            const frameNode = event.target?.closest?.(".editor-text-image-frame");
            const shapeFrameNode = event.target?.closest?.(".editor-text-shape-frame");
            if (shapeFrameNode && textArea.contains(shapeFrameNode)) {
                event.preventDefault();
                event.stopPropagation();
                selectTextEditorShapeFrame(shapeFrameNode);
                textArea.focus();
                return;
            }
            if (!frameNode) {
                clearActiveTextImageSelection();
                clearActiveTextShapeSelection();
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            selectTextEditorImageFrame(frameNode);
            textArea.focus();
        });
        textArea.addEventListener("focusout", () => {
            window.setTimeout(() => {
                const editorNode = findTextEditorNode(portal);
                if (!editorNode?.contains(document.activeElement)) {
                    clearActiveTextImageSelection();
                    clearActiveTextShapeSelection();
                }
            }, 0);
        });
        textArea.addEventListener("mousedown", (event) => {
            const handleNode = event.target?.closest?.(".editor-text-image-handle");
            if (!handleNode) return;
            const frameNode = handleNode.closest(".editor-text-image-frame");
            const shapeFrameNode = handleNode.closest(".editor-text-shape-frame");
            if (shapeFrameNode) {
                event.preventDefault();
                event.stopPropagation();
                selectTextEditorShapeFrame(shapeFrameNode);
                activeTextShapeResizeState = {
                    frameNode: shapeFrameNode,
                    handle: handleNode.dataset.resizeHandle || "se",
                    startX: event.clientX,
                    startY: event.clientY,
                    startWidth: shapeFrameNode.getBoundingClientRect().width || 170,
                    startHeight: shapeFrameNode.getBoundingClientRect().height || 110
                };
                return;
            }
            const imageNode = frameNode?.querySelector("img");
            if (!frameNode || !imageNode) return;
            event.preventDefault();
            event.stopPropagation();
            selectTextEditorImageFrame(frameNode);
            const startingWidth = imageNode.getBoundingClientRect().width || imageNode.naturalWidth || 240;
            const startingHeight = imageNode.getBoundingClientRect().height || imageNode.naturalHeight || 180;
            activeTextImageResizeState = {
                frameNode,
                imageNode,
                handle: handleNode.dataset.resizeHandle || "se",
                startX: event.clientX,
                startY: event.clientY,
                startWidth: startingWidth,
                startHeight: startingHeight,
                aspectRatio: startingWidth > 0 && startingHeight > 0 ? startingWidth / startingHeight : 1
            };
        });
        if (!textEditorSelectionChangeBound) {
            textEditorSelectionChangeBound = true;
            document.addEventListener("selectionchange", () => {
                if (!isSelectionInsideTextEditor()) return;
                rememberTextSelection();
                updateTextToolbarState();
            });
            document.addEventListener("mousemove", (event) => {
                if (activeTextTableResizeState) {
                    resizeTextTable(event);
                    return;
                }
                updateTextTableResizeHover(event);
                if (activeTextShapeMoveState) {
                    event.preventDefault();
                    const {frameNode, startX, startY, startLeft, startTop} = activeTextShapeMoveState;
                    frameNode.style.left = `${Math.round(startLeft + event.clientX - startX)}px`;
                    frameNode.style.top = `${Math.round(startTop + event.clientY - startY)}px`;
                    return;
                }
                if (activeTextShapeResizeState) {
                    event.preventDefault();
                    const {handle, frameNode, startX, startY, startWidth, startHeight} = activeTextShapeResizeState;
                    const horizontalDelta = event.clientX - startX;
                    const verticalDelta = event.clientY - startY;
                    const widthDelta = handle.includes("w") ? -horizontalDelta : horizontalDelta;
                    const heightDelta = handle.includes("n") ? -verticalDelta : verticalDelta;
                    const nextWidth = Math.max(32, startWidth + widthDelta);
                    const nextHeight = Math.max(32, startHeight + heightDelta);
                    frameNode.style.width = `${Math.round(nextWidth)}px`;
                    frameNode.style.height = `${Math.round(nextHeight)}px`;
                    frameNode.dataset.shapeWidth = String(Math.round(nextWidth));
                    frameNode.dataset.shapeHeight = String(Math.round(nextHeight));
                    return;
                }
                if (!activeTextImageResizeState) return;
                event.preventDefault();
                const {handle, imageNode, startX, startY, startWidth, aspectRatio, frameNode} = activeTextImageResizeState;
                const horizontalDelta = event.clientX - startX;
                const verticalDelta = event.clientY - startY;
                const widthDelta = handle.includes("w") ? -horizontalDelta : horizontalDelta;
                const heightDelta = handle.includes("n") ? -verticalDelta : verticalDelta;
                const dominantDelta = Math.abs(widthDelta) >= Math.abs(heightDelta) ? widthDelta : heightDelta * aspectRatio;
                const editorBounds = frameNode?.closest?.("#editor-text-content")?.getBoundingClientRect?.() || findTextEditorNode()?.getBoundingClientRect?.();
                const nextWidth = Math.max(60, Math.min(startWidth + dominantDelta, editorBounds?.width || window.innerWidth));
                imageNode.style.width = `${Math.round(nextWidth)}px`;
                imageNode.style.height = "auto";
            });
            document.addEventListener("mouseup", () => {
                if (activeTextTableResizeState) {
                    activeTextTableResizeState = null;
                    activeTextTableResizeHandle?.classList.remove("is-dragging");
                    hideTextTableResizeHandle();
                    rememberTextSelection();
                    syncTextEditorStateFromDom();
                    return;
                }
                if (activeTextShapeMoveState || activeTextShapeResizeState) {
                    activeTextShapeMoveState = null;
                    activeTextShapeResizeState = null;
                    rememberTextSelection();
                    syncTextEditorStateFromDom();
                    return;
                }
                if (!activeTextImageResizeState) return;
                activeTextImageResizeState = null;
                rememberTextSelection();
                syncTextEditorStateFromDom();
            });
            document.addEventListener("mousedown", (event) => {
                if (event.target?.closest?.(".editor-text-image-frame, .editor-text-shape-frame")) return;
                clearActiveTextImageSelection();
                clearActiveTextShapeSelection();
            });
        }
        textArea.addEventListener("mousedown", (event) => {
            const shapeFrameNode = event.target?.closest?.(".editor-text-shape-frame");
            if (!shapeFrameNode || !isTextEditorShapeOnTop(shapeFrameNode) || event.target?.closest?.(".editor-text-image-handle")) return;
            event.preventDefault();
            event.stopPropagation();
            selectTextEditorShapeFrame(shapeFrameNode);
            activeTextShapeMoveState = {
                frameNode: shapeFrameNode,
                startX: event.clientX,
                startY: event.clientY,
                startLeft: Number.parseFloat(shapeFrameNode.style.left || "0") || 0,
                startTop: Number.parseFloat(shapeFrameNode.style.top || "0") || 0
            };
        });
        [boldButton, italicButton, underlineButton, linkButton, textColorButton, backgroundColorButton, alignmentButton, highlightButton, listButton, shapeButton, imageButton, tableButton, otherButton].forEach(bindTextToolbarButtonFocus);
        if (fontFamilySelect && fontFamilySelect.dataset.bound !== "1") {
            fontFamilySelect.dataset.bound = "1";
            fontFamilySelect.addEventListener("change", () => execTextEditorCommand("fontName", window.StandardUI?.getSearchComboBoxValue?.(fontFamilySelect) || fontFamilySelect.value || "Inter"));
        }
        if (fontSizeSelect && fontSizeSelect.dataset.bound !== "1") {
            fontSizeSelect.dataset.bound = "1";
            fontSizeSelect.addEventListener("change", () => execTextEditorFontSize(window.StandardUI?.getSearchComboBoxValue?.(fontSizeSelect) || fontSizeSelect.value || "12"));
        }
        if (boldButton && boldButton.dataset.bound !== "1") {
            boldButton.dataset.bound = "1";
            boldButton.addEventListener("click", (event) => {
                event.preventDefault();
                execTextEditorCommand("bold");
            });
        }
        if (italicButton && italicButton.dataset.bound !== "1") {
            italicButton.dataset.bound = "1";
            italicButton.addEventListener("click", (event) => {
                event.preventDefault();
                execTextEditorCommand("italic");
            });
        }
        if (underlineButton && underlineButton.dataset.bound !== "1") {
            underlineButton.dataset.bound = "1";
            underlineButton.addEventListener("click", (event) => {
                event.preventDefault();
                execTextEditorCommand("underline");
            });
        }
        if (linkButton && linkButton.dataset.bound !== "1") {
            linkButton.dataset.bound = "1";
            linkButton.addEventListener("click", (event) => {
                event.preventDefault();
                rememberTextSelection();
                showTextEditorHyperlinkDialogue({allowEmptyText: true});
            });
        }
        if (textColorButton && textColorButton.dataset.bound !== "1") {
            textColorButton.dataset.bound = "1";
            textColorButton.popoutmenu(TEXT_TEXT_COLORS.map((colorOption) => ({
                label: colorOption.label,
                icon: `<div class="inline round small-icon space-right" style="background:${colorOption.value || "transparent"};border:1px solid var(--border)"></div>`,
                action: () => execTextEditorCommand("foreColor", colorOption.value || "inherit")
            })));
        }
        if (backgroundColorButton && backgroundColorButton.dataset.bound !== "1") {
            backgroundColorButton.dataset.bound = "1";
            backgroundColorButton.popoutmenu(TEXT_BACKGROUND_COLORS.map((colorOption) => ({
                label: colorOption.label,
                icon: `<div class="inline round small-icon space-right" style="background:${colorOption.value || "transparent"};border:1px solid var(--border)"></div>`,
                action: () => execTextEditorCommand("hiliteColor", colorOption.value || "transparent")
            })));
        }
        if (alignmentButton && alignmentButton.dataset.bound !== "1") {
            alignmentButton.dataset.bound = "1";
            alignmentButton.popoutmenu([
                {
                    label: "Align Left",
                    icon: TEXT_ALIGN_ICONS.left,
                    action: () => execTextEditorCommand("justifyLeft")
                },
                {
                    label: "Align Center",
                    icon: TEXT_ALIGN_ICONS.center,
                    action: () => execTextEditorCommand("justifyCenter")
                },
                {
                    label: "Align Right",
                    icon: TEXT_ALIGN_ICONS.right,
                    action: () => execTextEditorCommand("justifyRight")
                }
            ]);
        }
        if (highlightButton && highlightButton.dataset.bound !== "1") {
            highlightButton.dataset.bound = "1";
            highlightButton.addEventListener("click", (event) => {
                event.preventDefault();
                const styleTarget = getTextSelectionStyleTarget();
                const backgroundColor = getComputedStyle(styleTarget || textArea).backgroundColor;
                const nextColor = resolveTextColor(backgroundColor) === resolveTextColor(TEXT_HIGHLIGHT_COLOR) ? "transparent" : TEXT_HIGHLIGHT_COLOR;
                execTextEditorCommand("hiliteColor", nextColor);
            });
        }
        if (listButton && listButton.dataset.bound !== "1") {
            listButton.dataset.bound = "1";
            listButton.popoutmenu([
                {
                    label: "Bulleted List",
                    icon: `<span class="small-icon space-right">&#8226;</span>`,
                    action: () => applyTextListStyle("UL", "disc")
                },
                {
                    label: "Circle Bullets",
                    icon: `<span class="small-icon space-right">&#9702;</span>`,
                    action: () => applyTextListStyle("UL", "circle")
                },
                {
                    label: "Square Bullets",
                    icon: `<span class="small-icon space-right">&#9632;</span>`,
                    action: () => applyTextListStyle("UL", "square")
                },
                "separator",
                {
                    label: "Numbered List",
                    icon: `<span class="small-icon space-right">1.</span>`,
                    action: () => applyTextListStyle("OL", "decimal")
                },
                {
                    label: "Lower Alpha",
                    icon: `<span class="small-icon space-right">a.</span>`,
                    action: () => applyTextListStyle("OL", "lower-alpha")
                },
                {
                    label: "Upper Roman",
                    icon: `<span class="small-icon space-right">I.</span>`,
                    action: () => applyTextListStyle("OL", "upper-roman")
                }
            ]);
        }
        if (shapeButton && shapeButton.dataset.bound !== "1") {
            shapeButton.dataset.bound = "1";
            shapeButton.popoutmenu(TEXT_SHAPE_OPTIONS.map((shape) => ({
                icon: shape.icon,
                label: shape.label,
                action: () => insertTextEditorShape(shape.type)
            })));
        }
        if (imageButton && imageButton.dataset.bound !== "1") {
            imageButton.dataset.bound = "1";
            imageButton.addEventListener("click", async (event) => {
                event.preventDefault();
                rememberTextSelection();
                const fileInput = document.createElement("input");
                fileInput.type = "file";
                fileInput.accept = "image/*";
                fileInput.addEventListener("change", async () => {
                    const selectedFile = fileInput.files?.[0];
                    if (!selectedFile) return;
                    await insertImageFileIntoTextEditor(selectedFile);
                }, {once: true});
                fileInput.click();
            });
        }
        if (tableButton && tableButton.dataset.bound !== "1") {
            tableButton.dataset.bound = "1";
            tableButton.addEventListener("click", (event) => {
                event.preventDefault();
                rememberTextSelection();
                showTextTablePicker(tableButton);
            });
        }
        if (otherButton && otherButton.dataset.bound !== "1") {
            otherButton.dataset.bound = "1";
            otherButton.popoutmenu([{
                className: "context-menu-item-switch",
                get content() {
                    return children([
                        div({content: children([
                            switcher({id: "editor-text-page-view-toggle", style: "menu-switcher float-right", checked: activeTextPageViewEnabled}),
                            `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon space-right" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3.75h10.5A2.25 2.25 0 0 1 19.5 6v12a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V6a2.25 2.25 0 0 1 2.25-2.25Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5h7.5M8.25 10.5h7.5M8.25 13.5h7.5M8.25 16.5h4.5" /></svg>`,
                            `<span>Pages</span>`
                        ])}),
                    ]);
                },
                action: () => toggleTextEditorPageView(undefined, portal)
            }, {
                className: "editor-text-menu-stats",
                get content() {
                    return renderTextEditorStatsMenuContent(portal);
                }
            }]);
        }
        updateTextToolbarState();
    };
    const updateTextEditorView = (portal = findTextPortal()) => {
        const pathLabel = portal?.window?.()?.querySelector?.("#editor-text-path") || document.getElementById("editor-text-path");
        if (pathLabel) pathLabel.textContent = activeTextEditorFilePath || "No file loaded";
        const textArea = findTextEditorNode(portal);
        writeTextEditorContent(textArea);
        applyTextEditorPageView(activeTextPageViewEnabled, textArea, portal);
        const textToolbar = portal?.window?.()?.querySelector?.("#editor-text-toolbar") || document.getElementById("editor-text-toolbar");
        if (textToolbar) {
            const previousPosition = textToolbar.style.position;
            const previousTop = textToolbar.style.top;
            textToolbar.style.position = "";
            textToolbar.style.top = "";
            const stickyTop = textToolbar.offsetTop || 0;
            textToolbar.style.position = "sticky";
            textToolbar.style.top = `${stickyTop}px`;
            textToolbar.style.zIndex = "3";
            textToolbar.style.display = shouldHideTextEditorBar(activeTextEditorFilePath) ? "none" : "";
            if (textToolbar.style.display === "none") {
                textToolbar.style.position = previousPosition;
                textToolbar.style.top = previousTop;
            }
        }
        updateTextEditorPortalTitle(portal);
        updateTextToolbarState();
    };
    const getTextEditorPortals = () => [...Array.from(document.querySelectorAll(".draggable-window"))]
        .map((windowNode) => windowNode?.portal)
        .filter((portal) => portal?.serviceId?.() === SERVICE_ID);
    const refreshTextEditorPortalsFromState = () => {
        const portals = getTextEditorPortals();
        portals.forEach((portal) => {
            restoreEditorWindowState(portal);
            updateTextEditorView(portal);
        });
    };
    const scheduleTextEditorPortalStateRefresh = () => {
        requestAnimationFrame(() => requestAnimationFrame(refreshTextEditorPortalsFromState));
    };
    const sanitizeNewTextFileName = (rawName = "") => {
        const trimmedName = String(rawName || "").trim().replace(/\\/g, "/");
        const baseName = trimmedName.split("/").pop() || "";
        const sanitizedName = baseName.replace(/^\.+/, "");
        if (!sanitizedName) return "";
        return sanitizedName.includes(".") ? sanitizedName : `${sanitizedName}.wrds`;
    };
    const saveTextEditorContentToPath = async (targetPath = "", portal = findTextPortal()) => {
        const normalizedPath = normalizeTextFilePath(targetPath);
        if (!normalizedPath) {
            modular.error("File name is required");
            return false;
        }
        const state = portal?.windowState?.() || {};
        activeTextEditorFilePath = normalizedPath;
        activeTextPageViewEnabled = isPlainTextFilePath(normalizedPath)
            ? false
            : (typeof state?.pageViewEnabled === "boolean" ? state.pageViewEnabled : activeTextPageViewEnabled);
        activeTextEditorContent = readTextEditorContent(findTextEditorNode(portal));
        persistTextDocumentPageViewPreference(normalizedPath, activeTextPageViewEnabled);
        const persistedContent = encodeTextEditorContentForSave(activeTextEditorContent);
        const bytes = new TextEncoder().encode(persistedContent);
        const fileName = getTextFileName(normalizedPath);
        const directory = getTextFileDirectory(normalizedPath);
        const uploadPath = directory ? `/api/upload?directory=${encodeURIComponent(directory)}` : "/api/upload";
        const textFile = new File([bytes], fileName, {type: "application/octet-stream"});
        let saved = false;
        if (typeof window.StandardUploads?.uploadFile === "function") {
            const response = await window.StandardUploads.uploadFile(textFile, uploadPath, {
                label: `Saving ${fileName}`
            });
            saved = !!response?.ok;
        } else {
            const formData = new FormData();
            formData.append("file", textFile);
            const response = await fetch(uploadPath, {method: "POST", body: formData});
            saved = response.ok;
        }
        if (!saved) {
            modular.error("Unable to save text file");
            return false;
        }
        syncEditorWindowState(portal);
        updateTextEditorView(portal);
        modular.success(`Saved ${normalizedPath} (${bytes.length} bytes)`);
        return true;
    };
    const saveNewTextFileToDocuments = (portal = findTextPortal()) => {
        inputDialogue({
            title: "File name",
            placeholder: "standard.wrds",
            value: "standard.wrds",
            confirmation: async (_, inputFileName) => {
                if (!modular.validateFileName(inputFileName)) return;
                const safeFileName = sanitizeNewTextFileName(inputFileName) || "standard.wrds";
                await saveTextEditorContentToPath(`Documents/${safeFileName}`, portal);
            }
        });
    };
    const saveLoadedTextFile = async (portal = findTextPortal()) => {
        const state = portal?.windowState?.() || {};
        const portalPath = normalizeTextFilePath(state?.directive || "");
        if (!portalPath) {
            saveNewTextFileToDocuments(portal);
            return;
        }
        await saveTextEditorContentToPath(portalPath, portal);
    };
    const openFreshTextEditor = (sourceNode = null) => {
        activeTextEditorFilePath = "";
        activeTextEditorContent = "Edit Me";
        activeTextPageViewEnabled = getDefaultTextDocumentPageViewPreference(activeTextEditorFilePath);
        clearActiveTextImageSelection({skipSync: true});
        const portal = modular.show(SERVICE_ID, 0, {newInstance: true});
        prioritizePortalDomForLegacyLookups(portal);
        syncEditorWindowState(portal);
        updateTextEditorView(portal);
        scheduleTextEditorPortalStateRefresh();
        return true;
    };
    window.StandardEditor = window.StandardEditor || {};
    window.StandardEditor.openFreshTextEditor = openFreshTextEditor;
    window.StandardEditor.openTextFilePath = (rawPath = "", content = "", sourceNode = null) => {
        const nextFilePath = normalizeTextFilePath(rawPath);
        const nextContent = decodeTextEditorLoadedContent(content);
        activeTextEditorFilePath = nextFilePath;
        loadTextDocumentPageViewPreference(activeTextEditorFilePath, getDefaultTextDocumentPageViewPreference(activeTextEditorFilePath));
        activeTextEditorContent = nextContent;
        clearActiveTextImageSelection({skipSync: true});
        const portal = modular.show(SERVICE_ID, 0, {newInstance: true});
        prioritizePortalDomForLegacyLookups(portal);
        setTextEditorPortalState(portal, {merge: false});
        updateTextEditorView(portal);
        scheduleTextEditorPortalStateRefresh();
        return true;
    };
    modular.register(new Service(SERVICE_ID, [
        new Portal({
            title: "Text",
            hints: ["text editor", "create text file", "new text file"],
            action: openFreshTextEditor,
            dimensions: [800, 600],
            horizontal_nav: true,
            centered_nav: true,
            tools: [{
                title: "Save",
                icon: modular.icons.save,
                onclick: (_, context) => saveLoadedTextFile(context?.portal)
            }, {
                title: "Print",
                icon: modular.icons.print,
                onclick: (_, context) => printTextEditorDocument(context?.portal)
            }, {
                title: "Search",
                icon: modular.icons.search,
                onclick: (event, context) => showTextEditorSearchDialogue(context?.portal, event?.currentTarget)
            }],
            svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>`,
            icon: "/icons/interfaces/editor.png",
            route: () => div({style: "large-padding-top", content: children([
                    div({id: "editor-text-toolbar", style: "bordered shadowed radius small-padding blurred", content: div({style: "faded", content: children([
                                searchComboBox({id: "editor-sheet-font-family", wrapperStyle: "search-combobox-wrapper searchbox-wrapper small-margin-right", style: "inner-radius editor-font-family-combo", value: "Inter", placeholder: "Font", options: TEXT_FONT_FAMILIES.map((fontName) => ({label: fontName, value: fontName}))}),
                                searchComboBox({id: "editor-sheet-font-size", wrapperStyle: "search-combobox-wrapper searchbox-wrapper small-margin-right", style: "inner-radius editor-font-size-combo", value: "12", placeholder: "Size", allow_custom: true, options: TEXT_FONT_SIZES.map((fontSize) => ({label: fontSize, value: fontSize}))}),
                                button({id: "editor-sheet-style-bold", style: "naked align-bottom small-margin-right inner-radius", title: "Bold", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 5.7519531 2.0039062 A 0.750075 0.750075 0 0 0 5.0019531 2.7539062 L 5.0019531 11.703125 A 0.750075 0.750075 0 0 0 5.0019531 11.757812 L 5.0078125 21.257812 A 0.750075 0.750075 0 0 0 5.7578125 22.007812 L 13.505859 22.007812 C 16.534311 22.007812 19.005859 19.536265 19.005859 16.507812 C 19.005859 14.261755 17.639043 12.332811 15.701172 11.480469 C 17.057796 10.528976 18.005859 9.0314614 18.005859 7.2558594 C 18.005859 4.3643887 15.645377 2.0039063 12.753906 2.0039062 L 5.7519531 2.0039062 z M 6.5019531 3.5039062 L 12.753906 3.5039062 C 14.834436 3.5039063 16.505859 5.17533 16.505859 7.2558594 C 16.505859 9.3363887 14.834436 11.007813 12.753906 11.007812 L 6.5019531 11.007812 L 6.5019531 3.5039062 z M 6.5019531 12.507812 L 12.753906 12.507812 L 13.505859 12.507812 C 15.723408 12.507812 17.505859 14.290264 17.505859 16.507812 C 17.505859 18.725361 15.723408 20.507812 13.505859 20.507812 L 6.5058594 20.507812 L 6.5019531 12.507812 z"/></svg>`}),
                                button({id: "editor-sheet-style-italic", style: "naked align-bottom small-margin-right inner-radius", title: "Italicize", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 10 2.0078125 L 10 3.5078125 L 10.75 3.5078125 L 13.119141 3.5078125 L 9.3417969 20.503906 L 6.7558594 20.503906 L 6.0058594 20.503906 L 6.0058594 22.003906 L 6.7558594 22.003906 L 13.2558594 22.003906 L 14.0058594 22.003906 L 14.0058594 20.503906 L 13.2558594 20.503906 L 10.878906 20.503906 L 14.65625 3.5078125 L 17.25 3.5078125 L 18 3.5078125 L 18 2.0078125 L 17.25 2.0078125 L 10.75 2.0078125 L 10 2.0078125 z"/></svg>`}),
                                button({id: "editor-sheet-style-underline", style: "naked align-bottom small-margin-right inner-radius", title: "Underline", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 6.0058594 2 L 6.0058594 2.75 L 6.0058594 12.585938 C 6.0058594 15.618894 8.7446099 18.001953 12.003906 18.001953 C 15.263203 18.001953 18.003906 15.618893 18.003906 12.585938 L 18.003906 2.75 L 18.003906 2 L 16.503906 2 L 16.503906 2.75 L 16.503906 12.585938 C 16.503906 14.706981 14.54261 16.501953 12.003906 16.501953 C 9.4652032 16.501953 7.5058594 14.70698 7.5058594 12.585938 L 7.5058594 2.75 L 7.5058594 2 L 6.0058594 2 z M 4.9980469 20.003906 L 4.9980469 21.503906 L 5.7480469 21.503906 L 18.251953 21.503906 L 19.001953 21.503906 L 19.001953 20.003906 L 18.251953 20.003906 L 5.7480469 20.003906 L 4.9980469 20.003906 z"/></svg>`}),
                                button({id: "editor-sheet-style-link", style: "naked align-bottom small-margin-right inner-radius", title: "Hyperlink", icon: TEXT_LINK_ICON}),
                                button({id: "editor-sheet-style-color", style: "naked align-bottom small-margin-right inner-radius", title: "Foreground", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 12.017578 2 A 0.750075 0.750075 0 0 0 11.294922 2.4941406 L 6.0507812 16.996094 A 0.75065194 0.75065194 0 1 0 7.4628906 17.505859 L 8.3691406 14.998047 L 15.638672 14.998047 L 16.546875 17.505859 A 0.750075 0.750075 0 1 0 17.957031 16.996094 L 12.705078 2.4941406 A 0.750075 0.750075 0 0 0 12.017578 2 z M 12 4.9550781 L 15.095703 13.498047 L 8.9121094 13.498047 L 12 4.9550781 z M 5.7480469 20.003906 A 0.750075 0.750075 0 1 0 5.7480469 21.503906 L 18.251953 21.503906 A 0.750075 0.750075 0 1 0 18.251953 20.003906 L 5.7480469 20.003906 z"/></svg>`}),
                                button({id: "editor-sheet-style-background", style: "naked align-bottom small-margin-right inner-radius", title: "Background", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 9.0996094 -0.00390625 A 0.750075 0.750075 0 0 0 8.578125 1.2832031 L 9.9414062 2.6484375 L 3.0214844 9.5722656 C 1.6862427 10.90878 1.6862427 13.097079 3.0214844 14.433594 L 9.5683594 20.984375 C 10.904906 22.320922 13.094894 22.322395 14.431641 20.984375 L 21.880859 13.53125 A 0.750075 0.750075 0 0 0 21.880859 12.472656 L 9.6386719 0.22265625 A 0.750075 0.750075 0 0 0 9.0996094 -0.00390625 z M 11.001953 3.7089844 L 20.289062 13.001953 L 13.371094 19.923828 C 12.60784 20.687809 11.39236 20.687282 10.628906 19.923828 L 4.0820312 13.373047 C 3.319273 12.609561 3.319273 11.396299 4.0820312 10.632812 L 11.001953 3.7089844 z M 8 13.25 A 0.75 0.75 0 0 0 8 14.75 A 0.75 0.75 0 0 0 8 13.25 z M 12 13.25 A 0.75 0.75 0 0 0 12 14.75 A 0.75 0.75 0 0 0 12 13.25 z M 16 13.25 A 0.75 0.75 0 0 0 16 14.75 A 0.75 0.75 0 0 0 16 13.25 z M 10 15.25 A 0.75 0.75 0 0 0 10 16.75 A 0.75 0.75 0 0 0 10 15.25 z M 14 15.25 A 0.75 0.75 0 0 0 14 16.75 A 0.75 0.75 0 0 0 14 15.25 z M 22 17 C 21.596 17 21.232875 17.301656 20.796875 17.972656 C 20.360875 18.643656 20 19.282 20 20 C 20 21.105 20.895 22 22 22 C 23.105 22 24 21.105 24 20 C 24 19.282 23.639125 18.643656 23.203125 17.972656 C 22.767125 17.301656 22.404 17 22 17 z M 12 17.25 A 0.75 0.75 0 0 0 12 18.75 A 0.75 0.75 0 0 0 12 17.25 z"/></svg>`}),
                                button({id: "editor-sheet-style-align", style: "naked align-bottom small-margin-right inner-radius", title: "Alignment", icon: TEXT_ALIGN_ICONS.left}),
                                button({id: "editor-sheet-style-highlight", style: "naked align-bottom small-margin-right inner-radius", title: "Highlight", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 12.494141 1.1171875 C 12.366141 1.1171875 12.238125 1.1661719 12.140625 1.2636719 L 9.1484375 4.2578125 C 8.0944375 5.3118125 7.299125 6.5957656 6.828125 8.0097656 L 5.5742188 11.775391 C 5.4752187 12.069391 5.3098438 12.338594 5.0898438 12.558594 L 3.3027344 14.345703 C 2.9117344 14.736703 2.9117344 15.369766 3.3027344 15.759766 L 3.8554688 16.3125 L 1.2851562 19.009766 C 0.78015625 19.540766 0.99835938 20.416438 1.6933594 20.648438 L 4.6074219 21.591797 C 4.9524219 21.706797 5.3316094 21.625906 5.5996094 21.378906 L 7.328125 19.783203 L 8.2539062 20.708984 C 8.4489063 20.903984 8.7049375 21.001953 8.9609375 21.001953 C 9.2169375 21.001953 9.4729687 20.903984 9.6679688 20.708984 L 11.455078 18.921875 C 11.675078 18.701875 11.941328 18.5355 12.236328 18.4375 L 16.001953 17.183594 C 17.415953 16.712594 18.700859 15.917281 19.755859 14.863281 L 22.748047 11.869141 C 22.943047 11.674141 22.943047 11.357109 22.748047 11.162109 C 22.552047 10.967109 22.236016 10.967109 22.041016 11.162109 L 19.048828 14.15625 C 19.040972 14.164106 19.031323 14.16991 19.023438 14.177734 L 9.8359375 4.9882812 C 9.8431253 4.981042 9.8482537 4.9720588 9.8554688 4.9648438 L 12.847656 1.9707031 C 13.042656 1.7757031 13.042656 1.4586719 12.847656 1.2636719 C 12.750156 1.1661719 12.622141 1.1171875 12.494141 1.1171875 z M 9.171875 5.7382812 L 18.273438 14.841797 C 17.49882 15.44921 16.624226 15.921729 15.685547 16.234375 L 11.919922 17.490234 C 11.477922 17.637234 11.076094 17.884844 10.746094 18.214844 L 8.9609375 20.001953 L 4.0097656 15.052734 L 5.796875 13.265625 C 6.125875 12.936625 6.3734844 12.533797 6.5214844 12.091797 L 7.7773438 8.3261719 C 8.0908498 7.387136 8.5643624 6.513116 9.171875 5.7382812 z"/></svg>`}),
                                button({id: "editor-sheet-style-list", style: "naked align-bottom small-margin-right inner-radius", title: "List", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>`}),
                                button({id: "editor-sheet-style-shape", style: "naked align-bottom small-margin-right inner-radius", title: "Shape", icon: TEXT_SHAPE_ICON}),
                                button({id: "editor-sheet-style-image", style: "naked align-bottom small-margin-right inner-radius", title: "Image", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>`}),
                                button({id: "editor-sheet-style-table", style: "naked align-bottom small-margin-right inner-radius", title: "Table", icon: TEXT_TABLE_ICON}),
                                button({id: "editor-sheet-style-other", style: "naked align-bottom small-margin-right inner-radius", title: "Other", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>`}),
                            ])})
                    }),
                    div({id: "editor-text-stage", style: "small-margin-top", content: children([
                        div({id: "editor-text-page-measure"}),
                        div({id: "editor-text-page-backdrop"}),
                        div({id: "editor-text-content", style: "padded", contenteditable: true, content: activeTextEditorContent || "Edit Me"})
                    ])})
                ])
            }),
            afterRender: function () {
                restoreEditorWindowState(this.portal);
                updateTextEditorView(this.portal);
                bindTextEditorInteractions(this.portal);
                requestAnimationFrame(() => focusTextEditorAtEnd(this.portal));
            }
        })
    ]));
})();
