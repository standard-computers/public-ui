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
    function buildMenu() {
        menu.innerHTML = "";
        let itemCount = 0;
        items.forEach(item => {
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
    function buildMenu() {
        menu.innerHTML = "";
        items.forEach(item => {
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
    }
    function showMenu(x, y) {
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
window.StandardUI = window.StandardUI || {};
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
        fontWeight: "700",
        lineHeight: "1",
        zIndex: "2147483647",
        pointerEvents: "none",
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.16)"
    };
    let active = false;
    let initialized = false;
    let overlayLayer = null;
    let overlayEntries = [];

    function ensureOverlayLayer() {
        if (overlayLayer?.isConnected) return overlayLayer;
        if (!document.body) return null;
        overlayLayer = document.createElement("div");
        overlayLayer.className = "alt-sync-overlay-layer";
        overlayLayer.setAttribute("aria-hidden", "true");
        Object.assign(overlayLayer.style, {
            position: "fixed",
            inset: "0",
            pointerEvents: "none",
            zIndex: "2147483647"
        });
        document.body.appendChild(overlayLayer);
        return overlayLayer;
    }

    function getTargets() {
        return Array.from(document.querySelectorAll(`[${ATTRIBUTE_NAME}]`)).filter(target => {
            const label = String(target.getAttribute(ATTRIBUTE_NAME) || "").trim();
            if (!label) return false;
            if (!target.isConnected) return false;
            const rect = target.getBoundingClientRect();
            const style = getComputedStyle(target);
            return rect.width > 0
                && rect.height > 0
                && style.visibility !== "hidden"
                && style.display !== "none";
        });
    }

    function normalizeKey(value = "") {
        return String(value || "").trim().charAt(0).toUpperCase();
    }

    function clearOverlays() {
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
            overlay.style.left = `${Math.max(0, rect.left)}px`;
            overlay.style.top = `${Math.max(0, rect.top)}px`;
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
        clearOverlays();
    }

    function activate() {
        active = true;
        showOverlays();
    }

    function shouldIgnoreEventTarget(target) {
        if (!(target instanceof Element)) return false;
        return Boolean(target.closest("input, textarea, select, [contenteditable]:not([contenteditable=\"false\"])"));
    }

    function findTargetForKey(key = "") {
        const normalizedKey = normalizeKey(key);
        if (!normalizedKey) return null;
        return getTargets().find(target => normalizeKey(target.getAttribute(ATTRIBUTE_NAME)) === normalizedKey) || null;
    }

    function triggerTarget(target) {
        if (!target) return;
        target.scrollIntoView({behavior: "smooth", block: "center", inline: "center"});
        target.click();
    }

    function handleKeydown(event) {
        if (event.defaultPrevented) return;
        if (shouldIgnoreEventTarget(event.target)) return;
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
        const target = findTargetForKey(event.key);
        if (!target) return;
        event.preventDefault();
        deactivate();
        triggerTarget(target);
    }

    function init() {
        if (initialized) return;
        initialized = true;
        document.addEventListener("keydown", handleKeydown);
        window.addEventListener("blur", deactivate);
        window.addEventListener("resize", () => {
            if (active) positionOverlays();
        });
        window.addEventListener("scroll", () => {
            if (active) positionOverlays();
        }, true);
    }

    return {
        init,
        activate,
        deactivate,
        isActive: () => active
    };
})();
let activeUploadProgressToken = 0;
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
window.StandardUploads = window.StandardUploads || {};
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
    updateUploadProgress({label, loaded: 0, total: file.size || 0, indeterminate: !(file.size > 0), token});
    const xhr = new XMLHttpRequest();
    xhr.open(String(options?.method || "POST"), uploadUrl, true);
    xhr.upload.onprogress = event => {
        updateUploadProgress({
            label,
            loaded: Number(event?.loaded) || 0,
            total: Number(event?.total) || file.size || 0,
            indeterminate: !event?.lengthComputable,
            token
        });
    };
    xhr.onerror = () => {
        hideUploadProgress(token);
        reject(new Error("Upload failed"));
    };
    xhr.onabort = () => {
        hideUploadProgress(token);
        reject(new Error("Upload aborted"));
    };
    xhr.onload = () => {
        updateUploadProgress({
            label,
            loaded: file.size || 1,
            total: file.size || 1,
            indeterminate: false,
            token
        });
        window.setTimeout(() => hideUploadProgress(token), 220);
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
    const metaEndpoint = `/api/cache/${encodeURIComponent(THEME_BACKGROUND_CACHE_INTERFACE)}/${encodeURIComponent(THEME_BACKGROUND_META_KEY)}?format=json&_=${Date.now()}`;
    try {
        const metaResponse = await fetch(metaEndpoint, {cache: "no-store", credentials: "same-origin"});
        if (!metaResponse.ok) return "";
        const metadata = await metaResponse.json().catch(() => null);
        const format = `${metadata?.format || ""}`.trim().replace(/[^a-z0-9]/gi, "").toLowerCase();
        if (!format) return "";
        const imageEndpoint = `/api/cache/${encodeURIComponent(THEME_BACKGROUND_CACHE_INTERFACE)}/${encodeURIComponent(THEME_BACKGROUND_CACHE_KEY)}?format=${encodeURIComponent(format)}&_=${Date.now()}`;
        const imageResponse = await fetch(imageEndpoint, {cache: "no-store", credentials: "same-origin"});
        if (!imageResponse.ok) return "";
        const imageBlob = await imageResponse.blob();
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
    media_widget: true,
    video_widget: true
};

window.StandardUI = window.StandardUI || {};
window.StandardUI.defaultTheme = window.StandardUI.defaultTheme || {...defaultThemeData};
applyThemeData({...window.StandardUI.defaultTheme});
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
