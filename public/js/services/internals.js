(async () => {
    const IMAGE_FILE_PATTERN = /\.(png|ico|gif|jpeg|jpg|svg|tiff|bm|avif|webp)$/i;
    const SVG_FILE_PATTERN = /\.svg$/i;
    const SVG_MARKUP_PATTERN = /^\s*<svg[\s>]/i;
    const VIDEO_FILE_PATTERN = /\.(mp4|webm|mov|m4v|avi|mkv|mpeg|mpg|ogv)$/i;
    const CODE_FILE_PATTERN = /\.(js|mjs|cjs|ts|tsx|jsx|json|css|scss|sass|less|html|htm|xml|yml|yaml|toml|ini|conf|cfg|env|sql|py|rb|php|java|c|h|hpp|cpp|cs|go|rs|swift|kt|kts|sh|bash|ps1|bat|cmd|pl|lua|r|dart|scala|clj|groovy|std|stds)$/i;
    const IMAGE_VIEWER_MAX_WIDTH = 750;
    const IMAGE_VIEWER_MAX_HEIGHT = 750;
    const FILES_CACHE_INTERFACE = "com.standard.files";
    const VIDEO_PROGRESS_SAVE_INTERVAL_MS = 1500;
    const HTML_TEXT_VIEW_PATTERN = /\.(wrds|html)$/i;
    const TEXT_DOCUMENT_CONTENT_PREFIX = "__STD_TEXT_EDITOR_B64__:";
    let activeTextFilePath = "";
    let activeTextFileContent = "Select a file to preview.";
    let activeTextReadOnly = false;
    let activeImageFilePath = "";
    let activeImageFileSource = "";
    let activeImageObjectUrl = "";
    let activeImageFetchToken = 0;
    let activeImageIntrinsicSize = null;
    let activeImageIsSvg = false;
    let activeVideoFilePath = "";
    let activeVideoFileSource = "";
    let activeVideoObjectUrl = "";
    let activeVideoProgressRecord = null;
    let activeVideoLastSavedAt = 0;
    let activeVideoLastSavedTime = -1;
    let activeStandardDataReference = "";
    let activeStandardDataPayload = {};
    const getPathForDownload = (rawPath = "") => String(rawPath || "").replace(/^\/home\/standard-system\//, "").replace(/^\/+/, "");
    const getFileName = (rawPath = "") => String(rawPath || "").split("/").pop() || "Internals";
    const findInternalsWindow = (portalIndex = 0) => [...Array.from(document.querySelectorAll(".draggable-window"))].reverse().find((windowNode) => typeof windowNode?.portal?.serviceId === "function" && windowNode.portal.serviceId() === "com.standard.internals" && windowNode.portal.portalIndex() === portalIndex);
    const updatePortalTitle = (portalIndex, filePath = "") => {
        const portal = findInternalsWindow(portalIndex)?.portal;
        if (portal && typeof portal.setTitle === "function") portal.setTitle(getFileName(filePath));
    };
    const shouldRenderTextPreviewAsHtml = (filePath = "") => HTML_TEXT_VIEW_PATTERN.test(String(filePath || ""));
    const decodeTextDocumentContent = (value = "") => {
        const raw = String(value || "");
        if (!raw.startsWith(TEXT_DOCUMENT_CONTENT_PREFIX)) return raw;
        try {
            const binary = atob(raw.slice(TEXT_DOCUMENT_CONTENT_PREFIX.length));
            const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
            return new TextDecoder().decode(bytes);
        } catch (_) {
            return "";
        }
    };
    const sanitizeTextPreviewMarkup = (markup = "") => {
        const parser = new DOMParser();
        const parsed = parser.parseFromString(`<div>${String(markup || "")}</div>`, "text/html");
        const root = parsed.body.firstElementChild;
        if (!root) return "";
        const allowedTags = new Set(["A", "B", "BLOCKQUOTE", "BR", "CODE", "DIV", "EM", "I", "IMG", "LI", "OL", "P", "PRE", "S", "SPAN", "STRONG", "TABLE", "TBODY", "TD", "TH", "THEAD", "TR", "U", "UL"]);
        const sanitizeUrl = (value, {image = false} = {}) => {
            const raw = String(value || "").trim();
            if (!raw) return "";
            if (image && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
            if (/^(https?:|mailto:|\/)/i.test(raw)) return raw;
            return "";
        };
        const sanitizeNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) return parsed.createTextNode(node.textContent || "");
            if (node.nodeType !== Node.ELEMENT_NODE) return null;
            const tagName = node.tagName.toUpperCase();
            if (!allowedTags.has(tagName)) {
                const fragment = parsed.createDocumentFragment();
                node.childNodes.forEach((child) => {
                    const sanitizedChild = sanitizeNode(child);
                    if (sanitizedChild) fragment.appendChild(sanitizedChild);
                });
                return fragment;
            }
            const clean = parsed.createElement(tagName.toLowerCase());
            if (tagName === "UL") {
                clean.style.listStyleType = node.style.listStyleType || "disc";
                clean.style.listStylePosition = "outside";
                clean.style.display = "block";
                clean.style.paddingLeft = "1.5rem";
                clean.style.margin = "0.5rem 0";
            }
            if (tagName === "OL") {
                clean.style.listStyleType = node.style.listStyleType || "decimal";
                clean.style.listStylePosition = "outside";
                clean.style.display = "block";
                clean.style.paddingLeft = "1.5rem";
                clean.style.margin = "0.5rem 0";
            }
            if (tagName === "LI") {
                clean.style.display = "list-item";
                clean.style.listStyle = "inherit";
                clean.style.listStylePosition = "inherit";
                clean.style.margin = "0.2rem 0";
            }
            if (tagName === "A") {
                const href = sanitizeUrl(node.getAttribute("href"));
                if (href) {
                    clean.setAttribute("href", href);
                    clean.setAttribute("target", "_blank");
                    clean.setAttribute("rel", "noopener noreferrer");
                }
            }
            if (tagName === "IMG") {
                const src = sanitizeUrl(node.getAttribute("src"), {image: true}) || sanitizeUrl(node.getAttribute("src"));
                if (!src) return null;
                clean.setAttribute("src", src);
                clean.setAttribute("alt", String(node.getAttribute("alt") || "Embedded image").slice(0, 200));
                clean.setAttribute("loading", "lazy");
                clean.style.maxWidth = "100%";
                clean.style.height = "auto";
                clean.style.display = "block";
                clean.style.margin = "8px 0";
                clean.style.borderRadius = "10px";
            }
            const safeStyle = String(node.getAttribute("style") || "");
            if (safeStyle && tagName !== "IMG") {
                const filteredStyle = safeStyle.split(";").map(rule => rule.trim()).filter(Boolean).filter((rule) => /^(text-align|font-weight|font-style|text-decoration|color|background-color|font-size|font-family|list-style-type)\s*:/i.test(rule)).join("; ");
                if (filteredStyle) clean.setAttribute("style", filteredStyle);
            }
            node.childNodes.forEach((child) => {
                const sanitizedChild = sanitizeNode(child);
                if (sanitizedChild) clean.appendChild(sanitizedChild);
            });
            return clean;
        };
        const wrapper = parsed.createElement("div");
        root.childNodes.forEach((child) => {
            const sanitizedChild = sanitizeNode(child);
            if (sanitizedChild) wrapper.appendChild(sanitizedChild);
        });
        return wrapper.innerHTML;
    };
    const normalizeTextPreviewContent = (content = "", filePath = "") => {
        const decodedContent = decodeTextDocumentContent(content);
        return shouldRenderTextPreviewAsHtml(filePath) ? sanitizeTextPreviewMarkup(decodedContent) : decodedContent;
    };
    const updateTextPreview = () => {
        const textPreview = document.getElementById("internals-text-preview");
        if (!textPreview) return;
        if (shouldRenderTextPreviewAsHtml(activeTextFilePath)) {
            textPreview.innerHTML = sanitizeTextPreviewMarkup(activeTextFileContent);
        } else {
            textPreview.textContent = activeTextFileContent;
        }
        const pathLabel = document.getElementById("internals-text-preview-path");
        if (pathLabel) pathLabel.textContent = activeTextFilePath || "No file selected";
        updatePortalTitle(0, activeTextFilePath);
        updateTextEditToolState();
    };
    const updateTextEditToolState = () => {
        const textWindow = findInternalsWindow(0);
        const editTool = textWindow?.querySelector('[aria-label="Edit in Editor"]');
        if (!editTool) return;
        const isReadOnly = activeTextReadOnly === true;
        editTool.style.opacity = isReadOnly ? "0.4" : "";
        editTool.style.pointerEvents = isReadOnly ? "none" : "";
        editTool.setAttribute("aria-disabled", isReadOnly ? "true" : "false");
        editTool.title = isReadOnly ? "Read-only cache preview" : "Edit in Editor";
    };
    const updateImagePreview = () => {
        const previewHost = document.getElementById("internals-image-preview-host");
        if (!previewHost) return;
        previewHost.innerHTML = "";
        const svgMarkup = getSvgMarkupFromSource(activeImageFileSource);
        const shouldRenderSvg = SVG_FILE_PATTERN.test(String(activeImageFilePath || ""));
        if (shouldRenderSvg) {
            previewHost.innerHTML = svgMarkup || String(activeImageFileSource || "");
            const svgPreview = previewHost.querySelector("svg");
            if (svgPreview) {
                svgPreview.style.display = "block";
                svgPreview.style.borderRadius = "inherit";
                autoSizeImagePortalToImage(svgPreview);
            }
        } else if (activeImageFileSource) {
            const imagePreview = document.createElement("img");
            imagePreview.className = "fill radius";
            imagePreview.style.display = "";
            imagePreview.alt = activeImageFilePath || "Image preview";
            imagePreview.onload = () => autoSizeImagePortalToImage(imagePreview);
            imagePreview.src = activeImageFileSource;
            previewHost.appendChild(imagePreview);
            if (imagePreview.complete && imagePreview.naturalWidth > 0 && imagePreview.naturalHeight > 0) {
                autoSizeImagePortalToImage(imagePreview);
            }
        }
        const pathLabel = document.getElementById("internals-image-preview-path");
        if (pathLabel) pathLabel.textContent = activeImageFilePath || "No file selected";
        updatePortalTitle(1, activeImageFilePath);
    };
    const imageDownloadUrl = (filePath = "", cacheBust = false) => {
        if (!filePath) return "";
        const params = new URLSearchParams({path: filePath});
        if (cacheBust) params.set("cb", `${Date.now()}`);
        return `/api/files/download?${params.toString()}`;
    };
    const revokeActiveObjectUrl = key => {
        const activeUrl = key === "image" ? activeImageObjectUrl : activeVideoObjectUrl;
        if (!activeUrl) return;
        try {
            URL.revokeObjectURL(activeUrl);
        } catch (_) {
        }
        if (key === "image") {
            activeImageObjectUrl = "";
            return;
        }
        activeVideoObjectUrl = "";
    };
    const blobToDataUrl = blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("Failed to read blob"));
        reader.readAsDataURL(blob);
    });
    const getSvgSourceFromMarkup = (markup = "") => {
        const svgMarkup = String(markup || "").trim();
        return svgMarkup ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}` : "";
    };
    const getSvgMarkupFromSource = (source = "") => {
        const rawSource = String(source || "").trim();
        if (!rawSource) return "";
        if (SVG_MARKUP_PATTERN.test(rawSource)) return rawSource;
        if (!rawSource.startsWith("data:image/svg+xml")) return "";
        const [, payload = ""] = rawSource.split(",", 2);
        try {
            if (/;base64/i.test(rawSource)) return atob(payload);
            return decodeURIComponent(payload);
        } catch (_) {
            return "";
        }
    };
    const getSvgIntrinsicSize = (markup = "") => {
        const svgMarkup = String(markup || "").trim();
        if (!svgMarkup) return null;
        try {
            const parsed = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
            const svgNode = parsed.documentElement?.nodeName?.toLowerCase?.() === "svg" ? parsed.documentElement : null;
            if (!svgNode) return null;
            const viewBox = String(svgNode.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
            if (viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) return {width: viewBox[2], height: viewBox[3]};
            const width = Number.parseFloat(String(svgNode.getAttribute("width") || "").replace(/[^\d.-]/g, ""));
            const height = Number.parseFloat(String(svgNode.getAttribute("height") || "").replace(/[^\d.-]/g, ""));
            if (width > 0 && height > 0) return {width, height};
        } catch (_) {
        }
        return null;
    };
    const resolveImageSourceFromContent = async (filePath = "", blob = null) => {
        if (SVG_FILE_PATTERN.test(String(filePath || ""))) {
            const svgMarkup = await blob.text();
            return {source: svgMarkup, intrinsicSize: getSvgIntrinsicSize(svgMarkup), isSvg: true};
        }
        return {source: await blobToDataUrl(blob), intrinsicSize: null, isSvg: false};
    };
    const fetchImageContentSource = async (filePath = "", {cacheBust = false} = {}) => {
        if (!filePath) return "";
        const response = await fetch(imageDownloadUrl(filePath, cacheBust), {cache: "no-store"});
        if (!response.ok) throw new Error("Unable to read image file");
        const blob = await response.blob();
        return resolveImageSourceFromContent(filePath, blob);
    };
    const refreshImageCacheInBackground = async (filePath = "", expectedToken = 0) => {
        if (!filePath || expectedToken !== activeImageFetchToken) return;
        try {
            const latestContent = await fetchImageContentSource(filePath, {cacheBust: true});
            if (!latestContent?.source || expectedToken !== activeImageFetchToken || filePath !== activeImageFilePath) return;
            const hasChanged = latestContent.source !== activeImageFileSource;
            if (hasChanged) {
                activeImageFileSource = latestContent.source;
                activeImageIntrinsicSize = latestContent.intrinsicSize;
                activeImageIsSvg = latestContent.isSvg === true;
                updateImagePreview();
            }
            const savedState = findInternalsWindow(1)?.portal?.windowState?.() || {};
            if (savedState?.cachedContent !== latestContent.source || savedState?.directive !== filePath) syncPortalWindowState(1, {directive: filePath, cachedContent: latestContent.source});
        } catch (_) {
        }
    };
    const autoSizeImagePortalToImage = (imagePreview) => {
        const imageWidth = imagePreview?.naturalWidth || activeImageIntrinsicSize?.width || 0;
        const imageHeight = imagePreview?.naturalHeight || activeImageIntrinsicSize?.height || 0;
        if (!(imageWidth > 0) || !(imageHeight > 0)) return;
        const windowNode = findInternalsWindow(1);
        if (!windowNode) return;
        const bodyNode = windowNode.querySelector(".window-body");
        if (!bodyNode) return;
        const fitScale = Math.min(1, IMAGE_VIEWER_MAX_WIDTH / imageWidth, IMAGE_VIEWER_MAX_HEIGHT / imageHeight);
        const targetImageWidth = Math.max(1, Math.round(imageWidth * fitScale));
        const targetImageHeight = Math.max(1, Math.round(imageHeight * fitScale));
        imagePreview.style.width = `${targetImageWidth}px`;
        imagePreview.style.height = `${targetImageHeight}px`;
        imagePreview.style.maxWidth = "none";
        imagePreview.style.maxHeight = "none";
        imagePreview.style.display = "block";
        bodyNode.style.width = "";
        bodyNode.style.height = "";
        bodyNode.style.minHeight = "";
        bodyNode.style.maxHeight = "";
        const bodyStyles = window.getComputedStyle(bodyNode);
        const bodyPaddingX = (Number.parseFloat(bodyStyles.paddingLeft) || 0) + (Number.parseFloat(bodyStyles.paddingRight) || 0);
        const bodyPaddingY = (Number.parseFloat(bodyStyles.paddingTop) || 0) + (Number.parseFloat(bodyStyles.paddingBottom) || 0);
        const requiredBodyWidth = Math.ceil(targetImageWidth + bodyPaddingX);
        const requiredBodyHeight = Math.ceil(targetImageHeight + bodyPaddingY);
        const chromeWidth = Math.max(0, windowNode.offsetWidth - bodyNode.clientWidth);
        const chromeHeight = Math.max(0, windowNode.offsetHeight - bodyNode.clientHeight);
        windowNode.style.width = `${requiredBodyWidth + chromeWidth}px`;
        windowNode.style.height = `${requiredBodyHeight + chromeHeight}px`;
        bodyNode.style.overflow = "hidden";
        bodyNode.style.minHeight = `${requiredBodyHeight}px`;
        bodyNode.style.maxHeight = `${requiredBodyHeight}px`;
        bodyNode.style.height = `${requiredBodyHeight}px`;
    };
    const createStableCacheHash = (value = "") => {
        let hash = 2166136261;
        const input = String(value || "");
        for (let i = 0; i < input.length; i++) {
            hash ^= input.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
    };
    const getVideoProgressCacheKey = (rawPath = "") => {
        const filePath = getPathForDownload(rawPath);
        const hash = filePath ? createStableCacheHash(filePath) : "";
        return hash ? `video-progress-${hash}` : "";
    };
    const readFilesCache = async (key = "", {format = ""} = {}) => {
        if (!key) return null;
        const params = new URLSearchParams();
        if (format) params.set("format", format);
        const response = await fetch(`/api/cache/${encodeURIComponent(FILES_CACHE_INTERFACE)}/${encodeURIComponent(key)}${params.toString() ? `?${params}` : ""}`);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("Unable to read cache");
        const contentType = `${response.headers.get("content-type") || ""}`.toLowerCase();
        if (contentType.includes("application/json")) return response.json();
        return response.text();
    };
    const writeFilesCache = async (key = "", value = null, {format = "", contentType = "application/json"} = {}) => {
        if (!key) return null;
        const params = new URLSearchParams();
        if (format) params.set("format", format);
        const response = await fetch(`/api/cache/${encodeURIComponent(FILES_CACHE_INTERFACE)}/${encodeURIComponent(key)}${params.toString() ? `?${params}` : ""}`, {method: "POST", headers: {"Content-Type": contentType}, body: typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2)});
        if (!response.ok) throw new Error("Unable to write cache");
        return response.json();
    };
    const getResumeTimeFromProgress = progressRecord => {
        const duration = Number(progressRecord?.duration) || 0;
        const currentTime = Number(progressRecord?.currentTime) || 0;
        if (!(currentTime > 0)) return 0;
        if (duration > 0 && currentTime >= Math.max(duration - 2, duration * 0.98)) return 0;
        return duration > 0 ? Math.min(currentTime, Math.max(duration - 0.25, 0)) : currentTime;
    };
    const applyActiveVideoResume = () => {
        const videoPreview = document.getElementById("internals-video-preview");
        if (!videoPreview) return;
        const resumeTime = getResumeTimeFromProgress(activeVideoProgressRecord);
        if (!(resumeTime > 0)) return;
        const duration = Number(videoPreview.duration) || 0;
        if (!(duration > 0)) return;
        const targetTime = Math.min(resumeTime, Math.max(duration - 0.25, 0));
        if (Math.abs(videoPreview.currentTime - targetTime) <= 0.5) return;
        try {
            videoPreview.currentTime = targetTime;
        } catch (_) {
        }
    };
    const loadActiveVideoProgress = async filePath => {
        const normalizedPath = getPathForDownload(filePath);
        if (!normalizedPath) {
            activeVideoProgressRecord = null;
            return null;
        }
        try {
            const cacheKey = getVideoProgressCacheKey(normalizedPath);
            const progressRecord = await readFilesCache(cacheKey, {format: "json"});
            const resolvedRecord = progressRecord && typeof progressRecord === "object" ? progressRecord : (typeof progressRecord === "string" && progressRecord.trim() ? JSON.parse(progressRecord) : null);
            if (normalizedPath !== activeVideoFilePath) return null;
            activeVideoProgressRecord = resolvedRecord;
            applyActiveVideoResume();
            syncPortalWindowState(2, {directive: normalizedPath, cachedContent: {progress: resolvedRecord}});
            return resolvedRecord;
        } catch (_) {
            if (normalizedPath === activeVideoFilePath) activeVideoProgressRecord = null;
            return null;
        }
    };
    const saveActiveVideoProgress = async ({force = false, completed = false} = {}) => {
        const videoPreview = document.getElementById("internals-video-preview");
        if (!videoPreview || !activeVideoFilePath) return;
        const duration = Number(videoPreview.duration) || Number(activeVideoProgressRecord?.duration) || 0;
        const rawCurrentTime = completed && duration > 0 ? duration : (Number(videoPreview.currentTime) || 0);
        const currentTime = Math.max(0, duration > 0 ? Math.min(rawCurrentTime, duration) : rawCurrentTime);
        const now = Date.now();
        if (!force && now - activeVideoLastSavedAt < VIDEO_PROGRESS_SAVE_INTERVAL_MS && Math.abs(currentTime - activeVideoLastSavedTime) < 1) {
            return;
        }
        const progressRecord = {currentTime, duration, updatedAt: new Date(now).toISOString()};
        activeVideoProgressRecord = progressRecord;
        activeVideoLastSavedAt = now;
        activeVideoLastSavedTime = currentTime;
        const cacheKey = getVideoProgressCacheKey(activeVideoFilePath);
        if (!cacheKey) return;
        try {
            await writeFilesCache(cacheKey, progressRecord, {format: "json", contentType: "application/json"});
            syncPortalWindowState(2, {directive: activeVideoFilePath, cachedContent: {progress: progressRecord}});
        } catch (_) {
        }
    };
    const updateVideoPreview = () => {
        const videoPreview = document.getElementById("internals-video-preview");
        if (!videoPreview) return;
        videoPreview.onloadedmetadata = () => {
            applyActiveVideoResume();
        };
        videoPreview.ontimeupdate = () => {
            saveActiveVideoProgress();
        };
        videoPreview.onpause = () => {
            saveActiveVideoProgress({force: true});
        };
        videoPreview.onended = () => {
            saveActiveVideoProgress({force: true, completed: true});
        };
        videoPreview.src = activeVideoFileSource;
        videoPreview.setAttribute("title", activeVideoFilePath || "Video preview");
        videoPreview.load();
        const pathLabel = document.getElementById("internals-video-preview-path");
        if (pathLabel) pathLabel.textContent = activeVideoFilePath || "No file selected";
        updatePortalTitle(2, activeVideoFilePath);
    };
    const formatStandardDataPayload = () => {
        if (typeof activeStandardDataPayload === "string") {
            try {
                return JSON.stringify(JSON.parse(activeStandardDataPayload), null, 2);
            } catch (_) {
                return activeStandardDataPayload;
            }
        }
        try {
            return JSON.stringify(activeStandardDataPayload ?? {}, null, 2);
        } catch (_) {
            return String(activeStandardDataPayload ?? "");
        }
    };
    const updateStandardDataPreview = () => {
        const dataPreview = document.getElementById("internals-data-preview");
        if (!dataPreview) return;
        dataPreview.textContent = formatStandardDataPayload();
        const referenceLabel = document.getElementById("internals-data-reference");
        if (referenceLabel) referenceLabel.textContent = activeStandardDataReference || "No standard selected";
        updatePortalTitle(3, activeStandardDataReference ? `Data ${activeStandardDataReference}` : "Data Portal");
    };
    const syncPortalWindowState = (portalIndex, context = {}) => {
        const portal = findInternalsWindow(portalIndex)?.portal;
        if (!portal || typeof portal.setWindowState !== "function") return;
        portal.setWindowState(context);
    };
    const hideTextPortal = (sourceNode = null) => {
        const portal = sourceNode?.closest?.(".draggable-window")?.portal || findInternalsWindow(0)?.portal;
        if (portal?.serviceId?.() === "com.standard.internals" && portal?.portalIndex?.() === 0 && typeof portal.hide === "function") portal.hide();
    };
    const restoreTextStateFromPortal = () => {
        const state = findInternalsWindow(0)?.portal?.windowState?.() || {};
        if (state?.directive) activeTextFilePath = String(state.directive);
        if (typeof state?.cachedContent === "string") activeTextFileContent = normalizeTextPreviewContent(state.cachedContent, state?.directive || activeTextFilePath);
        activeTextReadOnly = state?.readOnly === true;
    };
    const restoreImageStateFromPortal = () => {
        const state = findInternalsWindow(1)?.portal?.windowState?.() || {};
        activeImageFetchToken += 1;
        if (state?.directive) activeImageFilePath = String(state.directive);
        if (typeof state?.cachedContent === "string" && state.cachedContent.trim() !== "") {
            activeImageFileSource = state.cachedContent;
            activeImageObjectUrl = state.cachedContent.startsWith("blob:") ? state.cachedContent : "";
            activeImageIsSvg = SVG_MARKUP_PATTERN.test(state.cachedContent) || state.cachedContent.startsWith("data:image/svg+xml");
            activeImageIntrinsicSize = activeImageIsSvg ? getSvgIntrinsicSize(getSvgMarkupFromSource(state.cachedContent) || state.cachedContent) : null;
        } else if (activeImageFilePath) {
            revokeActiveObjectUrl("image");
            activeImageFileSource = SVG_FILE_PATTERN.test(activeImageFilePath) ? "" : imageDownloadUrl(activeImageFilePath);
            activeImageIntrinsicSize = null;
            activeImageIsSvg = SVG_FILE_PATTERN.test(activeImageFilePath);
        }
        if (activeImageFilePath) {
            void refreshImageCacheInBackground(activeImageFilePath, activeImageFetchToken);
        }
    };
    const restoreVideoStateFromPortal = () => {
        const state = findInternalsWindow(2)?.portal?.windowState?.() || {};
        if (state?.directive) {
            activeVideoFilePath = String(state.directive);
            activeVideoFileSource = typeof state?.cachedContent?.source === "string" && state.cachedContent.source.trim() ? state.cachedContent.source : `/api/files/download?path=${encodeURIComponent(activeVideoFilePath)}`;
            activeVideoObjectUrl = activeVideoFileSource.startsWith("blob:") ? activeVideoFileSource : "";
        }
        activeVideoProgressRecord = state?.cachedContent?.progress && typeof state.cachedContent.progress === "object" ? state.cachedContent.progress : null;
        activeVideoLastSavedAt = 0;
        activeVideoLastSavedTime = -1;
        if (activeVideoFilePath) void loadActiveVideoProgress(activeVideoFilePath);
    };

    const restoreStandardDataStateFromPortal = () => {
        const state = findInternalsWindow(3)?.portal?.windowState?.() || {};
        if (state?.directive) activeStandardDataReference = String(state.directive);
        if (state?.cachedContent !== undefined) activeStandardDataPayload = state.cachedContent;
    };
    const openTextInEditorApp = async sourceNode => {
        if (activeTextReadOnly) {
            modular.error("This preview is read-only");
            return;
        }
        if (!activeTextFilePath) {
            modular.error("Open a text file first");
            return;
        }
        const shouldOpenInCodeEditor = CODE_FILE_PATTERN.test(String(activeTextFilePath || ""));
        if (shouldOpenInCodeEditor) {
            if (typeof window.StandardCodeEditor?.openCodeFilePath !== "function") {
                if (typeof modular?.start === "function") modular.start("com.standard.editor.code");
                for (let attempt = 0; attempt < 20; attempt++) {
                    if (typeof window.StandardCodeEditor?.openCodeFilePath === "function") break;
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            if (typeof window.StandardCodeEditor?.openCodeFilePath === "function") {
                const opened = window.StandardCodeEditor.openCodeFilePath(activeTextFilePath, activeTextFileContent, sourceNode);
                if (opened !== false) hideTextPortal(sourceNode);
                return;
            }
        }
        if (typeof window.StandardEditor?.openTextFilePath !== "function") {
            if (typeof modular?.start === "function") modular.start("com.standard.editor.text");
            for (let attempt = 0; attempt < 20; attempt++) {
                if (typeof window.StandardEditor?.openTextFilePath === "function") break;
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        if (typeof window.StandardEditor?.openTextFilePath === "function") {
            const opened = window.StandardEditor.openTextFilePath(activeTextFilePath, activeTextFileContent, sourceNode);
            if (opened !== false) hideTextPortal(sourceNode);
        }
    };
    const openTextFilePath = async (rawPath = "", sourceNode = null) => {
        const filePath = getPathForDownload(rawPath);
        if (!filePath) return false;
        try {
            const response = await fetch(`/api/files/download?path=${encodeURIComponent(filePath)}`);
            if (!response.ok) throw new Error("Unable to read file");
            const fileBuffer = await response.arrayBuffer();
            activeTextFilePath = filePath;
            activeTextFileContent = normalizeTextPreviewContent(new TextDecoder().decode(fileBuffer), filePath);
            activeTextReadOnly = false;
            modular.show("com.standard.internals", 0);
            syncPortalWindowState(0, {directive: filePath, cachedContent: activeTextFileContent, readOnly: false});
            updateTextPreview();
            return true;
        } catch (_) {
            modular.error("Unable to open file in Internals");
            return false;
        }
    };
    const openTextContent = (title = "", content = "", options = {}) => {
        const readOnly = options?.readOnly !== false;
        activeTextFilePath = String(title || "Cache Preview");
        activeTextFileContent = normalizeTextPreviewContent(content, activeTextFilePath);
        activeTextReadOnly = readOnly;
        modular.show("com.standard.internals", 0);
        syncPortalWindowState(0, {directive: activeTextFilePath, cachedContent: activeTextFileContent, readOnly});
        updateTextPreview();
        return true;
    };
    const openImageSource = (source = "", options = {}) => {
        const rawImageSource = String(source || "").trim();
        const isSvgMarkup = SVG_MARKUP_PATTERN.test(rawImageSource);
        const imageSource = rawImageSource;
        if (!imageSource) return false;
        activeImageFetchToken += 1;
        if (options?.revokePrevious) revokeActiveObjectUrl("image");
        activeImageFilePath = String(options?.path || options?.title || "Image Preview");
        activeImageFileSource = imageSource;
        activeImageObjectUrl = !isSvgMarkup && options?.isObjectUrl ? imageSource : "";
        activeImageIsSvg = isSvgMarkup || imageSource.startsWith("data:image/svg+xml") || SVG_FILE_PATTERN.test(activeImageFilePath);
        activeImageIntrinsicSize = activeImageIsSvg ? getSvgIntrinsicSize(getSvgMarkupFromSource(imageSource) || rawImageSource) : null;
        modular.show("com.standard.internals", 1);
        syncPortalWindowState(1, {directive: activeImageFilePath, cachedContent: imageSource});
        updateImagePreview();
        return true;
    };
    const openImageFilePath = (rawPath = "", sourceNode = null) => {
        const filePath = getPathForDownload(rawPath);
        if (!filePath) return false;
        activeImageFetchToken += 1;
        revokeActiveObjectUrl("image");
        activeImageFilePath = filePath;
        activeImageFileSource = SVG_FILE_PATTERN.test(filePath) ? "" : imageDownloadUrl(filePath);
        activeImageIntrinsicSize = null;
        activeImageIsSvg = SVG_FILE_PATTERN.test(filePath);
        modular.show("com.standard.internals", 1);
        syncPortalWindowState(1, {directive: filePath});
        updateImagePreview();
        void refreshImageCacheInBackground(filePath, activeImageFetchToken);
        return true;
    };
    const openVideoFilePath = async (rawPath = "", sourceNode = null) => {
        const filePath = getPathForDownload(rawPath);
        if (!filePath) return false;
        revokeActiveObjectUrl("video");
        activeVideoFilePath = filePath;
        activeVideoFileSource = `/api/files/download?path=${encodeURIComponent(filePath)}`;
        activeVideoProgressRecord = null;
        activeVideoLastSavedAt = 0;
        activeVideoLastSavedTime = -1;
        modular.show("com.standard.internals", 2);
        syncPortalWindowState(2, {directive: filePath, cachedContent: {progress: null}});
        updateVideoPreview();
        void loadActiveVideoProgress(filePath);
        return true;
    };
    const openVideoSource = async (rawPath = "", source = "", options = {}) => {
        const filePath = getPathForDownload(rawPath) || String(options?.title || "Video Preview");
        const videoSource = String(source || "").trim();
        if (!filePath || !videoSource) return false;
        if (options?.revokePrevious) revokeActiveObjectUrl("video");
        activeVideoFilePath = filePath;
        activeVideoFileSource = videoSource;
        activeVideoObjectUrl = options?.isObjectUrl ? videoSource : "";
        activeVideoProgressRecord = null;
        activeVideoLastSavedAt = 0;
        activeVideoLastSavedTime = -1;
        modular.show("com.standard.internals", 2);
        syncPortalWindowState(2, {directive: filePath, cachedContent: {progress: null, source: videoSource}});
        updateVideoPreview();
        void loadActiveVideoProgress(filePath);
        return true;
    };
    const openStandardData = (standardReference = "", payload = {}, sourceNode = null) => {
        activeStandardDataReference = String(standardReference || "").trim() || "Unknown";
        activeStandardDataPayload = payload ?? {};
        modular.show("com.standard.internals", 3);
        syncPortalWindowState(3, {directive: activeStandardDataReference, cachedContent: activeStandardDataPayload});
        updateStandardDataPreview();
        return true;
    };
    window.StandardInternals = window.StandardInternals || {};
    window.StandardInternals.openTextFilePath = (rawPath = "", sourceNode = null) => openTextFilePath(rawPath, sourceNode);
    window.StandardInternals.openTextContent = (title = "", content = "", options = {}) => openTextContent(title, content, options);
    window.StandardInternals.openImageSource = (source = "", options = {}) => openImageSource(source, options);
    window.StandardInternals.openImageFilePath = (rawPath = "", sourceNode = null) => openImageFilePath(rawPath, sourceNode);
    window.StandardInternals.openVideoFilePath = (rawPath = "", sourceNode = null) => openVideoFilePath(rawPath, sourceNode);
    window.StandardInternals.openVideoSource = (rawPath = "", source = "", options = {}) => openVideoSource(rawPath, source, options);
    window.addEventListener("beforeunload", () => {
        void saveActiveVideoProgress({force: true});
        revokeActiveObjectUrl("image");
        revokeActiveObjectUrl("video");
    });
    window.StandardInternals.openStandardData = (standardReference = "", payload = {}, options = {}) => openStandardData(standardReference, payload, options?.sourceNode || null);
    window.StandardInternals.openFilePath = (rawPath = "", sourceNode = null) => {
        if (IMAGE_FILE_PATTERN.test(String(rawPath || ""))) return openImageFilePath(rawPath, sourceNode);
        if (VIDEO_FILE_PATTERN.test(String(rawPath || ""))) return openVideoFilePath(rawPath, sourceNode);
        return openTextFilePath(rawPath, sourceNode);
    };
    modular.register(new Service("com.standard.internals", [
        new Portal({
            title: "Internals",
            internal: true,
            dimensions: [520, 460],
            navigation: false,
            tools: [{
                title: "Edit in Editor",
                icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.35" stroke="currentColor"><g transform="scale(0.9) translate(1.333 1.333) translate(0.25 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.75a2.121 2.121 0 1 1 3 3L9 17.25 4.5 18.75 6 14.25 16.5 3.75Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 5.25l3 3" /></g></svg>`,
                onclick: (event) => openTextInEditorApp(event?.target)
            }],
            route: () => div({style: "large-padding-top small-padding", content: children([div({id: "internals-text-preview", style: "padded", content: activeTextFileContent})])}),
            afterRender: () => {
                restoreTextStateFromPortal();
                updateTextPreview();
            }
        }),
        new Portal({
            title: "Image Viewer",
            internal: true,
            dimensions: [720, 540],
            navigation: false,
            route: () => div({style: "large-padding-top fill", content: children([div({style: "fit-center", content: div({id: "internals-image-preview-host", style: "radius"})})])}),
            afterRender: () => {
                restoreImageStateFromPortal();
                updateImagePreview();
            }
        }),
        new Portal({
            title: "Video Viewer",
            internal: true,
            dimensions: [760, 560],
            navigation: false,
            route: () => div({style: "large-padding-top fill", content: children([div({style: "fit-center", content: `<video id="internals-video-preview" class="fill radius" controls playsinline src="${activeVideoFileSource}"></video>`})])}),
            afterRender: () => {
                restoreVideoStateFromPortal();
                updateVideoPreview();
            }
        }),
        new Portal({
            title: "Data Portal",
            internal: true,
            dimensions: [620, 500],
            navigation: false,
            route: () => div({style: "large-padding-top small-padding", content: `<pre id="internals-data-preview" class="small-padding bordered inner-radius shadowed no-wrap" style="white-space:pre-wrap;margin:0">${formatStandardDataPayload()}</pre>`}),
            afterRender: () => {
                restoreStandardDataStateFromPortal();
                updateStandardDataPreview();
            }
        })
    ]));
})();