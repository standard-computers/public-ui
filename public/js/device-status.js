(function () {
    const STATUS_COPY = {connected: "Connected", connecting: "Connecting…", disconnected: "Disconnected"};
    const CONNECTION_CHECK_INTERVAL = 60 * 1000;
    function ensureToastContainer() {
        let container = document.querySelector(".status-toast-container");
        if (!container) {
            container = document.createElement("div");
            container.className = "status-toast-container";
            document.body.appendChild(container);
        }
        return container;
    }
    function showToast(message, status) {
        const container = ensureToastContainer();
        const toast = document.createElement("div");
        toast.className = `status-toast status-${status}`;
        toast.textContent = message;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add("show"));
        setTimeout(() => {
            toast.classList.remove("show");
            toast.classList.add("fade-out");
            toast.addEventListener("transitionend", () => toast.remove(), {once: true});
        }, 3200);
    }
    function applyStatus(status) {
        const indicator = document.querySelector(".status-indicator");
        const statusText = document.getElementById("device-status");
        if (!indicator || !statusText) return () => {};
        const statuses = ["connected", "connecting", "disconnected"];
        let lastStatus = indicator.dataset.status || "connected";
        let initialized = false;
        function update(nextStatus) {
            if (!statuses.includes(nextStatus)) return;
            statuses.forEach(state => indicator.classList.remove(`status-${state}`));
            indicator.classList.add(`status-${nextStatus}`);
            indicator.dataset.status = nextStatus;
            statusText.textContent = STATUS_COPY[nextStatus] || nextStatus;
            if (initialized && lastStatus !== nextStatus) {
                const copyMap = {connected: "Device connection restored", connecting: "Attempting to connect…", disconnected: "Device connection lost"};
                showToast(copyMap[nextStatus] || `Status changed: ${nextStatus}`, nextStatus);
            }
            initialized = true;
            lastStatus = nextStatus;
        }
        update(status);
        return update;
    }
    document.addEventListener("DOMContentLoaded", () => {
        const indicator = document.querySelector(".status-indicator");
        if (!indicator) return;
        const initialStatus = indicator.className.match(/status-(connected|connecting|disconnected)/);
        const setStatus = applyStatus(initialStatus ? initialStatus[1] : "connected");
        const source = new EventSource(new URL("/events/device-status", window.location.href).href, {withCredentials: true});
        let connectionLostAt = Date.now();
        let isReloading = false;
        function checkConnection() {
            if (source.readyState === EventSource.OPEN) {
                connectionLostAt = null;
                return;
            }
            if (connectionLostAt === null) connectionLostAt = Date.now();
            if (!isReloading && Date.now() - connectionLostAt >= CONNECTION_CHECK_INTERVAL) {
                isReloading = true;
                window.location.reload();
            }
        }
        source.onopen = () => {
            connectionLostAt = null;
        };
        source.onmessage = event => {
            try {
                const payload = JSON.parse(event.data);
                if (payload && payload.status) setStatus(payload.status);
            } catch (err) {
                console.error("Failed to parse status event", err);
            }
        };
        source.onerror = () => {
            setStatus("connecting");
            checkConnection();
        };
        window.setInterval(checkConnection, CONNECTION_CHECK_INTERVAL);
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) checkConnection();
        });
    });
})();
