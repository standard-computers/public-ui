(async () => {
	let cmdHist = [];
	let histInd = -1;
	let pending = "";
	let histLoad = false;
	let pendRes = 0;
	const autocompleteDelay = 180;
	const cliCommands = [
		{value: "$config: ", label: "$config:", description: "Change a runtime configuration property"},
		{value: "clear", description: "Clear CLI output"},
		{value: "print ", label: "print", description: "Print an expression, variable, or string"},
		{value: "status", description: "Show device and network status"},
		{value: "version", description: "Show the installed system version"},
		{value: "volume ", label: "volume", description: "Set, increase, or decrease output volume"},
		{value: "~", description: "Query the configured language model"},
		{value: "bulletin", description: "Generate a changes bulletin"},
		{value: "clean", description: "Empty temporary and bulletin folders"},
		{value: "update", description: "Check for a system update"},
		{value: "delete ", label: "delete", description: "Delete a Standard by name"},
		{value: "reload standards", description: "Reload all Standard definitions"},
		{value: "reload stds", description: "Reload all Standard definitions"},
		{value: "standards ", label: "standards", description: "List or inspect Standards"},
		{value: "stds ", label: "stds", description: "List or inspect Standards"},
		{value: "destroy ", label: "destroy", description: "Delete a sandbox variable"},
		{value: "in ", label: "in", description: "Read a value into a sandbox variable"},
		{value: "registry", description: "List sandbox variables"},
		{value: "registry name", description: "Show the sandbox name"},
		{value: "typeof ", label: "typeof", description: "Show a variable's data type"},
		{value: "download ", label: "download", description: "Download a URI to the temp directory"},
		{value: "files ", label: "files", description: "Manage files on the device"},
		{value: "files index", description: "Index files on the device"},
		{value: "files folders ", label: "files folders", description: "Create a folder"},
		{value: "files move ", label: "files move", description: "Move a file or folder"},
		{value: "files replace ", label: "files replace", description: "Replace a destination file"},
		{value: "files get ", label: "files get", description: "Retrieve a file"},
		{value: "files remove ", label: "files remove", description: "Remove a file or folder"},
		{value: "pack ", label: "pack", description: "Import a Standard package"},
		{value: "run ", label: "run", description: "Run a Standard code file"},
		{value: "share ", label: "share", description: "Share a file through the relay"},
		{value: "tree ", label: "tree", description: "Show a directory manifest"},
		{value: "map ", label: "map", description: "Add an authenticated child node"},
		{value: "relay", description: "List connected relay clients"},
		{value: "relay ping ", label: "relay ping", description: "Check whether a device is connected"},
		{value: "relay chit ", label: "relay chit", description: "Create an authentication Chit"},
		{value: "user ", label: "user", description: "Validate a user ID and Chit"},
		{value: "history", description: "Open command history"},
		{value: "history -c", description: "Clear command history"},
		{value: "launch ", label: "launch", description: "Launch an installed package"},
		{value: "exit", description: "Close the CLI window"}
	];
	const escapeHtml = (value = "") => `${value}`.replace(/[&<>"']/g, character => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;"
	}[character] || character));
	const renderCliBlock = (value = "", variant = "result") => {
		const mono = `ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
		const bs = variant === "command" ? `margin:0;padding:2px 6px;background:#08ac05;color:#1f1b1b;font-family:${mono};white-space:pre-wrap;word-break:break-word;display:block;width:100%;box-sizing:border-box;` : `margin:0;color:#08ac05;font-family:${mono};white-space:pre-wrap;word-break:break-word;`;
		const bc = variant === "command" ? "brick" : "";
		return `<pre class="${bc}" style="${bs}">${escapeHtml(value)}</pre>`;
	};
	const getScrollableAncestor = element => {
		let c = element?.parentElement || null;
		while (c) {
			const stl = window.getComputedStyle(c);
			const oy = stl?.overflowY || "";
			if ((oy === "auto" || oy === "scroll") && c.scrollHeight > c.clientHeight) return c;
			c = c.parentElement;
		}
		return null;
	};
	const scrollCliToBottom = () => {
		const recipient = document.getElementById("append-cli-reciprocate");
		const sc = recipient?.closest(".window-body") || getScrollableAncestor(recipient) || recipient;
		if (!sc || sc.scrollHeight <= sc.clientHeight) return;
		requestAnimationFrame(() => {
			if (typeof sc.scrollTo === "function") {
				sc.scrollTo({top: sc.scrollHeight});
				return;
			}
			sc.scrollTop = sc.scrollHeight;
		});
	};
	const appendCliBlock = (value = "", variant = "result") => document.getElementById("append-cli-reciprocate").append(div({
		style: "brick",
		content: renderCliBlock(value, variant)
	}));
	const setCliLoading = isLoading => {
		const sts = document.getElementById("cli-status");
		if (!sts || typeof sts.isLoading !== "function") return;
		if (isLoading) {
			pendRes += 1;
			sts.isLoading();
			sts.textContent = String.fromCodePoint(0x28F7);
			return;
		}
		pendRes = Math.max(0, pendRes - 1);
		if (pendRes === 0) sts.isLoading(false);
	};
	const loadHistory = async cache => {
		if (histLoad) return;
		histLoad = true;
		try {
			const cachedHistory = await cache.get("history");
			if (Array.isArray(cachedHistory)) cmdHist = cachedHistory.filter(value => typeof value === "string");
		} catch (_) {
			cmdHist = [];
		}
	};
	const saveHistory = async cache => {
		try {
			await cache.create("history", cmdHist.slice(-100));
		} catch (_) {
		}
	};
	const moveCaretToEnd = input => input.selectionStart = input.selectionEnd = input.value.length;
	const isEditableElement = element => {
		if (!element) return false;
		if (element.isContentEditable) return true;
		const tagName = `${element.tagName || ""}`.toLowerCase();
		return tagName === "input" || tagName === "textarea" || tagName === "select";
	};
	const showHistoryEntry = (cmdr, i) => {
		cmdr.value = cmdHist[i] || "";
		moveCaretToEnd(cmdr);
	};
	const executeCliValue = (cliv, context) => {
		if (cliv === "clear") {
			document.getElementById("append-cli-reciprocate").empty();
			return;
		}
		if (cliv === "exit") {
			context?.portal?.hide?.();
			return;
		}
		appendCliBlock(`$ ${cliv}`, "command");
		scrollCliToBottom();
		setCliLoading(true);
		CLI.send(cliv, false).then(d => {
			appendCliBlock(`${d ?? ""}`, "result");
			scrollCliToBottom();
		}).catch(e => {
			appendCliBlock(e?.message || "Unable to run command.", "result");
			scrollCliToBottom();
		}).finally(() => setCliLoading(false));
	};
	modular.register(new Service("com.standard.cli", [new Portal({
		title: "CLI",
		hints: ["cli", "terminal"],
		dimensions: [900, 625],
		accent: "#08ac05",
		background: "#1f1b1b",
		navigation: false,
		svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>`,
		icon: "/icons/interfaces/cli.png",
		route: div({
			style: "cli-holder padded brick margin-top",
			content: div({
				content: children([div({
					id: "append-cli-reciprocate",
					style: "brick large-padding-bottom"
				}), div({
					id: "commander",
					style: "fixed bottomed fill cli-holder padded brick cli-command-row",
					content: children([div({
						style: "inline text-green cli-command-prompt",
						content: "$ <> "
					}), input({
						id: "cli-commander",
						style: "inline undecorated text-green monospaced cli-command-input",
						attributes: {autocomplete: "off"}
					}), div({id: "cli-status", style: "block-loader text-green cli-command-loader"})])
				})])
			})
		}),
		afterRender: async (_, context) => {
			await loadHistory(context.cache);
			const cmdr = document.getElementById("cli-commander");
			let autocompleteTimer = null;
			const autocomplete = cmdr.autocompleteMenu({
				id: "cli-autocomplete-menu",
				className: "cli-autocomplete-menu",
				placement: "above",
				matchAnchorWidth: false,
				onSelect: item => {
					cmdr.value = item.value;
					moveCaretToEnd(cmdr);
					histInd = -1;
					pending = "";
				}
			});
			const updateAutocomplete = () => {
				const query = cmdr.value.trimStart().toLowerCase();
				if (!query) {
					autocomplete.hide();
					return;
				}
				const matches = cliCommands
					.map((item, order) => ({item, order, searchable: `${item.value} ${item.label || ""}`.toLowerCase()}))
					.filter(candidate => candidate.searchable.includes(query))
					.sort((a, b) => Number(!a.item.value.toLowerCase().startsWith(query)) - Number(!b.item.value.toLowerCase().startsWith(query)) || a.order - b.order)
					.slice(0, 10)
					.map(candidate => candidate.item);
				autocomplete.setItems(matches);
			};
			const queueAutocomplete = () => {
				clearTimeout(autocompleteTimer);
				autocompleteTimer = setTimeout(updateAutocomplete, autocompleteDelay);
			};
			if (window.standardCliAutocomplete) window.standardCliAutocomplete.destroy();
			window.standardCliAutocomplete = autocomplete;
			cmdr.addEventListener("input", queueAutocomplete);
			const focusCommandInput = () => {
				cmdr.focus();
				moveCaretToEnd(cmdr);
			};
			focusCommandInput();
			cmdr.onkeydown = e => {
				if (autocomplete.handleKeydown(e)) return;
				if (e.key === "ArrowUp") {
					if (!cmdHist.length) return;
					e.preventDefault();
					if (histInd === -1) {
						pending = cmdr.value;
						histInd = cmdHist.length - 1;
					} else {
						histInd = Math.max(0, histInd - 1);
					}
					showHistoryEntry(cmdr, histInd);
					return;
				}
				if (e.key === "ArrowDown") {
					if (histInd === -1) return;
					e.preventDefault();
					if (histInd < cmdHist.length - 1) {
						histInd += 1;
						showHistoryEntry(cmdr, histInd);
					} else {
						histInd = -1;
						cmdr.value = pending;
						moveCaretToEnd(cmdr);
					}
					return;
				}
				if (e.key === "Enter") {
					e.preventDefault();
					const cliv = cmdr.value.trim();
					if (cliv) {
						cmdHist.push(cliv);
						histInd = -1;
						pending = "";
						saveHistory(context.cache);
					}
					if (cliv) executeCliValue(cliv, context);
					cmdr.value = "";
					autocomplete.hide();
				}
			};
			const handleCliShortcut = event => {
				if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
				if (document.activeElement === cmdr || isEditableElement(document.activeElement)) return;
				const portalWindow = cmdr.closest(".draggable-window");
				if (!portalWindow?.classList?.contains("window-focused")) return;
				event.preventDefault();
				focusCommandInput();
			};
			if (window.standardCliCommandFocusShortcut) document.removeEventListener("keydown", window.standardCliCommandFocusShortcut);
			window.standardCliCommandFocusShortcut = handleCliShortcut;
			document.addEventListener("keydown", window.standardCliCommandFocusShortcut);
		}
	})]))
})();
