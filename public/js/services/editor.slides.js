(() => {

    const SERVICE_ID = "com.standard.editor.slides";
    const SLIDE_GRID_SIZE = 20;
    const SLIDE_BORDER_DRAG_HIT_SIZE = 8;
    const SLIDE_TEXT_STYLE_KEYS = ["fontWeight", "fontStyle", "textDecoration", "fontFamily", "color", "backgroundColor", "fontSize"];
    const SLIDE_CHART_DEFAULT_WIDTH = 360;
    const SLIDE_CHART_DEFAULT_HEIGHT = 240;
    const SLIDE_CHART_MIN_WIDTH = 180;
    const SLIDE_CHART_MIN_HEIGHT = 140;
    const SLIDE_SHAPE_DEFAULT_WIDTH = 200;
    const SLIDE_SHAPE_DEFAULT_HEIGHT = 120;
    const SLIDE_SHAPE_TYPES = ["rectangle", "rounded-rectangle", "ellipse", "triangle", "diamond"];
    const SLIDE_PRESENT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"/></svg>`;
    const SLIDE_ADD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>`;

    const SLIDE_EDITOR_SETTINGS = {
        default_background: {label: "Default slide background", type: "text", default: ""},
        show_grid: {label: "Show grid by default", type: "boolean", default: true},
        snap_to_grid: {label: "Snap to grid", type: "boolean", default: true},
        show_layers: {label: "Show Layers pane by default", type: "boolean", default: false}
    };

    const SLIDE_CHART_DEFAULT_DATA = [
        {label: "Q1", value: 24},
        {label: "Q2", value: 38},
        {label: "Q3", value: 31},
        {label: "Q4", value: 46}
    ];

    let activeSlideDeck = [{id: 1, title: "Slide 1", blocks: []}];
    let activeSlideId = 1;
    let selectedSlideBlockId = null;
    let slideDeckCounter = 2;
    let slideBlockCounter = 1;
    let activeSlideDeckFilePath = "";
    let draggingSlideId = null;
    let slideInlineStyleRequest = 0;
    let slideBackgroundMenuOpen = false;
    let slideOptionsMenuOpen = false;
    let slideGridVisible = true;
    let slideSnapToGrid = true;
    let slideDefaultBackground = null;
    let slideGridDefaultPending = true;
    let slideSnapDefaultPending = true;
    let slideBackgroundDefaultPending = true;
    let slideLayersDefaultPending = true;
    let slideForceViewDefaults = false;
    let slideForceDefaultBackground = false;
    let slidePresentationActive = false;
    let slidePresentationIndex = 0;
    let slideLayersVisible = false;
    let draggingSlideBlockId = null;
    let suppressSlideLayerClickUntil = 0;
    let savedSlideSelectionOffsets = null;
    const resolvedSlideColorCache = new Map();
    const findSlidesPortal = () => [...Array.from(document.querySelectorAll(".draggable-window"))].reverse().find((windowNode) => windowNode?.portal?.serviceId?.() === SERVICE_ID)?.portal;
    const prioritizePortalDomForLegacyLookups = (portal = null) => {
        const windowNode = portal?.window?.();
        const parentNode = windowNode?.parentElement;
        if (!windowNode || !parentNode || parentNode.firstElementChild === windowNode) return;
        parentNode.insertBefore(windowNode, parentNode.firstElementChild);
        if (typeof modular?.bringToFront === "function") modular.bringToFront(windowNode);
    };

    const normalizeSlidesFilePath = (rawPath = "") => String(rawPath || "").replace(/^\/home\/standard-system\//, "").replace(/^\/+/, "");

    const getSlidesFileName = (rawPath = "") => String(rawPath || "").split("/").pop() || "";

    const getSlidesFileDirectory = (rawPath = "") => {
        const normalizedPath = normalizeSlidesFilePath(rawPath);
        if (!normalizedPath.includes("/")) return "";
        return normalizedPath.split("/").slice(0, -1).join("/");
    };

    const ensureSlidesExtension = (rawName = "") => /\.slds$/i.test(String(rawName || "")) ? String(rawName || "") : `${String(rawName || "")}.slds`;

    const sanitizeSlidesFileName = (rawName = "") => {
        const trimmedName = String(rawName || "").trim().replace(/\\/g, "/");
        const baseName = trimmedName.split("/").pop() || "";
        const withoutLeadingDots = baseName.replace(/^\.+/, "");
        return ensureSlidesExtension(withoutLeadingDots.replace(/[^a-zA-Z0-9._-]/g, ""));
    };

    const normalizeSlideTextStyle = (rawStyle = {}) => {
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
        const fontFamily = String(rawStyle.fontFamily || rawStyle.f || "").trim();
        if (fontFamily) normalizedStyle.fontFamily = fontFamily;
        const color = String(rawStyle.color || rawStyle.c || "").trim();
        if (color && color !== "transparent") normalizedStyle.color = color;
        const backgroundColor = String(rawStyle.backgroundColor || rawStyle.g || "").trim();
        if (backgroundColor && backgroundColor !== "transparent") normalizedStyle.backgroundColor = backgroundColor;
        const rawFontSize = rawStyle.fontSize || rawStyle.s || "";
        const numericFontSize = Number(String(rawFontSize).replace(/px$/i, ""));
        if (Number.isFinite(numericFontSize) && numericFontSize >= 1 && numericFontSize <= 400) normalizedStyle.fontSize = `${Math.round(numericFontSize * 10) / 10}px`;
        return normalizedStyle;
    };

    const normalizeSlideFontSizeInput = (rawFontSize = "") => {
        const numericValue = Number(String(rawFontSize || "").replace(/px$/i, "").trim());
        if (!Number.isFinite(numericValue)) return "";
        const boundedValue = Math.max(1, Math.min(400, numericValue));
        return `${Math.round(boundedValue * 10) / 10}`.replace(/\.0$/, "");
    };

    const encodeSlideTextStyle = (rawStyle = {}) => {
        const normalizedStyle = normalizeSlideTextStyle(rawStyle);
        const encodedStyle = {};
        if (normalizedStyle.textAlign) encodedStyle.a = normalizedStyle.textAlign;
        if (normalizedStyle.fontWeight === "bold") encodedStyle.b = 1;
        if (normalizedStyle.fontStyle === "italic") encodedStyle.i = 1;
        if (normalizedStyle.textDecoration === "underline") encodedStyle.u = 1;
        if (normalizedStyle.fontFamily) encodedStyle.f = normalizedStyle.fontFamily;
        if (normalizedStyle.color) encodedStyle.c = normalizedStyle.color;
        if (normalizedStyle.backgroundColor) encodedStyle.g = normalizedStyle.backgroundColor;
        if (normalizedStyle.fontSize) encodedStyle.s = Number(String(normalizedStyle.fontSize).replace(/px$/i, ""));
        return encodedStyle;
    };

    const slideTextStylesEqual = (left = {}, right = {}) => JSON.stringify(encodeSlideTextStyle(left)) === JSON.stringify(encodeSlideTextStyle(right));

    const compactSlideTextRuns = (rawRuns = []) => {
        const compactedRuns = [];
        rawRuns.forEach((run) => {
            const text = String(run?.text ?? run?.t ?? "");
            if (!text) return;
            const style = normalizeSlideTextStyle(run?.style || run?.s || {});
            const previousRun = compactedRuns[compactedRuns.length - 1];
            if (previousRun && slideTextStylesEqual(previousRun.style, style)) {
                previousRun.text += text;
                return;
            }
            compactedRuns.push({text, style});
        });
        return compactedRuns;
    };

    const normalizeSlideTextRuns = (rawRuns = [], fallbackText = "") => {
        if (!Array.isArray(rawRuns) || !rawRuns.length) return fallbackText ? [{text: String(fallbackText), style: {}}] : [];
        return compactSlideTextRuns(rawRuns);
    };

    const encodeSlideTextRuns = (rawRuns = [], fallbackText = "") => compactSlideTextRuns(normalizeSlideTextRuns(rawRuns, fallbackText)).map((run) => {
        const encodedRun = {t: run.text};
        const encodedStyle = encodeSlideTextStyle(run.style);
        if (Object.keys(encodedStyle).length) encodedRun.s = encodedStyle;
        return encodedRun;
    });

    const getSlidePlainTextFromRuns = (rawRuns = []) => compactSlideTextRuns(rawRuns).map((run) => run.text).join("");
    const getSlideTextLength = (block = {}) => getSlidePlainTextFromRuns(block.runs || []).length || String(block.content || "").length;
    const getActiveSlide = () => activeSlideDeck.find((slide) => slide.id === activeSlideId) || null;
    const getActiveSlideIndex = () => {
        const index = activeSlideDeck.findIndex((slide) => slide.id === activeSlideId);
        return index >= 0 ? index : 0;
    };

    const normalizeSlideBackground = (rawBackground = null) => {
        if (!rawBackground || typeof rawBackground !== "object" || Array.isArray(rawBackground)) return null;
        const type = String(rawBackground.type || "").trim().toLowerCase();
        const value = String(rawBackground.value || "").trim();
        if (!value) return null;
        if (type === "color") return {type: "color", value};
        if (type === "image") return {type: "image", value: normalizeSlidesFilePath(value)};
        return null;
    };

    const setSlideBackground = (slide = null, background = null) => {
        if (!slide) return;
        const normalizedBackground = normalizeSlideBackground(background);
        if (normalizedBackground) slide.background = normalizedBackground;
        else delete slide.background;
    };

    const normalizeDefaultSlideBackground = (rawBackground = "") => {
        const value = String(rawBackground || "").trim();
        return value ? {type: "color", value} : null;
    };

    const createSlideRecord = (id = 1, title = `Slide ${id}`) => {
        const slide = {id, title, blocks: []};
        setSlideBackground(slide, slideDefaultBackground);
        return slide;
    };

    const getSlideBackgroundDownloadUrl = (filePath = "") => {
        const normalizedPath = normalizeSlidesFilePath(filePath);
        if (!normalizedPath) return "";
        return `/api/files/download?path=${encodeURIComponent(normalizedPath)}`;
    };

    const applySlideSurfaceBackground = (surfaceNode = null, background = null, showGrid = true) => {
        if (!(surfaceNode instanceof HTMLElement)) return;
        const normalizedBackground = normalizeSlideBackground(background);
        surfaceNode.style.backgroundColor = normalizedBackground?.type === "color" ? normalizedBackground.value : "var(--secondary-bg)";
        surfaceNode.style.backgroundImage = normalizedBackground?.type === "image" ? `url("${getSlideBackgroundDownloadUrl(normalizedBackground.value)}")` : (normalizedBackground?.type === "color" || !showGrid ? "none" : "linear-gradient(to right, var(--border) 1px, transparent 1px),linear-gradient(to bottom, var(--border) 1px, transparent 1px)");
        surfaceNode.style.backgroundSize = normalizedBackground?.type === "image" ? "cover" : (normalizedBackground?.type === "color" || !showGrid ? "auto" : "20px 20px");
        surfaceNode.style.backgroundPosition = normalizedBackground?.type === "image" ? "center center" : "0 0";
        surfaceNode.style.backgroundRepeat = normalizedBackground?.type === "image" ? "no-repeat" : (normalizedBackground?.type === "color" || !showGrid ? "no-repeat" : "repeat");
    };

    const getSlideTextBlockById = (blockId = null) => {
        const activeSlide = getActiveSlide();
        return activeSlide?.blocks?.find((block) => block.id === blockId && block.type === "text") || null;
    };

    const getSlideBlockTextStyle = (block = {}) => normalizeSlideTextStyle(block.textStyle || {});
    const setSlideBlockTextStyle = (block = {}, nextStyle = {}) => {
        const encodedStyle = encodeSlideTextStyle(nextStyle);
        if (Object.keys(encodedStyle).length) block.textStyle = encodedStyle;
        else delete block.textStyle;
    };

    const normalizeSlideTextBlock = (block = {}) => {
        block.content = String(block.content ?? "");
        if (block.type !== "text") return block;
        const normalizedRuns = normalizeSlideTextRuns(block.runs, block.content);
        block.content = getSlidePlainTextFromRuns(normalizedRuns) || block.content;
        block.runs = encodeSlideTextRuns(normalizedRuns, block.content);
        setSlideBlockTextStyle(block, block.textStyle || {});
        return block;
    };

    const normalizeSlideChartData = (rawData = []) => {
        const data = Array.isArray(rawData) ? rawData : [];
        return data.map((item, index) => {
            const value = Number(item?.value ?? item?.y ?? item?.amount);
            return {label: String(item?.label ?? item?.name ?? item?.x ?? `Item ${index + 1}`), value: Number.isFinite(value) ? value : 0};
        }).filter((item) => item.label || item.value);
    };

    const normalizeSlideChartBlock = (block = {}) => {
        if (block.type !== "chart") return block;
        const chartType = String(block.chartType || block.content || "bar").trim().toLowerCase();
        block.chartType = window.Plastic.chartTypes.some((option) => option.value === chartType) ? chartType : "bar";
        block.title = String(block.title || "Chart");
        block.data = normalizeSlideChartData(block.data).length ? normalizeSlideChartData(block.data) : SLIDE_CHART_DEFAULT_DATA.map((item) => ({...item}));
        block.labelValues = block.labelValues === true || block.showValueLabels === true;
        block.width = Math.max(SLIDE_CHART_MIN_WIDTH, Number(block.width) || SLIDE_CHART_DEFAULT_WIDTH);
        block.height = Math.max(SLIDE_CHART_MIN_HEIGHT, Number(block.height) || SLIDE_CHART_DEFAULT_HEIGHT);
        block.content = block.chartType;
        return block;
    };

    const normalizeSlideShapeBlock = (block = {}) => {
        if (block.type !== "shape") return block;
        const shapeType = String(block.shapeType || block.content || "rectangle").trim().toLowerCase();
        block.shapeType = SLIDE_SHAPE_TYPES.includes(shapeType) ? shapeType : "rectangle";
        block.fill = String(block.fill || "#dbeafe").trim() || "transparent";
        block.stroke = String(block.stroke || "#2563eb").trim() || "transparent";
        const strokeWidth = Number(block.strokeWidth);
        block.strokeWidth = Number.isFinite(strokeWidth) ? Math.max(0, Math.min(20, strokeWidth)) : 2;
        const opacity = Number(block.opacity);
        block.opacity = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
        block.width = Math.max(SLIDE_GRID_SIZE * 3, Number(block.width) || SLIDE_SHAPE_DEFAULT_WIDTH);
        block.height = Math.max(SLIDE_GRID_SIZE * 2, Number(block.height) || SLIDE_SHAPE_DEFAULT_HEIGHT);
        block.content = block.shapeType;
        return block;
    };

    const getDefaultSlideBlockName = (block = {}) => {
        if (block.type === "text") return "Text";
        if (block.type === "image") return "Image";
        if (block.type === "chart") return String(block.title || "Chart").trim() || "Chart";
        if (block.type === "shape") return window.Plastic.shapeOptions.find((option) => option.type === block.shapeType)?.label || "Shape";
        return "Object";
    };

    const normalizeSlideBlockIdentity = (block = {}, fallbackId = "") => {
        block.id = String(block.id ?? fallbackId).trim() || String(fallbackId);
        block.name = String(block.name || "").trim() || getDefaultSlideBlockName(block);
        return block;
    };

    const decodeSlideTextRunsForBlock = (block = {}) => normalizeSlideTextRuns(block.runs, block.content);
    const mergeSlideTextStyle = (baseStyle = {}, nextStyle = {}) => {
        const mergedStyle = {...normalizeSlideTextStyle(baseStyle)};
        const normalizedNext = normalizeSlideTextStyle(nextStyle);
        Object.entries(normalizedNext).forEach(([key, value]) => {
            if (value) mergedStyle[key] = value;
            else delete mergedStyle[key];
        });
        SLIDE_TEXT_STYLE_KEYS.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(nextStyle, key) && !nextStyle[key]) delete mergedStyle[key];
        });
        return normalizeSlideTextStyle(mergedStyle);
    };

    const applyStyleToSlideTextRuns = (rawRuns = [], start = 0, end = 0, nextStyle = {}) => {
        const normalizedRuns = normalizeSlideTextRuns(rawRuns);
        const safeStart = Math.max(0, Math.min(Number(start) || 0, Number(end) || 0));
        const safeEnd = Math.max(safeStart, Number(end) || 0);
        if (safeStart === safeEnd) return normalizedRuns;
        const updatedRuns = [];
        let offset = 0;
        normalizedRuns.forEach((run) => {
            const runStart = offset;
            const runEnd = offset + run.text.length;
            offset = runEnd;
            if (safeEnd <= runStart || safeStart >= runEnd) {
                updatedRuns.push({text: run.text, style: normalizeSlideTextStyle(run.style)});
                return;
            }
            const overlapStart = Math.max(runStart, safeStart);
            const overlapEnd = Math.min(runEnd, safeEnd);
            const beforeText = run.text.slice(0, overlapStart - runStart);
            const selectedText = run.text.slice(overlapStart - runStart, overlapEnd - runStart);
            const afterText = run.text.slice(overlapEnd - runStart);
            if (beforeText) updatedRuns.push({text: beforeText, style: normalizeSlideTextStyle(run.style)});
            if (selectedText) updatedRuns.push({text: selectedText, style: mergeSlideTextStyle(run.style, nextStyle)});
            if (afterText) updatedRuns.push({text: afterText, style: normalizeSlideTextStyle(run.style)});
        });
        return compactSlideTextRuns(updatedRuns);
    };

    const createSlideStyledTextNode = (text = "", style = {}) => {
        const normalizedStyle = normalizeSlideTextStyle(style);
        if (!Object.keys(normalizedStyle).length) return document.createTextNode(text);
        const span = document.createElement("span");
        if (normalizedStyle.fontWeight) span.style.fontWeight = normalizedStyle.fontWeight;
        if (normalizedStyle.fontStyle) span.style.fontStyle = normalizedStyle.fontStyle;
        if (normalizedStyle.textDecoration) span.style.textDecoration = normalizedStyle.textDecoration;
        if (normalizedStyle.fontFamily) span.style.fontFamily = normalizedStyle.fontFamily;
        if (normalizedStyle.color) span.style.color = normalizedStyle.color;
        if (normalizedStyle.backgroundColor) span.style.backgroundColor = normalizedStyle.backgroundColor;
        if (normalizedStyle.fontSize) span.style.fontSize = normalizedStyle.fontSize;
        span.textContent = text;
        return span;
    };

    const buildSlideTextFragment = (rawRuns = [], fallbackText = "") => {
        const fragment = document.createDocumentFragment();
        const normalizedRuns = normalizeSlideTextRuns(rawRuns, fallbackText);
        if (!normalizedRuns.length) {
            fragment.appendChild(document.createElement("br"));
            return fragment;
        }
        normalizedRuns.forEach((run) => {
            const parts = run.text.split("\n");
            parts.forEach((part, index) => {
                if (part) fragment.appendChild(createSlideStyledTextNode(part, run.style));
                if (index < parts.length - 1) fragment.appendChild(document.createElement("br"));
            });
        });
        return fragment;
    };

    const parseSlideTextStyleFromElement = (element, inheritedStyle = {}) => {
        const nextStyle = {...normalizeSlideTextStyle(inheritedStyle)};
        const tagName = String(element?.tagName || "").toUpperCase();
        if (tagName === "B" || tagName === "STRONG") nextStyle.fontWeight = "bold";
        if (tagName === "I" || tagName === "EM") nextStyle.fontStyle = "italic";
        if (tagName === "U") nextStyle.textDecoration = "underline";
        const inlineStyle = normalizeSlideTextStyle({
            fontWeight: element?.style?.fontWeight || "",
            fontStyle: element?.style?.fontStyle || "",
            textDecoration: element?.style?.textDecoration || "",
            fontFamily: element?.style?.fontFamily || "",
            color: element?.style?.color || "",
            backgroundColor: element?.style?.backgroundColor || "",
            fontSize: element?.style?.fontSize || ""
        });
        return mergeSlideTextStyle(nextStyle, inlineStyle);
    };

    const extractSlideTextRunsFromNode = (rootNode) => {
        const extractedRuns = [];
        const appendRun = (text = "", style = {}) => {
            if (!text) return;
            const normalizedStyle = normalizeSlideTextStyle(style);
            const previousRun = extractedRuns[extractedRuns.length - 1];
            if (previousRun && slideTextStylesEqual(previousRun.style, normalizedStyle)) previousRun.text += text;
            else extractedRuns.push({text, style: normalizedStyle});
        };
        const walkNode = (node, inheritedStyle = {}) => {
            if (!node) return;
            if (node.nodeType === Node.TEXT_NODE) {
                appendRun(node.textContent || "", inheritedStyle);
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const tagName = String(node.tagName || "").toUpperCase();
            if (tagName === "BR") {
                appendRun("\n", inheritedStyle);
                return;
            }
            const nextStyle = parseSlideTextStyleFromElement(node, inheritedStyle);
            Array.from(node.childNodes || []).forEach((childNode) => walkNode(childNode, nextStyle));
            if ((tagName === "DIV" || tagName === "P") && node.nextSibling) appendRun("\n", inheritedStyle);
        };
        Array.from(rootNode?.childNodes || []).forEach((childNode) => walkNode(childNode, {}));
        return compactSlideTextRuns(extractedRuns);
    };

    const getSlideSelectionOffsets = (rootNode) => {
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

    const resolveSlideSelectionPoint = (rootNode, targetOffset = 0) => {
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

    const restoreSlideSelection = (rootNode, start = 0, end = 0) => {
        const selection = window.getSelection();
        if (!selection || !(rootNode instanceof HTMLElement)) return;
        const startPoint = resolveSlideSelectionPoint(rootNode, start);
        const endPoint = resolveSlideSelectionPoint(rootNode, end);
        const range = document.createRange();
        range.setStart(startPoint.node, startPoint.offset);
        range.setEnd(endPoint.node, endPoint.offset);
        selection.removeAllRanges();
        selection.addRange(range);
    };

    const rememberSlideSelection = (contentNode = getSlideTextEditorFromSelection()) => {
        if (!(contentNode instanceof HTMLElement)) return null;
        const blockId = String(contentNode.dataset.blockId || "").trim();
        if (!blockId) return null;
        const selectionOffsets = getSlideSelectionOffsets(contentNode);
        if (!selectionOffsets) return savedSlideSelectionOffsets;
        savedSlideSelectionOffsets = {blockId, ...selectionOffsets};
        return savedSlideSelectionOffsets;
    };

    const getSavedSlideSelection = (blockId = selectedSlideBlockId, contentNode = null) => {
        const activeContentNode = contentNode instanceof HTMLElement ? contentNode : document.querySelector(`.editor-slide-text-content[data-block-id="${blockId}"]`);
        const liveSelection = activeContentNode instanceof HTMLElement ? getSlideSelectionOffsets(activeContentNode) : null;
        if (liveSelection) {
            savedSlideSelectionOffsets = {blockId, ...liveSelection};
            return savedSlideSelectionOffsets;
        }
        if (savedSlideSelectionOffsets?.blockId === blockId) return {...savedSlideSelectionOffsets};
        return null;
    };

    const getSlideSelectionRect = (rootNode) => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return null;
        const range = selection.getRangeAt(0);
        if (!(rootNode instanceof HTMLElement) || !rootNode.contains(range.startContainer) || !rootNode.contains(range.endContainer)) return null;
        const rect = range.getBoundingClientRect();
        if (rect && (rect.width || rect.height)) return rect;
        return rootNode.getBoundingClientRect();
    };

    const getSlideSelectionStyle = (block = {}, selectionOffsets = null) => {
        const runs = decodeSlideTextRunsForBlock(block);
        const blockStyle = getSlideBlockTextStyle(block);
        if (!selectionOffsets) return blockStyle;
        const start = Math.max(0, Math.min(selectionOffsets.start, selectionOffsets.end));
        const end = Math.max(selectionOffsets.start, selectionOffsets.end);
        let offset = 0;
        let activeStyle = null;
        runs.forEach((run) => {
            const runStart = offset;
            const runEnd = offset + run.text.length;
            offset = runEnd;
            const overlapsSelection = end === start ? start >= runStart && start <= runEnd : end > runStart && start < runEnd;
            if (!overlapsSelection) return;
            const normalizedRunStyle = normalizeSlideTextStyle(run.style);
            if (!activeStyle) {
                activeStyle = {...normalizedRunStyle};
                return;
            }
            SLIDE_TEXT_STYLE_KEYS.forEach((key) => {
                if ((activeStyle[key] || "") !== (normalizedRunStyle[key] || "")) delete activeStyle[key];
            });
        });
        return {...(activeStyle || {}), textAlign: blockStyle.textAlign || ""};
    };

    const updateSlideTextBlockFromRuns = (block = {}, runs = [], textStyle = null) => {
        block.runs = encodeSlideTextRuns(runs, block.content);
        block.content = getSlidePlainTextFromRuns(block.runs) || "";
        if (textStyle) setSlideBlockTextStyle(block, textStyle);
    };

    const renderSlideTextBlockContent = (contentNode, block = {}) => {
        if (!(contentNode instanceof HTMLElement)) return;
        contentNode.innerHTML = "";
        contentNode.appendChild(buildSlideTextFragment(block.runs, block.content));
        contentNode.style.textAlign = getSlideBlockTextStyle(block).textAlign || "";
    };

    const applyInlineStyleToSlideSelection = (blockId = null, selectionOffsets = null, nextStyle = {}, contentNode = null, restoreSelectionOffsets = selectionOffsets) => {
        const block = getSlideTextBlockById(blockId);
        if (!block || !selectionOffsets) return;
        const nextRuns = applyStyleToSlideTextRuns(decodeSlideTextRunsForBlock(block), selectionOffsets.start, selectionOffsets.end, nextStyle);
        const nextBlockStyle = {...getSlideBlockTextStyle(block), textAlign: nextStyle.textAlign || ""};
        if (!nextBlockStyle.textAlign) delete nextBlockStyle.textAlign;
        updateSlideTextBlockFromRuns(block, nextRuns, nextBlockStyle);
        const activeContentNode = contentNode instanceof HTMLElement ? contentNode : document.querySelector(`.editor-slide-text-content[data-block-id="${blockId}"]`);
        if (activeContentNode) {
            renderSlideTextBlockContent(activeContentNode, block);
            activeContentNode.focus();
            const finalSelectionOffsets = restoreSelectionOffsets || selectionOffsets;
            restoreSlideSelection(activeContentNode, finalSelectionOffsets.start, finalSelectionOffsets.end);
            rememberSlideSelection(activeContentNode);
        }
        renderSlideSidebar();
        saveSlidePortalState();
        updateSlideToolbarState();
    };

    const getSlideToolbarTarget = () => {
        const block = getSlideTextBlockById(selectedSlideBlockId);
        const contentNode = block ? document.querySelector(`.editor-slide-text-content[data-block-id="${block.id}"]`) : null;
        return {block, contentNode: contentNode instanceof HTMLElement ? contentNode : null};
    };

    const getSlideToolbarSelectionOffsets = (block = null, contentNode = null, {expandCollapsed = false} = {}) => {
        if (!block) return null;
        const savedSelection = getSavedSlideSelection(block.id, contentNode);
        if (savedSelection && savedSelection.start !== savedSelection.end) return savedSelection;
        if (savedSelection && !expandCollapsed) return savedSelection;
        const blockLength = getSlideTextLength(block);
        if (expandCollapsed && blockLength > 0) return {blockId: block.id, start: 0, end: blockLength};
        return savedSelection || {blockId: block.id, start: 0, end: 0};
    };

    const applySlideToolbarStyle = (styleResolver) => {
        const {block, contentNode} = getSlideToolbarTarget();
        if (!block) return false;
        const activeStyle = getSlideSelectionStyle(block, getSlideToolbarSelectionOffsets(block, contentNode));
        const nextStyle = typeof styleResolver === "function" ? styleResolver(activeStyle) : styleResolver;
        if (!nextStyle || typeof nextStyle !== "object") return false;
        const selectionOffsets = getSlideToolbarSelectionOffsets(block, contentNode, {expandCollapsed: true});
        const restoreSelectionOffsets = getSlideToolbarSelectionOffsets(block, contentNode, {expandCollapsed: false});
        applyInlineStyleToSlideSelection(block.id, selectionOffsets, nextStyle, contentNode, restoreSelectionOffsets);
        return true;
    };

    const hideSlideInlineStyleEditor = () => {
        if (typeof window.Plastic?.removeInlineStyleEditor === "function") window.Plastic.removeInlineStyleEditor(false);
    };

    const blurSlideTextEditing = () => {
        const activeEditor = document.activeElement?.closest?.(".editor-slide-text-content");
        if (activeEditor instanceof HTMLElement) activeEditor.blur();
        const selection = window.getSelection();
        if (selection) selection.removeAllRanges();
        hideSlideInlineStyleEditor();
    };

    const openSlideInlineStyleEditor = ({blockId = selectedSlideBlockId, contentNode = null, event = null} = {}) => {
        const block = getSlideTextBlockById(blockId);
        if (!block || typeof window.Plastic?.showInlineStyleEditor !== "function") return;
        const activeContentNode = contentNode instanceof HTMLElement ? contentNode : document.querySelector(`.editor-slide-text-content[data-block-id="${block.id}"]`);
        if (!(activeContentNode instanceof HTMLElement)) return;
        const selectionOffsets = getSlideSelectionOffsets(activeContentNode) || {start: 0, end: block.content.length};
        const selectionRect = getSlideSelectionRect(activeContentNode);
        const blockRect = activeContentNode.getBoundingClientRect();
        window.Plastic.showInlineStyleEditor({
            title: "Text Style",
            x: event?.clientX ?? selectionRect?.left ?? (blockRect.right - 20),
            y: event?.clientY ?? selectionRect?.bottom ?? (blockRect.top + 20),
            value: getSlideSelectionStyle(block, selectionOffsets),
            onchange: (updatedStyle = {}) => applyInlineStyleToSlideSelection(block.id, selectionOffsets, updatedStyle, activeContentNode)
        });
    };

    const scheduleSlideInlineStyleEditor = (blockId = selectedSlideBlockId, contentNode = null, event = null) => {
        const requestId = ++slideInlineStyleRequest;
        requestAnimationFrame(() => {
            if (requestId !== slideInlineStyleRequest) return;
            openSlideInlineStyleEditor({blockId, contentNode, event});
        });
    };

    const getSlideTextEditorFromSelection = () => {
        const selection = window.getSelection();
        const anchorElement = selection?.anchorNode instanceof Element ? selection.anchorNode : selection?.anchorNode?.parentElement || null;
        return document.activeElement?.closest?.(".editor-slide-text-content") || anchorElement?.closest?.(".editor-slide-text-content") || null;
    };

    const handleSlideSelectionChange = () => {
        if (document.activeElement?.matches?.("#editor-slide-font-family, #editor-slide-font-size")) return;
        const contentNode = getSlideTextEditorFromSelection();
        if (!(contentNode instanceof HTMLElement)) {
            hideSlideInlineStyleEditor();
            updateSlideToolbarState();
            return;
        }
        const blockId = String(contentNode.dataset.blockId || "").trim();
        if (!blockId) return;
        selectedSlideBlockId = blockId;
        rememberSlideSelection(contentNode);
        scheduleSlideInlineStyleEditor(blockId, contentNode);
        updateSlideToolbarState();
    };

    const resolveSlideColor = (rawColor = "") => {
        const colorValue = String(rawColor || "").trim();
        if (!colorValue || colorValue === "transparent") return "";
        if (resolvedSlideColorCache.has(colorValue)) return resolvedSlideColorCache.get(colorValue);
        const probe = document.createElement("div");
        probe.style.color = colorValue;
        probe.style.position = "absolute";
        probe.style.opacity = "0";
        probe.style.pointerEvents = "none";
        document.body.appendChild(probe);
        const resolvedColor = getComputedStyle(probe).color || colorValue;
        probe.remove();
        resolvedSlideColorCache.set(colorValue, resolvedColor);
        return resolvedColor;
    };

    const getSlideToolbarContrastColor = (rawColor = "") => {
        const resolvedColor = resolveSlideColor(rawColor);
        const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(resolvedColor);
        if (!match) return "";
        const red = Number(match[1]);
        const green = Number(match[2]);
        const blue = Number(match[3]);
        const brightness = ((red * 299) + (green * 587) + (blue * 114)) / 1000;
        return brightness < 140 ? "#ffffff" : "#111111";
    };

    const setSlideToolbarButtonState = (buttonNode, isActive = false) => {
        if (!buttonNode) return;
        buttonNode.className = `${isActive ? "tiny primary" : ""} naked align-bottom small-margin-right inner-radius`.trim();
    };

    const syncSlideToolbarIconColor = (buttonNode) => {
        if (!buttonNode) return;
        buttonNode.querySelectorAll("svg path").forEach((pathNode) => {
            if (!pathNode.hasAttribute("stroke")) pathNode.setAttribute("fill", "currentColor");
        });
    };
    const syncSlideLayersUiState = () => {
        const panel = document.getElementById("editor-slide-layers-panel");
        const button = document.getElementById("editor-slide-layers-button");
        panel?.classList.toggle("is-open", slideLayersVisible);
        panel?.setAttribute("aria-hidden", String(!slideLayersVisible));
        button?.classList.toggle("active", slideLayersVisible);
        button?.setAttribute("aria-expanded", String(slideLayersVisible));
    };
    const updateSlideToolbarState = () => {
        const fontFamilySelect = document.getElementById("editor-slide-font-family");
        const fontSizeSelect = document.getElementById("editor-slide-font-size");
        const boldButton = document.getElementById("editor-slide-style-bold");
        const italicButton = document.getElementById("editor-slide-style-italic");
        const textColorButton = document.getElementById("editor-slide-style-color");
        const backgroundColorButton = document.getElementById("editor-slide-style-background");
        const alignmentButton = document.getElementById("editor-slide-style-align");
        const {block, contentNode} = getSlideToolbarTarget();
        const activeStyle = block ? getSlideSelectionStyle(block, getSlideToolbarSelectionOffsets(block, contentNode)) : {};
        if (fontFamilySelect) window.StandardUI?.setSearchComboBoxValue?.(fontFamilySelect, activeStyle.fontFamily || "Inter");
        if (fontSizeSelect) window.StandardUI?.setSearchComboBoxValue?.(fontSizeSelect, normalizeSlideFontSizeInput(activeStyle.fontSize || "12px") || "12");
        setSlideToolbarButtonState(boldButton, activeStyle.fontWeight === "bold");
        setSlideToolbarButtonState(italicButton, activeStyle.fontStyle === "italic");
        syncSlideToolbarIconColor(boldButton);
        syncSlideToolbarIconColor(italicButton);
        if (textColorButton) {
            const resolvedTextColor = resolveSlideColor(activeStyle.color || "");
            textColorButton.className = `${activeStyle.color ? "tiny primary" : ""} naked align-bottom small-margin-right inner-radius`.trim();
            textColorButton.style.color = resolvedTextColor || "";
            textColorButton.style.backgroundColor = "";
            textColorButton.style.borderColor = "";
            syncSlideToolbarIconColor(textColorButton);
        }
        if (backgroundColorButton) {
            const resolvedBackgroundColor = resolveSlideColor(activeStyle.backgroundColor || "");
            backgroundColorButton.className = `${activeStyle.backgroundColor ? "tiny primary" : ""} naked align-bottom small-margin-right inner-radius`.trim();
            backgroundColorButton.style.backgroundColor = resolvedBackgroundColor || "";
            backgroundColorButton.style.color = resolvedBackgroundColor ? getSlideToolbarContrastColor(activeStyle.backgroundColor) : "";
            backgroundColorButton.style.borderColor = resolvedBackgroundColor || "";
            syncSlideToolbarIconColor(backgroundColorButton);
        }
        if (alignmentButton) {
            const alignment = activeStyle.textAlign || "left";
            alignmentButton.innerHTML = window.Plastic.icons[alignment] || window.Plastic.icons.left;
            alignmentButton.className = `${activeStyle.textAlign && activeStyle.textAlign !== "left" ? "tiny primary" : ""} naked align-bottom small-margin-right inner-radius`.trim();
        }
        document.querySelectorAll(".editor-slide-layer-item").forEach((itemNode) => {
            itemNode.classList.toggle("active", String(itemNode.dataset.blockId) === selectedSlideBlockId);
        });
        syncSlideLayersUiState();
    };

    const ensureDeckIntegrity = () => {
        if (!Array.isArray(activeSlideDeck) || !activeSlideDeck.length) activeSlideDeck = [{id: 1, title: "Slide 1", blocks: []}];
        if (selectedSlideBlockId !== null && selectedSlideBlockId !== undefined && selectedSlideBlockId !== "") selectedSlideBlockId = String(selectedSlideBlockId);
        else selectedSlideBlockId = null;
        const seenBlockIds = new Set();
        let nextBlockId = activeSlideDeck.reduce((maxId, slide) => {
            const slideMax = (Array.isArray(slide?.blocks) ? slide.blocks : []).reduce((innerMax, block) => Math.max(innerMax, Number(block?.id) || 0), 0);
            return Math.max(maxId, slideMax);
        }, 0) + 1;
        activeSlideDeck.forEach((slide) => {
            setSlideBackground(slide, slide?.background || null);
            slide.blocks = Array.isArray(slide?.blocks) ? slide.blocks : [];
            slide.blocks.forEach((block) => {
                normalizeSlideTextBlock(block);
                normalizeSlideChartBlock(block);
                normalizeSlideShapeBlock(block);
                let blockId = String(block?.id ?? "").trim();
                while (!blockId || seenBlockIds.has(blockId)) blockId = String(nextBlockId++);
                normalizeSlideBlockIdentity(block, blockId);
                seenBlockIds.add(block.id);
            });
        });
        if (!activeSlideDeck.some((slide) => slide.id === activeSlideId)) activeSlideId = activeSlideDeck[0]?.id || 1;
        const maxSlideId = activeSlideDeck.reduce((maxId, slide) => Math.max(maxId, Number(slide?.id) || 0), 0);
        slideDeckCounter = Math.max(maxSlideId + 1, 2);
        slideBlockCounter = Math.max(nextBlockId, 1);
        if (!activeSlideDeck.some((slide) => (slide?.blocks || []).some((block) => block.id === selectedSlideBlockId))) selectedSlideBlockId = null;
    };

    const buildSlidesPayload = () => ({
        format: "std.slides.v1",
        fileName: getSlidesFileName(activeSlideDeckFilePath).replace(/\.slds$/i, "") || "slides",
        updatedAt: new Date().toISOString(),
        deck: activeSlideDeck,
        activeSlideId,
        selectedSlideBlockId
    });

    const parseSlidesPayload = (rawPayload = {}) => {
        const hasDeck = Array.isArray(rawPayload?.deck);
        const legacyDeck = Array.isArray(rawPayload) ? rawPayload : [];
        activeSlideDeck = hasDeck ? rawPayload.deck : legacyDeck;
        activeSlideId = Number(rawPayload?.activeSlideId) || activeSlideDeck[0]?.id || 1;
        selectedSlideBlockId = rawPayload?.selectedSlideBlockId === null || rawPayload?.selectedSlideBlockId === undefined || rawPayload?.selectedSlideBlockId === "" ? null : String(rawPayload.selectedSlideBlockId);
        ensureDeckIntegrity();
    };

    const updateSlidesPortalTitle = (slidesPortal = findSlidesPortal()) => {
        if (slidesPortal?.setTitle) slidesPortal.setTitle(activeSlideDeckFilePath ? getSlidesFileName(activeSlideDeckFilePath) : "Slides");
    };

    const saveSlidesDeckToPath = async (targetPath = "") => {
        const normalizedPath = normalizeSlidesFilePath(targetPath);
        if (!normalizedPath) {
            modular.error("File name is required");
            return false;
        }
        const payload = buildSlidesPayload();
        const serializedSlides = JSON.stringify(payload);
        const fileName = getSlidesFileName(normalizedPath);
        const response = await window.StandardUploads.saveFile(serializedSlides, normalizedPath, {label: `Saving ${fileName}`});
        if (!response?.ok) {
            modular.error("Unable to save slideshow");
            return false;
        }
        activeSlideDeckFilePath = normalizedPath;
        saveSlidePortalState();
        updateSlidesPortalTitle();
        await window.StandardFilesRefreshCache?.();
        modular.success(`Saved ${normalizedPath} (${response.byteCount} bytes)`);
        return true;
    };

    const saveNewSlidesDeckToDocuments = () => {
        inputDialogue({title: "File name", placeholder: "slideshow.slds", value: "slideshow.slds", location_picker: true, confirmation: async (_, inputFileName, location) => {
                if (!modular.validateFileName(inputFileName)) return;
                const safeFileName = sanitizeSlidesFileName(inputFileName) || "slideshow.slds";
                await saveSlidesDeckToPath(`${location}/${safeFileName}`);
            }
        });
    };

    const saveLoadedSlidesDeck = async () => {
        if (!activeSlideDeckFilePath) {
            saveNewSlidesDeckToDocuments();
            return;
        }
        await saveSlidesDeckToPath(activeSlideDeckFilePath);
    };

    const applySlidesPayload = (rawPath = "", payload = null) => {
        const slidePath = normalizeSlidesFilePath(rawPath);
        if (!slidePath) return false;
        parseSlidesPayload(payload && typeof payload === "object" ? payload : {});
        activeSlideDeckFilePath = slidePath;
        slideForceViewDefaults = true;
        const portal = modular.show(SERVICE_ID, 0, {newInstance: true});
        prioritizePortalDomForLegacyLookups(portal);
        saveSlidePortalState(portal);
        renderSlideEditor();
        updateSlidesPortalTitle(portal);
        return true;
    };

    const openSlideFilePath = async (rawPath = "", sourceNode = null) => {
        const slidePath = normalizeSlidesFilePath(rawPath);
        if (!slidePath) return false;
        try {
            const download = await window.StandardDownloads.downloadForOpen(slidePath, {
                errorMessage: "Unable to read slide file",
                suppressProgress: true
            });
            const buffer = await download.blob.arrayBuffer();
            return applySlidesPayload(slidePath, JSON.parse(new TextDecoder().decode(buffer)));
        } catch (_) {
            modular.error("Unable to open slideshow");
            return false;
        }
    };

    window.StandardSlides = window.StandardSlides || {};
    window.StandardSlides.openSlidePath = (rawPath = "", sourceNode = null) => openSlideFilePath(rawPath, sourceNode);
    window.StandardSlides.openSlidePayload = (rawPath = "", payload = null, sourceNode = null) => applySlidesPayload(rawPath, payload, sourceNode);
    window.StandardSlides.openFreshSlidesEditor = (sourceNode = null) => {
        activeSlideDeck = [{id: 1, title: "Slide 1", blocks: []}];
        activeSlideId = 1;
        selectedSlideBlockId = null;
        slideDeckCounter = 2;
        slideBlockCounter = 1;
        activeSlideDeckFilePath = "";
        slideForceViewDefaults = true;
        slideForceDefaultBackground = true;
        modular.show(SERVICE_ID, 0, {newInstance: true});
        saveSlidePortalState();
        renderSlideEditor();
        updateSlidesPortalTitle();
        return true;
    };

    const snapSlideValue = (value = 0) => {
        const numericValue = Math.max(0, Number(value) || 0);
        return slideSnapToGrid ? Math.round(numericValue / SLIDE_GRID_SIZE) * SLIDE_GRID_SIZE : numericValue;
    };

    const captureSlideListRects = () => {
        const list = document.getElementById("editor-slide-list");
        if (!list) return new Map();
        return new Map(Array.from(list.querySelectorAll(".editor-slide-item")).map((item) => [Number(item.dataset.slideId), item.getBoundingClientRect()]));
    };

    const animateSlideListFromRects = (previousRects = new Map()) => {
        const list = document.getElementById("editor-slide-list");
        if (!list) return;
        Array.from(list.querySelectorAll(".editor-slide-item")).forEach((item) => {
            const slideId = Number(item.dataset.slideId);
            const previousRect = previousRects.get(slideId);
            if (!previousRect) return;
            const nextRect = item.getBoundingClientRect();
            const deltaY = previousRect.top - nextRect.top;
            if (!deltaY) return;
            item.style.transition = "none";
            item.style.transform = `translateY(${deltaY}px)`;
            requestAnimationFrame(() => {
                item.style.transition = "transform 170ms ease";
                item.style.transform = "";
            });
        });
    };

    const saveSlidePortalState = (portal = findSlidesPortal()) => {
        if (!portal || typeof portal.setWindowState !== "function") return;
        portal.setWindowState({
            directive: activeSlideDeckFilePath,
            deck: activeSlideDeck,
            activeSlideId,
            selectedSlideBlockId,
            slideDeckCounter,
            slideBlockCounter,
            slideGridVisible,
            slideSnapToGrid,
            slideLayersVisible
        });
        updateSlidesPortalTitle(portal);
    };

    const restoreSlidePortalState = (portal = findSlidesPortal()) => {
        const state = portal?.windowState?.() || {};
        slideGridDefaultPending = slideForceViewDefaults || !Object.prototype.hasOwnProperty.call(state, "slideGridVisible");
        slideSnapDefaultPending = slideForceViewDefaults || !Object.prototype.hasOwnProperty.call(state, "slideSnapToGrid");
        slideLayersDefaultPending = slideForceViewDefaults || !Object.prototype.hasOwnProperty.call(state, "slideLayersVisible");
        slideBackgroundDefaultPending = slideForceDefaultBackground || !(Array.isArray(state.deck) && state.deck.length);
        slideForceViewDefaults = false;
        slideForceDefaultBackground = false;
        if (Array.isArray(state.deck) && state.deck.length) {
            activeSlideDeck = state.deck;
            activeSlideId = state.activeSlideId || state.deck[0]?.id || 1;
            selectedSlideBlockId = state.selectedSlideBlockId === null || state.selectedSlideBlockId === undefined || state.selectedSlideBlockId === "" ? null : String(state.selectedSlideBlockId);
            slideDeckCounter = Number.isFinite(state.slideDeckCounter) ? state.slideDeckCounter : (state.deck.length + 1);
            slideBlockCounter = Number.isFinite(state.slideBlockCounter) ? state.slideBlockCounter : 1;
        }
        slideGridVisible = state.slideGridVisible !== false;
        slideSnapToGrid = state.slideSnapToGrid !== false;
        slideLayersVisible = state.slideLayersVisible === true;
        activeSlideDeckFilePath = normalizeSlidesFilePath(state?.directive || "");
        ensureDeckIntegrity();
        updateSlidesPortalTitle(portal);
    };

    const loadSlideAppSettings = async (portal = findSlidesPortal()) => {
        const settings = await window.StandardAppSettings?.values?.(SERVICE_ID) || {};
        slideDefaultBackground = normalizeDefaultSlideBackground(settings.default_background);
        if (slideGridDefaultPending) slideGridVisible = settings.show_grid !== false;
        if (slideSnapDefaultPending) slideSnapToGrid = settings.snap_to_grid !== false;
        if (slideLayersDefaultPending) slideLayersVisible = settings.show_layers === true;
        if (slideBackgroundDefaultPending && activeSlideDeck.length === 1 && !(activeSlideDeck[0]?.blocks || []).length && !activeSlideDeck[0]?.background) {
            setSlideBackground(activeSlideDeck[0], slideDefaultBackground);
        }
        slideGridDefaultPending = false;
        slideSnapDefaultPending = false;
        slideLayersDefaultPending = false;
        slideBackgroundDefaultPending = false;
        renderSlideEditor();
        saveSlidePortalState(portal);
    };
    const syncSavedSlideAppSettings = (event) => {
        if (event?.detail?.serviceId !== SERVICE_ID) return;
        slideDefaultBackground = normalizeDefaultSlideBackground(event.detail?.values?.default_background);
    };
    document.addEventListener("standard-app-settings-saved", syncSavedSlideAppSettings);
    document.addEventListener("standard-app-settings-reset", syncSavedSlideAppSettings);
    const getSlideCanvasBounds = () => {
        const canvas = document.getElementById("editor-slide-canvas");
        return {canvas, width: canvas?.clientWidth || 0, height: canvas?.clientHeight || 0};
    };
    const getSlideThumbnailViewport = () => {
        const bounds = getSlideCanvasBounds();
        const width = bounds.width || 960;
        const height = bounds.height || Math.max(540, Math.round(width / 1.7777778));
        return {width, height};
    };
    const clampSlideBlockToBounds = (block = {}) => {
        const bounds = getSlideCanvasBounds();
        const maxX = Math.max(0, bounds.width - block.width);
        const maxY = Math.max(0, bounds.height - block.height);
        block.x = Math.min(maxX, Math.max(0, snapSlideValue(block.x)));
        block.y = Math.min(maxY, Math.max(0, snapSlideValue(block.y)));
        block.width = Math.max(block.type === "chart" ? SLIDE_CHART_MIN_WIDTH : SLIDE_GRID_SIZE * 3, snapSlideValue(block.width));
        block.height = Math.max(block.type === "chart" ? SLIDE_CHART_MIN_HEIGHT : SLIDE_GRID_SIZE * 2, snapSlideValue(block.height));
    };
    const reorderSlides = (movingSlideId, targetSlideId) => {
        if (!movingSlideId || !targetSlideId || movingSlideId === targetSlideId) return false;
        const movingIndex = activeSlideDeck.findIndex((slide) => slide.id === movingSlideId);
        const targetIndex = activeSlideDeck.findIndex((slide) => slide.id === targetSlideId);
        if (movingIndex < 0 || targetIndex < 0) return false;
        const [movingSlide] = activeSlideDeck.splice(movingIndex, 1);
        activeSlideDeck.splice(targetIndex, 0, movingSlide);
        return true;
    };
    const hideSlideBackgroundMenu = () => {
        slideBackgroundMenuOpen = false;
        document.getElementById("editor-slide-background-menu")?.classList.remove("open");
        document.getElementById("editor-slide-background-button")?.classList.remove("active");
    };
    const hideSlideOptionsMenu = () => {
        slideOptionsMenuOpen = false;
        document.getElementById("editor-slide-options-menu")?.classList.remove("open");
        document.getElementById("editor-slide-more-options")?.classList.remove("active");
    };
    const ensureSlideBackgroundMenu = () => {
        if (document.getElementById("editor-slide-background-menu")) return;
        const menu = document.createElement("div");
        menu.id = "editor-slide-background-menu";
        menu.className = "editor-slide-background-menu secondary-bordered radius shadowed";
        menu.innerHTML = [
            `<label class="editor-slide-background-section" for="editor-slide-background-color">Color</label>`,
            `<input id="editor-slide-background-color" class="editor-slide-background-color-input" type="color" value="#ffffff"/>`,
            `<button type="button" id="editor-slide-background-upload" class="editor-slide-background-action smaller">Upload image</button>`,
            `<button type="button" id="editor-slide-background-clear" class="editor-slide-background-action subtle smaller">Clear background</button>`,
            `<input id="editor-slide-background-file" type="file" accept="image/*" hidden />`
        ].join("");
        document.body.appendChild(menu);
        const colorInput = menu.querySelector("#editor-slide-background-color");
        const uploadButton = menu.querySelector("#editor-slide-background-upload");
        const clearButton = menu.querySelector("#editor-slide-background-clear");
        const fileInput = menu.querySelector("#editor-slide-background-file");
        colorInput?.addEventListener("input", (event) => {
            const activeSlide = getActiveSlide();
            const nextColor = String(event.target?.value || "").trim();
            if (!activeSlide || !nextColor) return;
            setSlideBackground(activeSlide, {type: "color", value: nextColor});
            renderSlideCanvas();
            saveSlidePortalState();
        });
        uploadButton?.addEventListener("click", () => fileInput?.click());
        clearButton?.addEventListener("click", () => {
            const activeSlide = getActiveSlide();
            if (!activeSlide) return;
            setSlideBackground(activeSlide, null);
            renderSlideCanvas();
            saveSlidePortalState();
            hideSlideBackgroundMenu();
        });
        fileInput?.addEventListener("change", async (event) => {
            const activeSlide = getActiveSlide();
            const file = event.target?.files?.[0];
            if (!activeSlide || !file) return;
            const targetDirectory = getSlidesFileDirectory(activeSlideDeckFilePath) || "Documents";
            const uploadUrl = targetDirectory ? `/api/upload?directory=${encodeURIComponent(targetDirectory)}` : "/api/upload";
            try {
                if (typeof window.StandardUploads?.uploadFile === "function") {
                    const response = await window.StandardUploads.uploadFile(file, uploadUrl, {label: `Uploading ${file.name || "image"}`});
                    if (!response?.ok) throw new Error(`Upload failed (${response?.status || 0})`);
                } else {
                    const formData = new FormData();
                    formData.append("file", file);
                    const response = await fetch(uploadUrl, {method: "POST", body: formData});
                    if (!response.ok) throw new Error(`Upload failed (${response.status})`);
                }
                const uploadedPath = targetDirectory ? `${targetDirectory}/${file.name}` : file.name;
                setSlideBackground(activeSlide, {type: "image", value: uploadedPath});
                renderSlideCanvas();
                saveSlidePortalState();
                await window.StandardFilesRefreshCache?.();
                hideSlideBackgroundMenu();
            } catch (error) {
                console.error("Failed to upload slide background image:", error);
                modular.error("Unable to upload background image");
            } finally {
                event.target.value = "";
            }
        });
        document.addEventListener("mousedown", (event) => {
            if (!slideBackgroundMenuOpen) return;
            const button = document.getElementById("editor-slide-background-button");
            if (menu.contains(event.target) || button?.contains(event.target)) return;
            hideSlideBackgroundMenu();
        });
        window.addEventListener("blur", hideSlideBackgroundMenu);
        window.addEventListener("resize", hideSlideBackgroundMenu);
        window.addEventListener("scroll", hideSlideBackgroundMenu, true);
    };
    const syncSlideBackgroundMenuState = () => {
        const colorInput = document.getElementById("editor-slide-background-color");
        const activeSlide = getActiveSlide();
        const background = normalizeSlideBackground(activeSlide?.background || null);
        if (!(colorInput instanceof HTMLInputElement)) return;
        colorInput.value = background?.type === "color" ? background.value : "#ffffff";
    };
    const showSlideBackgroundMenu = () => {
        ensureSlideBackgroundMenu();
        const menu = document.getElementById("editor-slide-background-menu");
        const button = document.getElementById("editor-slide-background-button");
        if (!menu || !button) return;
        syncSlideBackgroundMenuState();
        slideBackgroundMenuOpen = true;
        menu.classList.add("open");
        button.classList.add("active");
        const rect = button.getBoundingClientRect();
        menu.style.left = "0px";
        menu.style.top = "0px";
        const width = menu.offsetWidth || 180;
        const height = menu.offsetHeight || 160;
        const maxX = Math.max(8, window.innerWidth - width - 8);
        const maxY = Math.max(8, window.innerHeight - height - 8);
        menu.style.left = `${Math.min(maxX, Math.max(8, rect.left))}px`;
        menu.style.top = `${Math.min(maxY, Math.max(8, rect.bottom + 8))}px`;
    };
    const toggleSlideBackgroundMenu = () => {
        if (slideBackgroundMenuOpen) hideSlideBackgroundMenu();
        else {
            hideSlideOptionsMenu();
            showSlideBackgroundMenu();
        }
    };
    const syncSlideOptionsMenuState = () => {
        const gridToggle = document.getElementById("editor-slide-grid-toggle");
        if (gridToggle instanceof HTMLInputElement) gridToggle.checked = slideGridVisible;
        const snapToggle = document.getElementById("editor-slide-snap-toggle");
        if (snapToggle instanceof HTMLInputElement) snapToggle.checked = slideSnapToGrid;
    };
    const ensureSlideOptionsMenu = () => {
        if (document.getElementById("editor-slide-options-menu")) return;
        const menu = document.createElement("div");
        menu.id = "editor-slide-options-menu";
        menu.className = "editor-slide-options-menu secondary-bordered radius shadowed";
        menu.innerHTML = children([
            div({
                style: "editor-slide-option-row",
                content: children([
                    switcher({id: "editor-slide-grid-toggle", style: "editor-slide-option-switch float-right", checked: true}),
                    `<span class="editor-slide-option-label">Grid</span>`
                ])
            }),
            div({
                style: "editor-slide-option-row",
                content: children([
                    switcher({id: "editor-slide-snap-toggle", style: "editor-slide-option-switch float-right", checked: true}),
                    `<span class="editor-slide-option-label">Snap to Grid</span>`
                ])
            })
        ]);
        document.body.appendChild(menu);
        const gridToggle = menu.querySelector("#editor-slide-grid-toggle");
        gridToggle?.addEventListener("change", (event) => {
            slideGridVisible = !!event.target?.checked;
            renderSlideCanvas();
            saveSlidePortalState();
        });
        const snapToggle = menu.querySelector("#editor-slide-snap-toggle");
        snapToggle?.addEventListener("change", (event) => {
            slideSnapToGrid = !!event.target?.checked;
            saveSlidePortalState();
        });
        document.addEventListener("mousedown", (event) => {
            if (!slideOptionsMenuOpen) return;
            const button = document.getElementById("editor-slide-more-options");
            if (menu.contains(event.target) || button?.contains(event.target)) return;
            hideSlideOptionsMenu();
        });
        window.addEventListener("blur", hideSlideOptionsMenu);
        window.addEventListener("resize", hideSlideOptionsMenu);
        window.addEventListener("scroll", hideSlideOptionsMenu, true);
    };
    const showSlideOptionsMenu = () => {
        ensureSlideOptionsMenu();
        const menu = document.getElementById("editor-slide-options-menu");
        const button = document.getElementById("editor-slide-more-options");
        if (!menu || !button) return;
        syncSlideOptionsMenuState();
        slideOptionsMenuOpen = true;
        menu.classList.add("open");
        button.classList.add("active");
        const rect = button.getBoundingClientRect();
        menu.style.left = "0px";
        menu.style.top = "0px";
        const width = menu.offsetWidth || 180;
        const height = menu.offsetHeight || 104;
        const maxX = Math.max(8, window.innerWidth - width - 8);
        const maxY = Math.max(8, window.innerHeight - height - 8);
        menu.style.left = `${Math.min(maxX, Math.max(8, rect.left))}px`;
        menu.style.top = `${Math.min(maxY, Math.max(8, rect.bottom + 8))}px`;
    };
    const toggleSlideOptionsMenu = () => {
        if (slideOptionsMenuOpen) hideSlideOptionsMenu();
        else {
            hideSlideBackgroundMenu();
            showSlideOptionsMenu();
        }
    };
    const getSlideIdFromThumbnail = (thumbnailNode = null) => Number(thumbnailNode?.closest?.(".editor-slide-item")?.dataset?.slideId) || null;
    const renameSlide = (slideId = null) => {
        const slide = activeSlideDeck.find((item) => item.id === slideId);
        if (!slide) return false;
        inputDialogue({title: "Slide name", placeholder: "Untitled Slide", value: slide.title || "", confirmation: (_, nextTitle) => {
                slide.title = String(nextTitle || "").trim() || slide.title || "Untitled Slide";
                renderSlideSidebar();
                saveSlidePortalState();
            }
        });
        return true;
    };
    const addBlankSlideAfter = (slideId = null) => {
        const selectedIndex = activeSlideDeck.findIndex((slide) => slide.id === slideId);
        if (selectedIndex < 0) return false;
        const slide = createSlideRecord(slideDeckCounter, `Slide ${slideDeckCounter}`);
        slideDeckCounter += 1;
        activeSlideDeck.splice(selectedIndex + 1, 0, slide);
        activeSlideId = slide.id;
        selectedSlideBlockId = null;
        savedSlideSelectionOffsets = null;
        renderSlideEditor();
        saveSlidePortalState();
        return true;
    };
    const duplicateSlide = (slideId = null) => {
        const sourceIndex = activeSlideDeck.findIndex((slide) => slide.id === slideId);
        if (sourceIndex < 0) return false;
        const sourceSlide = activeSlideDeck[sourceIndex];
        const duplicate = typeof structuredClone === "function" ? structuredClone(sourceSlide) : JSON.parse(JSON.stringify(sourceSlide));
        duplicate.id = slideDeckCounter;
        slideDeckCounter += 1;
        duplicate.title = `${sourceSlide.title || `Slide ${sourceIndex + 1}`} Copy`;
        duplicate.blocks = (duplicate.blocks || []).map((block) => ({...block, id: String(slideBlockCounter++)}));
        activeSlideDeck.splice(sourceIndex + 1, 0, duplicate);
        activeSlideId = duplicate.id;
        selectedSlideBlockId = null;
        savedSlideSelectionOffsets = null;
        renderSlideEditor();
        saveSlidePortalState();
        return true;
    };
    const deleteSlide = (slideId = null) => {
        const slide = activeSlideDeck.find((item) => item.id === slideId);
        if (!slide || activeSlideDeck.length <= 1) return false;
        confirmationDialogue({
            title: "Delete slide",
            destructive: true,
            content: `Delete “${slide.title || "Untitled Slide"}”?`,
            confirmation: () => {
                const deletedIndex = activeSlideDeck.findIndex((item) => item.id === slideId);
                activeSlideDeck = activeSlideDeck.filter((item) => item.id !== slideId);
                if (activeSlideId === slideId) activeSlideId = activeSlideDeck[Math.min(Math.max(0, deletedIndex), activeSlideDeck.length - 1)]?.id || activeSlideDeck[0]?.id;
                selectedSlideBlockId = null;
                savedSlideSelectionOffsets = null;
                renderSlideEditor();
                saveSlidePortalState();
            }
        });
        return true;
    };
    const bindSlideThumbnailContextMenu = () => {
        const list = document.getElementById("editor-slide-list");
        if (!list || list.dataset.contextMenuBound === "1") return;
        list.dataset.contextMenuBound = "1";
        list.contextmenu(() => {
            const items = [{
            label: "Rename",
            icon: window.Plastic.icons.modify,
            action: (_, __, target) => renameSlide(getSlideIdFromThumbnail(target))
        }, {
            label: "Add Slide",
            icon: SLIDE_ADD_ICON,
            action: (_, __, target) => addBlankSlideAfter(getSlideIdFromThumbnail(target))
        }, {
            label: "Duplicate",
            icon: window.Plastic.icons.duplicate,
            action: (_, __, target) => duplicateSlide(getSlideIdFromThumbnail(target))
            }];
            if (activeSlideDeck.length > 1) items.push("separator", {
                label: "Delete",
                icon: window.Plastic.icons.delete,
                destructive: true,
                action: (_, __, target) => deleteSlide(getSlideIdFromThumbnail(target))
            });
            return items;
        }, ".editor-slide-item");
    };
    const renderSlideSidebar = () => {
        const list = document.getElementById("editor-slide-list");
        if (!list) return;
        list.innerHTML = "";
        const previewWidth = Math.max(96, (list.clientWidth || 152) - 4);
        activeSlideDeck.forEach((slide, index) => {
            const slideButton = document.createElement("button");
            slideButton.type = "button";
            slideButton.className = `editor-slide-item${slide.id === activeSlideId ? " active" : ""}`;
            slideButton.dataset.slideId = String(slide.id);
            const previewNode = createSlideThumbnailNode(slide, previewWidth);
            const metaNode = document.createElement("div");
            metaNode.className = "editor-slide-item-meta";
            metaNode.innerHTML = [`<span class="editor-slide-item-index">${index + 1}</span>`, `<span class="editor-slide-item-title">${slide.title || `Slide ${index + 1}`}</span>`].join("");
            slideButton.appendChild(previewNode);
            slideButton.appendChild(metaNode);
            slideButton.draggable = true;
            slideButton.addEventListener("click", () => {
                activeSlideId = slide.id;
                selectedSlideBlockId = null;
                savedSlideSelectionOffsets = null;
                renderSlideEditor();
            });
            slideButton.addEventListener("dragstart", (event) => {
                draggingSlideId = slide.id;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(slide.id));
                slideButton.classList.add("dragging");
            });
            slideButton.addEventListener("dragend", () => {
                draggingSlideId = null;
                slideButton.classList.remove("dragging");
                saveSlidePortalState();
            });
            slideButton.addEventListener("dragover", (event) => {
                event.preventDefault();
                if (!draggingSlideId || draggingSlideId === slide.id) return;
                const previousRects = captureSlideListRects();
                const changed = reorderSlides(draggingSlideId, slide.id);
                if (!changed) return;
                renderSlideSidebar();
                animateSlideListFromRects(previousRects);
                saveSlidePortalState();
            });
            list.appendChild(slideButton);
        });
    };
    const getSlideLayerLabel = (block = {}) => {
        const name = String(block.name || "").trim();
        if (name) return name;
        if (block.type === "text") {
            const text = getSlidePlainTextFromRuns(decodeSlideTextRunsForBlock(block)).replace(/\s+/g, " ").trim();
            return text ? (text.length > 34 ? `${text.slice(0, 34)}\u2026` : text) : "Text";
        }
        if (block.type === "chart") return String(block.title || "Chart").trim() || "Chart";
        if (block.type === "shape") return window.Plastic.shapeOptions.find((option) => option.type === block.shapeType)?.label || "Shape";
        if (block.type === "image") return "Image";
        return "Object";
    };
    const getSlideLayerTypeLabel = (block = {}) => {
        if (block.type === "text") return "T";
        if (block.type === "chart") return "CH";
        if (block.type === "shape") return "SH";
        if (block.type === "image") return "IM";
        return "OB";
    };
    const getSlideLayerContent = (block = {}) => {
        if (block.type === "text" || block.type === "image") return String(block.content || "");
        if (block.type === "chart") return JSON.stringify({
            title: block.title || "Chart",
            chartType: block.chartType || "bar",
            data: block.data || [],
            labelValues: block.labelValues === true
        }, null, 2);
        if (block.type === "shape") return String(block.shapeType || block.content || "rectangle");
        return String(block.content || "");
    };
    const getSlideLayerAppearance = (block = {}) => ({
        borderWidth: block.type === "shape" ? Number(block.strokeWidth ?? 2) : Number(block.borderWidth ?? 1),
        borderColor: block.type === "shape" ? String(block.stroke || "#2563eb") : String(block.borderColor || "#fb923c"),
        fill: block.type === "shape" ? String(block.fill || "transparent") : String(block.backgroundColor || "transparent"),
        opacity: Math.round(Math.max(0, Math.min(1, Number(block.opacity ?? 1))) * 100),
        borderRadius: Number(block.borderRadius || 0)
    });
    const getSlideLayerAdditionalProperties = (block = {}) => {
        const omittedKeys = new Set(["id", "name", "type", "content", "x", "y", "width", "height", "strokeWidth", "stroke", "fill", "opacity", "borderWidth", "borderColor", "backgroundColor", "borderRadius"]);
        return Object.fromEntries(Object.entries(block).filter(([key]) => !omittedKeys.has(key)));
    };
    const applySlideLayerDetails = (block = {}, windowNode = null) => {
        if (!block || !(windowNode instanceof HTMLElement)) return false;
        let additionalProperties;
        try {
            additionalProperties = JSON.parse(windowNode.querySelector("#editor-slide-layer-properties")?.value || "{}");
            if (!additionalProperties || typeof additionalProperties !== "object" || Array.isArray(additionalProperties)) throw new Error("Properties must be an object");
        } catch (_) {
            modular.error("Additional properties must be valid JSON");
            return false;
        }
        let parsedChartContent = null;
        const nextContent = String(windowNode.querySelector("#editor-slide-layer-content")?.value || "");
        if (block.type === "chart") {
            try {
                parsedChartContent = JSON.parse(nextContent || "{}");
                if (!parsedChartContent || typeof parsedChartContent !== "object" || Array.isArray(parsedChartContent)) throw new Error("Chart content must be an object");
            } catch (_) {
                modular.error("Chart content must be valid JSON");
                return false;
            }
        }
        const numberValue = (selector, fallback, minimum = 0) => {
            const value = Number(windowNode.querySelector(selector)?.value);
            return Number.isFinite(value) ? Math.max(minimum, value) : fallback;
        };
        Object.assign(block, additionalProperties, {
            id: String(block.id),
            name: String(windowNode.querySelector("#editor-slide-layer-name")?.value || "").trim() || getDefaultSlideBlockName(block),
            type: block.type,
            x: numberValue("#editor-slide-layer-x", block.x),
            y: numberValue("#editor-slide-layer-y", block.y),
            width: numberValue("#editor-slide-layer-width", block.width, SLIDE_GRID_SIZE * 3),
            height: numberValue("#editor-slide-layer-height", block.height, SLIDE_GRID_SIZE * 2)
        });
        const borderWidth = numberValue("#editor-slide-layer-border-width", block.type === "shape" ? block.strokeWidth : block.borderWidth, 0);
        const borderColor = String(windowNode.querySelector("#editor-slide-layer-border-color")?.value || "transparent").trim() || "transparent";
        const fill = String(windowNode.querySelector("#editor-slide-layer-fill")?.value || "transparent").trim() || "transparent";
        const opacity = numberValue("#editor-slide-layer-opacity", 100, 0);
        const borderRadius = numberValue("#editor-slide-layer-border-radius", 0, 0);
        if (block.type === "shape") {
            block.shapeType = nextContent.trim().toLowerCase();
            block.content = block.shapeType;
            block.strokeWidth = borderWidth;
            block.stroke = borderColor;
            block.fill = fill;
        } else {
            if (block.type === "text" && block.content !== nextContent) {
                block.content = nextContent;
                block.runs = encodeSlideTextRuns([{text: nextContent, style: getSlideBlockTextStyle(block)}], nextContent);
            } else if (block.type === "chart") Object.assign(block, parsedChartContent);
            else block.content = nextContent;
            block.borderWidth = borderWidth;
            block.borderColor = borderColor;
            block.backgroundColor = fill;
            block.borderRadius = borderRadius;
        }
        block.opacity = Math.max(0, Math.min(100, opacity)) / 100;
        normalizeSlideTextBlock(block);
        normalizeSlideChartBlock(block);
        normalizeSlideShapeBlock(block);
        clampSlideBlockToBounds(block);
        selectedSlideBlockId = block.id;
        renderSlideCanvas();
        saveSlidePortalState();
        return true;
    };
    const deleteSlideLayerFromDetails = (slideId = null, blockId = null, detailsPortal = null) => {
        const slide = activeSlideDeck.find((candidate) => candidate.id === slideId);
        const block = slide?.blocks?.find((candidate) => candidate.id === blockId);
        if (!slide || !block) {
            detailsPortal?.close?.();
            return false;
        }
        confirmationDialogue({
            title: "Delete layer",
            destructive: true,
            content: `Delete “${getSlideLayerLabel(block)}”? This layer will be removed from the slide.`,
            confirmation: () => {
                slide.blocks = (slide.blocks || []).filter((candidate) => candidate.id !== blockId);
                if (selectedSlideBlockId === blockId) selectedSlideBlockId = null;
                savedSlideSelectionOffsets = null;
                detailsPortal?.close?.();
                renderSlideEditor();
                saveSlidePortalState();
            }
        });
        return true;
    };
    const showSlideLayerDetailsPortal = (blockId = null) => {
        const ownerSlide = getActiveSlide();
        const block = ownerSlide?.blocks?.find((candidate) => candidate.id === blockId);
        if (!block) return false;
        selectedSlideBlockId = block.id;
        renderSlideCanvas();
        const appearance = getSlideLayerAppearance(block);
        const contentHelp = block.type === "chart" ? "Chart content is editable JSON." : (block.type === "shape" ? `Shape type: ${SLIDE_SHAPE_TYPES.join(", ")}.` : "Edit the object's displayed content.");
        let detailsPortal = null;
        const saveLayerDetails = (_, context) => {
            const windowNode = context?.window || detailsPortal?.window?.();
            if (!applySlideLayerDetails(block, windowNode)) return false;
            (context?.portal || detailsPortal)?.setTitle?.(`Layer Details: ${getSlideLayerLabel(block)}`);
            modular.success("Layer changes saved");
            return true;
        };
        detailsPortal = new Portal({
            title: `Layer Details: ${getSlideLayerLabel(block)}`,
            dimensions: [540, 680],
            navigation: false,
            tools: [{
                title: "Delete",
                icon: window.Plastic.icons.delete,
                destructive: true,
                onclick: (_, context) => deleteSlideLayerFromDetails(ownerSlide.id, block.id, context?.portal || detailsPortal)
            }, {
                title: "Save",
                icon: window.Plastic.icons.save,
                onclick: saveLayerDetails
            }],
            route: () => div({style: "large-padding-top editor-slide-layer-details editor-portal-shell", content: children([
                div({style: "editor-slide-layer-details-scroll", content: children([
                    div({style: "editor-slide-layer-details-section", content: children([
                        div({style: "editor-slide-layer-details-section-title", content: "Identity"}),
                        div({style: "editor-slide-layer-details-grid two", content: children([
                            div({content: children([label({input: "editor-slide-layer-name", content: "Name"}), input({id: "editor-slide-layer-name", style: "fill", value: getSlideLayerLabel(block)})])}),
                            div({content: children([label({input: "editor-slide-layer-id", content: "ID"}), input({id: "editor-slide-layer-id", style: "fill", value: String(block.id), readonly: true})])}),
                            div({content: children([label({input: "editor-slide-layer-type", content: "Object type"}), input({id: "editor-slide-layer-type", style: "fill", value: String(block.type || "object"), readonly: true})])})
                        ])})
                    ])}),
                    div({style: "editor-slide-layer-details-section", content: children([
                        div({style: "editor-slide-layer-details-section-title", content: "Content"}),
                        textarea({id: "editor-slide-layer-content", style: "fill editor-slide-layer-details-content", value: getSlideLayerContent(block), rows: block.type === "chart" ? 8 : 4}),
                        div({style: "editor-slide-layer-details-help", content: contentHelp})
                    ])}),
                    div({style: "editor-slide-layer-details-section", content: children([
                        div({style: "editor-slide-layer-details-section-title", content: "Geometry"}),
                        div({style: "editor-slide-layer-details-grid four", content: children([
                            div({content: children([label({input: "editor-slide-layer-x", content: "X"}), input({id: "editor-slide-layer-x", type: "number", style: "fill", min: 0, value: block.x})])}),
                            div({content: children([label({input: "editor-slide-layer-y", content: "Y"}), input({id: "editor-slide-layer-y", type: "number", style: "fill", min: 0, value: block.y})])}),
                            div({content: children([label({input: "editor-slide-layer-width", content: "Width"}), input({id: "editor-slide-layer-width", type: "number", style: "fill", min: SLIDE_GRID_SIZE * 3, value: block.width})])}),
                            div({content: children([label({input: "editor-slide-layer-height", content: "Height"}), input({id: "editor-slide-layer-height", type: "number", style: "fill", min: SLIDE_GRID_SIZE * 2, value: block.height})])})
                        ])})
                    ])}),
                    div({style: "editor-slide-layer-details-section", content: children([
                        div({style: "editor-slide-layer-details-section-title", content: "Appearance"}),
                        div({style: "editor-slide-layer-details-grid two", content: children([
                            div({content: children([label({input: "editor-slide-layer-border-width", content: "Border width"}), input({id: "editor-slide-layer-border-width", type: "number", style: "fill", min: 0, value: appearance.borderWidth})])}),
                            div({content: children([label({input: "editor-slide-layer-border-color", content: "Border color"}), input({id: "editor-slide-layer-border-color", style: "fill", value: appearance.borderColor})])}),
                            div({content: children([label({input: "editor-slide-layer-fill", content: block.type === "shape" ? "Fill color" : "Background"}), input({id: "editor-slide-layer-fill", style: "fill", value: appearance.fill})])}),
                            div({content: children([label({input: "editor-slide-layer-opacity", content: "Opacity (%)"}), input({id: "editor-slide-layer-opacity", type: "number", style: "fill", min: 0, max: 100, value: appearance.opacity})])}),
                            block.type !== "shape" && div({content: children([label({input: "editor-slide-layer-border-radius", content: "Corner radius"}), input({id: "editor-slide-layer-border-radius", type: "number", style: "fill", min: 0, value: appearance.borderRadius})])})
                        ].filter(Boolean))})
                    ])}),
                    div({style: "editor-slide-layer-details-section", content: children([
                        div({style: "editor-slide-layer-details-section-title", content: "Additional properties (JSON)"}),
                        textarea({id: "editor-slide-layer-properties", style: "fill editor-slide-layer-details-properties", value: JSON.stringify(getSlideLayerAdditionalProperties(block), null, 2), rows: 8})
                    ])})
                ])})
            ])}),
            afterRender: (windowNode) => {
                const contentNode = windowNode.querySelector("#editor-slide-layer-content");
                const propertiesNode = windowNode.querySelector("#editor-slide-layer-properties");
                if (contentNode instanceof HTMLTextAreaElement) contentNode.value = getSlideLayerContent(block);
                if (propertiesNode instanceof HTMLTextAreaElement) propertiesNode.value = JSON.stringify(getSlideLayerAdditionalProperties(block), null, 2);
            }
        });
        detailsPortal.show();
        return true;
    };
    const reorderSlideLayers = (draggedBlockId = null, targetBlockId = null, placeAfter = false) => {
        const activeSlide = getActiveSlide();
        if (!activeSlide || draggedBlockId === targetBlockId) return false;
        const displayOrder = [...(activeSlide.blocks || [])].reverse();
        const draggedIndex = displayOrder.findIndex((block) => block.id === draggedBlockId);
        if (draggedIndex < 0) return false;
        const [draggedBlock] = displayOrder.splice(draggedIndex, 1);
        const targetIndex = displayOrder.findIndex((block) => block.id === targetBlockId);
        if (targetIndex < 0) return false;
        displayOrder.splice(targetIndex + (placeAfter ? 1 : 0), 0, draggedBlock);
        activeSlide.blocks = displayOrder.reverse();
        return true;
    };
    const renderSlideLayers = () => {
        const list = document.getElementById("editor-slide-layers-list");
        const count = document.getElementById("editor-slide-layers-count");
        if (!list) return;
        const blocks = [...(getActiveSlide()?.blocks || [])].reverse();
        list.innerHTML = "";
        if (count) count.textContent = String(blocks.length);
        if (!blocks.length) {
            const emptyNode = document.createElement("div");
            emptyNode.className = "editor-slide-layers-empty";
            emptyNode.textContent = "No objects on this slide";
            list.appendChild(emptyNode);
            syncSlideLayersUiState();
            return;
        }
        blocks.forEach((block, index) => {
            const itemNode = document.createElement("button");
            itemNode.type = "button";
            itemNode.className = `editor-slide-layer-item${block.id === selectedSlideBlockId ? " active" : ""}`;
            itemNode.dataset.blockId = String(block.id);
            itemNode.setAttribute("aria-label", `Select ${getSlideLayerLabel(block)}`);
            itemNode.draggable = true;

            const typeNode = document.createElement("span");
            typeNode.className = `editor-slide-layer-type editor-slide-layer-type-${block.type || "object"}`;
            typeNode.textContent = getSlideLayerTypeLabel(block);

            const labelNode = document.createElement("span");
            labelNode.className = "editor-slide-layer-label";
            labelNode.textContent = getSlideLayerLabel(block);

            const orderNode = document.createElement("span");
            orderNode.className = "editor-slide-layer-order";
            orderNode.textContent = String(blocks.length - index);
            orderNode.title = "Stack position";

            itemNode.append(typeNode, labelNode, orderNode);
            itemNode.addEventListener("click", () => {
                if (Date.now() < suppressSlideLayerClickUntil) return;
                selectedSlideBlockId = block.id;
                savedSlideSelectionOffsets = null;
                blurSlideTextEditing();
                hideSlideInlineStyleEditor();
                renderSlideCanvas();
                saveSlidePortalState();
                showSlideLayerDetailsPortal(block.id);
            });
            itemNode.addEventListener("dragstart", (event) => {
                draggingSlideBlockId = block.id;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(block.id));
                itemNode.classList.add("dragging");
            });
            itemNode.addEventListener("dragover", (event) => {
                if (!draggingSlideBlockId || draggingSlideBlockId === block.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                const placeAfter = event.clientY > itemNode.getBoundingClientRect().top + (itemNode.offsetHeight / 2);
                list.querySelectorAll(".editor-slide-layer-item").forEach((node) => node.classList.remove("drop-before", "drop-after"));
                itemNode.classList.add(placeAfter ? "drop-after" : "drop-before");
            });
            itemNode.addEventListener("drop", (event) => {
                event.preventDefault();
                const draggedId = draggingSlideBlockId || String(event.dataTransfer.getData("text/plain") || "").trim();
                const placeAfter = event.clientY > itemNode.getBoundingClientRect().top + (itemNode.offsetHeight / 2);
                if (reorderSlideLayers(draggedId, block.id, placeAfter)) {
                    suppressSlideLayerClickUntil = Date.now() + 250;
                    renderSlideCanvas();
                    saveSlidePortalState();
                }
                draggingSlideBlockId = null;
            });
            itemNode.addEventListener("dragend", () => {
                draggingSlideBlockId = null;
                suppressSlideLayerClickUntil = Date.now() + 250;
                list.querySelectorAll(".editor-slide-layer-item").forEach((node) => node.classList.remove("dragging", "drop-before", "drop-after"));
            });
            list.appendChild(itemNode);
        });
        syncSlideLayersUiState();
    };
    const toggleSlideLayers = () => {
        slideLayersVisible = !slideLayersVisible;
        syncSlideLayersUiState();
        saveSlidePortalState();
    };
    const createSlideThumbnailNode = (slide = {}, targetWidth = 136) => {
        const viewport = getSlideThumbnailViewport();
        const safeViewportWidth = Math.max(320, viewport.width);
        const safeViewportHeight = Math.max(180, viewport.height);
        const safeTargetWidth = Math.max(96, Number(targetWidth) || 136);
        const scale = safeTargetWidth / safeViewportWidth;
        const previewHeight = Math.max(54, Math.round(safeViewportHeight * scale));
        const previewNode = document.createElement("div");
        previewNode.className = "editor-slide-thumb";
        previewNode.style.width = `${safeTargetWidth}px`;
        previewNode.style.height = `${previewHeight}px`;
        const sceneNode = document.createElement("div");
        sceneNode.className = "editor-slide-thumb-scene";
        sceneNode.style.width = `${safeViewportWidth}px`;
        sceneNode.style.height = `${safeViewportHeight}px`;
        sceneNode.style.transform = `scale(${scale})`;
        applySlideSurfaceBackground(sceneNode, slide?.background || null, false);
        (slide?.blocks || []).forEach((block) => {
            sceneNode.appendChild(createSlideThumbnailBlockNode(block));
        });
        previewNode.appendChild(sceneNode);
        return previewNode;
    };
    const createSlideShapeContentNode = (block = {}) => {
        normalizeSlideShapeBlock(block);
        const svgNamespace = "http://www.w3.org/2000/svg";
        const svgNode = document.createElementNS(svgNamespace, "svg");
        svgNode.classList.add("editor-slide-shape-content");
        svgNode.setAttribute("viewBox", "0 0 100 100");
        svgNode.setAttribute("preserveAspectRatio", "none");
        svgNode.setAttribute("aria-label", window.Plastic.shapeOptions.find((option) => option.type === block.shapeType)?.label || "Shape");
        let shapeNode;
        if (block.shapeType === "ellipse") {
            shapeNode = document.createElementNS(svgNamespace, "ellipse");
            shapeNode.setAttribute("cx", "50");
            shapeNode.setAttribute("cy", "50");
            shapeNode.setAttribute("rx", "47");
            shapeNode.setAttribute("ry", "47");
        } else if (block.shapeType === "triangle" || block.shapeType === "diamond") {
            shapeNode = document.createElementNS(svgNamespace, "path");
            shapeNode.setAttribute("d", block.shapeType === "triangle" ? "M50 3 L97 97 H3 Z" : "M50 3 L97 50 L50 97 L3 50 Z");
            shapeNode.setAttribute("stroke-linejoin", "round");
        } else {
            shapeNode = document.createElementNS(svgNamespace, "rect");
            shapeNode.setAttribute("x", "3");
            shapeNode.setAttribute("y", "3");
            shapeNode.setAttribute("width", "94");
            shapeNode.setAttribute("height", "94");
            if (block.shapeType === "rounded-rectangle") shapeNode.setAttribute("rx", "14");
        }
        shapeNode.setAttribute("fill", block.fill);
        shapeNode.setAttribute("stroke", block.stroke);
        shapeNode.setAttribute("stroke-width", String(block.strokeWidth));
        shapeNode.setAttribute("vector-effect", "non-scaling-stroke");
        svgNode.style.opacity = String(block.opacity);
        svgNode.appendChild(shapeNode);
        return svgNode;
    };
    const applySlideBlockAppearance = (blockNode = null, block = {}, includeEditorDefault = false) => {
        if (!(blockNode instanceof HTMLElement) || block.type === "shape") return;
        const hasBorderWidth = Number.isFinite(Number(block.borderWidth));
        const borderWidth = hasBorderWidth ? Math.max(0, Number(block.borderWidth)) : (includeEditorDefault ? 1 : 0);
        if (hasBorderWidth || includeEditorDefault) {
            blockNode.style.borderWidth = `${borderWidth}px`;
            blockNode.style.borderStyle = borderWidth > 0 ? "solid" : "none";
            blockNode.style.borderColor = String(block.borderColor || (includeEditorDefault ? "#fb923c" : "transparent"));
        }
        if (block.backgroundColor) blockNode.style.backgroundColor = String(block.backgroundColor);
        if (Number.isFinite(Number(block.borderRadius))) blockNode.style.borderRadius = `${Math.max(0, Number(block.borderRadius))}px`;
        if (Number.isFinite(Number(block.opacity))) blockNode.style.opacity = String(Math.max(0, Math.min(1, Number(block.opacity))));
    };
    const createSlideBlockNode = (block = {}) => {
        const blockNode = document.createElement("div");
        blockNode.className = "editor-slide-block";
        blockNode.dataset.blockId = String(block.id);
        blockNode.dataset.blockType = String(block.type || "");
        blockNode.style.left = `${block.x}px`;
        blockNode.style.top = `${block.y}px`;
        blockNode.style.width = `${block.width}px`;
        blockNode.style.height = `${block.height}px`;
        applySlideBlockAppearance(blockNode, block, true);
        if (block.id === selectedSlideBlockId) blockNode.classList.add("selected");
        if (block.type === "text") {
            const contentNode = document.createElement("div");
            contentNode.className = "editor-slide-text-content";
            contentNode.dataset.blockId = String(block.id);
            contentNode.setAttribute("contenteditable", "true");
            renderSlideTextBlockContent(contentNode, block);
            contentNode.addEventListener("input", () => {
                updateSlideTextBlockFromRuns(block, extractSlideTextRunsFromNode(contentNode));
                rememberSlideSelection(contentNode);
                renderSlideSidebar();
                updateSlideToolbarState();
                saveSlidePortalState();
            });
            contentNode.addEventListener("mousedown", (event) => {
                selectedSlideBlockId = block.id;
                event.stopPropagation();
                updateSlideToolbarState();
            });
            contentNode.addEventListener("focus", () => {
                selectedSlideBlockId = block.id;
                rememberSlideSelection(contentNode);
                scheduleSlideInlineStyleEditor(block.id, contentNode);
                updateSlideToolbarState();
            });
            contentNode.addEventListener("mouseup", (event) => {
                selectedSlideBlockId = block.id;
                rememberSlideSelection(contentNode);
                scheduleSlideInlineStyleEditor(block.id, contentNode, event);
                updateSlideToolbarState();
            });
            contentNode.addEventListener("keyup", (event) => {
                selectedSlideBlockId = block.id;
                rememberSlideSelection(contentNode);
                const selectionOffsets = getSlideSelectionOffsets(contentNode);
                if (!selectionOffsets || selectionOffsets.start !== selectionOffsets.end) scheduleSlideInlineStyleEditor(block.id, contentNode, event);
                updateSlideToolbarState();
            });
            contentNode.addEventListener("contextmenu", (event) => {
                selectedSlideBlockId = block.id;
                event.preventDefault();
                rememberSlideSelection(contentNode);
                scheduleSlideInlineStyleEditor(block.id, contentNode, event);
                updateSlideToolbarState();
            });
            blockNode.appendChild(contentNode);
        } else if (block.type === "chart") {
            normalizeSlideChartBlock(block);
            const chartNode = document.createElement("div");
            chartNode.className = "editor-slide-chart-content";
            renderSlideChartIntoNode(chartNode, block);
            blockNode.appendChild(chartNode);
        } else if (block.type === "shape") {
            blockNode.appendChild(createSlideShapeContentNode(block));
        } else {
            const imageNode = document.createElement("img");
            imageNode.className = "editor-slide-image-content";
            imageNode.src = block.content || "https://placehold.co/320x180?text=Image";
            blockNode.appendChild(imageNode);
        }
        const resizeHandle = document.createElement("div");
        resizeHandle.className = "editor-slide-resize-handle";
        blockNode.appendChild(resizeHandle);
        blockNode.addEventListener("mousedown", (event) => {
            if (event.button === 2) return;
            event.preventDefault();
            event.stopPropagation();
            const wasSelected = selectedSlideBlockId === block.id;
            selectedSlideBlockId = block.id;
            const bounds = getSlideCanvasBounds();
            if (!bounds.canvas) return;
            if (!wasSelected) renderSlideCanvas();
            const activeBlockNode = wasSelected ? blockNode : bounds.canvas.querySelector(`.editor-slide-block[data-block-id="${block.id}"]`);
            const blockRect = activeBlockNode?.getBoundingClientRect();
            const handleRect = resizeHandle.getBoundingClientRect();
            const isOnResizeControl = event.clientX >= handleRect.left && event.clientX <= handleRect.right && event.clientY >= handleRect.top && event.clientY <= handleRect.bottom;
            const borderHitPadding = Math.max(1, SLIDE_BORDER_DRAG_HIT_SIZE);
            const isBorderHit = Boolean(blockRect) && ((event.clientX - blockRect.left) <= borderHitPadding || (event.clientY - blockRect.top) <= borderHitPadding || (blockRect.right - event.clientX) <= borderHitPadding || (blockRect.bottom - event.clientY) <= borderHitPadding);
            const isResize = isOnResizeControl;
            const isMove = wasSelected && (block.type === "chart" || block.type === "shape" || isBorderHit) && !isOnResizeControl;
            if (isResize) {
                savedSlideSelectionOffsets = null;
                blurSlideTextEditing();
            } else if (block.type !== "text") {
                savedSlideSelectionOffsets = null;
                hideSlideInlineStyleEditor();
            }
            updateSlideToolbarState();
            if (!isResize && !isMove) {
                if (block.type === "text") {
                    const targetContentNode = activeBlockNode?.querySelector(".editor-slide-text-content");
                    if (targetContentNode instanceof HTMLElement) {
                        targetContentNode.focus();
                        scheduleSlideInlineStyleEditor(block.id, targetContentNode, event);
                    }
                }
                return;
            }
            const startX = event.clientX;
            const startY = event.clientY;
            const origin = {x: block.x, y: block.y, width: block.width, height: block.height};
            const moveHandler = (moveEvent) => {
                const deltaX = moveEvent.clientX - startX;
                const deltaY = moveEvent.clientY - startY;
                if (isResize) {
                    block.width = Math.max(SLIDE_GRID_SIZE * 3, snapSlideValue(origin.width + deltaX));
                    block.height = Math.max(SLIDE_GRID_SIZE * 2, snapSlideValue(origin.height + deltaY));
                } else {
                    block.x = snapSlideValue(origin.x + deltaX);
                    block.y = snapSlideValue(origin.y + deltaY);
                }
                clampSlideBlockToBounds(block);
                if (activeBlockNode) {
                    activeBlockNode.style.left = `${block.x}px`;
                    activeBlockNode.style.top = `${block.y}px`;
                    activeBlockNode.style.width = `${block.width}px`;
                    activeBlockNode.style.height = `${block.height}px`;
                    if (block.type === "chart") {
                        const chartContentNode = activeBlockNode.querySelector(".editor-slide-chart-content");
                        renderSlideChartIntoNode(chartContentNode, block);
                    }
                }
            };
            const upHandler = () => {
                window.removeEventListener("mousemove", moveHandler);
                window.removeEventListener("mouseup", upHandler);
                renderSlideSidebar();
                saveSlidePortalState();
            };
            window.addEventListener("mousemove", moveHandler);
            window.addEventListener("mouseup", upHandler);
        });
        return blockNode;
    };
    const renderSlideChartIntoNode = (targetNode = null, block = {}) => {
        if (!(targetNode instanceof HTMLElement)) return;
        normalizeSlideChartBlock(block);
        if (typeof window.Plastic?.renderChart === "function") {
            window.Plastic.renderChart(targetNode, {
                type: block.chartType,
                title: block.title || "Chart",
                data: block.data || [],
                width: Math.max(SLIDE_CHART_MIN_WIDTH, Number(block.width) || SLIDE_CHART_DEFAULT_WIDTH),
                height: Math.max(SLIDE_CHART_MIN_HEIGHT, Number(block.height) || SLIDE_CHART_DEFAULT_HEIGHT),
                labelValues: block.labelValues === true
            });
            return;
        }
        targetNode.textContent = block.title || "Chart";
    };
    const getSlideChartInsertionPoint = () => {
        const bounds = getSlideCanvasBounds();
        if (!bounds.canvas) return {x: SLIDE_GRID_SIZE, y: SLIDE_GRID_SIZE};
        const canvasRect = bounds.canvas.getBoundingClientRect();
        const pointFromRect = (sourceRect = null) => {
            if (!sourceRect) return null;
            return {x: snapSlideValue(sourceRect.left - canvasRect.left), y: snapSlideValue(sourceRect.bottom - canvasRect.top + SLIDE_GRID_SIZE)};
        };
        const contentNode = getSlideTextEditorFromSelection();
        if (contentNode instanceof HTMLElement) {
            const selection = window.getSelection();
            if (selection?.rangeCount) {
                const range = selection.getRangeAt(0);
                if (contentNode.contains(range.startContainer)) {
                    const rect = range.getBoundingClientRect();
                    const fallbackRect = contentNode.getBoundingClientRect();
                    const sourceRect = rect && (rect.width || rect.height) ? rect : fallbackRect;
                    const livePoint = pointFromRect(sourceRect);
                    if (livePoint) return livePoint;
                }
            }
        }
        if (savedSlideSelectionOffsets?.blockId) {
            const savedContentNode = document.querySelector(`.editor-slide-text-content[data-block-id="${savedSlideSelectionOffsets.blockId}"]`);
            if (savedContentNode instanceof HTMLElement) {
                const offset = Math.max(savedSlideSelectionOffsets.start || 0, savedSlideSelectionOffsets.end || 0);
                const savedPoint = resolveSlideSelectionPoint(savedContentNode, offset);
                const range = document.createRange();
                range.setStart(savedPoint.node, savedPoint.offset);
                range.collapse(true);
                const rect = range.getBoundingClientRect();
                const fallbackRect = savedContentNode.getBoundingClientRect();
                const savedRectPoint = pointFromRect(rect && (rect.width || rect.height) ? rect : fallbackRect);
                range.detach?.();
                if (savedRectPoint) return savedRectPoint;
            }
        }
        const selectedBlock = getActiveSlide()?.blocks?.find((block) => block.id === selectedSlideBlockId);
        if (selectedBlock) return {x: snapSlideValue(selectedBlock.x + SLIDE_GRID_SIZE), y: snapSlideValue(selectedBlock.y + SLIDE_GRID_SIZE)};
        return {x: SLIDE_GRID_SIZE, y: SLIDE_GRID_SIZE};
    };
    const parseSlideChartDataInput = (rawText = "") => String(rawText || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
        const parts = line.split(/,|\t/).map((part) => part.trim());
        const value = Number(parts[1] ?? parts[0]);
        return {label: parts.length > 1 ? (parts[0] || `Item ${index + 1}`) : `Item ${index + 1}`, value: Number.isFinite(value) ? value : 0};
    }).filter((item) => item.label || item.value);
    const serializeSlideChartData = (data = SLIDE_CHART_DEFAULT_DATA) => normalizeSlideChartData(data).map((item) => `${item.label}, ${item.value}`).join("\n");
    const getSlideChartDataPlaceholder = (chartType = "bar") => {
        if (chartType === "pie") return "Segment, Value\nHardware, 42\nSoftware, 33\nServices, 25";
        if (chartType === "scatter") return "Point, Value\nA, 12\nB, 28\nC, 18";
        return "Label, Value\nQ1, 24\nQ2, 38\nQ3, 31\nQ4, 46";
    };
    const insertSlideChart = ({type = "bar", title = "Chart", data = [], labelValues = false} = {}) => {
        const activeSlide = getActiveSlide();
        if (!activeSlide) return false;
        const insertionPoint = getSlideChartInsertionPoint();
        const block = normalizeSlideChartBlock({
            id: String(slideBlockCounter),
            name: String(title || "Chart").trim() || "Chart",
            type: "chart",
            chartType: type,
            title,
            data,
            labelValues,
            x: insertionPoint.x,
            y: insertionPoint.y,
            width: SLIDE_CHART_DEFAULT_WIDTH,
            height: SLIDE_CHART_DEFAULT_HEIGHT,
            content: type
        });
        slideBlockCounter += 1;
        clampSlideBlockToBounds(block);
        activeSlide.blocks.push(block);
        selectedSlideBlockId = block.id;
        savedSlideSelectionOffsets = null;
        blurSlideTextEditing();
        renderSlideCanvas();
        saveSlidePortalState();
        return true;
    };
    const showSlideChartPortal = () => {
        rememberSlideSelection();
        let selectedType = "bar";
        let activeTab = "type";
        let hasSubmittedChart = false;
        const chartPortal = new Portal({
            title: "Insert Chart",
            dimensions: [440, 500],
            route: () => div({style: "padded large-padding-top editor-portal-shell editor-slide-chart-portal", content: children([
                div({style: "padded", content: children([
                    div({style: "editor-slide-chart-tabs", content: children([
                        button({id: "editor-slide-chart-tab-type", style: "editor-slide-chart-tab selected", type: "button", content: "Type"}),
                        button({id: "editor-slide-chart-tab-data", style: "editor-slide-chart-tab", type: "button", content: "Data"})
                    ])}),
                    div({id: "editor-slide-chart-type-panel", style: "editor-slide-chart-panel", content: children([
                        label({content: "Chart type"}),
                        segmented({
                            id: "editor-slide-chart-type",
                            style: "editor-chart-type-segmented",
                            ariaLabel: "Chart type",
                            value: selectedType,
                            options: window.Plastic.chartTypes
                        })
                    ])}),
                    div({id: "editor-slide-chart-data-panel", style: "editor-slide-chart-panel hidden", content: children([
                        label({input: "editor-slide-chart-title", content: "Title"}),
                        input({id: "editor-slide-chart-title", style: "fill", placeholder: "Chart", value: "Chart"}),
                        label({input: "editor-slide-chart-data", style: "small-margin-top", content: "Data"}),
                        textarea({id: "editor-slide-chart-data", style: "fill editor-slide-chart-data-input", placeholder: getSlideChartDataPlaceholder(selectedType), value: serializeSlideChartData(SLIDE_CHART_DEFAULT_DATA), rows: 7}),
                        div({style: "small-margin-top", content: children([
                            input({id: "editor-slide-chart-label-values", type: "checkbox"}),
                            label({input: "editor-slide-chart-label-values", style: "inline small-margin-left", content: "Label Values"})
                        ])})
                    ])}),
                    div({id: "editor-slide-chart-preview", style: "editor-slide-chart-preview"}),
                    div({style: "float-right small-margin-top", content: children([
                        button({id: "editor-slide-chart-cancel", style: "secondary space-right", type: "button", content: "Cancel"}),
                        button({id: "editor-slide-chart-ok", style: "primary", type: "button", content: "OK"})
                    ])})
                ])})
            ])}),
            afterRender: (windowNode, routeContext) => {
                const syncTabs = () => {
                    windowNode.querySelector("#editor-slide-chart-tab-type")?.classList.toggle("selected", activeTab === "type");
                    windowNode.querySelector("#editor-slide-chart-tab-data")?.classList.toggle("selected", activeTab === "data");
                    windowNode.querySelector("#editor-slide-chart-type-panel")?.classList.toggle("hidden", activeTab !== "type");
                    windowNode.querySelector("#editor-slide-chart-data-panel")?.classList.toggle("hidden", activeTab !== "data");
                };
                const renderPreview = () => {
                    const previewNode = windowNode.querySelector("#editor-slide-chart-preview");
                    const dataInput = windowNode.querySelector("#editor-slide-chart-data");
                    const titleInput = windowNode.querySelector("#editor-slide-chart-title");
                    renderSlideChartIntoNode(previewNode, {
                        type: "chart",
                        chartType: selectedType,
                        title: titleInput?.value || "Chart",
                        data: parseSlideChartDataInput(dataInput?.value || "") || SLIDE_CHART_DEFAULT_DATA,
                        width: 360,
                        height: 180,
                        labelValues: windowNode.querySelector("#editor-slide-chart-label-values")?.checked === true
                    });
                };
                windowNode.querySelectorAll(".editor-slide-chart-tab").forEach((tabButton) => {
                    if (tabButton.dataset.bound === "1") return;
                    tabButton.dataset.bound = "1";
                    tabButton.addEventListener("click", (event) => {
                        event.preventDefault();
                        activeTab = tabButton.id.endsWith("data") ? "data" : "type";
                        syncTabs();
                    });
                });
                const chartTypeControl = windowNode.querySelector("#editor-slide-chart-type");
                if (chartTypeControl && chartTypeControl.dataset.bound !== "1") {
                    chartTypeControl.dataset.bound = "1";
                    chartTypeControl.addEventListener("change", (event) => {
                        selectedType = event.detail?.value || chartTypeControl.getAttribute("value") || "bar";
                        const dataInput = windowNode.querySelector("#editor-slide-chart-data");
                        if (dataInput instanceof HTMLTextAreaElement) dataInput.placeholder = getSlideChartDataPlaceholder(selectedType);
                        renderPreview();
                    });
                }
                ["#editor-slide-chart-title", "#editor-slide-chart-data", "#editor-slide-chart-label-values"].forEach((selector) => {
                    const inputNode = windowNode.querySelector(selector);
                    if (!inputNode || inputNode.dataset.bound === "1") return;
                    inputNode.dataset.bound = "1";
                    inputNode.addEventListener("input", renderPreview);
                    inputNode.addEventListener("change", renderPreview);
                });
                const cancelButton = windowNode.querySelector("#editor-slide-chart-cancel");
                if (cancelButton && cancelButton.dataset.bound !== "1") {
                    cancelButton.dataset.bound = "1";
                    cancelButton.addEventListener("click", (event) => {
                        event.preventDefault();
                        routeContext?.portal?.close?.();
                    });
                }
                const okButton = windowNode.querySelector("#editor-slide-chart-ok");
                if (okButton && okButton.dataset.bound !== "1") {
                    okButton.dataset.bound = "1";
                    okButton.addEventListener("click", (event) => {
                        event.preventDefault();
                        if (hasSubmittedChart) return;
                        const data = parseSlideChartDataInput(windowNode.querySelector("#editor-slide-chart-data")?.value || "");
                        if (!data.length) {
                            modular.error("Enter chart data");
                            return;
                        }
                        hasSubmittedChart = true;
                        insertSlideChart({
                            type: selectedType,
                            title: windowNode.querySelector("#editor-slide-chart-title")?.value || "Chart",
                            data,
                            labelValues: windowNode.querySelector("#editor-slide-chart-label-values")?.checked === true
                        });
                        routeContext?.portal?.close?.();
                    });
                }
                syncTabs();
                renderPreview();
            }
        });
        chartPortal.show();
    };
    const createSlidePresentationBlockNode = (block = {}) => {
        const blockNode = document.createElement("div");
        blockNode.className = "editor-slide-present-block";
        blockNode.dataset.blockId = String(block.id);
        blockNode.dataset.blockType = String(block.type || "");
        blockNode.style.left = `${block.x}px`;
        blockNode.style.top = `${block.y}px`;
        blockNode.style.width = `${block.width}px`;
        blockNode.style.height = `${block.height}px`;
        applySlideBlockAppearance(blockNode, block, false);
        if (block.type === "text") {
            const contentNode = document.createElement("div");
            contentNode.className = "editor-slide-present-text";
            renderSlideTextBlockContent(contentNode, block);
            blockNode.appendChild(contentNode);
        } else if (block.type === "chart") {
            const chartNode = document.createElement("div");
            chartNode.className = "editor-slide-present-chart";
            renderSlideChartIntoNode(chartNode, block);
            blockNode.appendChild(chartNode);
        } else if (block.type === "shape") {
            blockNode.appendChild(createSlideShapeContentNode(block));
        } else {
            const imageNode = document.createElement("img");
            imageNode.className = "editor-slide-present-image";
            imageNode.src = block.content || "https://placehold.co/320x180?text=Image";
            imageNode.alt = "";
            blockNode.appendChild(imageNode);
        }
        return blockNode;
    };
    const createSlideThumbnailBlockNode = (block = {}) => {
        const blockNode = createSlidePresentationBlockNode(block);
        blockNode.classList.add("editor-slide-thumb-block");
        blockNode.style.left = `${block.x}px`;
        blockNode.style.top = `${block.y}px`;
        blockNode.style.width = `${block.width}px`;
        blockNode.style.height = `${block.height}px`;
        return blockNode;
    };
    const renderSlidePresentation = () => {
        const overlay = document.getElementById("editor-slide-presentation");
        if (!overlay) return;
        const surfaceNode = overlay.querySelector(".editor-slide-present-surface");
        const counterNode = overlay.querySelector(".editor-slide-present-counter");
        if (!(surfaceNode instanceof HTMLElement)) return;
        const slide = activeSlideDeck[slidePresentationIndex] || getActiveSlide() || activeSlideDeck[0] || null;
        surfaceNode.innerHTML = "";
        if (!slide) return;
        applySlideSurfaceBackground(surfaceNode, slide.background || null, false);
        (slide.blocks || []).forEach((block) => {
            surfaceNode.appendChild(createSlidePresentationBlockNode(block));
        });
        if (counterNode instanceof HTMLElement) counterNode.textContent = `${slidePresentationIndex + 1} / ${activeSlideDeck.length}`;
    };
    const hideSlidePresentation = () => {
        const overlay = document.getElementById("editor-slide-presentation");
        if (overlay) overlay.remove();
        if (!slidePresentationActive) return;
        slidePresentationActive = false;
        window.removeEventListener("keydown", handleSlidePresentationKeydown, true);
        document.body.classList.remove("editor-slide-presenting");
    };
    const moveSlidePresentation = (direction = 1) => {
        if (!slidePresentationActive || activeSlideDeck.length <= 1) return;
        const nextIndex = Math.max(0, Math.min(activeSlideDeck.length - 1, slidePresentationIndex + direction));
        if (nextIndex === slidePresentationIndex) return;
        slidePresentationIndex = nextIndex;
        renderSlidePresentation();
    };
    function handleSlidePresentationKeydown(event) {
        if (!slidePresentationActive) return;
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            hideSlidePresentation();
            return;
        }
        if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
            event.preventDefault();
            moveSlidePresentation(1);
            return;
        }
        if (event.key === "ArrowLeft" || event.key === "PageUp") {
            event.preventDefault();
            moveSlidePresentation(-1);
        }
    }
    const showSlidePresentation = () => {
        if (slidePresentationActive) {
            renderSlidePresentation();
            return;
        }
        hideSlideBackgroundMenu();
        hideSlideOptionsMenu();
        hideSlideInlineStyleEditor();
        slidePresentationActive = true;
        slidePresentationIndex = getActiveSlideIndex();
        const overlay = document.createElement("div");
        overlay.id = "editor-slide-presentation";
        overlay.className = "editor-slide-presentation";
        overlay.innerHTML = [
            `<button type="button" class="editor-slide-present-exit" aria-label="Exit presentation">Exit</button>`,
            `<div class="editor-slide-present-stage">`,
            `<div class="editor-slide-present-surface"></div>`,
            `</div>`,
            `<div class="editor-slide-present-counter"></div>`
        ].join("");
        document.body.appendChild(overlay);
        document.body.classList.add("editor-slide-presenting");
        overlay.querySelector(".editor-slide-present-exit")?.addEventListener("click", hideSlidePresentation);
        overlay.addEventListener("click", (event) => {
            if (event.target?.closest?.(".editor-slide-present-exit")) return;
            moveSlidePresentation(1);
        });
        window.addEventListener("keydown", handleSlidePresentationKeydown, true);
        renderSlidePresentation();
    };
    const renderSlideCanvas = () => {
        const canvas = document.getElementById("editor-slide-canvas");
        if (!canvas) return;
        canvas.innerHTML = "";
        const activeSlide = getActiveSlide();
        if (!activeSlide) return;
        applySlideSurfaceBackground(canvas, activeSlide.background || null, slideGridVisible);
        activeSlide.blocks.forEach((block) => {
            clampSlideBlockToBounds(block);
            canvas.appendChild(createSlideBlockNode(block));
        });
        renderSlideSidebar();
        renderSlideLayers();
        updateSlideToolbarState();
    };
    const deleteSelectedSlideBlock = () => {
        const activeSlide = getActiveSlide();
        if (!activeSlide || !selectedSlideBlockId) return false;
        const nextBlocks = (activeSlide.blocks || []).filter((block) => block.id !== selectedSlideBlockId);
        if (nextBlocks.length === (activeSlide.blocks || []).length) return false;
        activeSlide.blocks = nextBlocks;
        selectedSlideBlockId = null;
        savedSlideSelectionOffsets = null;
        blurSlideTextEditing();
        renderSlideCanvas();
        saveSlidePortalState();
        return true;
    };
    const promptForSlideImageFile = () => new Promise((resolve) => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.addEventListener("change", () => resolve(fileInput.files?.[0] || null), {once: true});
        fileInput.click();
    });
    const uploadSlideImageFile = async (file) => {
        if (!(file instanceof File)) return "";
        const targetDirectory = getSlidesFileDirectory(activeSlideDeckFilePath) || "Documents";
        const uploadUrl = targetDirectory ? `/api/upload?directory=${encodeURIComponent(targetDirectory)}` : "/api/upload";
        if (typeof window.StandardUploads?.uploadFile === "function") {
            const response = await window.StandardUploads.uploadFile(file, uploadUrl, {label: `Uploading ${file.name || "image"}`});
            if (!response?.ok) throw new Error(`Upload failed (${response?.status || 0})`);
        } else {
            const formData = new FormData();
            formData.append("file", file);
            const response = await fetch(uploadUrl, {method: "POST", body: formData});
            if (!response.ok) throw new Error(`Upload failed (${response.status})`);
        }
        await window.StandardFilesRefreshCache?.();
        return targetDirectory ? `${targetDirectory}/${file.name}` : file.name;
    };
    const createSlideBlock = (type = "text") => {
        const activeSlide = getActiveSlide();
        if (!activeSlide) return;
        const block = {id: String(slideBlockCounter), name: type === "text" ? "Text" : "Image", type, x: SLIDE_GRID_SIZE, y: SLIDE_GRID_SIZE, width: type === "text" ? 240 : 260, height: type === "text" ? 120 : 160, content: type === "text" ? "Double click to edit" : "https://placehold.co/320x180?text=Image"};
        slideBlockCounter += 1;
        normalizeSlideTextBlock(block);
        clampSlideBlockToBounds(block);
        activeSlide.blocks.push(block);
        selectedSlideBlockId = block.id;
        renderSlideCanvas();
        saveSlidePortalState();
    };
    const insertSlideShape = (shapeType = "rectangle") => {
        const activeSlide = getActiveSlide();
        if (!activeSlide) return false;
        const insertionPoint = getSlideChartInsertionPoint();
        const block = normalizeSlideShapeBlock({
            id: String(slideBlockCounter),
            name: window.Plastic.shapeOptions.find((option) => option.type === shapeType)?.label || "Shape",
            type: "shape",
            shapeType,
            x: insertionPoint.x,
            y: insertionPoint.y,
            width: SLIDE_SHAPE_DEFAULT_WIDTH,
            height: SLIDE_SHAPE_DEFAULT_HEIGHT,
            fill: "#dbeafe",
            stroke: "#2563eb",
            strokeWidth: 2,
            opacity: 1
        });
        slideBlockCounter += 1;
        clampSlideBlockToBounds(block);
        activeSlide.blocks.push(block);
        selectedSlideBlockId = block.id;
        savedSlideSelectionOffsets = null;
        blurSlideTextEditing();
        renderSlideCanvas();
        saveSlidePortalState();
        return true;
    };
    const getSlideShapeBlockFromNode = (blockNode = null) => {
        const blockId = String(blockNode?.dataset?.blockId || "").trim();
        return getActiveSlide()?.blocks?.find((block) => block.id === blockId && block.type === "shape") || null;
    };
    const updateSlideShapeStyle = (blockNode = null, nextStyle = {}) => {
        const block = getSlideShapeBlockFromNode(blockNode);
        if (!block) return false;
        Object.assign(block, nextStyle);
        normalizeSlideShapeBlock(block);
        selectedSlideBlockId = block.id;
        renderSlideCanvas();
        saveSlidePortalState();
        return true;
    };
    const showSlideShapeStyleDialogue = (blockNode = null, property = "fill") => {
        const block = getSlideShapeBlockFromNode(blockNode);
        if (!block) return false;
        const controls = {
            fill: {title: "Shape fill color", placeholder: "#dbeafe, red, or transparent", value: block.fill},
            stroke: {title: "Shape border color", placeholder: "#2563eb, red, or transparent", value: block.stroke},
            strokeWidth: {title: "Shape border width", placeholder: "0–20", value: String(block.strokeWidth)},
            opacity: {title: "Shape opacity", placeholder: "0–100", value: String(Math.round(block.opacity * 100))}
        };
        const control = controls[property];
        if (!control) return false;
        inputDialogue({...control, confirmation: (_, rawValue) => {
                const value = String(rawValue || "").trim();
                if (property === "fill" || property === "stroke") {
                    if (!value) {
                        modular.error("Enter a color or transparent");
                        return false;
                    }
                    return updateSlideShapeStyle(blockNode, {[property]: value});
                }
                const numericValue = Number(value);
                const maxValue = property === "opacity" ? 100 : 20;
                if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > maxValue) {
                    modular.error(property === "opacity" ? "Enter opacity from 0 to 100" : "Enter border width from 0 to 20");
                    return false;
                }
                return updateSlideShapeStyle(blockNode, {[property]: property === "opacity" ? numericValue / 100 : numericValue});
            }
        });
        return true;
    };
    const bindSlideShapeContextMenu = (canvas = null) => {
        if (!canvas || canvas.dataset.shapeContextBound === "1") return;
        canvas.dataset.shapeContextBound = "1";
        const hasShapeContext = (_, target) => !!target?.closest?.('.editor-slide-block[data-block-type="shape"]');
        canvas.addEventListener("contextmenu", (event) => {
            const blockNode = event.target?.closest?.('.editor-slide-block[data-block-type="shape"]');
            if (!blockNode || !canvas.contains(blockNode)) return;
            selectedSlideBlockId = String(blockNode.dataset.blockId || "").trim() || null;
            canvas.querySelectorAll(".editor-slide-block").forEach((node) => node.classList.toggle("selected", node === blockNode));
            updateSlideToolbarState();
        }, true);
        canvas.contextmenu([{
            label: "Fill Color",
            icon: window.Plastic.icons.brush,
            visible: hasShapeContext,
            action: (_, __, target) => showSlideShapeStyleDialogue(target, "fill")
        }, {
            label: "Border Color",
            icon: window.Plastic.icons.rectangle,
            visible: hasShapeContext,
            action: (_, __, target) => showSlideShapeStyleDialogue(target, "stroke")
        }, {
            label: "Border Width",
            icon: window.Plastic.icons.modify,
            visible: hasShapeContext,
            action: (_, __, target) => showSlideShapeStyleDialogue(target, "strokeWidth")
        }, {
            label: "Opacity",
            icon: window.Plastic.icons.ellipse,
            visible: hasShapeContext,
            action: (_, __, target) => showSlideShapeStyleDialogue(target, "opacity")
        }, "separator", {
            label: "Delete Shape",
            icon: window.Plastic.icons.delete,
            destructive: true,
            visible: hasShapeContext,
            action: () => deleteSelectedSlideBlock()
        }], '.editor-slide-block[data-block-type="shape"]');
    };
    const bindSlideInteractions = () => {
        ensureSlideBackgroundMenu();
        ensureSlideOptionsMenu();
        bindSlideThumbnailContextMenu();
        const addSlideButton = document.getElementById("editor-slide-add");
        const fontFamilySelect = document.getElementById("editor-slide-font-family");
        const fontSizeSelect = document.getElementById("editor-slide-font-size");
        const boldButton = document.getElementById("editor-slide-style-bold");
        const italicButton = document.getElementById("editor-slide-style-italic");
        const textColorButton = document.getElementById("editor-slide-style-color");
        const backgroundColorButton = document.getElementById("editor-slide-style-background");
        const alignmentButton = document.getElementById("editor-slide-style-align");
        const addShapeButton = document.getElementById("editor-slide-add-shape");
        const layersButton = document.getElementById("editor-slide-layers-button");
        const bindSlideToolbarButtonFocus = (buttonNode) => {
            if (!buttonNode || buttonNode.dataset.selectionBound === "1") return;
            buttonNode.dataset.selectionBound = "1";
            buttonNode.addEventListener("mousedown", (event) => {
                event.preventDefault();
                rememberSlideSelection();
            });
        };
        if (document.body.dataset.slideSelectionBound !== "1") {
            document.body.dataset.slideSelectionBound = "1";
            document.addEventListener("selectionchange", handleSlideSelectionChange);
        }
        if (document.body.dataset.slideDeleteBound !== "1") {
            document.body.dataset.slideDeleteBound = "1";
            document.addEventListener("keydown", (event) => {
                if (slidePresentationActive || event.key !== "Delete") return;
                const activeEditor = document.activeElement?.closest?.(".editor-slide-text-content");
                if (activeEditor instanceof HTMLElement || !selectedSlideBlockId) return;
                event.preventDefault();
                event.stopPropagation();
                deleteSelectedSlideBlock();
            }, true);
        }
        if (addSlideButton && addSlideButton.dataset.bound !== "1") {
            addSlideButton.dataset.bound = "1";
            addSlideButton.addEventListener("click", () => {
                const slide = createSlideRecord(slideDeckCounter, `Slide ${slideDeckCounter}`);
                slideDeckCounter += 1;
                activeSlideDeck.push(slide);
                activeSlideId = slide.id;
                selectedSlideBlockId = null;
                savedSlideSelectionOffsets = null;
                renderSlideEditor();
                saveSlidePortalState();
            });
        }
        const addTextButton = document.getElementById("editor-slide-add-text");
        if (addTextButton && addTextButton.dataset.bound !== "1") {
            addTextButton.dataset.bound = "1";
            addTextButton.addEventListener("click", () => createSlideBlock("text"));
        }
        const addImageButton = document.getElementById("editor-slide-add-image");
        if (addImageButton && addImageButton.dataset.bound !== "1") {
            addImageButton.dataset.bound = "1";
            addImageButton.addEventListener("click", async () => {
                const selectedFile = await promptForSlideImageFile();
                if (!selectedFile) return;
                try {
                    const uploadedPath = await uploadSlideImageFile(selectedFile);
                    if (!uploadedPath) return;
                    createSlideBlock("image");
                    const activeSlide = getActiveSlide();
                    const selectedBlock = activeSlide?.blocks.find((block) => block.id === selectedSlideBlockId);
                    if (!selectedBlock || selectedBlock.type !== "image") return;
                    selectedBlock.content = getSlideBackgroundDownloadUrl(uploadedPath);
                    renderSlideCanvas();
                    saveSlidePortalState();
                } catch (error) {
                    console.error("Failed to upload slide image:", error);
                    modular.error("Unable to upload image");
                }
            });
        }
        const addChartButton = document.getElementById("editor-slide-add-chart");
        if (addChartButton && addChartButton.dataset.bound !== "1") {
            addChartButton.dataset.bound = "1";
            addChartButton.addEventListener("click", (event) => {
                event.preventDefault();
                showSlideChartPortal();
            });
        }
        if (addShapeButton && addShapeButton.dataset.bound !== "1") {
            addShapeButton.dataset.bound = "1";
            addShapeButton.popoutmenu(window.Plastic.shapeOptions.map((shape) => ({
                label: shape.label,
                icon: shape.icon,
                action: () => insertSlideShape(shape.type)
            })));
        }
        [boldButton, italicButton, textColorButton, backgroundColorButton, alignmentButton].forEach(bindSlideToolbarButtonFocus);
        if (fontFamilySelect && fontFamilySelect.dataset.bound !== "1") {
            fontFamilySelect.dataset.bound = "1";
            fontFamilySelect.addEventListener("mousedown", () => rememberSlideSelection());
            fontFamilySelect.addEventListener("change", (event) => {
                const nextFontFamily = window.StandardUI?.getSearchComboBoxValue?.(fontFamilySelect) || event?.target?.value || "Inter";
                applySlideToolbarStyle((style) => ({...style, fontFamily: nextFontFamily || ""}));
            });
        }
        if (fontSizeSelect && fontSizeSelect.dataset.bound !== "1") {
            fontSizeSelect.dataset.bound = "1";
            fontSizeSelect.addEventListener("mousedown", () => rememberSlideSelection());
            fontSizeSelect.addEventListener("change", (event) => {
                const nextSize = normalizeSlideFontSizeInput(window.StandardUI?.getSearchComboBoxValue?.(fontSizeSelect) || event?.target?.value || "");
                if (!nextSize) {
                    updateSlideToolbarState();
                    return;
                }
                applySlideToolbarStyle((style) => ({...style, fontSize: nextSize ? `${nextSize}px` : ""}));
            });
        }
        if (boldButton && boldButton.dataset.bound !== "1") {
            boldButton.dataset.bound = "1";
            boldButton.addEventListener("click", (event) => {
                event.preventDefault();
                applySlideToolbarStyle((style) => ({...style, fontWeight: style.fontWeight === "bold" ? "" : "bold"}));
            });
        }
        if (italicButton && italicButton.dataset.bound !== "1") {
            italicButton.dataset.bound = "1";
            italicButton.addEventListener("click", (event) => {
                event.preventDefault();
                applySlideToolbarStyle((style) => ({...style, fontStyle: style.fontStyle === "italic" ? "" : "italic"}));
            });
        }
        if (textColorButton && textColorButton.dataset.bound !== "1") {
            textColorButton.dataset.bound = "1";
            textColorButton.popoutmenu(window.Plastic.text_colors.map((colorOption) => ({
                label: colorOption.label,
                icon: `<div class="inline round small-icon space-right" style="background:${colorOption.value || "transparent"};border:1px solid var(--border)"></div>`,
                action: () => applySlideToolbarStyle((style) => ({...style, color: colorOption.value || ""}))
            })));
        }
        if (backgroundColorButton && backgroundColorButton.dataset.bound !== "1") {
            backgroundColorButton.dataset.bound = "1";
            backgroundColorButton.popoutmenu(window.Plastic.fillColors.map((colorOption) => ({
                label: colorOption.label,
                icon: `<div class="inline round small-icon space-right" style="background:${colorOption.value || "transparent"};border:1px solid var(--border)"></div>`,
                action: () => applySlideToolbarStyle((style) => ({...style, backgroundColor: colorOption.value || ""}))
            })));
        }
        if (alignmentButton && alignmentButton.dataset.bound !== "1") {
            alignmentButton.dataset.bound = "1";
            alignmentButton.popoutmenu([
                {label: "Align Left", icon: window.Plastic.icons.left, action: () => applySlideToolbarStyle((style) => ({...style, textAlign: "left"}))},
                {label: "Align Center", icon: window.Plastic.icons.center, action: () => applySlideToolbarStyle((style) => ({...style, textAlign: "center"}))},
                {label: "Align Right", icon: window.Plastic.icons.right, action: () => applySlideToolbarStyle((style) => ({...style, textAlign: "right"}))}
            ]);
        }
        const backgroundButton = document.getElementById("editor-slide-background-button");
        if (backgroundButton && backgroundButton.dataset.bound !== "1") {
            backgroundButton.dataset.bound = "1";
            backgroundButton.addEventListener("click", (event) => {
                event.stopPropagation();
                toggleSlideBackgroundMenu();
            });
        }
        const moreOptionsButton = document.getElementById("editor-slide-more-options");
        if (moreOptionsButton && moreOptionsButton.dataset.bound !== "1") {
            moreOptionsButton.dataset.bound = "1";
            moreOptionsButton.addEventListener("click", (event) => {
                event.stopPropagation();
                toggleSlideOptionsMenu();
            });
        }
        if (layersButton && layersButton.dataset.bound !== "1") {
            layersButton.dataset.bound = "1";
            layersButton.setAttribute("aria-controls", "editor-slide-layers-panel");
            layersButton.addEventListener("click", toggleSlideLayers);
        }
        const canvas = document.getElementById("editor-slide-canvas");
        if (canvas && canvas.dataset.bound !== "1") {
            canvas.dataset.bound = "1";
            bindSlideShapeContextMenu(canvas);
            canvas.addEventListener("mousedown", (event) => {
                if (event.button === 2) return;
                selectedSlideBlockId = null;
                savedSlideSelectionOffsets = null;
                hideSlideOptionsMenu();
                hideSlideInlineStyleEditor();
                renderSlideCanvas();
            });
        }
        renderSlideEditor();
    };
    const renderSlideEditor = () => {
        hideSlideBackgroundMenu();
        renderSlideSidebar();
        renderSlideCanvas();
        updateSlideToolbarState();
    };
    modular.register(new Service(SERVICE_ID, [
        new Portal({
            title: "Slides",
            hints: ["slides", "create slides", "create slideshow", "make a slideshow"],
            dimensions: [1200, 800],
            maximized: true,
            horizontal_nav: true,
            centered_nav: true,
            tools: [
                {
                    title: "Present",
                    icon: SLIDE_PRESENT_ICON,
                    onclick: () => showSlidePresentation()
                }, {
                    title: "Save",
                    icon: window.Plastic.icons.save,
                    onclick: () => saveLoadedSlidesDeck()
                }
            ],
            svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"/></svg>`,
            icon: "/icons/pwrpnt.png",
            route: function () {
                restoreSlidePortalState(this.portal);
                return div({style: "large-padding-top editor-slide-shell", content: children([
                    div({style: "editor-slide-body", content: children([
                        div({style: "editor-slide-sidebar radius", content: children([
                            div({id: "editor-slide-list", style: "editor-slide-list"})
                        ])}),
                        div({style: "editor-slide-workspace", content: children([
                            div({style: "editor-slide-toolbar secondary-bordered radius shadowed", content: children([
                                button({id: "editor-slide-add", style: "editor-slide-add-button float-right", icon: window.Plastic.icons.create}),
                                searchComboBox({id: "editor-slide-font-family", altsync: "FF", wrapperStyle: "search-combobox-wrapper searchbox-wrapper small-margin-right", style: "inner-radius editor-font-family-combo", value: "Inter", placeholder: "Font", options: window.Plastic.fontFamilies.map((fontName) => ({label: fontName, value: fontName}))}),
                                searchComboBox({id: "editor-slide-font-size", altsync: "FS", wrapperStyle: "search-combobox-wrapper searchbox-wrapper small-margin-right", style: "inner-radius editor-font-size-combo", value: "12", placeholder: "Size", allow_custom: true, options: window.Plastic.fontSizes.map((fontSize) => ({label: fontSize, value: fontSize}))}),
                                button({id: "editor-slide-style-bold", style: "naked align-bottom small-margin-right inner-radius", title: "Bold", icon: window.Plastic.icons.bold}),
                                button({id: "editor-slide-style-italic", style: "naked align-bottom small-margin-right inner-radius", title: "Italicize", icon: window.Plastic.icons.italic}),
                                button({id: "editor-slide-style-color", style: "naked align-bottom small-margin-right inner-radius", title: "Foreground", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 12.017578 2 A 0.750075 0.750075 0 0 0 11.294922 2.4941406 L 6.0507812 16.996094 A 0.75065194 0.75065194 0 1 0 7.4628906 17.505859 L 8.3691406 14.998047 L 15.638672 14.998047 L 16.546875 17.505859 A 0.750075 0.750075 0 1 0 17.957031 16.996094 L 12.705078 2.4941406 A 0.750075 0.750075 0 0 0 12.017578 2 z M 12 4.9550781 L 15.095703 13.498047 L 8.9121094 13.498047 L 12 4.9550781 z M 5.7480469 20.003906 A 0.750075 0.750075 0 1 0 5.7480469 21.503906 L 18.251953 21.503906 A 0.750075 0.750075 0 1 0 18.251953 20.003906 L 5.7480469 20.003906 z"/></svg>`}),
                                button({id: "editor-slide-add-text", style: "naked align-bottom small-margin-right inner-radius", title: "Add Text", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 11.984375 2.9863281 A 1.0001 1.0001 0 0 0 11.841797 3 L 4.25 3 A 1.0001 1.0001 0 0 0 3.2578125 3.875 L 3.0078125 5.875 A 1.0001 1.0001 0 1 0 4.9921875 6.125 L 5.1328125 5 L 11 5 L 11 19 L 9 19 A 1.0001 1.0001 0 1 0 9 21 L 11.832031 21 A 1.0001 1.0001 0 0 0 12.158203 21 L 15 21 A 1.0001 1.0001 0 1 0 15 19 L 13 19 L 13 5 L 18.867188 5 L 19.007812 6.125 A 1.0001 1.0001 0 1 0 20.992188 5.875 L 20.742188 3.875 A 1.0001 1.0001 0 0 0 19.75 3 L 12.167969 3 A 1.0001 1.0001 0 0 0 11.984375 2.9863281 z"/></svg>`}),
                                button({id: "editor-slide-add-image", style: "naked align-bottom small-margin-right inner-radius", title: "Add Image", icon: window.Plastic.icons.image}),
                                button({id: "editor-slide-add-chart", style: "naked align-bottom small-margin-right inner-radius", title: "Add Chart", icon: window.Plastic.icons.chart}),
                                button({id: "editor-slide-add-shape", style: "naked align-bottom small-margin-right inner-radius", title: "Insert Shape", icon: window.Plastic.icons.shapes}),
                                button({id: "editor-slide-style-background", style: "naked align-bottom small-margin-right inner-radius", title: "Fill", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 9.0996094 -0.00390625 A 0.750075 0.750075 0 0 0 8.578125 1.2832031 L 9.9414062 2.6484375 L 3.0214844 9.5722656 C 1.6862427 10.90878 1.6862427 13.097079 3.0214844 14.433594 L 9.5683594 20.984375 C 10.904906 22.320922 13.094894 22.322395 14.431641 20.984375 L 21.880859 13.53125 A 0.750075 0.750075 0 0 0 21.880859 12.472656 L 9.6386719 0.22265625 A 0.750075 0.750075 0 0 0 9.0996094 -0.00390625 z M 11.001953 3.7089844 L 20.289062 13.001953 L 13.371094 19.923828 C 12.60784 20.687809 11.39236 20.687282 10.628906 19.923828 L 4.0820312 13.373047 C 3.319273 12.609561 3.319273 11.396299 4.0820312 10.632812 L 11.001953 3.7089844 z M 8 13.25 A 0.75 0.75 0 0 0 8 14.75 A 0.75 0.75 0 0 0 8 13.25 z M 12 13.25 A 0.75 0.75 0 0 0 12 14.75 A 0.75 0.75 0 0 0 12 13.25 z M 16 13.25 A 0.75 0.75 0 0 0 16 14.75 A 0.75 0.75 0 0 0 16 13.25 z M 10 15.25 A 0.75 0.75 0 0 0 10 16.75 A 0.75 0.75 0 0 0 10 15.25 z M 14 15.25 A 0.75 0.75 0 0 0 14 16.75 A 0.75 0.75 0 0 0 14 15.25 z M 22 17 C 21.596 17 21.232875 17.301656 20.796875 17.972656 C 20.360875 18.643656 20 19.282 20 20 C 20 21.105 20.895 22 22 22 C 23.105 22 24 21.105 24 20 C 24 19.282 23.639125 18.643656 23.203125 17.972656 C 22.767125 17.301656 22.404 17 22 17 z M 12 17.25 A 0.75 0.75 0 0 0 12 18.75 A 0.75 0.75 0 0 0 12 17.25 z"/></svg>`}),
                                button({id: "editor-slide-style-align", style: "naked align-bottom small-margin-right inner-radius", title: "Alignment", icon: window.Plastic.icons.left}),
                                button({id: "editor-slide-background-button", style: "naked align-bottom small-margin-right inner-radius", title: "Slide background", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"/></svg>`}),
                                button({id: "editor-slide-layers-button", style: "naked align-bottom small-margin-right inner-radius", title: "Layers", icon: window.Plastic.icons.layers}),
                                button({id: "editor-slide-more-options", style: "naked align-bottom inner-radius", title: "Other", icon: window.Plastic.icons.ellipses})
                            ])}),
                            div({id: "editor-slide-canvas", style: "editor-slide-canvas secondary-bordered shadowed radius"})
                        ])}),
                        div({id: "editor-slide-layers-panel", style: `editor-slide-layers-panel window-sidebar${slideLayersVisible ? " is-open" : ""}`, content: children([
                            div({style: "editor-slide-layers-header", content: children([
                                div({style: "editor-slide-layers-title", content: "Layers"}),
                                div({id: "editor-slide-layers-count", style: "editor-slide-layers-count", content: "0"})
                            ])}),
                            div({id: "editor-slide-layers-list", style: "editor-slide-layers-list"})
                        ])})
                    ])})
                ])});
            },
            afterRender: function () {
                bindSlideInteractions();
                saveSlidePortalState();
                void loadSlideAppSettings(this.portal);
            }
        })
    ], SLIDE_EDITOR_SETTINGS));
})();
