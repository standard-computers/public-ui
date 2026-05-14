if (document.getElementById("launch-interfaces")) document.getElementById("launch-interfaces").addEventListener("click", () => {
    document.getElementById("search-box").value = "interfaces";
    document.getElementById("interface-shortcuts").in();
});
function applyCommonAttributes(el, n) {
    if (!n) return;
    if (n.index) el.setAttribute("item-index", n.index);
    if (n.name) el.setAttribute("name", n.name);
    if (n.background) el.style.backgroundColor = n.background;
    if (n.title) el.title = n.title;
    if (n.secondary) el.setAttribute("secondary", n.secondary);
    if (n.primary) el.setAttribute("primary", n.primary);
    if (n.id) el.id = n.id;
    if (n.contenteditable) el.setAttribute("contenteditable", n.contenteditable);
    if (n.value) el.setAttribute("value", n.value);
    if (n.data) el.setAttribute("data", n.data);
    if (n.style) el.className = n.style;
}
let asyncContentIndex = 0;
const asyncContentPayloads = new Map();
let asyncContentObserverInitialized = false;
function setElementContent(target, value) {
    if (value instanceof Node) {
        target.innerHTML = "";
        target.appendChild(value);
    } else {
        target.innerHTML = value ?? "";
    }
}
function applyAsyncContentById(asyncId, root = document) {
    if (!asyncContentPayloads.has(asyncId) || !root || !root.querySelector) {
        return false;
    }
    const target = root.querySelector(`[data-async-content-id="${asyncId}"]`);
    if (!target) {
        return false;
    }
    try {
        setElementContent(target, asyncContentPayloads.get(asyncId));
    } finally {
        target.removeAttribute("data-async-content-id");
        asyncContentPayloads.delete(asyncId);
    }
    return true;
}
function processAsyncTargets(node) {
    if (!(node instanceof Element)) return;
    const immediateId = node.getAttribute("data-async-content-id");
    if (immediateId) {
        applyAsyncContentById(immediateId, node.ownerDocument ?? document);
    }
    const descendants = node.querySelectorAll ? Array.from(node.querySelectorAll('[data-async-content-id]')) : [];
    descendants.forEach((child) => {
        const childId = child.getAttribute('data-async-content-id');
        if (childId) {
            applyAsyncContentById(childId, child.ownerDocument ?? document);
        }
    });
}
function ensureAsyncContentObserver() {
    if (asyncContentObserverInitialized || typeof MutationObserver === "undefined") {
        return;
    }
    const startObserver = () => {
        if (!document.body) return;
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => processAsyncTargets(node));
            });
        });
        observer.observe(document.body, {childList: true, subtree: true});
        asyncContentObserverInitialized = true;
        processAsyncTargets(document.body);
    };
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startObserver, {once: true});
    } else {
        startObserver();
    }
}
ensureAsyncContentObserver();
function applyContent(el, n) {
    if (!n || n.content === undefined) return;
    if (typeof n.content === "function") {
        try {
            const result = n.content();
            if (result instanceof Promise) {
                const asyncId = `async-content-${asyncContentIndex++}`;
                el.setAttribute("data-async-content-id", asyncId);
                el.innerHTML = "Loading...";
                const handleResolved = (value) => {
                    asyncContentPayloads.set(asyncId, value);
                    if (!applyAsyncContentById(asyncId)) {
                        ensureAsyncContentObserver();
                    }
                };
                result.then((resolved) => {
                    handleResolved(resolved);
                }).catch((error) => {
                    console.error("Async content error:", error);
                    handleResolved("Failed to load content.");
                });
            } else {
                setElementContent(el, result);
            }
        } catch (error) {
            console.error("Content render error:", error);
            el.innerHTML = "Failed to load content.";
        }
    } else {
        setElementContent(el, n.content);
    }
}
function img(n) {
    const el = document.createElement("img");
    if (n.src) el.src = n.src;
    if (n.id) el.id = n.id;
    if (n.style) el.className = n.style;
    return el.outerHTML;
}
const elementEventHandlers = {};
let elementEventHandlerIndex = 0;
function registerElementHandler(el, eventName, handler) {
    if (!handler) return;
    const handlerId = `${eventName}-${elementEventHandlerIndex++}`;
    elementEventHandlers[handlerId] = handler;
    el.setAttribute(`data-${eventName}-id`, handlerId);
}
function div(n) {
    const el = document.createElement("div");
    if (n.menu) el.setAttribute("menu", n.menu);
    if (n.directive) el.setAttribute("directive", n.directive);
    registerElementHandler(el, "onclick", n.onclick);
    registerElementHandler(el, "ondblclick", n.ondblclick);
    registerElementHandler(el, "oncontextmenu", n.oncontextmenu);
    applyCommonAttributes(el, n);
    applyContent(el, n);
    return el.outerHTML;
}
function textarea(n) {
    const el = document.createElement("textarea");
    applyCommonAttributes(el, n);
    if (n.rows) el.rows = n.rows;
    if (n.placeholder) el.placeholder = n.placeholder;
    if (n.value) el.value = n.value;
    return el.outerHTML;
}
function blockquote(n) {
    const el = document.createElement("blockquote");
    applyCommonAttributes(el, n);
    applyContent(el, n);
    return el.outerHTML;
}
function h(n) {
    const level = n.level ?? 1;
    const el = document.createElement("h" + level);
    applyCommonAttributes(el, n);
    applyContent(el, n);
    return el.outerHTML;
}
function label(n) {
    const el = document.createElement("label");
    applyCommonAttributes(el, n);
    if (n.input) el.setAttribute("for", n.input);
    applyContent(el, n);
    return el.outerHTML;
}
function em(n) {
    const el = document.createElement("em");
    applyCommonAttributes(el, n);
    applyContent(el, n);
    return el.outerHTML;
}
function strong(n) {
    const strong = document.createElement("strong");
    applyCommonAttributes(strong, n);
    applyContent(strong, n);
    return strong.outerHTML;
}
const searchboxPayloads = {};
let searchboxIndex = 0;
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function renderSearchboxOptions(input, query = "") {
    if (!input) return;
    const searchboxId = input.getAttribute("data-searchbox-id");
    if (!searchboxId || !searchboxPayloads[searchboxId]) return;
    const dropdown = document.getElementById(`searchbox-options-${searchboxId}`);
    if (!dropdown) return;
    const payload = searchboxPayloads[searchboxId];
    const allOptions = payload.options;
    const normalizedQuery = String(query ?? "").toLowerCase().trim();
    const filteredOptions = allOptions.filter((option) => {
        if (!normalizedQuery) return true;
        const optionName = String(option?.name ?? "").toLowerCase();
        const optionValue = String(option?.value ?? "").toLowerCase();
        return optionName.includes(normalizedQuery) || optionValue.includes(normalizedQuery);
    });
    dropdown.innerHTML = filteredOptions.map((option) => {
        const optionName = escapeHtml(option?.name ?? option?.value ?? "");
        const optionValue = escapeHtml(option?.value ?? "");
        return `<button type="button" class="searchbox-option" data-searchbox-option-id="${searchboxId}" data-searchbox-option-value="${optionValue}" data-searchbox-option-name="${optionName}">${optionName}</button>`;
    }).join("");
    if (!filteredOptions.length) {
        dropdown.innerHTML = `<div class="searchbox-option-empty">No matches</div>`;
    }
    dropdown.style.display = "block";
}
function hideSearchboxOptions(searchboxId) {
    const dropdown = document.getElementById(`searchbox-options-${searchboxId}`);
    if (dropdown) dropdown.style.display = "none";
}
document.addEventListener("click", (event) => {
    const searchboxOption = event.target.closest('[data-searchbox-option-id]');
    if (searchboxOption) {
        const searchboxId = searchboxOption.getAttribute("data-searchbox-option-id");
        const selectedValue = searchboxOption.getAttribute("data-searchbox-option-value") ?? "";
        const selectedName = searchboxOption.getAttribute("data-searchbox-option-name") ?? selectedValue;
        const input = document.querySelector(`input[data-searchbox-id="${searchboxId}"]`);
        if (input) {
            input.value = selectedName;
            input.setAttribute("value", selectedName);
            input.setAttribute("data-searchbox-selected-value", selectedValue);
            input.setAttribute("data-searchbox-selected-name", selectedName);
            hideSearchboxOptions(searchboxId);
        }
        return;
    }
    const target = event.target.closest('[data-onclick-id]');
    if (target) {
        const handlerId = target.getAttribute('data-onclick-id');
        const handler = elementEventHandlers[handlerId];
        if (typeof handler === "function") {
            handler(event);
        }
    }
    document.querySelectorAll("input[data-searchbox-id]").forEach((input) => {
        if (!input.contains(event.target)) {
            const searchboxId = input.getAttribute("data-searchbox-id");
            hideSearchboxOptions(searchboxId);
        }
    });
});
document.addEventListener("dblclick", (event) => {
    const target = event.target.closest('[data-ondblclick-id]');
    if (!target) return;
    const handlerId = target.getAttribute('data-ondblclick-id');
    const handler = elementEventHandlers[handlerId];
    if (typeof handler === "function") {
        handler(event);
    }
});
document.addEventListener("contextmenu", (event) => {
    const target = event.target.closest('[data-oncontextmenu-id]');
    if (!target) return;
    const handlerId = target.getAttribute('data-oncontextmenu-id');
    const handler = elementEventHandlers[handlerId];
    if (typeof handler === "function") {
        handler(event);
    }
});
document.addEventListener("input", (event) => {
    const target = event.target.closest('input[data-searchbox-id]');
    if (!target) return;
    renderSearchboxOptions(target, target.value);
});
document.addEventListener("focusin", (event) => {
    const target = event.target.closest('input[data-searchbox-id]');
    if (!target) return;
    renderSearchboxOptions(target, target.value);
});
document.addEventListener("keydown", (event) => {
    const target = event.target.closest('input[data-searchbox-id]');
    if (!target) return;
    if (event.key === "Escape") {
        const searchboxId = target.getAttribute("data-searchbox-id");
        hideSearchboxOptions(searchboxId);
    }
});
document.addEventListener("change", (event) => {
    const target = event.target.closest('[data-onchange-id]');
    if (!target) return;
    const handlerId = target.getAttribute('data-onchange-id');
    const handler = elementEventHandlers[handlerId];
    if (typeof handler === "function") {
        handler(event);
    }
});
function button(n) {
    const el = document.createElement("button");
    applyCommonAttributes(el, n);
    if (n.tooltip) el.setAttribute("tooltip", n.tooltip);
    if (n.type) el.type = n.type;
    if (n.value) el.value = n.value;
    if (n.name) el.name = n.name;
    registerElementHandler(el, "onclick", n.onclick);
    applyContent(el, n);
    if (n.icon) el.innerHTML = n.icon;
    return el.outerHTML;
}
function input(n) {
    const el = document.createElement("input");
    applyCommonAttributes(el, n);
    if (n.type) el.type = n.type;
    if (n.placeholder) el.placeholder = n.placeholder;
    if (n.rows) el.rows = n.rows;
    if (n.tooltip) el.setAttribute("tooltip", n.tooltip);
    if (n.value) el.value = n.value;
    if (n.autofocus) el.autofocus = true;
    if (n.checked) el.setAttribute("checked", true)
    registerElementHandler(el, "onchange", n.onchange);
    return el.outerHTML;
}
function select(n = {}) {
    const el = document.createElement("select");
    applyCommonAttributes(el, n);
    if (n.disabled) el.disabled = true;
    registerElementHandler(el, "onchange", n.onchange);
    const options = Array.isArray(n.options) ? n.options : [];
    options.forEach((item) => {
        const option = document.createElement("option");
        option.value = item?.value ?? "";
        option.textContent = item?.label ?? item?.value ?? "";
        if (n.value !== undefined && `${item?.value ?? ""}` === `${n.value}`) {
            option.selected = true;
        }
        el.appendChild(option);
    });
    return el.outerHTML;
}
function searchbox(n = {}) {
    const searchboxId = `searchbox-${searchboxIndex++}`;
    const wrapper = document.createElement("div");
    wrapper.className = n.wrapperStyle ?? "searchbox-wrapper";
    const el = document.createElement("input");
    applyCommonAttributes(el, n);
    el.type = "text";
    el.autocomplete = "off";
    el.setAttribute("data-searchbox-id", searchboxId);
    if (n.placeholder) el.placeholder = n.placeholder;
    if (n.tooltip) el.setAttribute("tooltip", n.tooltip);
    if (n.value) el.value = n.value;
    if (n.autofocus) el.autofocus = true;
    const dropdown = document.createElement("div");
    dropdown.id = `searchbox-options-${searchboxId}`;
    dropdown.className = n.dropdownStyle ?? "searchbox-options";
    dropdown.style.display = "none";
    wrapper.append(el, dropdown);
    searchboxPayloads[searchboxId] = {
        options: Array.isArray(n.options) ? n.options : []
    };
    return wrapper.outerHTML;
}
function a(n) {
    const el = document.createElement("a");
    applyCommonAttributes(el, n);
    if (n.href) el.href = n.href;
    if (n.target) el.target = n.target;
    if (n.onclick) el.setAttribute("onclick", n.onclick);
    applyContent(el, n);
    return el.outerHTML;
}
function children(n) {
    return n.join("");
}
function createMarkupNode(markup = "") {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = String(markup || "").trim();
    return wrapper.firstElementChild;
}
function switcher(n = {}) {
    const styleClasses = (n.style || "float-right").trim();
    const mergedStyle = `${styleClasses} switcher align-right inline`.trim();
    return div({
        style: mergedStyle,
        content: children([input({
            style: "ios-switch float-right",
            type: "checkbox",
            id: n.id,
            checked: n.checked,
            onchange: n.onchange
        }), label({input: n.id})])
    })
}
function inputDialogue(n) {
    document.querySelectorAll(".dialogue").forEach(d => d.remove());
    document.getElementById("cover").in();
    const dialogue = createMarkupNode(div({
        style: "dialogue padded",
        content: children([
            label({content: n.title}),
            (n.title_entry ? input({style: "undecorated", placeholder: n.titleholder, value: n.title_value, autofocus: true}) : ""),
            input({style: "undecorated", placeholder: n.placeholder, value: n.value, autofocus: true}),
            div({style: "float-right", content: children([
                button({style: "undecorated space-right", content: "Cancel"}),
                button({style: "primary", content: "Confirm"})
            ])})
        ])
    }));
    document.querySelector("body").append(dialogue);
    const buttons = dialogue.querySelectorAll("button");
    const cancelButton = buttons[0] || null;
    const confirmButton = buttons[1] || null;
    const closeDialogue = () => {
        document.removeEventListener("keydown", dialogueKeydownHandler, true);
        document.getElementById("cover").out();
        dialogue.remove();
    };
    const dialogueKeydownHandler = (event) => {
        if (!dialogue.isConnected) return;
        if (event.key === "Escape") {
            event.preventDefault();
            cancelButton?.click();
            return;
        }
        if (event.key === "Enter" && dialogue.contains(document.activeElement) && document.activeElement?.matches("input")) {
            event.preventDefault();
            confirmButton?.click();
        }
    };
    cancelButton?.addEventListener("click", () => {
        closeDialogue();
    });
    confirmButton?.addEventListener("click", () => {
        const inputs = dialogue.querySelectorAll("input");
        const input_title = n.title_entry ? (inputs[0]?.value || "") : "";
        const input_content = n.title_entry ? (inputs[1]?.value || "") : (inputs[0]?.value || "");
        closeDialogue();
        n.confirmation(input_title, input_content);
    });
    document.addEventListener("keydown", dialogueKeydownHandler, true);
    dialogue.querySelector("input")?.focus();
}
function searchDialogue(n = {}) {
    document.querySelectorAll(".dialogue, .search-dialogue-popout").forEach(d => d.remove());
    const anchorNode = n.anchor instanceof Element ? n.anchor : null;
    const isPopout = !!anchorNode;
    if (!isPopout) document.getElementById("cover").in();
    let matches = [];
    let activeIndex = -1;
    const dialogue = createMarkupNode(div({
        style: `${isPopout ? "custom-context-menu search-dialogue-popout" : "dialogue"} padded search-dialogue`,
        content: children([
            label({content: n.title || "Search"}),
            input({style: "undecorated search-dialogue-input", placeholder: n.placeholder || "Search", value: n.value || "", autofocus: true}),
            div({style: "search-dialogue-results", content: ""}),
            div({style: "float-right search-dialogue-actions", content: children([
                button({style: "undecorated space-right", content: "Cancel"}),
                button({style: "primary", content: n.confirmText || "Confirm"})
            ])})
        ])
    }));
    const inputNode = dialogue.querySelector("input");
    const resultsNode = dialogue.querySelector(".search-dialogue-results");
    const buttons = dialogue.querySelectorAll("button");
    const cancelButton = buttons[0] || null;
    const confirmButton = buttons[1] || null;
    const closeDialogue = () => {
        document.removeEventListener("keydown", dialogueKeydownHandler, true);
        document.removeEventListener("mousedown", outsideClickHandler, true);
        window.removeEventListener("resize", positionPopout);
        if (!isPopout) document.getElementById("cover").out();
        dialogue.remove();
    };
    const positionPopout = () => {
        if (!isPopout || !dialogue.isConnected) return;
        const rect = anchorNode.getBoundingClientRect();
        dialogue.style.left = `${rect.left}px`;
        dialogue.style.top = `${rect.bottom + 6}px`;
        requestAnimationFrame(() => {
            const dialogueRect = dialogue.getBoundingClientRect();
            if (dialogueRect.right > window.innerWidth) {
                dialogue.style.left = `${Math.max(8, window.innerWidth - dialogueRect.width - 8)}px`;
            }
            if (dialogueRect.bottom > window.innerHeight) {
                dialogue.style.top = `${Math.max(8, rect.top - dialogueRect.height - 6)}px`;
            }
        });
    };
    const outsideClickHandler = (event) => {
        if (!isPopout || dialogue.contains(event.target) || anchorNode.contains(event.target)) return;
        closeDialogue();
    };
    const setActiveIndex = (nextIndex = -1) => {
        const visibleMatchCount = Math.min(matches.length, n.maxVisible || 8);
        activeIndex = visibleMatchCount ? Math.max(0, Math.min(nextIndex, visibleMatchCount - 1)) : -1;
        resultsNode.querySelectorAll(".search-dialogue-result").forEach((row, index) => {
            row.classList.toggle("active", index === activeIndex);
        });
    };
    const renderMatches = () => {
        resultsNode.innerHTML = "";
        const query = inputNode?.value || "";
        matches = typeof n.matches === "function" ? (n.matches(query) || []) : [];
        if (!query.trim()) {
            const emptyNode = document.createElement("div");
            emptyNode.className = "search-dialogue-empty";
            emptyNode.textContent = n.emptyText || "Start typing to search.";
            resultsNode.appendChild(emptyNode);
            setActiveIndex(-1);
            return;
        }
        if (!matches.length) {
            const emptyNode = document.createElement("div");
            emptyNode.className = "search-dialogue-empty";
            emptyNode.textContent = n.noResultsText || "No matches found.";
            resultsNode.appendChild(emptyNode);
            setActiveIndex(-1);
            return;
        }
        matches.slice(0, n.maxVisible || 8).forEach((match, index) => {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "search-dialogue-result";
            const titleNode = document.createElement("span");
            titleNode.className = "search-dialogue-result-title";
            titleNode.textContent = match?.label || String(match || "");
            row.appendChild(titleNode);
            if (match?.detail) {
                const detailNode = document.createElement("span");
                detailNode.className = "search-dialogue-result-detail";
                detailNode.textContent = match.detail;
                row.appendChild(detailNode);
            }
            row.addEventListener("click", () => {
                setActiveIndex(index);
                if (typeof n.preview === "function") n.preview(inputNode.value, matches[activeIndex], matches);
            });
            row.addEventListener("dblclick", () => confirmButton?.click());
            resultsNode.appendChild(row);
        });
        setActiveIndex(activeIndex >= 0 ? activeIndex : 0);
    };
    const dialogueKeydownHandler = (event) => {
        if (!dialogue.isConnected) return;
        if (event.key === "Escape") {
            event.preventDefault();
            cancelButton?.click();
            return;
        }
        if (event.key === "ArrowDown" && dialogue.contains(document.activeElement)) {
            event.preventDefault();
            setActiveIndex(activeIndex + 1);
            return;
        }
        if (event.key === "ArrowUp" && dialogue.contains(document.activeElement)) {
            event.preventDefault();
            setActiveIndex(activeIndex - 1);
            return;
        }
        if (event.key === "Enter" && dialogue.contains(document.activeElement)) {
            event.preventDefault();
            confirmButton?.click();
        }
    };
    cancelButton?.addEventListener("click", closeDialogue);
    confirmButton?.addEventListener("click", () => {
        const query = inputNode?.value || "";
        const selectedMatch = activeIndex >= 0 ? matches[activeIndex] : null;
        closeDialogue();
        if (typeof n.confirmation === "function") n.confirmation(query, selectedMatch, matches);
    });
    inputNode?.addEventListener("input", () => {
        activeIndex = -1;
        renderMatches();
        if (typeof n.input === "function") n.input(inputNode.value, matches);
    });
    document.querySelector("body").append(dialogue);
    positionPopout();
    document.addEventListener("keydown", dialogueKeydownHandler, true);
    document.addEventListener("mousedown", outsideClickHandler, true);
    window.addEventListener("resize", positionPopout);
    renderMatches();
    inputNode?.focus();
    inputNode?.select?.();
}
function confirmationDialogue(n) {
    document.getElementById("cover").in()
    document.querySelector("body").append(div({style: "dialogue padded center medium-padding", content: children([label({content: n.title}), blockquote({content: n.content}), button({style: "secondary space-right hover-zoom", content: "Cancel", onclick: () => {
        document.querySelectorAll(".dialogue").forEach(d => d.out());
        document.getElementById("cover").out()
    }}), button({style: "primary hover-shadowed hover-zoom", content: "Confirm", onclick: () => {
        document.querySelectorAll(".dialogue").forEach(d => d.out());
        document.getElementById("cover").out()
        n.confirmation();
    }})])}));
}
function colorPicker(n = {}) {
    const colors = Array.isArray(n.colors) ? n.colors : [];
    const styleClasses = (n.style || "").trim();
    const mergedStyle = `colors ${styleClasses}`.trim();
    return div({style: mergedStyle, id: n.id, content: () => {
            let cos = [];
            for (let i = 0; i < colors.length; i++) {
                const o = colors[i];
                cos.push(div({style: "color-option animated", background: o.color, primary: o.color, secondary: o.secondary, content: div({style: "color-name no-wrap hidden", content: o.name}), title: o.name}));
            }
            return children(cos);
        }
    })
}
function numbers(n) {
    return div({
        style: "number-picker no-scroll", id: n.id, content: () => {
            let ns = [];
            for (let i = n.min; i <= n.max; i += (n.inc ? n.inc : 2)) {
                if (i === n.selected) {
                    ns.push(div({style: "number animated selected-number", content: i, value: i}));
                } else {
                    ns.push(div({style: "number animated", content: i, value: i}));
                }
            }
            return children(ns);
        }
    })
}
const inlineStyleEditorState = {root: null, outsidePointerHandler: null, escapeHandler: null, close: null};
function removeInlineStyleEditor(triggerClose = true) {
    if (!inlineStyleEditorState.root) return;
    const closeHandler = inlineStyleEditorState.close;
    if (inlineStyleEditorState.outsidePointerHandler) {
        document.removeEventListener("mousedown", inlineStyleEditorState.outsidePointerHandler, true);
        inlineStyleEditorState.outsidePointerHandler = null;
    }
    if (inlineStyleEditorState.escapeHandler) {
        document.removeEventListener("keydown", inlineStyleEditorState.escapeHandler, true);
        inlineStyleEditorState.escapeHandler = null;
    }
    inlineStyleEditorState.root.remove();
    inlineStyleEditorState.root = null;
    inlineStyleEditorState.close = null;
    if (triggerClose && typeof closeHandler === "function") closeHandler();
}
function positionFloatingNode(node, x = 0, y = 0) {
    if (!(node instanceof HTMLElement)) return;
    const safeX = Number.isFinite(Number(x)) ? Number(x) : 0;
    const safeY = Number.isFinite(Number(y)) ? Number(y) : 0;
    node.style.left = `${safeX}px`;
    node.style.top = `${safeY}px`;
    requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const clampedLeft = Math.min(Math.max(8, safeX), Math.max(8, window.innerWidth - rect.width - 8));
        const clampedTop = Math.min(Math.max(8, safeY), Math.max(8, window.innerHeight - rect.height - 8));
        node.style.left = `${clampedLeft}px`;
        node.style.top = `${clampedTop}px`;
    });
}
function bindInlineStylePalette(editorNode, paletteId, selectedValue, onSelect) {
    const palette = editorNode?.querySelector(`#${paletteId}`);
    if (!palette) return;
    [...palette.querySelectorAll(".color-option")].forEach((option) => {
        const optionColor = option.getAttribute("primary") || option.style.backgroundColor || "";
        option.dataset.inlineStyleValue = optionColor;
        option.classList.toggle("selected", optionColor === selectedValue);
        option.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof onSelect === "function") onSelect(option.dataset.inlineStyleValue || "");
        });
    });
}
function showInlineStyleEditor(n = {}) {
    removeInlineStyleEditor(false);
    const title = String(n.title || "Styles");
    const activeStyle = {...(n.value || {})};
    const paletteSeed = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const textPaletteId = `inline-style-text-${paletteSeed}`;
    const fillPaletteId = `inline-style-fill-${paletteSeed}`;
    const textColors = Array.isArray(n.textColors) ? n.textColors : [
        {name: "Default", color: "transparent"},
        {name: "Ink", color: "var(--fg)"},
        {name: "Blue", color: "var(--blue)"},
        {name: "Green", color: "var(--green)"},
        {name: "Orange", color: "var(--orange)"},
        {name: "Red", color: "var(--red)"}
    ];
    const fillColors = Array.isArray(n.fillColors) ? n.fillColors : [
        {name: "None", color: "transparent"},
        {name: "Paper", color: "var(--bg)"},
        {name: "Soft", color: "var(--secondary-bg)"},
        {name: "Blue", color: "#dbeafe"},
        {name: "Green", color: "#dcfce7"},
        {name: "Yellow", color: "#fef3c7"}
    ];
    const editorNode = createMarkupNode(div({style: "custom-context-menu editor-inline-style-menu", content: children([
            div({style: "editor-inline-style-header", content: children([
                div({style: "editor-inline-style-title", content: title}),
                button({style: "tiny", content: "Reset", onclick: (event) => {
                        event.preventDefault();
                        if (typeof n.onchange === "function") n.onchange({});
                        removeInlineStyleEditor(false);
                    }
                })
            ])}),
            div({style: "editor-inline-style-row", content: children([
                button({style: activeStyle.fontWeight === "bold" ? "tiny primary naked" : "naked", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 5.7519531 2.0039062 A 0.750075 0.750075 0 0 0 5.0019531 2.7539062 L 5.0019531 11.703125 A 0.750075 0.750075 0 0 0 5.0019531 11.757812 L 5.0078125 21.257812 A 0.750075 0.750075 0 0 0 5.7578125 22.007812 L 13.505859 22.007812 C 16.534311 22.007812 19.005859 19.536265 19.005859 16.507812 C 19.005859 14.261755 17.639043 12.332811 15.701172 11.480469 C 17.057796 10.528976 18.005859 9.0314614 18.005859 7.2558594 C 18.005859 4.3643887 15.645377 2.0039063 12.753906 2.0039062 L 5.7519531 2.0039062 z M 6.5019531 3.5039062 L 12.753906 3.5039062 C 14.834436 3.5039063 16.505859 5.17533 16.505859 7.2558594 C 16.505859 9.3363887 14.834436 11.007813 12.753906 11.007812 L 6.5019531 11.007812 L 6.5019531 3.5039062 z M 6.5019531 12.507812 L 12.753906 12.507812 L 13.505859 12.507812 C 15.723408 12.507812 17.505859 14.290264 17.505859 16.507812 C 17.505859 18.725361 15.723408 20.507812 13.505859 20.507812 L 6.5058594 20.507812 L 6.5019531 12.507812 z"/></svg>`, onclick: (event) => {
                        event.preventDefault();
                        activeStyle.fontWeight = activeStyle.fontWeight === "bold" ? "" : "bold";
                        if (typeof n.onchange === "function") n.onchange({...activeStyle});
                        removeInlineStyleEditor(false);
                    }
                }),
                button({style: activeStyle.fontStyle === "italic" ? "tiny primary naked" : "naked", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 10 2.0078125 L 10 3.5078125 L 10.75 3.5078125 L 13.119141 3.5078125 L 9.3417969 20.503906 L 6.7558594 20.503906 L 6.0058594 20.503906 L 6.0058594 22.003906 L 6.7558594 22.003906 L 13.255859 22.003906 L 14.005859 22.003906 L 14.005859 20.503906 L 13.255859 20.503906 L 10.878906 20.503906 L 14.65625 3.5078125 L 17.25 3.5078125 L 18 3.5078125 L 18 2.0078125 L 17.25 2.0078125 L 10.75 2.0078125 L 10 2.0078125 z"/></svg>`, onclick: (event) => {
                        event.preventDefault();
                        activeStyle.fontStyle = activeStyle.fontStyle === "italic" ? "" : "italic";
                        if (typeof n.onchange === "function") n.onchange({...activeStyle});
                        removeInlineStyleEditor(false);
                    }
                }),
                button({style: activeStyle.textDecoration === "underline" ? "tiny primary naked" : "naked", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 6.0058594 2 L 6.0058594 2.75 L 6.0058594 12.585938 C 6.0058594 15.618894 8.7446099 18.001953 12.003906 18.001953 C 15.263203 18.001953 18.003906 15.618893 18.003906 12.585938 L 18.003906 2.75 L 18.003906 2 L 16.503906 2 L 16.503906 2.75 L 16.503906 12.585938 C 16.503906 14.706981 14.54261 16.501953 12.003906 16.501953 C 9.4652032 16.501953 7.5058594 14.70698 7.5058594 12.585938 L 7.5058594 2.75 L 7.5058594 2 L 6.0058594 2 z M 4.9980469 20.003906 L 4.9980469 21.503906 L 5.7480469 21.503906 L 18.251953 21.503906 L 19.001953 21.503906 L 19.001953 20.003906 L 18.251953 20.003906 L 5.7480469 20.003906 L 4.9980469 20.003906 z"/></svg>`, onclick: (event) => {
                        event.preventDefault();
                        activeStyle.textDecoration = activeStyle.textDecoration === "underline" ? "" : "underline";
                        if (typeof n.onchange === "function") n.onchange({...activeStyle});
                        removeInlineStyleEditor(false);
                    }
                }),
                select({style: "editor-inline-style-select", value: activeStyle.textAlign || "",
                    options: [
                        {label: "Align", value: ""},
                        {label: "Left", value: "left"},
                        {label: "Center", value: "center"},
                        {label: "Right", value: "right"}
                    ],
                    onchange: (event) => {
                        activeStyle.textAlign = event?.target?.value || "";
                        if (typeof n.onchange === "function") n.onchange({...activeStyle});
                    }
                }),
                select({style: "editor-inline-style-select", value: activeStyle.fontSize ? String(activeStyle.fontSize).replace(/px$/i, "") : "",
                    options: [
                        {label: "Size", value: ""},
                        {label: "12", value: "12"},
                        {label: "14", value: "14"},
                        {label: "16", value: "16"},
                        {label: "18", value: "18"},
                        {label: "20", value: "20"},
                        {label: "24", value: "24"}
                    ],
                    onchange: (event) => {
                        const nextSize = String(event?.target?.value || "").trim();
                        activeStyle.fontSize = nextSize ? `${nextSize}px` : "";
                        if (typeof n.onchange === "function") n.onchange({...activeStyle});
                    }
                })
            ])}),
            div({style: "editor-inline-style-label", content: "Text"}),
            colorPicker({id: textPaletteId, style: "editor-inline-style-palette", colors: textColors}),
            div({style: "editor-inline-style-label", content: "Fill"}),
            colorPicker({id: fillPaletteId, style: "editor-inline-style-palette", colors: fillColors})
        ])
    }));
    if (!editorNode) return null;
    document.body.append(editorNode);
    bindInlineStylePalette(editorNode, textPaletteId, activeStyle.color || "transparent", (value) => {
        activeStyle.color = value === "transparent" ? "" : value;
        if (typeof n.onchange === "function") n.onchange({...activeStyle});
        removeInlineStyleEditor(false);
    });
    bindInlineStylePalette(editorNode, fillPaletteId, activeStyle.backgroundColor || "transparent", (value) => {
        activeStyle.backgroundColor = value === "transparent" ? "" : value;
        if (typeof n.onchange === "function") n.onchange({...activeStyle});
        removeInlineStyleEditor(false);
    });
    positionFloatingNode(editorNode, n.x, n.y);
    inlineStyleEditorState.root = editorNode;
    inlineStyleEditorState.close = typeof n.onclose === "function" ? n.onclose : null;
    inlineStyleEditorState.outsidePointerHandler = (event) => {
        if (!editorNode.contains(event.target)) removeInlineStyleEditor(true);
    };
    inlineStyleEditorState.escapeHandler = (event) => {
        if (event.key === "Escape") removeInlineStyleEditor(true);
    };
    setTimeout(() => {
        document.addEventListener("mousedown", inlineStyleEditorState.outsidePointerHandler, true);
        document.addEventListener("keydown", inlineStyleEditorState.escapeHandler, true);
    }, 0);
    return editorNode;
}
const PLASTIC_CHART_COLORS = ["#2563eb", "#16a34a", "#f97316", "#dc2626", "#7c3aed", "#0891b2", "#ca8a04", "#db2777"];
function normalizePlasticChartData(data = []) {
    return (Array.isArray(data) ? data : []).map((item, index) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
            const value = Number(item.value ?? item.y ?? item.amount);
            return {
                label: String(item.label ?? item.name ?? item.x ?? `Item ${index + 1}`),
                value: Number.isFinite(value) ? value : 0,
                color: item.color || PLASTIC_CHART_COLORS[index % PLASTIC_CHART_COLORS.length]
            };
        }
        const value = Number(item);
        return {
            label: `Item ${index + 1}`,
            value: Number.isFinite(value) ? value : 0,
            color: PLASTIC_CHART_COLORS[index % PLASTIC_CHART_COLORS.length]
        };
    });
}
function getPlasticChartBounds(data = []) {
    const values = normalizePlasticChartData(data).map((item) => item.value);
    const minValue = Math.min(0, ...values);
    const maxValue = Math.max(1, ...values);
    const range = maxValue - minValue || 1;
    return {minValue, maxValue, range};
}
function formatPlasticChartValue(value = 0) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return "0";
    return Number.isInteger(numericValue) ? String(numericValue) : String(Number(numericValue.toFixed(2)));
}
function getPlasticChartItemTitle(item = {}) {
    return `${item.label}: ${formatPlasticChartValue(item.value)}`;
}
function plasticSvgNode(n = {}) {
    const namespace = "http://www.w3.org/2000/svg";
    const node = document.createElementNS(namespace, n.tag || "svg");
    Object.entries(n.attrs || {}).forEach(([key, value]) => {
        if (value !== null && typeof value !== "undefined") node.setAttribute(key, String(value));
    });
    if (n.text) node.textContent = n.text;
    (n.children || []).forEach((child) => node.append(child));
    return node;
}
function appendPlasticSvgTitle(node, text = "") {
    if (!node || !text) return node;
    node.append(plasticSvgNode({tag: "title", text}));
    return node;
}
function appendPlasticValueLabel(svg, text = "", x = 0, y = 0, anchor = "middle") {
    svg.append(plasticSvgNode({
        tag: "text",
        text,
        attrs: {x, y, class: "plastic-chart-value-label", "text-anchor": anchor}
    }));
}
function createPlasticChartFrame(n = {}) {
    const width = Number(n.width) || 360;
    const height = Number(n.height) || 240;
    const root = document.createElement("div");
    root.className = `plastic-chart plastic-chart-${n.type || "bar"}`;
    root.style.width = `${width}px`;
    root.style.height = `${height}px`;
    const title = String(n.title || "").trim();
    if (title) {
        const titleNode = document.createElement("div");
        titleNode.className = "plastic-chart-title";
        titleNode.textContent = title;
        root.append(titleNode);
    }
    const svg = plasticSvgNode({attrs: {viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": title || "Chart"}});
    root.append(svg);
    return {root, svg, width, height};
}
function drawPlasticChartAxes(svg, width, height, inset = {}) {
    const left = inset.left ?? 42;
    const right = inset.right ?? 16;
    const top = inset.top ?? 20;
    const bottom = inset.bottom ?? 38;
    svg.append(plasticSvgNode({tag: "line", attrs: {x1: left, y1: top, x2: left, y2: height - bottom, class: "plastic-chart-axis"}}));
    svg.append(plasticSvgNode({tag: "line", attrs: {x1: left, y1: height - bottom, x2: width - right, y2: height - bottom, class: "plastic-chart-axis"}}));
    return {left, right, top, bottom, plotWidth: width - left - right, plotHeight: height - top - bottom};
}
function barChart(n = {}) {
    const data = normalizePlasticChartData(n.data);
    const {root, svg, width, height} = createPlasticChartFrame({...n, type: "bar"});
    const plot = drawPlasticChartAxes(svg, width, height);
    const bounds = getPlasticChartBounds(data);
    const slot = plot.plotWidth / Math.max(data.length, 1);
    const barWidth = Math.max(8, slot * 0.58);
    data.forEach((item, index) => {
        const ratio = (item.value - bounds.minValue) / bounds.range;
        const barHeight = Math.max(1, ratio * plot.plotHeight);
        const x = plot.left + (slot * index) + ((slot - barWidth) / 2);
        const y = plot.top + plot.plotHeight - barHeight;
        svg.append(appendPlasticSvgTitle(plasticSvgNode({tag: "rect", attrs: {x, y, width: barWidth, height: barHeight, rx: 3, fill: item.color, class: "plastic-chart-value-mark"}}), getPlasticChartItemTitle(item)));
        if (n.labelValues) appendPlasticValueLabel(svg, formatPlasticChartValue(item.value), x + (barWidth / 2), Math.max(plot.top + 12, y - 6));
        svg.append(plasticSvgNode({tag: "text", text: item.label, attrs: {x: x + (barWidth / 2), y: height - 14, class: "plastic-chart-label", "text-anchor": "middle"}}));
    });
    return root;
}
function lineChart(n = {}) {
    const data = normalizePlasticChartData(n.data);
    const {root, svg, width, height} = createPlasticChartFrame({...n, type: "line"});
    const plot = drawPlasticChartAxes(svg, width, height);
    const bounds = getPlasticChartBounds(data);
    const points = data.map((item, index) => {
        const x = plot.left + (data.length <= 1 ? plot.plotWidth / 2 : (plot.plotWidth / (data.length - 1)) * index);
        const y = plot.top + plot.plotHeight - (((item.value - bounds.minValue) / bounds.range) * plot.plotHeight);
        return {x, y, item};
    });
    if (points.length) {
        svg.append(plasticSvgNode({tag: "polyline", attrs: {points: points.map((point) => `${point.x},${point.y}`).join(" "), class: "plastic-chart-line"}}));
    }
    points.forEach((point, index) => {
        svg.append(appendPlasticSvgTitle(plasticSvgNode({tag: "circle", attrs: {cx: point.x, cy: point.y, r: 4, fill: point.item.color || PLASTIC_CHART_COLORS[index % PLASTIC_CHART_COLORS.length], class: "plastic-chart-value-mark"}}), getPlasticChartItemTitle(point.item)));
        if (n.labelValues) appendPlasticValueLabel(svg, formatPlasticChartValue(point.item.value), point.x, Math.max(plot.top + 12, point.y - 8));
        svg.append(plasticSvgNode({tag: "text", text: point.item.label, attrs: {x: point.x, y: height - 14, class: "plastic-chart-label", "text-anchor": "middle"}}));
    });
    return root;
}
function areaChart(n = {}) {
    const data = normalizePlasticChartData(n.data);
    const {root, svg, width, height} = createPlasticChartFrame({...n, type: "area"});
    const plot = drawPlasticChartAxes(svg, width, height);
    const bounds = getPlasticChartBounds(data);
    const points = data.map((item, index) => {
        const x = plot.left + (data.length <= 1 ? plot.plotWidth / 2 : (plot.plotWidth / (data.length - 1)) * index);
        const y = plot.top + plot.plotHeight - (((item.value - bounds.minValue) / bounds.range) * plot.plotHeight);
        return {x, y, item};
    });
    if (points.length) {
        const baseline = plot.top + plot.plotHeight;
        const pathPoints = [`${plot.left},${baseline}`, ...points.map((point) => `${point.x},${point.y}`), `${plot.left + plot.plotWidth},${baseline}`];
        svg.append(plasticSvgNode({tag: "polygon", attrs: {points: pathPoints.join(" "), class: "plastic-chart-area"}}));
        svg.append(plasticSvgNode({tag: "polyline", attrs: {points: points.map((point) => `${point.x},${point.y}`).join(" "), class: "plastic-chart-line"}}));
    }
    points.forEach((point, index) => {
        svg.append(appendPlasticSvgTitle(plasticSvgNode({tag: "circle", attrs: {cx: point.x, cy: point.y, r: 4, fill: point.item.color || PLASTIC_CHART_COLORS[index % PLASTIC_CHART_COLORS.length], class: "plastic-chart-value-mark"}}), getPlasticChartItemTitle(point.item)));
        if (n.labelValues) appendPlasticValueLabel(svg, formatPlasticChartValue(point.item.value), point.x, Math.max(plot.top + 12, point.y - 8));
    });
    return root;
}
function scatterChart(n = {}) {
    const data = normalizePlasticChartData(n.data);
    const {root, svg, width, height} = createPlasticChartFrame({...n, type: "scatter"});
    const plot = drawPlasticChartAxes(svg, width, height);
    const bounds = getPlasticChartBounds(data);
    data.forEach((item, index) => {
        const x = plot.left + (data.length <= 1 ? plot.plotWidth / 2 : (plot.plotWidth / (data.length - 1)) * index);
        const y = plot.top + plot.plotHeight - (((item.value - bounds.minValue) / bounds.range) * plot.plotHeight);
        svg.append(appendPlasticSvgTitle(plasticSvgNode({tag: "circle", attrs: {cx: x, cy: y, r: 5, fill: item.color, class: "plastic-chart-value-mark"}}), getPlasticChartItemTitle(item)));
        if (n.labelValues) appendPlasticValueLabel(svg, formatPlasticChartValue(item.value), x, Math.max(plot.top + 12, y - 8));
        svg.append(plasticSvgNode({tag: "text", text: item.label, attrs: {x, y: height - 14, class: "plastic-chart-label", "text-anchor": "middle"}}));
    });
    return root;
}
function pie(n = {}) {
    const el = document.createElement("div");
    applyCommonAttributes(el, n);
    const data = Array.isArray(n.data) ? n.data : [];
    const total = data.reduce((sum, item) => {
        const value = Number(item?.value);
        return sum + (Number.isFinite(value) ? Math.max(0, value) : 0);
    }, 0);
    const sizeValue = n.size ?? 120;
    const size = typeof sizeValue === "number" ? `${sizeValue}px` : sizeValue;
    el.style.width = size;
    el.style.height = size;
    el.style.borderRadius = "50%";
    el.style.display = "inline-block";
    el.style.position = "relative";
    if (total > 0) {
        let current = 0;
        const slices = data.map((item) => {
            const value = Number(item?.value);
            const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
            const start = (current / total) * 100;
            const end = ((current + safeValue) / total) * 100;
            current += safeValue;
            const color = item?.color ?? n.fallbackColor ?? "#9ca3af";
            return `${color} ${start}% ${end}%`;
        }).filter((slice) => slice);
        el.style.background = `conic-gradient(${slices.join(", ")})`;
    } else {
        el.style.background = n.emptyColor ?? "#e5e7eb";
    }
    if (n.ariaLabel) {
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", n.ariaLabel);
    }
    return el;
}
function pieChart(n = {}) {
    const data = normalizePlasticChartData(n.data);
    const {root, width, height} = createPlasticChartFrame({...n, type: "pie"});
    const chartSize = Math.min(width, height) - 58;
    const pieNode = pie({
        data,
        size: chartSize,
        ariaLabel: n.ariaLabel || n.title || "Pie chart",
        fallbackColor: "#9ca3af"
    });
    pieNode.classList.add("plastic-chart-pie-graphic");
    pieNode.title = data.map(getPlasticChartItemTitle).join("\n");
    root.append(pieNode);
    const legend = document.createElement("div");
    legend.className = "plastic-chart-legend";
    data.slice(0, 6).forEach((item) => {
        const entry = document.createElement("div");
        entry.className = "plastic-chart-legend-item";
        entry.title = getPlasticChartItemTitle(item);
        entry.innerHTML = `<span style="background:${item.color}"></span>${escapeHtml(item.label)}${n.labelValues ? ` <strong>${escapeHtml(formatPlasticChartValue(item.value))}</strong>` : ""}`;
        legend.append(entry);
    });
    root.append(legend);
    return root;
}
function chart(n = {}) {
    const type = String(n.type || "bar").toLowerCase();
    if (type === "line") return lineChart(n);
    if (type === "area") return areaChart(n);
    if (type === "scatter") return scatterChart(n);
    if (type === "pie") return pieChart(n);
    return barChart(n);
}
function renderChart(target, n = {}) {
    if (!target) return null;
    target.innerHTML = "";
    const node = chart(n);
    target.append(node);
    return node;
}
window.StandardPlastic = window.StandardPlastic || {};
window.StandardPlastic.showInlineStyleEditor = showInlineStyleEditor;
window.StandardPlastic.removeInlineStyleEditor = removeInlineStyleEditor;
window.StandardPlastic.normalizeChartData = normalizePlasticChartData;
window.StandardPlastic.barChart = barChart;
window.StandardPlastic.lineChart = lineChart;
window.StandardPlastic.areaChart = areaChart;
window.StandardPlastic.scatterChart = scatterChart;
window.StandardPlastic.pieChart = pieChart;
window.StandardPlastic.chart = chart;
window.StandardPlastic.renderChart = renderChart;
