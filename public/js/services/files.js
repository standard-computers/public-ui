(async () => {
    const FILES_SERVICE_ID = "com.standard.files";
    const FILES_SETTINGS = {
        display_style: {
            label: "Display style",
            type: "text",
            default: "rows",
            restrictions: ["rows", "tiles", "details"]
        },
        photo_display_style: {
            label: "Photo display style",
            type: "text",
            default: "cascade",
            restrictions: ["cascade", "grid"]
        }
    };
    const NOTE_CONTENT_PREFIX = "__STD_NOTE_B64__:";

    let photoCascadeObserver = null;
    let photoDisplayStyle = "cascade";
    const photoObjectUrls = new Set();
    const PHOTO_GRID_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"/></svg>`;
    const PHOTO_CASCADE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 0 1-1.125-1.125v-3.75ZM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-8.25ZM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-2.25Z"/></svg>`;

    const decodeNoteContent = value => {
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

    const normalizeNoteContent = value => decodeNoteContent(value);

    const normalizeNoteRecord = (note = {}) => ({
        ...note,
        id: note.id ?? note.ID ?? "",
        title: note.title ?? note.TTL ?? note.ttl ?? "",
        content: note.content ?? note.CNT ?? note.cnt ?? "",
        color: note.color ?? note.CLR ?? note.clr ?? "",
        created: note.created ?? note.CRTD ?? note.crtd ?? ""
    });

    const sanitizeNoteMarkup = markup => {
        const parser = new DOMParser();
        const parsed = parser.parseFromString(`<div>${String(markup || "")}</div>`, "text/html");
        const root = parsed.body.firstElementChild;
        if (!root) return "";
        const allowedTags = new Set(["A", "B", "BR", "DIV", "EM", "I", "IMG", "LI", "OL", "P", "S", "SPAN", "STRONG", "U", "UL"]);
        const sanitizeUrl = (value, {image = false} = {}) => {
            const raw = String(value || "").trim();
            if (!raw) return "";
            if (image && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
            if (/^(https?:|mailto:|\/)/i.test(raw)) return raw;
            return "";
        };
        const sanitizeNode = node => {
            if (node.nodeType === Node.TEXT_NODE) return parsed.createTextNode(node.textContent || "");
            if (node.nodeType !== Node.ELEMENT_NODE) return null;
            const tagName = node.tagName.toUpperCase();
            if (!allowedTags.has(tagName)) {
                const fragment = parsed.createDocumentFragment();
                node.childNodes.forEach(child => {
                    const sanitizedChild = sanitizeNode(child);
                    if (sanitizedChild) fragment.appendChild(sanitizedChild);
                });
                return fragment;
            }
            const clean = parsed.createElement(tagName.toLowerCase());
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
                clean.setAttribute("alt", String(node.getAttribute("alt") || "Note image").slice(0, 200));
                clean.setAttribute("loading", "lazy");
                clean.setAttribute("style", "max-width:100%;height:auto;display:block;border-radius:10px;margin:8px 0;cursor:zoom-in");
            }
            node.childNodes.forEach(child => {
                const sanitizedChild = sanitizeNode(child);
                if (sanitizedChild) clean.appendChild(sanitizedChild);
            });
            return clean;
        };
        const wrapper = parsed.createElement("div");
        root.childNodes.forEach(child => {
            const sanitizedChild = sanitizeNode(child);
            if (sanitizedChild) wrapper.appendChild(sanitizedChild);
        });
        return wrapper.innerHTML;
    };
    const openNoteImage = async source => {
        const imageSource = String(source || "").trim();
        if (!imageSource) return false;
        if (typeof window.StandardInternals?.openImageSource === "function") return window.StandardInternals.openImageSource(imageSource, {title: "Note Image"});
        if (typeof window.StandardInternals?.openImageFilePath === "function" && !imageSource.startsWith("data:image/")) return window.StandardInternals.openImageFilePath(imageSource);
        if (typeof modular?.start === "function") modular.start("com.standard.internals");
        for (let attempt = 0; attempt < 20; attempt++) {
            if (typeof window.StandardInternals?.openImageSource === "function") return window.StandardInternals.openImageSource(imageSource, {title: "Note Image"});
            if (typeof window.StandardInternals?.openImageFilePath === "function" && !imageSource.startsWith("data:image/")) return window.StandardInternals.openImageFilePath(imageSource);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return false;
    };
    const bindNoteImageViewer = root => {
        if (!root || root.dataset.noteImageViewerBound === "1") return;
        root.dataset.noteImageViewerBound = "1";
        root.addEventListener("click", event => {
            const image = event.target?.closest?.("img");
            if (!image) return;
            event.preventDefault();
            event.stopPropagation();
            openNoteImage(image.getAttribute("src") || "");
        });
    };
    let working_files = [];
    let current_documents_directory = modular.working_directory;
    let documents_history = [current_documents_directory];
    let current_documents_history_index = 0;
    let current_rubbish_directory = "Rubbish";
    let active_upload_directory = current_documents_directory;
    const normalizeUploadDirectory = (directoryPath = "") => {
        const normalizedPath = String(directoryPath).trim().replace(/\\/g, "/").replace(/\/+$/, "");
        if (!normalizedPath) return modular.working_directory || "Documents";
        if (normalizedPath.startsWith("/home/standard-system/")) return normalizedPath.replace(/^\/home\/standard-system\//, "") || "Documents";
        return normalizedPath.replace(/^\/+/, "") || "Documents";
    };
    const AUTO_UPLOAD_FOLDERS_BY_EXTENSION = {
        Music: new Set(["aac", "aif", "aiff", "alac", "flac", "m4a", "mid", "midi", "mp3", "oga", "ogg", "opus", "wav", "weba", "wma"]),
        Photos: new Set(["avif", "bmp", "gif", "heic", "heif", "ico", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"]),
        Videos: new Set(["3gp", "avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "webm", "wmv"])
    };
    const AUTO_UPLOAD_FOLDERS_BY_MIME_PREFIX = {
        "audio/": "Music",
        "image/": "Photos",
        "video/": "Videos"
    };
    const getUploadFileExtension = (file = {}) => {
        const fileName = String(file?.name || "");
        return fileName.includes(".") ? fileName.split(".").pop().toLowerCase() : "";
    };
    const inferUploadFolderForFile = (file = {}) => {
        const mimeType = String(file?.type || "").toLowerCase();
        for (const [prefix, folder] of Object.entries(AUTO_UPLOAD_FOLDERS_BY_MIME_PREFIX)) {
            if (mimeType.startsWith(prefix)) return folder;
        }
        const extension = getUploadFileExtension(file);
        return Object.entries(AUTO_UPLOAD_FOLDERS_BY_EXTENSION).find(([, extensions]) => extensions.has(extension))?.[0] || "";
    };
    const getUploadDirectoryForFile = (file = {}, fallbackDirectory = "") => inferUploadFolderForFile(file) || normalizeUploadDirectory(fallbackDirectory);
    const syncUploadDirectory = () => window.StandardFilesUploadDirectory = normalizeUploadDirectory(active_upload_directory);
    const setActiveUploadDirectory = directoryPath => {
        active_upload_directory = directoryPath;
        syncUploadDirectory();
    };
    const isDirectory = (file = {}) => {
        if (Array.isArray(file.children)) return true;
        const type = String(file?.type || file?.kind || file?.entryType || "").trim().toLowerCase();
        return type === "directory" || type === "folder" || type === "dir";
    };
    const FILE_SHORTCUT_DRAG_TYPE = "application/x-standard-file-shortcut";
    const initializeFileShortcutDrag = () => {
        if (window.__stdFilesShortcutDragInitialized) return;
        window.__stdFilesShortcutDragInitialized = true;
        document.addEventListener("dragstart", event => {
            const tile = event.target?.closest?.(".files-file-item[draggable=\"true\"]");
            if (!tile || !event.dataTransfer) return;
            const path = String(tile.getAttribute("directive") || "").trim();
            if (!path) return event.preventDefault();
            const name = String(tile.querySelector(".files-file-name")?.textContent || path.split(/[\\/]/).pop() || "File").trim();
            event.dataTransfer.effectAllowed = "copy";
            event.dataTransfer.setData(FILE_SHORTCUT_DRAG_TYPE, JSON.stringify({path, name}));
            event.dataTransfer.setData("text/plain", path);
        });
        document.addEventListener("dragend", () => document.body.classList.remove("drag-active"));
    };
    initializeFileShortcutDrag();
    let fileSortMode = "name-asc";
    const FILE_DISPLAY_STYLES = [{
        id: "rows",
        label: "Row list",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"/></svg>`
    }, {
        id: "tiles",
        label: "Tiles",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"/></svg>`
    }, {
        id: "details",
        label: "Details list",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"/></svg>`
    }];
    let fileDisplayStyleIndex = 0;
    let fileDisplaySettingsPromise = null;
    let photoDisplaySettingsPromise = null;
    const getFileDisplayStyle = () => FILE_DISPLAY_STYLES[fileDisplayStyleIndex];
    const getFileDisplayRootClass = () => `files-display files-display-${getFileDisplayStyle().id}`;
    const setFileDisplayStyle = (styleId = "rows") => {
        const nextIndex = FILE_DISPLAY_STYLES.findIndex(displayStyle => displayStyle.id === styleId);
        fileDisplayStyleIndex = nextIndex >= 0 ? nextIndex : 0;
        document.querySelectorAll("#all-files, #documents, #rubbish").forEach(root => {
            root.className = getFileDisplayRootClass();
        });
        syncFileDisplayButtons();
        return getFileDisplayStyle();
    };
    const loadFileDisplayStyleSetting = ({force = false} = {}) => {
        if (!fileDisplaySettingsPromise || force) {
            fileDisplaySettingsPromise = Promise.resolve(window.StandardAppSettings?.values?.(FILES_SERVICE_ID, {force}) || {})
                .then(values => setFileDisplayStyle(values?.display_style || FILES_SETTINGS.display_style.default))
                .catch(error => {
                    console.error("Failed to load Files display style", error);
                    return setFileDisplayStyle(FILES_SETTINGS.display_style.default);
                });
        }
        return fileDisplaySettingsPromise;
    };
    const saveFileDisplayStyleSetting = async styleId => {
        const currentSettings = await window.StandardAppSettings?.values?.(FILES_SERVICE_ID) || {};
        const saved = await window.StandardAppSettings?.save?.(FILES_SERVICE_ID, {...currentSettings, display_style: styleId});
        if (!saved) modular.error("Unable to save Files display style");
        return saved;
    };
    const setPhotoDisplayStyle = (styleId = FILES_SETTINGS.photo_display_style.default) => {
        photoDisplayStyle = FILES_SETTINGS.photo_display_style.restrictions.includes(styleId)
            ? styleId
            : FILES_SETTINGS.photo_display_style.default;
        return photoDisplayStyle;
    };
    const loadPhotoDisplayStyleSetting = ({force = false} = {}) => {
        if (!photoDisplaySettingsPromise || force) {
            photoDisplaySettingsPromise = Promise.resolve(window.StandardAppSettings?.values?.(FILES_SERVICE_ID, {force}) || {})
                .then(values => setPhotoDisplayStyle(values?.photo_display_style || FILES_SETTINGS.photo_display_style.default))
                .catch(error => {
                    console.error("Failed to load Photos display style", error);
                    return setPhotoDisplayStyle(FILES_SETTINGS.photo_display_style.default);
                });
        }
        return photoDisplaySettingsPromise;
    };
    const savePhotoDisplayStyleSetting = async styleId => {
        const currentSettings = await window.StandardAppSettings?.values?.(FILES_SERVICE_ID) || {};
        const saved = await window.StandardAppSettings?.save?.(FILES_SERVICE_ID, {...currentSettings, photo_display_style: styleId});
        if (!saved) modular.error("Unable to save Photos display style");
        return saved;
    };
    const applyPhotoDisplayStyle = () => {
        const photosRoot = document.getElementById("photos");
        const displayStyleButton = document.getElementById("photos-display-style");
        const isGrid = photoDisplayStyle === "grid";
        if (photosRoot) {
            photosRoot.style.display = isGrid ? "grid" : "block";
            photosRoot.style.gridTemplateColumns = isGrid ? "repeat(auto-fill, minmax(150px, 1fr))" : "";
            photosRoot.style.gap = isGrid ? "0.75rem" : "";
            photosRoot.style.columnCount = isGrid ? "auto" : "3";
            photosRoot.style.columnGap = "0.75rem";
        }
        const photoTiles = photosRoot?.querySelectorAll?.(".file-folder") || [];
        photoTiles.forEach(tile => {
            tile.style.display = isGrid ? "block" : "inline-block";
            tile.style.width = "100%";
            tile.style.marginBottom = isGrid ? "0" : "0.75rem";
            tile.style.breakInside = isGrid ? "auto" : "avoid";
            tile.style.aspectRatio = isGrid ? "1 / 1" : "auto";
            tile.style.overflow = "hidden";
            tile.style.borderRadius = "var(--radius)";
            if (tile.firstElementChild) tile.firstElementChild.style.height = isGrid ? "100%" : "auto";
        });
        const photoImages = photosRoot?.querySelectorAll?.(".file-folder img") || [];
        photoImages.forEach(image => {
            image.style.height = isGrid ? "100%" : "auto";
            image.style.objectFit = isGrid ? "cover" : "contain";
            image.style.display = "block";
        });
        if (displayStyleButton) {
            const currentLabel = isGrid ? "Grid" : "Cascade";
            const nextLabel = isGrid ? "cascade" : "grid";
            displayStyleButton.innerHTML = isGrid ? PHOTO_GRID_ICON : PHOTO_CASCADE_ICON;
            displayStyleButton.title = `Photo display: ${currentLabel}. Switch to ${nextLabel}`;
            displayStyleButton.setAttribute("aria-label", displayStyleButton.title);
            displayStyleButton.setAttribute("aria-pressed", String(isGrid));
        }
    };
    const getFileName = (file = {}) => String(file.name || file.path?.split?.("/")?.pop?.() || "").toLowerCase();
    const getFileType = (file = {}) => {
        if (isDirectory(file)) return "folder";
        const name = getFileName(file);
        return name.includes(".") ? name.split(".").pop() : "";
    };
    const compareFileNames = (left, right, direction = "asc") => {
        const comparison = getFileName(left).localeCompare(getFileName(right), undefined, {numeric: true, sensitivity: "base"});
        return direction === "desc" ? -comparison : comparison;
    };
    const compareFiles = (left, right) => {
        const leftDirectory = isDirectory(left);
        const rightDirectory = isDirectory(right);
        if (leftDirectory !== rightDirectory) return leftDirectory ? -1 : 1;
        if (fileSortMode === "type") {
            const typeComparison = getFileType(left).localeCompare(getFileType(right), undefined, {numeric: true, sensitivity: "base"});
            if (typeComparison !== 0) return typeComparison;
            return compareFileNames(left, right, "asc");
        }
        return compareFileNames(left, right, fileSortMode === "name-asc" ? "asc" : "desc");
    };
    const getSortedWorkingFiles = () => [...working_files].sort(compareFiles);
    const getFilesSearchRoot = (portal = null) => portal?.body?.() || document.querySelector(".draggable-window .window-body") || document;
    const getFileTileSearchLabel = (tile = null) => {
        const directive = String(tile?.getAttribute?.("directive") || "");
        const textLabel = String(tile?.innerText || "").replace(/\s+/g, " ").trim();
        const fileName = directive.split("/").filter(Boolean).pop() || textLabel || "File";
        return fileName;
    };
    const getFileTileSearchDetail = (tile = null) => {
        const directive = String(tile?.getAttribute?.("directive") || "");
        const normalizedDirective = directive.replace(/^\/home\/standard-system\//, "");
        const textLabel = String(tile?.innerText || "").replace(/\s+/g, " ").trim();
        if (normalizedDirective && textLabel && !textLabel.includes(normalizedDirective)) return `${textLabel} - ${normalizedDirective}`;
        return normalizedDirective || textLabel;
    };
    const createFilesSearchMatches = (query = "", portal = null) => {
        const needle = String(query || "").trim().toLowerCase();
        if (!needle) return [];
        const root = getFilesSearchRoot(portal);
        return Array.from(root.querySelectorAll(".file-folder")).map((tile, index) => ({tile, index, label: getFileTileSearchLabel(tile), detail: getFileTileSearchDetail(tile)})).filter(match => `${match.label} ${match.detail}`.toLowerCase().includes(needle)).slice(0, 50);
    };
    const previewFilesSearchMatch = (match = null) => {
        const tile = match?.tile;
        if (!(tile instanceof HTMLElement)) return false;
        tile.classList.remove("files-search-hit");
        tile.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});
        requestAnimationFrame(() => tile.classList.add("files-search-hit"));
        window.setTimeout(() => tile.classList.remove("files-search-hit"), 800);
        return true;
    };
    const showFilesSearchDialogue = (portal = null, anchorNode = null) => {
        const root = getFilesSearchRoot(portal);
        if (!root?.querySelector?.(".file-folder")) {
            modular.error("No file tiles to search");
            return false;
        }
        return window.StandardUI.openSearchDialogue({
            title: "Search",
            placeholder: "Find files",
            confirmText: "Search",
            anchor: anchorNode,
            noResultsText: "No files match.",
            matches: query => createFilesSearchMatches(query, portal),
            onPreview: previewFilesSearchMatch,
            onSelect: previewFilesSearchMatch,
            onNoMatch: () => modular.error("No matches found")
        });
    };
    const refreshFileListRoot = (rootId, options = {}) => {
        const root = document.getElementById(rootId);
        if (root) {
            root.className = getFileDisplayRootClass();
            root.innerHTML = renderFiles(options);
        }
    };
    const createFileSortMenuItems = (rootId, options = {}) => [
        {mode: "name-asc", label: "Name A-Z"},
        {mode: "name-desc", label: "Name Z-A"},
        {mode: "type", label: "Type"}
    ].map(sortOption => ({
        label: sortOption.label,
        action: () => {
            fileSortMode = sortOption.mode;
            refreshFileListRoot(rootId, options);
        }
    }));
    const fileSortButton = id => button({id, style: "small naked float-right hover-zoom", altsync: "F", icon: modular.icons.sort, title: "Sort"});
    const fileDisplayButton = id => button({id, style: "small naked float-right hover-zoom files-display-button", icon: getFileDisplayStyle().icon, title: `Display style: ${getFileDisplayStyle().label}`});
    const syncFileDisplayButtons = () => {
        const displayStyle = getFileDisplayStyle();
        document.querySelectorAll(".files-display-button").forEach(displayButton => {
            displayButton.innerHTML = displayStyle.icon;
            displayButton.title = `Display style: ${displayStyle.label}`;
            displayButton.setAttribute("aria-label", `Display style: ${displayStyle.label}. Click to cycle views.`);
        });
    };
    const bindFileDisplayButton = (id, rootId, options = {}) => {
        const displayButton = document.getElementById(id);
        if (!displayButton || displayButton.dataset.displayStyleBound === "1") return;
        displayButton.dataset.displayStyleBound = "1";
        displayButton.onclick = async () => {
            await loadFileDisplayStyleSetting();
            const nextIndex = (fileDisplayStyleIndex + 1) % FILE_DISPLAY_STYLES.length;
            const nextStyle = setFileDisplayStyle(FILE_DISPLAY_STYLES[nextIndex].id);
            await saveFileDisplayStyleSetting(nextStyle.id);
        };
        syncFileDisplayButtons();
        loadFileDisplayStyleSetting();
    };
    const bindFileSortButton = (id, rootId, options = {}) => {
        const sortButton = document.getElementById(id);
        if (sortButton?.dataset.sortMenuBound === "1") return;
        if (sortButton) {
            sortButton.dataset.sortMenuBound = "1";
            sortButton.popoutmenu(createFileSortMenuItems(rootId, options));
        }
    };
    const getFileTypeIconPath = (fileLike = {}) => {
        const rawPath = typeof fileLike === "string" ? fileLike : (fileLike?.path || fileLike?.name || "");
        if (/\.chrts$/i.test(rawPath)) return "/icons/interfaces/whiteboard.png";
        let icon = "folder";
        if (rawPath && rawPath.split("/").pop().includes(".")) icon = rawPath.split(".").pop().toLowerCase();
        return `/icons/${icon}.png`;
    };
    const triggerFileDownload = (rawPath = "") => {
        const path = String(rawPath).replace(/^\/home\/standard-system\//, "").replace(/^\/+/, "");
        if (!path) return;
        const url = `/api/files/download?path=${encodeURIComponent(path)}`;
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = path.split("/").pop() || "download";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    };
    const saveDownloadedBlob = (blob, fileName = "download") => {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    };
    const waitForServiceMethod = async (lookup, serviceId = "") => {
        if (typeof lookup !== "function") return null;
        let resolved = lookup();
        if (typeof resolved === "function") return resolved;
        if (serviceId && typeof modular?.start === "function") modular.start(serviceId);
        for (let attempt = 0; attempt < 20; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 50));
            resolved = lookup();
            if (typeof resolved === "function") return resolved;
        }
        return null;
    };
    const downloadFileForOpen = (rawPath = "") => window.StandardDownloads.downloadForOpen(rawPath, {
        emptyPathMessage: "File path is required"
    });
    const openNoteInNotesApp = (note = {}) => {
        if (window.StandardNotes?.openNote) window.StandardNotes.openNote(note);
    };
    const openNoteEditorInNotesApp = (note = {}) => {
        if (window.StandardNotes?.openNoteEditor) window.StandardNotes.openNoteEditor(note);
    };
    const removeDeletedNoteTile = (noteId, tile = null) => {
        const deletedTile = tile?.closest?.(".note-tile");
        if (deletedTile) {
            deletedTile.remove();
            return;
        }
        document.querySelectorAll("#notes .note-tile").forEach(noteTile => {
            if (noteTile.getAttribute("directive") === String(noteId)) noteTile.remove();
        });
    };
    const deleteNoteFromNotesSection = (noteId, note = {}, tile = null) => {
        if (!noteId) return;
        const noteLabel = String(note?.created || "note").trim() || "note";
        confirmationDialogue({
            title: "Delete note",
            destructive: true,
            content: `Are you sure you want to delete ${noteLabel}?`,
            confirmation: () => {
                CLI.send(`[notes] - <id ${noteId}>`).then(response => {
                    if (response === 1) {
                        removeDeletedNoteTile(noteId, tile);
                        modular.success(`Deleted ${noteLabel}`);
                    } else {
                        modular.error(`Failed to delete ${noteLabel}`);
                    }
                }).catch(() => {
                    modular.error(`Failed to delete ${noteLabel}`);
                });
            }
        });
    };
    const getNoteFromTile = root => {
        const noteTile = root?.closest?.(".note-tile");
        if (!noteTile) return null;
        const displayedTitle = noteTile.querySelector(".note-tile-title")?.innerText || "";
        return {id: noteTile.getAttribute("directive"), title: displayedTitle, created: noteTile.querySelector("em")?.innerText || displayedTitle || "View Note", content: noteTile.querySelector(".note-tile-content")?.innerHTML || "", color: noteTile.style.background || window.getComputedStyle(noteTile).getPropertyValue("background-color")};
    };
    const renderNoNotesState = () => emptyState({style: "notes-empty-state", icon: "/icons/interfaces/notes.png", iconStyle: "notes-empty-icon", label: "No notes", labelStyle: "notes-empty-label"});
    const isWhiteboardFilePath = (rawPath = "") => /\.wtb$/i.test(String(rawPath || ""));
    const isChartFilePath = (rawPath = "") => /\.chrts$/i.test(String(rawPath || ""));
    const isSlidesFilePath = (rawPath = "") => /\.slds$/i.test(String(rawPath || ""));
    const isSpreadsheetFilePath = (rawPath = "") => /\.(?:sprdshts|xlsx)$/i.test(String(rawPath || ""));
    const isXlsxFilePath = (rawPath = "") => /\.xlsx$/i.test(String(rawPath || ""));
    const isCodeFilePath = (rawPath = "") => /\.(std|stds|sui)$/i.test(String(rawPath || ""));
    const isTextFilePath = (rawPath = "") => /\.txt$/i.test(String(rawPath || ""));
    const isImageFilePath = (rawPath = "") => /\.(png|ico|gif|jpeg|jpg|svg|tiff|bm|avif|webp)$/i.test(String(rawPath || ""));
    const isSvgFilePath = (rawPath = "") => /\.svg$/i.test(String(rawPath || ""));
    const isVideoFilePath = (rawPath = "") => /\.(mp4|webm|mov|m4v|avi|mkv|mpeg|mpg|ogv)$/i.test(String(rawPath || ""));
    const isPdfFilePath = (rawPath = "") => /\.pdf$/i.test(String(rawPath || ""));
    const getDefaultUploadDirectory = () => normalizeUploadDirectory(window.StandardFilesUploadDirectory || active_upload_directory || modular.working_directory || "Documents");
    const refreshFilesRecordCache = () => {
        if (typeof window.StandardFilesRefreshCache === "function") return window.StandardFilesRefreshCache();
        const refreshFiles = window.StandardRecordSearch?.refreshFiles;
        if (typeof refreshFiles !== "function") return Promise.resolve(null);
        return refreshFiles.call(window.StandardRecordSearch).catch(error => {
            console.error("Failed to refresh files cache:", error);
            return null;
        });
    };
    const refreshFilesAfterMutation = () => {
        modular.refresh(FILES_SERVICE_ID);
        return refreshFilesRecordCache();
    };
    const uploadSelectedFiles = async (fileList, options = {}) => {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        const targetDirectory = normalizeUploadDirectory(options?.directory || getDefaultUploadDirectory());
        setActiveUploadDirectory(targetDirectory);
        const multiProgress = options?.multiFileProgress && files.length > 1 && typeof window.StandardUploads?.createMultiFileProgress === "function" ? window.StandardUploads.createMultiFileProgress(files) : null;
        try {
            for (let index = 0; index < files.length; index++) {
                const file = files[index];
                const uploadDirectory = getUploadDirectoryForFile(file, targetDirectory);
                const uploadUrl = `/api/upload?directory=${encodeURIComponent(uploadDirectory)}`;
                if (typeof window.StandardUploads?.uploadFile === "function") {
                    const response = await window.StandardUploads.uploadFile(file, uploadUrl, {label: `Uploading ${file.name || "file"}`, suppressProgress: !!multiProgress, onProgress: multiProgress ? progress => multiProgress.update({currentIndex: index, file, loaded: progress?.loaded || 0, total: progress?.total || file.size || 0, indeterminate: !!progress?.indeterminate}) : null});
                    if (!response?.ok) throw new Error(`Upload failed (${response?.status || 0})`);
                } else {
                    if (multiProgress) multiProgress.update({currentIndex: index, file, loaded: 0, total: file.size || 0, indeterminate: true});
                    const formData = new FormData();
                    formData.append("file", file);
                    const response = await fetch(uploadUrl, {method: "POST", body: formData});
                    if (!response.ok) throw new Error(`Upload failed (${response.status})`);
                    if (multiProgress) multiProgress.update({currentIndex: index, file, loaded: file.size || 1, total: file.size || 1});
                }
            }
        } catch (error) {
            console.error("File upload failed:", error);
            modular.error(error?.message || "Upload failed");
            throw error;
        } finally {
            if (multiProgress) multiProgress.hide();
        }
        await refreshFilesAfterMutation();
        if (!options?.suppressSuccess) modular.success(files.length === 1 ? `Uploaded ${files[0]?.name || "file"}` : `Uploaded ${files.length} files`);
    };
    window.StandardFilesUploadSelectedFiles = uploadSelectedFiles;
    window.StandardFiles = window.StandardFiles || {};
    window.StandardFiles.inferUploadDirectory = (file = {}, fallbackDirectory = "") => getUploadDirectoryForFile(file, fallbackDirectory);
    const openWhiteboardInBoardsApp = async (rawPath = "", sourceNode = null) => {
        if (!isWhiteboardFilePath(rawPath)) return false;
        const openBoardData = await waitForServiceMethod(() => window.StandardBoards?.openBoardData, "com.standard.boards");
        if (!openBoardData) return false;
        const download = await downloadFileForOpen(rawPath);
        return openBoardData(download.path, JSON.parse(await download.blob.text()), sourceNode);
    };
    const openChartInChartsApp = async (rawPath = "", sourceNode = null) => {
        if (!isChartFilePath(rawPath)) return false;
        const openChartData = await waitForServiceMethod(() => window.StandardCharts?.openChartData, "com.standard.charts");
        if (!openChartData) return false;
        const download = await downloadFileForOpen(rawPath);
        return openChartData(download.path, JSON.parse(await download.blob.text()), sourceNode);
    };
    const openFileInInternalsApp = async (rawPath = "", sourceNode = null) => {
        const [openTextContent, openImageSource, openVideoSource] = await Promise.all([
            waitForServiceMethod(() => window.StandardInternals?.openTextContent, "com.standard.internals"),
            waitForServiceMethod(() => window.StandardInternals?.openImageSource, "com.standard.internals"),
            waitForServiceMethod(() => window.StandardInternals?.openVideoSource, "com.standard.internals")
        ]);
        const download = await downloadFileForOpen(rawPath);
        if (isImageFilePath(download.path)) {
            if (!openImageSource) return false;
            if (isSvgFilePath(download.path)) {
                return openImageSource(await download.blob.text(), {path: download.path, title: download.fileName, isObjectUrl: false, revokePrevious: true, sourceNode});
            }
            return openImageSource(URL.createObjectURL(download.blob), {path: download.path, title: download.fileName, isObjectUrl: true, revokePrevious: true, sourceNode});
        }
        if (isVideoFilePath(download.path)) {
            if (!openVideoSource) return false;
            return openVideoSource(download.path, URL.createObjectURL(download.blob), {title: download.fileName, isObjectUrl: true, revokePrevious: true, sourceNode});
        }
        if (!openTextContent) return false;
        return openTextContent(download.path, await download.blob.text(), {readOnly: false, sourceNode});
    };
    const openSlidesInSlidesApp = async (rawPath = "", sourceNode = null) => {
        const openSlidePayload = await waitForServiceMethod(() => window.StandardSlides?.openSlidePayload, "com.standard.editor.slides");
        if (!openSlidePayload) return false;
        const download = await downloadFileForOpen(rawPath);
        return openSlidePayload(download.path, JSON.parse(await download.blob.text()), sourceNode);
    };
    const openSheetInSheetsApp = async (rawPath = "", sourceNode = null) => {
        const download = await downloadFileForOpen(rawPath);
        if (isXlsxFilePath(download.path)) {
            const openXlsxBuffer = await waitForServiceMethod(() => window.StandardSheets?.openXlsxBuffer, "com.standard.editor.sheet");
            return openXlsxBuffer ? openXlsxBuffer(download.path, await download.blob.arrayBuffer(), sourceNode) : false;
        }
        const openSheetPayload = await waitForServiceMethod(() => window.StandardSheets?.openSheetPayload, "com.standard.editor.sheet");
        if (!openSheetPayload) return false;
        return openSheetPayload(download.path, JSON.parse(await download.blob.text()), sourceNode);
    };
    const openCodeFileInCodeEditor = async (rawPath = "", sourceNode = null) => {
        const openCodeFilePath = await waitForServiceMethod(() => window.StandardCodeEditor?.openCodeFilePath, "com.standard.editor.code");
        if (!openCodeFilePath) return false;
        const download = await downloadFileForOpen(rawPath);
        return openCodeFilePath(download.path, await download.blob.text(), sourceNode);
    };
    const runSuiFilePath = async (rawPath = "") => {
        if (!/\.sui$/i.test(String(rawPath || ""))) return false;
        const runSuiSource = await waitForServiceMethod(() => window.StandardCodeEditor?.runSuiSource, "com.standard.editor.code");
        if (!runSuiSource) {
            modular.error("The Code Editor service is not ready");
            return false;
        }
        try {
            const download = await downloadFileForOpen(rawPath);
            return runSuiSource(await download.blob.text(), download.path);
        } catch (error) {
            modular.error(error?.message || `Unable to run ${String(rawPath).split("/").pop() || "SUI file"}`);
            return false;
        }
    };
    const openPdfInInternalsApp = async (rawPath = "", sourceNode = null) => {
        const openPdfFilePath = await waitForServiceMethod(() => window.StandardInternals?.openPdfFilePath, "com.standard.internals");
        if (!openPdfFilePath) return false;
        return openPdfFilePath(rawPath, sourceNode);
    };
    const openFilePath = async (rawPath = "", sourceNode = null) => {
        if (isWhiteboardFilePath(rawPath)) return openWhiteboardInBoardsApp(rawPath, sourceNode);
        if (isChartFilePath(rawPath)) return openChartInChartsApp(rawPath, sourceNode);
        if (isSlidesFilePath(rawPath)) return openSlidesInSlidesApp(rawPath, sourceNode);
        if (isSpreadsheetFilePath(rawPath)) return openSheetInSheetsApp(rawPath, sourceNode);
        if (isCodeFilePath(rawPath)) return openCodeFileInCodeEditor(rawPath, sourceNode);
        if (isTextFilePath(rawPath)) return openFileInInternalsApp(rawPath, sourceNode);
        if (isImageFilePath(rawPath)) return openFileInInternalsApp(rawPath, sourceNode);
        if (isVideoFilePath(rawPath)) return openFileInInternalsApp(rawPath, sourceNode);
        if (isPdfFilePath(rawPath)) return openPdfInInternalsApp(rawPath, sourceNode);
        return openFileInInternalsApp(rawPath, sourceNode);
    };
    const openFileBlob = async (name = "", blob = null, sourceNode = null) => {
        if (!(blob instanceof Blob)) return false;
        const fileName = String(name || "attachment").trim() || "attachment";
        if (isWhiteboardFilePath(fileName)) {
            const openBoardData = await waitForServiceMethod(() => window.StandardBoards?.openBoardData, "com.standard.boards");
            return openBoardData ? openBoardData(fileName, JSON.parse(await blob.text()), sourceNode) : false;
        }
        if (isChartFilePath(fileName)) {
            const openChartData = await waitForServiceMethod(() => window.StandardCharts?.openChartData, "com.standard.charts");
            return openChartData ? openChartData(fileName, JSON.parse(await blob.text()), sourceNode) : false;
        }
        if (isSlidesFilePath(fileName)) {
            const openSlidePayload = await waitForServiceMethod(() => window.StandardSlides?.openSlidePayload, "com.standard.editor.slides");
            return openSlidePayload ? openSlidePayload(fileName, JSON.parse(await blob.text()), sourceNode) : false;
        }
        if (isSpreadsheetFilePath(fileName)) {
            if (isXlsxFilePath(fileName)) {
                const openXlsxBuffer = await waitForServiceMethod(() => window.StandardSheets?.openXlsxBuffer, "com.standard.editor.sheet");
                return openXlsxBuffer ? openXlsxBuffer(fileName, await blob.arrayBuffer(), sourceNode) : false;
            }
            const openSheetPayload = await waitForServiceMethod(() => window.StandardSheets?.openSheetPayload, "com.standard.editor.sheet");
            return openSheetPayload ? openSheetPayload(fileName, JSON.parse(await blob.text()), sourceNode) : false;
        }
        if (isCodeFilePath(fileName)) {
            const openCodeFilePath = await waitForServiceMethod(() => window.StandardCodeEditor?.openCodeFilePath, "com.standard.editor.code");
            return openCodeFilePath ? openCodeFilePath(fileName, await blob.text(), sourceNode) : false;
        }
        if (isImageFilePath(fileName)) {
            const openImageSource = await waitForServiceMethod(() => window.StandardInternals?.openImageSource, "com.standard.internals");
            if (!openImageSource) return false;
            if (isSvgFilePath(fileName)) return openImageSource(await blob.text(), {path: fileName, title: fileName, sourceNode});
            return openImageSource(URL.createObjectURL(blob), {path: fileName, title: fileName, isObjectUrl: true, revokePrevious: true, sourceNode});
        }
        if (isVideoFilePath(fileName)) {
            const openVideoSource = await waitForServiceMethod(() => window.StandardInternals?.openVideoSource, "com.standard.internals");
            return openVideoSource ? openVideoSource(fileName, URL.createObjectURL(blob), {title: fileName, isObjectUrl: true, revokePrevious: true, sourceNode}) : false;
        }
        if (isPdfFilePath(fileName)) {
            const openPdfSource = await waitForServiceMethod(() => window.StandardInternals?.openPdfSource, "com.standard.internals");
            return openPdfSource ? openPdfSource(fileName, URL.createObjectURL(blob), {isObjectUrl: true, sourceNode}) : false;
        }
        const openTextContent = await waitForServiceMethod(() => window.StandardInternals?.openTextContent, "com.standard.internals");
        return openTextContent ? openTextContent(fileName, await blob.text(), {readOnly: false, sourceNode}) : false;
    };
    window.StandardFiles = window.StandardFiles || {};
    window.StandardFiles.openFilePath = (rawPath = "", sourceNode = null) => openFilePath(rawPath, sourceNode);
    window.StandardFiles.openFileBlob = (name = "", blob = null, sourceNode = null) => openFileBlob(name, blob, sourceNode);
    window.StandardFiles.runSuiFilePath = (rawPath = "") => runSuiFilePath(rawPath);
    window.StandardFiles.getFileTypeIconPath = (fileLike = {}) => getFileTypeIconPath(fileLike);
    const getFilePathForRemoveCommand = (rawPath = "") => {
        return String(rawPath || "").replace(/^\/home\/standard-system\//, "");
    };
    const removeDeletedFileTile = (rawPath = "", tile = null) => {
        const normalizedPath = getFilePathForRemoveCommand(rawPath);
        working_files = working_files.filter(file => getFilePathForRemoveCommand(file?.path) !== normalizedPath);
        const deletedTile = tile?.closest?.(".file-folder");
        if (deletedTile) {
            deletedTile.remove();
            return;
        }
        document.querySelectorAll(".file-folder").forEach(fileTile => {
            if (getFilePathForRemoveCommand(fileTile.getAttribute("directive")) === normalizedPath) fileTile.remove();
        });
    };
    const isRubbishPath = rawPath => {
        const normalizedPath = getFilePathForRemoveCommand(rawPath).replace(/^\/+|\/+$/g, "");
        return normalizedPath === "Rubbish" || normalizedPath.startsWith("Rubbish/");
    };
    const beginDeleteFileProgress = (fileName, permanent) => window.StandardDownloads?.beginOpenProgress?.(`${permanent ? "Deleting" : "Moving"} ${fileName}`) || 0;
    const finishDeleteFileProgress = (token, fileName, permanent) => {
        const label = permanent ? `Deleted ${fileName}` : `Moved ${fileName} to Rubbish`;
        window.StandardDownloads?.updateOpenProgress?.({label, loaded: 1, total: 1, indeterminate: false, token});
        window.setTimeout(() => window.StandardDownloads?.hideOpenProgress?.(token), 220);
    };
    const hideDeleteFileProgress = token => window.StandardDownloads?.hideOpenProgress?.(token);
    const getSelectedFileTiles = root => {
        if (!(root instanceof Element)) return [];
        return Array.from(root.querySelectorAll(".file-folder.files-file-selected"));
    };
    const downloadSelectedFiles = async tiles => {
        let downloaded = 0;
        for (const tile of tiles) {
            const filePath = getFilePathForRemoveCommand(tile?.getAttribute?.("directive"));
            if (!filePath) continue;
            const fileName = filePath.split("/").pop() || "download";
            try {
                const download = await window.StandardDownloads.downloadForOpen(filePath, {
                    label: `Downloading ${fileName}`,
                    errorMessage: `Failed to download ${fileName}`
                });
                saveDownloadedBlob(download.blob, download.fileName || fileName);
                downloaded += 1;
            } catch (_) {
                modular.error(`Failed to download ${fileName}`);
            }
        }
        if (downloaded) modular.success(downloaded === 1 ? "Downloaded 1 file" : `Downloaded ${downloaded} files`);
    };
    const deleteSelectedFiles = tiles => {
        const entries = tiles.map(tile => {
            const path = getFilePathForRemoveCommand(tile?.getAttribute?.("directive"));
            return {tile, path, name: path.split("/").pop() || "file", permanent: isRubbishPath(path)};
        }).filter(entry => entry.path);
        if (!entries.length) return;
        const allPermanent = entries.every(entry => entry.permanent);
        const description = allPermanent
            ? `Permanently delete ${entries.length} selected items? This cannot be undone.`
            : `Move ${entries.length} selected items to Rubbish? Items already in Rubbish will be permanently deleted.`;
        confirmationDialogue({
            title: allPermanent ? "Permanently delete selected items" : "Delete selected items",
            destructive: true,
            content: description,
            confirmation: async () => {
                let deleted = 0;
                for (const entry of entries) {
                    const progressToken = beginDeleteFileProgress(entry.name, entry.permanent);
                    try {
                        const command = entry.permanent
                            ? CLI.buildFilesCommand("remove", entry.path)
                            : CLI.buildFilesCommand("move", entry.path, getMoveTargetPath(entry.path, "Rubbish"));
                        const response = await CLI.send(command);
                        if (!isSuccessfulCliResponse(response)) throw new Error("File operation failed");
                        removeDeletedFileTile(entry.path, entry.tile);
                        finishDeleteFileProgress(progressToken, entry.name, entry.permanent);
                        deleted += 1;
                    } catch (_) {
                        hideDeleteFileProgress(progressToken);
                        modular.error(entry.permanent ? `Failed to delete ${entry.name}` : `Failed to move ${entry.name} to Rubbish`);
                    }
                }
                if (deleted) {
                    await refreshFilesRecordCache();
                    modular.success(deleted === 1 ? "Deleted 1 item" : `Deleted ${deleted} items`);
                }
            }
        });
    };
    const deleteFile = (rawPath, tile = null) => {
        const filePath = getFilePathForRemoveCommand(rawPath);
        if (!filePath) return;
        const fileName = filePath.split("/").pop() || "file";
        const permanent = isRubbishPath(filePath);
        confirmationDialogue({
            title: permanent ? "Permanently delete file" : "Move file to Rubbish",
            destructive: true,
            content: permanent
                ? `Are you sure you want to permanently delete ${escapeHtml(fileName)}? This cannot be undone.`
                : `Move ${escapeHtml(fileName)} to Rubbish?`,
            confirmation: async () => {
                const progressToken = beginDeleteFileProgress(fileName, permanent);
                try {
                    const command = permanent
                        ? CLI.buildFilesCommand("remove", filePath)
                        : CLI.buildFilesCommand("move", filePath, getMoveTargetPath(filePath, "Rubbish"));
                    const response = await CLI.send(command);
                    if (response === 0 || response === "false" || response === false) {
                        hideDeleteFileProgress(progressToken);
                        modular.error(permanent ? `Failed to delete ${fileName}` : `Failed to move ${fileName} to Rubbish`);
                        return;
                    }
                    removeDeletedFileTile(rawPath, tile);
                    await refreshFilesRecordCache();
                    finishDeleteFileProgress(progressToken, fileName, permanent);
                    modular.success(permanent ? `Deleted ${fileName}` : `Moved ${fileName} to Rubbish`);
                } catch (_) {
                    hideDeleteFileProgress(progressToken);
                    modular.error(permanent ? `Failed to delete ${fileName}` : `Failed to move ${fileName} to Rubbish`);
                }
            }
        });
    };
    const renameFile = async rawPath => {
        const originalPath = String(rawPath || "");
        const normalizedSource = getFilePathForRemoveCommand(originalPath);
        if (!normalizedSource) return;
        const currentName = normalizedSource.split("/").pop() || "";
        inputDialogue({title: "Rename file", placeholder: "File name", value: currentName, confirmation: async (_, renamed) => {
                const trimmedName = String(renamed || "").trim();
                if (!trimmedName || trimmedName === currentName) return;
                const targetPath = normalizedSource.includes("/") ? `${normalizedSource.substring(0, normalizedSource.lastIndexOf("/"))}/${trimmedName}` : trimmedName;
                await CLI.send(CLI.buildFilesCommand("move", normalizedSource, targetPath));
                await refreshFilesAfterMutation();
            }
        });
    };
    const createFolderInDirectory = directoryPath => {
        const baseDirectory = getFilePathForRemoveCommand(directoryPath);
        inputDialogue({title: "New folder", placeholder: "Folder name", confirmation: async (_, folderName) => {
                const trimmedName = String(folderName || "").trim();
                if (!trimmedName) return;
                const targetPath = baseDirectory ? `${String(baseDirectory).replace(/\/+$/, "")}/${trimmedName}` : trimmedName;
                const progressToken = window.StandardDownloads?.beginOpenProgress?.(`Creating ${trimmedName}`) || 0;
                try {
                    await CLI.send(CLI.buildFilesCommand("folders", targetPath));
                    await refreshFilesAfterMutation();
                    window.StandardDownloads?.hideOpenProgress?.(progressToken);
                } catch (error) {
                    window.StandardDownloads?.hideOpenProgress?.(progressToken);
                    throw error;
                }
            }
        });
    };
    const createFolderInCurrentDocumentsDirectory = () => createFolderInDirectory(current_documents_directory);
    const createFolderInCurrentRubbishDirectory = () => createFolderInDirectory(current_rubbish_directory);
    let activeMoveDestinationMenu = null;
    const isSuccessfulCliResponse = response => response !== 0 && response !== "false" && response !== false;
    const isFolderPath = rawPath => {
        const normalizedPath = String(rawPath || "").replace(/\/+$/, "");
        const fileName = normalizedPath.split("/").filter(Boolean).pop() || "";
        return !!fileName && !fileName.includes(".");
    };
    const collectFolderPathsFromTree = (node, folders = new Set()) => {
        if (!node || typeof node !== "object") return folders;
        if (isFolderPath(node.path)) folders.add(getFilePathForRemoveCommand(node.path).replace(/\/+$/, ""));
        if (Array.isArray(node.children)) node.children.forEach(child => collectFolderPathsFromTree(child, folders));
        return folders;
    };
    const listMoveDestinationFolders = async () => {
        const tree = await CLI.send("tree");
        return Array.from(collectFolderPathsFromTree(tree)).filter(Boolean).sort((left, right) => left.localeCompare(right));
    };
    const getMoveTargetPath = (sourcePath, destinationPath) => {
        const normalizedSource = getFilePathForRemoveCommand(sourcePath);
        const normalizedDestination = getFilePathForRemoveCommand(destinationPath).replace(/\/+$/, "");
        const fileName = normalizedSource.split("/").pop() || "";
        if (!normalizedDestination || !fileName) return "";
        return `${normalizedDestination}/${fileName}`;
    };
    const closeMoveDestinationMenu = () => {
        if (!activeMoveDestinationMenu) return;
        if (typeof activeMoveDestinationMenu.cleanup === "function") activeMoveDestinationMenu.cleanup();
        activeMoveDestinationMenu = null;
    };
    const buildMoveDestinationOptionContent = (folderPath) => {
        const wrapper = document.createElement("div");
        const title = document.createElement("div");
        title.style.fontWeight = "600";
        title.textContent = folderPath.split("/").pop() || folderPath;
        const detail = document.createElement("div");
        detail.style.fontSize = "12px";
        detail.style.opacity = "0.7";
        detail.textContent = folderPath;
        wrapper.appendChild(title);
        wrapper.appendChild(detail);
        return wrapper;
    };
    const moveFileToDirectory = async (rawSourcePath, rawDestinationPath) => {
        const sourcePath = getFilePathForRemoveCommand(rawSourcePath);
        const destinationPath = getFilePathForRemoveCommand(rawDestinationPath);
        const fileName = sourcePath.split("/").pop() || "file";
        const targetPath = getMoveTargetPath(sourcePath, destinationPath);
        if (!sourcePath || !destinationPath || !targetPath) {
            modular.error(`Failed to move ${fileName}`);
            return false;
        }
        if (sourcePath === targetPath) {
            modular.message(`${fileName} is already in ${destinationPath}`);
            return false;
        }
        try {
            const response = await CLI.send(CLI.buildFilesCommand("move", sourcePath, targetPath));
            if (!isSuccessfulCliResponse(response)) {
                modular.error(`Failed to move ${fileName}`);
                return false;
            }
            await refreshFilesAfterMutation();
            if (document.getElementById("documents")) loadDocumentsDirectory(current_documents_directory);
            modular.success(`Moved ${fileName} to ${destinationPath}`);
            return true;
        } catch (_) {
            modular.error(`Failed to move ${fileName}`);
            return false;
        }
    };
    const positionMoveDestinationMenu = (menu, clientX, clientY) => {
        menu.style.left = `${clientX}px`;
        menu.style.top = `${clientY}px`;
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            let nextLeft = clientX;
            let nextTop = clientY;
            if (rect.right > window.innerWidth - 8) nextLeft = Math.max(8, window.innerWidth - rect.width - 8);
            if (rect.bottom > window.innerHeight - 8) nextTop = Math.max(8, window.innerHeight - rect.height - 8);
            menu.style.left = `${nextLeft}px`;
            menu.style.top = `${nextTop}px`;
        });
    };
    const showMoveDestinationMenu = async (rawSourcePath, event) => {
        const sourcePath = getFilePathForRemoveCommand(rawSourcePath);
        if (!sourcePath) return;
        closeMoveDestinationMenu();
        const menu = document.createElement("div");
        menu.className = "custom-context-menu";
        menu.style.minWidth = "320px";
        menu.style.maxWidth = "min(420px, calc(100vw - 16px))";
        menu.style.padding = "8px";
        menu.innerHTML = `
            <div style="font-size:12px;opacity:0.7;padding:2px 4px 8px 4px;">Move ${sourcePath.split("/").pop() || "file"} to...</div>
            <input type="search" placeholder="Search folders" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid var(--secondary-border);background:var(--secondary-bg);color:var(--fg);outline:none;">
            <div data-role="move-options" style="margin-top:8px;max-height:240px;overflow:auto;display:flex;flex-direction:column;gap:4px;"></div>
        `;
        document.body.appendChild(menu);
        const searchInput = menu.querySelector("input");
        const optionsRoot = menu.querySelector('[data-role="move-options"]');
        let folders = [];
        let filteredFolders = [];
        let activeIndex = 0;
        const updateOptionHighlight = () => {
            Array.from(optionsRoot.children).forEach((option, index) => {
                if (!(option instanceof HTMLElement) || option.tagName !== "BUTTON") return;
                option.style.background = index === activeIndex ? "var(--secondary-bg)" : "transparent";
            });
            const activeOption = optionsRoot.children[activeIndex];
            if (activeOption && typeof activeOption.scrollIntoView === "function") {
                activeOption.scrollIntoView({block: "nearest"});
            }
        };
        const renderOptions = () => {
            const query = String(searchInput?.value || "").trim().toLowerCase();
            filteredFolders = folders.filter(folderPath => {
                if (!query) return true;
                return folderPath.toLowerCase().includes(query);
            });
            activeIndex = Math.max(0, Math.min(activeIndex, Math.max(filteredFolders.length - 1, 0)));
            optionsRoot.innerHTML = "";
            if (!filteredFolders.length) {
                const emptyState = document.createElement("div");
                emptyState.style.padding = "8px 10px";
                emptyState.style.opacity = "0.7";
                emptyState.textContent = folders.length ? "No folders match your search" : "No folders available";
                optionsRoot.appendChild(emptyState);
                return;
            }
            filteredFolders.forEach((folderPath, index) => {
                const option = document.createElement("button");
                option.type = "button";
                option.className = "context-menu-item";
                option.style.textAlign = "left";
                option.style.border = "0";
                option.style.background = index === activeIndex ? "var(--secondary-bg)" : "transparent";
                option.style.color = "inherit";
                option.replaceChildren(buildMoveDestinationOptionContent(folderPath));
                option.onmouseenter = () => {
                    activeIndex = index;
                    updateOptionHighlight();
                };
                option.onclick = async e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const moved = await moveFileToDirectory(sourcePath, folderPath);
                    if (moved) closeMoveDestinationMenu();
                };
                optionsRoot.appendChild(option);
            });
            updateOptionHighlight();
        };
        const handleDocumentPointer = pointerEvent => {
            if (!menu.contains(pointerEvent.target)) closeMoveDestinationMenu();
        };
        const handleEscape = keyboardEvent => {
            if (keyboardEvent.key === "Escape") closeMoveDestinationMenu();
        };
        const cleanup = () => {
            document.removeEventListener("mousedown", handleDocumentPointer, true);
            document.removeEventListener("keydown", handleEscape, true);
            menu.remove();
        };
        activeMoveDestinationMenu = {cleanup};
        document.addEventListener("mousedown", handleDocumentPointer, true);
        document.addEventListener("keydown", handleEscape, true);
        searchInput.addEventListener("input", () => {
            activeIndex = 0;
            renderOptions();
        });
        searchInput.addEventListener("keydown", async keyboardEvent => {
            if (keyboardEvent.key === "ArrowDown") {
                keyboardEvent.preventDefault();
                if (!filteredFolders.length) return;
                activeIndex = Math.min(activeIndex + 1, filteredFolders.length - 1);
                renderOptions();
                return;
            }
            if (keyboardEvent.key === "ArrowUp") {
                keyboardEvent.preventDefault();
                if (!filteredFolders.length) return;
                activeIndex = Math.max(activeIndex - 1, 0);
                renderOptions();
                return;
            }
            if (keyboardEvent.key === "Enter") {
                keyboardEvent.preventDefault();
                const selectedFolder = filteredFolders[activeIndex];
                if (!selectedFolder) return;
                const moved = await moveFileToDirectory(sourcePath, selectedFolder);
                if (moved) closeMoveDestinationMenu();
            }
        });
        optionsRoot.innerHTML = `<div style="padding:8px 10px;opacity:0.7;">Loading folders...</div>`;
        positionMoveDestinationMenu(menu, event?.clientX ?? window.innerWidth / 2, event?.clientY ?? window.innerHeight / 2);
        searchInput.focus();
        searchInput.select();
        try {
            folders = (await listMoveDestinationFolders()).filter(folderPath => folderPath !== sourcePath);
            renderOptions();
        } catch (_) {
            optionsRoot.innerHTML = `<div style="padding:8px 10px;opacity:0.7;">Unable to load folders</div>`;
            modular.error("Failed to load folders");
        }
    };
    const createFileMenuItems = () => [{
        icon: modular.icons.open,
        label: "Open",
        action: (b, e, el) => {
            const path = el.closest(".file-folder")?.getAttribute("directive");
            openFilePath(path, el);
        }
    }, {
        icon: modular.icons.play,
        label: "Run",
        visible: (b, el) => /\.sui$/i.test(el?.closest?.(".file-folder")?.getAttribute("directive") || ""),
        action: (b, e, el) => {
            const path = el.closest(".file-folder")?.getAttribute("directive");
            runSuiFilePath(path);
        }
    }, {
        icon: modular.icons.create,
        label: "Pin to Desktop",
        action: (b, e, el) => {
            const path = el.closest(".file-folder")?.getAttribute("directive");
            if (!path) return;
            window.StandardDesktop?.createShortcut?.({
                type: "file",
                title: path.split("/").pop() || "File",
                target: path
            });
        }
    }, {
        icon: modular.icons.modify,
        label: "Rename",
        action: (b, e, el) => {
            const path = el.closest(".file-folder")?.getAttribute("directive");
            renameFile(path);
        }
    }, {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 15 12 19.5 16.5 15m-9-6L12 4.5 16.5 9"/></svg>`,
        label: "Move",
        action: (b, e, el) => {
            const path = el.closest(".file-folder")?.getAttribute("directive");
            showMoveDestinationMenu(path, e);
        }
    }, {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"/></svg>`,
        label: "Download",
        action: (b, e, el) => {
            const path = el.closest(".file-folder")?.getAttribute("directive");
            triggerFileDownload(path);
        }
    }, {
        icon: modular.icons.delete,
        label: "Delete",
        destructive: true,
        action: (b, e, el) => {
            const tile = el.closest(".file-folder");
            const path = tile?.getAttribute("directive");
            deleteFile(path, tile);
        }
    }];

    const createMultiFileMenuItems = root => {
        const selectedTiles = getSelectedFileTiles(root);
        const count = selectedTiles.length;
        return [{
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"/></svg>`,
            label: `Download ${count} items`,
            action: () => downloadSelectedFiles(selectedTiles)
        }, {
            icon: modular.icons.delete,
            label: `Delete ${count} items`,
            destructive: true,
            action: () => deleteSelectedFiles(selectedTiles)
        }];
    };
    const selectionAwareFileMenu = singleItems => (root, target) => {
        const targetTile = target?.closest?.(".file-folder");
        const selectedTiles = getSelectedFileTiles(root);
        return targetTile?.classList.contains("files-file-selected") && selectedTiles.length > 1
            ? createMultiFileMenuItems(root)
            : singleItems;
    };
    const bindFileContextMenu = (root, singleItems) => {
        if (!(root instanceof HTMLElement) || root.dataset.filesContextMenuReady === "true") return;
        root.dataset.filesContextMenuReady = "true";
        const menu = document.createElement("div");
        menu.className = "custom-context-menu hidden";
        document.body.appendChild(menu);
        const hideMenu = () => {
            menu.classList.add("hidden");
            menu.style.display = "none";
            menu.style.opacity = 0;
        };
        root.addEventListener("contextmenu", event => {
            const target = event.target;
            const items = selectionAwareFileMenu(singleItems)(root, target);
            if (!items.length || !target?.closest?.(".file-folder")) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            document.querySelectorAll(".custom-context-menu:not(.hidden)").forEach(openMenu => {
                if (openMenu !== menu) openMenu.classList.add("hidden");
            });
            menu.innerHTML = "";
            items.forEach(item => {
                if (typeof item?.visible === "function" && !item.visible(root, target)) return;
                if (item?.visible === false) return;
                const option = document.createElement("div");
                option.className = "context-menu-item";
                if (item.destructive) option.classList.add("text-red");
                const label = typeof item.label === "function" ? item.label(root, target) : item.label;
                option.innerHTML = item.content || (item.icon ? `${item.icon}<span>${label}</span>` : label);
                option.addEventListener("click", clickEvent => {
                    clickEvent.preventDefault();
                    clickEvent.stopPropagation();
                    hideMenu();
                    item.action?.(root, clickEvent, target);
                });
                menu.appendChild(option);
            });
            if (!menu.children.length) return;
            menu.style.left = `${event.clientX}px`;
            menu.style.top = `${event.clientY}px`;
            menu.classList.remove("hidden");
            menu.in();
            requestAnimationFrame(() => {
                const rect = menu.getBoundingClientRect();
                if (rect.right > window.innerWidth) menu.style.left = `${event.clientX - rect.width}px`;
                if (rect.bottom > window.innerHeight) menu.style.top = `${event.clientY - rect.height}px`;
            });
        }, true);
        document.addEventListener("click", hideMenu);
    };

    const fileSelectionControllers = new WeakMap();
    const getFileSelectionMarquee = () => {
        let marquee = document.getElementById("files-selection-marquee");
        if (marquee) return marquee;
        marquee = document.createElement("div");
        marquee.id = "files-selection-marquee";
        marquee.className = "files-selection-marquee hidden";
        marquee.setAttribute("aria-hidden", "true");
        document.body.appendChild(marquee);
        return marquee;
    };
    const selectionBounds = (start, current) => {
        const left = Math.min(start.x, current.x);
        const top = Math.min(start.y, current.y);
        const width = Math.abs(current.x - start.x);
        const height = Math.abs(current.y - start.y);
        return {left, top, right: left + width, bottom: top + height, width, height};
    };
    const rectanglesIntersect = (rect, bounds) => rect.left < bounds.right && rect.right > bounds.left && rect.top < bounds.bottom && rect.bottom > bounds.top;
    const bindFileSelection = root => {
        if (!(root instanceof HTMLElement) || fileSelectionControllers.has(root)) return;
        const marquee = getFileSelectionMarquee();
        const selected = new Set();
        let interaction = null;
        let anchorTile = null;
        let suppressClick = false;
        const tiles = () => Array.from(root.querySelectorAll(".file-folder"));
        const selectedTiles = () => Array.from(selected).filter(tile => tile.isConnected && root.contains(tile));
        const isPointInsideRoot = point => {
            const rect = root.getBoundingClientRect();
            return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
        };
        const isDesktopDropPoint = point => {
            const dropTarget = document.elementFromPoint(point.x, point.y);
            const desktopViewport = document.getElementById("desktop-viewport");
            return Boolean(dropTarget && desktopViewport?.contains(dropTarget) && !dropTarget.closest(".draggable-window, header, .desktop-shortcut, .desktop-command-panel"));
        };
        const createDesktopShortcutFromTile = (tile, point) => {
            const path = String(tile?.getAttribute?.("directive") || "").trim();
            if (!path || tile?.getAttribute?.("data") === "directory" || isFolderPath(path) || typeof window.StandardDesktop?.createShortcutAt !== "function") return false;
            const name = String(tile.querySelector(".files-file-name")?.textContent || path.split(/[\\/]/).pop() || "File").trim();
            const worldPoint = window.StandardDesktop.clientToWorld?.(point) || point;
            window.StandardDesktop.createShortcutAt({type: "file", title: name, target: path}, worldPoint);
            return true;
        };
        const applySelection = nextTiles => {
            selected.clear();
            nextTiles.forEach(tile => {
                if (tile?.isConnected && root.contains(tile)) selected.add(tile);
            });
            tiles().forEach(tile => {
                const isSelected = selected.has(tile);
                tile.classList.toggle("files-file-selected", isSelected);
                tile.setAttribute("aria-selected", String(isSelected));
            });
        };
        const selectClickedTile = (tile, event) => {
            const additive = event.metaKey || event.ctrlKey;
            if (event.shiftKey && anchorTile?.isConnected) {
                const allTiles = tiles();
                const startIndex = allTiles.indexOf(anchorTile);
                const endIndex = allTiles.indexOf(tile);
                if (startIndex >= 0 && endIndex >= 0) {
                    const range = allTiles.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
                    applySelection(additive ? [...selectedTiles(), ...range] : range);
                    return;
                }
            }
            if (additive) {
                const next = new Set(selectedTiles());
                if (next.has(tile)) next.delete(tile); else next.add(tile);
                applySelection(next);
            } else {
                applySelection([tile]);
            }
            anchorTile = tile;
        };
        root.classList.add("files-selection-root");
        root.addEventListener("click", event => {
            if (suppressClick) {
                suppressClick = false;
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            const tile = event.target?.closest?.(".file-folder");
            if (!tile || !root.contains(tile)) return;
            selectClickedTile(tile, event);
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);
        root.addEventListener("contextmenu", event => {
            const tile = event.target?.closest?.(".file-folder");
            if (!tile || !root.contains(tile)) {
                applySelection([]);
                return;
            }
            if (!selected.has(tile)) {
                applySelection([tile]);
                anchorTile = tile;
            }
        }, true);
        root.addEventListener("pointerdown", event => {
            if (event.button !== 0 || event.target?.closest?.("button, a, input, select, textarea")) return;
            const additive = event.metaKey || event.ctrlKey || event.shiftKey;
            interaction = {
                pointerId: event.pointerId,
                start: {x: event.clientX, y: event.clientY},
                additive,
                moved: false,
                sourceTile: event.target?.closest?.(".file-folder") || null,
                startedOnTile: Boolean(event.target?.closest?.(".file-folder")),
                desktopDrag: false,
                baseSelection: additive ? new Set(selectedTiles()) : new Set()
            };
        });
        root.addEventListener("dragstart", event => {
            if (interaction) event.preventDefault();
        });
        const moveSelection = event => {
            if (!interaction || event.pointerId !== interaction.pointerId) return;
            const bounds = selectionBounds(interaction.start, {x: event.clientX, y: event.clientY});
            if (!interaction.moved && Math.max(bounds.width, bounds.height) < 4) return;
            if (!interaction.moved) {
                interaction.moved = true;
                if (!interaction.additive) applySelection([]);
            }
            const currentPoint = {x: event.clientX, y: event.clientY};
            interaction.desktopDrag = Boolean(interaction.sourceTile && !isPointInsideRoot(currentPoint));
            if (interaction.desktopDrag) {
                marquee.classList.add("hidden");
                if (!interaction.additive) applySelection([interaction.sourceTile]);
                event.preventDefault();
                return;
            }
            Object.assign(marquee.style, {left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`});
            marquee.classList.remove("hidden");
            const hits = tiles().filter(tile => rectanglesIntersect(tile.getBoundingClientRect(), bounds));
            applySelection([...interaction.baseSelection, ...hits]);
            event.preventDefault();
        };
        const finishSelection = event => {
            if (!interaction || event.pointerId !== interaction.pointerId) return;
            const completedInteraction = interaction;
            marquee.classList.add("hidden");
            interaction = null;
            if (completedInteraction.moved) {
                suppressClick = true;
                window.setTimeout(() => { suppressClick = false; }, 0);
                const dropPoint = {x: event.clientX, y: event.clientY};
                if (completedInteraction.desktopDrag && isDesktopDropPoint(dropPoint)) {
                    createDesktopShortcutFromTile(completedInteraction.sourceTile, dropPoint);
                }
            } else if (!completedInteraction.startedOnTile && !completedInteraction.additive) {
                applySelection([]);
            }
        };
        window.addEventListener("pointermove", moveSelection);
        window.addEventListener("pointerup", finishSelection);
        window.addEventListener("pointercancel", finishSelection);
        fileSelectionControllers.set(root, {selectedTiles, applySelection});
    };

    const getImageSourceFromTile = sourceNode => {
        const tile = sourceNode?.closest?.(".file-folder") || sourceNode;
        const image = sourceNode?.matches?.("img") ? sourceNode : tile?.querySelector?.("img");
        return String(image?.currentSrc || image?.src || image?.getAttribute?.("src") || "").trim();
    };

    const openPhotoInImageViewer = async (rawPath = "", sourceNode = null) => {
        const openRenderedPhoto = () => {
            const renderedSource = getImageSourceFromTile(sourceNode);
            if (!renderedSource || typeof window.StandardInternals?.openImageSource !== "function") return false;
            return window.StandardInternals.openImageSource(renderedSource, {path: getFilePathForRemoveCommand(rawPath), title: String(rawPath || "").split("/").pop() || "Photo", isObjectUrl: renderedSource.startsWith("blob:"), revokePrevious: false, sourceNode});
        };
        if (openRenderedPhoto()) return true;
        if (typeof modular?.start === "function") modular.start("com.standard.internals");
        for (let attempt = 0; attempt < 20; attempt++) {
            if (openRenderedPhoto()) return true;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        if (typeof window.StandardInternals?.openImageFilePath === "function") return window.StandardInternals.openImageFilePath(rawPath, sourceNode);
        return false;
    };

    const revokePhotoObjectUrls = () => {
        photoObjectUrls.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch (_) {
            }
        });
        photoObjectUrls.clear();
    };

    const getPhotoCacheKey = (photo = {}) => {
        const rawPath = typeof photo === "string" ? photo : (photo?.path || photo?.name || "");
        const normalizedPath = getFilePathForRemoveCommand(rawPath);
        const hash = normalizedPath ? createStableCacheHash(normalizedPath) : "";
        return hash ? `photo-${hash}` : "";
    };
    const createTrackedPhotoObjectUrl = blob => {
        const objectUrl = URL.createObjectURL(blob);
        photoObjectUrls.add(objectUrl);
        return objectUrl;
    };
    const fetchPhotoBlobFromDevice = async rawPath => {
        const filePath = getFilePathForRemoveCommand(rawPath);
        if (!filePath) return null;
        const download = await window.StandardDownloads.downloadForOpen(filePath, {
            errorMessage: "Failed to download photo",
            suppressProgress: true
        });
        return download.blob;
    };
    const resolvePhotoImageSource = async (photo = {}, cache = null) => {
        const cacheKey = getPhotoCacheKey(photo);
        const deviceUrl = `/api/files/download?path=${encodeURIComponent(getFilePathForRemoveCommand(photo?.path || ""))}`;
        if (!cacheKey) return deviceUrl;
        try {
            const cachedPhoto = await cache?.get?.(cacheKey, {responseType: "blob"});
            if (cachedPhoto instanceof Blob && cachedPhoto.size) return createTrackedPhotoObjectUrl(cachedPhoto);
        } catch (_) {
        }
        try {
            const downloadedPhoto = await fetchPhotoBlobFromDevice(photo?.path || "");
            if (downloadedPhoto && cache?.create) {
                try {
                    await cache.create(cacheKey, downloadedPhoto, {
                        contentType: downloadedPhoto.type || "image/*",
                        label: String(photo?.name || photo?.path || "Photo").split("/").pop(),
                        source: getFilePathForRemoveCommand(photo?.path || "")
                    });
                } catch (_) {
                }
            }
            if (downloadedPhoto) return createTrackedPhotoObjectUrl(downloadedPhoto);
        } catch (_) {
        }
        return deviceUrl;
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
    const getVideoCacheBaseKey = rawPath => {
        const normalizedPath = getFilePathForRemoveCommand(rawPath);
        return normalizedPath ? createStableCacheHash(normalizedPath) : "";
    };
    const getVideoThumbnailCacheKey = (video = {}) => {
        const rawPath = typeof video === "string" ? video : (video?.path || video?.name || "");
        const baseKey = getVideoCacheBaseKey(rawPath);
        return baseKey ? `video-thumb-${baseKey}` : "";
    };
    const getVideoProgressCacheKey = (video = {}) => {
        const rawPath = typeof video === "string" ? video : (video?.path || video?.name || "");
        const baseKey = getVideoCacheBaseKey(rawPath);
        return baseKey ? `video-progress-${baseKey}` : "";
    };
    const waitForVideoEvent = (video, eventName, {timeoutMs = 10000, readyCheck = null} = {}) => new Promise((resolve, reject) => {
        if (typeof readyCheck === "function" && readyCheck()) {
            resolve();
            return;
        }
        let settled = false;
        let timeoutId = 0;
        const cleanup = () => {
            video.removeEventListener(eventName, handleReady);
            video.removeEventListener("error", handleError);
            if (timeoutId) window.clearTimeout(timeoutId);
        };
        const settle = callback => value => {
            if (settled) return;
            settled = true;
            cleanup();
            callback(value);
        };
        const handleReady = settle(() => resolve());
        const handleError = settle(() => reject(video.error || new Error(`Video ${eventName} failed`)));
        video.addEventListener(eventName, handleReady, {once: true});
        video.addEventListener("error", handleError, {once: true});
        timeoutId = window.setTimeout(() => {
            handleError(new Error(`Timed out waiting for ${eventName}`));
        }, timeoutMs);
    });
    const generateVideoThumbnailDataUrl = async rawPath => {
        const filePath = getFilePathForRemoveCommand(rawPath);
        if (!filePath) return "";
        const video = document.createElement("video");
        video.preload = "auto";
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = "anonymous";
        video.style.position = "fixed";
        video.style.left = "-9999px";
        video.style.top = "-9999px";
        document.body.appendChild(video);
        try {
            video.src = `/api/files/download?path=${encodeURIComponent(filePath)}`;
            await waitForVideoEvent(video, "loadedmetadata", {readyCheck: () => video.readyState >= 1});
            await waitForVideoEvent(video, "loadeddata", {readyCheck: () => video.readyState >= 2});
            if (Number.isFinite(video.duration) && video.duration > 0.25) {
                const targetTime = Math.min(Math.max(video.duration * 0.1, 0.1), 3);
                await new Promise((resolve, reject) => {
                    let settled = false;
                    let timeoutId = 0;
                    const cleanup = () => {
                        video.removeEventListener("seeked", handleSeeked);
                        video.removeEventListener("error", handleError);
                        if (timeoutId) window.clearTimeout(timeoutId);
                    };
                    const finish = callback => value => {
                        if (settled) return;
                        settled = true;
                        cleanup();
                        callback(value);
                    };
                    const handleSeeked = finish(() => resolve());
                    const handleError = finish(() => reject(video.error || new Error("Video seek failed")));
                    video.addEventListener("seeked", handleSeeked, {once: true});
                    video.addEventListener("error", handleError, {once: true});
                    timeoutId = window.setTimeout(() => handleError(new Error("Timed out seeking video")), 10000);
                    try {
                        video.currentTime = targetTime;
                    } catch (error) {
                        handleError(error);
                    }
                });
            }
            const sourceWidth = video.videoWidth || 320;
            const sourceHeight = video.videoHeight || 180;
            const scale = Math.min(1, 480 / Math.max(sourceWidth, sourceHeight));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(sourceWidth * scale));
            canvas.height = Math.max(1, Math.round(sourceHeight * scale));
            const context = canvas.getContext("2d");
            if (!context) return "";
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL("image/jpeg", 0.82);
        } catch (_) {
            return "";
        } finally {
            video.pause();
            video.removeAttribute("src");
            video.load();
            video.remove();
        }
    };
    const readVideoProgressRecord = async (rawPath = "", cache = null) => {
        const cacheKey = getVideoProgressCacheKey(rawPath);
        if (!cacheKey) return null;
        try {
            const cachedValue = await cache?.get?.(cacheKey, {format: "json"});
            if (cachedValue && typeof cachedValue === "object") return cachedValue;
            if (typeof cachedValue === "string" && cachedValue.trim()) return JSON.parse(cachedValue);
        } catch (_) {
        }
        return null;
    };
    const getVideoProgressPercent = progressRecord => {
        const duration = Number(progressRecord?.duration) || 0;
        const currentTime = Number(progressRecord?.currentTime) || 0;
        if (!(duration > 0) || !(currentTime > 0)) return 0;
        return Math.max(0, Math.min(100, (currentTime / duration) * 100));
    };
    const resolveVideoThumbnailSource = async (video = {}, cache = null) => {
        const cacheKey = getVideoThumbnailCacheKey(video);
        if (!cacheKey) return "";
        try {
            const cachedThumbnail = await cache?.get?.(cacheKey);
            if (typeof cachedThumbnail === "string" && cachedThumbnail.trim()) return cachedThumbnail;
        } catch (_) {
        }
        try {
            const generatedThumbnail = await generateVideoThumbnailDataUrl(video?.path || "");
            if (generatedThumbnail && cache?.create) {
                try {
                    await cache.create(cacheKey, generatedThumbnail);
                } catch (_) {
                }
            }
            return generatedThumbnail;
        } catch (_) {
            return "";
        }
    };    const openVideoInVideoViewer = async (rawPath = "", sourceNode = null) => {
        if (typeof window.StandardInternals?.openVideoFilePath === "function") return window.StandardInternals.openVideoFilePath(rawPath, sourceNode);
        if (typeof modular?.start === "function") modular.start("com.standard.internals");
        for (let attempt = 0; attempt < 20; attempt++) {
            if (typeof window.StandardInternals?.openVideoFilePath === "function") return window.StandardInternals.openVideoFilePath(rawPath, sourceNode);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return false;
    };
    const getDirectoryLabel = directoryPath => {
        const normalizedPath = (directoryPath || "").replace(/\/+$/, "");
        const segments = normalizedPath.split("/").filter(Boolean);
        return segments.pop() || "Documents";
    };
    const updateDocumentsHeader = () => {
        const label = document.getElementById("documents-title");
        if (label) label.textContent = getDirectoryLabel(current_documents_directory);
        const backButton = document.getElementById("documents-nav-back");
        if (backButton) backButton.disabled = current_documents_history_index <= 0;
        const forwardButton = document.getElementById("documents-nav-forward");
        if (forwardButton) forwardButton.disabled = current_documents_history_index >= (documents_history.length - 1);
    };
    const loadDocumentsDirectory = directoryPath => {
        current_documents_directory = directoryPath;
        setActiveUploadDirectory(directoryPath);
        return CLI.send(`tree ${directoryPath}`).then(documents => {
            working_files = documents.children || [];
            const documentsRoot = document.getElementById("documents");
            if (documentsRoot) documentsRoot.innerHTML = renderFiles();
            updateDocumentsHeader();
            return documents;
        });
    };
    const navigateDocumentsDirectory = (directoryPath, addToHistory = true) => {
        if (addToHistory) {
            documents_history = documents_history.slice(0, current_documents_history_index + 1);
            documents_history.push(directoryPath);
            current_documents_history_index = documents_history.length - 1;
        }
        return loadDocumentsDirectory(directoryPath);
    };
    const updateRubbishHeader = () => {
        const label = document.getElementById("rubbish-title");
        if (label) label.textContent = getDirectoryLabel(current_rubbish_directory);
    };
    const loadRubbishDirectory = directoryPath => {
        current_rubbish_directory = directoryPath;
        return CLI.send(`tree ${directoryPath}`).then(rubbish => {
            working_files = rubbish.children || [];
            const rubbishRoot = document.getElementById("rubbish");
            if (rubbishRoot) rubbishRoot.innerHTML = renderFiles({navigateDirectory: navigateRubbishDirectory});
            updateRubbishHeader();
            return rubbish;
        });
    };
    const navigateRubbishDirectory = directoryPath => loadRubbishDirectory(directoryPath);
    const openDirectoryPath = async (rawPath = "") => {
        const directoryPath = String(rawPath || "").trim();
        if (!directoryPath) return false;
        if (typeof modular?.show === "function") modular.show(FILES_SERVICE_ID, 1);
        await navigateDocumentsDirectory(directoryPath);
        return true;
    };
    window.StandardFiles = window.StandardFiles || {};
    window.StandardFiles.openDirectoryPath = (rawPath = "") => openDirectoryPath(rawPath);
    window.StandardFiles.isDirectoryRecord = (file = {}) => isDirectory(file);
    syncUploadDirectory();
    const navigateToFileDirectory = async (file = {}, navigateDirectory = navigateDocumentsDirectory) => {
        const folderName = String(file?.name || getDirectoryLabel(file?.path) || "folder");
        const progressToken = window.StandardDownloads?.beginOpenProgress?.(`Fetching contents of ${folderName}`) || 0;
        try {
            return await navigateDirectory(file.path);
        } catch (error) {
            console.error(`Failed to load folder ${file.path || folderName}`, error);
            modular.error(`Failed to load ${folderName}`);
            return false;
        } finally {
            window.setTimeout(() => window.StandardDownloads?.hideOpenProgress?.(progressToken), 220);
        }
    };
    function renderFiles({openDirectories = true, navigateDirectory = navigateDocumentsDirectory} = {}) {
        let as = []
        const files = getSortedWorkingFiles();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            as.push(div({
                style: "padded secondary-tile brick list-item hidden file-folder files-file-item",
                directive: file.path,
                data: isDirectory(file) ? "directory" : "file",
                content: children([img({style: "margined-icon float-left no-events files-file-icon", src: getFileTypeIconPath(file)}), div({style: "files-file-copy", content: children([div({style: "no-events files-file-name", content: file.name}), em({style: "faded no-wrap hidden files-file-detail", content: file.path.replace("/home/standard-system/", "")})])})]),
                ondblclick: () => {
                    if (!isDirectory(file) || !openDirectories) {
                        openFilePath(file.path);
                        return;
                    }
                    navigateToFileDirectory(file, navigateDirectory);
                }
            }));
        }
        return children(as);
    }
    modular.register(new Service(FILES_SERVICE_ID, [new Portal({
        title: "Files",
        hints: ["files"],
        dimensions: [775, 500],
        tools: [{
            title: "Search",
            icon: modular.icons.search,
            onclick: (event, context) => showFilesSearchDialogue(context?.portal, event?.currentTarget)
        }],
        svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776"/></svg>`,
        icon: "/icons/interfaces/files.png",
        routes: [{
            text: "Everything",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"/></svg>`,
            route: () => div({
                style: "small-padding",
                content: children([fileDisplayButton("everything-display"), fileSortButton("everything-sort"), h({level: 3, content: "Everything"}), div({style: "spacer"}), div({
                    id: "all-files", style: getFileDisplayRootClass(), menu: "file", content: () => {
                        return CLI.send("[files]").then(everything => {
                            working_files = everything.files;
                            return renderFiles({openDirectories: false});
                        })
                    }
                })])
            }),
            afterRender: () => {
                bindFileSortButton("everything-sort", "all-files", {openDirectories: false});
                bindFileDisplayButton("everything-display", "all-files", {openDirectories: false});
                document.querySelectorAll("#all-files").forEach(el => {
                    bindFileSelection(el);
                    bindFileContextMenu(el, createFileMenuItems());
                });
            }
        }, {
            text: "Documents",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>`,
            route: (_, view) => div({content: children([
                    div({content: children([
                            div({style: "float-left margin-right", content: children([
                                    button({id: "documents-nav-back", style: "small naked hover-zoom", disabled: true, icon: `<svg class="smaller-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/></svg>`}),
                                    button({id: "documents-nav-forward", style: "small naked hover-zoom", disabled: true, icon: `<svg class="smaller-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/></svg>`})
                                ])
                            }),
                            fileDisplayButton("documents-display"), fileSortButton("documents-sort"), button({
                                id: "documents-create-folder",
                                style: "small naked float-right hover-zoom",
                                icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>`,
                                title: "New folder"
                            }),
                            h({level: 3, id: "documents-title", style: "very-small-padding-top padding-left", content: "Documents"})
                        ])
                    }), div({style: "spacer"}), div({
                        id: "documents", style: getFileDisplayRootClass(), content: () => {
                            return loadDocumentsDirectory(current_documents_directory).then(documents => {
                                working_files = documents.children;
                                return renderFiles()
                            })
                        }
                    })])
            }),
            afterRender: (_, view) => {
                const backButton = document.getElementById("documents-nav-back");
                if (backButton) {
                    backButton.onclick = () => {
                        if (current_documents_history_index <= 0) return;
                        current_documents_history_index -= 1;
                        navigateDocumentsDirectory(documents_history[current_documents_history_index], false);
                    };
                }
                const forwardButton = document.getElementById("documents-nav-forward");
                if (forwardButton) {
                    forwardButton.onclick = () => {
                        if (current_documents_history_index >= (documents_history.length - 1)) return;
                        current_documents_history_index += 1;
                        navigateDocumentsDirectory(documents_history[current_documents_history_index], false);
                    };
                }
                const createFolderButton = document.getElementById("documents-create-folder");
                if (createFolderButton) {
                    createFolderButton.onclick = () => createFolderInCurrentDocumentsDirectory();
                }
                bindFileSortButton("documents-sort", "documents");
                bindFileDisplayButton("documents-display", "documents");
                updateDocumentsHeader();
                document.querySelectorAll("#documents").forEach(el => {
                    bindFileSelection(el);
                    bindFileContextMenu(el, createFileMenuItems());
                });
            }
        }, {
            text: "Notes",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z"/></svg>`,
            route: () => div({style: "small-padding-right", content: children([
                div({style: "masonry", id: "notes", content: () => {
                            return CLI.send("[notes]").then(d => {
                                const noteRecords = d === 0 ? [] : (d.notes || d.NTS);
                                if (!Array.isArray(noteRecords)) throw new Error("Invalid notes response");
                                const notes = noteRecords.map(normalizeNoteRecord);
                                if (notes.length === 0) return renderNoNotesState();
                                let as = []
                                for (let i = 0; i < notes.length; i++) {
                                    as.push(div({
                                        style: "note-tile hidden padded secondary-tile secondary-bordered radius hover-shadowed hover-zoom",
                                        directive: notes[i].id,
                                        background: notes[i].color,
                                        onclick: event => {
                                            if (event.target.closest("button") || event.target.closest("img")) return;
                                            openNoteInNotesApp(notes[i]);
                                        },
                                        content: children([
                                            button({style: "naked inner-radius float-right expose no-padding small-padding",
                                                icon: modular.icons.modify,
                                                onclick: () => openNoteEditorInNotesApp(notes[i])
                                            }),
                                            button({style: "naked inner-radius float-right expose no-padding small-padding",
                                                icon: modular.icons.delete,
                                                onclick: event => deleteNoteFromNotesSection(notes[i].id, notes[i], event.target)
                                            }),
                                            strong({style: "note-tile-title", content: escapeHtml(notes[i].title || notes[i].created || "Untitled Note")}),
                                            div({style: "note-tile-content", content: sanitizeNoteMarkup(normalizeNoteContent(notes[i].content))}),
                                            notes[i].title ? em({
                                                style: "smaller faded no-wrap",
                                                content: notes[i].created
                                            }) : ""
                                        ])
                                    }))
                                }
                                return children(as);
                            })
                        }
                    }),
                    button({
                        style: "secondary primary-action round hover-zoom",
                        icon: modular.icons.create,
                        onclick: () => modular.show("com.standard.notes", 1)
                    })
                ])
            }),
            afterRender: () => {
                const notesRoot = document.getElementById("notes");
                bindNoteImageViewer(notesRoot);
                document.querySelectorAll("#notes").forEach((el) => el.contextmenu([{
                    icon: modular.icons.open,
                    label: "Open",
                    action: (b, e, target) => {
                        const note = getNoteFromTile(target);
                        if (!note) {
                            modular.show("com.standard.notes", 2);
                            return;
                        }
                        openNoteInNotesApp(note);
                    }
                }, {
                    icon: modular.icons.modify,
                    label: "Edit",
                    action: (b, e, target) => {
                        const note = getNoteFromTile(target);
                        if (!note) {
                            modular.show("com.standard.notes", 2);
                            return;
                        }
                        openNoteEditorInNotesApp(note);
                    }
                }, {
                    icon: modular.icons.delete,
                    label: "Delete",
                    destructive: true,
                    action: (b, e, target) => {
                        const note = getNoteFromTile(target);
                        deleteNoteFromNotesSection(note?.id, note, target);
                    }
                }]))
            }
        }, {
            text: "Photos",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"/></svg>`,
            route: (_, context) => {
                setActiveUploadDirectory("Photos");
                return div({
                    style: "small-padding-right",
                    content: children([div({
                        style: "files-photos-heading",
                        content: children([h({level: 3, content: "Photos"}), button({
                            id: "photos-display-style",
                            style: "naked inner-radius files-photo-display-button",
                            title: "Photo display: Cascade. Switch to grid",
                            icon: PHOTO_CASCADE_ICON
                        })])
                    }), div({style: "spacer"}), div({
                        id: "photos",
                        style: "masonry",
                        content: () => CLI.send("tree Photos").then(async photos => {
                            revokePhotoObjectUrls();
                            const photoFiles = (photos?.children || []).filter(file => !isDirectory(file) && isImageFilePath(file?.path));
                            const photoTiles = await Promise.all(photoFiles.map(async photo => {
                                const photoSource = await resolvePhotoImageSource(photo, context?.cache);
                                return div({
                                    style: "hover-zoom hover-shadow shadowed hidden file-folder pointer",
                                    directive: photo.path,
                                    ondblclick: event => openPhotoInImageViewer(photo.path, event?.target),
                                    content: children([div({style: "radius", content: img({style: "fill radius pointer no-events brick covered", src: photoSource})})])
                                });
                            }));
                            return children(photoTiles);
                        })
                    })])
                });
            },
            afterRender: () => {
                setActiveUploadDirectory("Photos");
                const photosRoot = document.getElementById("photos");
                const displayStyleButton = document.getElementById("photos-display-style");
                if (displayStyleButton) {
                    displayStyleButton.addEventListener("click", async () => {
                        await loadPhotoDisplayStyleSetting();
                        setPhotoDisplayStyle(photoDisplayStyle === "cascade" ? "grid" : "cascade");
                        applyPhotoDisplayStyle();
                        await savePhotoDisplayStyleSetting(photoDisplayStyle);
                    });
                }
                applyPhotoDisplayStyle();
                loadPhotoDisplayStyleSetting().then(() => applyPhotoDisplayStyle());
                if (photoCascadeObserver) {
                    photoCascadeObserver.disconnect();
                    photoCascadeObserver = null;
                }
                if (photosRoot) {
                    photoCascadeObserver = new MutationObserver(() => applyPhotoDisplayStyle());
                    photoCascadeObserver.observe(photosRoot, {childList: true, subtree: true});
                }
                document.querySelectorAll("#photos").forEach(el => {
                    bindFileSelection(el);
                    bindFileContextMenu(el, [{
                    icon: modular.icons.modify,
                    label: "Rename",
                    action: (b, e, target) => {
                        const path = target.closest(".file-folder")?.getAttribute("directive");
                        renameFile(path);
                    }
                }, {
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"/></svg>`,
                    label: "Download",
                    action: (b, e, target) => {
                        const path = target.closest(".file-folder")?.getAttribute("directive");
                        triggerFileDownload(path);
                    }
                }, {
                    icon: modular.icons.delete,
                    label: "Delete",
                    destructive: true,
                    action: (b, e, target) => {
                        const tile = target.closest(".file-folder");
                        const path = tile?.getAttribute("directive");
                        deleteFile(path, tile);
                    }
                    }]);
                });
            }
        }, {
            text: "Music",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"/></svg>`,
            route: () => div({}),
        }, {
            text: "Videos",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>`,
            route: (_, context) => {
                setActiveUploadDirectory("Videos");
                return div({
                    content: children([h({level: 3, content: "Videos"}), div({style: "spacer"}), div({
                        id: "videos",
                        style: "large-gridded",
                        content: () => CLI.send("tree Videos").then(async videos => {
                            const videoFiles = (videos?.children || []).filter(file => !isDirectory(file) && isVideoFilePath(file?.path));
                            const videoTiles = await Promise.all(videoFiles.map(async video => {
                                const [thumbnailSource, progressRecord] = await Promise.all([resolveVideoThumbnailSource(video, context?.cache), readVideoProgressRecord(video?.path || "", context?.cache)]);
                                const progressPercent = getVideoProgressPercent(progressRecord);
                                const videoLabel = video.name || (video.path || "").split("/").pop();
                                const thumbnailContent = thumbnailSource ? img({style: "fill radius pointer no-events brick covered", src: thumbnailSource, alt: videoLabel || "Video thumbnail"}) : div({style: "files-video-fallback", content: img({style: "no-events", src: "/icons/avi.png", alt: "Video"})});
                                return div({
                                    style: "hover-zoom hover-shadow hidden file-folder pointer",
                                    directive: video.path,
                                    ondblclick: event => openVideoInVideoViewer(video.path, event?.target),
                                    content: children([
                                        div({
                                            style: "files-video-thumb radius",
                                            content: children([
                                                thumbnailContent,
                                                div({style: "files-video-label no-events", content: videoLabel}),
                                                progressPercent > 0 ? `<div class="files-video-progress" style="width:${progressPercent}%"></div>` : ""
                                            ])
                                        })
                                    ])
                                });
                            }));
                            return children(videoTiles);
                        })
                    })])
                });
            },
            afterRender: () => {
                setActiveUploadDirectory("Videos");
                document.querySelectorAll("#videos").forEach(el => {
                    bindFileSelection(el);
                    bindFileContextMenu(el, [{
                    icon: modular.icons.open,
                    label: "Open",
                    action: (b, e, target) => {
                        const path = target.closest(".file-folder")?.getAttribute("directive");
                        openVideoInVideoViewer(path, target);
                    }
                }, {
                    icon: modular.icons.modify,
                    label: "Rename",
                    action: (b, e, target) => {
                        const path = target.closest(".file-folder")?.getAttribute("directive");
                        renameFile(path);
                    }
                }, {
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"/></svg>`,
                    label: "Download",
                    action: (b, e, target) => {
                        const path = target.closest(".file-folder")?.getAttribute("directive");
                        triggerFileDownload(path);
                    }
                }, {
                    icon: modular.icons.delete,
                    label: "Delete",
                    destructive: true,
                    action: (b, e, target) => {
                        const tile = target.closest(".file-folder");
                        const path = tile?.getAttribute("directive");
                        deleteFile(path, tile);
                    }
                    }]);
                });
            }
        }, {
            text: "Rubbish",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>`,
            route: () => div({content: children([
                    div({content: children([
                            fileDisplayButton("rubbish-display"), fileSortButton("rubbish-sort"), button({
                                id: "rubbish-create-folder",
                                style: "small naked float-right hover-zoom",
                                icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>`,
                                title: "New folder"
                            }),
                            h({level: 3, id: "rubbish-title", style: "very-small-padding-top padding-left", content: "Rubbish"})
                        ])
                    }), div({style: "spacer"}), div({
                        id: "rubbish", style: getFileDisplayRootClass(), content: () => {
                            return loadRubbishDirectory(current_rubbish_directory).then(rubbish => {
                                working_files = rubbish.children || [];
                                return renderFiles({navigateDirectory: navigateRubbishDirectory});
                            });
                        }
                    })])
            }),
            afterRender: () => {
                const createFolderButton = document.getElementById("rubbish-create-folder");
                if (createFolderButton) createFolderButton.onclick = () => createFolderInCurrentRubbishDirectory();
                bindFileSortButton("rubbish-sort", "rubbish", {navigateDirectory: navigateRubbishDirectory});
                bindFileDisplayButton("rubbish-display", "rubbish", {navigateDirectory: navigateRubbishDirectory});
                updateRubbishHeader();
                document.querySelectorAll("#rubbish").forEach(el => {
                    bindFileSelection(el);
                    bindFileContextMenu(el, createFileMenuItems());
                });
            }
        }, {
            text: "Upload",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18"/></svg>`,
            route: div({style: "padded",
                content: children([
                    h({level: 3, content: "Upload Files"}),
                    div({style: "spacer"}),
                    div({content: children([
                            button({content: "Browse Device", onclick: _ => {
                                    const uploadInput = document.createElement("input");
                                    uploadInput.type = "file";
                                    uploadInput.multiple = true;
                                    uploadInput.style.display = "none";
                                    uploadInput.onchange = async event => {
                                        const files = event?.target?.files;
                                        await uploadSelectedFiles(files);
                                        uploadInput.remove();
                                    };
                                    document.body.appendChild(uploadInput);
                                    uploadInput.click();
                                }
                            })
                        ])
                    }),
                    div({style: "spacer"}),
                    em({style: "faded", content: "Max file upload size is 1 GB"})
                ])
            })
        }]
    })], FILES_SETTINGS));
    loadFileDisplayStyleSetting();
    loadPhotoDisplayStyleSetting();
    const syncFilesAppSettings = event => {
        if (event?.detail?.serviceId !== FILES_SERVICE_ID) return;
        const values = event.detail.values || {};
        setFileDisplayStyle(values.display_style || FILES_SETTINGS.display_style.default);
        setPhotoDisplayStyle(values.photo_display_style || FILES_SETTINGS.photo_display_style.default);
        applyPhotoDisplayStyle();
    };
    document.addEventListener("standard-app-settings-saved", syncFilesAppSettings);
    document.addEventListener("standard-app-settings-reset", syncFilesAppSettings);
    window.addEventListener("beforeunload", () => {
        if (photoCascadeObserver) {
            photoCascadeObserver.disconnect();
            photoCascadeObserver = null;
        }
        revokePhotoObjectUrls();
    });
})();
