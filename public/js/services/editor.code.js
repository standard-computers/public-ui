(() => {
    const SERVICE_ID = "com.standard.editor.code";
    const SUI_FILE_PATTERN = /\.sui$/i;
    const SUI_CLICK_DELAY_MS = 250;
    const SUI_TYPE_DELAY_MS = 24;
    const CODE_EDITOR_RUN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"/></svg>`;
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
    const syncCodeEditorRunTool = (portal) => {
        const runTool = portal?.window?.()?.querySelector?.('[data-portal-tool-title="run"]');
        if (runTool) runTool.hidden = !SUI_FILE_PATTERN.test(getPortalRememberedCodePath(portal));
    };
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
        if (typeof searchDialogue === "function") {
            searchDialogue({
                title: "Search",
                placeholder: "Find code",
                value: initialValue,
                confirmText: "Search",
                anchor: anchorNode,
                matches: (query) => createCodeEditorSearchMatches(query, portal),
                preview: (_, match) => scrollToCodeEditorSearchMatch(match, portal),
                confirmation: (query, match, matches) => {
                    const selectedMatch = match || matches?.[0] || createCodeEditorSearchMatches(query, portal)[0];
                    if (!scrollToCodeEditorSearchMatch(selectedMatch, portal)) modular.error("No matches found");
                }
            });
            return true;
        }
        inputDialogue({title: "Search", placeholder: "Find code", value: initialValue, confirmation: (_, query) => {
                const match = createCodeEditorSearchMatches(query, portal)[0];
                if (!scrollToCodeEditorSearchMatch(match, portal)) modular.error("No matches found");
            }
        });
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
            const response = await window.StandardUploads.uploadFile(codeFile, uploadPath, {label: `Saving ${fileName}`});
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
        setPortalCodeState(portal, {directive: normalizedPath, cachedContent: nextContent}, {merge: false});
        syncCodeEditorPresentation(portal);
        updateCodeEditorPortalTitle(portal);
        await window.StandardFilesRefreshCache?.();
        modular.success(`Saved ${normalizedPath} (${bytes.length} bytes)`);
        return true;
    };
    const saveNewCodeFileToDocuments = (portal) => {
        inputDialogue({title: "File name", placeholder: "code.js", value: "code.js", confirmation: async (_, inputFileName) => {
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
    const runSuiCode = async (portal) => {
        const directive = getPortalRememberedCodePath(portal);
        if (!SUI_FILE_PATTERN.test(directive)) return false;
        const source = getPortalCodeEditorInput(portal)?.value ?? getPortalCodeState(portal).cachedContent;
        if (!String(source || "").trim()) {
            modular.error("SUI file is empty");
            return false;
        }
        try {
            const executedLineCount = await executeSuiSource(source);
            modular.success(`Ran ${getCodeFileName(directive)} (${executedLineCount} ${executedLineCount === 1 ? "action" : "actions"})`);
            return true;
        } catch (error) {
            modular.error(error?.message || `Unable to run ${getCodeFileName(directive)}`);
            return false;
        }
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
                {title: "Save", icon: modular.icons.save, onclick: (_, context) => saveLoadedCodeFile(context?.portal)},
                {title: "Run", icon: CODE_EDITOR_RUN_ICON, onclick: (_, context) => runSuiCode(context?.portal)},
                {title: "Search", icon: modular.icons.search, onclick: (event, context) => showCodeEditorSearchDialogue(context?.portal, event?.currentTarget)}
            ],
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
                syncCodeEditorRunTool(this.portal);
                focusCodeEditorAtEnd(this.portal);
            }
        })
    ]));
})();
