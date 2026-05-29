(function () {
    const pendingCommands = [];
    let draining = false;
    const NOTIFICATION_RETRY_LIMIT = 25;
    const NOTIFICATION_RETRY_DELAY = 200;
    window.StandardNotifications = window.StandardNotifications || {};
    const notificationHandlers = window.StandardNotifications.handlers || {};
    window.StandardNotifications.handlers = notificationHandlers;
    let notificationSequence = 0;
    function escapeHtml(value = "") {
        return String(value ?? "").replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"})[char]);
    }
    function ensureNotificationTray() {
        let tray = document.getElementById("standard-notification-tray");
        if (tray) return tray;
        tray = document.createElement("div");
        tray.id = "standard-notification-tray";
        tray.className = "standard-notification-tray";
        tray.setAttribute("aria-live", "polite");
        document.body.appendChild(tray);
        return tray;
    }
    function normalizeDetails(details) {
        if (!details) return [];
        if (Array.isArray(details)) return details.map(item => `${item ?? ""}`.trim()).filter(Boolean);
        return [`${details}`.trim()].filter(Boolean);
    }
    function normalizeClassToken(value = "") {
        return String(value || "default").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "default";
    }
    window.StandardNotifications.show = (notification = {}) => {
        const tray = ensureNotificationTray();
        const details = normalizeDetails(notification.details);
        const node = document.createElement("article");
        const id = `standard-notification-${++notificationSequence}`;
        node.className = `standard-notification standard-notification-${normalizeClassToken(notification.type)}`;
        node.id = id;
        node.dataset.expanded = "false";
        const title = `${notification.title || "Notification"}`.trim();
        const message = `${notification.message || ""}`.trim();
        const icon = notification.icon || "";
        const hasAction = typeof notification.onclick === "function";
        if (hasAction) {
            node.tabIndex = 0;
            node.role = "button";
            node.style.cursor = "pointer";
        }
        node.innerHTML = `
            <div class="standard-notification-main">
                <div class="standard-notification-icon" aria-hidden="true">${icon}</div>
                <div class="standard-notification-copy">
                    <div class="standard-notification-title">${escapeHtml(title)}</div>
                    ${message ? `<div class="standard-notification-message">${escapeHtml(message)}</div>` : ""}
                </div>
                ${details.length ? `<button class="plain standard-notification-toggle" type="button" aria-label="Show notification details" aria-expanded="false" aria-controls="${id}-details">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                </button>` : ""}
                <button class="plain standard-notification-dismiss" type="button" aria-label="Dismiss notification">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
            </div>
            ${details.length ? `<div class="standard-notification-details" id="${id}-details">${details.map(item => `<div>${escapeHtml(item)}</div>`).join("")}</div>` : ""}
        `;
        tray.prepend(node);
        requestAnimationFrame(() => node.classList.add("show"));
        window.StandardNotifications.dismiss = notificationNode => {
            notificationNode?.classList?.remove?.("show");
            setTimeout(() => notificationNode?.remove?.(), 220);
        };
        node.querySelector(".standard-notification-dismiss")?.addEventListener("click", () => {
            window.StandardNotifications.dismiss(node);
        });
        node.querySelector(".standard-notification-toggle")?.addEventListener("click", event => {
            const expanded = node.dataset.expanded !== "true";
            node.dataset.expanded = expanded ? "true" : "false";
            event.currentTarget.setAttribute("aria-expanded", expanded ? "true" : "false");
        });
        if (hasAction) {
            const runAction = event => {
                if (event?.target?.closest?.("button")) return;
                notification.onclick(node, event);
            };
            node.addEventListener("click", runAction);
            node.addEventListener("keydown", event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                runAction(event);
            });
        }
        return node;
    };
    window.StandardNotifications.register = (type, handler) => {
        const normalizedType = `${type || ""}`.trim().toLowerCase();
        if (!normalizedType || typeof handler !== "function") return;
        notificationHandlers[normalizedType] = handler;
    };
    window.StandardNotifications.notify = (message, attempt = 0) => {
        const notificationType = `${message?.notificationType || message?.type || ""}`.trim().toLowerCase();
        const handler = notificationHandlers[notificationType];
        if (typeof handler === "function") {
            const result = handler({type: notificationType, data: Array.isArray(message?.notificationData) ? message.notificationData : [], raw: message});
            if (result && typeof result.catch === "function") result.catch(err => console.error("Notification handler failed", err));
            return;
        }
        if (attempt < NOTIFICATION_RETRY_LIMIT) {
            setTimeout(() => window.StandardNotifications.notify(message, attempt + 1), NOTIFICATION_RETRY_DELAY);
            return;
        }
        window.StandardNotifications.show({title: "Notification", message: "Notification received", type: notificationType || "default"});
    };
    function runStartCommand(serviceId, attempt = 0) {
        if (!serviceId || typeof modular === "undefined" || typeof modular.start !== "function") {
            if (attempt < 25) setTimeout(() => runStartCommand(serviceId, attempt + 1), 200);
            return;
        }
        const portal = modular.start(serviceId);
        if (!portal && attempt < 25) setTimeout(() => runStartCommand(serviceId, attempt + 1), 200);
    }
    function drainCommands() {
        if (draining) return;
        draining = true;
        while (pendingCommands.length) {
            const message = pendingCommands.shift();
            if (message?.command === "start" && message.serviceId) {
                runStartCommand(message.serviceId);
            } else if (message?.command === "notify") {
                window.StandardNotifications.notify(message);
            }
        }
        draining = false;
    }
    function enqueueCommand(message) {
        if (!message || message.command === "ready") return;
        pendingCommands.push(message);
        drainCommands();
    }
    document.addEventListener("DOMContentLoaded", () => {
        const source = new EventSource("/events/push");
        source.onmessage = event => {
            try {
                enqueueCommand(JSON.parse(event.data));
            } catch (err) {
                console.error("Failed to parse push command", err);
            }
        };
        source.onerror = () => {};
    });
})();