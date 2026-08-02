(() => {
    const SERVICE_ID = "com.standard.setup";
    const config = window.StandardRuntimeConfig?.desktopSetup || {};
    const escapeHtml = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

    const keepOnTop = () => {
        if (window.StandardRuntimeConfig?.desktopSetupRequired !== true) return;
        let portalWindow = modular.findPortalWindow?.(SERVICE_ID, 0);
        if (!portalWindow) {
            modular.start(SERVICE_ID);
            portalWindow = modular.findPortalWindow?.(SERVICE_ID, 0);
        }
        if (portalWindow) modular.bringToFront?.(portalWindow);
    };

    const bindSetup = function () {
        const root = this.portal?.window?.() || modular.findPortalWindow?.(SERVICE_ID, 0);
        const form = root?.querySelector?.("#desktop-setup-form");
        const errorNode = root?.querySelector?.("#desktop-setup-error");
        if (!form) return;
        form.onsubmit = async event => {
            event.preventDefault();
            const submit = form.querySelector('button[type="submit"]');
            if (errorNode) {
                errorNode.textContent = "";
                errorNode.classList.add("hidden");
            }
            if (submit) submit.disabled = true;
            try {
                const response = await fetch("/setup", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {"Content-Type": "application/json", "Accept": "application/json", "X-Requested-With": "XMLHttpRequest"},
                    body: JSON.stringify({
                        endpoint: form.elements.endpoint.value,
                        "device-key": form.elements["device-key"].value,
                        "mapbox-key": form.elements["mapbox-key"].value
                    })
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || "Failed to save setup values");
                window.StandardRuntimeConfig.desktopSetupRequired = false;
                window.location.assign(payload.redirect || "/login");
            } catch (error) {
                if (errorNode) {
                    errorNode.textContent = error.message || "Failed to save setup values";
                    errorNode.classList.remove("hidden");
                }
                if (submit) submit.disabled = false;
                keepOnTop();
            }
        };
        keepOnTop();
    };

    modular.register(new Service(SERVICE_ID, [new Portal({
        title: "Setup Public UI",
        internal: true,
        dimensions: [460, 570],
        navigation: false,
        resizable: false,
        icon: "/icons/interfaces/settings.png",
        route: () => `<div class="large-padding-top padding-left padding-right">
            <form id="desktop-setup-form">
                <h1 class="center padded">Welcome!</h1>
                <div id="desktop-setup-error" class="error padded hidden" role="alert"></div>
                <div class="padded align-left">
                    <label for="setup-endpoint" class="margin-bottom">Device Endpoint</label>
                    <p><em>Only change if custom setup</em></p>
                    <input type="text" name="endpoint" id="setup-endpoint" value="${escapeHtml(config.endpoint)}"/>
                </div>
                <div class="padded align-left">
                    <label for="setup-device-key" class="margin-bottom">Device Key</label>
                    <p><em>Device Chit Token from Setup</em></p>
                    <input type="text" name="device-key" id="setup-device-key" value="${escapeHtml(config.deviceKey)}"/>
                </div>
                <div class="padded align-left">
                    <label for="setup-mapbox-key" class="margin-bottom">Mapbox Key</label>
                    <p><em>Mapbox public access token for Maps</em></p>
                    <input type="text" name="mapbox-key" id="setup-mapbox-key" value="${escapeHtml(config.mapboxKey)}"/>
                </div>
                <div class="padded">
                    <button type="submit" class="fat primary fill hover-zoom hover-shadowed">Connect</button>
                </div>
            </form>
        </div>`,
        afterRender: bindSetup
    })]));
    document.addEventListener("mousedown", () => setTimeout(keepOnTop, 0));
    window.setInterval(keepOnTop, 500);
})();