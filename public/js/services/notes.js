(async () => {
    const NOTE_CONTENT_PREFIX = "__STD_NOTE_B64__:";
    const escapeQuotedValue = value => String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const encodeNoteContent = value => {
        const bytes = new TextEncoder().encode(String(value || ""));
        let binary = "";
        bytes.forEach(byte => binary += String.fromCharCode(byte));
        return `${NOTE_CONTENT_PREFIX}${btoa(binary)}`;
    };
    const decodeNoteContent = value => {
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
        const parser = new DOMParser();
        const parsed = parser.parseFromString(`<div>${String(markup || "")}</div>`, "text/html");
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
    const normalizeNoteContent = value => decodeNoteContent(value);
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
        return {
            id: noteTile.getAttribute("data"),
            created: noteTile.querySelector("em")?.innerText || "View Note",
            content: noteTile.querySelector(".note-tile-content")?.innerHTML || "",
            color: noteTile.style.background || window.getComputedStyle(noteTile).getPropertyValue("background-color")
        };
    };
    const noteColors = [
        {name: "Red", color: "rgba(240, 173, 176, 0.5)", secondary: "rgba(240, 173, 176, 0.5)"},
        {name: "Orange", color: "rgba(245, 194, 171, 0.5)", secondary: "rgba(245, 194, 171, 0.5)"},
        {name: "Yellow", color: "rgba(250, 224, 173, 0.5)", secondary: "rgba(250, 224, 173, 0.5)"},
        {name: "Green", color: "rgba(198, 215, 178, 0.5)", secondary: "rgba(198, 215, 178, 0.5)"},
        {name: "Blue", color: "rgba(196, 222, 240, 0.5)", secondary: "rgba(196, 222, 240, 0.5)"},
        {name: "Off", color: "rgba(237, 237, 237, 0.5)", secondary: "rgba(209, 209, 209, 0.5)"},
        {name: "Normal", color: "rgba(255, 255, 255, 0.5)", secondary: "rgba(238, 238, 238, 0.5)"},
        {name: "Dark Gray", color: "rgba(211, 211, 211, 0.5)", secondary: "rgba(211, 211, 211, 0.5)"},
    ];
    const deleteNote = (noteId, onSuccess = () => {}) => {
        if (!noteId) return;
        confirmationDialogue({title: "Delete Note", content: "You're sure you want to delete this note?",
            confirmation: () => {
                CLI.send(`[notes] - <id ${noteId}>`).then(response => {
                    if (response !== 0) {
                        onSuccess();
                        refreshNotes();
                    } else {
                        modular.error("Unable to delete note");
                    }
                });
            }
        });
    };
    const openNote = (note = {}) => {
        const noteContent = normalizeNoteContent(note.content || "");
        const noteColor = note.color || "";
        const noteCreated = note.created || "View Note";
        const notePortal = new Portal({
            title: noteCreated,
            dimensions: [380, 270],
            navigation: false,
            tools: [{
                title: "Edit",
                icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.35" stroke="currentColor"><g transform="scale(0.9) translate(1.333 1.333) translate(0.25 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.75a2.121 2.121 0 1 1 3 3L9 17.25 4.5 18.75 6 14.25 16.5 3.75Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 5.25l3 3" /></g></svg>`,
                onclick: () => {
                    notePortal.close();
                    openNoteEditor(note);
                }
            },{
                title: "Delete",
                icon: modular.icons.delete,
                onclick: () => deleteNote(note.id, () => notePortal.close())
            }],
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>`,
            route: () => div({style : "padded large-padding-top", content : `<div class="note-view-content">${sanitizeNoteMarkup(noteContent)}</div>`}),
            afterRender: win => {
                win.style.background = noteColor;
                bindNoteImageViewer(win);
            }
        });
        notePortal.show();
    };
    const openNoteEditor = (note = {}) => {
        const noteId = note.id;
        const noteContent = normalizeNoteContent(note.content || "");
        const noteColor = note.color || "";
        const noteEditorPortal = new Portal({
            title: "Edit Note",
            dimensions: [380, 300],
            navigation: false,
            tools: [{
                title: "Save",
                icon: modular.icons.save,
                onclick: (_, context) => {
                    const updatedContent = getNoteMarkup(document.getElementById("edit-note-content"));
                    const updatedColor = document.getElementById("edit-note-color").value;
                    const escapedContent = serializeNoteContent(updatedContent);
                    const escapedColor = escapeQuotedValue(updatedColor);
                    Promise.all([
                        CLI.send(`[notes] content "${escapedContent}" <id ${noteId}>`),
                        CLI.send(`[notes] color "${escapedColor}" <id ${noteId}>`)
                    ]).then(([contentResponse, colorResponse]) => {
                        if (contentResponse !== 0 && colorResponse !== 0) {
                            context?.portal?.close?.();
                            refreshNotes();
                        } else {
                            modular.error("Failed to update note");
                        }
                    });
                }
            }, {
                title: "Delete",
                icon: modular.icons.delete,
                onclick: () => deleteNote(noteId, () => noteEditorPortal.close())
            }],
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>`,
            route: () => div({style: "large-padding-top editor-portal-shell", content : children([
                    input({type : "hidden", id : "edit-note-color"}),
                    div({id : "edit-note-content", contenteditable: true, style : "undecorated fill padded", content: sanitizeNoteMarkup(noteContent)}),
                    colorPicker({id: "edit-note-foreground", colors: noteColors})
                ])
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
    const createNotePortal = new Portal({
        title: "Create Note",
        hints: ["create note", "new note", "make a note"],
        dimensions: [380, 300],
        navigation: false,
        tools: [{
            title: "Save",
            icon: modular.icons.save,
            onclick: (_, context) => {
                const userId = modular.user.id();
                const content = getNoteMarkup(document.getElementById("new-note-content"));
                const color = document.getElementById("new-note-color").value;
                CLI.send(`[notes] + (@${userId}, "${serializeNoteContent(content)}", "${escapeQuotedValue(color)}", @)`).then(d => {
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
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>`,
        route: _ => div({style: "large-padding-top editor-portal-shell", content : children([
                input({type : "hidden", id : "new-note-color"}),
                div({style : "undecorated fill padded", id : "new-note-content", contenteditable: true, content: ""}),
                colorPicker({id: "foreground", colors: noteColors})
            ])
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
                icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`,
                onclick: _ => modular.show("com.standard.notes", 1)
            }],
            svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>`,
            icon: "/icons/interfaces/notes.png",
            route: () => div({style: "large-padding-top padding-right", content: children([
                    div({style : "notes-list", content: div({style: "padded", content: () => {
                            return CLI.send("[notes]").then(d => {
                                let as = [];
                                for (let i = 0; i < d.notes.length; i++) {
                                        const note = d.notes[i];
                                        as.push(div({style: "note-tile padded secondary-tile brick line small-spaced hover-shadowed",
                                            data: note.id,
                                            background: note.color,
                                            onclick: event => {
                                                if (event.target.closest("button") || event.target.closest("img")) return;
                                                openNote(note);
                                            },
                                            content: children([
                                                button({style: "naked inner-radius float-right expose small-padding",
                                                    icon: `<svg class="tiny-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>`,
                                                    onclick: () => openNoteEditor(note)
                                                }),
                                                button({style: "naked inner-radius float-right expose small-padding",
                                                    icon: `<svg class="tiny-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`,
                                                    onclick: () => deleteNote(note.id)
                                                }),
                                                em({style: "smaller faded", content: note.created}),
                                                div({style: "note-tile-content", content: sanitizeNoteMarkup(normalizeNoteContent(note.content))}),
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
                        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" /></svg>`,
                        label: "Open",
                        action: (b, e, el) => {
                            const nt = el.closest(".note-tile");
                            const note = getNoteTileData(nt);
                            if (!note) return;
                            openNote(note);
                        }
                    },{
                        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>`,
                        label: "Edit",
                        action: (b, e, el) => {
                            const nt = el.closest(".note-tile");
                            const note = getNoteTileData(nt);
                            if (!note) return;
                            openNoteEditor(note);
                        }
                    },{
                        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`,
                        label: "Delete",
                        destructive: true,
                        action: (b, e, el) => {
                            const noteTile = el.closest(".note-tile");
                            deleteNote(noteTile?.getAttribute("data"));
                        }
                    }
                ]);
            }
        }),
        createNotePortal,
    ]));
})();