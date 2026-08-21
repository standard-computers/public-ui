(() => {

    const SERVICE_ID = "com.standard.editor.code";
    const SUI_FILE_PATTERN = /\.sui$/i;
    const STD_FILE_PATTERN = /\.std$/i;
    const SUI_CLICK_DELAY_MS = 250;
    const SUI_TYPE_DELAY_MS = 24;
    const CODE_EDITOR_MOON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/></svg>`;
    const CODE_EDITOR_SUN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"/></svg>`;

    const CODE_EDITOR_SETTINGS = {
        dark_mode: {label: "Dark mode", type: "boolean", default: false},
        minimap: {label: "Minimap", type: "boolean", default: true},
        comment_color: {label: "Comment color", type: "string", default: "#6b7280"},
        string_color: {label: "String color", type: "string", default: "#0f9d58"},
        number_color: {label: "Number color", type: "string", default: "#d97706"},
        keyword_color: {label: "Keyword color", type: "string", default: "#2563eb"},
        builtin_color: {label: "Built-in color", type: "string", default: "#7c3aed"},
        type_color: {label: "Type and title color", type: "string", default: "#c2410c"},
        call_color: {label: "Function call color", type: "string", default: "#0f766e"},
        operator_color: {label: "Operator and punctuation color", type: "string", default: "#475569"},
        tag_color: {label: "Tag color", type: "string", default: "#be123c"},
        dark_comment_color: {label: "Dark comment color", type: "string", default: "#94a3b8"},
        dark_string_color: {label: "Dark string color", type: "string", default: "#86efac"},
        dark_number_color: {label: "Dark number color", type: "string", default: "#fbbf24"},
        dark_keyword_color: {label: "Dark keyword color", type: "string", default: "#93c5fd"},
        dark_builtin_color: {label: "Dark built-in color", type: "string", default: "#c4b5fd"},
        dark_type_color: {label: "Dark type and title color", type: "string", default: "#fdba74"},
        dark_call_color: {label: "Dark function call color", type: "string", default: "#5eead4"},
        dark_operator_color: {label: "Dark operator and punctuation color", type: "string", default: "#cbd5e1"},
        dark_tag_color: {label: "Dark tag color", type: "string", default: "#fda4af"}
    };

    const CODE_EDITOR_COLOR_PROPERTIES = {
        comment_color: "--editor-code-comment-light",
        string_color: "--editor-code-string-light",
        number_color: "--editor-code-number-light",
        keyword_color: "--editor-code-keyword-light",
        builtin_color: "--editor-code-builtin-light",
        type_color: "--editor-code-type-light",
        call_color: "--editor-code-call-light",
        operator_color: "--editor-code-operator-light",
        tag_color: "--editor-code-tag-light",
        dark_comment_color: "--editor-code-comment-dark",
        dark_string_color: "--editor-code-string-dark",
        dark_number_color: "--editor-code-number-dark",
        dark_keyword_color: "--editor-code-keyword-dark",
        dark_builtin_color: "--editor-code-builtin-dark",
        dark_type_color: "--editor-code-type-dark",
        dark_call_color: "--editor-code-call-dark",
        dark_operator_color: "--editor-code-operator-dark",
        dark_tag_color: "--editor-code-tag-dark"
    };

    const CODE_EDITOR_KEYWORDS = new Set([
        "abstract", "alias", "and", "as", "asm", "assert", "async", "await", "auto", "base", "begin", "bool", "boolean", "break", "by", "byte", "case", "catch", "char", "checked", "class", "const",
        "constructor", "continue", "crate", "data", "debugger", "declare", "def", "default", "defer", "delete", "del", "do", "double", "dynamic", "echo", "elif", "else", "elseif", "end", "ensure",
        "enum", "event", "except", "export", "extends", "extern", "false", "final", "finally", "fixed", "fn", "for", "foreach", "from", "func", "function", "fun", "global", "goto", "if", "impl",
        "implements", "import", "in", "include", "inline", "instanceof", "interface", "internal", "is", "lambda", "let", "library", "loop", "match", "module", "mut", "namespace", "native", "new",
        "nil", "not", "null", "object", "operator", "or", "out", "override", "package", "params", "partial", "pass", "private", "protected", "protocol", "pub", "public", "raise", "readonly",
        "record", "redo", "ref", "register", "repeat", "require", "rescue", "return", "sealed", "select", "self", "short", "signed", "sizeof", "static", "string", "struct", "sub", "super", "switch",
        "template", "then", "this", "throw", "throws", "trait", "transient", "true", "try", "type", "typedef", "typeof", "unchecked", "union", "unless", "unsafe", "unsigned", "until", "use",
        "using", "val", "var", "virtual", "void", "volatile", "when", "where", "while", "with", "yield"
    ]);

    const CODE_EDITOR_BUILTINS = new Set([
        "array", "bigint", "binary", "bool", "boolean", "buffer", "byte", "date", "datetime", "decimal", "dict", "document", "element", "error", "exception", "false", "float", "int", "integer", "json",
        "list", "map", "nan", "none", "null", "number", "object", "promise", "regex", "regexp", "result", "self", "set", "some", "string", "symbol", "table", "this", "true", "undefined", "vec", "void", "window"
    ]);

    const CODE_EDITOR_LINE_COMMENT_STARTS = ["//", "#", "--", ";", "%"];

    const CODE_EDITOR_BLOCK_COMMENTS = [
        {start: "/*", end: "*/"},
        {start: "<!--", end: "-->"},
        {start: "{-", end: "-}"},
        {start: "=begin", end: "=end"}
    ];

    const CODE_EDITOR_LINE_COMMENT_BY_EXTENSION = {
        ahk: ";", bat: "rem", c: "//", cc: "//", cjs: "//", cmd: "rem", conf: "#", cpp: "//", cs: "//", css: "/*", cxx: "//", dart: "//", dockerfile: "#",
        env: "#", gitignore: "#", go: "//", h: "//", hpp: "//", hs: "--", html: "<!--", ini: ";", java: "//", js: "//", json: "//", jsx: "//", kt: "//",
        less: "//", lua: "--", mjs: "//", md: "<!--", php: "//", pl: "#", ps1: "#", py: "#", rb: "#", rs: "//", sass: "//", scala: "//", scss: "//",
        sh: "#", sql: "--", swift: "//", toml: "#", ts: "//", tsx: "//", vue: "//", xml: "<!--", yaml: "#", yml: "#"
    };

    const CODE_EDITOR_LINE_COMMENT_END_BY_EXTENSION = {css: "*/", html: "-->", md: "-->", xml: "-->"};

    const CODE_EDITOR_NAME_KEYWORDS = new Set(["class", "def", "fn", "func", "function", "interface", "module", "namespace", "struct", "trait", "type"]);

    const normalizeCodeFilePath = (rawPath = "") => String(rawPath || "").replace(/^\/home\/standard-system\//, "").replace(/^\/+/, "");
    const getCodeFileName = (rawPath = "") => String(rawPath || "").split("/").pop() || "code.js";

    const getCodeEditorLineCommentSyntax = (rawPath = "") => {
        const fileName = getCodeFileName(rawPath).toLowerCase();
        const extension = fileName.includes(".") ? fileName.split(".").pop() : fileName;
        return {
            start: CODE_EDITOR_LINE_COMMENT_BY_EXTENSION[extension] || "//",
            end: CODE_EDITOR_LINE_COMMENT_END_BY_EXTENSION[extension] || ""
        };
    };

    const sanitizeNewCodeFileName = (rawName = "") => {
        const trimmedName = String(rawName || "").trim().replace(/\\/g, "/");
        const baseName = trimmedName.split("/").pop() || "";
        return baseName.replace(/^\.+/, "");
    };

    const escapeCodeMarkup = (value = "") => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

    const wrapCodeToken = (type = "", value = "") => {
        const safeValue = escapeCodeMarkup(value);
        if (!safeValue) return "";
        return type ? `<span class="editor-code-token editor-code-token-${type}">${safeValue}</span>` : safeValue;
    };

    const isIdentifierStart = (char = "") => /[A-Za-z_$@]/.test(char);
    const isIdentifierPart = (char = "") => /[A-Za-z0-9_$@:-]/.test(char);
    const isNumberStart = (char = "", nextChar = "") => /\d/.test(char) || (char === "." && /\d/.test(nextChar));

    const isEscaped = (content = "", index = 0) => {
        let slashCount = 0;
        for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor -= 1) slashCount += 1;
        return (slashCount % 2) === 1;
    };

    const detectCodeEditorLanguage = (path = "", content = "") => {
        const extension = getCodeFileName(path).split(".").pop()?.toLowerCase?.() || "";
        if (["html", "htm", "xml", "svg"].includes(extension)) return "markup";
        if (["css", "scss", "sass", "less"].includes(extension)) return "style";
        if (["json", "yaml", "yml", "toml", "ini"].includes(extension)) return "data";
        if (["md", "markdown", "txt", "rst"].includes(extension)) return "text";
        const trimmedContent = String(content || "").trim();
        if (!trimmedContent) return "code";
        if (/^<!DOCTYPE html>|^<html[\s>]|^<\?xml/i.test(trimmedContent)) return "markup";
        if (/^\s*[{[]/.test(trimmedContent) && /"\s*:/.test(trimmedContent)) return "data";
        return "code";
    };

    const tryReadBlockComment = (content = "", index = 0) => {
        for (const blockComment of CODE_EDITOR_BLOCK_COMMENTS) {
            if (!content.startsWith(blockComment.start, index)) continue;
            const endIndex = content.indexOf(blockComment.end, index + blockComment.start.length);
            const tokenEnd = endIndex >= 0 ? endIndex + blockComment.end.length : content.length;
            return {type: "comment", value: content.slice(index, tokenEnd), end: tokenEnd};
        }
        return null;
    };

    const isLikelyLineComment = (content = "", index = 0, start = "") => {
        if (!content.startsWith(start, index)) return false;
        if (start === "#") {
            const previousChar = content[index - 1] || "";
            return !previousChar || /\s|[({[;,]/.test(previousChar);
        }
        if (start === ";") {
            const previousSlice = content.slice(Math.max(0, index - 12), index);
            return /^\s*$/.test(previousSlice) || /[\r\n]\s*$/.test(previousSlice);
        }
        return true;
    };

    const tryReadLineComment = (content = "", index = 0) => {
        for (const start of CODE_EDITOR_LINE_COMMENT_STARTS) {
            if (!isLikelyLineComment(content, index, start)) continue;
            let end = content.indexOf("\n", index);
            if (end < 0) end = content.length;
            return {type: "comment", value: content.slice(index, end), end};
        }
        return null;
    };

    const tryReadStringToken = (content = "", index = 0) => {
        const quote = content[index];
        if (!["\"", "'", "`"].includes(quote)) return null;
        const tripleQuote = content.slice(index, index + 3);
        const hasTriple = (quote === "\"" || quote === "'") && tripleQuote === quote.repeat(3);
        let cursor = index + (hasTriple ? 3 : 1);
        while (cursor < content.length) {
            if (hasTriple) {
                if (content.slice(cursor, cursor + 3) === quote.repeat(3)) {
                    cursor += 3;
                    break;
                }
                cursor += 1;
                continue;
            }
            if (content[cursor] === quote && !isEscaped(content, cursor)) {
                cursor += 1;
                break;
            }
            cursor += 1;
        }
        return {type: "string", value: content.slice(index, cursor), end: cursor};
    };

    const tryReadNumberToken = (content = "", index = 0) => {
        const firstChar = content[index] || "";
        const nextChar = content[index + 1] || "";
        if (!isNumberStart(firstChar, nextChar)) return null;
        const numberMatch = content.slice(index).match(/^(?:0x[\da-f]+|0b[01]+|0o[0-7]+|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)/i);
        if (!numberMatch) return null;
        return {type: "number", value: numberMatch[0], end: index + numberMatch[0].length};
    };

    const tryReadMarkupToken = (content = "", index = 0) => {
        if (content[index] !== "<") return null;
        const tagMatch = content.slice(index).match(/^<\/?[A-Za-z][\w:-]*(?:\s+[^<>]*?)?\s*\/?>/);
        const declarationMatch = content.slice(index).match(/^<![A-Z][^>]*>/i);
        const processingMatch = content.slice(index).match(/^<\?[\s\S]*?\?>/);
        const matchedValue = tagMatch?.[0] || declarationMatch?.[0] || processingMatch?.[0] || "";
        if (!matchedValue) return null;
        return {type: "tag", value: matchedValue, end: index + matchedValue.length};
    };

    const classifyIdentifierToken = (value = "", previousSignificantType = "", previousSignificantValue = "", nextSignificantChar = "") => {
        const normalizedValue = value.toLowerCase();
        if (CODE_EDITOR_KEYWORDS.has(normalizedValue)) return "keyword";
        if (CODE_EDITOR_BUILTINS.has(normalizedValue)) return "builtin";
        if (previousSignificantType === "keyword" && CODE_EDITOR_NAME_KEYWORDS.has(previousSignificantValue.toLowerCase())) return "title";
        if (nextSignificantChar === "(") return "call";
        if (/^[A-Z][A-Za-z0-9_$]*$/.test(value)) return "type";
        return "";
    };

    const tokenizeCodeContent = (content = "", options = {}) => {
        const language = detectCodeEditorLanguage(options.path, content);
        const tokens = [];
        let index = 0;
        let previousSignificantType = "";
        let previousSignificantValue = "";
        while (index < content.length) {
            const currentChar = content[index];
            const whitespaceMatch = content.slice(index).match(/^\s+/);
            if (whitespaceMatch) {
                tokens.push({type: "", value: whitespaceMatch[0]});
                index += whitespaceMatch[0].length;
                continue;
            }
            const blockComment = tryReadBlockComment(content, index);
            if (blockComment) {
                tokens.push(blockComment);
                index = blockComment.end;
                previousSignificantType = blockComment.type;
                previousSignificantValue = blockComment.value;
                continue;
            }
            if (language === "markup") {
                const markupToken = tryReadMarkupToken(content, index);
                if (markupToken) {
                    tokens.push(markupToken);
                    index = markupToken.end;
                    previousSignificantType = markupToken.type;
                    previousSignificantValue = markupToken.value;
                    continue;
                }
            }
            const lineComment = tryReadLineComment(content, index);
            if (lineComment) {
                tokens.push(lineComment);
                index = lineComment.end;
                previousSignificantType = lineComment.type;
                previousSignificantValue = lineComment.value;
                continue;
            }
            const stringToken = tryReadStringToken(content, index);
            if (stringToken) {
                tokens.push(stringToken);
                index = stringToken.end;
                previousSignificantType = stringToken.type;
                previousSignificantValue = stringToken.value;
                continue;
            }
            const numberToken = tryReadNumberToken(content, index);
            if (numberToken) {
                tokens.push(numberToken);
                index = numberToken.end;
                previousSignificantType = numberToken.type;
                previousSignificantValue = numberToken.value;
                continue;
            }
            if (isIdentifierStart(currentChar)) {
                let end = index + 1;
                while (end < content.length && isIdentifierPart(content[end])) end += 1;
                const value = content.slice(index, end);
                let lookAheadIndex = end;
                while (lookAheadIndex < content.length && /\s/.test(content[lookAheadIndex])) lookAheadIndex += 1;
                const tokenType = classifyIdentifierToken(value, previousSignificantType, previousSignificantValue, content[lookAheadIndex] || "");
                tokens.push({type: tokenType, value});
                index = end;
                previousSignificantType = tokenType || "identifier";
                previousSignificantValue = value;
                continue;
            }
            const operatorMatch = content.slice(index).match(/^(?:=>|->|::|===|!==|==|!=|<=|>=|\+\+|--|\+=|-=|\*=|\/=|&&|\|\||<<|>>|>>>|\?\?|\.\.\.|[=+\-*/%<>!&|^~?:.,])/);
            if (operatorMatch) {
                tokens.push({type: "operator", value: operatorMatch[0]});
                index += operatorMatch[0].length;
                previousSignificantType = "operator";
                previousSignificantValue = operatorMatch[0];
                continue;
            }
            if (/^[()[\]{}]$/.test(currentChar)) {
                tokens.push({type: "punctuation", value: currentChar});
                index += 1;
                previousSignificantType = "punctuation";
                previousSignificantValue = currentChar;
                continue;
            }
            tokens.push({type: "", value: currentChar});
            index += 1;
        }
        return tokens;
    };

    const renderCodeEditorHighlighting = (content = "", options = {}) => {
        const tokens = tokenizeCodeContent(content, options);
        const markup = tokens.map(token => wrapCodeToken(token.type, token.value)).join("");
        return markup || "&nbsp;";
    };

    const getPortalCodeState = (portal) => {
        const state = portal?.windowState?.() || {};
        return {
            directive: normalizeCodeFilePath(state?.directive || ""),
            cachedContent: typeof state?.cachedContent === "string" ? state.cachedContent : ""
        };
    };

    const getPortalRememberedCodePath = (portal) => {
        const statePath = getPortalCodeState(portal).directive;
        if (statePath) return statePath;
        const windowNode = portal?.window?.();
        const textareaNode = getPortalCodeEditorInput(portal);
        return normalizeCodeFilePath(windowNode?.dataset?.codeFilePath || textareaNode?.dataset?.codeFilePath || "");
    };

    const syncPortalRememberedCodePath = (portal, rawPath = "") => {
        const normalizedPath = normalizeCodeFilePath(rawPath);
        const windowNode = portal?.window?.();
        const textareaNode = getPortalCodeEditorInput(portal);
        if (windowNode) windowNode.dataset.codeFilePath = normalizedPath;
        if (textareaNode) textareaNode.dataset.codeFilePath = normalizedPath;
        syncCodeEditorRunTool(portal);
        return normalizedPath;
    };

    const setPortalCodeState = (portal, nextState = {}, options = {}) => {
        if (!portal || typeof portal.setWindowState !== "function") return getPortalCodeState(portal);
        portal.setWindowState(nextState, options);
        if (Object.prototype.hasOwnProperty.call(nextState || {}, "directive")) syncPortalRememberedCodePath(portal, nextState?.directive || "");
        return getPortalCodeState(portal);
    };

    const getPortalCodeEditorInput = (portal) => portal?.window?.()?.querySelector?.("#editor-code-content") || null;
    const getPortalCodeLineNumbers = (portal) => portal?.window?.()?.querySelector?.("#editor-code-lines") || null;
    const getPortalCodeHighlight = (portal) => portal?.window?.()?.querySelector?.("#editor-code-highlight") || null;
    const getPortalCodeStage = (portal) => portal?.window?.()?.querySelector?.("#editor-code-stage") || null;
    const getPortalCodeMinimap = (portal) => portal?.window?.()?.querySelector?.("#editor-code-minimap") || null;
    const getPortalCodeMinimapContent = (portal) => portal?.window?.()?.querySelector?.("#editor-code-minimap-content") || null;
    const getPortalCodeMinimapViewport = (portal) => portal?.window?.()?.querySelector?.("#editor-code-minimap-viewport") || null;

    const setCodeEditorThemeToolIcon = (tool, darkMode) => {
        if (!tool) return;
        const title = darkMode ? "Light mode" : "Dark mode";
        const iconMarkup = darkMode ? CODE_EDITOR_SUN_ICON : CODE_EDITOR_MOON_ICON;
        const icon = new DOMParser().parseFromString(iconMarkup, "image/svg+xml").documentElement;
        tool.replaceChildren(icon);
        tool.title = title;
        tool.setAttribute("aria-label", title);
        tool.dataset.portalToolTitle = title.toLowerCase();
    };

    const applyCodeEditorDarkMode = (darkMode) => {
        const enabled = darkMode === true;
        document.querySelectorAll(".editor-code-shell").forEach(shell => {
            shell.classList.toggle("editor-code-dark", enabled);
            const editorWindow = shell.closest(".draggable-window");
            editorWindow?.querySelectorAll?.('[data-portal-tool-title="dark mode"], [data-portal-tool-title="light mode"]').forEach(tool => {
                setCodeEditorThemeToolIcon(tool, enabled);
            });
        });
    };

    const applyCodeEditorMinimap = (minimap) => {
        const enabled = minimap !== false;
        document.querySelectorAll(".editor-code-shell").forEach(shell => {
            shell.classList.toggle("editor-code-minimap-disabled", !enabled);
            const minimapNode = shell.querySelector(".editor-code-minimap");
            if (minimapNode) {
                const wasHidden = minimapNode.hidden;
                minimapNode.hidden = !enabled;
                if (enabled && wasHidden) shell.querySelector(".editor-code-input")?.dispatchEvent(new Event("scroll"));
            }
        });
    };

    const applyCodeEditorColors = (settings = {}) => {
        document.querySelectorAll(".editor-code-shell").forEach(shell => {
            Object.entries(CODE_EDITOR_COLOR_PROPERTIES).forEach(([settingName, propertyName]) => {
                const value = String(settings?.[settingName] ?? CODE_EDITOR_SETTINGS[settingName]?.default ?? "").trim();
                if (value) shell.style.setProperty(propertyName, value);
                else shell.style.removeProperty(propertyName);
            });
        });
    };

    const loadCodeEditorSettings = async () => {
        const settings = await window.StandardAppSettings?.values?.(SERVICE_ID);
        const darkMode = settings?.dark_mode === true;
        const minimap = settings?.minimap !== false;
        applyCodeEditorDarkMode(darkMode);
        applyCodeEditorMinimap(minimap);
        applyCodeEditorColors(settings);
        return {darkMode, minimap, colors: settings};
    };

    const syncSavedCodeEditorSettings = (event) => {
        if (event?.detail?.serviceId !== SERVICE_ID) return;
        applyCodeEditorDarkMode(event.detail?.values?.dark_mode === true);
        applyCodeEditorMinimap(event.detail?.values?.minimap !== false);
        applyCodeEditorColors(event.detail?.values || {});
    };

    document.addEventListener("standard-app-settings-saved", syncSavedCodeEditorSettings);
    document.addEventListener("standard-app-settings-reset", syncSavedCodeEditorSettings);

    const toggleCodeEditorDarkMode = async (_event, context) => {
        const settingsApi = context?.settings;
        const currentSettings = await settingsApi?.values?.() || await window.StandardAppSettings?.values?.(SERVICE_ID) || {};
        const darkMode = currentSettings.dark_mode !== true;
        applyCodeEditorDarkMode(darkMode);
        const saved = await (settingsApi?.save?.({...currentSettings, dark_mode: darkMode})
            || window.StandardAppSettings?.save?.(SERVICE_ID, {...currentSettings, dark_mode: darkMode}));
        if (!saved) modular.error("Unable to save code editor theme");
    };

    const isDeveloperModeEnabled = () => window.StandardUI?.currentTheme?.developer_mode === true;

    const shouldShowCodeEditorRunTool = (rawPath = "") => SUI_FILE_PATTERN.test(rawPath)
        || (isDeveloperModeEnabled() && STD_FILE_PATTERN.test(rawPath));

    const syncCodeEditorRunTool = (portal) => {
        const runTool = portal?.window?.()?.querySelector?.('[data-portal-tool-title="run"]');
        if (runTool) runTool.hidden = !shouldShowCodeEditorRunTool(getPortalRememberedCodePath(portal));
    };

    const syncAllCodeEditorRunTools = () => {
        document.querySelectorAll(".editor-code-shell").forEach(shell => {
            const editorWindow = shell.closest(".draggable-window");
            const runTool = editorWindow?.querySelector?.('[data-portal-tool-title="run"]');
            const editorInput = shell.querySelector(".editor-code-input");
            const path = normalizeCodeFilePath(editorWindow?.dataset?.codeFilePath || editorInput?.dataset?.codeFilePath || "");
            if (runTool) runTool.hidden = !shouldShowCodeEditorRunTool(path);
        });
    };

    document.addEventListener("standard-developer-mode-changed", syncAllCodeEditorRunTools);

    const isCodeEditorGoToLineShortcut = (event) => event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key?.toLowerCase?.() === "g";

    const focusCodeEditorAtEnd = (portal) => {
        const focusEditor = () => {
            const codeEditorInput = getPortalCodeEditorInput(portal);
            if (!codeEditorInput) return;
            const contentEnd = codeEditorInput.value.length;
            codeEditorInput.focus();
            codeEditorInput.setSelectionRange(contentEnd, contentEnd);
            codeEditorInput.scrollTop = codeEditorInput.scrollHeight;
            syncCodeEditorPresentation(portal);
        };
        requestAnimationFrame(() => requestAnimationFrame(focusEditor));
    };

    const syncCodeEditorPresentation = (portal) => {
        const codeEditorInput = getPortalCodeEditorInput(portal);
        const codeHighlight = getPortalCodeHighlight(portal);
        const lineNumberContainer = getPortalCodeLineNumbers(portal);
        const codeStage = getPortalCodeStage(portal);
        if (!codeEditorInput || !codeHighlight || !lineNumberContainer || !codeStage) return;
        const content = codeEditorInput.value || "";
        const directive = getPortalRememberedCodePath(portal);
        codeHighlight.innerHTML = renderCodeEditorHighlighting(content, {path: directive});
        codeHighlight.scrollTop = codeEditorInput.scrollTop;
        codeHighlight.scrollLeft = codeEditorInput.scrollLeft;
        lineNumberContainer.scrollTop = codeEditorInput.scrollTop;
        codeStage.dataset.empty = content ? "0" : "1";
        syncCodeEditorMinimap(portal, content, directive);
    };

    const syncCodeEditorMinimapViewport = (portal) => {
        const codeEditorInput = getPortalCodeEditorInput(portal);
        const minimap = getPortalCodeMinimap(portal);
        const viewport = getPortalCodeMinimapViewport(portal);
        if (!codeEditorInput || !minimap || !viewport || minimap.hidden) return;
        const trackHeight = Math.max(0, minimap.clientHeight - 2);
        const scrollHeight = Math.max(codeEditorInput.scrollHeight, codeEditorInput.clientHeight, 1);
        const viewportHeight = Math.max(18, Math.min(trackHeight, trackHeight * (codeEditorInput.clientHeight / scrollHeight)));
        const maxScrollTop = Math.max(0, scrollHeight - codeEditorInput.clientHeight);
        const top = maxScrollTop ? (codeEditorInput.scrollTop / maxScrollTop) * (trackHeight - viewportHeight) : 0;
        viewport.style.height = `${viewportHeight}px`;
        viewport.style.transform = `translateY(${top}px)`;
    };

    const syncCodeEditorMinimap = (portal, content = "", directive = "") => {
        const minimap = getPortalCodeMinimap(portal);
        const minimapContent = getPortalCodeMinimapContent(portal);
        if (!minimap || !minimapContent || minimap.hidden) return;
        minimapContent.innerHTML = renderCodeEditorHighlighting(content, {path: directive});
        minimapContent.style.transform = "none";
        const availableHeight = Math.max(1, minimap.clientHeight - 12);
        const contentHeight = Math.max(1, minimapContent.scrollHeight);
        const scale = Math.min(1, availableHeight / contentHeight);
        minimapContent.style.transform = `scaleY(${scale})`;
        syncCodeEditorMinimapViewport(portal);
    };

    const scrollCodeEditorFromMinimap = (portal, clientY = 0) => {
        const codeEditorInput = getPortalCodeEditorInput(portal);
        const minimap = getPortalCodeMinimap(portal);
        if (!codeEditorInput || !minimap) return;
        const bounds = minimap.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientY - bounds.top) / Math.max(1, bounds.height)));
        codeEditorInput.scrollTop = (ratio * codeEditorInput.scrollHeight) - (codeEditorInput.clientHeight / 2);
        syncCodeEditorPresentation(portal);
    };

    const hydrateCodeEditorFromState = (portal) => {
        const codeEditorInput = getPortalCodeEditorInput(portal);
        if (!codeEditorInput) return;
        const {directive, cachedContent} = getPortalCodeState(portal);
        if (codeEditorInput.value !== cachedContent) codeEditorInput.value = cachedContent;
        syncPortalRememberedCodePath(portal, directive);
        refreshCodeEditorLineNumbers(portal);
        syncCodeEditorPresentation(portal);
    };

    const updateCodeEditorPortalTitle = (portal) => {
        if (!portal?.setTitle) return;
        const directive = getPortalRememberedCodePath(portal);
        portal.setTitle(directive ? getCodeFileName(directive) : "Code");
    };

    const getCodeEditorLineCount = (content = "") => Math.max(1, String(content).split("\n").length);

    const refreshCodeEditorLineNumbers = (portal) => {
        const lineNumberContainer = getPortalCodeLineNumbers(portal);
        const codeEditorInput = getPortalCodeEditorInput(portal);
        if (!lineNumberContainer || !codeEditorInput) return;
        const lineCount = getCodeEditorLineCount(codeEditorInput.value);
        const lineMarkup = [];
        for (let lineIndex = 1; lineIndex <= lineCount; lineIndex += 1) {
            lineMarkup.push(div({style: "editor-code-line-number", content: String(lineIndex)}));
        }
        lineNumberContainer.innerHTML = children(lineMarkup);
        lineNumberContainer.scrollTop = codeEditorInput.scrollTop;
    };

    const insertCodeEditorText = (textArea = null, text = "", offset = 0) => {
        if (!textArea) return;
        const selectionStart = textArea.selectionStart;
        const selectionEnd = textArea.selectionEnd;
        textArea.setRangeText(text, selectionStart, selectionEnd, "end");
        const cursorPosition = selectionStart + offset;
        textArea.selectionStart = cursorPosition;
        textArea.selectionEnd = cursorPosition;
    };

    const getCodeEditorIndentUnit = () => "    ";

    const getCodeEditorNewlineEdit = (value = "", selectionStart = 0, selectionEnd = selectionStart, rawPath = "") => {
        const content = String(value ?? "");
        const start = Math.max(0, Math.min(Number(selectionStart) || 0, content.length));
        const end = Math.max(start, Math.min(Number(selectionEnd) || start, content.length));
        const lineStart = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
        const lineBeforeCaret = content.slice(lineStart, start);
        const baseIndent = lineBeforeCaret.match(/^[\t ]*/)?.[0] || "";
        const trimmedBeforeCaret = lineBeforeCaret.trimEnd();
        const nextCharacter = content[end] || "";
        const previousCharacter = content[start - 1] || "";
        const bracketPairs = {"{": "}", "[": "]", "(": ")", "<": ">"};
        const isPairedBracketBoundary = bracketPairs[previousCharacter] === nextCharacter;
        const extension = getCodeFileName(rawPath).split(".").pop()?.toLowerCase?.() || "";
        const colonIndentExtensions = new Set(["coffee", "ex", "exs", "nim", "py", "rb", "sass", "sui", "yaml", "yml"]);
        const endsWithOpeningBracket = /[{[(]$/.test(trimmedBeforeCaret);
        const endsWithIndentingColon = colonIndentExtensions.has(extension) && /:$/.test(trimmedBeforeCaret);
        const endsWithOpeningTag = /<[A-Za-z][\w:-]*(?:\s+[^<>]*?)?>$/.test(trimmedBeforeCaret) && !/\/>$/.test(trimmedBeforeCaret);
        const isBeforeClosingTag = endsWithOpeningTag && /^\s*<\//.test(content.slice(end));
        const shouldIncreaseIndent = endsWithOpeningBracket || endsWithIndentingColon || endsWithOpeningTag || isPairedBracketBoundary;
        const nextIndent = `${baseIndent}${shouldIncreaseIndent ? getCodeEditorIndentUnit() : ""}`;
        if (isPairedBracketBoundary || isBeforeClosingTag) {
            const text = `\n${nextIndent}\n${baseIndent}`;
            return {text, offset: 1 + nextIndent.length};
        }
        const text = `\n${nextIndent}`;
        return {text, offset: text.length};
    };

    const getDuplicateLineDownEdit = (value = "", selectionStart = 0, selectionEnd = selectionStart) => {
        const content = String(value ?? "");
        const start = Math.max(0, Math.min(Number(selectionStart) || 0, content.length));
        const end = Math.max(start, Math.min(Number(selectionEnd) || start, content.length));
        const effectiveEnd = end > start && content[end - 1] === "\n" ? end - 1 : end;
        const lineStart = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
        const lineEndIndex = content.indexOf("\n", effectiveEnd);
        const lineEnd = lineEndIndex >= 0 ? lineEndIndex : content.length;
        const duplicatedText = content.slice(lineStart, lineEnd);
        const insertion = `\n${duplicatedText}`;
        const duplicateStart = lineEnd + 1;
        const duplicateEnd = duplicateStart + duplicatedText.length;
        const nextValue = `${content.slice(0, lineEnd)}${insertion}${content.slice(lineEnd)}`;
        if (start !== end) return {value: nextValue, selectionStart: duplicateStart, selectionEnd: duplicateEnd};
        const caretColumn = start - lineStart;
        return {
            value: nextValue,
            selectionStart: duplicateStart + Math.min(caretColumn, duplicatedText.length),
            selectionEnd: duplicateStart + Math.min(caretColumn, duplicatedText.length)
        };
    };

    const duplicateCodeEditorLineDown = (textArea = null) => {
        if (!textArea) return false;
        const edit = getDuplicateLineDownEdit(textArea.value, textArea.selectionStart, textArea.selectionEnd);
        textArea.value = edit.value;
        textArea.selectionStart = edit.selectionStart;
        textArea.selectionEnd = edit.selectionEnd;
        return true;
    };

    const toggleCodeEditorLineComment = (textArea = null, commentSyntax = {}) => {
        if (!textArea) return false;
        const commentToken = String(commentSyntax?.start || "//");
        const commentEndToken = String(commentSyntax?.end || "");
        const escapedCommentToken = commentToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const escapedCommentEndToken = commentEndToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const commentPattern = new RegExp(`^(\\s*)${escapedCommentToken} ?(.*?)${commentEndToken ? ` ?${escapedCommentEndToken}` : ""}$`);
        const content = textArea.value || "";
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        const lineStart = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
        const effectiveEnd = end > start && content[end - 1] === "\n" ? end - 1 : end;
        const lineEndIndex = content.indexOf("\n", effectiveEnd);
        const lineEnd = lineEndIndex >= 0 ? lineEndIndex : content.length;
        const selectedLines = content.slice(lineStart, lineEnd).split("\n");
        const shouldUncomment = selectedLines.some(line => line.trim()) && selectedLines.filter(line => line.trim()).every(line => commentPattern.test(line));
        const nextLines = selectedLines.map(line => {
            if (!line.trim()) return line;
            return shouldUncomment ? line.replace(commentPattern, "$1$2") : line.replace(/^(\s*)/, `$1${commentToken} `) + (commentEndToken ? ` ${commentEndToken}` : "");
        });
        const nextText = nextLines.join("\n");
        textArea.value = `${content.slice(0, lineStart)}${nextText}${content.slice(lineEnd)}`;
        const selectionOffset = shouldUncomment ? -(commentToken.length + 1) : commentToken.length + 1;
        textArea.selectionStart = Math.max(lineStart, start + selectionOffset);
        textArea.selectionEnd = Math.max(textArea.selectionStart, end + (nextText.length - (lineEnd - lineStart)));
        return true;
    };

    const getCodeEditorLineFromOffset = (content = "", offset = 0) => String(content ?? "").slice(0, Math.max(0, offset)).split("\n").length;

    const getCodeEditorOffsetForLine = (content = "", lineNumber = 1) => {
        const targetLine = Math.max(1, Number.parseInt(lineNumber, 10) || 1);
        let offset = 0;
        for (let line = 1; line < targetLine; line += 1) {
            const nextLineIndex = content.indexOf("\n", offset);
            if (nextLineIndex < 0) return content.length;
            offset = nextLineIndex + 1;
        }
        return offset;
    };

    const goToCodeEditorLine = (portal, rawLineNumber = "") => {
        const codeEditorInput = getPortalCodeEditorInput(portal);
        if (!codeEditorInput) return false;
        const lineCount = getCodeEditorLineCount(codeEditorInput.value);
        const lineNumber = Number.parseInt(rawLineNumber, 10);
        if (!Number.isFinite(lineNumber) || lineNumber < 1) {
            modular.error("Enter a valid line number");
            return false;
        }
        const targetLine = Math.min(lineNumber, lineCount);
        const targetOffset = getCodeEditorOffsetForLine(codeEditorInput.value, targetLine);
        codeEditorInput.focus();
        codeEditorInput.setSelectionRange(targetOffset, targetOffset);
        const lineHeight = Number.parseFloat(getComputedStyle(codeEditorInput).lineHeight) || 21;
        codeEditorInput.scrollTop = Math.max(0, ((targetLine - 1) * lineHeight) - (codeEditorInput.clientHeight / 2));
        syncCodeEditorPresentation(portal);
        return true;
    };

    const showCodeEditorGoToLineDialogue = (portal) => {
        const codeEditorInput = getPortalCodeEditorInput(portal);
        if (!codeEditorInput) return false;
        inputDialogue({
            title: "Go to line",
            placeholder: `1-${getCodeEditorLineCount(codeEditorInput.value)}`,
            value: String(getCodeEditorLineFromOffset(codeEditorInput.value, codeEditorInput.selectionStart)),
            confirmation: (_, lineNumber) => goToCodeEditorLine(portal, lineNumber)
        });
        return true;
    };

    const createCodeEditorSearchMatches = (query = "", portal = null) => {
        const codeEditorInput = getPortalCodeEditorInput(portal);
        const content = codeEditorInput?.value || "";
        const needle = String(query || "");
        if (!needle.trim()) return [];
        const haystack = content.toLowerCase();
        const lowerNeedle = needle.toLowerCase();
        const matches = [];
        let index = haystack.indexOf(lowerNeedle);
        while (index >= 0 && matches.length < 50) {
            const lineNumber = getCodeEditorLineFromOffset(content, index);
            const lineStart = content.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
            const lineEndIndex = content.indexOf("\n", index);
            const lineEnd = lineEndIndex >= 0 ? lineEndIndex : content.length;
            matches.push({
                index,
                length: needle.length,
                label: `Line ${lineNumber}`,
                detail: content.slice(lineStart, lineEnd).trim() || `(line ${lineNumber})`
            });
            index = haystack.indexOf(lowerNeedle, index + Math.max(needle.length, 1));
        }
        return matches;
    };

    const scrollToCodeEditorSearchMatch = (match = null, portal = null) => {
        const codeEditorInput = getPortalCodeEditorInput(portal);
        if (!codeEditorInput || !match || !Number.isFinite(match.index)) return false;
        const start = match.index;
        const end = start + (match.length || 0);
        const lineNumber = getCodeEditorLineFromOffset(codeEditorInput.value, start);
        codeEditorInput.focus();
        codeEditorInput.setSelectionRange(start, end);
        const lineHeight = Number.parseFloat(getComputedStyle(codeEditorInput).lineHeight) || 21;
        codeEditorInput.scrollTop = Math.max(0, ((lineNumber - 1) * lineHeight) - (codeEditorInput.clientHeight / 2));
        syncCodeEditorPresentation(portal);
        return true;
    };

    const showCodeEditorSearchDialogue = (portal = null, anchorNode = null) => {
        const codeEditorInput = getPortalCodeEditorInput(portal);
        if (!codeEditorInput) return false;
        const selectedText = codeEditorInput.selectionStart !== codeEditorInput.selectionEnd
            ? codeEditorInput.value.slice(codeEditorInput.selectionStart, codeEditorInput.selectionEnd).trim()
            : "";
        const initialValue = selectedText && !selectedText.includes("\n") ? selectedText : "";
        return window.StandardUI.openSearchDialogue({
            title: "Search",
            placeholder: "Find code",
            value: initialValue,
            confirmText: "Search",
            anchor: anchorNode,
            matches: (query) => createCodeEditorSearchMatches(query, portal),
            onPreview: match => scrollToCodeEditorSearchMatch(match, portal),
            onSelect: match => scrollToCodeEditorSearchMatch(match, portal),
            onNoMatch: () => modular.error("No matches found")
        });
    };

    const bindCodeEditorInteractions = (portal) => {
        const codeEditorInput = getPortalCodeEditorInput(portal);
        if (!codeEditorInput || codeEditorInput.dataset.bound === "1") {
            refreshCodeEditorLineNumbers(portal);
            syncCodeEditorPresentation(portal);
            return;
        }
        codeEditorInput.wrap = "off";
        codeEditorInput.spellcheck = false;
        codeEditorInput.dataset.bound = "1";
        const lineNumberContainer = getPortalCodeLineNumbers(portal);
        if (lineNumberContainer) lineNumberContainer.style.overflow = "hidden";
        const minimap = getPortalCodeMinimap(portal);
        if (minimap && minimap.dataset.bound !== "1") {
            minimap.dataset.bound = "1";
            minimap.addEventListener("pointerdown", (event) => {
                event.preventDefault();
                minimap.setPointerCapture?.(event.pointerId);
                minimap.dataset.dragging = "1";
                scrollCodeEditorFromMinimap(portal, event.clientY);
            });
            minimap.addEventListener("pointermove", (event) => {
                if (minimap.dataset.dragging === "1") scrollCodeEditorFromMinimap(portal, event.clientY);
            });
            const stopDragging = (event) => {
                minimap.dataset.dragging = "0";
                minimap.releasePointerCapture?.(event.pointerId);
            };
            minimap.addEventListener("pointerup", stopDragging);
            minimap.addEventListener("pointercancel", stopDragging);
            if (typeof ResizeObserver === "function") new ResizeObserver(() => syncCodeEditorPresentation(portal)).observe(minimap);
        }
        const windowNode = portal?.window?.();
        if (windowNode && windowNode.dataset.codeGotoLineBound !== "1") {
            windowNode.dataset.codeGotoLineBound = "1";
            document.addEventListener("keydown", (event) => {
                if (event.defaultPrevented || !isCodeEditorGoToLineShortcut(event) || document.querySelector(".dialogue")) return;
                if (!windowNode.classList.contains("window-focused")) return;
                event.preventDefault();
                showCodeEditorGoToLineDialogue(portal);
            });
        }
        const bracketPairs = {"{": "}", "[": "]", "<": ">", "(": ")"};
        const refreshEditorSurface = () => {
            setPortalCodeState(portal, {cachedContent: codeEditorInput.value});
            refreshCodeEditorLineNumbers(portal);
            syncCodeEditorPresentation(portal);
        };
        codeEditorInput.addEventListener("input", refreshEditorSurface);
        codeEditorInput.addEventListener("scroll", () => {
            syncCodeEditorPresentation(portal);
        });
        codeEditorInput.addEventListener("keydown", (event) => {
            if (isCodeEditorGoToLineShortcut(event)) {
                event.preventDefault();
                showCodeEditorGoToLineDialogue(portal);
                return;
            }
            if (event.ctrlKey && !event.altKey && !event.shiftKey && (event.key === "/" || event.code === "Slash")) {
                event.preventDefault();
                toggleCodeEditorLineComment(codeEditorInput, getCodeEditorLineCommentSyntax(getPortalRememberedCodePath(portal)));
                codeEditorInput.dispatchEvent(new Event("input", {bubbles: true}));
                return;
            }
            if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key?.toLowerCase?.() === "d") {
                event.preventDefault();
                duplicateCodeEditorLineDown(codeEditorInput);
                codeEditorInput.dispatchEvent(new Event("input", {bubbles: true}));
                return;
            }
            if (event.key === "Tab") {
                event.preventDefault();
                const indent = getCodeEditorIndentUnit();
                insertCodeEditorText(codeEditorInput, indent, indent.length);
                codeEditorInput.dispatchEvent(new Event("input", {bubbles: true}));
                return;
            }
            if (event.key === "Enter" && !event.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                const newlineEdit = getCodeEditorNewlineEdit(
                    codeEditorInput.value,
                    codeEditorInput.selectionStart,
                    codeEditorInput.selectionEnd,
                    getPortalRememberedCodePath(portal)
                );
                insertCodeEditorText(codeEditorInput, newlineEdit.text, newlineEdit.offset);
                codeEditorInput.dispatchEvent(new Event("input", {bubbles: true}));
                return;
            }
            const closingBracket = bracketPairs[event.key];
            if (!closingBracket) return;
            event.preventDefault();
            const selectionStart = codeEditorInput.selectionStart;
            const selectionEnd = codeEditorInput.selectionEnd;
            if (selectionStart !== selectionEnd) {
                const selectedValue = codeEditorInput.value.slice(selectionStart, selectionEnd);
                insertCodeEditorText(codeEditorInput, `${event.key}${selectedValue}${closingBracket}`, selectedValue.length + 1);
            } else {
                insertCodeEditorText(codeEditorInput, `${event.key}${closingBracket}`, 1);
            }
            codeEditorInput.dispatchEvent(new Event("input", {bubbles: true}));
        });
        refreshCodeEditorLineNumbers(portal);
        syncCodeEditorPresentation(portal);
    };

    const saveCodeEditorContentToPath = async (portal, targetPath = "") => {
        const normalizedPath = normalizeCodeFilePath(targetPath);
        if (!normalizedPath) {
            modular.error("File name is required");
            return false;
        }
        const codeEditorInput = getPortalCodeEditorInput(portal);
        const currentState = getPortalCodeState(portal);
        const nextContent = codeEditorInput?.value ?? currentState.cachedContent;
        const fileName = getCodeFileName(normalizedPath);
        const response = await window.StandardUploads.saveFile(nextContent, normalizedPath, {label: `Saving ${fileName}`});
        if (!response?.ok) {
            modular.error("Unable to save code file");
            return false;
        }
        setPortalCodeState(portal, {directive: normalizedPath, cachedContent: nextContent}, {merge: false});
        syncCodeEditorPresentation(portal);
        updateCodeEditorPortalTitle(portal);
        await window.StandardFilesRefreshCache?.();
        modular.success(`Saved ${normalizedPath} (${response.byteCount} bytes)`);
        return true;
    };

    const saveNewCodeFileToDocuments = (portal) => {
        inputDialogue({title: "File name", placeholder: "code.js", value: "code.js", location_picker: true, confirmation: async (_, inputFileName, location) => {
                if (!modular.validateFileName(inputFileName)) return;
                const safeFileName = sanitizeNewCodeFileName(inputFileName) || "code.js";
                await saveCodeEditorContentToPath(portal, `${location}/${safeFileName}`);
            }
        });
    };

    const saveLoadedCodeFile = async (portal) => {
        const directive = getPortalRememberedCodePath(portal);
        if (!directive) {
            saveNewCodeFileToDocuments(portal);
            return;
        }
        await saveCodeEditorContentToPath(portal, directive);
    };

    const parseSuiServiceInstruction = (instruction = "") => {
        const normalizedInstruction = String(instruction || "").trim();
        const routedMatch = normalizedInstruction.match(/^(com\..+?)-(\d+)(?:-(\d+))?$/);
        if (!routedMatch) return {serviceId: normalizedInstruction, portalIndex: 0, routeIndex: null};
        return {
            serviceId: routedMatch[1],
            portalIndex: Number.parseInt(routedMatch[2], 10),
            routeIndex: routedMatch[3] === undefined ? null : Number.parseInt(routedMatch[3], 10)
        };
    };

    const waitForSuiPortalRender = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const waitForSuiClick = async () => {
        await waitForSuiPortalRender();
        await new Promise(resolve => setTimeout(resolve, SUI_CLICK_DELAY_MS));
    };

    const typeSuiInputValue = async (input, value = "") => {
        const nextValue = String(value ?? "");
        input.value = "";
        input.setAttribute("value", "");
        input.dispatchEvent(new Event("input", {bubbles: true}));
        for (const character of nextValue) {
            input.value += character;
            input.setAttribute("value", input.value);
            input.dispatchEvent(new Event("input", {bubbles: true}));
            await new Promise(resolve => setTimeout(resolve, SUI_TYPE_DELAY_MS));
        }
    };

    const getSuiKeyboardKey = (value = "") => {
        const normalizedKey = String(value || "").trim();
        const namedKeys = {
            BACKSPACE: "Backspace",
            DELETE: "Delete",
            DEL: "Delete",
            DOWN: "ArrowDown",
            END: "End",
            ENTER: "Enter",
            ESC: "Escape",
            ESCAPE: "Escape",
            HOME: "Home",
            LEFT: "ArrowLeft",
            PAGEDOWN: "PageDown",
            PAGEUP: "PageUp",
            RIGHT: "ArrowRight",
            SPACE: " ",
            TAB: "Tab",
            UP: "ArrowUp"
        };
        return namedKeys[normalizedKey.toUpperCase()] || (normalizedKey.length === 1 ? normalizedKey.toLowerCase() : normalizedKey);
    };

    const getSuiKeyboardCode = (key = "") => {
        if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
        if (/^\d$/.test(key)) return `Digit${key}`;
        const namedCodes = {
            " ": "Space",
            ArrowDown: "ArrowDown",
            ArrowLeft: "ArrowLeft",
            ArrowRight: "ArrowRight",
            ArrowUp: "ArrowUp",
            Backspace: "Backspace",
            Delete: "Delete",
            End: "End",
            Enter: "Enter",
            Escape: "Escape",
            Home: "Home",
            PageDown: "PageDown",
            PageUp: "PageUp",
            Tab: "Tab"
        };
        return namedCodes[key] || key;
    };

    const dispatchSuiKeyboardEvent = (type, key, modifiers = {}) => {
        const target = document.activeElement || document.body || document;
        const event = new KeyboardEvent(type, {
            key,
            code: getSuiKeyboardCode(key),
            bubbles: true,
            cancelable: true,
            composed: true,
            ctrlKey: !!modifiers.ctrlKey,
            altKey: !!modifiers.altKey,
            shiftKey: !!modifiers.shiftKey,
            metaKey: !!modifiers.metaKey
        });
        return !target.dispatchEvent(event);
    };

    const runSuiModifiedShortcut = async (modifier = "", shortcut = "", lineNumber = 0) => {
        const normalizedShortcut = String(shortcut || "").trim();
        if (!normalizedShortcut) throw new Error(`Line ${lineNumber}: shortcut key is required`);
        await waitForSuiClick();
        const key = getSuiKeyboardKey(normalizedShortcut);
        const modifiers = modifier === "CTRL" ? {ctrlKey: true} : {altKey: true};
        const handled = dispatchSuiKeyboardEvent("keydown", key, modifiers);
        dispatchSuiKeyboardEvent("keyup", key, modifiers);
        if (modifier !== "ALT" || handled) return true;
        dispatchSuiKeyboardEvent("keydown", "Alt");
        dispatchSuiKeyboardEvent("keyup", "Alt");
        for (const character of normalizedShortcut) {
            const sequenceKey = getSuiKeyboardKey(character);
            dispatchSuiKeyboardEvent("keydown", sequenceKey);
            dispatchSuiKeyboardEvent("keyup", sequenceKey);
        }
        return true;
    };

    const activateSuiPortalRoute = async (portal, routeIndex = null, lineNumber = 0) => {
        if (routeIndex === null) return;
        await waitForSuiClick();
        const routeNodes = Array.from(portal?.window?.()?.querySelectorAll?.(".sidebar-item") || []);
        const routeNode = routeNodes[routeIndex];
        if (!routeNode) throw new Error(`Line ${lineNumber}: route ${routeIndex} does not exist`);
        routeNode.click();
    };

    const resolveSuiHandleInstruction = (instruction = "") => {
        const normalizedInstruction = String(instruction || "").trim();
        const handles = [...new Set(Array.from(document.querySelectorAll("[handle]"))
            .map(element => element.getAttribute("handle"))
            .filter(Boolean))]
            .sort((left, right) => right.length - left.length);
        const handle = handles.find(candidate => normalizedInstruction === candidate || normalizedInstruction.startsWith(`${candidate} `)) || "";
        return {
            handle,
            value: handle && normalizedInstruction.length > handle.length
                ? normalizedInstruction.slice(handle.length).trimStart()
                : null
        };
    };

    const clickSuiHandle = async (instruction = "", lineNumber = 0) => {
        const normalizedInstruction = String(instruction || "").trim();
        if (!normalizedInstruction) throw new Error(`Line ${lineNumber}: handle is required`);
        await waitForSuiClick();
        const {handle: normalizedHandle, value} = resolveSuiHandleInstruction(normalizedInstruction);
        if (!normalizedHandle) throw new Error(`Line ${lineNumber}: handle ${normalizedInstruction} was not found`);
        const matchingElements = Array.from(document.querySelectorAll("[handle]"))
            .filter(element => element.getAttribute("handle") === normalizedHandle);
        const target = [...matchingElements].reverse().find(element => element.getClientRects().length > 0) || matchingElements[matchingElements.length - 1];
        if (!target) throw new Error(`Line ${lineNumber}: handle ${normalizedHandle} was not found`);
        if (target instanceof HTMLInputElement) {
            target.focus();
            if (value !== null) {
                await typeSuiInputValue(target, value);
            }
            return true;
        }
        if (value !== null) throw new Error(`Line ${lineNumber}: handle ${normalizedHandle} is not an input`);
        if (typeof target.click !== "function") throw new Error(`Line ${lineNumber}: handle ${normalizedHandle} cannot be clicked`);
        target.click();
        return true;
    };

    const executeSuiLine = async (line = "", lineNumber = 0) => {
        const instruction = String(line || "").trim();
        if (!instruction) return false;
        if (instruction.startsWith("com.")) {
            const {serviceId, portalIndex, routeIndex} = parseSuiServiceInstruction(instruction);
            const launchedPortal = modular.start(serviceId, {portalIndex});
            if (!launchedPortal) throw new Error(`Line ${lineNumber}: unable to launch ${serviceId} portal ${portalIndex}`);
            await activateSuiPortalRoute(launchedPortal, routeIndex, lineNumber);
            return true;
        }
        if (instruction.startsWith("* ")) return clickSuiHandle(instruction.slice(2), lineNumber);
        if (instruction.startsWith("CTRL ")) return runSuiModifiedShortcut("CTRL", instruction.slice(5), lineNumber);
        if (instruction.startsWith("ALT ")) return runSuiModifiedShortcut("ALT", instruction.slice(4), lineNumber);
        return false;
    };

    const executeSuiSource = async (source = "") => {
        const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
        let executedLineCount = 0;
        for (let index = 0; index < lines.length; index += 1) {
            if (await executeSuiLine(lines[index], index + 1)) executedLineCount += 1;
        }
        return executedLineCount;
    };

    const runSuiSource = async (source = "", rawPath = "") => {
        const fileName = getCodeFileName(rawPath) || "SUI file";
        if (!String(source || "").trim()) {
            modular.error("SUI file is empty");
            return false;
        }
        try {
            const executedLineCount = await executeSuiSource(source);
            modular.success(`Ran ${fileName} (${executedLineCount} ${executedLineCount === 1 ? "action" : "actions"})`);
            return true;
        } catch (error) {
            modular.error(error?.message || `Unable to run ${fileName}`);
            return false;
        }
    };

    const runSuiCode = async (portal) => {
        const directive = getPortalRememberedCodePath(portal);
        if (!SUI_FILE_PATTERN.test(directive)) return false;
        const source = getPortalCodeEditorInput(portal)?.value ?? getPortalCodeState(portal).cachedContent;
        return runSuiSource(source, directive);
    };

    const getStdSourceKind = (source = "") => String(source || "").trimStart().startsWith("window")
        ? "standard-ui"
        : "standard-script";

    const runStandardUiCode = async () => {
        modular.message("Standard UI execution will be implemented later");
        return false;
    };

    const runStandardScriptCode = async () => {
        modular.message("Standard script execution will be implemented later");
        return false;
    };

    const runCode = async (portal) => {
        const directive = getPortalRememberedCodePath(portal);
        if (SUI_FILE_PATTERN.test(directive)) return runSuiCode(portal);
        if (!isDeveloperModeEnabled() || !STD_FILE_PATTERN.test(directive)) return false;
        const source = getPortalCodeEditorInput(portal)?.value ?? getPortalCodeState(portal).cachedContent;
        return getStdSourceKind(source) === "standard-ui"
            ? runStandardUiCode(portal, source, directive)
            : runStandardScriptCode(portal, source, directive);
    };

    const openFreshCodeEditor = () => {
        const portal = modular.show(SERVICE_ID, 0, {newInstance: true});
        if (portal) {
            setPortalCodeState(portal, {directive: "", cachedContent: ""}, {merge: false});
            portal.refresh();
            updateCodeEditorPortalTitle(portal);
            focusCodeEditorAtEnd(portal);
        }
        return true;
    };

    window.StandardCodeEditor = window.StandardCodeEditor || {};
    window.StandardCodeEditor.openFreshCodeEditor = openFreshCodeEditor;
    window.StandardCodeEditor.runSuiSource = (source = "", rawPath = "") => runSuiSource(source, rawPath);
    window.StandardCodeEditor.openCodeFilePath = (rawPath = "", content = "") => {
        const portal = modular.show(SERVICE_ID, 0, {newInstance: true});
        if (portal) {
            setPortalCodeState(portal, {directive: normalizeCodeFilePath(rawPath), cachedContent: String(content ?? "")}, {merge: false});
            portal.refresh();
            hydrateCodeEditorFromState(portal);
            updateCodeEditorPortalTitle(portal);
            focusCodeEditorAtEnd(portal);
        }
        return true;
    };

    modular.register(new Service(SERVICE_ID, [
        new Portal({
            title: "Code",
            hints: ["create code", "new code file"],
            action: openFreshCodeEditor,
            dimensions: [700, 500],
            horizontal_nav: true,
            centered_nav: true,
            tools: [
                {title: "Run", icon: window.Plastic.icons.play, onclick: (_, context) => runCode(context?.portal)},
                {title: "Dark mode", icon: CODE_EDITOR_MOON_ICON, onclick: toggleCodeEditorDarkMode},
                {title: "Save", icon: window.Plastic.icons.save, onclick: (_, context) => saveLoadedCodeFile(context?.portal)},
                {title: "Search", icon: window.Plastic.icons.search, onclick: (event, context) => showCodeEditorSearchDialogue(context?.portal, event?.currentTarget)}
            ],
            svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"/></svg>`,
            icon: "/icons/code.png",
            route: function () {
                const {cachedContent} = getPortalCodeState(this.portal);
                updateCodeEditorPortalTitle(this.portal);
                return div({style: "large-padding-top editor-portal-shell", content: children([
                    div({style: "editor-code-shell", content: children([
                        div({style: "editor-code-wrap bordered shadowed radius", content: children([
                            div({id: "editor-code-lines", style: "editor-code-lines", content: "1"}),
                            div({id: "editor-code-stage", style: "editor-code-stage", content: children([
                                div({id: "editor-code-highlight", style: "editor-code-highlight", content: "&nbsp;"}),
                                textarea({id: "editor-code-content", style: "editor-code-input no-radius", placeholder: "Write code...", value: cachedContent}),
                                div({id: "editor-code-minimap", style: "editor-code-minimap radius margin secondary-border", ariaLabel: "Code minimap", content: children([
                                    div({id: "editor-code-minimap-content", style: "editor-code-minimap-content", content: "&nbsp;"}),
                                    div({id: "editor-code-minimap-viewport", style: "editor-code-minimap-viewport"})
                                ])})
                            ])})
                        ])})
                    ])})
                ])});
            },
            afterRender: function () {
                bindCodeEditorInteractions(this.portal);
                hydrateCodeEditorFromState(this.portal);
                updateCodeEditorPortalTitle(this.portal);
                syncCodeEditorRunTool(this.portal);
                loadCodeEditorSettings();
                focusCodeEditorAtEnd(this.portal);
            }
        })
    ], CODE_EDITOR_SETTINGS));
})();
