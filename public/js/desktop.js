(function () {
    const viewport = document.getElementById("desktop-viewport");
    const canvas = document.getElementById("desktop-canvas");
    const marquee = document.getElementById("desktop-selection-marquee");
    const cursorButton = document.getElementById("desktop-tool-cursor");
    const handButton = document.getElementById("desktop-tool-hand");
    const newButton = document.getElementById("desktop-tool-new");
    if (!viewport || !canvas || !marquee || !cursorButton || !handButton || !newButton) return;

    const state = {version: 1, viewport: {x: 0, y: 0}, shortcuts: []};
    const selected = new Set();
    let activeTool = "cursor";
    let interaction = null;
    let lastContextPoint = {x: window.innerWidth / 2, y: window.innerHeight / 2};
    let contextMenuAllowed = false;
    let saveTimer = null;
    let saveQueue = Promise.resolve();
    let panel = null;

    const CREATE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>`;
    const GO_TO_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><circle cx="12" cy="12" r="7.5"/><path stroke-linecap="round" d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></svg>`;
    const FILE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776h16.5M3.75 9.776V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776l-1 8.5a2.25 2.25 0 0 1-2.235 1.974H6.985a2.25 2.25 0 0 1-2.235-1.974l-1-8.5Z"/></svg>`;
    const LINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M3.5 12h17M12 3c2.2 2.45 3.3 5.45 3.3 9S14.2 18.55 12 21M12 3C9.8 5.45 8.7 8.45 8.7 12S9.8 18.55 12 21"/></svg>`;
    const APP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25A2.25 2.25 0 0 1 8.25 10.5H6A2.25 2.25 0 0 1 3.75 8.25V6ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z"/></svg>`;
    const FILE_SHORTCUT_DRAG_TYPE = "application/x-standard-file-shortcut";

    const finite = (value, fallback = 0) => {
        const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const cleanId = (value = "") => String(value || "").trim().replace(/[^a-zA-Z0-9_-]/g, "");
    const clone = (value) => {
        try { return JSON.parse(JSON.stringify(value)); } catch (_) { return null; }
    };
    const clientToWorld = (point) => ({x: point.x - state.viewport.x, y: point.y - state.viewport.y});
    const worldToClient = (point) => ({x: point.x + state.viewport.x, y: point.y + state.viewport.y});
    const desktopItems = () => Array.from(canvas.querySelectorAll(".desktop-shortcut, .desktop-canvas-window"));
    const movableItems = () => desktopItems().filter(node => node.dataset.pinned !== "true");
    const isPortalFocused = () => Boolean(document.querySelector(".draggable-window.window-focused:not(.widget-window):not(.minimized)"));
    const isBackgroundTarget = (target) => {
        if (!(target instanceof Element)) return false;
        return !target.closest("header, .draggable-window, .desktop-shortcut, #search-box-container, .desktop-command-panel, .custom-context-menu, #cover");
    };
    const clearPortalFocus = () => document.querySelectorAll(".draggable-window.window-focused").forEach(node => node.classList.remove("window-focused"));

    function applyViewport() {
        canvas.style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px)`;
        viewport.style.backgroundPosition = `${state.viewport.x}px ${state.viewport.y}px`;
    }

    async function readStoredState() {
        return window.StandardDesktopState?.load?.() || null;
    }

    async function writeStoredState() {
        return window.StandardDesktopState?.save?.({version: 1, viewport: state.viewport, shortcuts: state.shortcuts}) || false;
    }

    function scheduleSave(delay = 180) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveQueue = saveQueue.catch(() => null).then(writeStoredState).catch(error => console.error("Failed to save desktop canvas", error));
        }, delay);
    }

    function setTool(tool) {
        activeTool = tool === "hand" ? "hand" : "cursor";
        [[cursorButton, "cursor"], [handButton, "hand"]].forEach(([button, name]) => {
            const active = activeTool === name;
            button.classList.toggle("desktop-tool-active", active);
            button.setAttribute("aria-pressed", String(active));
        });
        viewport.dataset.desktopTool = activeTool;
    }

    function setSelected(nodes, additive = false) {
        if (!additive) selected.clear();
        nodes.forEach(node => selected.add(node));
        desktopItems().forEach(node => node.classList.toggle("desktop-item-selected", selected.has(node)));
    }

    function detectShortcutType(rawTarget = "") {
        const target = String(rawTarget || "").trim();
        if (/^-?\d+(?:\.\d+)?\s*[,\s]\s*-?\d+(?:\.\d+)?$/.test(target)) return "location";
        if (/^(?:https?:\/\/|www\.|localhost(?::\d+)?(?:\/|$))/i.test(target)) return "link";
        if (/^(?:app:)?com\.standard\.[\w.-]+(?:#\d+)?$/i.test(target)) return "app";
        if (/^[\w-]+(?:\.[\w-]+)*\.(?:com|org|net|io|dev|app|co|us|uk|edu|gov|info|me|ai|xyz|cloud|tech|site|online|store|ca)(?:[/:?#][^\s]*)?$/i.test(target)) return "link";
        if (/^(?:[a-z]:[\\/]|\.{0,2}[\\/]|\/)/i.test(target) || /(?:^|[\\/])[^\\/]+\.[a-z0-9]{1,12}(?:[?#].*)?$/i.test(target) || /^[^\\/]+\.[a-z0-9]{1,12}$/i.test(target)) return "file";
        return "link";
    }

    function normalizeShortcut(value = {}) {
        const target = String(value.target || "").trim();
        const type = detectShortcutType(target);
        const normalizedTarget = type === "app" ? target.replace(/^app:/i, "") : target;
        const fallbackTitle = type === "link" ? normalizedTarget.replace(/^https?:\/\//i, "").split("/")[0] : normalizedTarget.split("/").pop();
        return {
            id: cleanId(value.id) || `shortcut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: String(value.title || fallbackTitle || "Shortcut").trim().slice(0, 80),
            type,
            target: normalizedTarget,
            x: finite(value.x),
            y: finite(value.y),
            createdAt: value.createdAt || new Date().toISOString()
        };
    }

    function appendSvg(node, markup) {
        const icon = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
        icon.setAttribute("aria-hidden", "true");
        node.appendChild(icon);
    }

    function appendImage(node, source, alt = "") {
        const image = document.createElement("img");
        image.src = source;
        image.alt = alt;
        image.draggable = false;
        if (!alt) image.setAttribute("aria-hidden", "true");
        node.appendChild(image);
    }

    function appShortcutIcon(shortcut) {
        const serviceId = shortcut.target.split("#")[0];
        const service = (modular?.running || []).find(candidate => candidate?.name?.() === serviceId);
        const metadata = service?.interfaceShortcut?.();
        if (!metadata) return "";
        const prefersSvg = window.StandardUI?.prefersSvgIcons?.() !== false;
        return prefersSvg
            ? metadata.svg_icon || metadata.image_icon || metadata.icon || ""
            : metadata.image_icon || metadata.svg_icon || metadata.icon || "";
    }

    function shortcutIcon(shortcut, node) {
        if (shortcut.type === "file") {
            const iconPath = window.StandardFiles?.getFileTypeIconPath?.({name: shortcut.target, path: shortcut.target});
            if (iconPath) {
                appendImage(node, iconPath);
                return;
            }
            appendSvg(node, FILE_ICON);
            return;
        }
        if (shortcut.type === "app") {
            const iconSource = appShortcutIcon(shortcut);
            if (iconSource) {
                if (iconSource.trim().startsWith("<svg")) appendSvg(node, iconSource);
                else appendImage(node, iconSource, shortcut.title);
                return;
            }
        }
        appendSvg(node, shortcut.type === "link" ? LINK_ICON : shortcut.type === "app" ? APP_ICON : GO_TO_ICON);
    }

    function refreshShortcutIcons() {
        canvas.querySelectorAll(".desktop-shortcut").forEach(node => {
            const shortcut = state.shortcuts.find(value => value.id === node.dataset.shortcutId);
            const label = node.querySelector(".desktop-shortcut-label");
            if (!shortcut || !label) return;
            node.querySelectorAll(":scope > img, :scope > svg").forEach(icon => icon.remove());
            label.remove();
            shortcutIcon(shortcut, node);
            node.appendChild(label);
        });
    }

    async function waitFor(getter, timeout = 5000) {
        const started = Date.now();
        while (Date.now() - started < timeout) {
            const value = getter();
            if (value) return value;
            await new Promise(resolve => setTimeout(resolve, 80));
        }
        return null;
    }

    async function openShortcut(shortcut, sourceNode = null) {
        if (!shortcut) return;
        if (shortcut.type === "link") {
            const raw = /^https?:\/\//i.test(shortcut.target) ? shortcut.target : `https://${shortcut.target}`;
            try {
                const url = new URL(raw);
                if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported link");
                const link = document.createElement("a");
                link.href = url.href;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.click();
            } catch (_) { modular?.error?.("This shortcut does not contain a valid web link"); }
            return;
        }
        if (shortcut.type === "file") {
            let opener = window.StandardFiles?.openFilePath;
            if (!opener && typeof modular?.show === "function") modular.show("com.standard.files", 0);
            opener = opener || await waitFor(() => window.StandardFiles?.openFilePath);
            if (opener) opener(shortcut.target, sourceNode);
            else modular?.error?.("The Files service is not ready");
            return;
        }
        if (shortcut.type === "app") {
            const [serviceId, rawIndex] = shortcut.target.split("#");
            if (serviceId) modular?.show?.(serviceId, finite(rawIndex, 0));
            return;
        }
        const [x, y] = shortcut.target.split(/[,\s]+/).map(Number);
        if (Number.isFinite(x) && Number.isFinite(y)) goToWorldPoint({x, y});
    }

    function removeShortcut(id) {
        const index = state.shortcuts.findIndex(shortcut => shortcut.id === id);
        if (index < 0) return;
        state.shortcuts.splice(index, 1);
        const node = canvas.querySelector(`[data-shortcut-id="${id}"]`);
        if (node) selected.delete(node);
        node?.remove();
        scheduleSave(0);
    }

    function renderShortcut(shortcutValue) {
        const shortcut = normalizeShortcut(shortcutValue);
        const node = document.createElement("button");
        node.type = "button";
        node.className = "plain desktop-shortcut";
        node.dataset.shortcutId = shortcut.id;
        node.style.left = `${shortcut.x}px`;
        node.style.top = `${shortcut.y}px`;
        node.title = shortcut.title;
        node.setAttribute("aria-label", `${shortcut.title}, ${shortcut.type} shortcut`);
        shortcutIcon(shortcut, node);
        const label = document.createElement("span");
        label.className = "desktop-shortcut-label";
        label.textContent = shortcut.title;
        node.appendChild(label);
        node.contextmenu([{
            label: "Open",
            action: () => openShortcut(shortcut, node)
        }, {
            label: "Edit",
            action: () => openPinPanel({x: shortcut.x, y: shortcut.y}, shortcut)
        }, "separator", {
            label: "Remove",
            destructive: true,
            action: () => removeShortcut(shortcut.id)
        }]);
        canvas.appendChild(node);
        return node;
    }

    function renderShortcuts() {
        canvas.querySelectorAll(".desktop-shortcut").forEach(node => node.remove());
        state.shortcuts = state.shortcuts.map(normalizeShortcut);
        state.shortcuts.forEach(renderShortcut);
    }

    function createShortcutAt(details = {}, point = {}) {
        const shortcut = normalizeShortcut({...details, x: finite(point.x), y: finite(point.y)});
        state.shortcuts.push(shortcut);
        const node = renderShortcut(shortcut);
        setSelected([node]);
        scheduleSave(0);
        return shortcut;
    }

    function isFileShortcutDrag(event) {
        return Array.from(event.dataTransfer?.types || []).includes(FILE_SHORTCUT_DRAG_TYPE);
    }

    function allowFileShortcutDrop(event) {
        if (!isFileShortcutDrag(event) || !isBackgroundTarget(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        document.body.classList.remove("drag-active");
    }

    function closePanel() {
        panel?.remove();
        panel = null;
    }

    function buildPanel(title) {
        closePanel();
        panel = document.createElement("section");
        panel.className = "desktop-command-panel bordered radius shadowed blurred padded";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "false");
        panel.setAttribute("aria-label", title);
        const heading = document.createElement("strong");
        heading.textContent = title;
        panel.appendChild(heading);
        document.body.appendChild(panel);
        return panel;
    }

    function buttonFor(label, className = "secondary") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        return button;
    }

    function openPinPanel(point, existing = null, defaults = null) {
        const anchor = {x: finite(point?.x), y: finite(point?.y)};
        const initial = existing || defaults || {};
        const host = buildPanel(existing ? "Edit desktop shortcut" : "Pin a shortcut");
        const form = document.createElement("form");
        const title = document.createElement("input");
        title.className = "desktop-command-wide";
        title.placeholder = "Shortcut name";
        title.value = initial.title || "";
        title.setAttribute("aria-label", "Shortcut name");
        const target = document.createElement("input");
        target.className = "desktop-command-wide";
        target.value = initial.target || "";
        target.setAttribute("aria-label", "Shortcut target");
        target.placeholder = "URL, file path, app ID, or x, y";
        const hint = document.createElement("small");
        hint.className = "desktop-command-wide faded";
        hint.textContent = "Type is detected automatically from the target.";
        const actions = document.createElement("div");
        actions.className = "desktop-command-actions";
        const cancel = buttonFor("Cancel");
        const save = buttonFor(existing ? "Save" : "Pin", "primary");
        save.type = "submit";
        cancel.addEventListener("click", closePanel);
        actions.append(cancel, save);
        form.append(title, target, hint, actions);
        host.appendChild(form);
        form.addEventListener("submit", event => {
            event.preventDefault();
            if (!target.value.trim()) return target.focus();
            const nextTarget = target.value.trim();
            const next = normalizeShortcut({...initial, type: detectShortcutType(nextTarget), title: title.value, target: nextTarget, x: anchor.x, y: anchor.y});
            const index = state.shortcuts.findIndex(shortcut => shortcut.id === next.id);
            if (index >= 0) state.shortcuts[index] = next;
            else state.shortcuts.push(next);
            renderShortcuts();
            scheduleSave(0);
            closePanel();
        });
        requestAnimationFrame(() => target.focus());
    }

    function goToWorldPoint(point) {
        state.viewport.x = Math.round((window.innerWidth / 2) - finite(point.x));
        state.viewport.y = Math.round((window.innerHeight / 2) - finite(point.y));
        applyViewport();
        scheduleSave();
    }

    function openGoToPanel() {
        const center = clientToWorld({x: window.innerWidth / 2, y: window.innerHeight / 2});
        const host = buildPanel("Go to desktop coordinates");
        const form = document.createElement("form");
        const x = document.createElement("input");
        const y = document.createElement("input");
        x.type = y.type = "number";
        x.value = String(Math.round(center.x));
        y.value = String(Math.round(center.y));
        x.placeholder = "X";
        y.placeholder = "Y";
        x.setAttribute("aria-label", "Desktop X coordinate");
        y.setAttribute("aria-label", "Desktop Y coordinate");
        const actions = document.createElement("div");
        actions.className = "desktop-command-actions";
        const cancel = buttonFor("Cancel");
        const go = buttonFor("Go To", "primary");
        go.type = "submit";
        cancel.addEventListener("click", closePanel);
        actions.append(cancel, go);
        form.append(x, y, actions);
        host.appendChild(form);
        form.addEventListener("submit", event => {
            event.preventDefault();
            goToWorldPoint({x: finite(x.value), y: finite(y.value)});
            closePanel();
        });
        requestAnimationFrame(() => x.select());
    }

    function showMarquee(start, current) {
        const left = Math.min(start.x, current.x);
        const top = Math.min(start.y, current.y);
        const width = Math.abs(current.x - start.x);
        const height = Math.abs(current.y - start.y);
        Object.assign(marquee.style, {left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`});
        marquee.classList.remove("hidden");
        return {left, top, right: left + width, bottom: top + height};
    }

    function intersects(rect, bounds) {
        return rect.left < bounds.right && rect.right > bounds.left && rect.top < bounds.bottom && rect.bottom > bounds.top;
    }

    function beginPointerInteraction(event) {
        if (event.button !== 0 || panel?.contains(event.target)) return;
        const item = event.target.closest?.(".desktop-shortcut, .desktop-canvas-window");
        if (activeTool === "hand") {
            if (!isBackgroundTarget(event.target)) return;
            clearPortalFocus();
            interaction = {kind: "pan", pointerId: event.pointerId, start: {x: event.clientX, y: event.clientY}, viewport: {...state.viewport}};
        } else if (item && canvas.contains(item) && item.dataset.pinned !== "true") {
            if (!selected.has(item)) setSelected([item], event.shiftKey);
            interaction = {
                kind: "move",
                pointerId: event.pointerId,
                start: {x: event.clientX, y: event.clientY},
                moved: false,
                items: Array.from(selected).filter(node => node.isConnected && node.dataset.pinned !== "true").map(node => ({node, left: finite(node.style.left), top: finite(node.style.top)}))
            };
        } else if (isBackgroundTarget(event.target)) {
            clearPortalFocus();
            if (!event.shiftKey) setSelected([]);
            interaction = {kind: "select", pointerId: event.pointerId, start: {x: event.clientX, y: event.clientY}, additive: event.shiftKey, baseSelection: new Set(selected)};
        } else {
            return;
        }
        if (interaction.kind !== "move") {
            viewport.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        }
    }

    function movePointerInteraction(event) {
        if (!interaction || event.pointerId !== interaction.pointerId) return;
        const dx = event.clientX - interaction.start.x;
        const dy = event.clientY - interaction.start.y;
        if (interaction.kind === "pan") {
            state.viewport.x = interaction.viewport.x + dx;
            state.viewport.y = interaction.viewport.y + dy;
            applyViewport();
        } else if (interaction.kind === "move") {
            if (!interaction.moved && Math.abs(dx) + Math.abs(dy) <= 3) return;
            if (!interaction.moved) {
                interaction.moved = true;
                viewport.setPointerCapture?.(event.pointerId);
            }
            interaction.items.forEach(({node, left, top}) => {
                node.style.left = `${left + dx}px`;
                node.style.top = `${top + dy}px`;
            });
        } else {
            const bounds = showMarquee(interaction.start, {x: event.clientX, y: event.clientY});
            const hits = movableItems().filter(node => intersects(node.getBoundingClientRect(), bounds));
            setSelected(interaction.additive ? [...interaction.baseSelection, ...hits] : hits);
        }
        event.preventDefault();
    }

    function finishPointerInteraction(event) {
        if (!interaction || event.pointerId !== interaction.pointerId) return;
        if (interaction.kind === "pan") scheduleSave();
        if (interaction.kind === "move" && interaction.moved) {
            interaction.items.forEach(({node}) => {
                if (node.matches(".desktop-shortcut")) {
                    const shortcut = state.shortcuts.find(value => value.id === node.dataset.shortcutId);
                    if (shortcut) {
                        shortcut.x = finite(node.style.left);
                        shortcut.y = finite(node.style.top);
                    }
                } else {
                    node.portal?.setWindowState?.({}, {persist: true});
                }
            });
            scheduleSave();
        }
        marquee.classList.add("hidden");
        if (viewport.hasPointerCapture?.(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
        interaction = null;
    }

    function attachMinimizedWindow(element, options = {}) {
        if (!(element instanceof HTMLElement)) return null;
        const hasDesktopPosition = options.desktopX !== null && options.desktopX !== undefined && options.desktopX !== ""
            && options.desktopY !== null && options.desktopY !== undefined && options.desktopY !== ""
            && Number.isFinite(Number(options.desktopX)) && Number.isFinite(Number(options.desktopY));
        const world = hasDesktopPosition
            ? {x: Number(options.desktopX), y: Number(options.desktopY)}
            : clientToWorld({x: finite(options.screenX, element.getBoundingClientRect().left), y: finite(options.screenY, element.getBoundingClientRect().top)});
        canvas.appendChild(element);
        element.classList.add("desktop-canvas-window");
        element.style.left = `${world.x}px`;
        element.style.top = `${world.y}px`;
        return world;
    }

    function detachMinimizedWindow(element) {
        if (!(element instanceof HTMLElement) || !element.classList.contains("desktop-canvas-window")) return null;
        const client = worldToClient({x: finite(element.style.left), y: finite(element.style.top)});
        document.body.appendChild(element);
        element.classList.remove("desktop-canvas-window", "desktop-item-selected");
        selected.delete(element);
        return {left: `${client.x}px`, top: `${client.y}px`};
    }

    function describeMinimizedWindow(element) {
        if (!(element instanceof HTMLElement) || !element.classList.contains("desktop-canvas-window")) return null;
        return {x: finite(element.style.left), y: finite(element.style.top)};
    }

    viewport.addEventListener("contextmenu", event => {
        contextMenuAllowed = isBackgroundTarget(event.target) && !isPortalFocused();
        if (contextMenuAllowed) lastContextPoint = {x: event.clientX, y: event.clientY};
    }, true);
    viewport.contextmenu(() => {
        if (!contextMenuAllowed || isPortalFocused()) return [];
        return [{
            label: "Pin",
            icon: CREATE_ICON,
            action: () => openPinPanel(clientToWorld(lastContextPoint))
        }, {
            label: "Go To",
            icon: GO_TO_ICON,
            action: openGoToPanel
        }];
    });
    viewport.addEventListener("pointerdown", beginPointerInteraction);
    viewport.addEventListener("pointermove", movePointerInteraction);
    viewport.addEventListener("pointerup", finishPointerInteraction);
    viewport.addEventListener("pointercancel", finishPointerInteraction);
    viewport.addEventListener("dragenter", allowFileShortcutDrop);
    viewport.addEventListener("dragover", allowFileShortcutDrop);
    viewport.addEventListener("drop", event => {
        if (!isFileShortcutDrag(event) || !isBackgroundTarget(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        document.body.classList.remove("drag-active");
        try {
            const draggedFile = JSON.parse(event.dataTransfer.getData(FILE_SHORTCUT_DRAG_TYPE));
            const target = String(draggedFile?.path || "").trim();
            if (!target) throw new Error("Missing file path");
            createShortcutAt({title: draggedFile?.name, target}, clientToWorld({x: event.clientX, y: event.clientY}));
        } catch (error) {
            console.error("Failed to create a desktop file shortcut", error);
            modular?.error?.("Unable to create the desktop shortcut");
        }
    });
    cursorButton.addEventListener("click", event => { event.stopPropagation(); setTool("cursor"); });
    handButton.addEventListener("click", event => { event.stopPropagation(); setTool("hand"); });
    newButton.addEventListener("click", event => {
        event.stopPropagation();
        const point = clientToWorld({x: window.innerWidth / 2, y: window.innerHeight - 150});
        openPinPanel(point);
    });
    document.addEventListener("keydown", event => {
        if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
            const shortcutButton = {
                F1: newButton,
                F2: cursorButton,
                F3: handButton,
                F4: document.getElementById("launch-interfaces")
            }[event.key];
            if (shortcutButton) {
                event.preventDefault();
                if (!event.repeat) shortcutButton.click();
                return;
            }
        }
        if (event.key === "Escape" && panel) closePanel();
        if ((event.key === "Delete" || event.key === "Backspace") && !panel && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
            const ids = Array.from(selected).filter(node => node.matches(".desktop-shortcut")).map(node => node.dataset.shortcutId);
            ids.forEach(removeShortcut);
        }
    });
    canvas.addEventListener("dblclick", event => {
        const shortcutNode = event.target.closest?.(".desktop-shortcut");
        if (activeTool === "cursor" && shortcutNode) {
            const shortcut = state.shortcuts.find(value => value.id === shortcutNode.dataset.shortcutId);
            if (shortcut) {
                event.preventDefault();
                event.stopPropagation();
                openShortcut(shortcut, shortcutNode);
            }
            return;
        }
        const minimized = event.target.closest?.(".desktop-canvas-window");
        if (activeTool === "cursor" && minimized) minimized.portal?.restoreFromMinimize?.();
    });

    window.StandardDesktop = {
        attachMinimizedWindow,
        detachMinimizedWindow,
        describeMinimizedWindow,
        shouldHandleMinimizedClick: () => activeTool === "cursor",
        clientToWorld,
        worldToClient,
        openPinPanel,
        refreshShortcutIcons,
        createShortcut: (details = {}) => {
            const point = clientToWorld({x: window.innerWidth / 2, y: window.innerHeight - 150});
            openPinPanel(point, null, details);
        },
        createShortcutAt,
        goTo: goToWorldPoint
    };

    setTool("cursor");
    applyViewport();
    readStoredState().then(saved => {
        if (!saved) return;
        state.viewport = {x: finite(saved.viewport?.x), y: finite(saved.viewport?.y)};
        state.shortcuts = Array.isArray(saved.shortcuts) ? saved.shortcuts.map(normalizeShortcut) : [];
        applyViewport();
        renderShortcuts();
    }).catch(error => console.error("Failed to load desktop canvas", error));
})();
