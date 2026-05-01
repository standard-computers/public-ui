(() => {
    const SERVICE_ID = "com.standard.editor.code";
    const CODE_EDITOR_KEYWORDS = new Set([
        "abstract", "alias", "and", "as", "asm", "assert", "async", "await", "auto", "base", "begin",
        "bool", "boolean", "break", "by", "byte", "case", "catch", "char", "checked", "class", "const",
        "constructor", "continue", "crate", "data", "debugger", "declare", "def", "default", "defer",
        "delete", "del", "do", "double", "dynamic", "echo", "elif", "else", "elseif", "end", "ensure",
        "enum", "event", "except", "export", "extends", "extern", "false", "final", "finally", "fixed",
        "fn", "for", "foreach", "from", "func", "function", "fun", "global", "goto", "if", "impl",
        "implements", "import", "in", "include", "inline", "instanceof", "interface", "internal", "is",
        "lambda", "let", "library", "loop", "match", "module", "mut", "namespace", "native", "new",
        "nil", "not", "null", "object", "operator", "or", "out", "override", "package", "params",
        "partial", "pass", "private", "protected", "protocol", "pub", "public", "raise", "readonly",
        "record", "redo", "ref", "register", "repeat", "require", "rescue", "return", "sealed", "select",
        "self", "short", "signed", "sizeof", "static", "string", "struct", "sub", "super", "switch",
        "template", "then", "this", "throw", "throws", "trait", "transient", "true", "try", "type",
        "typedef", "typeof", "unchecked", "union", "unless", "unsafe", "unsigned", "until", "use",
        "using", "val", "var", "virtual", "void", "volatile", "when", "where", "while", "with", "yield"
    ]);
    const CODE_EDITOR_BUILTINS = new Set([
        "array", "bigint", "binary", "bool", "boolean", "buffer", "byte", "date", "datetime", "decimal",
        "dict", "document", "element", "error", "exception", "false", "float", "int", "integer", "json",
        "list", "map", "nan", "none", "null", "number", "object", "promise", "regex", "regexp", "result",
        "self", "set", "some", "string", "symbol", "table", "this", "true", "undefined", "vec", "void",
        "window"
    ]);
    const CODE_EDITOR_LINE_COMMENT_STARTS = ["//", "#", "--", ";", "%"];
    const CODE_EDITOR_BLOCK_COMMENTS = [
        {start: "/*", end: "*/"},
        {start: "<!--", end: "-->"},
        {start: "{-", end: "-}"},
        {start: "=begin", end: "=end"}
    ];
    const CODE_EDITOR_NAME_KEYWORDS = new Set(["class", "def", "fn", "func", "function", "interface", "module", "namespace", "struct", "trait", "type"]);
    const normalizeCodeFilePath = (rawPath = "") => String(rawPath || "").replace(/^\/home\/standard-system\//, "").replace(/^\/+/, "");
    const getCodeFileName = (rawPath = "") => String(rawPath || "").split("/").pop() || "code.js";
    const getCodeFileDirectory = (rawPath = "") => {
        const normalizedPath = normalizeCodeFilePath(rawPath);
        if (!normalizedPath.includes("/")) return "";
        return normalizedPath.split("/").slice(0, -1).join("/");
    };
    const sanitizeNewCodeFileName = (rawName = "") => {
        const trimmedName = String(rawName || "").trim().replace(/\\/g, "/");
        const baseName = trimmedName.split("/").pop() || "";
        return baseName.replace(/^\.+/, "");
    };
    const escapeCodeMarkup = (value = "") => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
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
        return normalizeCodeFilePath(
            windowNode?.dataset?.codeFilePath
            || textareaNode?.dataset?.codeFilePath
            || ""
        );
    };
    const syncPortalRememberedCodePath = (portal, rawPath = "") => {
        const normalizedPath = normalizeCodeFilePath(rawPath);
        const windowNode = portal?.window?.();
        const textareaNode = getPortalCodeEditorInput(portal);
        if (windowNode) windowNode.dataset.codeFilePath = normalizedPath;
        if (textareaNode) textareaNode.dataset.codeFilePath = normalizedPath;
        return normalizedPath;
    };
    const setPortalCodeState = (portal, nextState = {}, options = {}) => {
        if (!portal || typeof portal.setWindowState !== "function") return getPortalCodeState(portal);
        portal.setWindowState(nextState, options);
        if (Object.prototype.hasOwnProperty.call(nextState || {}, "directive")) {
            syncPortalRememberedCodePath(portal, nextState?.directive || "");
        }
        return getPortalCodeState(portal);
    };
    const getPortalCodeEditorInput = (portal) => portal?.window?.()?.querySelector?.("#editor-code-content") || null;
    const getPortalCodeLineNumbers = (portal) => portal?.window?.()?.querySelector?.("#editor-code-lines") || null;
    const getPortalCodeHighlight = (portal) => portal?.window?.()?.querySelector?.("#editor-code-highlight") || null;
    const getPortalCodeStage = (portal) => portal?.window?.()?.querySelector?.("#editor-code-stage") || null;
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
            if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key?.toLowerCase?.() === "d") {
                event.preventDefault();
                duplicateCodeEditorLineDown(codeEditorInput);
                codeEditorInput.dispatchEvent(new Event("input", {bubbles: true}));
                return;
            }
            if (event.key === "Tab") {
                event.preventDefault();
                insertCodeEditorText(codeEditorInput, "    ", 4);
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
        const bytes = new TextEncoder().encode(nextContent);
        const fileName = getCodeFileName(normalizedPath);
        const directory = getCodeFileDirectory(normalizedPath);
        const uploadPath = directory ? `/api/upload?directory=${encodeURIComponent(directory)}` : "/api/upload";
        const codeFile = new File([bytes], fileName, {type: "application/octet-stream"});
        let saved = false;
        if (typeof window.StandardUploads?.uploadFile === "function") {
            const response = await window.StandardUploads.uploadFile(codeFile, uploadPath, {
                label: `Saving ${fileName}`
            });
            saved = !!response?.ok;
        } else {
            const formData = new FormData();
            formData.append("file", codeFile);
            const response = await fetch(uploadPath, {method: "POST", body: formData});
            saved = response.ok;
        }
        if (!saved) {
            modular.error("Unable to save code file");
            return false;
        }
        setPortalCodeState(portal, {
            directive: normalizedPath,
            cachedContent: nextContent
        }, {merge: false});
        syncCodeEditorPresentation(portal);
        updateCodeEditorPortalTitle(portal);
        modular.success(`Saved ${normalizedPath} (${bytes.length} bytes)`);
        return true;
    };
    const saveNewCodeFileToDocuments = (portal) => {
        inputDialogue({
            title: "File name",
            placeholder: "code.js",
            value: "code.js",
            confirmation: async (_, inputFileName) => {
                if (!modular.validateFileName(inputFileName)) return;
                const safeFileName = sanitizeNewCodeFileName(inputFileName) || "code.js";
                await saveCodeEditorContentToPath(portal, `Documents/${safeFileName}`);
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
    const openFreshCodeEditor = () => {
        const portal = modular.show(SERVICE_ID, 0, {newInstance: true});
        if (portal) {
            setPortalCodeState(portal, {directive: "", cachedContent: ""}, {merge: false});
            portal.refresh();
            updateCodeEditorPortalTitle(portal);
        }
        return true;
    };
    window.StandardCodeEditor = window.StandardCodeEditor || {};
    window.StandardCodeEditor.openFreshCodeEditor = openFreshCodeEditor;
    window.StandardCodeEditor.openCodeFilePath = (rawPath = "", content = "") => {
        const portal = modular.start(SERVICE_ID);
        if (portal) {
            setPortalCodeState(portal, {
                directive: normalizeCodeFilePath(rawPath),
                cachedContent: String(content ?? "")
            }, {merge: false});
            portal.refresh();
            hydrateCodeEditorFromState(portal);
            updateCodeEditorPortalTitle(portal);
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
            tools: [{
                title: "Save",
                icon: modular.icons.save,
                onclick: (_, context) => {
                    saveLoadedCodeFile(context?.portal);
                }
            }],
            svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" /></svg>`,
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
                                textarea({id: "editor-code-content", style: "editor-code-input no-radius", placeholder: "Write code...", value: cachedContent})
                            ])})
                        ])})
                    ])})
                ])});
            },
            afterRender: function () {
                bindCodeEditorInteractions(this.portal);
                hydrateCodeEditorFromState(this.portal);
                updateCodeEditorPortalTitle(this.portal);
            }
        })
    ]));
})();
