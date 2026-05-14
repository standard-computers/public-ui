(() => {
    const SERVICE_ID = "com.standard.stopwatch";
    let elapsedBeforeStart = 0;
    let startedAt = 0;
    let running = false;
    let laps = [];
    let ticker = null;
    const currentElapsed = () => running ? elapsedBeforeStart + Date.now() - startedAt : elapsedBeforeStart;
    const pad = (value, size = 2) => `${Math.floor(value)}`.padStart(size, "0");
    const formatElapsed = (milliseconds = 0) => {
        const totalMilliseconds = Math.max(0, Math.floor(milliseconds));
        const ms = totalMilliseconds % 1000;
        const totalSeconds = Math.floor(totalMilliseconds / 1000);
        const seconds = totalSeconds % 60;
        const totalMinutes = Math.floor(totalSeconds / 60);
        const minutes = totalMinutes % 60;
        const hours = Math.floor(totalMinutes / 60);
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(Math.floor(ms / 10))}`;
    };
    const getStopwatchWindow = () => modular.findPortalWindow?.(SERVICE_ID, 0) || null;
    const syncPortalState = (portal = getStopwatchWindow()?.portal) => {
        if (typeof portal?.setWindowState === "function") {
            portal.setWindowState({elapsedBeforeStart, startedAt, running, laps});
        }
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
        const lapBody = root?.querySelector?.("#stopwatch-lap-body");
        if (!lapBody) return;
        if (!laps.length) {
            lapBody.innerHTML = div({style: "table-row", content: div({style: "cell faded", content: "No laps yet"})});
            return;
        }
        lapBody.innerHTML = laps.map((lapTime, index) => div({style: "table-row", content: children([div({style: "cell", content: `${index + 1}`}), div({style: "cell", content: formatElapsed(lapTime)})])})).join("");
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
    window.StandardStopwatch = window.StandardStopwatch || {startStop, lap, clear};
    modular.register(new Service(SERVICE_ID, [new Portal({
        title: "Stopwatch",
        hints: ["stopwatch", "timer"],
        internal: true,
        dimensions: [360, 430],
        navigation: false,
        resizable: false,
        svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l3 2.25M9.75 3.75h4.5M12 21a8.25 8.25 0 1 0 0-16.5 8.25 8.25 0 0 0 0 16.5Z" /></svg>`,
        route: () => div({style: "large-padding-top small-padding", content: children([
            `<div id="stopwatch-display" class="center padded bordered radius shadowed" style="font-size:40px;font-weight:700;line-height:1.1">${formatElapsed(currentElapsed())}</div>`,
            div({style: "center padded", content: children([
                `<button id="stopwatch-start-stop" class="primary" type="button">${running ? "Stop" : "Start"}</button>`,
                `<button id="stopwatch-lap" class="undecorated" type="button">Lap</button>`,
                `<button id="stopwatch-clear" class="undecorated" type="button">Clear</button>`
            ])}),
            div({style: "table bordered radius", content: children([
                div({style: "table-row table-header", content: children([
                    div({style: "cell", content: "#"}),
                    div({style: "cell", content: "Time"})
                ])}),
                div({id: "stopwatch-lap-body", content: ""})
            ])})
        ])}),
        afterRender: bindStopwatch
    })]));
})();