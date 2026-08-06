(() => {

    let elapsedBeforeStart = 0;
    let startedAt = 0;
    let running = false;
    let laps = [];
    let ticker = null;
    const EXPORT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.49 12 3.75-3.751m0 0-3.75-3.75m3.75 3.75H3.74V19.5"/></svg>`;
    const currentElapsed = () => running ? elapsedBeforeStart + Date.now() - startedAt : elapsedBeforeStart;
    const pad = (value, size = 2) => `${Math.floor(value)}`.padStart(size, "0");

    const formatElapsed = (milliseconds = 0) => {
        const tms = Math.max(0, Math.floor(milliseconds));
        const ms = tms % 1000;
        const ts = Math.floor(tms / 1000);
        const s = ts % 60;
        const tm = Math.floor(ts / 60);
        const m = tm % 60;
        const h = Math.floor(tm / 60);
        return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(Math.floor(ms / 10))}`;
    };

    const lapRows = () => laps.map((lapTime, index) => ({
        lap: index + 1,
        time: formatElapsed(lapTime),
        duration: formatElapsed(Math.max(0, lapTime - (index > 0 ? laps[index - 1] : 0)))
    }));

    const escapeCsvValue = (value = "") => {
        const text = String(value ?? "");
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
    };

    const stopwatchCsv = () => [
        ["#", "Time", "Duration"],
        ...lapRows().map(({lap: lapNumber, time, duration}) => [lapNumber, time, duration])
    ].map(row => row.map(escapeCsvValue).join(",")).join("\n");

    const escapeHtml = (value = "") => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[character]));

    const stopwatchTableHtml = () => `<table><thead><tr><th>#</th><th>Time</th><th>Duration</th></tr></thead><tbody>${lapRows().map(({lap: lapNumber, time, duration}) => `<tr><td>${escapeHtml(lapNumber)}</td><td>${escapeHtml(time)}</td><td>${escapeHtml(duration)}</td></tr>`).join("")}</tbody></table>`;

    const waitForExportMethod = async (serviceId, resolveMethod) => {
        const existingMethod = resolveMethod();
        if (typeof existingMethod === "function") return existingMethod;
        modular.start(serviceId);
        for (let attempt = 0; attempt < 20; attempt += 1) {
            const method = resolveMethod();
            if (typeof method === "function") return method;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return null;
    };

    const exportToSheets = async (sourceNode = null) => {
        const openCsvContent = await waitForExportMethod("com.standard.editor.sheet", () => window.StandardSheets?.openCsvContent);
        if (typeof openCsvContent !== "function") {
            modular.error("Sheets is not ready yet");
            return false;
        }
        openCsvContent(stopwatchCsv(), {title: "Stopwatch Laps", sourceNode});
        return true;
    };

    const exportToWords = async (sourceNode = null) => {
        const openTextFilePath = await waitForExportMethod("com.standard.editor.text", () => window.StandardEditor?.openTextFilePath);
        if (typeof openTextFilePath !== "function") {
            modular.error("Text Editor is not ready yet");
            return false;
        }
        openTextFilePath("", stopwatchTableHtml(), sourceNode);
        return true;
    };

    const showExportMenu = event => {
        const exportButton = event?.currentTarget;
        if (!exportButton || typeof exportButton.contextmenu !== "function") return;
        if (!exportButton.__stopwatchExportMenu) {
            exportButton.__stopwatchExportMenu = true;
            exportButton.contextmenu([
                {label: "Export to Sheets", icon: modular.icons.sheets, action: () => exportToSheets(exportButton)},
                {label: "Export to Words", icon: modular.icons.note, action: () => exportToWords(exportButton)}
            ]);
        }
        const rect = exportButton.getBoundingClientRect();
        exportButton.dispatchEvent(new MouseEvent("contextmenu", {bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.bottom}));
    };

    const getStopwatchWindow = () => modular.findPortalWindow?.("com.standard.stopwatch", 0) || null;

    const syncPortalState = (portal = getStopwatchWindow()?.portal) => {
        if (typeof portal?.setWindowState === "function") portal.setWindowState({elapsedBeforeStart, startedAt, running, laps});
    };

    const restoreState = (portal = getStopwatchWindow()?.portal) => {
        const state = portal?.windowState?.() || {};
        if (!state || !Object.keys(state).length) return;
        elapsedBeforeStart = Number.isFinite(Number(state.elapsedBeforeStart)) ? Number(state.elapsedBeforeStart) : 0;
        startedAt = Number.isFinite(Number(state.startedAt)) ? Number(state.startedAt) : Date.now();
        running = state.running === true;
        laps = Array.isArray(state.laps) ? state.laps.map(Number).filter(Number.isFinite) : [];
        if (running) ensureTicker();
    };

    const renderLaps = (root = getStopwatchWindow()) => {
        const lb = root?.querySelector?.("#stopwatch-lap-body");
        if (!lb) return;
        if (!laps.length) {
            lb.innerHTML = div({style: "table-row", content: div({style: "cell faded", content: "No laps yet"})});
            return;
        }
        lb.innerHTML = lapRows().map(({lap: lapNumber, time, duration}) => {
            return div({style: "table-row", content: children([div({style: "cell", content: `${lapNumber}`}), div({style: "cell", content: time}), div({style: "cell", content: duration})])});
        }).join("");
    };

    const updateDisplay = (root = getStopwatchWindow()) => {
        const display = root?.querySelector?.("#stopwatch-display");
        const startStop = root?.querySelector?.("#stopwatch-start-stop");
        if (display) display.textContent = formatElapsed(currentElapsed());
        if (startStop) startStop.textContent = running ? "Stop" : "Start";
    };

    const render = () => {
        const root = getStopwatchWindow();
        updateDisplay(root);
        renderLaps(root);
    };

    const ensureTicker = () => {
        if (ticker) return;
        ticker = window.setInterval(() => {
            if (!running) return;
            updateDisplay();
        }, 50);
    };

    const stopTickerIfIdle = () => {
        if (running || !ticker) return;
        window.clearInterval(ticker);
        ticker = null;
    };

    const startStop = () => {
        if (running) {
            elapsedBeforeStart = currentElapsed();
            running = false;
            stopTickerIfIdle();
        } else {
            startedAt = Date.now();
            running = true;
            ensureTicker();
        }
        syncPortalState();
        updateDisplay();
    };

    const lap = () => {
        if (!running && currentElapsed() <= 0) return;
        laps = [...laps, currentElapsed()];
        syncPortalState();
        renderLaps();
    };

    const clear = () => {
        elapsedBeforeStart = 0;
        startedAt = 0;
        running = false;
        laps = [];
        stopTickerIfIdle();
        syncPortalState();
        render();
    };

    const bindStopwatch = function () {
        restoreState(this.portal);
        const root = this.portal?.window?.() || getStopwatchWindow();
        const startStopButton = root?.querySelector?.("#stopwatch-start-stop");
        const lapButton = root?.querySelector?.("#stopwatch-lap");
        const clearButton = root?.querySelector?.("#stopwatch-clear");
        if (startStopButton) startStopButton.onclick = startStop;
        if (lapButton) lapButton.onclick = lap;
        if (clearButton) clearButton.onclick = clear;
        render();
    };

    window.StandardStopwatch = window.StandardStopwatch || {startStop, lap, clear, exportToSheets, exportToWords};
    modular.register(new Service("com.standard.stopwatch", [new Portal({title: "Stopwatch", hints: ["stopwatch", "timer"], internal: true, dimensions: [360, 430], navigation: false, resizable: false, tools: [{title: "Export", icon: EXPORT_ICON, onclick: showExportMenu}], svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l3 2.25M9.75 3.75h4.5M12 21a8.25 8.25 0 1 0 0-16.5 8.25 8.25 0 0 0 0 16.5Z"/></svg>`, route: () => div({style: "large-padding-top small-padding", content: children([`<div id="stopwatch-display" class="center padded bordered radius shadowed" style="font-size:40px;font-weight:700;line-height:1.1">${formatElapsed(currentElapsed())}</div>`, div({style: "center padded", content: children([`<button id="stopwatch-start-stop" class="primary" type="button">${running ? "Stop" : "Start"}</button>`, `<button id="stopwatch-lap" class="undecorated" type="button">Lap</button>`, `<button id="stopwatch-clear" class="undecorated" type="button">Clear</button>`])}), div({style: "table bordered radius", content: children([div({style: "table-row table-header", content: children([div({style: "cell", content: "#"}), div({style: "cell", content: "Time"}), div({style: "cell", content: "Duration"})])}), div({id: "stopwatch-lap-body", content: ""})])})])}), afterRender: bindStopwatch})]));
})();
