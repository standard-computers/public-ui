(async () => {
    let activeBoardName = "";
    let boardOperations = [];
    let boardViewport = {scale: 1, translate: {x: 0, y: 0}};
    let refreshBoardsList = null;
    let syncEditorState = null;
    let activeOpenProgressToken = 0;
    const getBoardPathForDownload = (rawPath = "") => String(rawPath || "").replace(/^\/home\/standard-system\//, "").replace(/^\/+/, "");
    const ensureFileOpenProgress = () => {
        let root = document.getElementById("file-open-progress");
        if (root) return root;
        root = document.createElement("div");
        root.id = "file-open-progress";
        root.className = "file-open-progress";
        root.innerHTML = `
            <div class="file-open-progress-header">
                <div class="file-open-progress-label">Opening file</div>
                <div class="file-open-progress-value">0%</div>
            </div>
            <div class="file-open-progress-track" aria-hidden="true">
                <div class="file-open-progress-bar"></div>
            </div>
        `;
        document.body.appendChild(root);
        return root;
    };
    const updateFileOpenProgress = ({label = "Opening file", loaded = 0, total = 0, indeterminate = false, token = 0} = {}) => {
        if (token && token !== activeOpenProgressToken) return;
        const root = ensureFileOpenProgress();
        const labelNode = root.querySelector(".file-open-progress-label");
        const valueNode = root.querySelector(".file-open-progress-value");
        const barNode = root.querySelector(".file-open-progress-bar");
        const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((loaded / total) * 100))) : 0;
        if (labelNode) labelNode.textContent = label;
        if (valueNode) valueNode.textContent = indeterminate ? "Loading" : `${percent}%`;
        root.classList.toggle("indeterminate", !!indeterminate);
        if (barNode && !indeterminate) barNode.style.width = `${percent}%`;
        root.classList.add("show");
    };
    const hideFileOpenProgress = token => {
        if (token && token !== activeOpenProgressToken) return;
        const root = document.getElementById("file-open-progress");
        if (!root) return;
        root.classList.remove("show");
    };
    const downloadBoardForOpen = async (rawPath = "") => {
        const boardPath = getBoardPathForDownload(rawPath);
        if (!boardPath) throw new Error("Board path is required");
        const token = ++activeOpenProgressToken;
        const fileName = boardPath.split("/").pop() || "board";
        updateFileOpenProgress({label: `Opening ${fileName}`, loaded: 0, total: 0, indeterminate: true, token});
        try {
            const response = await fetch(`/api/files/download?path=${encodeURIComponent(boardPath)}`);
            if (!response.ok) throw new Error("Unable to read board file");
            const total = Number(response.headers.get("content-length")) || 0;
            if (!response.body || typeof response.body.getReader !== "function") {
                const blob = await response.blob();
                updateFileOpenProgress({label: `Opening ${fileName}`, loaded: total || blob.size, total: total || blob.size || 1, indeterminate: false, token});
                return {boardPath, fileName, blob, token};
            }
            const reader = response.body.getReader();
            const chunks = [];
            let loaded = 0;
            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                if (!value) continue;
                chunks.push(value);
                loaded += value.byteLength || value.length || 0;
                updateFileOpenProgress({label: `Opening ${fileName}`, loaded, total, indeterminate: !(total > 0), token});
            }
            const blob = new Blob(chunks, {type: response.headers.get("content-type") || "application/octet-stream"});
            updateFileOpenProgress({label: `Opening ${fileName}`, loaded: total || blob.size, total: total || blob.size || 1, indeterminate: false, token});
            return {boardPath, fileName, blob, token};
        } catch (error) {
            hideFileOpenProgress(token);
            throw error;
        }
    };
    const isBoardsWindow = node => {
        if (!(node instanceof HTMLElement) || !node.classList.contains("draggable-window")) return false;
        const title = node.querySelector(".window-header .title")?.textContent || "";
        return title.trim().toLowerCase() === "boards";
    };
    const getBoardsWindow = () => {
        const windows = Array.from(document.querySelectorAll(".draggable-window")).filter(isBoardsWindow);
        return windows[windows.length - 1] || null;
    };
    const ensureBoardsWindow = async () => {
        const existingWindow = getBoardsWindow();
        if (existingWindow) return existingWindow;
        if (typeof modular?.start === "function") modular.start("com.standard.boards");
        for (let attempt = 0; attempt < 20; attempt++) {
            const boardsWindow = getBoardsWindow();
            if (boardsWindow) return boardsWindow;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return null;
    };
    const focusBoardsEditor = (boardsWindow, retries = 5) => {
        requestAnimationFrame(() => {
            const canvas = boardsWindow?.querySelector?.("#canvas");
            if (canvas) {
                canvas.focus();
                return;
            }
            if (retries > 0) focusBoardsEditor(boardsWindow, retries - 1);
        });
    };
    const getBoardsWindowFromSource = sourceNode => {
        const sourceWindow = sourceNode?.closest?.(".draggable-window");
        if (isBoardsWindow(sourceWindow)) return sourceWindow;
        return getBoardsWindow();
    };
    const openBoardsEditorRoute = sourceNode => {
        const boardsWindow = getBoardsWindowFromSource(sourceNode);
        const editorRoute = Array.from(boardsWindow?.querySelectorAll?.(".sidebar-item") || []).find(node => {
            const routeName = node.querySelector("span")?.innerText || "";
            const normalizedRouteName = routeName.trim().toLowerCase();
            return normalizedRouteName === "editor" || normalizedRouteName === "edit" || normalizedRouteName === "create";
        });
        editorRoute?.click?.();
        focusBoardsEditor(boardsWindow);
    };
    const syncOrOpenBoardsEditor = sourceNode => {
        const boardsWindow = getBoardsWindowFromSource(sourceNode);
        const sourceWindowHasCanvas = !!boardsWindow?.querySelector?.("#canvas");
        const activeCanvas = document.getElementById("canvas");
        if (!sourceWindowHasCanvas && boardsWindow) {
            openBoardsEditorRoute(sourceNode);
            return;
        }
        if (typeof syncEditorState === "function" && activeCanvas?.isConnected) {
            syncEditorState();
            focusBoardsEditor(boardsWindow);
            return;
        }
        openBoardsEditorRoute(sourceNode);
    };
    const applyBoardData = async (rawPath = "", boardData = {}, sourceNode = null) => {
        const boardPath = getBoardPathForDownload(rawPath);
        if (!boardPath) return false;
        await ensureBoardsWindow();
        boardOperations = Array.isArray(boardData?.operations) ? boardData.operations : [];
        boardViewport = {
            scale: Number(boardData?.viewport?.scale) || 1,
            translate: {x: Number(boardData?.viewport?.translate?.x) || 0, y: Number(boardData?.viewport?.translate?.y) || 0}
        };
        activeBoardName = sanitizeBoardName(boardData?.boardName || boardPath.split("/").pop().replace(/\.wtb$/i, ""));
        syncOrOpenBoardsEditor(sourceNode);
        return true;
    };
    const openBoardPath = async (rawPath = "", sourceNode = null) => {
        const boardPath = getBoardPathForDownload(rawPath);
        if (!boardPath) return false;
        try {
            const download = await downloadBoardForOpen(boardPath);
            updateFileOpenProgress({label: `Opening ${download.fileName}`, loaded: download.blob.size || 1, total: download.blob.size || 1, indeterminate: false, token: download.token});
            const opened = await applyBoardData(boardPath, JSON.parse(await download.blob.text()), sourceNode);
            window.setTimeout(() => hideFileOpenProgress(download.token), 220);
            return opened;
        } catch (_) {
            modular.error("Failed to open board");
            return false;
        }
    };
    window.StandardBoards = window.StandardBoards || {};
    window.StandardBoards.openBoardPath = (rawPath = "", sourceNode = null) => openBoardPath(rawPath, sourceNode);
    window.StandardBoards.openBoardData = (rawPath = "", boardData = {}, sourceNode = null) => applyBoardData(rawPath, boardData, sourceNode);
    const resetBoardState = () => {
        activeBoardName = "";
        boardOperations = [];
        boardViewport = {scale: 1, translate: {x: 0, y: 0}};
    };
    const openFreshBoardInCurrentWindow = sourceNode => {
        resetBoardState();
        syncOrOpenBoardsEditor(sourceNode);
    };
    const openFreshBoardInNewWindow = async (sourceNode, routeContext = null) => {
        resetBoardState();
        if (routeContext?.struct) {
            const clone = new Portal({...routeContext.struct, serviceId: "com.standard.boards", portalIndex: 0});
            clone.show();
        } else if (typeof modular?.start === "function") {
            modular.start("com.standard.boards");
        }
        const boardsWindow = await ensureBoardsWindow();
        openBoardsEditorRoute(boardsWindow || sourceNode);
    };
    const openNewBoardMenu = (event, routeContext) => {
        const trigger = event?.currentTarget;
        if (!(trigger instanceof HTMLElement)) return;
        const existingMenu = document.getElementById("new-board-popout-menu");
        if (existingMenu) existingMenu.remove();
        const menu = document.createElement("div");
        menu.id = "new-board-popout-menu";
        menu.className = "custom-context-menu";
        const options = [{
            label: "This Window",
            action: () => openFreshBoardInCurrentWindow(routeContext?.window || trigger)
        }, {
            label: "New Window",
            action: () => openFreshBoardInNewWindow(routeContext?.window || trigger, routeContext)
        }];
        options.forEach(option => {
            const menuItem = document.createElement("div");
            menuItem.className = "context-menu-item";
            menuItem.textContent = option.label;
            menuItem.onclick = clickEvent => {
                clickEvent.stopPropagation();
                menu.remove();
                option.action();
            };
            menu.appendChild(menuItem);
        });
        document.body.appendChild(menu);
        const x = event?.clientX ?? trigger.getBoundingClientRect().left;
        const y = event?.clientY ?? trigger.getBoundingClientRect().bottom;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) menu.style.left = `${Math.max(8, x - rect.width)}px`;
            if (rect.bottom > window.innerHeight) menu.style.top = `${Math.max(8, y - rect.height)}px`;
        });
        const closeMenu = closeEvent => {
            if (!menu.contains(closeEvent.target) && closeEvent.target !== trigger) {
                menu.remove();
                document.removeEventListener("click", closeMenu);
            }
        };
        setTimeout(() => document.addEventListener("click", closeMenu), 0);
    };
    const sanitizeBoardName = (raw = "") => {
        const cleaned = String(raw || "").trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
        return cleaned.replace(/\.wtb$/i, "");
    };
    const getBoardFilePath = rawPath => getBoardPathForDownload(rawPath);
    const getBoardFileName = rawPath => {
        const boardPath = getBoardFilePath(rawPath);
        return boardPath.split("/").pop() || "";
    };
    const renameBoardFile = rawPath => {
        const boardPath = getBoardFilePath(rawPath);
        if (!boardPath) return;
        const currentName = getBoardFileName(boardPath);
        const currentBoardName = sanitizeBoardName(currentName);
        inputDialogue({
            title: "Rename board",
            placeholder: "Board name",
            value: currentBoardName,
            confirmation: async (_, renamed) => {
                const nextBoardName = sanitizeBoardName(renamed);
                if (!nextBoardName) {
                    modular.error("Board name is required");
                    return;
                }
                const nextFileName = `${nextBoardName}.wtb`;
                if (nextFileName === currentName) return;
                const basePath = boardPath.includes("/") ? boardPath.substring(0, boardPath.lastIndexOf("/")) : "";
                const targetPath = basePath ? `${basePath}/${nextFileName}` : nextFileName;
                try {
                    await CLI.send(CLI.buildFilesCommand("move", boardPath, targetPath));
                    if (sanitizeBoardName(activeBoardName) === currentBoardName) activeBoardName = nextBoardName;
                    if (typeof refreshBoardsList === "function") refreshBoardsList();
                } catch (_) {
                    modular.error("Unable to rename board");
                }
            }
        });
    };
    const deleteBoardFile = rawPath => {
        const boardPath = getBoardFilePath(rawPath);
        if (!boardPath) return;
        const boardName = sanitizeBoardName(getBoardFileName(boardPath)) || "this board";
        confirmationDialogue({
            title: "Delete board",
            content: `You're sure you want to delete ${boardName}?`,
            confirmation: async () => {
                try {
                    await CLI.send(CLI.buildFilesCommand("remove", boardPath));
                    if (typeof refreshBoardsList === "function") refreshBoardsList();
                } catch (_) {
                    modular.error("Unable to delete board");
                }
            }
        });
    };
    const buildBoardPayload = (canvas = null) => ({
        format: "std.boards.v1",
        boardName: activeBoardName,
        updatedAt: new Date().toISOString(),
        canvas: {width: canvas?.width || 0, height: canvas?.height || 0},
        viewport: boardViewport,
        operations: boardOperations
    });
    const shapeIcon = `<svg class="small-icon text-color" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><rect x="3.75" y="4.5" width="7.5" height="7.5" rx="1.25" /><circle cx="16.75" cy="8.25" r="3.75" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 19.5h12l-6-6-6 6Z" /></svg>`;
    const boardShapeOptions = [{
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
    const saveBoardToBoardsFolder = async (boardName, canvas = null) => {
        const fileName = `${boardName}.wtb`;
        const payload = buildBoardPayload(canvas);
        const serializedBoard = JSON.stringify(payload);
        const bytes = new TextEncoder().encode(serializedBoard);
        const boardFile = new File([bytes], fileName, {type: "application/octet-stream"});
        const uploadUrl = "/api/upload?directory=Boards";
        if (typeof window.StandardUploads?.uploadFile === "function") {
            const response = await window.StandardUploads.uploadFile(boardFile, uploadUrl, {
                label: `Saving ${fileName}`
            });
            if (!response?.ok) throw new Error(`Unable to save board (${response?.status || 0})`);
            return {fileName, byteCount: bytes.length, response: response.responseText || ""};
        }
        const formData = new FormData();
        formData.append("file", boardFile);
        const res = await fetch(uploadUrl, {method: "POST", body: formData});
        if (!res.ok) throw new Error(`Unable to save board (${res.status})`);
        return {fileName, byteCount: bytes.length, response: await res.text()};
    };
    const getBoardsCanvas = sourceNode => {
        const boardsWindow = getBoardsWindowFromSource(sourceNode);
        return boardsWindow?.querySelector?.("#canvas") || document.getElementById("canvas") || null;
    };
    const triggerBoardSave = sourceNode => {
        const doSave = boardName => {
            saveBoardToBoardsFolder(boardName, getBoardsCanvas(sourceNode)).then(result => {
                activeBoardName = boardName;
                if (typeof refreshBoardsList === "function") refreshBoardsList();
                modular.success(`Saved Boards/${result.fileName} (${result.byteCount} bytes)`);
            }).catch(error => {
                modular.error(error.message || "Board save failed");
            });
        };
        if (!activeBoardName) {
            inputDialogue({
                title: "Board name",
                placeholder: "e.g. roadmap_q1",
                confirmation: (_, boardTitle) => {
                    const boardName = sanitizeBoardName(boardTitle);
                    if (!boardName) {
                        modular.error("Board name is required");
                        return;
                    }
                    doSave(boardName);
                }
            });
            return;
        }
        doSave(activeBoardName);
    };
    const renderNoBoardsState = () => div({style: "boards-empty-state", content: children([
        img({src: "/icons/interfaces/whiteboard.png", style: "boards-empty-icon"}),
        div({style: "boards-empty-label", content: "No boards"})
    ])});
    const renderBoards = async () => {
        try {
            const tree = await CLI.send("tree Boards");
            if (tree === 0) return renderNoBoardsState();
            const boards = Array.isArray(tree?.children) ? tree.children.filter(file => !file?.children && /\.wtb$/i.test(file?.name || "")) : [];
            if (!boards.length) return renderNoBoardsState();
            return children(boards.map(board => div({
                style: "padded radius pointer hidden board-file hover-background hover-shadowed center",
                directive: board.path,
                content: children([
                    img({style: "large-icon no-events brick tiny-margin-left contained", src: "/icons/wtb.png"}),
                    div({style: "brick margin-top", content: board.name})
                ])
            })));
        } catch (_) {
            return div({style: "small-padding faded", content: "Boards folder not available yet."});
        }
    };
    modular.register(new Service("com.standard.boards", [
        new Portal({
            title: "Boards",
            hints: ["boards", "whiteboards"],
            dimensions: [900, 650],
            horizontal_nav: true,
            centered_nav: true,
            tools: [{
                title: "Save",
                icon: modular.icons.save,
                onclick: (_, routeContext) => {
                    triggerBoardSave(routeContext?.window || routeContext?.struct?.body || null);
                }
            }, {
                title: "New Board",
                icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`,
                onclick: (event, routeContext) => {
                    openNewBoardMenu(event, routeContext);
                }
            }],
            svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" /></svg>`,
            icon: "/icons/interfaces/whiteboard.png",
            routes: [
                {
                    text: "Edit",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" /></svg>`,
                    route: () => div({style: "relative hidden large-padding-top", id: "boards-editor-root", content: children([
                            div({style: "bordered radius shadowed", id: "boards-canvas-frame", content: () => {
                                    const container = document.createElement("div");
                                    const canvas = document.createElement("canvas");
                                    container.id = "boards-canvas-container";
                                    container.style.position = "relative";
                                    container.style.overflow = "hidden";
                                    container.style.width = "100%";
                                    container.style.height = "100%";
                                    container.style.minHeight = "432px";
                                    canvas.id = "canvas";
                                    canvas.tabIndex = 0;
                                    canvas.width = 770;
                                    canvas.height = 432;
                                    canvas.style.position = "absolute";
                                    canvas.style.left = "0";
                                    canvas.style.top = "0";
                                    canvas.style.display = "block";
                                    canvas.style.transformOrigin = "0 0";
                                    container.appendChild(canvas);
                                    return container;
                                }}),
                            div({style: "absolute left bottomed bordered radius shadowed no-padding align-top small-padding-top small-padding-left small-padding-right center blurred", id: "boards-toolbar", content: children([
                                    div({style: "color-block pointer hover-zoom cube inline background-red radius", content: div({style: ""})}),
                                    div({style: "color-block pointer hover-zoom cube inline background-orange radius", content: div({style: ""})}),
                                    div({style: "color-block pointer hover-zoom cube inline background-yellow radius", content: div({style: ""})}),
                                    div({style: "color-block pointer hover-zoom cube inline background-green radius", content: div({style: ""})}),
                                    div({style: "color-block pointer hover-zoom cube inline background-blue radius", content: div({style: ""})}),
                                    div({style: "color-block pointer hover-zoom cube inline background-indigo radius", content: div({style: ""})}),
                                    div({style: "color-block pointer hover-zoom cube inline background-violet radius", content: div({style: ""})}),
                                    div({style: "color-block pointer hover-zoom cube inline background-pink radius", content: div({style: ""})}),
                                    button({style: "undecorated hover-background inner-radius float-right no-padding small-space-right adjust-top", data: "action-clear", icon: `<svg class="small-icon text-color" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`}),
                                    button({style: "undecorated hover-background inner-radius float-right no-padding small-space-right adjust-top", data: "action-shapes", icon: shapeIcon}),
                                    button({style: "undecorated hover-background inner-radius float-right no-padding small-space-right adjust-top", data: "action-attach", icon: `<svg class="small-icon text-color" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" /></svg>`}),
                                    button({style: "undecorated hover-background inner-radius float-right no-padding small-space-right adjust-top tool-button", data: "tool-select", icon: `<svg class="small-icon text-color" xmlns="http://www.w3.org/2000/svg"  viewBox="0 0 50 50"><path d="M 14.78125 5 C 14.75 5.007813 14.71875 5.019531 14.6875 5.03125 C 14.644531 5.050781 14.601563 5.070313 14.5625 5.09375 C 14.550781 5.09375 14.542969 5.09375 14.53125 5.09375 C 14.511719 5.101563 14.488281 5.113281 14.46875 5.125 C 14.457031 5.136719 14.449219 5.144531 14.4375 5.15625 C 14.425781 5.167969 14.417969 5.175781 14.40625 5.1875 C 14.375 5.207031 14.34375 5.226563 14.3125 5.25 C 14.289063 5.269531 14.269531 5.289063 14.25 5.3125 C 14.238281 5.332031 14.226563 5.355469 14.21875 5.375 C 14.183594 5.414063 14.152344 5.457031 14.125 5.5 C 14.113281 5.511719 14.105469 5.519531 14.09375 5.53125 C 14.09375 5.542969 14.09375 5.550781 14.09375 5.5625 C 14.082031 5.582031 14.070313 5.605469 14.0625 5.625 C 14.050781 5.636719 14.042969 5.644531 14.03125 5.65625 C 14.03125 5.675781 14.03125 5.699219 14.03125 5.71875 C 14.019531 5.757813 14.007813 5.800781 14 5.84375 C 14 5.875 14 5.90625 14 5.9375 C 14 5.949219 14 5.957031 14 5.96875 C 14 5.980469 14 5.988281 14 6 C 13.996094 6.050781 13.996094 6.105469 14 6.15625 L 14 39 C 14.003906 39.398438 14.242188 39.757813 14.609375 39.914063 C 14.972656 40.070313 15.398438 39.992188 15.6875 39.71875 L 22.9375 32.90625 L 28.78125 46.40625 C 28.890625 46.652344 29.09375 46.847656 29.347656 46.941406 C 29.601563 47.035156 29.882813 47.023438 30.125 46.90625 L 34.5 44.90625 C 34.996094 44.679688 35.21875 44.09375 35 43.59375 L 28.90625 30.28125 L 39.09375 29.40625 C 39.496094 29.378906 39.84375 29.113281 39.976563 28.730469 C 40.105469 28.347656 39.992188 27.921875 39.6875 27.65625 L 15.84375 5.4375 C 15.796875 5.378906 15.746094 5.328125 15.6875 5.28125 C 15.648438 5.234375 15.609375 5.195313 15.5625 5.15625 C 15.550781 5.15625 15.542969 5.15625 15.53125 5.15625 C 15.511719 5.132813 15.492188 5.113281 15.46875 5.09375 C 15.457031 5.09375 15.449219 5.09375 15.4375 5.09375 C 15.386719 5.070313 15.335938 5.046875 15.28125 5.03125 C 15.269531 5.03125 15.261719 5.03125 15.25 5.03125 C 15.230469 5.019531 15.207031 5.007813 15.1875 5 C 15.175781 5 15.167969 5 15.15625 5 C 15.136719 5 15.113281 5 15.09375 5 C 15.082031 5 15.074219 5 15.0625 5 C 15.042969 5 15.019531 5 15 5 C 14.988281 5 14.980469 5 14.96875 5 C 14.9375 5 14.90625 5 14.875 5 C 14.84375 5 14.8125 5 14.78125 5 Z M 16 8.28125 L 36.6875 27.59375 L 27.3125 28.40625 C 26.992188 28.4375 26.707031 28.621094 26.546875 28.902344 C 26.382813 29.179688 26.367188 29.519531 26.5 29.8125 L 32.78125 43.5 L 30.21875 44.65625 L 24.21875 30.8125 C 24.089844 30.515625 23.828125 30.296875 23.511719 30.230469 C 23.195313 30.160156 22.863281 30.25 22.625 30.46875 L 16 36.6875 Z"/></svg>`}),
                                    button({style: "undecorated hover-background inner-radius float-right no-padding small-space-right adjust-top tool-button", data: "tool-erase", icon: `<svg class="small-icon text-color" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 15.75 7.72-7.72a2.25 2.25 0 0 1 3.18 0l2.57 2.57a2.25 2.25 0 0 1 0 3.18l-5.47 5.47H7.5l-3-3Z" /><path stroke-linecap="round" stroke-linejoin="round" d="m9 11.25 5.25 5.25M12.5 19.25H20" /></svg>`}),
                                    button({style: "undecorated hover-background inner-radius float-right no-padding small-space-right adjust-top tool-button", data: "tool-draw", icon: `<svg class="small-icon text-color" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" /></svg>`}),
                                    button({style: "undecorated hover-background inner-radius float-right no-padding small-space-right adjust-top tool-button", data: "tool-drag", icon: `<svg class="small-icon text-color" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M10.05 4.575a1.575 1.575 0 1 0-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 0 1 3.15 0v1.5m-3.15 0 .075 5.925m3.075.75V4.575m0 0a1.575 1.575 0 0 1 3.15 0V15M6.9 7.575a1.575 1.575 0 1 0-3.15 0v8.175a6.75 6.75 0 0 0 6.75 6.75h2.018a5.25 5.25 0 0 0 3.712-1.538l1.732-1.732a5.25 5.25 0 0 0 1.538-3.712l.003-2.024a.668.668 0 0 1 .198-.471 1.575 1.575 0 1 0-2.228-2.228 3.818 3.818 0 0 0-1.12 2.687M6.9 7.575V12m6.27 4.318A4.49 4.49 0 0 1 16.35 15m.002 0h-.002" /></svg>`})
                                ])})
                        ])}),
                    afterRender: (windowBody) => {
                        const canvas = windowBody.querySelector("#canvas");
                        if (!canvas) return;
                        const editorRoot = windowBody.querySelector("#boards-editor-root");
                        const canvasFrame = windowBody.querySelector("#boards-canvas-frame");
                        const canvasContainer = windowBody.querySelector("#boards-canvas-container");
                        const toolbar = windowBody.querySelector("#boards-toolbar");
                        if (!editorRoot || !canvasFrame || !canvasContainer) return;
                        const isExistingEditor = windowBody.__boardsCanvasElement === canvas;
                        if (isExistingEditor) {
                            windowBody.__boardsSyncCanvasLayout?.();
                            requestAnimationFrame(() => canvas.focus());
                            return;
                        }
                        windowBody.__boardsResizeObserver?.disconnect?.();
                        windowBody.__boardsCanvasElement = canvas;
                        const ctx = canvas.getContext("2d");
                        const attachInput = document.createElement("input");
                        attachInput.type = "file";
                        attachInput.accept = "image/*";
                        attachInput.style.display = "none";
                        windowBody.appendChild(attachInput);
                        let drawing = false;
                        let currentStroke = null;
                        let pickedColor = "#000000";
                        let tool = "draw";
                        let scale = boardViewport.scale || 1;
                        let translate = {x: boardViewport.translate?.x || 0, y: boardViewport.translate?.y || 0};
                        let canvasOrigin = {x: 0, y: 0};
                        let isDragging = false;
                        let dragStart = {x: 0, y: 0};
                        let selectedOperationIndex = -1;
                        let contextShapeIndex = -1;
                        let selectionAction = null;
                        const resizeHandleSize = 12;
                        const canvasGrowthPadding = 512;
                        const readPixelValue = value => {
                            const parsed = Number.parseFloat(String(value ?? "0"));
                            return Number.isFinite(parsed) ? parsed : 0;
                        };
                        const getViewportSize = () => {
                            const containerRect = canvas.parentElement?.getBoundingClientRect?.();
                            return {width: Math.max(1, Math.round(containerRect?.width || 770)), height: Math.max(1, Math.round(containerRect?.height || 432))};
                        };
                        const resizeCanvasSurface = (width, height) => {
                            const nextWidth = Math.max(1, Math.ceil(width));
                            const nextHeight = Math.max(1, Math.ceil(height));
                            if (canvas.width === nextWidth && canvas.height === nextHeight) return false;
                            canvas.width = nextWidth;
                            canvas.height = nextHeight;
                            return true;
                        };
                        const ensureCanvasCoverage = () => {
                            const viewportSize = getViewportSize();
                            const visibleLeft = (-translate.x) / scale;
                            const visibleTop = (-translate.y) / scale;
                            const visibleRight = visibleLeft + (viewportSize.width / scale);
                            const visibleBottom = visibleTop + (viewportSize.height / scale);
                            let nextOriginX = canvasOrigin.x;
                            let nextOriginY = canvasOrigin.y;
                            let nextWidth = canvas.width;
                            let nextHeight = canvas.height;
                            if (visibleLeft < nextOriginX) {
                                const growLeft = Math.ceil(nextOriginX - visibleLeft) + canvasGrowthPadding;
                                nextOriginX -= growLeft;
                                nextWidth += growLeft;
                            }
                            if (visibleTop < nextOriginY) {
                                const growTop = Math.ceil(nextOriginY - visibleTop) + canvasGrowthPadding;
                                nextOriginY -= growTop;
                                nextHeight += growTop;
                            }
                            if (visibleRight > nextOriginX + nextWidth) nextWidth = Math.ceil(visibleRight - nextOriginX) + canvasGrowthPadding;
                            if (visibleBottom > nextOriginY + nextHeight) nextHeight = Math.ceil(visibleBottom - nextOriginY) + canvasGrowthPadding;
                            const resized = resizeCanvasSurface(nextWidth, nextHeight);
                            const originChanged = nextOriginX !== canvasOrigin.x || nextOriginY !== canvasOrigin.y;
                            canvasOrigin = {x: nextOriginX, y: nextOriginY};
                            return resized || originChanged;
                        };
                        const persistViewport = () => {
                            boardViewport = {scale, translate: {...translate}};
                        };
                        const syncCanvasLayout = () => {
                            const rootStyles = getComputedStyle(editorRoot);
                            const frameStyles = getComputedStyle(canvasFrame);
                            const rootPaddingTop = readPixelValue(rootStyles.paddingTop);
                            const rootPaddingBottom = readPixelValue(rootStyles.paddingBottom);
                            const rootPaddingLeft = readPixelValue(rootStyles.paddingLeft);
                            const rootPaddingRight = readPixelValue(rootStyles.paddingRight);
                            const bodyHeight = Math.max(1, Math.floor(windowBody.clientHeight || 0));
                            const bodyWidth = Math.max(1, Math.floor(windowBody.clientWidth || 0));
                            editorRoot.style.width = "100%";
                            editorRoot.style.height = `${Math.max(1, bodyHeight - 20)}px`;
                            editorRoot.style.minHeight = `${Math.max(1, bodyHeight - 20)}px`;
                            editorRoot.style.boxSizing = "border-box";
                            canvasFrame.style.boxSizing = "border-box";
                            const rootInnerWidth = Math.max(1, bodyWidth - rootPaddingLeft - rootPaddingRight);
                            const rootInnerHeight = Math.max(1, bodyHeight - rootPaddingTop - rootPaddingBottom);
                            const frameMarginLeft = readPixelValue(frameStyles.marginLeft);
                            const frameMarginRight = readPixelValue(frameStyles.marginRight);
                            const frameMarginTop = readPixelValue(frameStyles.marginTop);
                            const frameMarginBottom = readPixelValue(frameStyles.marginBottom);
                            const desiredToolbarBottomOffset = 20;
                            if (toolbar) {
                                toolbar.style.bottom = `${desiredToolbarBottomOffset}px`;
                                toolbar.style.transform = "";
                                toolbar.style.zIndex = "2";
                            }
                            const reservedBottom = Math.max(frameMarginBottom, 8);
                            const availableWidth = Math.max(240, Math.floor(rootInnerWidth - frameMarginLeft - frameMarginRight - 24));
                            const availableHeight = Math.max(180, Math.floor(rootInnerHeight - frameMarginTop - reservedBottom - 20));
                            canvasFrame.style.width = `${availableWidth}px`;
                            canvasFrame.style.height = `${availableHeight}px`;
                            canvasContainer.style.width = "100%";
                            canvasContainer.style.height = "100%";
                            resizeCanvasSurface(
                                Math.max(1, canvasContainer.clientWidth || availableWidth - readPixelValue(frameStyles.borderLeftWidth) - readPixelValue(frameStyles.borderRightWidth)),
                                Math.max(1, canvasContainer.clientHeight || availableHeight - readPixelValue(frameStyles.borderTopWidth) - readPixelValue(frameStyles.borderBottomWidth))
                            );
                        };
                        const updateTransform = () => {
                            ensureCanvasCoverage();
                            canvas.style.transform = `translate(${translate.x + (canvasOrigin.x * scale)}px, ${translate.y + (canvasOrigin.y * scale)}px) scale(${scale})`;
                            persistViewport();
                        };
                        const renderOperations = () => {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            boardOperations.forEach(operation => {
                                if ((operation?.type === "stroke" || operation?.type === "erase") && Array.isArray(operation.points) && operation.points.length) {
                                    ctx.save();
                                    ctx.beginPath();
                                    ctx.moveTo(operation.points[0].x - canvasOrigin.x, operation.points[0].y - canvasOrigin.y);
                                    for (let i = 1; i < operation.points.length; i++) {
                                        ctx.lineTo(operation.points[i].x - canvasOrigin.x, operation.points[i].y - canvasOrigin.y);
                                    }
                                    if (operation.type === "erase") ctx.globalCompositeOperation = "destination-out";
                                    ctx.strokeStyle = operation.color || "#000";
                                    ctx.lineWidth = operation.width || (operation.type === "erase" ? 20 : 2);
                                    ctx.lineCap = "round";
                                    ctx.lineJoin = "round";
                                    ctx.stroke();
                                    ctx.restore();
                                }
                                if (operation?.type === "image" && operation.dataUrl) {
                                    const img = new Image();
                                    img.onload = () => {
                                        ctx.drawImage(img, operation.x - canvasOrigin.x, operation.y - canvasOrigin.y, operation.width, operation.height);
                                    };
                                    img.src = operation.dataUrl;
                                }
                                if (operation?.type === "shape") {
                                    renderShapeOperation(operation);
                                }
                            });
                            const selectedOperation = boardOperations[selectedOperationIndex];
                            if (isSelectableOperation(selectedOperation)) {
                                ctx.save();
                                ctx.setLineDash([6, 4]);
                                ctx.strokeStyle = "#4c8bf5";
                                ctx.lineWidth = 1.5;
                                const bounds = getOperationBounds(selectedOperation);
                                ctx.strokeRect(bounds.x - canvasOrigin.x, bounds.y - canvasOrigin.y, bounds.width, bounds.height);
                                ctx.setLineDash([]);
                                const handles = [
                                    {x: bounds.x - canvasOrigin.x, y: bounds.y - canvasOrigin.y},
                                    {x: bounds.x + bounds.width - canvasOrigin.x, y: bounds.y - canvasOrigin.y},
                                    {x: bounds.x - canvasOrigin.x, y: bounds.y + bounds.height - canvasOrigin.y},
                                    {x: bounds.x + bounds.width - canvasOrigin.x, y: bounds.y + bounds.height - canvasOrigin.y}
                                ];
                                handles.forEach(handle => {
                                    ctx.fillStyle = "#ffffff";
                                    ctx.strokeStyle = "#4c8bf5";
                                    ctx.fillRect(handle.x - resizeHandleSize / 2, handle.y - resizeHandleSize / 2, resizeHandleSize, resizeHandleSize);
                                    ctx.strokeRect(handle.x - resizeHandleSize / 2, handle.y - resizeHandleSize / 2, resizeHandleSize, resizeHandleSize);
                                });
                                ctx.restore();
                            }
                        };
                        const syncStateAndRender = () => {
                            scale = boardViewport.scale || 1;
                            translate = {x: boardViewport.translate?.x || 0, y: boardViewport.translate?.y || 0};
                            ensureCanvasCoverage();
                            updateTransform();
                            renderOperations();
                        };
                        syncEditorState = syncStateAndRender;
                        windowBody.__boardsSyncCanvasLayout = () => {
                            syncCanvasLayout();
                            updateTransform();
                            renderOperations();
                        };
                        const clearCanvas = () => {
                            boardOperations = [];
                            selectedOperationIndex = -1;
                            contextShapeIndex = -1;
                            renderOperations();
                        };
                        const getPos = e => {
                            const rect = canvas.getBoundingClientRect();
                            return {x: ((e.clientX - rect.left) / scale) + canvasOrigin.x, y: ((e.clientY - rect.top) / scale) + canvasOrigin.y};
                        };
                        const isSelectableOperation = operation => operation?.type === "image" || operation?.type === "shape";
                        const getOperationBounds = operation => ({
                            x: Number(operation?.x) || 0,
                            y: Number(operation?.y) || 0,
                            width: Math.max(1, Number(operation?.width) || 1),
                            height: Math.max(1, Number(operation?.height) || 1)
                        });
                        const getSelectableOperationIndexAtPos = pos => {
                            for (let i = boardOperations.length - 1; i >= 0; i--) {
                                const operation = boardOperations[i];
                                if (!isSelectableOperation(operation)) continue;
                                const bounds = getOperationBounds(operation);
                                if (pos.x >= bounds.x && pos.x <= bounds.x + bounds.width && pos.y >= bounds.y && pos.y <= bounds.y + bounds.height) return i;
                            }
                            return -1;
                        };
                        const getResizeHandleType = (operation, pos) => {
                            if (!isSelectableOperation(operation)) return null;
                            const bounds = getOperationBounds(operation);
                            const halfHandle = resizeHandleSize / 2;
                            const handles = [
                                {name: "top-left", x: bounds.x, y: bounds.y},
                                {name: "top-right", x: bounds.x + bounds.width, y: bounds.y},
                                {name: "bottom-left", x: bounds.x, y: bounds.y + bounds.height},
                                {name: "bottom-right", x: bounds.x + bounds.width, y: bounds.y + bounds.height}
                            ];
                            const handle = handles.find(candidate => {
                                return pos.x >= candidate.x - halfHandle && pos.x <= candidate.x + halfHandle && pos.y >= candidate.y - halfHandle && pos.y <= candidate.y + halfHandle;
                            });
                            return handle?.name || null;
                        };
                        const withShapePath = operation => {
                            const bounds = getOperationBounds(operation);
                            const x = bounds.x - canvasOrigin.x;
                            const y = bounds.y - canvasOrigin.y;
                            const w = bounds.width;
                            const h = bounds.height;
                            ctx.beginPath();
                            if (operation.shape === "ellipse") {
                                ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
                                return;
                            }
                            if (operation.shape === "triangle") {
                                ctx.moveTo(x + w / 2, y);
                                ctx.lineTo(x + w, y + h);
                                ctx.lineTo(x, y + h);
                                ctx.closePath();
                                return;
                            }
                            if (operation.shape === "diamond") {
                                ctx.moveTo(x + w / 2, y);
                                ctx.lineTo(x + w, y + h / 2);
                                ctx.lineTo(x + w / 2, y + h);
                                ctx.lineTo(x, y + h / 2);
                                ctx.closePath();
                                return;
                            }
                            const radius = operation.shape === "rounded-rectangle" ? Math.min(w, h, 28) / 4 : 0;
                            if (radius && typeof ctx.roundRect === "function") {
                                ctx.roundRect(x, y, w, h, radius);
                                return;
                            }
                            if (radius) {
                                ctx.moveTo(x + radius, y);
                                ctx.lineTo(x + w - radius, y);
                                ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
                                ctx.lineTo(x + w, y + h - radius);
                                ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
                                ctx.lineTo(x + radius, y + h);
                                ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
                                ctx.lineTo(x, y + radius);
                                ctx.quadraticCurveTo(x, y, x + radius, y);
                                ctx.closePath();
                                return;
                            }
                            ctx.rect(x, y, w, h);
                        };
                        const renderShapeOperation = operation => {
                            ctx.save();
                            withShapePath(operation);
                            ctx.fillStyle = operation.fillColor || "rgba(76, 139, 245, 0.18)";
                            ctx.strokeStyle = operation.borderColor || "#1f2937";
                            ctx.lineWidth = Math.max(0, Number(operation.borderWidth) || 0);
                            ctx.fill();
                            if (ctx.lineWidth > 0) ctx.stroke();
                            ctx.restore();
                        };
                        const setTool = t => {
                            tool = t;
                            windowBody.querySelectorAll(".tool-button").forEach(btn => {
                                btn.classList.remove("active");
                                btn.style.color = "";
                                btn.querySelectorAll("svg, path").forEach(node => {
                                    node.style.fill = "";
                                    node.style.stroke = "";
                                    node.style.color = "";
                                });
                            });
                            const selected = windowBody.querySelector(`button[data="tool-${t}"]`);
                            if (selected) {
                                selected.classList.add("active");
                                selected.style.color = "var(--primary)";
                                selected.querySelectorAll("svg, path").forEach(node => {
                                    node.style.color = "var(--primary)";
                                    node.style.stroke = "var(--primary)";
                                });
                            }
                        };
                        const insertImage = file => {
                            if (!file || !file.type.startsWith("image/")) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                                const img = new Image();
                                img.onload = () => {
                                    const viewportSize = getViewportSize();
                                    const visibleLeft = (-translate.x) / scale;
                                    const visibleTop = (-translate.y) / scale;
                                    const scaleFactor = Math.min(viewportSize.width / img.width, viewportSize.height / img.height, 1);
                                    const drawWidth = img.width * scaleFactor;
                                    const drawHeight = img.height * scaleFactor;
                                    const x = visibleLeft + ((viewportSize.width / scale) - drawWidth) / 2;
                                    const y = visibleTop + ((viewportSize.height / scale) - drawHeight) / 2;
                                    boardOperations.push({type: "image", dataUrl: reader.result, x, y, width: drawWidth, height: drawHeight});
                                    selectedOperationIndex = boardOperations.length - 1;
                                    renderOperations();
                                };
                                img.src = reader.result;
                            };
                            reader.readAsDataURL(file);
                        };
                        const getCenteredInsertionRect = (width = 160, height = 110) => {
                            const viewportSize = getViewportSize();
                            const visibleLeft = (-translate.x) / scale;
                            const visibleTop = (-translate.y) / scale;
                            return {
                                x: visibleLeft + ((viewportSize.width / scale) - width) / 2,
                                y: visibleTop + ((viewportSize.height / scale) - height) / 2,
                                width,
                                height
                            };
                        };
                        const insertShape = shapeType => {
                            const dimensions = shapeType === "triangle" || shapeType === "diamond" ? getCenteredInsertionRect(140, 140) : getCenteredInsertionRect(170, 110);
                            boardOperations.push({
                                type: "shape",
                                shape: shapeType,
                                ...dimensions,
                                borderColor: "#1f2937",
                                borderWidth: 2,
                                fillColor: "rgba(76, 139, 245, 0.18)"
                            });
                            selectedOperationIndex = boardOperations.length - 1;
                            setTool("select");
                            renderOperations();
                        };
                        const changeShapeProperty = (property, title, placeholder, parser = value => value) => {
                            const shape = boardOperations[contextShapeIndex];
                            if (shape?.type !== "shape") return;
                            inputDialogue({
                                title,
                                placeholder,
                                value: shape[property],
                                confirmation: (_, rawValue) => {
                                    const nextValue = parser(rawValue);
                                    if (nextValue === null || nextValue === undefined || nextValue === "") return;
                                    shape[property] = nextValue;
                                    renderOperations();
                                }
                            });
                        };
                        const parsePositivePixel = value => {
                            const number = Math.round(Number.parseFloat(String(value || "")));
                            return Number.isFinite(number) && number > 0 ? number : null;
                        };
                        const startDrawing = e => {
                            if (tool === "drag") {
                                isDragging = true;
                                dragStart = {x: e.clientX, y: e.clientY};
                                return;
                            }
                            if (tool === "select") {
                                const pos = getPos(e);
                                const selectedOperation = boardOperations[selectedOperationIndex];
                                const handleType = getResizeHandleType(selectedOperation, pos);
                                if (handleType) {
                                    selectionAction = {type: "resize", handle: handleType, start: pos};
                                    return;
                                }
                                const operationIndex = getSelectableOperationIndexAtPos(pos);
                                selectedOperationIndex = operationIndex;
                                if (operationIndex >= 0) {
                                    const selectedOperation = boardOperations[operationIndex];
                                    selectionAction = {
                                        type: "move",
                                        offsetX: pos.x - selectedOperation.x,
                                        offsetY: pos.y - selectedOperation.y
                                    };
                                } else {
                                    selectionAction = null;
                                }
                                renderOperations();
                                return;
                            }
                            drawing = true;
                            const pos = getPos(e);
                            currentStroke = {
                                type: tool === "erase" ? "erase" : "stroke",
                                color: pickedColor,
                                width: tool === "erase" ? 20 : 2,
                                points: [pos]
                            };
                            boardOperations.push(currentStroke);
                            renderOperations();
                        };
                        const draw = e => {
                            if (tool === "drag") {
                                if (!isDragging) return;
                                const deltaX = e.clientX - dragStart.x;
                                const deltaY = e.clientY - dragStart.y;
                                translate.x += deltaX;
                                translate.y += deltaY;
                                dragStart = {x: e.clientX, y: e.clientY};
                                updateTransform();
                                renderOperations();
                                return;
                            }
                            if (tool === "select") {
                                if (!selectionAction || selectedOperationIndex < 0) return;
                                const selectedOperation = boardOperations[selectedOperationIndex];
                                if (!isSelectableOperation(selectedOperation)) return;
                                const pos = getPos(e);
                                if (selectionAction.type === "move") {
                                    selectedOperation.x = pos.x - selectionAction.offsetX;
                                    selectedOperation.y = pos.y - selectionAction.offsetY;
                                }
                                if (selectionAction.type === "resize") {
                                    const minSize = 24;
                                    const endX = selectedOperation.x + selectedOperation.width;
                                    const endY = selectedOperation.y + selectedOperation.height;
                                    if (selectionAction.handle === "top-left") {
                                        const nextX = Math.min(pos.x, endX - minSize);
                                        const nextY = Math.min(pos.y, endY - minSize);
                                        selectedOperation.width = endX - nextX;
                                        selectedOperation.height = endY - nextY;
                                        selectedOperation.x = nextX;
                                        selectedOperation.y = nextY;
                                    }
                                    if (selectionAction.handle === "top-right") {
                                        const nextX = Math.max(pos.x, selectedOperation.x + minSize);
                                        const nextY = Math.min(pos.y, endY - minSize);
                                        selectedOperation.width = nextX - selectedOperation.x;
                                        selectedOperation.height = endY - nextY;
                                        selectedOperation.y = nextY;
                                    }
                                    if (selectionAction.handle === "bottom-left") {
                                        const nextX = Math.min(pos.x, endX - minSize);
                                        const nextY = Math.max(pos.y, selectedOperation.y + minSize);
                                        selectedOperation.width = endX - nextX;
                                        selectedOperation.height = nextY - selectedOperation.y;
                                        selectedOperation.x = nextX;
                                    }
                                    if (selectionAction.handle === "bottom-right") {
                                        const nextX = Math.max(pos.x, selectedOperation.x + minSize);
                                        const nextY = Math.max(pos.y, selectedOperation.y + minSize);
                                        selectedOperation.width = nextX - selectedOperation.x;
                                        selectedOperation.height = nextY - selectedOperation.y;
                                    }
                                }
                                renderOperations();
                                return;
                            }
                            if (!drawing || !currentStroke) return;
                            currentStroke.points.push(getPos(e));
                            renderOperations();
                        };
                        const stopDrawing = () => {
                            drawing = false;
                            isDragging = false;
                            currentStroke = null;
                            selectionAction = null;
                        };
                        const saveBoard = () => triggerBoardSave(windowBody);
                        windowBody.__boardsSaveBoard = saveBoard;
                        canvas.addEventListener("mousedown", startDrawing);
                        canvas.addEventListener("mousemove", draw);
                        canvas.addEventListener("mouseup", stopDrawing);
                        canvas.addEventListener("mouseleave", stopDrawing);
                        canvas.addEventListener("wheel", e => {
                            if (!e.shiftKey) return;
                            e.preventDefault();
                            const zoomDirection = e.deltaY > 0 ? -0.1 : 0.1;
                            scale = Math.min(3, Math.max(0.5, scale + zoomDirection));
                            updateTransform();
                            renderOperations();
                        }, {passive: false});
                        windowBody.querySelectorAll(".color-block").forEach(cb => {
                            cb.addEventListener("click", () => {
                                pickedColor = getComputedStyle(cb).backgroundColor;
                                windowBody.querySelectorAll(".color-block").forEach(c => c.classList.remove("active"));
                                cb.classList.add("active");
                            });
                        });
                        attachInput.addEventListener("change", event => {
                            const file = event.target.files?.[0];
                            insertImage(file);
                            attachInput.value = "";
                        });
                        const shapeButton = windowBody.querySelector('button[data="action-shapes"]');
                        if (shapeButton && !shapeButton.__boardsShapesMenuAttached) {
                            shapeButton.__boardsShapesMenuAttached = true;
                            shapeButton.popoutmenu(boardShapeOptions.map(shape => ({
                                icon: shape.icon,
                                label: shape.label,
                                action: () => insertShape(shape.type)
                            })));
                        }
                        canvas.addEventListener("contextmenu", event => {
                            const operationIndex = getSelectableOperationIndexAtPos(getPos(event));
                            const operation = boardOperations[operationIndex];
                            contextShapeIndex = operation?.type === "shape" ? operationIndex : -1;
                            if (contextShapeIndex >= 0) selectedOperationIndex = contextShapeIndex;
                            renderOperations();
                        }, true);
                        canvas.contextmenu([{
                            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m9-9H3" /></svg>`,
                            label: "Border Color",
                            visible: () => contextShapeIndex >= 0,
                            action: () => changeShapeProperty("borderColor", "Border color", "#1f2937")
                        }, {
                            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5h15M7 16 17 6" /></svg>`,
                            label: "Border Width",
                            visible: () => contextShapeIndex >= 0,
                            action: () => changeShapeProperty("borderWidth", "Border width", "2", value => {
                                const number = Math.round(Number.parseFloat(String(value || "")));
                                return Number.isFinite(number) && number >= 0 ? number : null;
                            })
                        }, {
                            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m15 11.25-3-3m0 0-3 3m3-3v11.25M4.5 19.5h15" /></svg>`,
                            label: "Fill",
                            visible: () => contextShapeIndex >= 0,
                            action: () => changeShapeProperty("fillColor", "Fill", "rgba(76, 139, 245, 0.18)")
                        }, {
                            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5M3.75 15h16.5" /></svg>`,
                            label: "Width",
                            visible: () => contextShapeIndex >= 0,
                            action: () => changeShapeProperty("width", "Width", "170", parsePositivePixel)
                        }, {
                            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3.75v16.5M15 3.75v16.5" /></svg>`,
                            label: "Height",
                            visible: () => contextShapeIndex >= 0,
                            action: () => changeShapeProperty("height", "Height", "110", parsePositivePixel)
                        }]);
                        windowBody.querySelector('button[data="tool-draw"]')?.addEventListener("click", () => setTool("draw"));
                        windowBody.querySelector('button[data="tool-erase"]')?.addEventListener("click", () => setTool("erase"));
                        windowBody.querySelector('button[data="tool-select"]')?.addEventListener("click", () => setTool("select"));
                        windowBody.querySelector('button[data="tool-drag"]')?.addEventListener("click", () => setTool("drag"));
                        windowBody.querySelector('button[data="action-attach"]')?.addEventListener("click", () => attachInput.click());
                        windowBody.querySelector('button[data="action-clear"]')?.addEventListener("click", clearCanvas);
                        if (typeof ResizeObserver !== "undefined") {
                            const resizeObserver = new ResizeObserver(() => {
                                windowBody.__boardsSyncCanvasLayout?.();
                            });
                            resizeObserver.observe(windowBody);
                            resizeObserver.observe(editorRoot);
                            if (toolbar) resizeObserver.observe(toolbar);
                            windowBody.__boardsResizeObserver = resizeObserver;
                        }
                        setTool("draw");
                        windowBody.__boardsSyncCanvasLayout?.();
                        syncStateAndRender();
                        requestAnimationFrame(() => canvas.focus());
                    }
                }, {
                    text: "Boards",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>`,
                    route: () => div({style: "small-padding large-padding-top", content: children([div({style: "gridded", id: "boards-list", content: () => renderBoards()})])}),
                    afterRender: () => {
                        document.querySelectorAll("#boards-list").forEach(list => list.contextmenu([{
                            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>`,
                            label: "Rename",
                            action: (_, __, target) => {
                                const path = target?.getAttribute("directive");
                                renameBoardFile(path);
                            }
                        }, {
                            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`,
                            label: "Delete",
                            destructive: true,
                            action: (_, __, target) => {
                                const path = target?.getAttribute("directive");
                                deleteBoardFile(path);
                            }
                        }], ".board-file"));
                        refreshBoardsList = () => {
                            const list = document.getElementById("boards-list");
                            if (!list) return;
                            renderBoards().then(markup => {
                                list.innerHTML = markup;
                                list.querySelectorAll(".board-file").forEach(node => {
                                    node.addEventListener("click", async event => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openBoardPath(node.getAttribute("directive"), node);
                                    });
                                });
                            });
                        };
                        refreshBoardsList();
                    }
                }
            ]
        })
    ]));
})();
