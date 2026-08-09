(() => {

    const SERVICE_ID = "com.standard.camera";
    const CAMERA_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"/></svg>`;
    let activeStream = null;

    const stopCamera = () => {
        activeStream?.getTracks?.().forEach(track => track.stop());
        activeStream = null;
    };

    const setStatus = (root, {title = "Camera unavailable", message = ""} = {}) => {
        const status = root?.querySelector?.(".camera-status");
        if (!status) return;
        status.innerHTML = `<div class="camera-status-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-1.409c.407-.407.659-.97.659-1.591v-9a2.25 2.25 0 0 0-2.25-2.25h-9c-.621 0-1.184.252-1.591.659m12.182 12.182L2.909 5.909M1.5 4.5l1.409 1.409"/></svg></div><strong>${title}</strong>${message ? `<span>${message}</span>` : ""}`;
        status.classList.remove("hidden");
    };

    const requestCameraStream = constraints => {
        if (typeof navigator.mediaDevices?.getUserMedia === "function") {
            return navigator.mediaDevices.getUserMedia(constraints);
        }
        const legacyGetUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if (typeof legacyGetUserMedia !== "function") return null;
        return new Promise((resolve, reject) => legacyGetUserMedia.call(navigator, constraints, resolve, reject));
    };

    const saveCapture = async (blob, fileName) => {
        const file = new File([blob], fileName, {type: "image/jpeg", lastModified: Date.now()});
        if (typeof window.StandardFilesUploadSelectedFiles === "function") {
            await window.StandardFilesUploadSelectedFiles([file], {directory: "Photos", suppressSuccess: true});
            return;
        }
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/upload?directory=Photos", {method: "POST", body: formData});
        if (!response.ok) throw new Error((await response.text().catch(() => "")) || `Save failed (${response.status})`);
        if (typeof window.CLI?.send === "function") await window.CLI.send("tree Photos");
        window.StandardRecordSearch?.refreshFiles?.().catch?.(() => null);
        modular.refresh("com.standard.files");
    };

    const capturePhoto = async root => {
        const video = root.querySelector(".camera-feed");
        const button = root.querySelector(".camera-shutter");
        if (!video?.videoWidth || !video?.videoHeight || !activeStream) return;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        try {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Unable to encode photo")), "image/jpeg", 0.92));
            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            await saveCapture(blob, `Camera-${stamp}.jpg`);
            root.classList.remove("camera-flash");
            requestAnimationFrame(() => root.classList.add("camera-flash"));
            modular.success("Photo saved to Photos");
        } catch (error) {
            console.error("Camera capture failed", error);
            modular.error(error?.message || "Couldn't save photo");
        } finally {
            button.disabled = false;
            button.removeAttribute("aria-busy");
        }
    };

    const startCamera = async root => {
        const video = root.querySelector(".camera-feed");
        const shutter = root.querySelector(".camera-shutter");
        const canRequestStream = typeof navigator.mediaDevices?.getUserMedia === "function"
            || typeof navigator.getUserMedia === "function"
            || typeof navigator.webkitGetUserMedia === "function"
            || typeof navigator.mozGetUserMedia === "function";
        if (!canRequestStream) {
            setStatus(root, {
                title: window.isSecureContext ? "Camera unavailable" : "A secure connection is required",
                message: window.isSecureContext
                    ? "This browser does not provide camera access."
                    : "Open Public UI over HTTPS or use the desktop app to access the camera."
            });
            return;
        }
        try {
            const streamRequest = requestCameraStream({video: {facingMode: "environment"}, audio: false});
            if (!streamRequest) {
                setStatus(root, {message: "This browser does not provide camera access."});
                return;
            }
            activeStream = await streamRequest;
            if (!root.isConnected) {
                stopCamera();
                return;
            }
            video.srcObject = activeStream;
            await video.play();
            root.querySelector(".camera-status")?.classList.add("hidden");
            shutter.disabled = false;
        } catch (error) {
            stopCamera();
            const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
            setStatus(root, {title: denied ? "Camera access was not allowed" : "Camera unavailable", message: denied ? "Allow camera access in your device settings, then reopen Camera." : "Check that a camera is connected and not in use by another app."});
        }
    };

    const bindCamera = windowNode => {
        const root = windowNode?.querySelector?.(".camera-portal");
        if (!root || root.dataset.bound === "true") return;
        root.dataset.bound = "true";
        windowNode.classList.add("camera-window");
        stopCamera();
        root.querySelector(".camera-shutter")?.addEventListener("click", () => capturePhoto(root));
        startCamera(root);
    };

    modular.register(new Service(SERVICE_ID, [new Portal({
        title: "Camera",
        hints: ["camera", "photo", "picture"],
        dimensions: [720, 540],
        navigation: false,
        empty: true,
        svg_icon: CAMERA_ICON,
        icon: "/icons/interfaces/camera.png",
        route: () => `<main class="camera-portal"><video class="camera-feed" autoplay muted playsinline aria-label="Live camera preview"></video><div class="camera-shade" aria-hidden="true"></div><div class="camera-status" role="status"><div class="camera-status-icon" aria-hidden="true">${modular.icons.video}</div><strong>Starting camera…</strong></div><button class="camera-shutter round secondary" type="button" aria-label="Take picture" title="Take picture" disabled>${CAMERA_ICON}</button></main>`,
        afterRender: bindCamera,
        onDispose: stopCamera
    })]));
})();
