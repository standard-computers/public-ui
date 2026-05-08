(function () {
    const pendingCommands = [];
    let draining = false;

    function runStartCommand(serviceId, attempt = 0) {
        if (!serviceId || typeof modular === "undefined" || typeof modular.start !== "function") {
            if (attempt < 25) setTimeout(() => runStartCommand(serviceId, attempt + 1), 200);
            return;
        }
        const portal = modular.start(serviceId);
        if (!portal && attempt < 25) {
            setTimeout(() => runStartCommand(serviceId, attempt + 1), 200);
        }
    }

    function drainCommands() {
        if (draining) return;
        draining = true;
        while (pendingCommands.length) {
            const message = pendingCommands.shift();
            if (message?.command === "start" && message.serviceId) {
                runStartCommand(message.serviceId);
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
