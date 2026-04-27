(async () => {
    const SERVICE_ID = "com.standard.editor.text";
    const TEXT_FONT_FAMILIES = ["Inter", "Georgia", "Times New Roman", "Courier New", "Verdana"];
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
    const TEXT_PAGE_VIEW_HEIGHT_PX = 1056;
    const TEXT_PAGE_VIEW_PADDING_PX = 72;
    const TEXT_PAGE_VIEW_GAP_PX = 28;
    const TEXT_PAGE_VIEW_CONTENT_HEIGHT_PX = TEXT_PAGE_VIEW_HEIGHT_PX - (TEXT_PAGE_VIEW_PADDING_PX * 2);
    const TEXT_PAGE_VIEW_BREAK_SPACER_PX = (TEXT_PAGE_VIEW_PADDING_PX * 2) + TEXT_PAGE_VIEW_GAP_PX;
    const TEXT_INPUT_SYNC_DEBOUNCE_MS = 120;
    const TEXT_ALIGN_ICONS = {
        left: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" d="M4 6.5h16M4 10.5h10M4 14.5h16M4 18.5h10" /></svg>`,
        center: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" d="M4 6.5h16M7 10.5h10M4 14.5h16M7 18.5h10" /></svg>`,
        right: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" d="M4 6.5h16M10 10.5h10M4 14.5h16M10 18.5h10" /></svg>`
    };
    let activeTextEditorFilePath = "";
    let activeTextEditorContent = "";
    let skipNextTextStateRestore = false;
    let savedTextSelectionRange = null;
    let textEditorSelectionChangeBound = false;
    let activeTextImageFrame = null;
    let activeTextImageResizeState = null;
    let activeTextPageViewEnabled = false;
    let textEditorDeferredSyncTimer = null;
    let textEditorLastRenderedPageCount = 0;
    const resolvedTextColorCache = new Map();
    const findTextPortal = () => [...Array.from(document.querySelectorAll(".draggable-window"))]
        .reverse()
        .find((windowNode) => windowNode?.portal?.serviceId?.() === SERVICE_ID)
        ?.portal;
    const findTextEditorNode = () => document.getElementById("editor-text-content");
    const findTextEditorStage = () => document.getElementById("editor-text-stage");
    const findTextEditorPageBackdrop = () => document.getElementById("editor-text-page-backdrop");
    const findTextEditorPageMeasure = () => document.getElementById("editor-text-page-measure");
    const normalizeTextFilePath = (rawPath = "") => String(rawPath || "").replace(/^\/home\/standard-system\//, "").replace(/^\/+/, "");
    const getTextFileName = (rawPath = "") => String(rawPath || "").split("/").pop() || "Text";
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
        const storedPreference = getStoredTextDocumentPageViewPreference(rawPath);
        activeTextPageViewEnabled = typeof storedPreference === "boolean" ? storedPreference : !!fallback;
        return activeTextPageViewEnabled;
    };
    const shouldHideTextEditorBar = (rawPath = "") => {
        const fileName = getTextFileName(rawPath).toLowerCase();
        const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
        return extension === "txt" || extension === "md";
    };
    const isRichTextDocument = (rawPath = activeTextEditorFilePath) => !shouldHideTextEditorBar(rawPath);
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
        clone.querySelectorAll("[data-editor-image-selected=\"1\"]").forEach((node) => node.removeAttribute("data-editor-image-selected"));
        return clone.innerHTML;
    };
    const readTextEditorContent = (textArea = findTextEditorNode()) => {
        if (!textArea) return activeTextEditorContent;
        return isRichTextDocument() ? serializeTextEditorRichContent(textArea) : textArea.innerText;
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
        activeTextImageFrame = frameNode;
        frameNode.dataset.editorImageSelected = "1";
        frameNode.style.outline = "2px solid var(--blue)";
        frameNode.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.12)";
        ["nw", "ne", "sw", "se"].forEach((position) => frameNode.appendChild(createTextEditorImageHandle(position)));
        updateTextToolbarState();
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
            prepareEditorLinks(textArea);
            return;
        }
        if (textArea.textContent !== nextContent) textArea.textContent = nextContent;
    };
    const syncEditorWindowState = (portal = findTextPortal()) => {
        if (!portal || typeof portal.setWindowState !== "function") return;
        portal.setWindowState({
            directive: activeTextEditorFilePath,
            cachedContent: activeTextEditorContent,
            pageViewEnabled: activeTextPageViewEnabled
        });
    };
    const restoreEditorWindowState = (portal = findTextPortal()) => {
        if (skipNextTextStateRestore) {
            skipNextTextStateRestore = false;
            return;
        }
        const state = portal?.windowState?.() || {};
        if (state?.directive) activeTextEditorFilePath = normalizeTextFilePath(state.directive);
        if (typeof state?.cachedContent === "string") activeTextEditorContent = state.cachedContent;
        loadTextDocumentPageViewPreference(activeTextEditorFilePath, state?.pageViewEnabled === true);
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
            && !savedTextSelectionRange.commonAncestorContainer?.closest?.(".editor-text-image-frame")) {
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
        const range = getActiveTextSelectionRange();
        if (!range) return false;
        const linkNode = document.createElement("a");
        linkNode.href = url;
        linkNode.textContent = text;
        prepareEditorLinkNode(linkNode);
        range.deleteContents();
        range.insertNode(linkNode);
        const selection = window.getSelection();
        range.setStartAfter(linkNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        savedTextSelectionRange = range.cloneRange();
        syncTextEditorStateFromDom();
        return true;
    };
    const showTextEditorHyperlinkDialogue = () => {
        if (!isRichTextDocument()) return false;
        restoreTextSelection();
        const selectedText = getTextSelectionPlainText().trim();
        if (!selectedText) return false;
        rememberTextSelection();
        inputDialogue({
            title: "Hyperlink",
            titleholder: "Text",
            title_entry: true,
            title_value: selectedText,
            placeholder: "Link",
            confirmation: (textValue, linkValue) => {
                if (!applyTextEditorHyperlink(textValue, linkValue)) modular.error("Select text and enter a link");
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
        let node = selection.getRangeAt(0).startContainer;
        if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
        return node?.nodeType === Node.ELEMENT_NODE ? node : editorNode;
    };
    const getTextSelectionBlockTarget = (node) => {
        const editorNode = findTextEditorNode();
        let current = node;
        while (current && current !== editorNode) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                const display = getComputedStyle(current).display;
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
        return TEXT_FONT_SIZES.reduce((bestOption, option) => {
            return Math.abs(Number(option) - numericValue) < Math.abs(Number(bestOption) - numericValue) ? option : bestOption;
        }, "12");
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
        return TEXT_FONT_FAMILIES.includes(primaryFont) ? primaryFont : "Inter";
    };
    const updateTextToolbarState = () => {
        const editorNode = findTextEditorNode();
        const fontFamilySelect = document.getElementById("editor-sheet-font-family");
        const fontSizeSelect = document.getElementById("editor-sheet-font-size");
        const boldButton = document.getElementById("editor-sheet-style-bold");
        const italicButton = document.getElementById("editor-sheet-style-italic");
        const underlineButton = document.getElementById("editor-sheet-style-underline");
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
        const fontWeightValue = Number(style.fontWeight);
        const isBold = style.fontWeight === "bold" || Number.isFinite(fontWeightValue) && fontWeightValue >= 600;
        const textDecorationLine = String(style.textDecorationLine || style.textDecoration || "");
        const textColor = style.color && style.color !== "rgba(0, 0, 0, 0)" ? style.color : "";
        const backgroundColor = style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)" ? style.backgroundColor : "";
        const alignment = ["center", "right"].includes(blockStyle.textAlign) ? blockStyle.textAlign : "left";
        if (fontFamilySelect) fontFamilySelect.value = normalizeFontFamilyForToolbar(style.fontFamily);
        if (fontSizeSelect) fontSizeSelect.value = mapComputedFontSizeToToolbarValue(style.fontSize);
        setTextToolbarButtonState(boldButton, isBold);
        setTextToolbarButtonState(italicButton, style.fontStyle === "italic" || style.fontStyle === "oblique");
        setTextToolbarButtonState(underlineButton, textDecorationLine.includes("underline"));
        syncTextToolbarIconColor(boldButton);
        syncTextToolbarIconColor(italicButton);
        syncTextToolbarIconColor(underlineButton);
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
    const runTextEditorStateSync = () => {
        activeTextEditorContent = readTextEditorContent();
        if (activeTextPageViewEnabled) applyTextEditorPageView(true);
        syncEditorWindowState();
        updateTextToolbarState();
    };
    const syncTextEditorStateFromDom = ({deferHeavyWork = false} = {}) => {
        if (!deferHeavyWork) {
            if (textEditorDeferredSyncTimer) {
                window.clearTimeout(textEditorDeferredSyncTimer);
                textEditorDeferredSyncTimer = null;
            }
            runTextEditorStateSync();
            return;
        }
        updateTextToolbarState();
        if (textEditorDeferredSyncTimer) window.clearTimeout(textEditorDeferredSyncTimer);
        textEditorDeferredSyncTimer = window.setTimeout(() => {
            textEditorDeferredSyncTimer = null;
            runTextEditorStateSync();
        }, TEXT_INPUT_SYNC_DEBOUNCE_MS);
    };
    const execTextEditorCommand = (command, value = null) => {
        const textArea = findTextEditorNode();
        if (!textArea || shouldHideTextEditorBar(activeTextEditorFilePath)) return false;
        restoreTextSelection();
        textArea.focus();
        document.execCommand("styleWithCSS", false, true);
        const didApply = value === null
            ? document.execCommand(command, false, null)
            : document.execCommand(command, false, value);
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
        if (textEditorLastRenderedPageCount !== totalPages) {
            backdropNode.innerHTML = Array.from({length: totalPages}, (_, index) => {
                return `<div class="editor-text-page-card" data-page-number="${index + 1}" style="height:${TEXT_PAGE_VIEW_HEIGHT_PX}px;"></div>`;
            }).join("");
            textEditorLastRenderedPageCount = totalPages;
        }
        stageNode.classList.toggle("editor-text-stage-page-view", activeTextPageViewEnabled);
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
    const applyTextEditorPageView = (enabled = activeTextPageViewEnabled, textArea = findTextEditorNode()) => {
        if (!textArea) return false;
        const stageNode = findTextEditorStage();
        const backdropNode = findTextEditorPageBackdrop();
        const measureNode = findTextEditorPageMeasure();
        const pageViewEnabled = !!enabled;
        const requiredPages = pageViewEnabled ? paginateTextEditorFlow(textArea) : 1;
        const totalPageHeight = requiredPages > 0
            ? (requiredPages * TEXT_PAGE_VIEW_HEIGHT_PX) + ((requiredPages - 1) * TEXT_PAGE_VIEW_GAP_PX)
            : TEXT_PAGE_VIEW_HEIGHT_PX;
        if (!pageViewEnabled) clearTextEditorPageBreakSpacers(textArea);
        renderTextEditorPageBackdrop(requiredPages, stageNode, backdropNode);
        textArea.classList.toggle("editor-text-page-view", pageViewEnabled);
        if (stageNode) {
            stageNode.style.width = pageViewEnabled ? `min(100%, ${TEXT_PAGE_VIEW_WIDTH})` : "";
            stageNode.style.maxWidth = pageViewEnabled ? TEXT_PAGE_VIEW_WIDTH : "";
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
        textArea.style.width = pageViewEnabled ? `min(100%, ${TEXT_PAGE_VIEW_WIDTH})` : "";
        textArea.style.maxWidth = pageViewEnabled ? TEXT_PAGE_VIEW_WIDTH : "";
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
        return true;
    };
    const toggleTextEditorPageView = (enabled = !activeTextPageViewEnabled, portal = findTextPortal()) => {
        activeTextPageViewEnabled = !!enabled;
        if (activeTextEditorFilePath) persistTextDocumentPageViewPreference(activeTextEditorFilePath, activeTextPageViewEnabled);
        applyTextEditorPageView(activeTextPageViewEnabled);
        syncEditorWindowState(portal);
        updateTextToolbarState();
        return activeTextPageViewEnabled;
    };
    const bindTextEditorInteractions = () => {
        const textArea = findTextEditorNode();
        const fontFamilySelect = document.getElementById("editor-sheet-font-family");
        const fontSizeSelect = document.getElementById("editor-sheet-font-size");
        const boldButton = document.getElementById("editor-sheet-style-bold");
        const italicButton = document.getElementById("editor-sheet-style-italic");
        const underlineButton = document.getElementById("editor-sheet-style-underline");
        const textColorButton = document.getElementById("editor-sheet-style-color");
        const backgroundColorButton = document.getElementById("editor-sheet-style-background");
        const alignmentButton = document.getElementById("editor-sheet-style-align");
        const highlightButton = document.getElementById("editor-sheet-style-highlight");
        const listButton = document.getElementById("editor-sheet-style-list");
        const imageButton = document.getElementById("editor-sheet-style-image");
        const otherButton = document.getElementById("editor-sheet-style-other");
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
                return;
            }
            handleTextEditorEnterKey(event);
        });
        textArea.contextmenu([{
            label: "Hyperlink",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 6.364 6.364l-1.77 1.768a4.5 4.5 0 0 1-6.364 0M10.81 15.312a4.5 4.5 0 0 1-6.364-6.364l1.77-1.768a4.5 4.5 0 0 1 6.364 0M8.25 12h7.5" /></svg>`,
            visible: () => hasHighlightedTextSelection() && isRichTextDocument(),
            action: () => showTextEditorHyperlinkDialogue()
        }]);
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
            syncTextEditorStateFromDom({deferHeavyWork: true});
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
            if (!frameNode) {
                clearActiveTextImageSelection();
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            selectTextEditorImageFrame(frameNode);
            textArea.focus();
        });
        textArea.addEventListener("focusout", () => {
            window.setTimeout(() => {
                const editorNode = findTextEditorNode();
                if (!editorNode?.contains(document.activeElement)) clearActiveTextImageSelection();
            }, 0);
        });
        textArea.addEventListener("mousedown", (event) => {
            const handleNode = event.target?.closest?.(".editor-text-image-handle");
            if (!handleNode) return;
            const frameNode = handleNode.closest(".editor-text-image-frame");
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
                if (!activeTextImageResizeState) return;
                activeTextImageResizeState = null;
                rememberTextSelection();
                syncTextEditorStateFromDom();
            });
            document.addEventListener("mousedown", (event) => {
                if (event.target?.closest?.(".editor-text-image-frame")) return;
                clearActiveTextImageSelection();
            });
        }
        [boldButton, italicButton, underlineButton, textColorButton, backgroundColorButton, alignmentButton, highlightButton, listButton, imageButton, otherButton].forEach(bindTextToolbarButtonFocus);
        if (fontFamilySelect && fontFamilySelect.dataset.bound !== "1") {
            fontFamilySelect.dataset.bound = "1";
            fontFamilySelect.addEventListener("change", () => execTextEditorCommand("fontName", fontFamilySelect.value || "Inter"));
        }
        if (fontSizeSelect && fontSizeSelect.dataset.bound !== "1") {
            fontSizeSelect.dataset.bound = "1";
            fontSizeSelect.addEventListener("change", () => execTextEditorCommand("fontSize", getLegacyTextFontSizeValue(fontSizeSelect.value || "12")));
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
        if (otherButton && otherButton.dataset.bound !== "1") {
            otherButton.dataset.bound = "1";
            otherButton.popoutmenu([{
                className: "context-menu-item-switch",
                content: children([
                    div({style: "inline", content: children([
                        `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon space-right" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3.75h10.5A2.25 2.25 0 0 1 19.5 6v12a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 18V6a2.25 2.25 0 0 1 2.25-2.25Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5h7.5M8.25 10.5h7.5M8.25 13.5h7.5M8.25 16.5h4.5" /></svg>`,
                        `<span>Display As Pages</span>`
                    ])}),
                    switcher({id: "editor-text-page-view-toggle", style: "menu-switcher", checked: activeTextPageViewEnabled})
                ]),
                action: () => toggleTextEditorPageView()
            }]);
        }
        updateTextToolbarState();
    };
    const updateTextEditorView = (portal = findTextPortal()) => {
        const pathLabel = document.getElementById("editor-text-path");
        if (pathLabel) pathLabel.textContent = activeTextEditorFilePath || "No file loaded";
        writeTextEditorContent();
        applyTextEditorPageView(activeTextPageViewEnabled);
        const textToolbar = document.getElementById("editor-text-toolbar");
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
        activeTextEditorFilePath = normalizedPath;
        activeTextEditorContent = readTextEditorContent();
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
                const safeFileName = sanitizeNewTextFileName(inputFileName) || "standard.wrds";
                await saveTextEditorContentToPath(`Documents/${safeFileName}`, portal);
            }
        });
    };
    const saveLoadedTextFile = async (portal = findTextPortal()) => {
        if (!activeTextEditorFilePath) {
            saveNewTextFileToDocuments(portal);
            return;
        }
        await saveTextEditorContentToPath(activeTextEditorFilePath, portal);
    };
    const openFreshTextEditor = (sourceNode = null) => {
        activeTextEditorFilePath = "";
        activeTextEditorContent = "Edit Me";
        activeTextPageViewEnabled = false;
        clearActiveTextImageSelection({skipSync: true});
        skipNextTextStateRestore = true;
        const portal = modular.show(SERVICE_ID, 0, {newInstance: true});
        syncEditorWindowState(portal);
        updateTextEditorView(portal);
        return true;
    };
    window.StandardEditor = window.StandardEditor || {};
    window.StandardEditor.openFreshTextEditor = openFreshTextEditor;
    window.StandardEditor.openTextFilePath = (rawPath = "", content = "", sourceNode = null) => {
        activeTextEditorFilePath = normalizeTextFilePath(rawPath);
        loadTextDocumentPageViewPreference(activeTextEditorFilePath, false);
        activeTextEditorContent = decodeTextEditorLoadedContent(content);
        clearActiveTextImageSelection({skipSync: true});
        skipNextTextStateRestore = true;
        const portal = modular.start(SERVICE_ID);
        syncEditorWindowState(portal);
        updateTextEditorView(portal);
        return true;
    };
    modular.register(new Service(SERVICE_ID, [
        new Portal({
            title: "Text",
            hints: ["text editor", "create text file", "new text file"],
            action: openFreshTextEditor,
            dimensions: [700, 500],
            horizontal_nav: true,
            centered_nav: true,
            tools: [{
                title: "Save",
                icon: modular.icons.save,
                onclick: (_, context) => saveLoadedTextFile(context?.portal)
            }],
            svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>`,
            icon: "/icons/interfaces/editor.png",
            route: () => div({style: "large-padding-top", content: children([
                    div({id: "editor-text-toolbar", style: "bordered shadowed radius small-padding blurred", content: div({style: "faded", content: children([
                                select({id: "editor-sheet-font-family", style: "small-margin-right inner-radius", value: "Inter", options: TEXT_FONT_FAMILIES.map((fontName) => ({label: fontName, value: fontName}))}),
                                select({id: "editor-sheet-font-size", style: "small-margin-right inner-radius", value: "12", options: TEXT_FONT_SIZES.map((fontSize) => ({label: fontSize, value: fontSize}))}),
                                button({id: "editor-sheet-style-bold", style: "naked align-bottom small-margin-right inner-radius", title: "Bold", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 5.7519531 2.0039062 A 0.750075 0.750075 0 0 0 5.0019531 2.7539062 L 5.0019531 11.703125 A 0.750075 0.750075 0 0 0 5.0019531 11.757812 L 5.0078125 21.257812 A 0.750075 0.750075 0 0 0 5.7578125 22.007812 L 13.505859 22.007812 C 16.534311 22.007812 19.005859 19.536265 19.005859 16.507812 C 19.005859 14.261755 17.639043 12.332811 15.701172 11.480469 C 17.057796 10.528976 18.005859 9.0314614 18.005859 7.2558594 C 18.005859 4.3643887 15.645377 2.0039063 12.753906 2.0039062 L 5.7519531 2.0039062 z M 6.5019531 3.5039062 L 12.753906 3.5039062 C 14.834436 3.5039063 16.505859 5.17533 16.505859 7.2558594 C 16.505859 9.3363887 14.834436 11.007813 12.753906 11.007812 L 6.5019531 11.007812 L 6.5019531 3.5039062 z M 6.5019531 12.507812 L 12.753906 12.507812 L 13.505859 12.507812 C 15.723408 12.507812 17.505859 14.290264 17.505859 16.507812 C 17.505859 18.725361 15.723408 20.507812 13.505859 20.507812 L 6.5058594 20.507812 L 6.5019531 12.507812 z"/></svg>`}),
                                button({id: "editor-sheet-style-italic", style: "naked align-bottom small-margin-right inner-radius", title: "Italicize", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 10 2.0078125 L 10 3.5078125 L 10.75 3.5078125 L 13.119141 3.5078125 L 9.3417969 20.503906 L 6.7558594 20.503906 L 6.0058594 20.503906 L 6.0058594 22.003906 L 6.7558594 22.003906 L 13.2558594 22.003906 L 14.0058594 22.003906 L 14.0058594 20.503906 L 13.2558594 20.503906 L 10.878906 20.503906 L 14.65625 3.5078125 L 17.25 3.5078125 L 18 3.5078125 L 18 2.0078125 L 17.25 2.0078125 L 10.75 2.0078125 L 10 2.0078125 z"/></svg>`}),
                                button({id: "editor-sheet-style-underline", style: "naked align-bottom small-margin-right inner-radius", title: "Underline", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 6.0058594 2 L 6.0058594 2.75 L 6.0058594 12.585938 C 6.0058594 15.618894 8.7446099 18.001953 12.003906 18.001953 C 15.263203 18.001953 18.003906 15.618893 18.003906 12.585938 L 18.003906 2.75 L 18.003906 2 L 16.503906 2 L 16.503906 2.75 L 16.503906 12.585938 C 16.503906 14.706981 14.54261 16.501953 12.003906 16.501953 C 9.4652032 16.501953 7.5058594 14.70698 7.5058594 12.585938 L 7.5058594 2.75 L 7.5058594 2 L 6.0058594 2 z M 4.9980469 20.003906 L 4.9980469 21.503906 L 5.7480469 21.503906 L 18.251953 21.503906 L 19.001953 21.503906 L 19.001953 20.003906 L 18.251953 20.003906 L 5.7480469 20.003906 L 4.9980469 20.003906 z"/></svg>`}),
                                button({id: "editor-sheet-style-color", style: "naked align-bottom small-margin-right inner-radius", title: "Foreground", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 12.017578 2 A 0.750075 0.750075 0 0 0 11.294922 2.4941406 L 6.0507812 16.996094 A 0.75065194 0.75065194 0 1 0 7.4628906 17.505859 L 8.3691406 14.998047 L 15.638672 14.998047 L 16.546875 17.505859 A 0.750075 0.750075 0 1 0 17.957031 16.996094 L 12.705078 2.4941406 A 0.750075 0.750075 0 0 0 12.017578 2 z M 12 4.9550781 L 15.095703 13.498047 L 8.9121094 13.498047 L 12 4.9550781 z M 5.7480469 20.003906 A 0.750075 0.750075 0 1 0 5.7480469 21.503906 L 18.251953 21.503906 A 0.750075 0.750075 0 1 0 18.251953 20.003906 L 5.7480469 20.003906 z"/></svg>`}),
                                button({id: "editor-sheet-style-background", style: "naked align-bottom small-margin-right inner-radius", title: "Background", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 9.0996094 -0.00390625 A 0.750075 0.750075 0 0 0 8.578125 1.2832031 L 9.9414062 2.6484375 L 3.0214844 9.5722656 C 1.6862427 10.90878 1.6862427 13.097079 3.0214844 14.433594 L 9.5683594 20.984375 C 10.904906 22.320922 13.094894 22.322395 14.431641 20.984375 L 21.880859 13.53125 A 0.750075 0.750075 0 0 0 21.880859 12.472656 L 9.6386719 0.22265625 A 0.750075 0.750075 0 0 0 9.0996094 -0.00390625 z M 11.001953 3.7089844 L 20.289062 13.001953 L 13.371094 19.923828 C 12.60784 20.687809 11.39236 20.687282 10.628906 19.923828 L 4.0820312 13.373047 C 3.319273 12.609561 3.319273 11.396299 4.0820312 10.632812 L 11.001953 3.7089844 z M 8 13.25 A 0.75 0.75 0 0 0 8 14.75 A 0.75 0.75 0 0 0 8 13.25 z M 12 13.25 A 0.75 0.75 0 0 0 12 14.75 A 0.75 0.75 0 0 0 12 13.25 z M 16 13.25 A 0.75 0.75 0 0 0 16 14.75 A 0.75 0.75 0 0 0 16 13.25 z M 10 15.25 A 0.75 0.75 0 0 0 10 16.75 A 0.75 0.75 0 0 0 10 15.25 z M 14 15.25 A 0.75 0.75 0 0 0 14 16.75 A 0.75 0.75 0 0 0 14 15.25 z M 22 17 C 21.596 17 21.232875 17.301656 20.796875 17.972656 C 20.360875 18.643656 20 19.282 20 20 C 20 21.105 20.895 22 22 22 C 23.105 22 24 21.105 24 20 C 24 19.282 23.639125 18.643656 23.203125 17.972656 C 22.767125 17.301656 22.404 17 22 17 z M 12 17.25 A 0.75 0.75 0 0 0 12 18.75 A 0.75 0.75 0 0 0 12 17.25 z"/></svg>`}),
                                button({id: "editor-sheet-style-align", style: "naked align-bottom small-margin-right inner-radius", title: "Alignment", icon: TEXT_ALIGN_ICONS.left}),
                                button({id: "editor-sheet-style-highlight", style: "naked align-bottom small-margin-right inner-radius", title: "Highlight", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 12.494141 1.1171875 C 12.366141 1.1171875 12.238125 1.1661719 12.140625 1.2636719 L 9.1484375 4.2578125 C 8.0944375 5.3118125 7.299125 6.5957656 6.828125 8.0097656 L 5.5742188 11.775391 C 5.4752187 12.069391 5.3098438 12.338594 5.0898438 12.558594 L 3.3027344 14.345703 C 2.9117344 14.736703 2.9117344 15.369766 3.3027344 15.759766 L 3.8554688 16.3125 L 1.2851562 19.009766 C 0.78015625 19.540766 0.99835938 20.416438 1.6933594 20.648438 L 4.6074219 21.591797 C 4.9524219 21.706797 5.3316094 21.625906 5.5996094 21.378906 L 7.328125 19.783203 L 8.2539062 20.708984 C 8.4489063 20.903984 8.7049375 21.001953 8.9609375 21.001953 C 9.2169375 21.001953 9.4729687 20.903984 9.6679688 20.708984 L 11.455078 18.921875 C 11.675078 18.701875 11.941328 18.5355 12.236328 18.4375 L 16.001953 17.183594 C 17.415953 16.712594 18.700859 15.917281 19.755859 14.863281 L 22.748047 11.869141 C 22.943047 11.674141 22.943047 11.357109 22.748047 11.162109 C 22.552047 10.967109 22.236016 10.967109 22.041016 11.162109 L 19.048828 14.15625 C 19.040972 14.164106 19.031323 14.16991 19.023438 14.177734 L 9.8359375 4.9882812 C 9.8431253 4.981042 9.8482537 4.9720588 9.8554688 4.9648438 L 12.847656 1.9707031 C 13.042656 1.7757031 13.042656 1.4586719 12.847656 1.2636719 C 12.750156 1.1661719 12.622141 1.1171875 12.494141 1.1171875 z M 9.171875 5.7382812 L 18.273438 14.841797 C 17.49882 15.44921 16.624226 15.921729 15.685547 16.234375 L 11.919922 17.490234 C 11.477922 17.637234 11.076094 17.884844 10.746094 18.214844 L 8.9609375 20.001953 L 4.0097656 15.052734 L 5.796875 13.265625 C 6.125875 12.936625 6.3734844 12.533797 6.5214844 12.091797 L 7.7773438 8.3261719 C 8.0908498 7.387136 8.5643624 6.513116 9.171875 5.7382812 z"/></svg>`}),
                                button({id: "editor-sheet-style-list", style: "naked align-bottom small-margin-right inner-radius", title: "List", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>`}),
                                button({id: "editor-sheet-style-image", style: "naked align-bottom small-margin-right inner-radius", title: "Image", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>`}),
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
                bindTextEditorInteractions();
            }
        })
    ]));
})();
