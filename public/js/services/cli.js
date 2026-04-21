(async () => {
    let commandHistory = [];
    let historyIndex = -1;
    let pendingCommand = "";
    let historyLoaded = false;
    const escapeHtml = (value = "") => `${value}`.replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[character] || character));
    const CLI_BACKGROUND = "#1f1b1b";
    const CLI_GREEN = "#08ac05";
    const renderCliBlock = (value = "", variant = "result") => {
        const blockStyle = variant === "command" ? `margin:0;padding:2px 6px;background:${CLI_GREEN};color:${CLI_BACKGROUND};font-family:Consolas, serif;white-space:pre-wrap;word-break:break-word;display:block;width:100%;box-sizing:border-box;` : `margin:0;color:${CLI_GREEN};font-family:Consolas, serif;white-space:pre-wrap;word-break:break-word;`;
        const blockClass = variant === "command" ? "brick" : "";
        return `<pre class="${blockClass}" style="${blockStyle}">${escapeHtml(value)}</pre>`;
    };
    const getScrollableAncestor = element => {
        let current = element?.parentElement || null;
        while (current) {
            const style = window.getComputedStyle(current);
            const overflowY = style?.overflowY || "";
            if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight) return current;
            current = current.parentElement;
        }
        return null;
    };
    const scrollCliToBottom = () => {
        const recipient = document.getElementById("append-cli-reciprocate");
        const scrollContainer = recipient?.closest(".window-body") || getScrollableAncestor(recipient) || recipient;
        if (!scrollContainer || scrollContainer.scrollHeight <= scrollContainer.clientHeight) return;
        requestAnimationFrame(() => {
            if (typeof scrollContainer.scrollTo === "function") {
                scrollContainer.scrollTo({top: scrollContainer.scrollHeight});
                return;
            }
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        });
    };
    const appendCliBlock = (value = "", variant = "result") => {
        document.getElementById("append-cli-reciprocate").append(div({style: "brick", content: renderCliBlock(value, variant)}));
    };
    const loadHistory = async cache => {
        if (historyLoaded) return;
        historyLoaded = true;
        try {
            const cachedHistory = await cache.get("history");
            if (Array.isArray(cachedHistory)) commandHistory = cachedHistory.filter(value => typeof value === "string");
        } catch (_) {
            commandHistory = [];
        }
    };
    const saveHistory = async cache => {
        try {
            await cache.create("history", commandHistory.slice(-100));
        } catch (_) {
        }
    };
    const moveCaretToEnd = input => {
        input.selectionStart = input.selectionEnd = input.value.length;
    };
    const showHistoryEntry = (commander, index) => {
        commander.value = commandHistory[index] || "";
        moveCaretToEnd(commander);
    };
    const executeCliValue = (cli_value, context) => {
        if (cli_value === "clear") {
            document.getElementById("append-cli-reciprocate").empty();
            return;
        }
        if (cli_value === "exit") {
            context?.portal?.hide?.();
            return;
        }
        appendCliBlock(`$ ${cli_value}`, "command");
        scrollCliToBottom();
        CLI.send(cli_value, false).then(d => {
            appendCliBlock(`${d ?? ""}`, "result");
            scrollCliToBottom();
        }).catch(error => {
            appendCliBlock(error?.message || "Unable to run command.", "result");
            scrollCliToBottom();
        });
    };
    modular.register(new Service("com.standard.cli", [new Portal({
        title: "CLI",
        hints: ["cli", "terminal"],
        dimensions: [900, 625],
        accent: "#08ac05",
        background: "#1f1b1b",
        navigation: false,
        svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>`,
        icon: "/icons/interfaces/cli.png",
        route: div({style: "cli-holder padded brick margin-top", content: div({content: children([
                div({id: "append-cli-reciprocate", style: "brick large-padding-bottom"}),
                div({id: "commander", style: "fixed bottomed fill cli-holder padded brick", content: children([
                        div({style: "inline text-green", content: "$ <> "}),
                        input({id: "cli-commander", style: "inline undecorated text-green monospaced partial-fill", attributes: {autocomplete: "off"}})
                    ])
                })
            ])})}),
        afterRender: async (_, context) => {
            await loadHistory(context.cache);
            const commander = document.getElementById("cli-commander");
            commander.focus();
            commander.onkeydown = e => {
                if (e.key === "ArrowUp") {
                    if (!commandHistory.length) return;
                    e.preventDefault();
                    if (historyIndex === -1) {
                        pendingCommand = commander.value;
                        historyIndex = commandHistory.length - 1;
                    } else {
                        historyIndex = Math.max(0, historyIndex - 1);
                    }
                    showHistoryEntry(commander, historyIndex);
                    return;
                }
                if (e.key === "ArrowDown") {
                    if (historyIndex === -1) return;
                    e.preventDefault();
                    if (historyIndex < commandHistory.length - 1) {
                        historyIndex += 1;
                        showHistoryEntry(commander, historyIndex);
                    } else {
                        historyIndex = -1;
                        commander.value = pendingCommand;
                        moveCaretToEnd(commander);
                    }
                    return;
                }
                if (e.key === "Enter") {
                    e.preventDefault();
                    const cli_value = commander.value.trim();
                    if (cli_value) {
                        commandHistory.push(cli_value);
                        historyIndex = -1;
                        pendingCommand = "";
                        saveHistory(context.cache);
                    }
                    if (cli_value) executeCliValue(cli_value, context);
                    commander.value = "";
                }
            };
        }
    })]))
})();