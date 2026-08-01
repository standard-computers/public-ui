(async () => {
    const NOTE_CONTENT_PREFIX = "__STD_NOTE_B64__:";
    const escapeQuotedValue = value => String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const encodeNoteContent = value => {
        const bytes = new TextEncoder().encode(String(value || ""));
        let binary = "";
        bytes.forEach(byte => binary += String.fromCharCode(byte));
        return `${NOTE_CONTENT_PREFIX}${btoa(binary)}`;
    };
    // const decodeNoteContent = value => {
    //     const raw = String(value || "");
    //     if (!raw.startsWith(NOTE_CONTENT_PREFIX)) return raw;
    //     try {
    //         const binary = atob(raw.slice(NOTE_CONTENT_PREFIX.length));
    //         const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    //         return new TextDecoder().decode(bytes);
    //     } catch (_) {
    //         return "";
    //     }
    // };
    const readFileAsDataUrl = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(reader.error || new Error("Failed to read image data"));
        reader.readAsDataURL(file);
    });
    const insertNodeAtCaret = (target, node) => {
        if (!target || !node) return;
        target.focus();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            target.appendChild(node);
            return;
        }
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    };
    const sanitizeNoteMarkup = markup => {
        // const parser = new DOMParser();
        const parsed = new DOMParser().parseFromString(`<div>${String(markup || "")}</div>`, "text/html");
        const root = parsed.body.firstElementChild;
        if (!root) return "";
        const allowedTags = new Set(["A", "B", "BR", "DIV", "EM", "I", "IMG", "LI", "OL", "P", "S", "SPAN", "STRONG", "U", "UL"]);
        const sanitizeUrl = (value, {image = false} = {}) => {
            const raw = String(value || "").trim();
            if (!raw) return "";
            if (image && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
            if (/^(https?:|mailto:|\/)/i.test(raw)) return raw;
            return "";
        };
        const sanitizeNode = node => {
            if (node.nodeType === Node.TEXT_NODE) return parsed.createTextNode(node.textContent || "");
            if (node.nodeType !== Node.ELEMENT_NODE) return null;
            const tagName = node.tagName.toUpperCase();
            if (!allowedTags.has(tagName)) {
                const fragment = parsed.createDocumentFragment();
                node.childNodes.forEach(child => {
                    const sanitizedChild = sanitizeNode(child);
                    if (sanitizedChild) fragment.appendChild(sanitizedChild);
                });
                return fragment;
            }
            const clean = parsed.createElement(tagName.toLowerCase());
            if (tagName === "A") {
                const href = sanitizeUrl(node.getAttribute("href"));
                if (href) {
                    clean.setAttribute("href", href);
                    clean.setAttribute("target", "_blank");
                    clean.setAttribute("rel", "noopener noreferrer");
                }
            }
            if (tagName === "IMG") {
                const src = sanitizeUrl(node.getAttribute("src"), {image: true}) || sanitizeUrl(node.getAttribute("src"));
                if (!src) return null;
                clean.setAttribute("src", src);
                clean.setAttribute("alt", String(node.getAttribute("alt") || "Pasted image").slice(0, 200));
                clean.setAttribute("loading", "lazy");
                clean.setAttribute("style", "max-width:100%;height:auto;display:block;border-radius:10px;margin:8px 0;cursor:zoom-in");
            }
            node.childNodes.forEach(child => {
                const sanitizedChild = sanitizeNode(child);
                if (sanitizedChild) clean.appendChild(sanitizedChild);
            });
            return clean;
        };
        const wrapper = parsed.createElement("div");
        root.childNodes.forEach(child => {
            const sanitizedChild = sanitizeNode(child);
            if (sanitizedChild) wrapper.appendChild(sanitizedChild);
        });
        return wrapper.innerHTML;
    };
    const getNoteMarkup = element => sanitizeNoteMarkup(element?.innerHTML || "");
    const serializeNoteContent = value => escapeQuotedValue(encodeNoteContent(sanitizeNoteMarkup(value)));
    const normalizeNoteContent = value => {
        const raw = String(value || "");
        if (!raw.startsWith(NOTE_CONTENT_PREFIX)) return raw;
        try {
            const binary = atob(raw.slice(NOTE_CONTENT_PREFIX.length));
            const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
            return new TextDecoder().decode(bytes);
        } catch (_) {
            return "";
        }
    };
    const normalizeNoteRecord = (note = {}) => ({
        ...note,
        id: note.id ?? note.ID ?? "",
        title: note.title ?? note.TTL ?? note.ttl ?? "",
        content: note.content ?? note.CNT ?? note.cnt ?? "",
        color: note.color ?? note.CLR ?? note.clr ?? "",
        created: note.created ?? note.CRTD ?? note.crtd ?? ""
    });
    const readPortalTitle = (context, fallback = "") => {
        const visibleTitle = context?.portal?.window?.()?.querySelector?.(".window-header .title")?.textContent;
        return `${visibleTitle || context?.portal?.title?.() || fallback || ""}`.replace(/\s+/g, " ").trim();
    };
    const openNoteImage = async source => {
        const imageSource = String(source || "").trim();
        if (!imageSource) return false;
        if (typeof window.StandardInternals?.openImageSource === "function") return window.StandardInternals.openImageSource(imageSource, {title: "Note Image"});
        if (typeof window.StandardInternals?.openImageFilePath === "function" && !imageSource.startsWith("data:image/")) return window.StandardInternals.openImageFilePath(imageSource);
        if (typeof modular?.start === "function") modular.start("com.standard.internals");
        for (let attempt = 0; attempt < 20; attempt++) {
            if (typeof window.StandardInternals?.openImageSource === "function") return window.StandardInternals.openImageSource(imageSource, {title: "Note Image"});
            if (typeof window.StandardInternals?.openImageFilePath === "function" && !imageSource.startsWith("data:image/")) return window.StandardInternals.openImageFilePath(imageSource);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return false;
    };
    const bindNoteImageViewer = root => {
        if (!root || root.dataset.noteImageViewerBound === "1") return;
        root.dataset.noteImageViewerBound = "1";
        root.addEventListener("click", event => {
            const image = event.target?.closest?.("img");
            if (!image) return;
            event.preventDefault();
            event.stopPropagation();
            openNoteImage(image.getAttribute("src") || "");
        });
    };
    const bindNoteComposer = ({editor, portalWindow, colorInput}) => {
        if (!editor || !portalWindow || !colorInput) return;
        editor.addEventListener("paste", async event => {
            const clipboard = event.clipboardData;
            const imageItems = Array.from(clipboard?.items || []).filter(item => item.type?.startsWith("image/"));
            if (imageItems.length === 0) return;
            event.preventDefault();
            for (const item of imageItems) {
                const file = item.getAsFile();
                if (!file) continue;
                try {
                    const src = await readFileAsDataUrl(file);
                    if (!src) continue;
                    const image = document.createElement("img");
                    image.src = src;
                    image.alt = file.name || "Pasted image";
                    insertNodeAtCaret(editor, image);
                    insertNodeAtCaret(editor, document.createElement("br"));
                } catch (_) {
                    modular.error("Unable to paste image");
                }
            }
        });
        colorInput.addEventListener("input", () => portalWindow.style.background = colorInput.value);
    };
    const refreshNotes = () => {
        modular.refresh("com.standard.notes");
        modular.refresh("com.standard.files");
    };
    const bindColorPreview = (root, colorInput, portalWindow) => {
        if (!root || !colorInput || !portalWindow) return;
        root.querySelectorAll(".color-option").forEach(co => co.addEventListener("mouseenter", () => {
            const selectedColor = window.getComputedStyle(co).getPropertyValue("background-color");
            colorInput.value = selectedColor;
            portalWindow.style.background = selectedColor;
        }));
    };
    const getNoteTileData = noteTile => {
        if (!noteTile) return null;
        const displayedTitle = noteTile.querySelector(".note-tile-title")?.innerText || noteTile.getAttribute("title") || "";
        return {
            id: noteTile.getAttribute("data"),
            title: displayedTitle,
            created: noteTile.querySelector("em")?.innerText || displayedTitle || "View Note",
            content: noteTile.querySelector(".note-tile-content")?.innerHTML || "",
            color: noteTile.style.background || window.getComputedStyle(noteTile).getPropertyValue("background-color")
        };
    };
    const renderNoNotesState = () => emptyState({
        style: "notes-empty-state",
        icon: "/icons/interfaces/notes.png",
        iconStyle: "notes-empty-icon",
        label: "No notes",
        labelStyle: "notes-empty-label"
    });
    const noteColors = [
        {name: "Red", color: "rgba(240, 173, 176, 0.5)", secondary: "rgba(240, 173, 176, 0.5)"},
        {name: "Orange", color: "rgba(245, 194, 171, 0.5)", secondary: "rgba(245, 194, 171, 0.5)"},
        {name: "Yellow", color: "rgba(250, 224, 173, 0.5)", secondary: "rgba(250, 224, 173, 0.5)"},
        {name: "Green", color: "rgba(198, 215, 178, 0.5)", secondary: "rgba(198, 215, 178, 0.5)"},
        {name: "Blue", color: "rgba(196, 222, 240, 0.5)", secondary: "rgba(196, 222, 240, 0.5)"},
        {name: "Off", color: "rgba(237, 237, 237, 0.5)", secondary: "rgba(209, 209, 209, 0.5)"},
        {name: "Normal", color: "rgba(255, 255, 255, 0.5)", secondary: "rgba(238, 238, 238, 0.5)"},
        {name: "Dark Gray", color: "rgba(211, 211, 211, 0.5)", secondary: "rgba(211, 211, 211, 0.5)"}
    ];
    const removeDeletedNoteTile = (noteId, tile = null) => {
        const deletedTile = tile?.closest?.(".note-tile");
        if (deletedTile) {
            deletedTile.remove();
            return;
        }
        document.querySelectorAll(".note-tile").forEach(noteTile => {
            if (noteTile.getAttribute("data") === String(noteId) || noteTile.getAttribute("directive") === String(noteId)) {
                noteTile.remove();
            }
        });
    };
    const deleteNote = (noteId, onSuccess = () => {}, tile = null) => {
        if (!noteId) return;
        confirmationDialogue({title: "Delete Note", content: "You're sure you want to delete this note?",
            confirmation: () => {
                CLI.send(`[notes] - <id ${noteId}>`).then(response => {
                    if (response !== 0) {
                        removeDeletedNoteTile(noteId, tile);
                        onSuccess();
                        modular.success("Deleted note");
                    } else {
                        modular.error("Unable to delete note");
                    }
                }).catch(() => {
                    modular.error("Unable to delete note");
                });
            }
        });
    };
    const openNote = (note = {}) => {
        note = normalizeNoteRecord(note);
        const noteContent = normalizeNoteContent(note.content || "");
        const noteColor = note.color || "";
        const noteCreated = note.title || note.created || "View Note";
        const notePortal = new Portal({
            title: noteCreated, dimensions: [380, 270], navigation: false, tools: [
                {
                    title: "Delete",
                    icon: modular.icons.delete,
                    onclick: () => deleteNote(note.id, () => notePortal.close())
                },
                {
                    title: "Edit",
                    icon: modular.icons.modify,
                    onclick: () => {
                        notePortal.close();
                        openNoteEditor(note);
                    }
                }
            ],
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>`,
            route: () => div({
                style: "padded large-padding-top",
                content: `<div class="note-view-content">${sanitizeNoteMarkup(noteContent)}</div>`
            }),
            afterRender: win => {
                win.style.background = noteColor;
                bindNoteImageViewer(win);
            }
        });
        notePortal.show();
    };
    const openNoteEditor = (note = {}) => {
        note = normalizeNoteRecord(note);
        const noteId = note.id;
        const noteContent = normalizeNoteContent(note.content || "");
        const noteColor = note.color || "";
        let updatedTitle = `${note.title || note.created || "Edit Note"}`.trim();
        const noteEditorPortal = new Portal({
            title: updatedTitle || "Edit Note",
            title_editable: true,
            on_title_change: title => {
                updatedTitle = title;
            },
            dimensions: [380, 300], navigation: false, tools: [
                {
                    title: "Delete",
                    icon: modular.icons.delete,
                    onclick: () => deleteNote(noteId, () => noteEditorPortal.close())
                },
                {
                    title: "Save", icon: modular.icons.save, onclick: (_, context) => {
                        updatedTitle = readPortalTitle(context, updatedTitle);
                        const updatedContent = getNoteMarkup(document.getElementById("edit-note-content"));
                        const updatedColor = document.getElementById("edit-note-color").value;
                        const escapedContent = serializeNoteContent(updatedContent);
                        const escapedColor = escapeQuotedValue(updatedColor);
                        Promise.all([
                            CLI.send(`[notes] content "${escapedContent}" <id ${noteId}>`),
                            CLI.send(`[notes] color "${escapedColor}" <id ${noteId}>`),
                            CLI.send(`[notes] title "${escapeQuotedValue(updatedTitle)}" <id ${noteId}>`)
                        ]).then(([contentResponse, colorResponse, titleResponse]) => {
                            if (contentResponse !== 0 && colorResponse !== 0 && titleResponse !== 0) {
                                context?.portal?.close?.();
                                refreshNotes();
                            } else {
                                modular.error("Failed to update note");
                            }
                        });
                    }
                }
            ],
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"/></svg>`,
            route: () => div({
                style: "large-padding-top editor-portal-shell",
                content: children([input({type: "hidden", id: "edit-note-color"}), div({
                    id: "edit-note-content",
                    contenteditable: true,
                    style: "undecorated fill padded",
                    content: sanitizeNoteMarkup(noteContent)
                }), colorPicker({id: "edit-note-foreground", colors: noteColors})])
            }),
            afterRender: win => {
                const editContent = document.getElementById("edit-note-content");
                const editColor = document.getElementById("edit-note-color");
                editContent.style.flex = "1";
                editContent.style.minHeight = "0";
                editContent.innerHTML = sanitizeNoteMarkup(noteContent);
                editColor.value = noteColor;
                win.style.background = noteColor;
                bindNoteComposer({editor: editContent, portalWindow: win, colorInput: editColor});
                bindColorPreview(document.getElementById("edit-note-foreground"), editColor, win);
            }
        });
        noteEditorPortal.show();
    };
    window.StandardNotes = {openNote, openNoteEditor};
    let newNoteTitle = "";
    const createNotePortal = new Portal({
        title: "Create Note",
        title_editable: true,
        on_title_change: title => {
            newNoteTitle = title;
        },
        onDispose: () => {
            newNoteTitle = "";
        },
        hints: ["create note", "new note", "make a note"],
        dimensions: [380, 300],
        navigation: false,
        tools: [{
            title: "Save", icon: modular.icons.save, onclick: (_, context) => {
                const userId = modular.user.id();
                const content = getNoteMarkup(document.getElementById("new-note-content"));
                const color = document.getElementById("new-note-color").value;
                const visibleTitle = readPortalTitle(context, newNoteTitle);
                const title = escapeQuotedValue(newNoteTitle || (visibleTitle === "Create Note" ? "" : visibleTitle));
                CLI.send(`[notes] + (@${userId}, "${title}", "${serializeNoteContent(content)}", "${escapeQuotedValue(color)}", @)`).then(d => {
                    if (d !== 0) {
                        context?.portal?.close?.();
                        refreshNotes();
                        modular.success("Created");
                    } else {
                        modular.error("Failed to create note");
                    }
                });
            }
        }],
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>`,
        route: _ => div({
            style: "large-padding-top editor-portal-shell",
            content: children([input({type: "hidden", id: "new-note-color"}), div({
                style: "undecorated fill padded",
                id: "new-note-content",
                contenteditable: true,
                content: ""
            }), colorPicker({id: "foreground", colors: noteColors})])
        }),
        afterRender: win => {
            const newNoteContent = document.getElementById("new-note-content");
            const newNoteColor = document.getElementById("new-note-color");
            newNoteContent.style.flex = "1";
            newNoteContent.style.minHeight = "0";
            bindNoteComposer({editor: newNoteContent, portalWindow: win, colorInput: newNoteColor});
            bindColorPreview(win, newNoteColor, win);
        }
    });
    modular.register(new Service("com.standard.notes", [
        new Portal({
            title: "Notes",
            hints: ["notes", "journal", "journaling", "journaling app", "journal app", "journaling app", "journal app"],
            dimensions: [380, 500],
            navigation: false,
            resizable: false,
            tools: [{
                title: "Create Note",
                icon: modular.icons.create,
                onclick: _ => modular.show("com.standard.notes", 1)
            }],
            svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>`,
            icon: "/icons/interfaces/notes.png",
            route: () => div({
                style: "large-padding-top padding-right", content: children([
                    div({
                        style: "notes-list", content: div({
                            style: "padded", content: () => {
                                return CLI.send("[notes]").then(d => {
                                    const noteRecords = d === 0 ? [] : (d.notes || d.NTS);
                                    if (!Array.isArray(noteRecords)) throw new Error("Invalid notes response");
                                    const notes = noteRecords.map(normalizeNoteRecord);
                                    if (notes.length === 0) return renderNoNotesState();
                                    let as = [];
                                    for (let i = 0; i < notes.length; i++) {
                                        const note = notes[i];
                                        as.push(div({
                                            style: "note-tile padded secondary-tile brick line small-spaced hover-shadowed",
                                            data: note.id,
                                            title: note.title || note.created || "",
                                            background: note.color,
                                            onclick: event => {
                                                if (event.target.closest("button") || event.target.closest("img")) return;
                                                openNote(note);
                                            },
                                            content: children([
                                                button({
                                                    style: "naked inner-radius float-right expose small-padding",
                                                    icon: modular.icons.modify,
                                                    onclick: () => openNoteEditor(note)
                                                }),
                                                button({
                                                    style: "naked inner-radius float-right expose small-padding",
                                                    icon: modular.icons.delete,
                                                    onclick: event => deleteNote(note.id, undefined, event.currentTarget)
                                                }),
                                                strong({style: "note-tile-title", content: escapeHtml(note.title || note.created || "Untitled Note")}),
                                                note.title ? em({style: "smaller faded", content: escapeHtml(note.created || "")}) : "",
                                                div({
                                                    style: "note-tile-content",
                                                    content: sanitizeNoteMarkup(normalizeNoteContent(note.content))
                                                }),
                                            ])
                                        }));
                                    }
                                    return children(as);
                                });
                            }
                        })
                    })
                ])
            }),
            afterRender: () => {
                const notesList = document.querySelector(".notes-list");
                bindNoteImageViewer(notesList);
                notesList.contextmenu([
                    {
                        icon: modular.icons.open, label: "Open", action: (b, e, el) => {
                            const nt = el.closest(".note-tile");
                            const note = getNoteTileData(nt);
                            if (!note) return;
                            openNote(note);
                        }
                    },
                    {
                        icon: modular.icons.modify, label: "Edit", action: (b, e, el) => {
                            const nt = el.closest(".note-tile");
                            const note = getNoteTileData(nt);
                            if (!note) return;
                            openNoteEditor(note);
                        }
                    },
                    {
                        icon: modular.icons.delete, label: "Delete", destructive: true, action: (b, e, el) => {
                            const noteTile = el.closest(".note-tile");
                            deleteNote(noteTile?.getAttribute("data"), undefined, noteTile);
                        }
                    }
                ]);
            }
        }),
        createNotePortal,
    ]));
})();
