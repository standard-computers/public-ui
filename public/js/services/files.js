(async () => {
    const NOTE_CONTENT_PREFIX = "__STD_NOTE_B64__:";
    let photoCascadeObserver = null;
    const photoObjectUrls = new Set();
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
    let fileSortMode = "name-asc";
    const FILE_SORT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" /></svg>`;
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
        if (typeof searchDialogue === "function") {
            searchDialogue({
                title: "Search",
                placeholder: "Find files",
                confirmText: "Search",
                anchor: anchorNode,
                emptyText: "Start typing to search this view.",
                noResultsText: "No files match.",
                matches: query => createFilesSearchMatches(query, portal),
                preview: (_, match) => previewFilesSearchMatch(match),
                confirmation: (query, match, matches) => {
                    const selectedMatch = match || matches?.[0] || createFilesSearchMatches(query, portal)[0];
                    if (!previewFilesSearchMatch(selectedMatch)) modular.error("No matches found");
                }
            });
            return true;
        }
        inputDialogue({title: "Search", placeholder: "Find files", confirmation: (_,query) => {
                const match = createFilesSearchMatches(query, portal)[0];
                if (!previewFilesSearchMatch(match)) modular.error("No matches found");
            }
        });
        return true;
    };
    const refreshFileListRoot = (rootId, options = {}) => {
        const root = document.getElementById(rootId);
        if (root) root.innerHTML = renderFiles(options);
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
    const fileSortButton = id => button({id, style: "small naked float-right hover-zoom", altsync: "F", icon: FILE_SORT_ICON, title: "Sort"});
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
    const deleteNoteFromNotesSection = (noteId, note = {}) => {
        if (!noteId) return;
        const noteLabel = String(note?.created || "note").trim() || "note";
        confirmationDialogue({title: "Delete note", content: `Are you sure you want to delete ${noteLabel}?`, confirmation: () => {
                CLI.send(`[notes] - <id ${noteId}>`).then(response => {
                    if (response === 1) {
                        modular.refresh("com.standard.notes");
                        modular.refresh("com.standard.files");
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
        return {id: noteTile.getAttribute("directive"), created: noteTile.querySelector("em")?.innerText || "View Note", content: noteTile.querySelector(".note-tile-content")?.innerHTML || "", color: noteTile.style.background || window.getComputedStyle(noteTile).getPropertyValue("background-color")};
    };
    const renderNoNotesState = () => div({style: "notes-empty-state", content: children([img({src: "/icons/interfaces/notes.png", style: "notes-empty-icon"}), div({style: "notes-empty-label", content: "No notes"})])});
    const isWhiteboardFilePath = (rawPath = "") => /\.wtb$/i.test(String(rawPath || ""));
    const isSlidesFilePath = (rawPath = "") => /\.slds$/i.test(String(rawPath || ""));
    const isSpreadsheetFilePath = (rawPath = "") => /\.sprdshts$/i.test(String(rawPath || ""));
    const isCodeFilePath = (rawPath = "") => /\.(std|stds)$/i.test(String(rawPath || ""));
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
        modular.refresh("com.standard.files");
        return refreshFilesRecordCache();
    };
    const uploadSelectedFiles = async (fileList, options = {}) => {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        const targetDirectory = getDefaultUploadDirectory();
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
        modular.success(files.length === 1 ? `Uploaded ${files[0]?.name || "file"}` : `Uploaded ${files.length} files`);
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
        const openSheetPayload = await waitForServiceMethod(() => window.StandardSheets?.openSheetPayload, "com.standard.editor.sheet");
        if (!openSheetPayload) return false;
        const download = await downloadFileForOpen(rawPath);
        return openSheetPayload(download.path, JSON.parse(await download.blob.text()), sourceNode);
    };
    const openCodeFileInCodeEditor = async (rawPath = "", sourceNode = null) => {
        const openCodeFilePath = await waitForServiceMethod(() => window.StandardCodeEditor?.openCodeFilePath, "com.standard.editor.code");
        if (!openCodeFilePath) return false;
        const download = await downloadFileForOpen(rawPath);
        return openCodeFilePath(download.path, await download.blob.text(), sourceNode);
    };
    const openPdfInInternalsApp = async (rawPath = "", sourceNode = null) => {
        const openPdfFilePath = await waitForServiceMethod(() => window.StandardInternals?.openPdfFilePath, "com.standard.internals");
        if (!openPdfFilePath) return false;
        return openPdfFilePath(rawPath, sourceNode);
    };
    const openFilePath = async (rawPath = "", sourceNode = null) => {
        if (isWhiteboardFilePath(rawPath)) return openWhiteboardInBoardsApp(rawPath, sourceNode);
        if (isSlidesFilePath(rawPath)) return openSlidesInSlidesApp(rawPath, sourceNode);
        if (isSpreadsheetFilePath(rawPath)) return openSheetInSheetsApp(rawPath, sourceNode);
        if (isCodeFilePath(rawPath)) return openCodeFileInCodeEditor(rawPath, sourceNode);
        if (isTextFilePath(rawPath)) return openFileInInternalsApp(rawPath, sourceNode);
        if (isImageFilePath(rawPath)) return openFileInInternalsApp(rawPath, sourceNode);
        if (isVideoFilePath(rawPath)) return openFileInInternalsApp(rawPath, sourceNode);
        if (isPdfFilePath(rawPath)) return openPdfInInternalsApp(rawPath, sourceNode);
        return openFileInInternalsApp(rawPath, sourceNode);
    };
    window.StandardFiles = window.StandardFiles || {};
    window.StandardFiles.openFilePath = (rawPath = "", sourceNode = null) => openFilePath(rawPath, sourceNode);
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
    const deleteFile = (rawPath, tile = null) => {
        const filePath = getFilePathForRemoveCommand(rawPath);
        if (!filePath) return;
        const fileName = filePath.split("/").pop() || "file";
        CLI.send(CLI.buildFilesCommand("remove", filePath)).then(async response => {
            if (response !== 0 && response !== "false" && response !== false) {
                removeDeletedFileTile(rawPath, tile);
                await refreshFilesRecordCache();
                modular.success(`Deleted ${fileName}`);
            } else {
                modular.error(`Failed to delete ${fileName}`);
            }
        }).catch(() => {
            modular.error(`Failed to delete ${fileName}`);
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
    const createFolderInCurrentDocumentsDirectory = () => {
        const baseDirectory = getFilePathForRemoveCommand(current_documents_directory);
        inputDialogue({title: "New folder", placeholder: "Folder name", confirmation: async (_, folderName) => {
                const trimmedName = String(folderName || "").trim();
                if (!trimmedName) return;
                const targetPath = baseDirectory ? `${String(baseDirectory).replace(/\/+$/, "")}/${trimmedName}` : trimmedName;
                await CLI.send(CLI.buildFilesCommand("folders", targetPath));
                await refreshFilesAfterMutation();
            }
        });
    };
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
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" /></svg>`,
        label: "Open",
        action: (b, e, el) => {
            const path = el.closest(".file-folder")?.getAttribute("directive");
            openFilePath(path, el);
        }
    }, {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>`,
        label: "Rename",
        action: (b, e, el) => {
            const path = el.closest(".file-folder")?.getAttribute("directive");
            renameFile(path);
        }
    }, {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 15 12 19.5 16.5 15m-9-6L12 4.5 16.5 9" /></svg>`,
        label: "Move",
        action: (b, e, el) => {
            const path = el.closest(".file-folder")?.getAttribute("directive");
            showMoveDestinationMenu(path, e);
        }
    }, {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" /></svg>`,
        label: "Download",
        action: (b, e, el) => {
            const path = el.closest(".file-folder")?.getAttribute("directive");
            triggerFileDownload(path);
        }
    }, {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`,
        label: "Delete",
        destructive: true,
        action: (b, e, el) => {
            const tile = el.closest(".file-folder");
            const path = tile?.getAttribute("directive");
            deleteFile(path, tile);
        }
    }];
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
        const response = await fetch(`/api/files/download?path=${encodeURIComponent(filePath)}`);
        if (!response.ok) throw new Error(`Failed to download photo (${response.status})`);
        return response.blob();
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
    const openDirectoryPath = async (rawPath = "") => {
        const directoryPath = String(rawPath || "").trim();
        if (!directoryPath) return false;
        if (typeof modular?.show === "function") modular.show("com.standard.files", 1);
        await navigateDocumentsDirectory(directoryPath);
        return true;
    };
    window.StandardFiles = window.StandardFiles || {};
    window.StandardFiles.openDirectoryPath = (rawPath = "") => openDirectoryPath(rawPath);
    window.StandardFiles.isDirectoryRecord = (file = {}) => isDirectory(file);
    syncUploadDirectory();
    function renderFiles({openDirectories = true} = {}) {
        let as = []
        const files = getSortedWorkingFiles();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            as.push(div({
                style: "padded secondary-tile brick list-item hidden file-folder",
                directive: file.path,
                content: children([img({style: "margined-icon float-left no-events", src: getFileTypeIconPath(file)}), div({content: children([div({style: "no-events", content: file.name}), em({style: "faded no-wrap hidden", content: file.path.replace("/home/standard-system/", "")})])})]),
                onclick: () => {
                    if (!isDirectory(file) || !openDirectories) {
                        openFilePath(file.path);
                        return;
                    }
                    navigateDocumentsDirectory(file.path);
                }
            }));
        }
        return children(as);
    }
    modular.register(new Service("com.standard.files", [new Portal({
        title: "Files",
        hints: ["files"],
        dimensions: [775, 500],
        tools: [{
            title: "Search",
            icon: modular.icons.search,
            onclick: (event, context) => showFilesSearchDialogue(context?.portal, event?.currentTarget)
        }],
        svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" /></svg>`,
        icon: "/icons/interfaces/files.png",
        routes: [{
            text: "Everything",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /></svg>`,
            route: () => div({
                style: "small-padding",
                content: children([fileSortButton("everything-sort", "all-files", {openDirectories: false}), h({level: 3, content: "Everything"}), div({style: "spacer"}), div({
                    id: "all-files", menu: "file", content: () => {
                        return CLI.send("[files]").then(everything => {
                            working_files = everything.files;
                            return renderFiles({openDirectories: false});
                        })
                    }
                })])
            }),
            afterRender: () => {
                bindFileSortButton("everything-sort", "all-files", {openDirectories: false});
                document.querySelectorAll("#all-files").forEach((el) => el.contextmenu(createFileMenuItems()));
            }
        }, {
            text: "Documents",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>`,
            route: (_, view) => div({content: children([
                    div({content: children([
                            div({style: "float-left margin-right", content: children([
                                    button({id: "documents-nav-back", style: "small naked hover-zoom", disabled: true, icon: `<svg class="smaller-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>`}),
                                    button({id: "documents-nav-forward", style: "small naked hover-zoom", disabled: true, icon: `<svg class="smaller-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>`})
                                ])
                            }),
                            fileSortButton("documents-sort", "documents"), button({
                                id: "documents-create-folder",
                                style: "small naked float-right hover-zoom",
                                icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`,
                                title: "New folder"
                            }),
                            h({level: 3, id: "documents-title", style: "very-small-padding-top padding-left", content: "Documents"})
                        ])
                    }), div({style: "spacer"}), div({
                        id: "documents", content: () => {
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
                updateDocumentsHeader();
                document.querySelectorAll("#documents").forEach((el) => el.contextmenu(createFileMenuItems()));
            }
        }, {
            text: "Notes",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z" /></svg>`,
            route: () => div({
                style: "small-padding-right", content: children([div({
                    style: "masonry", id: "notes", content: () => {
                        return CLI.send("[notes]").then(d => {
                            const notes = d === 0 ? [] : d.notes;
                            if (!Array.isArray(notes)) throw new Error("Invalid notes response");
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
                                    content: children([button({style: "naked inner-radius float-right expose no-padding small-padding",
                                        icon: `<svg class="tiny-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>`,
                                        onclick: () => openNoteEditorInNotesApp(notes[i])
                                    }), button({style: "naked inner-radius float-right expose no-padding small-padding",
                                        icon: `<svg class="tiny-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`,
                                        onclick: () => deleteNoteFromNotesSection(notes[i].id, notes[i])
                                    }), div({style: "note-tile-content", content: sanitizeNoteMarkup(normalizeNoteContent(notes[i].content))}), em({
                                        style: "smaller faded no-wrap",
                                        content: notes[i].created
                                    })])
                                }))
                            }
                            return children(as);
                        })
                    }
                }), button({
                    style: "secondary primary-action round hover-zoom",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`,
                    onclick: () => modular.show("com.standard.notes", 1)
                }),])
            }),
            afterRender: () => {
                const notesRoot = document.getElementById("notes");
                bindNoteImageViewer(notesRoot);
                document.querySelectorAll("#notes").forEach((el) => el.contextmenu([{
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" /></svg>`,
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
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>`,
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
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`,
                    label: "Delete",
                    destructive: true,
                    action: (b, e, target) => {
                        const note = getNoteFromTile(target);
                        deleteNoteFromNotesSection(note?.id, note);
                    }
                }]))
            }
        }, {
            text: "Photos",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"/></svg>`,
            route: (_, context) => {
                setActiveUploadDirectory("Photos");
                return div({
                    style: "small-padding-right",
                    content: children([h({level: 3, content: "Photos"}), div({style: "spacer"}), div({
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
                                    onclick: event => openPhotoInImageViewer(photo.path, event?.target),
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
                const applyPhotoCascadeLayout = () => {
                    if (photosRoot) photosRoot.style.columnGap = "0.75rem";
                    const photoTiles = photosRoot?.querySelectorAll?.(".file-folder") || [];
                    photoTiles.forEach(tile => {
                        tile.style.display = "inline-block";
                        tile.style.width = "100%";
                        tile.style.marginBottom = "0.75rem";
                        tile.style.breakInside = "avoid";
                        tile.style.aspectRatio = "auto";
                        tile.style.overflow = "hidden";
                        tile.style.borderRadius = "var(--radius)";
                    });
                    const photoImages = photosRoot?.querySelectorAll?.(".file-folder img") || [];
                    photoImages.forEach(image => {
                        image.style.height = "auto";
                        image.style.objectFit = "contain";
                        image.style.display = "block";
                    });
                };
                applyPhotoCascadeLayout();
                if (photoCascadeObserver) {
                    photoCascadeObserver.disconnect();
                    photoCascadeObserver = null;
                }
                if (photosRoot) {
                    photoCascadeObserver = new MutationObserver(() => applyPhotoCascadeLayout());
                    photoCascadeObserver.observe(photosRoot, {childList: true, subtree: true});
                }
                document.querySelectorAll("#photos").forEach((el) => el.contextmenu([{
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>`,
                    label: "Rename",
                    action: (b, e, target) => {
                        const path = target.closest(".file-folder")?.getAttribute("directive");
                        renameFile(path);
                    }
                }, {
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" /></svg>`,
                    label: "Download",
                    action: (b, e, target) => {
                        const path = target.closest(".file-folder")?.getAttribute("directive");
                        triggerFileDownload(path);
                    }
                }, {
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`,
                    label: "Delete",
                    destructive: true,
                    action: (b, e, target) => {
                        const tile = target.closest(".file-folder");
                        const path = tile?.getAttribute("directive");
                        deleteFile(path, tile);
                    }
                }]));
            }
        }, {
            text: "Music",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z" /></svg>`,
            route: () => div({}),
        }, {
            text: "Videos",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>`,
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
                                    onclick: event => openVideoInVideoViewer(video.path, event?.target),
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
                document.querySelectorAll("#videos").forEach((el) => el.contextmenu([{
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" /></svg>`,
                    label: "Open",
                    action: (b, e, target) => {
                        const path = target.closest(".file-folder")?.getAttribute("directive");
                        openVideoInVideoViewer(path, target);
                    }
                }, {
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>`,
                    label: "Rename",
                    action: (b, e, target) => {
                        const path = target.closest(".file-folder")?.getAttribute("directive");
                        renameFile(path);
                    }
                }, {
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" /></svg>`,
                    label: "Download",
                    action: (b, e, target) => {
                        const path = target.closest(".file-folder")?.getAttribute("directive");
                        triggerFileDownload(path);
                    }
                }, {
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`,
                    label: "Delete",
                    destructive: true,
                    action: (b, e, target) => {
                        const tile = target.closest(".file-folder");
                        const path = tile?.getAttribute("directive");
                        deleteFile(path, tile);
                    }
                }]));
            }
        }, {
            text: "Upload",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" /></svg>`,
            route: div({
                style: "padded",
                content: children([h({level: 3, content: "Upload Files"}), div({style: "spacer"}), div({
                    content: children([button({
                        content: "Browse Device", onclick: _ => {
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
                    })])
                }), div({style: "spacer"}), em({style: "faded", content: "Max file upload size is 1 GB"})])
            })
        }]
    })]))
    window.addEventListener("beforeunload", () => {
        if (photoCascadeObserver) {
            photoCascadeObserver.disconnect();
            photoCascadeObserver = null;
        }
        revokePhotoObjectUrls();
    });
})();
