(() => {
    const SERVICE_ID = "com.standard.timers";
    const CACHE_KEY = "timers";
    const CACHE_OPTIONS = {format: "json", contentType: "application/json", label: "Timers"};
    const TIMER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l3 2.25M9.75 3.75h4.5M12 21a8.25 8.25 0 1 0 0-16.5 8.25 8.25 0 0 0 0 16.5Z" /></svg>`;
    const DURATION_PATTERN = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b/gi;
    let timers = [];
    let loaded = false;
    let ticker = null;
    let saveQueue = Promise.resolve();
    const notifiedTimerIds = new Set();

    const cache = () => window.StandardBrowserCache?.createAdapter?.(SERVICE_ID);
    const now = () => Date.now();
    const escapeHtml = (value = "") => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"})[character]);
    const escapeSelectorValue = value => typeof window.CSS?.escape === "function" ? window.CSS.escape(String(value ?? "")) : String(value ?? "").replace(/"/g, "\\\"");
    const createId = () => `${now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const finiteNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const remainingFor = (timer, currentTime = now()) => timer.status === "running" ? Math.max(0, timer.deadlineAt - currentTime) : Math.max(0, timer.remainingMs);
    const pad = value => `${Math.max(0, Math.floor(value))}`.padStart(2, "0");
    const formatDuration = (milliseconds = 0) => {
        const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
        const seconds = totalSeconds % 60;
        const totalMinutes = Math.floor(totalSeconds / 60);
        const minutes = totalMinutes % 60;
        const hours = Math.floor(totalMinutes / 60);
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };
    const formatCreatedAt = timestamp => {
        const date = new Date(timestamp);
        return Number.isNaN(date.getTime()) ? "" : `Created ${date.toLocaleTimeString([], {hour: "numeric", minute: "2-digit"})}`;
    };
    const parseTimerDescription = value => {
        const input = `${value || ""}`.trim();
        let durationMs = 0;
        let matched = false;
        const name = input.replace(DURATION_PATTERN, (_match, rawAmount, rawUnit) => {
            matched = true;
            const amount = finiteNumber(rawAmount);
            const unit = rawUnit.toLowerCase();
            if (unit.startsWith("h")) durationMs += amount * 60 * 60 * 1000;
            else if (unit.startsWith("m")) durationMs += amount * 60 * 1000;
            else durationMs += amount * 1000;
            return " ";
        }).replace(/\b(for|in)\b/gi, " ").replace(/\s+/g, " ").trim();
        return {name: name || "Timer", durationMs: matched ? Math.round(durationMs) : 0};
    };
    const normalizeTimer = value => {
        if (!value || typeof value !== "object") return null;
        const durationMs = Math.max(1000, finiteNumber(value.durationMs, finiteNumber(value.remainingMs, 0)));
        const createdAt = finiteNumber(value.createdAt, now());
        const status = ["running", "paused", "complete"].includes(value.status) ? value.status : "running";
        return {
            id: `${value.id || createId()}`,
            name: `${value.name || "Timer"}`.trim() || "Timer",
            durationMs,
            createdAt,
            deadlineAt: finiteNumber(value.deadlineAt, createdAt + durationMs),
            remainingMs: status === "running" ? durationMs : Math.max(0, finiteNumber(value.remainingMs, durationMs)),
            status,
            notifiedAt: finiteNumber(value.notifiedAt, 0)
        };
    };
    const snapshot = () => ({version: 1, updatedAt: new Date().toISOString(), timers});
    const persist = () => {
        saveQueue = saveQueue.catch(() => undefined).then(async () => {
            const adapter = cache();
            if (!adapter) throw new Error("Browser cache is unavailable");
            await adapter.set(CACHE_KEY, snapshot(), CACHE_OPTIONS);
        }).catch(error => console.error("Failed to save timers", error));
        return saveQueue;
    };
    const getTimerWindow = () => modular.findPortalWindow?.(SERVICE_ID, 0) || null;
    const openTimers = () => modular.start?.(SERVICE_ID);
    const openDetailedTimer = () => modular.start?.(SERVICE_ID, {portalIndex: 1});
    const deleteTimer = timerId => {
        const nextTimers = timers.filter(timer => timer.id !== timerId);
        if (nextTimers.length === timers.length) return;
        timers = nextTimers;
        void persist();
        renderList();
    };
    const notifyTimer = timer => {
        if (notifiedTimerIds.has(timer.id)) return;
        notifiedTimerIds.add(timer.id);
        window.StandardNotifications?.show?.({
            type: "alarms",
            title: timer.name || "Timer",
            message: "Timer finished",
            icon: TIMER_ICON,
            onclick: notificationNode => {
                window.StandardNotifications?.dismiss?.(notificationNode);
                openTimers();
            },
            onDismiss: () => deleteTimer(timer.id)
        });
    };
    const completeExpiredTimers = (currentTime = now()) => {
        const completed = [];
        timers = timers.map(timer => {
            if (timer.status !== "running" || timer.deadlineAt > currentTime) return timer;
            const nextTimer = {...timer, status: "complete", remainingMs: 0};
            nextTimer.notifiedAt = currentTime;
            completed.push(nextTimer);
            return nextTimer;
        });
        completed.forEach(notifyTimer);
        if (completed.length) void persist();
        return completed.length;
    };
    const timerStatus = timer => {
        if (timer.status === "complete") return "Finished";
        if (timer.status === "paused") return "Paused";
        return "Running";
    };
    const progressFor = (timer, currentTime = now()) => timer.durationMs > 0 ? Math.max(0, Math.min(1, remainingFor(timer, currentTime) / timer.durationMs)) : 0;
    const renderTimer = timer => {
        const remainingMs = remainingFor(timer);
        const primaryAction = timer.status === "running"
            ? `<button type="button" class="tiny inner-radius" data-timer-action="pause" data-timer-id="${escapeHtml(timer.id)}">Pause</button>`
            : timer.status === "paused"
                ? `<button type="button" class="tiny inner-radius primary" data-timer-action="resume" data-timer-id="${escapeHtml(timer.id)}">Resume</button>`
                : "";
        const addMinuteAction = timer.status === "complete" ? "" : `<button type="button" class="tiny inner-radius" data-timer-action="add-minute" data-timer-id="${escapeHtml(timer.id)}">+1 min</button>`;
        return `<article class="timer-card bordered radius${timer.status === "complete" ? " timer-card-complete" : ""}" data-timer-card="${escapeHtml(timer.id)}">
            <div class="timer-card-header">
                <div class="timer-card-copy">
                    <h3>${escapeHtml(timer.name)}</h3>
                    <div class="faded tiny-text">${escapeHtml(timerStatus(timer))} | ${escapeHtml(formatCreatedAt(timer.createdAt))}</div>
                </div>
                <div class="timer-card-display" data-timer-display="${escapeHtml(timer.id)}">${formatDuration(remainingMs)}</div>
            </div>
            <div class="timer-progress" aria-hidden="true"><span data-timer-progress="${escapeHtml(timer.id)}" style="width:${progressFor(timer) * 100}%"></span></div>
            <div class="timer-card-actions">
                ${primaryAction}
                ${addMinuteAction}
                <button type="button" class="tiny inner-radius" data-timer-action="delete" data-timer-id="${escapeHtml(timer.id)}">Delete</button>
            </div>
        </article>`;
    };
    const updateProgressBars = (currentTime = now()) => {
        const root = getTimerWindow();
        if (!root) return;
        timers.forEach(timer => {
            const progress = root.querySelector?.(`[data-timer-progress="${escapeSelectorValue(timer.id)}"]`);
            if (progress) progress.style.width = `${progressFor(timer, currentTime) * 100}%`;
        });
    };
    const renderList = () => {
        const root = getTimerWindow();
        const list = root?.querySelector?.("#timers-list");
        if (!list) return;
        if (!loaded) {
            list.innerHTML = `<div class="faded small-padding">Loading timers...</div>`;
            return;
        }
        if (!timers.length) {
            list.innerHTML = `<div class="timer-empty"><div class="timer-empty-icon">${TIMER_ICON}</div><strong>No timers yet</strong><span class="faded">Describe a timer above to start one.</span></div>`;
            return;
        }
        list.innerHTML = timers.slice().sort((left, right) => left.createdAt - right.createdAt).map(renderTimer).join("");
        updateProgressBars();
    };
    const createTimerWithDuration = ({name = "", durationMs = 0} = {}) => {
        const normalizedDuration = Math.max(0, finiteNumber(durationMs));
        if (normalizedDuration < 1000) {
            modular.error("Describe a duration such as 5 min");
            return false;
        }
        const createdAt = now();
        timers = [...timers, {
            id: createId(),
            name: `${name || ""}`.trim() || "Timer",
            durationMs: normalizedDuration,
            createdAt,
            deadlineAt: createdAt + normalizedDuration,
            remainingMs: normalizedDuration,
            status: "running",
            notifiedAt: 0
        }];
        void persist();
        renderList();
        return true;
    };
    const createTimer = ({name = "", hours = 0, minutes = 0, seconds = 0} = {}) => createTimerWithDuration({
        name,
        durationMs: (Math.max(0, finiteNumber(hours)) * 3600 + Math.max(0, finiteNumber(minutes)) * 60 + Math.max(0, finiteNumber(seconds))) * 1000
    });
    const createTimerFromDescription = value => createTimerWithDuration(parseTimerDescription(value));
    const updateTimer = (timerId, action) => {
        const currentTime = now();
        let changed = false;
        timers = timers.flatMap(timer => {
            if (timer.id !== timerId) return [timer];
            changed = true;
            if (action === "delete") return [];
            if (action === "pause" && timer.status === "running") {
                const remainingMs = remainingFor(timer, currentTime);
                return [{...timer, status: remainingMs > 0 ? "paused" : "complete", remainingMs}];
            }
            if (action === "resume" && timer.status === "paused") {
                return [{...timer, status: "running", deadlineAt: currentTime + timer.remainingMs}];
            }
            if (action === "add-minute") {
                const remainingMs = remainingFor(timer, currentTime) + 60000;
                notifiedTimerIds.delete(timer.id);
                return [{...timer, durationMs: remainingMs, status: "running", deadlineAt: currentTime + remainingMs, remainingMs, notifiedAt: 0}];
            }
            changed = false;
            return [timer];
        });
        if (!changed) return;
        void persist();
        renderList();
    };
    const bindTimerList = root => {
        const list = root?.querySelector?.("#timers-list");
        if (!list) return;
        list.onclick = event => {
            const buttonNode = event.target?.closest?.("[data-timer-action]");
            if (!buttonNode) return;
            updateTimer(buttonNode.dataset.timerId, buttonNode.dataset.timerAction);
        };
    };
    const bindTimers = function () {
        const root = this.portal?.window?.() || getTimerWindow();
        const quickForm = root?.querySelector?.("#timer-quick-form");
        const detailButton = root?.querySelector?.("#timer-open-detailed");
        if (quickForm) {
            quickForm.onsubmit = event => {
                event.preventDefault();
                const inputNode = root.querySelector?.("#timer-description");
                if (createTimerFromDescription(inputNode?.value)) inputNode.value = "";
            };
        }
        if (detailButton) detailButton.onclick = openDetailedTimer;
        bindTimerList(root);
        renderList();
        void loadPromise.then(renderList);
    };
    const bindDetailedTimer = function () {
        const root = this.portal?.window?.() || modular.findPortalWindow?.(SERVICE_ID, 1);
        const form = root?.querySelector?.("#timer-detailed-form");
        if (!form) return;
        form.onsubmit = event => {
            event.preventDefault();
            const data = new FormData(form);
            if (createTimer({
                name: data.get("name"),
                hours: data.get("hours"),
                minutes: data.get("minutes"),
                seconds: data.get("seconds")
            })) {
                form.reset();
                root.querySelector?.("#timer-detailed-minutes")?.focus?.();
                openTimers();
            }
        };
    };
    const updateDisplays = () => {
        const completed = completeExpiredTimers();
        const root = getTimerWindow();
        if (!root) return;
        const currentTime = now();
        timers.forEach(timer => {
            const display = root.querySelector?.(`[data-timer-display="${escapeSelectorValue(timer.id)}"]`);
            const progress = root.querySelector?.(`[data-timer-progress="${escapeSelectorValue(timer.id)}"]`);
            if (display) display.textContent = formatDuration(remainingFor(timer, currentTime));
            if (progress) progress.style.width = `${progressFor(timer, currentTime) * 100}%`;
        });
        if (completed) renderList();
    };
    const loadPromise = (async () => {
        try {
            const payload = await cache()?.get?.(CACHE_KEY, {format: "json"});
            timers = (Array.isArray(payload?.timers) ? payload.timers : []).map(normalizeTimer).filter(Boolean);
        } catch (error) {
            console.error("Failed to load timers", error);
            timers = [];
        }
        loaded = true;
        completeExpiredTimers();
        timers.filter(timer => timer.status === "complete").forEach(notifyTimer);
        renderList();
    })();
    const ensureTicker = () => {
        if (ticker) return;
        ticker = window.setInterval(updateDisplays, 250);
    };
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) updateDisplays();
    });
    window.addEventListener("focus", updateDisplays);
    window.StandardTimers = window.StandardTimers || {create: createTimer, createFromDescription: createTimerFromDescription, update: updateTimer, open: openTimers};
    modular.register(new Service(SERVICE_ID, [new Portal({
        title: "Timers",
        hints: ["timer", "timers", "countdown", "stopwatch"],
        dimensions: [440, 570],
        navigation: false,
        resizable: false,
        internal: true,
        icon: "/icons/interfaces/alarms.png",
        svg_icon: TIMER_ICON,
        route: () => `<div class="large-padding-top padding-left padding-right">
            <form id="timer-quick-form" class="timer-quick-form">
                <input id="timer-description" name="description" type="text" autocomplete="off" placeholder="5 min, 2 hours 7 minutes, Tea for 4 min" aria-label="Describe a timer">
                <button id="timer-open-detailed" class="naked" type="button" title="Detailed timer" aria-label="Open detailed timer">${TIMER_ICON}</button>
            </form>
            <div id="timers-list" class="timers-list spacer"><div class="faded small-padding">Loading timers...</div></div>
        </div>`,
        afterRender: bindTimers
    }), new Portal({
        title: "New Timer",
        hints: ["new timer", "detailed timer"],
        dimensions: [360, 310],
        navigation: false,
        resizable: false,
        icon: "/icons/interfaces/alarms.png",
        svg_icon: TIMER_ICON,
        route: () => `<form id="timer-detailed-form" class="large-padding-top padding-left padding-right">
            <label class="faded" for="timer-detailed-name">Name</label>
            <input id="timer-detailed-name" name="name" type="text" maxlength="80" placeholder="Timer name">
            <div class="bi spacer">
                <div><label class="faded" for="timer-detailed-hours">Hours</label><input id="timer-detailed-hours" name="hours" type="number" min="0" max="999" value="0" inputmode="numeric"></div>
                <div><label class="faded" for="timer-detailed-minutes">Minutes</label><input id="timer-detailed-minutes" name="minutes" type="number" min="0" max="59" value="5" inputmode="numeric"></div>
            </div>
            <label class="faded spacer" for="timer-detailed-seconds">Seconds</label>
            <input id="timer-detailed-seconds" name="seconds" type="number" min="0" max="59" value="0" inputmode="numeric">
            <button class="primary fill spacer fat" type="submit">Start Timer</button>
        </form>`,
        afterRender: bindDetailedTimer
    })]));
    ensureTicker();
})();
