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
    const DEFAULT_ARTICLE_ICON = "/images/blank_contact.png";
    const EDIT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.35" stroke="currentColor"><g transform="scale(0.9) translate(1.333 1.333) translate(0.25 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.75a2.121 2.121 0 1 1 3 3L9 17.25 4.5 18.75 6 14.25 16.5 3.75Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 5.25l3 3" /></g></svg>`;
    let activeTextFilePath = "";
    let activeTextFileContent = "Select a file to preview.";
    let activeTextReadOnly = false;
    let activeImageFilePath = "";
    let activeImageFileSource = "";
    let activeImageObjectUrl = "";
    let activeImageFetchToken = 0;
    let activeImageIntrinsicSize = null;
    let activeImageIsSvg = false;
    let activeImageNeedsWindowAutosize = false;
    let activeVideoFilePath = "";
    let activeVideoFileSource = "";
    let activeVideoObjectUrl = "";
    let activeVideoProgressRecord = null;
    let activeVideoLastSavedAt = 0;
    let activeVideoLastSavedTime = -1;
    let activeStandardDataReference = "";
    let activeStandardDataPayload = {};
    let activeArticleRecord = {};
    let activeArticleIconFile = null;
    let activeArticleIconChanged = false;
    let activeArticleIconPreview = {articleId: "", source: ""};
    const articleIconCacheKeys = {};
    const getPathForDownload = (rawPath = "") => String(rawPath || "").replace(/^\/home\/standard-system\//, "").replace(/^\/+/, "");
    const getFileName = (rawPath = "") => String(rawPath || "").split("/").pop() || "Internals";
    const findInternalsWindow = (portalIndex = 0) => [...Array.from(document.querySelectorAll(".draggable-window"))].reverse().find((windowNode) => typeof windowNode?.portal?.serviceId === "function" && windowNode.portal.serviceId() === "com.standard.internals" && windowNode.portal.portalIndex() === portalIndex);
    const getPortalFromSource = (sourceNode = null, portalIndex = 0) => {
        const sourcePortal = sourceNode?.closest?.(".draggable-window")?.portal;
        if (sourcePortal?.serviceId?.() === "com.standard.internals" && sourcePortal?.portalIndex?.() === portalIndex) return sourcePortal;
        return findInternalsWindow(portalIndex)?.portal || null;
    };
    const updatePortalTitle = (portalIndex, filePath = "", portal = null) => {
        portal = portal || findInternalsWindow(portalIndex)?.portal;
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
    const escapeHtml = (value = "") => `${value ?? ""}`.replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[character] || character));
    const sanitizeArticleUrl = (value = "") => {
        const raw = String(value || "").trim();
        if (/^https?:\/\//i.test(raw)) return raw;
        return "";
    };
    const normalizeArticleMarkdownSource = (value = "") => {
        const raw = String(value || "");
        return raw
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/\\n/g, "\n");
    };
    const renderArticleMarkdownInline = (value = "") => {
        return escapeHtml(value)
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/(\*\*|__)(?=\S)(.+?\S)\1/g, "<strong>$2</strong>")
            .replace(/(\*|_)(?=\S)(.+?\S)\1/g, "<em>$2</em>")
            .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, (_match, alt, url) => `<img src="${escapeHtml(url)}" alt="${alt}" loading="lazy">`)
            .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, text, url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`);
    };
    const renderArticleMarkdown = (value = "") => {
        const lines = normalizeArticleMarkdownSource(value).split("\n");
        const html = [];
        let paragraph = [];
        let listType = "";
        let inCode = false;
        let codeLines = [];
        const flushParagraph = () => {
            if (!paragraph.length) return;
            html.push(`<p>${paragraph.map(renderArticleMarkdownInline).join("<br>")}</p>`);
            paragraph = [];
        };
        const closeList = () => {
            if (!listType) return;
            html.push(`</${listType}>`);
            listType = "";
        };
        const flushCode = () => {
            html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
            codeLines = [];
        };
        lines.forEach((line) => {
            if (/^\s*```/.test(line)) {
                if (inCode) {
                    flushCode();
                    inCode = false;
                } else {
                    flushParagraph();
                    closeList();
                    inCode = true;
                    codeLines = [];
                }
                return;
            }
            if (inCode) {
                codeLines.push(line);
                return;
            }
            if (!line.trim()) {
                flushParagraph();
                closeList();
                return;
            }
            const heading = line.match(/^(#{1,6})\s*(.+)$/);
            if (heading) {
                flushParagraph();
                closeList();
                html.push(`<h${heading[1].length}>${renderArticleMarkdownInline(heading[2])}</h${heading[1].length}>`);
                return;
            }
            const quote = line.match(/^>\s?(.+)$/);
            if (quote) {
                flushParagraph();
                closeList();
                html.push(`<blockquote>${renderArticleMarkdownInline(quote[1])}</blockquote>`);
                return;
            }
            const unordered = line.match(/^\s*[-*]\s+(.+)$/);
            const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
            if (unordered || ordered) {
                flushParagraph();
                const nextType = unordered ? "ul" : "ol";
                if (listType && listType !== nextType) closeList();
                if (!listType) {
                    html.push(`<${nextType}>`);
                    listType = nextType;
                }
                html.push(`<li>${renderArticleMarkdownInline((unordered || ordered)[1])}</li>`);
                return;
            }
            closeList();
            paragraph.push(line);
        });
        if (inCode) flushCode();
        flushParagraph();
        closeList();
        return html.join("");
    };
    const getArticleIconCacheKey = (articleId) => {
        const cacheKey = articleIconCacheKeys[String(articleId)];
        return cacheKey ?? "cached";
    };
    const bumpArticleIconCacheKey = (articleId) => {
        if (!articleId) return;
        articleIconCacheKeys[String(articleId)] = Date.now();
    };
    const articleIconUrl = (articleId) => articleId ? `/api/records/images/${encodeURIComponent(articleId)}?cb=${encodeURIComponent(`${articleId}-${getArticleIconCacheKey(articleId)}`)}` : DEFAULT_ARTICLE_ICON;
    const cachedArticleIconSource = (articleId = "") => activeArticleIconPreview.articleId === String(articleId || "") ? activeArticleIconPreview.source : "";
    const articleIconSrc = (article = {}, {preferPreview = false} = {}) => {
        const articleId = String(article?.id || "");
        const previewSource = preferPreview ? cachedArticleIconSource(articleId) : "";
        return previewSource || (articleId ? articleIconUrl(articleId) : DEFAULT_ARTICLE_ICON);
    };
    const setArticleIconFallback = (imageEl) => {
        if (!imageEl || imageEl.src.endsWith(DEFAULT_ARTICLE_ICON)) return;
        imageEl.src = DEFAULT_ARTICLE_ICON;
    };
    document.addEventListener("error", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLImageElement) || !target.classList.contains("article-icon")) return;
        setArticleIconFallback(target);
    }, true);
    const resetArticleIconPickerBinding = (iconEl, bindingKey) => {
        if (!iconEl) return null;
        const previousBinding = iconEl[bindingKey];
        if (previousBinding?.input?.remove) previousBinding.input.remove();
        if (typeof previousBinding?.objectUrl === "string") URL.revokeObjectURL(previousBinding.objectUrl);
        iconEl.onclick = null;
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);
        const binding = {input: fileInput, objectUrl: null};
        iconEl[bindingKey] = binding;
        return binding;
    };
    const cacheArticleIconSource = (articleId = "", source = "") => {
        const normalizedId = String(articleId || "");
        const normalizedSource = String(source || "");
        activeArticleIconPreview = normalizedId && normalizedSource ? {articleId: normalizedId, source: normalizedSource} : {articleId: "", source: ""};
    };
    const getArticleIconCarryoverSource = (windowNode = findInternalsWindow(4)) => {
        const image = windowNode?.querySelector?.(".internals-article-icon");
        if (!(image instanceof HTMLImageElement)) return "";
        const imageSrc = String(image.currentSrc || image.src || "");
        if (!imageSrc || imageSrc.endsWith(DEFAULT_ARTICLE_ICON) || image.naturalWidth <= 0 || image.naturalHeight <= 0) return "";
        try {
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0);
            return canvas.toDataURL("image/png");
        } catch (_) {
            return imageSrc;
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
    const updateTextPreview = (portal = findInternalsWindow(0)?.portal) => {
        const root = portal?.window?.() || document;
        const textPreview = root.querySelector("#internals-text-preview");
        if (!textPreview) return;
        if (shouldRenderTextPreviewAsHtml(activeTextFilePath)) {
            textPreview.innerHTML = sanitizeTextPreviewMarkup(activeTextFileContent);
        } else {
            textPreview.textContent = activeTextFileContent;
        }
        const pathLabel = root.querySelector("#internals-text-preview-path");
        if (pathLabel) pathLabel.textContent = activeTextFilePath || "No file selected";
        updatePortalTitle(0, activeTextFilePath, portal);
        updateTextEditToolState(portal);
    };
    const updateTextEditToolState = (portal = findInternalsWindow(0)?.portal) => {
        const textWindow = portal?.window?.() || findInternalsWindow(0);
        const editTool = textWindow?.querySelector('[aria-label="Edit"]');
        if (!editTool) return;
        const isReadOnly = activeTextReadOnly === true;
        editTool.style.opacity = isReadOnly ? "0.4" : "";
        editTool.style.pointerEvents = isReadOnly ? "none" : "";
        editTool.setAttribute("aria-disabled", isReadOnly ? "true" : "false");
        editTool.title = isReadOnly ? "Read-only cache preview" : "Edit";
    };
    const updateImagePreview = ({autoSizeWindow = activeImageNeedsWindowAutosize, portal = findInternalsWindow(1)?.portal} = {}) => {
        const root = portal?.window?.() || document;
        const previewHost = root.querySelector("#internals-image-preview-host");
        if (!previewHost) return;
        previewHost.innerHTML = "";
        activeImageNeedsWindowAutosize = false;
        const svgMarkup = getSvgMarkupFromSource(activeImageFileSource);
        const shouldRenderSvg = SVG_FILE_PATTERN.test(String(activeImageFilePath || ""));
        if (shouldRenderSvg) {
            previewHost.innerHTML = svgMarkup || String(activeImageFileSource || "");
            const svgPreview = previewHost.querySelector("svg");
            if (svgPreview) {
                svgPreview.style.display = "block";
                svgPreview.style.borderRadius = "inherit";
                autoSizeImagePortalToImage(svgPreview, {resizeWindow: autoSizeWindow, portal});
            }
        } else if (activeImageFileSource) {
            const imagePreview = document.createElement("img");
            imagePreview.className = "radius";
            imagePreview.style.display = "";
            imagePreview.alt = activeImageFilePath || "Image preview";
            imagePreview.onload = () => autoSizeImagePortalToImage(imagePreview, {resizeWindow: autoSizeWindow, portal});
            imagePreview.src = activeImageFileSource;
            previewHost.appendChild(imagePreview);
            if (imagePreview.complete && imagePreview.naturalWidth > 0 && imagePreview.naturalHeight > 0) {
                autoSizeImagePortalToImage(imagePreview, {resizeWindow: autoSizeWindow, portal});
            }
        }
        const pathLabel = root.querySelector("#internals-image-preview-path");
        if (pathLabel) pathLabel.textContent = activeImageFilePath || "No file selected";
        updatePortalTitle(1, activeImageFilePath, portal);
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
    const refreshImageCacheInBackground = async (filePath = "", expectedToken = 0, portal = findInternalsWindow(1)?.portal) => {
        if (!filePath || expectedToken !== activeImageFetchToken) return;
        try {
            const latestContent = await fetchImageContentSource(filePath, {cacheBust: true});
            if (!latestContent?.source || expectedToken !== activeImageFetchToken || filePath !== activeImageFilePath) return;
            const hasChanged = latestContent.source !== activeImageFileSource;
            if (hasChanged) {
                activeImageFileSource = latestContent.source;
                activeImageIntrinsicSize = latestContent.intrinsicSize;
                activeImageIsSvg = latestContent.isSvg === true;
                activeImageNeedsWindowAutosize = true;
                updateImagePreview({autoSizeWindow: true, portal});
            }
            const savedState = portal?.windowState?.() || {};
            if (savedState?.cachedContent !== latestContent.source || savedState?.directive !== filePath) syncPortalWindowState(1, {directive: filePath, cachedContent: latestContent.source}, portal);
        } catch (_) {
        }
    };
    const autoSizeImagePortalToImage = (imagePreview, {resizeWindow = true, portal = findInternalsWindow(1)?.portal} = {}) => {
        const imageWidth = imagePreview?.naturalWidth || activeImageIntrinsicSize?.width || 0;
        const imageHeight = imagePreview?.naturalHeight || activeImageIntrinsicSize?.height || 0;
        if (!(imageWidth > 0) || !(imageHeight > 0)) return;
        const windowNode = portal?.window?.() || findInternalsWindow(1);
        if (!windowNode) return;
        const bodyNode = windowNode.querySelector(".window-body");
        if (!bodyNode) return;
        const routeShell = windowNode.querySelector("#internals-image-preview-shell");
        const fitScale = Math.min(1, IMAGE_VIEWER_MAX_WIDTH / imageWidth, IMAGE_VIEWER_MAX_HEIGHT / imageHeight);
        const targetImageWidth = Math.max(1, Math.round(imageWidth * fitScale));
        const targetImageHeight = Math.max(1, Math.round(imageHeight * fitScale));
        imagePreview.style.width = `${targetImageWidth}px`;
        imagePreview.style.height = `${targetImageHeight}px`;
        imagePreview.style.maxWidth = "none";
        imagePreview.style.maxHeight = "none";
        imagePreview.style.display = "block";
        const bodyStyles = window.getComputedStyle(bodyNode);
        const shellStyles = routeShell ? window.getComputedStyle(routeShell) : null;
        const bodyPaddingX = (Number.parseFloat(bodyStyles.paddingLeft) || 0) + (Number.parseFloat(bodyStyles.paddingRight) || 0);
        const bodyPaddingY = (Number.parseFloat(bodyStyles.paddingTop) || 0) + (Number.parseFloat(bodyStyles.paddingBottom) || 0);
        const shellPaddingX = shellStyles ? (Number.parseFloat(shellStyles.paddingLeft) || 0) + (Number.parseFloat(shellStyles.paddingRight) || 0) : 0;
        const shellPaddingY = shellStyles ? (Number.parseFloat(shellStyles.paddingTop) || 0) + (Number.parseFloat(shellStyles.paddingBottom) || 0) : 0;
        const requiredBodyWidth = Math.ceil(targetImageWidth + shellPaddingX + bodyPaddingX);
        const requiredBodyHeight = Math.ceil(targetImageHeight + shellPaddingY + bodyPaddingY);
        if (!resizeWindow) {
            const shellRect = routeShell?.getBoundingClientRect?.();
            const availableWidth = Math.max(1, (shellRect?.width || bodyNode.clientWidth) - shellPaddingX);
            const availableHeight = Math.max(1, (shellRect?.height || bodyNode.clientHeight) - shellPaddingY);
            const viewScale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
            imagePreview.style.width = `${Math.max(1, Math.round(imageWidth * viewScale))}px`;
            imagePreview.style.height = `${Math.max(1, Math.round(imageHeight * viewScale))}px`;
            bodyNode.style.overflow = "hidden";
            return;
        }
        bodyNode.style.width = "";
        bodyNode.style.height = "";
        bodyNode.style.minHeight = "";
        bodyNode.style.maxHeight = "";
        const contentNode = bodyNode.parentElement;
        const contentStyles = contentNode ? window.getComputedStyle(contentNode) : null;
        const contentRightExtras = contentStyles
            ? (Number.parseFloat(contentStyles.marginRight) || 0) + (Number.parseFloat(contentStyles.paddingRight) || 0) + (Number.parseFloat(contentStyles.borderRightWidth) || 0)
            : 0;
        const contentBottomExtras = contentStyles
            ? (Number.parseFloat(contentStyles.marginBottom) || 0) + (Number.parseFloat(contentStyles.paddingBottom) || 0) + (Number.parseFloat(contentStyles.borderBottomWidth) || 0)
            : 0;
        windowNode.style.width = `${Math.ceil(requiredBodyWidth + bodyNode.offsetLeft + contentRightExtras)}px`;
        windowNode.style.height = `${Math.ceil(requiredBodyHeight + bodyNode.offsetTop + contentBottomExtras)}px`;
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
        return window.StandardBrowserCache?.get?.(FILES_CACHE_INTERFACE, key, {format}) || null;
    };
    const writeFilesCache = async (key = "", value = null, {format = "", contentType = "application/json"} = {}) => {
        if (!key) return null;
        return window.StandardBrowserCache?.set?.(FILES_CACHE_INTERFACE, key, value, {format, contentType, label: key});
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
    const autoSizeArticlePortalToContent = (portal = findInternalsWindow(4)?.portal) => {
        const windowNode = portal?.window?.() || findInternalsWindow(4);
        if (!windowNode) return;
        const bodyNode = windowNode.querySelector(".window-body");
        const articlePreview = windowNode.querySelector("#internals-article-preview");
        if (!bodyNode || !articlePreview) return;
        bodyNode.style.height = "";
        bodyNode.style.minHeight = "";
        bodyNode.style.maxHeight = "";
        bodyNode.style.overflow = "visible";
        const bodyStyles = window.getComputedStyle(bodyNode);
        const contentNode = bodyNode.parentElement;
        const contentStyles = contentNode ? window.getComputedStyle(contentNode) : null;
        const bodyPaddingY = (Number.parseFloat(bodyStyles.paddingTop) || 0) + (Number.parseFloat(bodyStyles.paddingBottom) || 0);
        const contentBottomExtras = contentStyles
            ? (Number.parseFloat(contentStyles.marginBottom) || 0) + (Number.parseFloat(contentStyles.paddingBottom) || 0) + (Number.parseFloat(contentStyles.borderBottomWidth) || 0)
            : 0;
        const routeShell = articlePreview.parentElement;
        const requiredBodyHeight = Math.max(220, Math.ceil((routeShell?.scrollHeight || articlePreview.scrollHeight) + bodyPaddingY));
        windowNode.style.height = `${Math.ceil(requiredBodyHeight + bodyNode.offsetTop + contentBottomExtras)}px`;
        bodyNode.style.minHeight = `${requiredBodyHeight}px`;
        bodyNode.style.maxHeight = `${requiredBodyHeight}px`;
        bodyNode.style.height = `${requiredBodyHeight}px`;
    };
    const normalizeArticleRecord = (article = {}) => {
        if (!article || typeof article !== "object" || Array.isArray(article)) return {};
        return {
            id: article.id ?? "",
            title: article.title ?? "",
            description: article.description ?? "",
            link: article.link ?? "",
            content: article.content ?? "",
            source: article.source ?? "",
            priority: article.priority ?? "",
            created: article.created ?? ""
        };
    };
    const escapeCliQuotedValue = (value = "") => String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const articleTextField = (id = "", labelText = "", value = "", {textareaField = false} = {}) => {
        return div({content: children([
            div({style: "bold small-padding", content: labelText}),
            div({style: "padded", content: textareaField
                ? textarea({id, style: "undecorated no-padding internals-article-edit-textarea fill", value: String(value ?? "")})
                : input({id, style: "undecorated no-padding fill", value: String(value ?? "")})
            })
        ])});
    };
    const autoSizeArticleTextarea = (field) => {
        if (!(field instanceof HTMLTextAreaElement)) return;
        field.style.height = "auto";
        field.style.height = `${field.scrollHeight}px`;
    };
    const bindArticleTextareaAutosize = () => {
        const contentField = document.getElementById("modify-article-content");
        if (!(contentField instanceof HTMLTextAreaElement)) return;
        autoSizeArticleTextarea(contentField);
        contentField.addEventListener("input", () => autoSizeArticleTextarea(contentField));
        requestAnimationFrame(() => autoSizeArticleTextarea(contentField));
    };
    const getArticleEditFieldValue = (id = "") => document.getElementById(id)?.value?.trim?.() || "";
    const updateArticlePreview = (portal = findInternalsWindow(4)?.portal) => {
        const root = portal?.window?.() || document;
        const articlePreview = root.querySelector("#internals-article-preview");
        if (!articlePreview) return;
        const article = normalizeArticleRecord(activeArticleRecord);
        const title = String(article.title || "Untitled Article").trim();
        articlePreview.innerHTML = [
            `<div class="internals-article-header">`,
            `<div class="internals-article-meta">`,
            article.description ? `<div class="faded">${escapeHtml(article.description)}</div>` : "",
            `</div>`,
            `<img class="article-icon internals-article-icon" src="${escapeHtml(articleIconSrc(article, {preferPreview: true}))}" alt="${escapeHtml(title)}" />`,
            `<h2>${escapeHtml(title)}</h2>`,
            sanitizeArticleUrl(article.link) ? `<a href="${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.link)}</a>` : `<div>${escapeHtml(article.link)}</div>`,
            `</div>`,
            `<div class="internals-article-content">${renderArticleMarkdown(article.content)}</div>`,
            `<div class="internals-article-source faded">`,
            sanitizeArticleUrl(article.source) ? `<a href="${escapeHtml(article.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.source)}</a>` : escapeHtml(article.source),
            `</div>`
        ].join("");
        requestAnimationFrame(() => requestAnimationFrame(() => autoSizeArticlePortalToContent(portal)));
    };
    const bindArticleModifyPortal = () => {
        const article = normalizeArticleRecord(activeArticleRecord);
        const portalWindow = findInternalsWindow(5);
        const bindingKey = `${article.id || "new"}`;
        if (portalWindow?.dataset?.articleModifyBound === bindingKey) return;
        if (portalWindow?.dataset) portalWindow.dataset.articleModifyBound = bindingKey;
        const setValue = (id, value) => {
            const field = document.getElementById(id);
            if (field) field.value = value ?? "";
        };
        setValue("modify-article-title", article.title);
        setValue("modify-article-description", article.description);
        setValue("modify-article-link", article.link);
        setValue("modify-article-content", article.content);
        bindArticleTextareaAutosize();
        setValue("modify-article-source", article.source);
        setValue("modify-article-priority", article.priority);
        const iconEl = document.getElementById("modify-article-icon");
        if (!iconEl) return;
        iconEl.src = articleIconSrc(article, {preferPreview: true});
        iconEl.style.cursor = "pointer";
        activeArticleIconFile = null;
        activeArticleIconChanged = false;
        const binding = resetArticleIconPickerBinding(iconEl, "__modifyArticleIconPicker");
        const fileInput = binding?.input;
        if (!fileInput) return;
        iconEl.onclick = () => fileInput.click();
        fileInput.onchange = () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            if (!file.type || !file.type.startsWith("image/")) {
                activeArticleIconFile = null;
                activeArticleIconChanged = false;
                fileInput.value = "";
                return;
            }
            activeArticleIconFile = file;
            activeArticleIconChanged = true;
            if (binding.objectUrl) URL.revokeObjectURL(binding.objectUrl);
            binding.objectUrl = URL.createObjectURL(file);
            iconEl.src = binding.objectUrl;
            cacheArticleIconSource(article.id, binding.objectUrl);
            fileInput.value = "";
        };
    };
    const closeModifyArticlePortal = () => {
        const portal = findInternalsWindow(5)?.portal;
        if (typeof portal?.close === "function") {
            portal.close();
            return true;
        }
        if (typeof portal?.hide === "function") {
            portal.hide();
            return true;
        }
        return false;
    };
    const saveModifiedArticle = async () => {
        const articleId = activeArticleRecord?.id;
        if (!articleId) {
            modular.error("No article selected");
            return;
        }
        const nextArticle = normalizeArticleRecord({
            id: articleId,
            title: getArticleEditFieldValue("modify-article-title"),
            description: getArticleEditFieldValue("modify-article-description"),
            link: getArticleEditFieldValue("modify-article-link"),
            content: document.getElementById("modify-article-content")?.value || "",
            source: getArticleEditFieldValue("modify-article-source"),
            priority: getArticleEditFieldValue("modify-article-priority"),
            created: activeArticleRecord?.created ?? ""
        });
        try {
            const updates = [
                CLI.send(`[articles] title "${escapeCliQuotedValue(nextArticle.title)}" <id ${articleId}>`),
                CLI.send(`[articles] description "${escapeCliQuotedValue(nextArticle.description)}" <id ${articleId}>`),
                CLI.send(`[articles] link "${escapeCliQuotedValue(nextArticle.link)}" <id ${articleId}>`),
                CLI.send(`[articles] content "${escapeCliQuotedValue(nextArticle.content)}" <id ${articleId}>`),
                CLI.send(`[articles] source "${escapeCliQuotedValue(nextArticle.source)}" <id ${articleId}>`),
                CLI.send(`[articles] priority ${Number.parseInt(nextArticle.priority, 10) || 0} <id ${articleId}>`)
            ];
            const updateResponses = await Promise.all(updates);
            if (updateResponses.some(response => response === 0)) {
                modular.error("Failed to update one or more article fields");
                return;
            }
            if (activeArticleIconChanged && activeArticleIconFile) {
                const formData = new FormData();
                formData.append("file", activeArticleIconFile);
                const uploadResponse = typeof window.StandardUploads?.uploadFile === "function"
                    ? await window.StandardUploads.uploadFile(activeArticleIconFile, `/api/upload/temp/${encodeURIComponent(articleId)}`, {label: `Uploading ${activeArticleIconFile.name || "article icon"}`})
                    : await fetch(`/api/upload/temp/${encodeURIComponent(articleId)}`, {method: "POST", body: formData}).then(response => ({ok: response.ok, status: response.status}));
                if (!uploadResponse.ok) {
                    modular.error(`Icon upload failed (${uploadResponse.status})`);
                    return;
                }
                bumpArticleIconCacheKey(articleId);
                if (cachedArticleIconSource(articleId)) cacheArticleIconSource(articleId, cachedArticleIconSource(articleId));
            }
        } catch (error) {
            modular.error("Failed to save article");
            return;
        }
        activeArticleRecord = nextArticle;
        activeArticleIconFile = null;
        activeArticleIconChanged = false;
        closeModifyArticlePortal();
        const displayPortal = findInternalsWindow(4)?.portal;
        if (displayPortal) {
            syncPortalWindowState(4, {directive: String(activeArticleRecord.title || "Untitled Article").trim(), cachedContent: activeArticleRecord}, displayPortal);
            updateArticlePreview(displayPortal);
        } else {
            openArticle(activeArticleRecord);
        }
        modular.success("Saved article");
    };
    const deleteModifiedArticle = () => {
        const articleId = activeArticleRecord?.id;
        if (!articleId) {
            modular.error("No article selected");
            return;
        }
        const articleTitle = String(activeArticleRecord?.title || "this article").trim() || "this article";
        confirmationDialogue({title: "Delete Article", content: `You're sure you want to delete ${articleTitle}?`, confirmation: async () => {
                try {
                    const response = await CLI.send(`[articles] - <id ${articleId}>`);
                    if (response === 0) {
                        modular.error("Failed to delete article");
                        return;
                    }
                    closeModifyArticlePortal();
                    const displayPortal = findInternalsWindow(4)?.portal;
                    if (typeof displayPortal?.close === "function") {
                        displayPortal.close();
                    } else if (typeof displayPortal?.hide === "function") {
                        displayPortal.hide();
                    }
                    activeArticleRecord = {};
                    activeArticleIconFile = null;
                    activeArticleIconChanged = false;
                    cacheArticleIconSource("", "");
                    modular.success("Deleted article");
                } catch (error) {
                    modular.error("Failed to delete article");
                }
            }
        });
    };
    const syncPortalWindowState = (portalIndex, context = {}, portal = null) => {
        portal = portal || findInternalsWindow(portalIndex)?.portal;
        if (!portal || typeof portal.setWindowState !== "function") return;
        portal.setWindowState(context);
    };
    const hideTextPortal = (sourceNode = null) => {
        const portal = sourceNode?.closest?.(".draggable-window")?.portal || findInternalsWindow(0)?.portal;
        if (portal?.serviceId?.() === "com.standard.internals" && portal?.portalIndex?.() === 0 && typeof portal.hide === "function") portal.hide();
    };
    const restoreTextStateFromPortal = (portal = findInternalsWindow(0)?.portal) => {
        const state = portal?.windowState?.() || {};
        if (state?.directive) activeTextFilePath = String(state.directive);
        if (typeof state?.cachedContent === "string") activeTextFileContent = normalizeTextPreviewContent(state.cachedContent, state?.directive || activeTextFilePath);
        activeTextReadOnly = state?.readOnly === true;
    };
    const restoreImageStateFromPortal = (portal = findInternalsWindow(1)?.portal) => {
        const state = portal?.windowState?.() || {};
        activeImageFetchToken += 1;
        if (state?.directive) activeImageFilePath = String(state.directive);
        const restoredCachedSource = typeof state?.cachedContent === "string" && state.cachedContent.trim() !== "";
        if (restoredCachedSource) {
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
        if (activeImageFilePath && !restoredCachedSource) {
            void refreshImageCacheInBackground(activeImageFilePath, activeImageFetchToken, portal);
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
    const restoreArticleStateFromPortal = (portal = findInternalsWindow(4)?.portal) => {
        const state = portal?.windowState?.() || {};
        if (state?.cachedContent !== undefined) activeArticleRecord = normalizeArticleRecord(state.cachedContent);
    };
    const openTextInEditorApp = async sourceNode => {
        const sourcePortal = getPortalFromSource(sourceNode, 0);
        const sourceState = sourcePortal?.windowState?.() || {};
        const hasSourceState = !!(sourceState?.directive || sourceState?.cachedContent !== undefined);
        const sourceFilePath = String(sourceState?.directive || activeTextFilePath || "");
        const sourceContent = typeof sourceState?.cachedContent === "string" ? sourceState.cachedContent : activeTextFileContent;
        const sourceReadOnly = hasSourceState ? sourceState?.readOnly === true : activeTextReadOnly === true;
        if (sourceReadOnly) {
            modular.error("This preview is read-only");
            return;
        }
        if (!sourceFilePath) {
            modular.error("Open a text file first");
            return;
        }
        const shouldOpenInCodeEditor = CODE_FILE_PATTERN.test(String(sourceFilePath || ""));
        if (shouldOpenInCodeEditor) {
            if (typeof window.StandardCodeEditor?.openCodeFilePath !== "function") {
                if (typeof modular?.start === "function") modular.start("com.standard.editor.code");
                for (let attempt = 0; attempt < 20; attempt++) {
                    if (typeof window.StandardCodeEditor?.openCodeFilePath === "function") break;
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            if (typeof window.StandardCodeEditor?.openCodeFilePath === "function") {
                const opened = window.StandardCodeEditor.openCodeFilePath(sourceFilePath, sourceContent, sourceNode);
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
            const opened = window.StandardEditor.openTextFilePath(sourceFilePath, sourceContent, sourceNode);
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
            const portal = modular.show("com.standard.internals", 0, {newInstance: true});
            syncPortalWindowState(0, {directive: filePath, cachedContent: activeTextFileContent, readOnly: false}, portal);
            updateTextPreview(portal);
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
        const portal = modular.show("com.standard.internals", 0, {newInstance: true});
        syncPortalWindowState(0, {directive: activeTextFilePath, cachedContent: activeTextFileContent, readOnly}, portal);
        updateTextPreview(portal);
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
        activeImageNeedsWindowAutosize = true;
        const portal = modular.show("com.standard.internals", 1, {newInstance: true});
        syncPortalWindowState(1, {directive: activeImageFilePath, cachedContent: imageSource}, portal);
        updateImagePreview({autoSizeWindow: true, portal});
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
        activeImageNeedsWindowAutosize = true;
        const portal = modular.show("com.standard.internals", 1, {newInstance: true});
        syncPortalWindowState(1, {directive: filePath}, portal);
        updateImagePreview({autoSizeWindow: true, portal});
        void refreshImageCacheInBackground(filePath, activeImageFetchToken, portal);
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
    const openArticle = (article = {}, sourceNode = null) => {
        activeArticleRecord = normalizeArticleRecord(article);
        const title = String(activeArticleRecord.title || "Untitled Article").trim();
        const portal = modular.show("com.standard.internals", 4, {newInstance: true});
        syncPortalWindowState(4, {directive: title, cachedContent: activeArticleRecord}, portal);
        updateArticlePreview(portal);
        return true;
    };
    const openModifyArticleFromView = (sourceNode = null) => {
        const displayWindow = sourceNode?.closest?.(".draggable-window") || findInternalsWindow(4);
        const articleId = activeArticleRecord?.id;
        const carryoverSource = getArticleIconCarryoverSource(displayWindow);
        if (articleId && carryoverSource) cacheArticleIconSource(articleId, carryoverSource);
        const displayPortal = displayWindow?.portal || findInternalsWindow(4)?.portal;
        if (typeof displayPortal?.close === "function") {
            displayPortal.close();
        } else if (typeof displayPortal?.hide === "function") {
            displayPortal.hide();
        }
        modular.show("com.standard.internals", 5, {newInstance: true});
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
    window.StandardInternals.openArticle = (article = {}, options = {}) => openArticle(article, options?.sourceNode || null);
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
                title: "Edit",
                icon: EDIT_ICON,
                onclick: (event) => openTextInEditorApp(event?.target)
            }],
            route: () => div({style: "large-padding-top small-padding", content: children([div({id: "internals-text-preview", style: "padded", content: activeTextFileContent})])}),
            afterRender: function () {
                restoreTextStateFromPortal(this.portal);
                updateTextPreview(this.portal);
            }
        }),
        new Portal({
            title: "Image Viewer",
            internal: true,
            dimensions: [720, 540],
            navigation: false,
            route: () => div({id: "internals-image-preview-shell", style: "internals-image-viewer-shell large-padding-top fill", content: children([div({style: "internals-image-viewer-center", content: div({id: "internals-image-preview-host", style: "internals-image-preview-host radius"})})])}),
            afterRender: function () {
                restoreImageStateFromPortal(this.portal);
                updateImagePreview({portal: this.portal});
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
        }),
        new Portal({
            title: "Article",
            internal: true,
            dimensions: [680, 560],
            navigation: false,
            tools: [{
                title: "Edit",
                icon: EDIT_ICON,
                onclick: (event) => openModifyArticleFromView(event?.target)
            }],
            route: () => div({style: "large-padding-top small-padding", content: div({id: "internals-article-preview", style: "internals-article-preview"})}),
            afterRender: function () {
                restoreArticleStateFromPortal(this.portal);
                updateArticlePreview(this.portal);
            }
        }),
        new Portal({
            title: "Modify Article",
            internal: true,
            dimensions: [520, 620],
            navigation: false,
            tools: [{
                title: "Save",
                icon: modular.icons.save,
                onclick: saveModifiedArticle
            }, {
                title: "Delete",
                icon: modular.icons.delete,
                onclick: deleteModifiedArticle
            }],
            route: () => div({style: "large-padding-top small-padding", content: children([
                div({style: "internals-article-modify-header", content: children([
                    img({id: "modify-article-icon", style: "article-icon internals-article-modify-icon inline", src: articleIconSrc(activeArticleRecord, {preferPreview: true})}),
                    div({style: "internals-article-modify-title-fields", content: children([
                        articleTextField("modify-article-title", "Title", activeArticleRecord?.title),
                    ])})
                ])}),
                articleTextField("modify-article-link", "Link", activeArticleRecord?.link),
                articleTextField("modify-article-description", "Description", activeArticleRecord?.description),
                div({style: "internals-article-edit-full", content: articleTextField("modify-article-content", "Content", activeArticleRecord?.content, {textareaField: true})}),
                articleTextField("modify-article-source", "Source", activeArticleRecord?.source),
                articleTextField("modify-article-priority", "Priority", activeArticleRecord?.priority)
            ])}),
            afterRender: bindArticleModifyPortal
        })
    ]));
})();
