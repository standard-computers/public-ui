const CLI = {
    quotePathSegment(value = "") {
        return `"${String(value || "").replace(/\\/g, "/").trim().replace(/"/g, '\\"')}"`;
    },
    buildFilesCommand(action, ...paths) {
        const normalizedAction = String(action || "").trim();
        const normalizedPaths = paths.map((value) => CLI.quotePathSegment(value)).join(" ");
        return normalizedPaths ? `files ${normalizedAction} ${normalizedPaths}` : `files ${normalizedAction}`;
    },
    send(query, parseJson = true) {
        if (!query || typeof query !== "string") {
            return Promise.reject(new Error("CLI.send: query must be a non-empty string"));
        }
        const usePost = query.length > 1500;
        const url = usePost ? `/api/cli?_=${Date.now()}` : `/api/cli?query=${encodeURIComponent(query)}&_=${Date.now()}`;
        const options = {
            method: usePost ? "POST" : "GET",
            cache: "no-store",
            headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        };
        if (usePost) {
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify({query});
        }
        return fetch(url, options).then(async (response) => {
            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText.slice(0, 200)}` : ""}`);
            }
            const responseText = await response.text();
            if (!parseJson) return responseText;
            const normalizedText = responseText.replace(/^\uFEFF/, "").trim();
            if (!normalizedText) return "";
            try {
                return JSON.parse(normalizedText);
            } catch (_) {
                return responseText;
            }
        }).catch((error) => {
            console.error("CLI.send error:", error);
            throw error;
        });
    }
};
if (typeof window !== "undefined") window.CLI = CLI;