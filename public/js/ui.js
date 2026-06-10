let dragCounter = 0;
function isMouseOutside(e) {
    const rect = document.documentElement.getBoundingClientRect();
    return (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom);
}
document.addEventListener('dragenter', e => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (dragCounter === 1) {
    }
});
document.addEventListener('dragleave', e => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0 || isMouseOutside(e)) {
    }
});
document.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
});
document.addEventListener('DOMContentLoaded', () => {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    document.body.appendChild(tooltip);
    document.querySelectorAll('[title]').forEach(element => {
        element.addEventListener('mouseenter', () => {
            const titleText = element.getAttribute('title');
            element.removeAttribute('title');
            tooltip.textContent = titleText;
            tooltip.style.display = 'block';
            tooltip.dataset.position = 'top';
            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            const offset = 20;
            tooltip.style.left = `${rect.left + window.scrollX + (rect.width - tooltipRect.width) / 2}px`;
            tooltip.style.top = `${rect.top + window.scrollY - tooltipRect.height - offset}px`;
        });
        element.addEventListener('mousemove', (e) => {
            const tooltipRect = tooltip.getBoundingClientRect();
            const offset = 5;
            tooltip.style.left = `${e.pageX - tooltipRect.width / 2}px`;
            tooltip.style.top = `${e.pageY - tooltipRect.height - offset}px`;
        });
        element.addEventListener('mouseleave', () => {
            element.setAttribute('title', tooltip.textContent);
            tooltip.style.display = 'none';
        });
    });
});
const imd = () => /Mobi|Android/i.test(navigator.userAgent), apb = () => {
    let e = 37;
    imd() && (e -= 45), document.querySelector(".holding").animate({"margin-top": -1 * (document.querySelector(".teehee").offsetHeight + e) + "px"}, 100)
};
document.querySelectorAll(".cancel").forEach(c => c.addEventListener("click", () => {
    document.querySelectorAll(".window").forEach(w => w.out())
    document.getElementById("cover").out();
}));
function getAltSyncPropertyValue(source = {}, ...args) {
    const value = source?.altSync ?? source?.altsync ?? source?.alt_sync ?? source?.["alt-sync"] ?? "";
    return typeof value === "function" ? value(...args) : value;
}
function applyAltSyncProperty(element, source = {}, ...args) {
    const value = String(getAltSyncPropertyValue(source, ...args) || "").trim();
    if (!element || !value) return;
    element.setAttribute("alt-sync", value);
}
function getHandlePropertyValue(source = {}, ...args) {
    const value = source?.handle;
    return typeof value === "function" ? value(...args) : value;
}
function applyHandleProperty(element, source = {}, ...args) {
    const value = getHandlePropertyValue(source, ...args);
    if (!element || value === undefined || value === null) return;
    element.setAttribute("handle", String(value));
}
HTMLElement.prototype.out = function () {
    let e = this;
    e.style.opacity = 1;
    let n = null;
    window.requestAnimationFrame(function i(o) {
        o -= n = n || o, e.style.opacity = 1 - Math.min(o / 50, 1), o < 50 ? window.requestAnimationFrame(i) : e.style.display = "none"
    })
};
HTMLElement.prototype.in = function () {
    let e = this;
    e.style.display = "block", e.style.opacity = 0;
    let i = null;
    window.requestAnimationFrame(function n(l) {
        l -= i = i || l, e.style.opacity = Math.min(l / 50, 1), l < 50 && window.requestAnimationFrame(n)
    })
};
Element.prototype.contextmenu = function (items, selector = null) {
    const ele = this;
    let lastClickedTarget = null;
    let menu = document.createElement("div");
    menu.className = "custom-context-menu hidden";
    const resolveItems = () => typeof items === "function" ? (items(ele, lastClickedTarget) || []) : (items || []);
    function buildMenu() {
        menu.innerHTML = "";
        let itemCount = 0;
        resolveItems().forEach(item => {
            if (typeof item?.visible === "function" && !item.visible(ele, lastClickedTarget)) return;
            if (item?.visible === false) return;
            if (item === "separator") {
                if (!itemCount) return;
                const hr = document.createElement("div");
                hr.style.height = "1px";
                hr.style.margin = "5px 0";
                hr.style.background = "var(--secondary-border)";
                menu.appendChild(hr);
                return;
            }
            itemCount += 1;
            const option = document.createElement("div");
            option.className = "context-menu-item";
            applyAltSyncProperty(option, item, ele, lastClickedTarget);
            applyHandleProperty(option, item, ele, lastClickedTarget);
            if (item.className) option.classList.add(...String(item.className).split(/\s+/).filter(Boolean));
            if (item.destructive) option.classList.add("text-red");
            const label = typeof item.label === "function" ? item.label(ele, lastClickedTarget) : item.label;
            if (item.content) {
                option.innerHTML = item.content;
            } else if (item.icon) {
                option.innerHTML = `${item.icon}<span>${label}</span>`;
            } else {
                option.textContent = label;
            }
            option.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                hideMenu();
                if (typeof item.action === "function") {
                    let target = lastClickedTarget;
                    if (selector && lastClickedTarget) {
                        target = lastClickedTarget.closest(selector);
                    }
                    item.action(ele, e, target);
                }
            };
            menu.appendChild(option);
        });
        return itemCount;
    }
    function showMenu(x, y) {
        menu.__altSyncOwnerWindow = ele.closest?.(".draggable-window") || null;
        if (!buildMenu()) {
            hideMenu();
            return;
        }
        menu.style.left = x + "px";
        menu.style.top = y + "px";
        menu.classList.remove("hidden");
        menu.in();
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                menu.style.left = (x - rect.width) + "px";
            }
            if (rect.bottom > window.innerHeight) {
                menu.style.top = (y - rect.height) + "px";
            }
        });
        menu.addEventListener("mouseleave", _ => menu.out());
    }
    function hideMenu() {
        menu.classList.add("hidden");
        menu.style.display = "none";
        menu.style.opacity = 0;
    }
    document.body.appendChild(menu);
    ele.addEventListener("contextmenu", (e) => {
        lastClickedTarget = e.target;
        if (!buildMenu()) return;
        e.preventDefault();
        showMenu(e.clientX, e.clientY);
    });
    document.addEventListener("click", hideMenu);
};
Element.prototype.popoutmenu = function (items, selector = null) {
    const ele = this;
    let lastClickedTarget = null;
    let menu = document.createElement("div");
    menu.className = "custom-context-menu hidden";
    const resolveItems = () => typeof items === "function" ? (items(ele, lastClickedTarget) || []) : (items || []);
    function buildMenu() {
        menu.innerHTML = "";
        resolveItems().forEach(item => {
            if (item === "separator") {
                const hr = document.createElement("div");
                hr.style.height = "1px";
                hr.style.margin = "5px 0";
                hr.style.background = "var(--secondary-border)";
                menu.appendChild(hr);
                return;
            }
            const option = document.createElement("div");
            option.className = "context-menu-item";
            applyAltSyncProperty(option, item, ele, lastClickedTarget);
            applyHandleProperty(option, item, ele, lastClickedTarget);
            if (item.className) option.classList.add(...String(item.className).split(/\s+/).filter(Boolean));
            if (item.destructive) option.classList.add("text-red");
            if (item.content) {
                option.innerHTML = item.content;
            } else if (item.icon) {
                option.innerHTML = `${item.icon}<span>${item.label}</span>`;
            } else {
                option.textContent = item.label;
            }
            option.onclick = (e) => {
                const interactiveTarget = e.target.closest('button, a, input, select, textarea, [contenteditable="true"]');
                if (item.interactive && interactiveTarget && option.contains(interactiveTarget)) return;
                e.preventDefault();
                e.stopPropagation();
                hideMenu();
                if (typeof item.action === "function") {
                    let target = lastClickedTarget;
                    if (selector && lastClickedTarget) {
                        target = lastClickedTarget.closest(selector);
                    }
                    item.action(ele, e, target);
                }
            };
            menu.appendChild(option);
            if (typeof item.bind === "function") item.bind(option, ele, lastClickedTarget, menu, hideMenu);
        });
    }
    function showMenu(x, y) {
        menu.__altSyncOwnerWindow = ele.closest?.(".draggable-window") || null;
        buildMenu();
        menu.style.left = x + "px";
        menu.style.top = y + "px";
        menu.classList.remove("hidden");
        menu.in();
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + "px";
            if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + "px";
        });
        menu.addEventListener("mouseleave", _ => menu.out());
    }
    function hideMenu() {
        menu.classList.add("hidden");
        menu.style.display = "none";
        menu.style.opacity = 0;
    }
    document.body.appendChild(menu);
    ele.addEventListener("click", (e) => {
        const interactiveTarget = e.target.closest('[data-onclick-id], [data-ondblclick-id], button, a, input, select, textarea, [contenteditable="true"]');
        if (interactiveTarget && interactiveTarget !== ele && ele.contains(interactiveTarget)) return;
        e.stopPropagation();
        lastClickedTarget = e.target;
        showMenu(e.clientX, e.clientY);
    });
    document.addEventListener("click", (e) => {
        if (!menu.contains(e.target)) hideMenu();
    });
};
function getLaunchInterfaceWindows() {
    return Array.from(document.querySelectorAll(".draggable-window:not(.widget-window):not(.minimized)"))
        .filter(element => document.body.contains(element))
        .sort((a, b) => {
            const aZ = Number.parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
            const bZ = Number.parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
            return bZ - aZ;
        });
}
function getLaunchInterfaceWindowLabel(windowNode, index = 0) {
    const title = `${windowNode?.portal?.title?.() || windowNode?.querySelector?.(".window-header .title")?.textContent || ""}`.trim();
    return title || `Interface ${index + 1}`;
}
function buildLaunchInterfaceMenuItems() {
    const windows = getLaunchInterfaceWindows();
    if (!windows.length) {
        return [{
            label: "No open interface windows",
            className: "faded",
            action: () => {}
        }];
    }
    return windows.map((windowNode, index) => ({
        label: getLaunchInterfaceWindowLabel(windowNode, index),
        action: () => {
            if (!document.body.contains(windowNode)) return;
            if (typeof modular?.bringToFront === "function") {
                modular.bringToFront(windowNode);
            }
        }
    }));
}
function setupLaunchInterfacesMenu() {
    const launcher = document.getElementById("launch-interfaces");
    if (!launcher || launcher.dataset.launchMenuReady === "true" || typeof launcher.popoutmenu !== "function") return;
    launcher.dataset.launchMenuReady = "true";
    launcher.popoutmenu(buildLaunchInterfaceMenuItems);
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupLaunchInterfacesMenu, {once: true});
} else {
    setupLaunchInterfacesMenu();
}
Element.prototype.empty = function () {
    for (; this.firstChild;) this.removeChild(this.firstChild)
};
Element.prototype.remove = function () {
    this.parentNode && this.parentNode.removeChild(this)
};
Element.prototype.prepend = function () {
    for (let t = 0; t < arguments.length; t++) {
        let e = arguments[t];
        if ("string" == typeof e) {
            let i = document.createElement("div");
            for (i.innerHTML = e.trim(); i.firstChild;) this.insertBefore(i.firstChild, this.firstChild)
        } else this.insertBefore(e, this.firstChild)
    }
};
Element.prototype.append = function () {
    for (let e = 0; e < arguments.length; e++) {
        let t = arguments[e];
        if ("string" == typeof t) {
            let i = document.createElement("div");
            for (i.innerHTML = t.trim(); i.firstChild;) this.appendChild(i.firstChild)
        } else this.appendChild(t)
    }
};
Element.prototype.animate = function (n, t, o, c) {
    let f = performance.now(), i = this, a = {}, e = {}, u = Object.keys(n);
    u.forEach(function (t) {
        a[t] = parseFloat(getComputedStyle(i)[t]), e[t] = parseFloat(n[t])
    }), "function" != typeof o && (o = function (n) {
        return n
    }), requestAnimationFrame(function n() {
        var r = performance.now() - f, p = o(r = Math.min(1, r / t));
        u.forEach(function (n) {
            var t = a[n];
            t += (e[n] - t) * p, i.style[n] = t + ("opacity" === n ? "" : "px")
        }), r < 1 ? requestAnimationFrame(n) : "function" == typeof c && c.call(i)
    })
};
Element.prototype.keydown = function (n) {
    let e, o = Date.now();
    this.addEventListener("keydown", t => {
        clearTimeout(e), o = Date.now(), e = setTimeout(() => {
            let e = Date.now(), w = e - o;
            w >= 600 && n(t)
        }, 600)
    })
};
Element.prototype.keyup = function (e) {
    let t, n = Date.now();
    this.addEventListener("keyup", o => {
        clearTimeout(t), n = Date.now(), t = setTimeout(() => {
            let t = Date.now(), p = t - n;
            p >= 200 && e(o)
        }, 200)
    })
};
(function () {
    const frames = ['⣷', '⣯', '⣟', '⡿', '⢿', '⣻', '⣽', '⣾'];
    Element.prototype.isLoading = function (state = true, speed = 80) {
        if (state === false) {
            if (this._loaderInterval) {
                clearInterval(this._loaderInterval);
                this._loaderInterval = null;
            }
            if (this._originalContent !== undefined) {
                this.innerHTML = this._originalContent;
                delete this._originalContent;
            } else {
                this.textContent = '';
            }
            return;
        }
        if (this._loaderInterval) return;
        this._originalContent = this.innerHTML;
        let i = 0;
        this._loaderInterval = setInterval(() => {
            this.textContent = frames[i];
            i = (i + 1) % frames.length;
        }, speed);
    };
})();
function pushMessage(type, t) {
    const text = `${t ?? ""}`.trim();
    if (!text) return;
    const message = document.createElement("div");
    message.classList.add("message");
    const normalizedType = `${type ?? ""}`.trim().toLowerCase();
    if (normalizedType === "error") {
        message.classList.add("background-red");
    } else if (normalizedType === "success") {
        message.classList.add("background-green");
    } else if (normalizedType) {
        message.classList.add(normalizedType);
    }
    message.textContent = text;
    document.body.appendChild(message);
    requestAnimationFrame(() => message.classList.add("show"));
    setTimeout(() => message.classList.remove("show"), 1400);
    setTimeout(() => message.remove(), 1800);
}
(function () {
    let activeOpenProgressToken = 0;
    const normalizeDownloadPath = (rawPath = "") => String(rawPath || "").replace(/^\/home\/standard-system\//, "").replace(/^\/+/, "");
    function ensureOpenProgress() {
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
    }
    function updateOpenProgress({label = "Opening file", loaded = 0, total = 0, indeterminate = false, token = 0} = {}) {
        if (token && token !== activeOpenProgressToken) return;
        const root = ensureOpenProgress();
        const labelNode = root.querySelector(".file-open-progress-label");
        const valueNode = root.querySelector(".file-open-progress-value");
        const barNode = root.querySelector(".file-open-progress-bar");
        const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((loaded / total) * 100))) : 0;
        if (labelNode) labelNode.textContent = label;
        if (valueNode) valueNode.textContent = indeterminate ? "Loading" : `${percent}%`;
        root.classList.toggle("indeterminate", !!indeterminate);
        if (barNode && !indeterminate) barNode.style.width = `${percent}%`;
        root.classList.add("show");
    }
    function hideOpenProgress(token = 0) {
        if (token && token !== activeOpenProgressToken) return;
        const root = document.getElementById("file-open-progress");
        if (!root) return;
        root.classList.remove("show");
    }
    function beginOpenProgress(label = "Opening file", options = {}) {
        const token = ++activeOpenProgressToken;
        updateOpenProgress({
            label,
            loaded: Number(options.loaded) || 0,
            total: Number(options.total) || 0,
            indeterminate: options.indeterminate !== false,
            token
        });
        return token;
    }
    async function downloadForOpen(rawPath = "", options = {}) {
        const pathNormalizer = typeof options.pathNormalizer === "function" ? options.pathNormalizer : normalizeDownloadPath;
        const filePath = pathNormalizer(rawPath);
        if (!filePath) throw new Error(options.emptyPathMessage || "File path is required");
        const token = ++activeOpenProgressToken;
        const fileName = filePath.split("/").pop() || options.fallbackFileName || "file";
        const label = options.label || `Opening ${fileName}`;
        updateOpenProgress({label, loaded: 0, total: 0, indeterminate: true, token});
        try {
            const url = options.url || `/api/files/download?path=${encodeURIComponent(filePath)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(options.errorMessage || `Download failed (${response.status})`);
            const total = Number(response.headers.get("content-length")) || 0;
            let blob;
            if (!response.body || typeof response.body.getReader !== "function") {
                blob = await response.blob();
            } else {
                const reader = response.body.getReader();
                const chunks = [];
                let loaded = 0;
                while (true) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    if (!value) continue;
                    chunks.push(value);
                    loaded += value.byteLength || value.length || 0;
                    updateOpenProgress({label, loaded, total, indeterminate: !(total > 0), token});
                }
                blob = new Blob(chunks, {type: response.headers.get("content-type") || "application/octet-stream"});
            }
            updateOpenProgress({
                label,
                loaded: total || blob.size,
                total: total || blob.size || 1,
                indeterminate: false,
                token
            });
            if (options.autoHide !== false) window.setTimeout(() => hideOpenProgress(token), options.hideDelay ?? 220);
            return {path: filePath, fileName, blob, contentType: response.headers.get("content-type") || "application/octet-stream", token};
        } catch (error) {
            hideOpenProgress(token);
            throw error;
        }
    }
    window.StandardDownloads = {
        ...(window.StandardDownloads || {}),
        normalizeDownloadPath,
        beginOpenProgress,
        updateOpenProgress,
        hideOpenProgress,
        downloadForOpen
    };
})();
window.StandardUI = window.StandardUI || {};
window.StandardUI.fontFamilies = window.StandardUI.fontFamilies || [
    "Inter",
    "Arial",
    "Aptos",
    "Calibri",
    "Cambria",
    "Candara",
    "Century Gothic",
    "Consolas",
    "Courier New",
    "Georgia",
    "Helvetica",
    "Lucida Console",
    "Palatino Linotype",
    "Segoe UI",
    "Tahoma",
    "Times New Roman",
    "Trebuchet MS",
    "Verdana"
];
(function () {
    const payloads = {};
    let comboIndex = 0;
    function escapeComboHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    function normalizeOption(option = {}) {
        const value = String(option?.value ?? option?.name ?? option?.label ?? "");
        const label = String(option?.label ?? option?.name ?? option?.value ?? value);
        return {label, value, disabled: option?.disabled === true};
    }
    function getPayload(input) {
        const comboId = input?.getAttribute?.("data-search-combobox-id") || "";
        return comboId && payloads[comboId] ? payloads[comboId] : null;
    }
    function getDropdown(input) {
        const comboId = input?.getAttribute?.("data-search-combobox-id") || "";
        return comboId ? document.getElementById(`search-combobox-options-${comboId}`) : null;
    }
    function getFilteredOptions(input) {
        const payload = getPayload(input);
        if (!payload) return [];
        const query = String(input?.value || "").toLowerCase().trim();
        return payload.options.filter((option) => {
            if (option.disabled) return false;
            if (!query) return true;
            return option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query);
        });
    }
    function canUseCustomValue(input) {
        const payload = getPayload(input);
        const value = String(input?.value || "").trim();
        return !!payload?.allowCustom && !!value;
    }
    function setActiveOption(input, index = 0) {
        const dropdown = getDropdown(input);
        if (!dropdown) return;
        const options = Array.from(dropdown.querySelectorAll(".search-combobox-option"));
        const boundedIndex = options.length ? Math.max(0, Math.min(index, options.length - 1)) : -1;
        input.dataset.searchComboboxActiveIndex = String(boundedIndex);
        options.forEach((option, optionIndex) => {
            const isActive = optionIndex === boundedIndex;
            option.classList.toggle("active", isActive);
            option.setAttribute("aria-selected", isActive ? "true" : "false");
            if (isActive) option.scrollIntoView({block: "nearest"});
        });
    }
    function renderOptions(input) {
        const dropdown = getDropdown(input);
        if (!dropdown) return;
        const filteredOptions = getFilteredOptions(input);
        dropdown.innerHTML = filteredOptions.map((option) => {
            return `<button type="button" class="search-combobox-option" role="option" data-search-combobox-value="${escapeComboHtml(option.value)}" data-search-combobox-label="${escapeComboHtml(option.label)}" style="font-family:${escapeComboHtml(option.value)}">${escapeComboHtml(option.label)}</button>`;
        }).join("");
        if (!filteredOptions.length) {
            const customValue = String(input?.value || "").trim();
            dropdown.innerHTML = canUseCustomValue(input)
                ? `<button type="button" class="search-combobox-option" role="option" data-search-combobox-custom="1" data-search-combobox-value="${escapeComboHtml(customValue)}" data-search-combobox-label="${escapeComboHtml(customValue)}">Use ${escapeComboHtml(customValue)}</button>`
                : `<div class="search-combobox-option-empty">No matches</div>`;
        }
        dropdown.style.display = "block";
        input.setAttribute("aria-expanded", "true");
        setActiveOption(input, 0);
    }
    function hideOptions(input) {
        const dropdown = getDropdown(input);
        if (dropdown) dropdown.style.display = "none";
        input?.setAttribute?.("aria-expanded", "false");
    }
    function commitOption(input, option, {dispatch = true} = {}) {
        if (!input || !option) return false;
        input.value = option.label;
        input.setAttribute("value", option.label);
        input.dataset.searchComboboxSelectedValue = option.value;
        input.dataset.searchComboboxSelectedLabel = option.label;
        hideOptions(input);
        if (dispatch) {
            input.dataset.searchComboboxCommitting = "1";
            input.dispatchEvent(new Event("change", {bubbles: true}));
            delete input.dataset.searchComboboxCommitting;
        }
        return true;
    }
    function commitCustomValue(input, {dispatch = true} = {}) {
        const value = String(input?.value || "").trim();
        if (!input || !canUseCustomValue(input)) return false;
        return commitOption(input, {label: value, value}, {dispatch});
    }
    function findOptionByValue(input, value = "") {
        const payload = getPayload(input);
        const normalizedValue = String(value || "").trim().toLowerCase();
        if (!payload || !normalizedValue) return null;
        return payload.options.find((option) => option.value.toLowerCase() === normalizedValue || option.label.toLowerCase() === normalizedValue) || null;
    }
    function getActiveOption(input) {
        const options = getFilteredOptions(input);
        if (!options.length) return null;
        const activeIndex = Number(input?.dataset?.searchComboboxActiveIndex || 0);
        return options[Math.max(0, Math.min(activeIndex, options.length - 1))] || null;
    }
    function getInputForOption(optionNode) {
        const wrapper = optionNode?.closest?.(".search-combobox-wrapper");
        return wrapper?.querySelector?.("input[data-search-combobox-id]") || null;
    }
    function commitOptionNode(optionNode, event = null) {
        if (!optionNode) return false;
        event?.preventDefault?.();
        const input = getInputForOption(optionNode);
        if (optionNode.getAttribute("data-search-combobox-custom") === "1") {
            return commitCustomValue(input);
        }
        const value = optionNode.getAttribute("data-search-combobox-value") || "";
        const label = optionNode.getAttribute("data-search-combobox-label") || "";
        if (input?.dataset?.searchComboboxSelectedValue === value && input.value === label) {
            hideOptions(input);
            input?.focus?.();
            return true;
        }
        const didCommit = commitOption(input, {
            value,
            label
        });
        if (didCommit) input?.focus?.();
        return didCommit;
    }
    window.StandardUI.getSearchComboBoxValue = (input) => {
        if (!input) return "";
        return input.dataset.searchComboboxSelectedValue || input.value || "";
    };
    window.StandardUI.setSearchComboBoxValue = (input, value = "", options = {}) => {
        const matchedOption = findOptionByValue(input, value);
        if (matchedOption) return commitOption(input, matchedOption, {dispatch: options.dispatch === true});
        const payload = getPayload(input);
        const nextValue = String(value || "");
        input.value = nextValue;
        if (payload?.allowCustom && nextValue) {
            input.dataset.searchComboboxSelectedValue = nextValue;
            input.dataset.searchComboboxSelectedLabel = nextValue;
        } else {
            input.dataset.searchComboboxSelectedValue = nextValue;
            input.dataset.searchComboboxSelectedLabel = nextValue;
        }
        if (options.dispatch === true) {
            input.dataset.searchComboboxCommitting = "1";
            input.dispatchEvent(new Event("change", {bubbles: true}));
            delete input.dataset.searchComboboxCommitting;
        }
        return false;
    };
    window.searchComboBox = function (config = {}) {
        const comboId = `combo-${comboIndex++}`;
        const wrapper = document.createElement("div");
        wrapper.className = config.wrapperStyle || "search-combobox-wrapper searchbox-wrapper";
        const input = document.createElement("input");
        input.type = "text";
        input.autocomplete = "off";
        input.setAttribute("role", "combobox");
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("aria-expanded", "false");
        input.setAttribute("data-search-combobox-id", comboId);
        if (config.allow_custom === true) input.setAttribute("data-search-combobox-allow-custom", "true");
        if (config.id) input.id = config.id;
        if (config.name) input.name = config.name;
        if (config.title) input.title = config.title;
        applyAltSyncProperty(input, config);
        applyHandleProperty(input, config);
        if (config.placeholder) input.placeholder = config.placeholder;
        if (config.style) input.className = config.style;
        if (config.value) input.value = config.value;
        const dropdown = document.createElement("div");
        dropdown.id = `search-combobox-options-${comboId}`;
        dropdown.className = config.dropdownStyle || "search-combobox-options searchbox-options";
        dropdown.setAttribute("role", "listbox");
        dropdown.style.display = "none";
        wrapper.append(input, dropdown);
        payloads[comboId] = {
            allowCustom: config.allow_custom === true,
            options: (Array.isArray(config.options) ? config.options : []).map(normalizeOption)
        };
        if (config.value) {
            const matchedOption = payloads[comboId].options.find((option) => option.value === config.value || option.label === config.value);
            if (matchedOption) {
                input.value = matchedOption.label;
                input.dataset.searchComboboxSelectedValue = matchedOption.value;
                input.dataset.searchComboboxSelectedLabel = matchedOption.label;
            }
        }
        return wrapper.outerHTML;
    };
    document.addEventListener("input", (event) => {
        const input = event.target?.closest?.("input[data-search-combobox-id]");
        if (!input) return;
        renderOptions(input);
    });
    document.addEventListener("change", (event) => {
        const input = event.target?.closest?.("input[data-search-combobox-id]");
        if (!input || input.dataset.searchComboboxCommitting === "1") return;
        const matchedOption = findOptionByValue(input, input.value);
        if (matchedOption) {
            commitOption(input, matchedOption);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (commitCustomValue(input)) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (input.dataset.searchComboboxSelectedLabel) {
            input.value = input.dataset.searchComboboxSelectedLabel;
        }
        event.preventDefault();
        event.stopPropagation();
    }, true);
    document.addEventListener("focusin", (event) => {
        const input = event.target?.closest?.("input[data-search-combobox-id]");
        if (!input) return;
        renderOptions(input);
        input.select?.();
    });
    document.addEventListener("keydown", (event) => {
        const input = event.target?.closest?.("input[data-search-combobox-id]");
        if (!input) return;
        if (event.key === "Escape") {
            hideOptions(input);
            return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            renderOptions(input);
            const currentIndex = Number(input.dataset.searchComboboxActiveIndex || 0);
            setActiveOption(input, currentIndex + (event.key === "ArrowDown" ? 1 : -1));
            return;
        }
        if (event.key === "Enter") {
            const matchedOption = findOptionByValue(input, input.value) || getActiveOption(input);
            if (!matchedOption && commitCustomValue(input)) {
                event.preventDefault();
                return;
            }
            if (!matchedOption) return;
            event.preventDefault();
            commitOption(input, matchedOption);
        }
    });
    document.addEventListener("pointerdown", (event) => {
        const optionNode = event.target?.closest?.(".search-combobox-option");
        if (!optionNode) return;
        commitOptionNode(optionNode, event);
    });
    document.addEventListener("click", (event) => {
        const optionNode = event.target?.closest?.(".search-combobox-option");
        if (!optionNode) return;
        commitOptionNode(optionNode, event);
    });
    document.addEventListener("click", (event) => {
        document.querySelectorAll("input[data-search-combobox-id]").forEach((input) => {
            if (!input.closest(".search-combobox-wrapper")?.contains(event.target)) hideOptions(input);
        });
    });
    document.addEventListener("focusout", (event) => {
        const input = event.target?.closest?.("input[data-search-combobox-id]");
        if (!input) return;
        window.setTimeout(() => {
            if (!input.closest(".search-combobox-wrapper")?.contains(document.activeElement)) hideOptions(input);
        }, 0);
    });
})();
window.StandardUI.altSync = window.StandardUI.altSync || (() => {
    const OVERLAY_CLASS = "alt-sync-overlay";
    const ATTRIBUTE_NAME = "alt-sync";
    const ACTIVE_STYLE = {
        position: "fixed",
        backgroundColor: "#edbe00",
        color: "#000",
        padding: "2px 4px",
        borderRadius: "4px",
        fontSize: "14px",
        lineHeight: "1",
        zIndex: "2147483647",
        pointerEvents: "none",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.16)"
    };
    let active = false;
    let initialized = false;
    let overlayLayer = null;
    let overlayEntries = [];
    let activeSequence = "";
    let pendingExactTimer = null;
    const PENDING_EXACT_DELAY = 700;
    function getFocusedInterfaceWindow() {
        const focusedWindow = document.querySelector(".draggable-window.window-focused");
        if (focusedWindow) return focusedWindow;
        const windows = Array.from(document.querySelectorAll(".draggable-window"));
        return windows.reduce((frontWindow, windowNode) => {
            const frontZ = Number.parseInt(frontWindow?.style?.zIndex || "0", 10) || 0;
            const nodeZ = Number.parseInt(windowNode?.style?.zIndex || "0", 10) || 0;
            return nodeZ > frontZ ? windowNode : frontWindow;
        }, null);
    }
    function getTargetInterfaceWindow(target) {
        const menu = target?.closest?.(".custom-context-menu");
        if (menu?.__altSyncOwnerWindow?.isConnected) return menu.__altSyncOwnerWindow;
        return target?.closest?.(".draggable-window") || null;
    }
    function isTargetInFocusedInterface(target) {
        const targetWindow = getTargetInterfaceWindow(target);
        if (!targetWindow) return true;
        return targetWindow === getFocusedInterfaceWindow();
    }
    function ensureOverlayLayer() {
        if (overlayLayer?.isConnected) return overlayLayer;
        if (!document.body) return null;
        overlayLayer = document.createElement("div");
        overlayLayer.className = "alt-sync-overlay-layer";
        overlayLayer.setAttribute("aria-hidden", "true");
        Object.assign(overlayLayer.style, {position: "fixed", inset: "0", pointerEvents: "none", zIndex: "2147483647"});
        document.body.appendChild(overlayLayer);
        return overlayLayer;
    }
    function getTargets() {
        const visibleTargets = Array.from(document.querySelectorAll(`[${ATTRIBUTE_NAME}]`)).filter(target => {
            const label = String(target.getAttribute(ATTRIBUTE_NAME) || "").trim();
            if (!label) return false;
            if (!target.isConnected) return false;
            const rect = target.getBoundingClientRect();
            const style = getComputedStyle(target);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        });
        const focusedTargets = visibleTargets.filter(isTargetInFocusedInterface).filter(target => getTargetInterfaceWindow(target));
        return focusedTargets.length ? focusedTargets : visibleTargets.filter(target => !getTargetInterfaceWindow(target));
    }
    function normalizeKey(value = "") {
        return String(value || "").trim().toUpperCase();
    }
    function clearPendingExact() {
        if (!pendingExactTimer) return;
        window.clearTimeout(pendingExactTimer);
        pendingExactTimer = null;
    }
    function clearOverlays() {
        clearPendingExact();
        overlayEntries.forEach(({overlay}) => overlay.remove());
        overlayEntries = [];
        if (overlayLayer) {
            overlayLayer.remove();
            overlayLayer = null;
        }
    }
    function positionOverlays() {
        overlayEntries = overlayEntries.filter(entry => entry.target?.isConnected && entry.overlay?.isConnected);
        overlayEntries.forEach(({target, overlay}) => {
            const rect = target.getBoundingClientRect();
            overlay.style.left = `${Math.max(0, rect.left) - 3}px`;
            overlay.style.top = `${Math.max(0, rect.top) - 3}px`;
        });
    }
    function showOverlays() {
        clearOverlays();
        const layer = ensureOverlayLayer();
        if (!layer) return;
        overlayEntries = getTargets().map(target => {
            const overlay = document.createElement("div");
            overlay.className = OVERLAY_CLASS;
            overlay.textContent = normalizeKey(target.getAttribute(ATTRIBUTE_NAME));
            Object.assign(overlay.style, ACTIVE_STYLE);
            layer.appendChild(overlay);
            return {target, overlay};
        });
        positionOverlays();
    }
    function deactivate() {
        active = false;
        activeSequence = "";
        clearOverlays();
    }
    function activate() {
        active = true;
        activeSequence = "";
        showOverlays();
    }
    function getMatchesForSequence(sequence = "") {
        const normalizedSequence = normalizeKey(sequence);
        if (!normalizedSequence) return {exact: null, hasLongerPrefix: false};
        return getTargets().reduce((matches, target) => {
            const targetKey = normalizeKey(target.getAttribute(ATTRIBUTE_NAME));
            if (targetKey === normalizedSequence && !matches.exact) matches.exact = target;
            if (targetKey.length > normalizedSequence.length && targetKey.startsWith(normalizedSequence)) matches.hasLongerPrefix = true;
            return matches;
        }, {exact: null, hasLongerPrefix: false});
    }
    function triggerTarget(target) {
        if (!target) return;
        target.scrollIntoView({behavior: "smooth", block: "center", inline: "center"});
        const rect = target.getBoundingClientRect();
        const clientX = rect.left + (rect.width / 2);
        const clientY = rect.top + (rect.height / 2);
        const modularState = typeof modular !== "undefined" ? modular : window.modular;
        if (modularState) {
            modularState.lastClickPosition = {x: clientX, y: clientY};
            modularState.lastPointerPosition = {x: clientX, y: clientY};
        }
        if (target.matches?.("input, textarea, select, [contenteditable='true'], [tabindex]")) {
            target.focus?.({preventScroll: true});
            if (target.matches?.("input[type='text'], input:not([type]), textarea")) target.select?.();
        }
        target.dispatchEvent(new MouseEvent("mousedown", {bubbles: true, cancelable: true, clientX, clientY}));
        target.dispatchEvent(new MouseEvent("mouseup", {bubbles: true, cancelable: true, clientX, clientY}));
        target.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true, clientX, clientY}));
    }
    function handleKeydown(event) {
        if (event.defaultPrevented) return;
        if (event.key === "Alt") {
            if (event.repeat) return;
            if (active) deactivate();
            else activate();
            event.preventDefault();
            return;
        }
        if (!active) return;
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === "Escape") {
            deactivate();
            return;
        }
        if (event.key.length !== 1) return;
        clearPendingExact();
        activeSequence = normalizeKey(`${activeSequence}${event.key}`);
        let matches = getMatchesForSequence(activeSequence);
        if (!matches.exact && !matches.hasLongerPrefix && activeSequence.length > 1) {
            activeSequence = normalizeKey(event.key);
            matches = getMatchesForSequence(activeSequence);
        }
        if (!matches.exact && !matches.hasLongerPrefix) {
            activeSequence = "";
            return;
        }
        event.preventDefault();
        if (matches.exact && !matches.hasLongerPrefix) {
            deactivate();
            triggerTarget(matches.exact);
            return;
        }
        if (matches.exact) {
            const pendingTarget = matches.exact;
            pendingExactTimer = window.setTimeout(() => {
                pendingExactTimer = null;
                if (!active || activeSequence !== normalizeKey(pendingTarget.getAttribute(ATTRIBUTE_NAME))) return;
                deactivate();
                triggerTarget(pendingTarget);
            }, PENDING_EXACT_DELAY);
        }
    }
    function handlePointerdown(event) {
        if (!active) return;
        if (event.target?.closest?.(`.${OVERLAY_CLASS}, .alt-sync-overlay-layer`)) return;
        deactivate();
    }
    function init() {
        if (initialized) return;
        initialized = true;
        document.addEventListener("keydown", handleKeydown);
        document.addEventListener("pointerdown", handlePointerdown, true);
        window.addEventListener("blur", deactivate);
        window.addEventListener("resize", () => {
            if (active) positionOverlays();
        });
        window.addEventListener("scroll", () => {
            if (active) positionOverlays();
        }, true);
    }
    return {init, activate, deactivate, isActive: () => active};
})();
let activeUploadProgressToken = 0;
let activeMultiUploadProgressToken = 0;
function ensureUploadProgress() {
    let root = document.getElementById("file-upload-progress");
    if (root) return root;
    root = document.createElement("div");
    root.id = "file-upload-progress";
    root.className = "file-open-progress";
    root.innerHTML = `
        <div class="file-open-progress-header">
            <div class="file-open-progress-label">Uploading file</div>
            <div class="file-open-progress-value">0%</div>
        </div>
        <div class="file-open-progress-track" aria-hidden="true">
            <div class="file-open-progress-bar"></div>
        </div>
    `;
    document.body.appendChild(root);
    return root;
}
function updateUploadProgress({label = "Uploading file", loaded = 0, total = 0, indeterminate = false, token = 0} = {}) {
    if (token && token !== activeUploadProgressToken) return;
    const root = ensureUploadProgress();
    const labelNode = root.querySelector(".file-open-progress-label");
    const valueNode = root.querySelector(".file-open-progress-value");
    const barNode = root.querySelector(".file-open-progress-bar");
    const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((loaded / total) * 100))) : 0;
    if (labelNode) labelNode.textContent = label;
    if (valueNode) valueNode.textContent = indeterminate ? "Uploading" : `${percent}%`;
    root.classList.toggle("indeterminate", !!indeterminate);
    if (barNode && !indeterminate) barNode.style.width = `${percent}%`;
    root.classList.add("show");
}
function hideUploadProgress(token = 0) {
    if (token && token !== activeUploadProgressToken) return;
    const root = document.getElementById("file-upload-progress");
    if (!root) return;
    root.classList.remove("show");
}
function ensureMultiUploadProgress() {
    let root = document.getElementById("multi-file-upload-progress");
    if (root) return root;
    root = document.createElement("div");
    root.id = "multi-file-upload-progress";
    root.className = "file-open-progress file-upload-multi-progress interactive";
    root.innerHTML = `
        <div class="file-open-progress-header file-upload-multi-header">
            <button class="file-upload-multi-toggle naked" type="button" title="Show pending uploads" aria-expanded="false">+</button>
            <div class="file-upload-multi-title">
                <div class="file-open-progress-label">Uploading files</div>
                <div class="file-upload-multi-current">Preparing upload</div>
            </div>
            <div class="file-open-progress-value">0%</div>
        </div>
        <div class="file-open-progress-track" aria-hidden="true">
            <div class="file-open-progress-bar"></div>
        </div>
        <div class="file-upload-multi-pending" hidden>
            <div class="file-upload-multi-pending-label">Pending files</div>
            <div class="file-upload-multi-pending-list"></div>
        </div>
    `;
    document.body.appendChild(root);
    return root;
}
function createMultiFileProgress(files = []) {
    const root = ensureMultiUploadProgress();
    const token = ++activeMultiUploadProgressToken;
    const fileList = Array.from(files || []);
    const toggleNode = root.querySelector(".file-upload-multi-toggle");
    const labelNode = root.querySelector(".file-open-progress-label");
    const currentNode = root.querySelector(".file-upload-multi-current");
    const valueNode = root.querySelector(".file-open-progress-value");
    const barNode = root.querySelector(".file-open-progress-bar");
    const pendingNode = root.querySelector(".file-upload-multi-pending");
    const pendingListNode = root.querySelector(".file-upload-multi-pending-list");
    let expanded = false;
    const renderPending = (currentIndex = 0) => {
        if (!pendingListNode) return;
        const pendingFiles = fileList.slice(currentIndex + 1);
        pendingListNode.replaceChildren();
        if (!pendingFiles.length) {
            const emptyNode = document.createElement("div");
            emptyNode.className = "file-upload-multi-pending-empty";
            emptyNode.textContent = "No pending files";
            pendingListNode.appendChild(emptyNode);
            return;
        }
        pendingFiles.forEach((pendingFile, offset) => {
            const itemNode = document.createElement("div");
            itemNode.className = "file-upload-multi-pending-item";
            const indexNode = document.createElement("span");
            indexNode.className = "file-upload-multi-pending-index";
            indexNode.textContent = String(currentIndex + offset + 2);
            const nameNode = document.createElement("span");
            nameNode.className = "file-upload-multi-pending-name";
            nameNode.textContent = pendingFile?.name || "file";
            itemNode.append(indexNode, nameNode);
            pendingListNode.appendChild(itemNode);
        });
    };
    const setExpanded = nextExpanded => {
        expanded = !!nextExpanded;
        root.classList.toggle("expanded", expanded);
        if (pendingNode) pendingNode.hidden = !expanded;
        if (toggleNode) {
            toggleNode.textContent = expanded ? "-" : "+";
            toggleNode.setAttribute("aria-expanded", expanded ? "true" : "false");
            toggleNode.setAttribute("title", expanded ? "Hide pending uploads" : "Show pending uploads");
        }
    };
    if (toggleNode) {
        toggleNode.onclick = event => {
            event.preventDefault();
            event.stopPropagation();
            setExpanded(!expanded);
        };
    }
    setExpanded(false);
    renderPending(0);
    return {
        update({currentIndex = 0, file = null, loaded = 0, total = 0, indeterminate = false} = {}) {
            const currentFile = file || fileList[currentIndex] || null;
            const totalFiles = fileList.length || 1;
            const safeIndex = Math.max(0, Math.min(totalFiles - 1, Number(currentIndex) || 0));
            const percent = total > 0 ? Math.max(0, Math.min(100, Math.round((loaded / total) * 100))) : 0;
            if (labelNode) labelNode.textContent = `Uploading ${safeIndex + 1} of ${totalFiles}`;
            if (currentNode) currentNode.textContent = currentFile?.name || "file";
            if (valueNode) valueNode.textContent = indeterminate ? "Uploading" : `${percent}%`;
            root.classList.toggle("indeterminate", !!indeterminate);
            if (barNode && !indeterminate) barNode.style.width = `${percent}%`;
            renderPending(safeIndex);
            root.classList.add("show");
        },
        hide(delay = 220) {
            window.setTimeout(() => {
                if (token === activeMultiUploadProgressToken) root.classList.remove("show");
            }, delay);
        }
    };
}
window.StandardUploads = window.StandardUploads || {};
window.StandardUploads.createMultiFileProgress = createMultiFileProgress;
window.StandardUploads.uploadFile = (file, url, options = {}) => new Promise((resolve, reject) => {
    if (!(file instanceof File)) {
        reject(new Error("A file is required"));
        return;
    }
    const uploadUrl = String(url || "").trim();
    if (!uploadUrl) {
        reject(new Error("An upload URL is required"));
        return;
    }
    const token = ++activeUploadProgressToken;
    const fieldName = String(options?.fieldName || "file");
    const label = String(options?.label || `Uploading ${file.name || "file"}`);
    const formData = new FormData();
    formData.append(fieldName, file);
    const extraFields = options?.fields && typeof options.fields === "object" ? options.fields : null;
    if (extraFields) {
        Object.entries(extraFields).forEach(([key, value]) => {
            if (value === undefined || value === null) return;
            formData.append(key, value);
        });
    }
    const reportProgress = progressState => {
        if (typeof options?.onProgress === "function") options.onProgress(progressState);
        if (!options?.suppressProgress) updateUploadProgress({...progressState, token});
    };
    reportProgress({label, loaded: 0, total: file.size || 0, indeterminate: !(file.size > 0)});
    const xhr = new XMLHttpRequest();
    xhr.open(String(options?.method || "POST"), uploadUrl, true);
    xhr.upload.onprogress = event => {
        reportProgress({
            label,
            loaded: Number(event?.loaded) || 0,
            total: Number(event?.total) || file.size || 0,
            indeterminate: !event?.lengthComputable
        });
    };
    xhr.onerror = () => {
        if (!options?.suppressProgress) hideUploadProgress(token);
        reject(new Error("Upload failed"));
    };
    xhr.onabort = () => {
        if (!options?.suppressProgress) hideUploadProgress(token);
        reject(new Error("Upload aborted"));
    };
    xhr.onload = () => {
        reportProgress({
            label,
            loaded: file.size || 1,
            total: file.size || 1,
            indeterminate: false
        });
        if (!options?.suppressProgress) window.setTimeout(() => hideUploadProgress(token), 220);
        resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            responseText: xhr.responseText,
            xhr
        });
    };
    xhr.send(formData);
});
const THEME_BACKGROUND_CACHE_KEY = "ui-background";
const THEME_BACKGROUND_CACHE_INTERFACE = "com.standard.settings";
const THEME_BACKGROUND_META_KEY = "ui-background-meta";
let currentThemeBackgroundObjectUrl = "";
async function resolveThemeBackgroundSource(backgroundSetting) {
    if (!backgroundSetting) return "";
    if (typeof backgroundSetting === "string") {
        const trimmed = backgroundSetting.trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("data:") || trimmed.startsWith("blob:") || trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
            return trimmed;
        }
        return `/api/user-data/${encodeURIComponent(trimmed)}`;
    }
    if (backgroundSetting !== true) return "";
    try {
        const metadata = await window.StandardBrowserCache?.get?.(THEME_BACKGROUND_CACHE_INTERFACE, THEME_BACKGROUND_META_KEY, {format: "json"});
        const format = `${metadata?.format || ""}`.trim().replace(/[^a-z0-9]/gi, "").toLowerCase();
        if (!format) return "";
        const imageBlob = await window.StandardBrowserCache?.get?.(THEME_BACKGROUND_CACHE_INTERFACE, THEME_BACKGROUND_CACHE_KEY, {format, responseType: "blob"});
        if (!imageBlob || !imageBlob.size) return "";
        if (currentThemeBackgroundObjectUrl) {
            URL.revokeObjectURL(currentThemeBackgroundObjectUrl);
            currentThemeBackgroundObjectUrl = "";
        }
        currentThemeBackgroundObjectUrl = URL.createObjectURL(imageBlob);
        return currentThemeBackgroundObjectUrl;
    } catch (error) {
        console.error("Failed to resolve theme background image", error);
        return "";
    }
}
function applyResolvedThemeBackground(source = "") {
    const targets = [document.documentElement, document.body];
    const resolvedSource = `${source || ""}`.trim();
    if (currentThemeBackgroundObjectUrl && resolvedSource !== currentThemeBackgroundObjectUrl) {
        URL.revokeObjectURL(currentThemeBackgroundObjectUrl);
        currentThemeBackgroundObjectUrl = "";
    }
    if (resolvedSource) {
        targets.forEach(target => {
            target.style.backgroundImage = `url("${resolvedSource}")`;
            target.style.backgroundSize = "cover";
            target.style.backgroundPosition = "center center";
            target.style.backgroundRepeat = "no-repeat";
            target.style.backgroundAttachment = "fixed";
        });
        document.body.style.minHeight = "100vh";
    } else {
        targets.forEach(target => {
            target.style.backgroundImage = "none";
            target.style.backgroundAttachment = "scroll";
        });
    }
    window.StandardUI = window.StandardUI || {};
    window.StandardUI.currentBackgroundImageSource = resolvedSource;
    return resolvedSource;
}
function getAppliedThemeBackgroundImageUrl() {
    const targets = [document.body, document.documentElement];
    for (const target of targets) {
        if (!target) continue;
        const value = window.getComputedStyle(target).backgroundImage || target.style.backgroundImage || "";
        const match = value.match(/^url\((.*)\)$/i);
        if (!match) continue;
        return match[1].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
    return "";
}
async function applyThemeData(d) {
    if (!d) return false;
    window.StandardUI = window.StandardUI || {};
    const defaultTheme = window.StandardUI.defaultTheme || defaultThemeData;
    d = {...defaultTheme, ...d};
    window.StandardUI.currentTheme = d;
    document.documentElement.style.setProperty("--fs", `${d.font_size}px`);
    document.documentElement.style.setProperty("--fg", d.foreground);
    document.documentElement.style.setProperty("--primary", d.primary);
    document.documentElement.style.setProperty("--secondary", d.secondary);
    document.documentElement.style.setProperty("--bg", d.background);
    document.documentElement.style.setProperty("--border", d.border_color);
    document.documentElement.style.setProperty("--radius", `${d.border_radius}px`);
    const shadowsEnabled = d.shadows !== false;
    document.documentElement.style.setProperty("--small-shadow", shadowsEnabled ? "0 4px 12px rgba(5, 5, 5, 0.08)" : "none");
    document.documentElement.style.setProperty("--shadow", shadowsEnabled ? "0 8px 32px rgba(0, 0, 0, 0.1)" : "none");
    document.documentElement.style.setProperty("--darker-shadow", shadowsEnabled ? "4px 4px 10px rgba(0, 0, 0, 0.3)" : "none");
    const backgroundSource = await resolveThemeBackgroundSource(d.background_image);
    applyResolvedThemeBackground(backgroundSource);
    document.body.dataset.useSvgIcons = d.use_svg_icons === false ? "false" : "true";
    if (d.hide_shortcuts) {
        document.getElementById("interface-shortcuts")?.classList.add("none");
    } else {
        document.getElementById("interface-shortcuts")?.classList.remove("none");
    }
    if (typeof modular?.renderInterfaceShortcuts === "function") {
        modular.renderInterfaceShortcuts();
    }
    if (typeof modular?.refreshPortalIcons === "function") {
        modular.refreshPortalIcons();
    }
    window.StandardUI.setKioskMode?.(d.kiosk_mode === true);
    window.StandardUI.setDisableBar?.(d.disable_bar === true);
    return true;
}
let themeRefreshInFlight = null;
function readThemeCookieValue(name = "") {
    const escaped = String(name || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
    if (!match) return null;
    try {
        return decodeURIComponent(match[1]);
    } catch (_) {
        return match[1];
    }
}
function decodeThemeUserCookie(value = "") {
    if (!value || typeof value !== "string") return null;
    try {
        const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
        return JSON.parse(atob(padded));
    } catch (_) {
        return null;
    }
}
function normalizeThemeUserRecord(payload) {
    if (!payload) return null;
    let record = null;
    if (Array.isArray(payload)) record = payload[0] || null;
    else if (Array.isArray(payload.user)) record = payload.user[0] || null;
    else if (payload.user && typeof payload.user === "object") record = payload.user;
    else if (typeof payload === "object" && !Array.isArray(payload)) record = payload;
    if (!record || typeof record !== "object" || Array.isArray(record)) return null;
    const normalized = {...record};
    if ((normalized.settings === undefined || normalized.settings === null || normalized.settings === "") && normalized.theme !== undefined) {
        normalized.settings = normalized.theme;
    }
    if ((normalized.theme === undefined || normalized.theme === null || normalized.theme === "") && normalized.settings !== undefined) {
        normalized.theme = normalized.settings;
    }
    return normalized;
}
function parseThemeSettingsValue(value) {
    let candidate = value;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (!candidate) return null;
        if (typeof candidate === "object" && !Array.isArray(candidate)) return candidate;
        if (typeof candidate !== "string") return null;
        const trimmed = candidate.trim();
        if (!trimmed) return null;
        try {
            candidate = JSON.parse(trimmed);
            continue;
        } catch (_) {
        }
        try {
            candidate = JSON.parse(trimmed.replace(/\\"/g, "\"").replace(/\\\\/g, "\\"));
            continue;
        } catch (_) {
        }
        return null;
    }
    return (candidate && typeof candidate === "object" && !Array.isArray(candidate)) ? candidate : null;
}
function getThemeFromUserCookie() {
    const cookieValue = readThemeCookieValue("user");
    const userRecord = normalizeThemeUserRecord(decodeThemeUserCookie(cookieValue));
    return parseThemeSettingsValue(userRecord?.settings) || parseThemeSettingsValue(userRecord?.theme);
}
const defaultThemeData = {
    name: "Default",
    font_family: "",
    bold_font: false,
    transparency: true,
    shadows: true,
    font_size: 16,
    foreground: "#3e3e3e",
    primary: "#001922",
    secondary: "",
    background: "#d1d1d1",
    background_image: undefined,
    border_color: "#afafaf",
    border_radius: 10,
    border_width: 1,
    interface_state: true,
    use_svg_icons: true,
    hide_shortcuts: false,
    kiosk_mode: false,
    disable_bar: false,
    media_widget: true,
    video_widget: true
};
window.StandardUI = window.StandardUI || {};
window.StandardUI.defaultTheme = window.StandardUI.defaultTheme || {...defaultThemeData};
window.StandardUI.setKioskMode = async (enabled = false) => {
    const shouldEnable = enabled === true;
    let electronApplied = false;
    if (window.StandardElectron?.setKioskMode) {
        try {
            electronApplied = await window.StandardElectron.setKioskMode(shouldEnable);
        } catch (error) {
            console.error("Failed to sync Electron kiosk mode", error);
        }
    }
    if (shouldEnable) {
        if (document.fullscreenElement) return true;
        try {
            const target = document.documentElement;
            if (target?.requestFullscreen) {
                await target.requestFullscreen();
                return true;
            }
        } catch (error) {
            if (!window.StandardElectron?.setKioskMode) {
                console.error("Failed to enter fullscreen", error);
                return false;
            }
        }
        return electronApplied;
    }
    try {
        if (document.fullscreenElement && document.exitFullscreen) {
            await document.exitFullscreen();
            return true;
        }
    } catch (error) {
        if (!window.StandardElectron?.setKioskMode) {
            console.error("Failed to exit fullscreen", error);
            return false;
        }
    }
    return window.StandardElectron?.setKioskMode ? electronApplied : true;
};
window.StandardUI.setDisableBar = (() => {
    const DOUBLE_ALT_DELAY = 520;
    let disabled = false;
    let visible = false;
    let lastAltKeyupAt = 0;
    let hideListenersBound = false;
    function getBar() {
        return document.querySelector("header");
    }
    function removeHideListeners() {
        if (!hideListenersBound) return;
        hideListenersBound = false;
        document.removeEventListener("keydown", handleShownKeydown, true);
        window.removeEventListener("blur", hideBar);
    }
    function syncClasses() {
        const bar = getBar();
        if (!bar) return;
        document.body.classList.toggle("standard-bar-disabled", disabled);
        bar.classList.toggle("standard-bar-hidden", disabled && !visible);
        bar.classList.toggle("standard-bar-visible", disabled && visible);
        bar.setAttribute("aria-hidden", disabled && !visible ? "true" : "false");
    }
    function hideBar() {
        if (!disabled) return;
        visible = false;
        syncClasses();
        removeHideListeners();
    }
    function showBar() {
        if (!disabled) return;
        visible = true;
        syncClasses();
        if (!hideListenersBound) {
            hideListenersBound = true;
            document.addEventListener("keydown", handleShownKeydown, true);
            window.addEventListener("blur", hideBar);
        }
    }
    function handleShownKeydown(event) {
        if (!visible) return;
        if (event.key !== "Alt" && event.key !== "Escape") return;
        hideBar();
        event.preventDefault();
        event.stopPropagation();
    }
    function handleRevealKeyup(event) {
        if (!disabled || event.key !== "Alt" || event.repeat) return;
        const now = Date.now();
        if (now - lastAltKeyupAt <= DOUBLE_ALT_DELAY) {
            lastAltKeyupAt = 0;
            showBar();
            return;
        }
        lastAltKeyupAt = now;
    }
    document.addEventListener("keyup", handleRevealKeyup, true);
    return (enabled = false) => {
        disabled = enabled === true;
        visible = false;
        lastAltKeyupAt = 0;
        if (!disabled) removeHideListeners();
        syncClasses();
        return disabled;
    };
})();
applyThemeData({...window.StandardUI.defaultTheme});
async function loadAndApplyTheme({attempt = 0, maxAttempts = 2, retryDelayMs = 250} = {}) {
    try {
        const cookieTheme = getThemeFromUserCookie();
        const data = (cookieTheme && typeof cookieTheme === "object")
            ? cookieTheme
            : (typeof modular?.user?.theme === "function" ? await modular.user.theme() : null);
        if (data && typeof data === "object") {
            if (await applyThemeData(data)) return true;
        }
    } catch (_) {
    }
    if (await applyThemeData({...window.StandardUI.defaultTheme})) return true;
    if (attempt >= maxAttempts) return false;
    const delay = Math.min(retryDelayMs * Math.max(1, attempt + 1), 1000);
    await new Promise(resolve => setTimeout(resolve, delay));
    return loadAndApplyTheme({attempt: attempt + 1, maxAttempts, retryDelayMs});
}
window.StandardUI.prefersSvgIcons = () => window.StandardUI?.currentTheme?.use_svg_icons !== false;
window.StandardUI.applyResolvedBackgroundImage = applyResolvedThemeBackground;
window.StandardUI.getAppliedBackgroundImageUrl = getAppliedThemeBackgroundImageUrl;
window.StandardUI.refreshTheme = ({maxAttempts = 2, retryDelayMs = 250, force = false} = {}) => {
    if (themeRefreshInFlight && !force) return themeRefreshInFlight;
    themeRefreshInFlight = loadAndApplyTheme({attempt: 0, maxAttempts, retryDelayMs})
        .finally(() => {
            themeRefreshInFlight = null;
        });
    return themeRefreshInFlight;
};
window.StandardUI.refreshTheme();
window.StandardUI.altSync.init();
window.addEventListener("focus", () => {
    window.StandardUI.refreshTheme({maxAttempts: 0});
});
