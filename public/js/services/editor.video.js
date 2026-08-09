(() => {
    const SERVICE_ID = "com.standard.editor.video";
    const PROJECT_EXTENSION = ".video";
    const DEFAULT_PROJECT_NAME = `untitled${PROJECT_EXTENSION}`;
    const runtimeMedia = new WeakMap();
    const normalizePath = (value = "") => String(value || "").replace(/^\/home\/standard-system\//, "").replace(/^\/+/, "");
    const fileNameFromPath = (value = "") => String(value || "").split("/").pop() || DEFAULT_PROJECT_NAME;
    const ensureProjectExtension = (value = "") => String(value || "").toLowerCase().endsWith(PROJECT_EXTENSION) ? String(value || "") : `${value}${PROJECT_EXTENSION}`;
    const sanitizeProjectFileName = (value = "") => ensureProjectExtension(String(value || "").trim().replace(/\\/g, "/").split("/").pop().replace(/^\.+/, "").replace(/[^a-zA-Z0-9._-]/g, "") || "untitled");
    const makeClipId = () => `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const formatTime = (seconds = 0) => {
        const safeSeconds = Math.max(0, Number(seconds) || 0);
        const minutes = Math.floor(safeSeconds / 60);
        const remaining = safeSeconds - (minutes * 60);
        return `${String(minutes).padStart(2, "0")}:${remaining.toFixed(1).padStart(4, "0")}`;
    };
    const normalizeClip = (clip = {}) => ({
        id: String(clip.id || makeClipId()),
        name: String(clip.name || "Video clip"),
        sourcePath: normalizePath(clip.sourcePath || ""),
        duration: Math.max(0, Number(clip.duration) || 0),
        trimStart: Math.max(0, Number(clip.trimStart) || 0),
        trimEnd: Math.max(0, Number(clip.trimEnd ?? clip.duration) || 0),
        muted: clip.muted === true
    });
    const defaultState = () => ({
        directive: "",
        projectName: "Untitled video",
        aspectRatio: "16:9",
        playhead: 0,
        selectedClipId: "",
        clips: []
    });
    const getState = (portal) => {
        const state = portal?.windowState?.() || {};
        return {
            ...defaultState(),
            ...state,
            directive: normalizePath(state.directive || ""),
            clips: Array.isArray(state.clips) ? state.clips.map(normalizeClip) : []
        };
    };
    const setState = (portal, nextState = {}, options = {}) => {
        if (!portal?.setWindowState) return getState(portal);
        const merged = options.merge === false ? nextState : {...getState(portal), ...nextState};
        portal.setWindowState({...merged, clips: (merged.clips || []).map(normalizeClip)}, {merge: false, persist: options.persist !== false});
        return getState(portal);
    };
    const getRoot = (portal) => portal?.window?.()?.querySelector?.(".editor-video-shell") || null;
    const updateTitle = (portal) => {
        const state = getState(portal);
        const title = state.directive ? fileNameFromPath(state.directive) : state.projectName || "Untitled video";
        portal?.setTitle?.(`Video - ${title}`);
    };
    const getSelectedClip = (state) => state.clips.find((clip) => clip.id === state.selectedClipId) || null;

    const serializeProject = (state) => JSON.stringify({
        type: "standard-video-project",
        version: 1,
        name: state.projectName || "Untitled video",
        aspectRatio: state.aspectRatio || "16:9",
        clips: state.clips.map(({id, name, sourcePath, duration, trimStart, trimEnd, muted}) => ({id, name, sourcePath, duration, trimStart, trimEnd, muted}))
    }, null, 2);

    const saveProjectToPath = async (portal, targetPath = "") => {
        const normalizedPath = normalizePath(targetPath);
        if (!normalizedPath) {
            modular.error("File name is required");
            return false;
        }
        const state = getState(portal);
        const response = await window.StandardUploads.saveFile(serializeProject(state), normalizedPath, {label: `Saving ${fileNameFromPath(normalizedPath)}`});
        if (!response?.ok) {
            modular.error("Unable to save video project");
            return false;
        }
        setState(portal, {directive: normalizedPath});
        updateTitle(portal);
        await window.StandardFilesRefreshCache?.();
        modular.success(`Saved ${normalizedPath} (${response.byteCount} bytes)`);
        return true;
    };

    const saveProjectAs = (portal) => {
        const state = getState(portal);
        const suggestedName = state.directive ? fileNameFromPath(state.directive) : sanitizeProjectFileName(state.projectName || DEFAULT_PROJECT_NAME);
        inputDialogue({
            title: "Save video project as",
            placeholder: DEFAULT_PROJECT_NAME,
            value: suggestedName,
            location_picker: true,
            confirmation: async (_, inputFileName, location) => {
                if (!modular.validateFileName(inputFileName)) return;
                await saveProjectToPath(portal, `${location}/${sanitizeProjectFileName(inputFileName)}`);
            }
        });
    };
    const saveProject = async (portal) => {
        const {directive} = getState(portal);
        if (!directive) {
            saveProjectAs(portal);
            return;
        }
        await saveProjectToPath(portal, directive);
    };

    const renderEditor = (portal) => {
        const root = getRoot(portal);
        if (!root) return;
        const state = getState(portal);
        const selectedClip = getSelectedClip(state);
        const media = runtimeMedia.get(portal);
        const preview = root.querySelector(".editor-video-preview");
        if (preview) {
            preview.innerHTML = media?.url
                ? `<video controls preload="metadata" src="${media.url}"></video>`
                : `<div class="editor-video-empty">${modular.icons.video}<strong>Bring your first clip into the timeline</strong><p>Import a video to preview it, trim it, and save the edit as a Standard video project.</p><button type="button" class="editor-video-import primary">Import video</button></div>`;
        }
        const track = root.querySelector(".editor-video-track");
        if (track) track.innerHTML = state.clips.map((clip) => {
            const width = Math.max(150, Math.min(520, ((clip.trimEnd || clip.duration || 1) - clip.trimStart) * 18));
            return `<button type="button" class="editor-video-clip${clip.id === state.selectedClipId ? " selected" : ""}" data-clip-id="${clip.id}" style="width:${width}px"><strong>${clip.name.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</strong><span>${formatTime(clip.trimStart)} - ${formatTime(clip.trimEnd || clip.duration)}</span></button>`;
        }).join("");
        const playhead = root.querySelector(".editor-video-playhead");
        if (playhead) playhead.style.left = `${Math.max(0, state.playhead) * 18}px`;
        const inspector = root.querySelector(".editor-video-inspector-content");
        if (inspector) inspector.innerHTML = selectedClip ? `
            <label class="editor-video-field">Clip name<input class="editor-video-clip-name" value="${selectedClip.name.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></label>
            <div class="editor-video-field-row">
                <label class="editor-video-field">In<input class="editor-video-trim-start" type="number" min="0" max="${selectedClip.duration}" step="0.1" value="${selectedClip.trimStart}"></label>
                <label class="editor-video-field">Out<input class="editor-video-trim-end" type="number" min="0" max="${selectedClip.duration}" step="0.1" value="${selectedClip.trimEnd || selectedClip.duration}"></label>
            </div>
            <label class="editor-video-field">Audio<select class="editor-video-audio"><option value="on"${selectedClip.muted ? "" : " selected"}>On</option><option value="muted"${selectedClip.muted ? " selected" : ""}>Muted</option></select></label>` : `<p class="editor-video-inspector-note">Select a timeline clip to edit its name, trim points, and audio.</p>`;
        const currentTime = root.querySelector(".editor-video-current-time");
        if (currentTime) currentTime.textContent = formatTime(state.playhead);
        bindDynamicInteractions(portal);
    };

    const updateSelectedClip = (portal, updates = {}) => {
        const state = getState(portal);
        const clips = state.clips.map((clip) => clip.id === state.selectedClipId ? normalizeClip({...clip, ...updates}) : clip);
        setState(portal, {clips});
        renderEditor(portal);
    };

    const importVideo = (portal) => {
        const inputNode = document.createElement("input");
        inputNode.type = "file";
        inputNode.accept = "video/*";
        inputNode.addEventListener("change", () => {
            const file = inputNode.files?.[0];
            if (!file) return;
            const previousMedia = runtimeMedia.get(portal);
            if (previousMedia?.url) URL.revokeObjectURL(previousMedia.url);
            const url = URL.createObjectURL(file);
            const probe = document.createElement("video");
            probe.preload = "metadata";
            probe.src = url;
            probe.addEventListener("loadedmetadata", () => {
                const duration = Number.isFinite(probe.duration) ? probe.duration : 0;
                const clip = normalizeClip({id: makeClipId(), name: file.name, duration, trimEnd: duration});
                const state = getState(portal);
                runtimeMedia.set(portal, {url, fileName: file.name, clipId: clip.id});
                setState(portal, {clips: [...state.clips, clip], selectedClipId: clip.id});
                renderEditor(portal);
            }, {once: true});
            probe.addEventListener("error", () => {
                URL.revokeObjectURL(url);
                modular.error("Unable to read that video");
            }, {once: true});
        }, {once: true});
        inputNode.click();
    };

    const deleteSelectedClip = (portal) => {
        const state = getState(portal);
        if (!state.selectedClipId) return;
        const clips = state.clips.filter((clip) => clip.id !== state.selectedClipId);
        setState(portal, {clips, selectedClipId: clips[0]?.id || ""});
        renderEditor(portal);
    };

    const bindDynamicInteractions = (portal) => {
        const root = getRoot(portal);
        if (!root) return;
        root.querySelectorAll(".editor-video-import").forEach((node) => node.addEventListener("click", () => importVideo(portal), {once: true}));
        root.querySelectorAll(".editor-video-clip").forEach((node) => node.addEventListener("click", () => {
            setState(portal, {selectedClipId: node.dataset.clipId || ""});
            renderEditor(portal);
        }, {once: true}));
        root.querySelector(".editor-video-delete")?.addEventListener("click", () => deleteSelectedClip(portal), {once: true});
        root.querySelector(".editor-video-clip-name")?.addEventListener("change", (event) => updateSelectedClip(portal, {name: event.currentTarget.value.trim() || "Video clip"}), {once: true});
        root.querySelector(".editor-video-trim-start")?.addEventListener("change", (event) => {
            const selected = getSelectedClip(getState(portal));
            updateSelectedClip(portal, {trimStart: Math.min(Number(event.currentTarget.value) || 0, selected?.trimEnd || selected?.duration || 0)});
        }, {once: true});
        root.querySelector(".editor-video-trim-end")?.addEventListener("change", (event) => {
            const selected = getSelectedClip(getState(portal));
            updateSelectedClip(portal, {trimEnd: Math.max(selected?.trimStart || 0, Math.min(Number(event.currentTarget.value) || 0, selected?.duration || 0))});
        }, {once: true});
        root.querySelector(".editor-video-audio")?.addEventListener("change", (event) => updateSelectedClip(portal, {muted: event.currentTarget.value === "muted"}), {once: true});
        const video = root.querySelector("video");
        if (video) {
            video.addEventListener("timeupdate", () => {
                setState(portal, {playhead: video.currentTime}, {persist: false});
                const currentTime = root.querySelector(".editor-video-current-time");
                if (currentTime) currentTime.textContent = formatTime(video.currentTime);
                const playhead = root.querySelector(".editor-video-playhead");
                if (playhead) playhead.style.left = `${video.currentTime * 18}px`;
            });
        }
    };

    const bindEditor = (portal) => {
        const root = getRoot(portal);
        if (!root || root.dataset.bound === "1") return;
        root.dataset.bound = "1";
        root.querySelector(".editor-video-project-name")?.addEventListener("change", (event) => {
            setState(portal, {projectName: event.currentTarget.value.trim() || "Untitled video"});
            updateTitle(portal);
        });
        root.querySelector(".editor-video-aspect")?.addEventListener("change", (event) => setState(portal, {aspectRatio: event.currentTarget.value}));
        root.querySelector(".editor-video-play-toggle")?.addEventListener("click", () => {
            const video = root.querySelector("video");
            if (!video) {
                importVideo(portal);
                return;
            }
            if (video.paused) void video.play();
            else video.pause();
        });
        renderEditor(portal);
    };

    const openFreshVideoEditor = () => {
        const portal = modular.show(SERVICE_ID, 0, {newInstance: true});
        if (portal) {
            setState(portal, defaultState(), {merge: false});
            portal.refresh();
            updateTitle(portal);
        }
        return true;
    };

    window.StandardVideoEditor = window.StandardVideoEditor || {};
    window.StandardVideoEditor.openFreshVideoEditor = openFreshVideoEditor;

    modular.register(new Service(SERVICE_ID, [
        new Portal({
            title: "Video",
            hints: ["video editor", "edit video", "create video", "new video project"],
            action: openFreshVideoEditor,
            dimensions: [1100, 760],
            maximized: true,
            horizontal_nav: true,
            centered_nav: true,
            tools: [
                {title: "Save", icon: modular.icons.save, onclick: (_, context) => saveProject(context?.portal)}
            ],
            svg_icon: modular.icons.film,
            icon: "/icons/mp4.png",
            route: function () {
                const state = getState(this.portal);
                updateTitle(this.portal);
                return div({style: "large-padding-top editor-portal-shell", content: children([
                    div({style: "editor-video-shell", content: children([
                        div({style: "editor-video-preview-panel bordered shadowed radius", content: children([
                            div({style: "editor-video-preview"}),
                            div({style: "editor-video-transport", content: children([
                                div({style: "editor-video-transport-time editor-video-current-time", content: formatTime(state.playhead)}),
                                div({style: "editor-video-transport-actions", content: children([
                                    button({style: "naked inner-radius editor-video-import", title: "Import video", icon: modular.icons.create}),
                                    button({style: "naked inner-radius editor-video-play-toggle", title: "Play or pause", icon: modular.icons.play})
                                ])}),
                                div({style: "editor-video-transport-time text-right", content: state.clips.length ? `${state.clips.length} clip${state.clips.length === 1 ? "" : "s"}` : "No clips"})
                            ])})
                        ])}),
                        div({style: "editor-video-inspector bordered shadowed radius", content: children([
                            `<h3 class="editor-video-panel-heading">Project</h3>`,
                            `<label class="editor-video-field">Name<input class="editor-video-project-name" value="${String(state.projectName).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"></label>`,
                            `<label class="editor-video-field">Canvas<select class="editor-video-aspect"><option value="16:9"${state.aspectRatio === "16:9" ? " selected" : ""}>Landscape 16:9</option><option value="9:16"${state.aspectRatio === "9:16" ? " selected" : ""}>Portrait 9:16</option><option value="1:1"${state.aspectRatio === "1:1" ? " selected" : ""}>Square 1:1</option></select></label>`,
                            `<h3 class="editor-video-panel-heading">Clip</h3>`,
                            div({style: "editor-video-inspector-content"})
                        ])}),
                        div({style: "editor-video-timeline bordered shadowed radius", content: children([
                            div({style: "editor-video-timeline-header", content: children([
                                `<strong>Timeline</strong>`,
                                div({style: "editor-video-timeline-actions", content: children([
                                    button({style: "naked inner-radius editor-video-import", title: "Import video", icon: modular.icons.create}),
                                    button({style: "naked inner-radius editor-video-delete", title: "Delete selected clip", icon: modular.icons.delete})
                                ])})
                            ])}),
                            `<div class="editor-video-track-wrap"><div class="editor-video-ruler">0s 5s 10s 15s 20s 25s 30s</div><div class="editor-video-playhead"></div><div class="editor-video-track"></div></div>`
                        ])})
                    ])})
                ])});
            },
            afterRender: function () {
                bindEditor(this.portal);
                updateTitle(this.portal);
            }
        })
    ]));
})();
