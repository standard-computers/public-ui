(() => {

	const SERVICE_ID = "com.standard.charts";
	const NS = "http://www.w3.org/2000/svg";

	const CONNECTOR_STYLE_OPTIONS = [
		{label: "Straight", value: "straight"},
		{label: "Vertexed", value: "vertexed"},
		{label: "Curved", value: "curved"}
	];

	const ALIGN_ICONS = {
		left: window.Plastic.icons.left,
		center: window.Plastic.icons.center,
		right: window.Plastic.icons.right
	};

	const TEXT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" d="M5 6h14M12 6v12m-4 0h8"/></svg>`;
	const PNG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="16.5" cy="8.5" r="1.5"/><path stroke-linejoin="round" d="m5.5 17 4.5-5 3 3 2-2 3.5 4"/></svg>`;

	const defaultStyle = () => ({
		fontFamily: "Inter",
		fontSize: 16,
		bold: false,
		italic: false,
		underline: false,
		textColor: "#172033",
		fill: "#ffffff",
		stroke: "#657089",
		align: "center"
	});

	let documentState = freshState();
	let activePath = "";
	let activeController = null;
	let refreshList = null;

	function freshState() {
		return {
			format: "std.charts.v1",
			name: "",
			background: "#f5f6f8",
			connectorStyle: "straight",
			viewport: {x: 0, y: 0, scale: 1},
			items: [],
			connectors: []
		};
	}

	const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const cleanName = value => String(value || "").trim().replace(/\.chrts$/i, "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
	const normalizePath = value => String(value || "").replace(/^\/home\/standard-system\//, "").replace(/^\/+/, "");
	const esc = value => String(value ?? "").replace(/[&<>\"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
	const svg = (tag, attrs = {}) => {
		const node = document.createElementNS(NS, tag);
		Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
		return node;
	};
	const getWindow = () => Array.from(document.querySelectorAll(".draggable-window")).filter(node => node.querySelector(".window-header .title")?.textContent.trim() === "Charts").pop() || null;
	const editorRoot = () => getWindow()?.querySelector(".charts-editor");

	async function saveChart() {
		const perform = async name => {
			documentState.name = cleanName(name);
			const fileName = `${documentState.name}.chrts`;
			const file = new File([JSON.stringify(documentState)], fileName, {type: "application/json"});
			const url = "/api/upload?directory=Charts";
			let ok;
			if (window.StandardUploads?.uploadFile) ok = !!(await window.StandardUploads.uploadFile(file, url, {label: `Saving ${fileName}`}))?.ok;
			else {
				const body = new FormData();
				body.append("file", file);
				ok = (await fetch(url, {method: "POST", body})).ok;
			}
			if (!ok) throw new Error("Unable to save chart");
			activePath = `Charts/${fileName}`;
			await window.StandardFilesRefreshCache?.();
			refreshList?.();
			modular.success(`Saved ${fileName}`);
		};
		if (documentState.name) return perform(documentState.name).catch(error => modular.error(error.message));
		inputDialogue({
			title: "Save chart",
			placeholder: "Chart name",
			confirmation: (_, value) => cleanName(value) ? perform(value).catch(error => modular.error(error.message)) : modular.error("Chart name is required")
		});
	}

	async function openChart(path, payload) {
		documentState = {
			...freshState(), ...(payload || {}),
			viewport: {...freshState().viewport, ...(payload?.viewport || {})},
			items: Array.isArray(payload?.items) ? payload.items : [],
			connectors: Array.isArray(payload?.connectors) ? payload.connectors : []
		};
		activePath = normalizePath(path);
		if (!getWindow()) modular.start(SERVICE_ID);
		await new Promise(resolve => setTimeout(resolve, 80));
		const editRoute = Array.from(getWindow()?.querySelectorAll(".sidebar-item") || []).find(node => /edit/i.test(node.textContent));
		editRoute?.click();
		setTimeout(() => activeController?.load(), 30);
		return true;
	}

	async function openPath(path) {
		try {
			const normalized = normalizePath(path);
			const download = await window.StandardDownloads.downloadForOpen(normalized, {
				errorMessage: "Unable to open chart",
				suppressProgress: true
			});
			return openChart(normalized, JSON.parse(await download.blob.text()));
		} catch (_) {
			modular.error("Unable to open chart");
			return false;
		}
	}

	window.StandardCharts = {openChartData: openChart, openChartPath: openPath};

	function exportMermaid() {
		const ids = new Map(documentState.items.map((item, index) => [item.id, `N${index + 1}`]));
		const quote = text => String(text || " ").replace(/"/g, "&quot;");
		const nodes = documentState.items.filter(item => item.type !== "image").map(item => {
			const id = ids.get(item.id), label = quote(item.text);
			if (item.kind === "ellipse") return `    ${id}(["${label}"])`;
			if (item.kind === "diamond") return `    ${id}{"${label}"}`;
			if (item.kind === "rounded") return `    ${id}("${label}")`;
			return `    ${id}["${label}"]`;
		});
		const links = documentState.connectors.filter(c => ids.has(c.from.itemId) && ids.has(c.to.itemId)).map(c => `    ${ids.get(c.from.itemId)} -->${c.text ? `|${quote(c.text)}|` : ""} ${ids.get(c.to.itemId)}`);
		const code = ["flowchart TD", ...nodes, ...links].join("\n");
		navigator.clipboard?.writeText(code).catch(() => {
		});
		inputDialogue({
			title: "Mermaid chart code (copied)", value: code, confirmation: () => {
			}
		});
	}

	const chartTitle = extension => `${cleanName(documentState.name) || "Untitled_Chart"}.${extension}`;
	const chartBounds = () => {
		if (!documentState.items.length) return null;
		const padding = 48;
		const left = Math.min(...documentState.items.map(item => Number(item.x) || 0)) - padding;
		const top = Math.min(...documentState.items.map(item => Number(item.y) || 0)) - padding;
		const right = Math.max(...documentState.items.map(item => (Number(item.x) || 0) + (Number(item.w) || 0))) + padding;
		const bottom = Math.max(...documentState.items.map(item => (Number(item.y) || 0) + (Number(item.h) || 0))) + padding;
		return {left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top)};
	};

	const chartVertexPoint = (item, vertex) => ({
		top: {x: item.x + item.w / 2, y: item.y},
		right: {x: item.x + item.w, y: item.y + item.h / 2},
		bottom: {x: item.x + item.w / 2, y: item.y + item.h},
		left: {x: item.x, y: item.y + item.h / 2}
	}[vertex]);

	const chartConnectorPath = connector => {
		const fromItem = documentState.items.find(item => item.id === connector.from?.itemId);
		const toItem = documentState.items.find(item => item.id === connector.to?.itemId);
		if (!fromItem || !toItem) return "";
		const from = chartVertexPoint(fromItem, connector.from.vertex), to = chartVertexPoint(toItem, connector.to.vertex);
		if (documentState.connectorStyle === "curved") {
			const dx = Math.max(70, Math.abs(to.x - from.x) * .5);
			return `M${from.x},${from.y} C${from.x + dx},${from.y} ${to.x - dx},${to.y} ${to.x},${to.y}`;
		}
		if (documentState.connectorStyle === "vertexed") {
			const middleX = (from.x + to.x) / 2;
			return `M${from.x},${from.y} L${middleX},${from.y} L${middleX},${to.y} L${to.x},${to.y}`;
		}
		return `M${from.x},${from.y} L${to.x},${to.y}`;
	};

	const wrapChartText = (value, width, fontSize) => {
		const maximumCharacters = Math.max(1, Math.floor(width / Math.max(4, fontSize * .58)));
		return String(value || "").split(/\r?\n/).flatMap(paragraph => {
			const words = paragraph.split(/\s+/).filter(Boolean), lines = [];
			if (!words.length) return [""];
			words.forEach(word => {
				if (!lines.length || `${lines.at(-1)} ${word}`.trim().length > maximumCharacters) lines.push(word);
				else lines[lines.length - 1] += ` ${word}`;
			});
			return lines;
		});
	};

	const chartSvg = bounds => {
		const shapeMarkup = documentState.items.map(item => {
			const style = {...defaultStyle(), ...(item.style || {})};
			let shape = "";
			if (item.type === "image") shape = `<image href="${esc(item.src)}" x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" preserveAspectRatio="none"/>`;
			else if (item.type === "shape") {
				if (item.kind === "ellipse") shape = `<ellipse cx="${item.x + item.w / 2}" cy="${item.y + item.h / 2}" rx="${item.w / 2 - 2}" ry="${item.h / 2 - 2}"/>`;
				else if (item.kind === "diamond") shape = `<path d="M${item.x + item.w / 2},${item.y + 2} L${item.x + item.w - 2},${item.y + item.h / 2} L${item.x + item.w / 2},${item.y + item.h - 2} L${item.x + 2},${item.y + item.h / 2} Z"/>`;
				else shape = `<rect x="${item.x + 2}" y="${item.y + 2}" width="${item.w - 4}" height="${item.h - 4}" rx="${item.kind === "rounded" ? 18 : 2}"/>`;
				shape = `<g fill="${esc(style.fill)}" stroke="${esc(style.stroke)}" stroke-width="2">${shape}</g>`;
			}
			if (item.type === "image") return shape;
			const fontSize = Math.max(8, Number(style.fontSize) || 16), lineHeight = fontSize * 1.2;
			const lines = wrapChartText(item.text, Math.max(1, item.w - 16), fontSize);
			const textAnchor = style.align === "left" ? "start" : style.align === "right" ? "end" : "middle";
			const textX = style.align === "left" ? item.x + 8 : style.align === "right" ? item.x + item.w - 8 : item.x + item.w / 2;
			const firstLineY = item.y + item.h / 2 - ((lines.length - 1) * lineHeight) / 2;
			const decoration = style.underline ? " text-decoration=\"underline\"" : "";
			const text = lines.map((line, index) => `<tspan x="${textX}" y="${firstLineY + index * lineHeight}">${esc(line)}</tspan>`).join("");
			return `${shape}<text text-anchor="${textAnchor}" dominant-baseline="middle" fill="${esc(style.textColor)}" font-family="${esc(style.fontFamily)}" font-size="${fontSize}" font-weight="${style.bold ? 700 : 400}" font-style="${style.italic ? "italic" : "normal"}"${decoration}>${text}</text>`;
		}).join("");
		const connectors = documentState.connectors.map(connector => {
			const path = chartConnectorPath(connector);
			if (!path) return "";
			const fromItem = documentState.items.find(item => item.id === connector.from?.itemId);
			const toItem = documentState.items.find(item => item.id === connector.to?.itemId);
			const from = chartVertexPoint(fromItem, connector.from.vertex), to = chartVertexPoint(toItem, connector.to.vertex);
			const label = connector.text ? `<text x="${(from.x + to.x) / 2}" y="${(from.y + to.y) / 2 - 7}" text-anchor="middle" fill="#172033" stroke="${esc(documentState.background || "#f5f6f8")}" stroke-width="5" paint-order="stroke" stroke-linejoin="round" font-family="Inter" font-size="14" font-weight="600">${esc(connector.text)}</text>` : "";
			return `<path d="${path}" fill="none" stroke="#657089" stroke-width="2" marker-end="url(#chart-print-arrow)"/>${label}`;
		}).join("");
		return `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}"><defs><marker id="chart-print-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#657089"/></marker></defs><rect x="${bounds.left}" y="${bounds.top}" width="${bounds.width}" height="${bounds.height}" fill="${esc(documentState.background || "#f5f6f8")}"/>${connectors}${shapeMarkup}</svg>`;
	};

	const renderChartCanvas = async () => {
		const bounds = chartBounds();
		if (!bounds) throw new Error("Add something to the chart before printing");
		const maximumDimension = 4096, scale = Math.min(2, maximumDimension / Math.max(bounds.width, bounds.height));
		const canvas = document.createElement("canvas"), image = new Image();
		canvas.width = Math.max(1, Math.round(bounds.width * scale));
		canvas.height = Math.max(1, Math.round(bounds.height * scale));
		const source = URL.createObjectURL(new Blob([chartSvg(bounds)], {type: "image/svg+xml"}));
		try {
			await new Promise((resolve, reject) => {
				image.onload = resolve;
				image.onerror = () => reject(new Error("Unable to render this chart"));
				image.src = source;
			});
			canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
			return canvas;
		} finally {
			URL.revokeObjectURL(source);
		}
	};

	const concatBytes = parts => {
		const length = parts.reduce((total, part) => total + part.length, 0), output = new Uint8Array(length);
		let offset = 0;
		parts.forEach(part => {
			output.set(part, offset);
			offset += part.length;
		});
		return output;
	};

	const pdfBlobFromCanvas = canvas => {
		const encoder = new TextEncoder(), text = value => encoder.encode(value);
		const jpegBytes = Uint8Array.from(atob(canvas.toDataURL("image/jpeg", .94).split(",")[1]), character => character.charCodeAt(0));
		const landscape = canvas.width >= canvas.height, pageWidth = landscape ? 792 : 612, pageHeight = landscape ? 612 : 792, margin = 36;
		const scale = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
		const imageWidth = canvas.width * scale, imageHeight = canvas.height * scale, x = (pageWidth - imageWidth) / 2, y = (pageHeight - imageHeight) / 2;
		const content = `q\n${imageWidth.toFixed(3)} 0 0 ${imageHeight.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm\n/Im0 Do\nQ\n`;
		const objects = [
			text("<< /Type /Catalog /Pages 2 0 R >>"),
			text("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
			text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
			concatBytes([text(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`), jpegBytes, text("\nendstream")]),
			text(`<< /Length ${content.length} >>\nstream\n${content}endstream`)
		];
		const parts = [text("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n")], offsets = [0];
		objects.forEach((object, index) => {
			offsets.push(parts.reduce((total, part) => total + part.length, 0));
			parts.push(text(`${index + 1} 0 obj\n`), object, text("\nendobj\n"));
		});
		const xrefOffset = parts.reduce((total, part) => total + part.length, 0);
		parts.push(text(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
		return new Blob([concatBytes(parts)], {type: "application/pdf"});
	};

	const waitForChartPreviewMethod = async lookup => {
		let method = lookup();
		if (typeof method === "function") return method;
		modular.start?.("com.standard.internals");
		for (let attempt = 0; attempt < 20; attempt++) {
			await new Promise(resolve => setTimeout(resolve, 50));
			method = lookup();
			if (typeof method === "function") return method;
		}
		return null;
	};

	const printChart = () => {
		const bounds = chartBounds();
		if (!bounds) return modular.error("Add something to the chart before printing");
		const frame = document.createElement("iframe");
		Object.assign(frame.style, {position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", opacity: "0"});
		frame.setAttribute("aria-hidden", "true");
		document.body.appendChild(frame);
		const frameWindow = frame.contentWindow;
		if (!frameWindow) {
			frame.remove();
			return modular.error("Unable to prepare chart for printing");
		}
		frameWindow.document.open();
		frameWindow.document.write(`<!doctype html><html><head><title>${esc(chartTitle("chrts"))}</title><style>@page{margin:.35in}html,body{margin:0;width:100%;height:100%}body{display:grid;place-items:center}svg{max-width:100%;max-height:100vh;width:auto;height:auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${chartSvg(bounds)}</body></html>`);
		frameWindow.document.close();
		const cleanup = () => window.setTimeout(() => frame.remove(), 500);
		frameWindow.addEventListener("afterprint", cleanup, {once: true});
		window.setTimeout(() => {
			try {
				frameWindow.focus();
				frameWindow.print();
				window.setTimeout(cleanup, 1000);
			} catch (_) {
				frame.remove();
				modular.error("Unable to print this chart");
			}
		}, 80);
	};

	const previewChartPng = async sourceNode => {
		try {
			const canvas = await renderChartCanvas();
			const openImage = await waitForChartPreviewMethod(() => window.StandardInternals?.openImageSource);
			if (!openImage) throw new Error("Image preview is unavailable");
			openImage(canvas.toDataURL("image/png"), {title: chartTitle("png"), sourceNode});
		} catch (error) {
			modular.error(error.message || "Unable to preview this chart as PNG");
		}
	};

	const previewChartPdf = async sourceNode => {
		try {
			const canvas = await renderChartCanvas(), source = URL.createObjectURL(pdfBlobFromCanvas(canvas));
			const openPdf = await waitForChartPreviewMethod(() => window.StandardInternals?.openPdfSource);
			if (!openPdf) {
				URL.revokeObjectURL(source);
				throw new Error("PDF preview is unavailable");
			}
			openPdf(chartTitle("pdf"), source, {isObjectUrl: true, sourceNode});
		} catch (error) {
			modular.error(error.message || "Unable to preview this chart as PDF");
		}
	};

	const showPrintMenu = event => {
		const button = event?.currentTarget;
		if (!button || typeof button.contextmenu !== "function") return;
		if (!button.__chartsPrintMenu) {
			button.__chartsPrintMenu = true;
			button.contextmenu([
				{label: "Print", icon: window.Plastic.icons.print, action: printChart},
				{label: "Preview as PDF", icon: window.Plastic.icons.pdf, action: () => previewChartPdf(button)},
				{label: "Preview as PNG", icon: PNG_ICON, action: () => previewChartPng(button)}
			]);
		}
		const rect = button.getBoundingClientRect();
		button.dispatchEvent(new MouseEvent("contextmenu", {bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.bottom}));
	};

	function showSearch(anchor) {
		window.StandardUI.openSearchDialogue({
			title: "Search chart",
			anchor,
			placeholder: "Text in shapes and connectors",
			matches: query => {
				const q = query.trim().toLowerCase();
				if (!q) return [];
				return [...documentState.items.map(item => ({
					item,
					label: item.text || "Untitled shape",
					detail: item.type === "text" ? "Text box" : "Shape"
				})), ...documentState.connectors.map(connector => ({
					connector,
					label: connector.text || "Connector",
					detail: "Connector"
				}))].filter(match => match.label.toLowerCase().includes(q));
			},
			onPreview: match => activeController?.focusMatch(match),
			onSelect: match => activeController?.focusMatch(match)
		});
	}

	function editorMarkup() {
		return `<div class="charts-editor large-padding-top">
          <div class="charts-toolbar bordered shadowed radius small-padding blurred faded">
            ${searchComboBox({
			id: "charts-font-family",
			wrapperStyle: "search-combobox-wrapper searchbox-wrapper",
			style: "inner-radius editor-font-family-combo",
			value: "Inter",
			placeholder: "Font",
			options: window.Plastic.fontFamilies.map(value => ({label: value, value}))
		})}
            ${searchComboBox({
			id: "charts-font-size",
			wrapperStyle: "search-combobox-wrapper searchbox-wrapper",
			style: "inner-radius editor-font-size-combo",
			value: "16",
			placeholder: "Size",
			allow_custom: true,
			options: window.Plastic.fontSizes.map(value => ({label: String(value), value: String(value)}))
		})}
            <button class="naked" data-toggle="bold" title="Bold"><b>B</b></button><button class="naked" data-toggle="italic" title="Italic"><i>I</i></button><button class="naked" data-toggle="underline" title="Underline"><u>U</u></button>
            <input data-style="textColor" type="color" value="#172033" title="Text color"><input data-style="fill" type="color" value="#ffffff" title="Shape fill"><input data-style="stroke" type="color" value="#657089" title="Border color">
            <button class="naked" data-action="align" title="Text alignment">${ALIGN_ICONS.center}</button>
            <span class="charts-toolbar-separator"></span>
            <button class="naked charts-tool-button" data-action="shape" title="Draw shape">${window.Plastic.icons.shapes}</button>
            <button class="naked charts-tool-button" data-action="text" title="Draw text box">${TEXT_ICON}</button><button class="naked charts-tool-button" data-action="image" title="Insert image">${window.Plastic.icons.image}</button>
            ${dropdown({
				id: "charts-connector-style",
				style: "charts-connector-style",
				ariaLabel: "Chart connector style",
				value: documentState.connectorStyle,
				options: CONNECTOR_STYLE_OPTIONS
			})}
            <label class="charts-bg-label" title="Chart background">Canvas <input data-action="background" type="color" value="#f5f6f8"></label>
          </div>
          <div class="charts-stage bordered radius shadowed" tabindex="0"><div class="charts-world"><svg class="charts-connectors"><defs><marker id="charts-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="context-stroke"/></marker></defs><g class="charts-lines"></g></svg><div class="charts-items"></div></div><div class="charts-hint">Wheel to zoom · drag empty space to pan · double-click shapes or lines to edit text</div></div>
          <input class="charts-image-input" type="file" accept="image/*" hidden>
        </div>`;
	}

	function setupEditor(root) {
		if (!root || root.__chartsReady) {
			activeController?.load();
			return;
		}
		root.__chartsReady = true;
		const stage = root.querySelector(".charts-stage"), world = root.querySelector(".charts-world"),
			itemsLayer = root.querySelector(".charts-items"), linesLayer = root.querySelector(".charts-lines"),
			imageInput = root.querySelector(".charts-image-input");
		let selected = new Set(), editing = null, drag = null, pan = null, resize = null, connectorDraft = null,
			clipboard = [], activeTool = "select", drawStart = null, drawPreview = null;
		const currentStyle = defaultStyle();
		const itemById = id => documentState.items.find(item => item.id === id);
		const vertexPoint = (item, vertex) => ({
			top: {x: item.x + item.w / 2, y: item.y},
			right: {x: item.x + item.w, y: item.y + item.h / 2},
			bottom: {x: item.x + item.w / 2, y: item.y + item.h},
			left: {x: item.x, y: item.y + item.h / 2}
		}[vertex]);

		const screenToWorld = (clientX, clientY) => {
			const rect = stage.getBoundingClientRect(), v = documentState.viewport;
			return {x: (clientX - rect.left - v.x) / v.scale, y: (clientY - rect.top - v.y) / v.scale};
		};

		const applyViewport = () => {
			const v = documentState.viewport;
			world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.scale})`;
		};

		const pathFor = connector => {
			const a = itemById(connector.from.itemId), b = itemById(connector.to.itemId);
			if (!a || !b) return "";
			const p1 = vertexPoint(a, connector.from.vertex), p2 = vertexPoint(b, connector.to.vertex);
			if (documentState.connectorStyle === "curved") {
				const dx = Math.max(70, Math.abs(p2.x - p1.x) * .5);
				return `M${p1.x},${p1.y} C${p1.x + dx},${p1.y} ${p2.x - dx},${p2.y} ${p2.x},${p2.y}`;
			}
			if (documentState.connectorStyle === "vertexed") {
				const mx = (p1.x + p2.x) / 2;
				return `M${p1.x},${p1.y} L${mx},${p1.y} L${mx},${p2.y} L${p2.x},${p2.y}`;
			}
			return `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
		};

		const renderLines = () => {
			linesLayer.innerHTML = "";
			documentState.connectors.forEach(connector => {
				const group = svg("g", {
					class: `charts-connector${selected.has(connector.id) ? " selected" : ""}`,
					"data-id": connector.id
				});
				const hit = svg("path", {d: pathFor(connector), class: "charts-connector-hit"});
				const line = svg("path", {
					d: pathFor(connector),
					class: "charts-connector-line",
					"marker-end": "url(#charts-arrow)"
				});
				group.append(hit, line);
				if (connector.text) {
					const a = itemById(connector.from.itemId), b = itemById(connector.to.itemId);
					if (a && b) {
						const p1 = vertexPoint(a, connector.from.vertex), p2 = vertexPoint(b, connector.to.vertex);
						const label = svg("text", {
							x: (p1.x + p2.x) / 2,
							y: (p1.y + p2.y) / 2 - 7,
							class: "charts-connector-label",
							"text-anchor": "middle"
						});
						label.textContent = connector.text;
						group.append(label);
					}
				}
				group.addEventListener("click", event => {
					event.stopPropagation();
					selected = new Set([connector.id]);
					render();
				});
				group.addEventListener("dblclick", event => {
					event.stopPropagation();
					inputDialogue({
						title: "Connector label", value: connector.text || "", confirmation: (_, value) => {
							connector.text = value;
							render();
						}
					});
				});
				linesLayer.append(group);
			});
		};

		const shapeSvg = item => {
			const shape = svg("svg", {viewBox: `0 0 ${item.w} ${item.h}`, preserveAspectRatio: "none"});
			let node;
			if (item.kind === "ellipse") node = svg("ellipse", {
				cx: item.w / 2,
				cy: item.h / 2,
				rx: item.w / 2 - 2,
				ry: item.h / 2 - 2
			});
			else if (item.kind === "diamond") node = svg("polygon", {points: `${item.w / 2},2 ${item.w - 2},${item.h / 2} ${item.w / 2},${item.h - 2} 2,${item.h / 2}`});
			else node = svg("rect", {
					x: 2,
					y: 2,
					width: item.w - 4,
					height: item.h - 4,
					rx: item.kind === "rounded" ? 18 : 2
				});
			node.setAttribute("fill", item.style.fill);
			node.setAttribute("stroke", item.style.stroke);
			node.setAttribute("stroke-width", "2");
			shape.append(node);
			return shape;
		};

		const updateDrawPreview = point => {
			if (!drawStart || !drawPreview) return;
			const x = Math.min(drawStart.x, point.x), y = Math.min(drawStart.y, point.y),
				w = Math.max(80, Math.abs(point.x - drawStart.x)), h = Math.max(36, Math.abs(point.y - drawStart.y));
			Object.assign(drawPreview.style, {
				left: `${x}px`,
				top: `${y}px`,
				width: `${w}px`,
				height: `${h}px`
			});
			if (drawPreview.dataset.type === "shape") {
				const previewShape = shapeSvg({
					kind: drawPreview.dataset.kind,
					w,
					h,
					style: currentStyle
				});
				drawPreview.replaceChildren(previewShape);
			}
		};

		const beginDrawPreview = point => {
			const isText = activeTool === "text";
			drawPreview = document.createElement("div");
			drawPreview.className = `charts-item charts-draw-preview charts-${isText ? "text" : "shape"}`;
			drawPreview.dataset.type = isText ? "text" : "shape";
			drawPreview.dataset.kind = isText ? "rectangle" : activeTool.slice(6);
			if (isText) {
				const text = document.createElement("div");
				text.className = "charts-item-text";
				text.textContent = "Text";
				drawPreview.append(text);
			}
			itemsLayer.append(drawPreview);
			updateDrawPreview(point);
		};

		const renderItems = () => {
			itemsLayer.innerHTML = "";
			documentState.items.forEach(item => {
				const el = document.createElement("div");
				el.className = `charts-item charts-${item.type}${selected.has(item.id) ? " selected" : ""}`;
				el.dataset.id = item.id;
				Object.assign(el.style, {
					left: `${item.x}px`,
					top: `${item.y}px`,
					width: `${item.w}px`,
					height: `${item.h}px`
				});
				if (item.type === "shape") el.append(shapeSvg(item));
				if (item.type === "image") {
					const image = new Image();
					image.src = item.src;
					image.draggable = false;
					el.append(image);
				}
				if (item.type !== "image") {
					const text = document.createElement("div");
					text.className = "charts-item-text";
					text.textContent = item.text || "";
					Object.assign(text.style, {
						fontFamily: item.style.fontFamily,
						fontSize: `${item.style.fontSize}px`,
						fontWeight: item.style.bold ? "700" : "400",
						fontStyle: item.style.italic ? "italic" : "normal",
						textDecoration: item.style.underline ? "underline" : "none",
						color: item.style.textColor,
						textAlign: item.style.align
					});
					el.append(text);
				}
				["top", "right", "bottom", "left"].forEach(vertex => {
					const dot = document.createElement("button");
					dot.className = `charts-vertex charts-vertex-${vertex}`;
					dot.dataset.vertex = vertex;
					dot.title = "Connect";
					el.append(dot);
				});
				if (selected.has(item.id)) ["nw", "ne", "se", "sw"].forEach(handle => {
					const control = document.createElement("span");
					control.className = `charts-resize charts-resize-${handle}`;
					control.dataset.resize = handle;
					el.append(control);
				});
				el.addEventListener("pointerdown", event => itemPointerDown(event, item));
				el.addEventListener("dblclick", event => {
					if (!event.target.closest(".charts-vertex,.charts-resize")) beginTextEdit(item, el);
				});
				itemsLayer.append(el);
			});
		};

		const render = () => {
			root.querySelector('[data-action="background"]').value = documentState.background;
			const connectorStyleControl = root.querySelector("#charts-connector-style");
			if (connectorStyleControl) {
				connectorStyleControl.value = documentState.connectorStyle;
				const selectedOption = CONNECTOR_STYLE_OPTIONS.find(option => option.value === documentState.connectorStyle) || CONNECTOR_STYLE_OPTIONS[0];
				connectorStyleControl.querySelector(".plastic-dropdown-label").textContent = selectedOption.label;
			}
			stage.style.backgroundColor = documentState.background;
			applyViewport();
			renderLines();
			renderItems();
		};

		const addItem = (type, kind = "rectangle", extra = {}) => {
			const center = screenToWorld(stage.getBoundingClientRect().left + stage.clientWidth / 2, stage.getBoundingClientRect().top + stage.clientHeight / 2);
			const item = {
				id: uid("item"),
				type,
				kind,
				x: center.x - 80,
				y: center.y - 45,
				w: type === "text" ? 220 : 160,
				h: type === "text" ? 55 : 90,
				text: type === "text" ? "Text" : "",
				style: {...currentStyle}, ...extra
			};
			documentState.items.push(item);
			selected = new Set([item.id]);
			render();
		};

		const beginTextEdit = (item, el) => {
			if (item.type === "image") return;
			editing?.remove();
			const textNode = el.querySelector(".charts-item-text");
			const input = document.createElement("textarea");
			input.className = "charts-text-editor";
			input.value = item.text || "";
			textNode.style.display = "none";
			el.append(input);
			editing = input;
			input.focus();
			input.select();
			const finish = () => {
				item.text = input.value;
				editing = null;
				render();
			};
			input.addEventListener("blur", finish, {once: true});
			input.addEventListener("keydown", event => {
				if (event.key === "Escape" || (event.key === "Enter" && !event.shiftKey)) {
					event.preventDefault();
					input.blur();
				}
			});
		};

		const itemPointerDown = (event, item) => {
			if (event.button !== 0) return;
			event.stopPropagation();
			const vertex = event.target.closest(".charts-vertex")?.dataset.vertex;
			if (vertex) {
				if (connectorDraft && connectorDraft.from.itemId !== item.id) {
					documentState.connectors.push({
						id: uid("conn"),
						from: connectorDraft.from,
						to: {itemId: item.id, vertex},
						text: ""
					});
					connectorDraft = null;
					render();
					return;
				}
				connectorDraft = {from: {itemId: item.id, vertex}, pointerId: event.pointerId};
				event.target.setPointerCapture?.(event.pointerId);
				event.target.classList.add("connecting");
				return;
			}
			const handle = event.target.closest(".charts-resize")?.dataset.resize;
			if (!event.ctrlKey && !event.metaKey && !selected.has(item.id)) selected = new Set([item.id]); else if (event.ctrlKey || event.metaKey) selected.has(item.id) ? selected.delete(item.id) : selected.add(item.id);
			if (handle) resize = {
				item,
				start: screenToWorld(event.clientX, event.clientY),
				x: item.x,
				y: item.y,
				w: item.w,
				h: item.h,
				handle
			};
			else drag = {
				start: screenToWorld(event.clientX, event.clientY),
				originals: documentState.items.filter(i => selected.has(i.id)).map(i => ({item: i, x: i.x, y: i.y}))
			};
			render();
			stage.setPointerCapture?.(event.pointerId);
		};

		const finishConnector = event => {
			if (!connectorDraft) return;
			const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".charts-vertex");
			const itemEl = target?.closest(".charts-item");
			if (target && itemEl && itemEl.dataset.id !== connectorDraft.from.itemId) {
				documentState.connectors.push({
					id: uid("conn"),
					from: connectorDraft.from,
					to: {itemId: itemEl.dataset.id, vertex: target.dataset.vertex},
					text: ""
				});
				connectorDraft = null;
				render();
			}
		};

		const applyStyle = () => {
			documentState.items.filter(item => selected.has(item.id) && item.type !== "image").forEach(item => Object.assign(item.style, currentStyle));
			render();
		};

		const duplicateItem = item => {
			const clone = structuredClone(item);
			clone.id = uid("item");
			clone.x += 24;
			clone.y += 24;
			documentState.items.push(clone);
			selected = new Set([clone.id]);
			render();
		};

		const deleteItem = item => {
			documentState.items = documentState.items.filter(candidate => candidate.id !== item.id);
			documentState.connectors = documentState.connectors.filter(connector => connector.from.itemId !== item.id && connector.to.itemId !== item.id);
			selected.delete(item.id);
			render();
		};

		const buildItemMenu = item => {
			selected = new Set([item.id]);
			render();
			return [
				...(item.type !== "image" ? [{
					label: "Edit text",
					icon: TEXT_ICON,
					action: () => beginTextEdit(item, itemsLayer.querySelector(`[data-id="${item.id}"]`))
				}] : []),
				{label: "Duplicate", icon: window.Plastic.icons.duplicate, action: () => duplicateItem(item)},
				{
					label: "Bring to front",
					icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="m7 7 5-5 5 5M12 2v14M5 20h14"/></svg>`,
					action: () => {
						documentState.items = documentState.items.filter(i => i.id !== item.id).concat(item);
						render();
					}
				},
				"separator",
				{
					label: "Delete",
					icon: window.Plastic.icons.delete,
					destructive: true,
					action: () => deleteItem(item)
				}
			];
		};

		if (typeof stage.contextmenu === "function") stage.contextmenu((_, target) => {
			const item = itemById(target?.closest?.(".charts-item")?.dataset.id);
			return item ? buildItemMenu(item) : [];
		}, ".charts-item");

		const removeSelected = () => {
			documentState.items = documentState.items.filter(item => !selected.has(item.id));
			documentState.connectors = documentState.connectors.filter(c => !selected.has(c.id) && itemById(c.from.itemId) && itemById(c.to.itemId));
			selected.clear();
			render();
		};

		const copy = () => {
			clipboard = documentState.items.filter(item => selected.has(item.id)).map(item => structuredClone(item));
		};

		const paste = () => {
			if (!clipboard.length) return;
			const idMap = new Map();
			const pasted = clipboard.map(item => {
				const clone = structuredClone(item);
				idMap.set(item.id, uid("item"));
				clone.id = idMap.get(item.id);
				clone.x += 24;
				clone.y += 24;
				return clone;
			});
			documentState.items.push(...pasted);
			selected = new Set(pasted.map(i => i.id));
			clipboard = pasted.map(i => structuredClone(i));
			render();
		};

		stage.addEventListener("pointerdown", event => {
			if (event.target === stage || event.target === world || event.target === itemsLayer) {
				if (activeTool === "text" || activeTool.startsWith("shape:")) {
					drawStart = screenToWorld(event.clientX, event.clientY);
					beginDrawPreview(drawStart);
					stage.setPointerCapture?.(event.pointerId);
					return;
				}
				if (!event.shiftKey) selected.clear();
				pan = {x: event.clientX, y: event.clientY, vx: documentState.viewport.x, vy: documentState.viewport.y};
				stage.setPointerCapture?.(event.pointerId);
				render();
			}
		});

		stage.addEventListener("pointermove", event => {
			if (connectorDraft) return;
			const p = screenToWorld(event.clientX, event.clientY);
			if (drawStart && drawPreview) {
				updateDrawPreview(p);
			} else if (drag) {
				const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
				drag.originals.forEach(o => {
					o.item.x = o.x + dx;
					o.item.y = o.y + dy;
				});
				render();
			} else if (resize) {
				const dx = p.x - resize.start.x, dy = p.y - resize.start.y, i = resize.item;
				if (resize.handle.includes("e")) i.w = Math.max(40, resize.w + dx);
				if (resize.handle.includes("s")) i.h = Math.max(30, resize.h + dy);
				if (resize.handle.includes("w")) {
					i.x = resize.x + dx;
					i.w = Math.max(40, resize.w - dx);
				}
				if (resize.handle.includes("n")) {
					i.y = resize.y + dy;
					i.h = Math.max(30, resize.h - dy);
				}
				render();
			} else if (pan) {
				documentState.viewport.x = pan.vx + event.clientX - pan.x;
				documentState.viewport.y = pan.vy + event.clientY - pan.y;
				applyViewport();
			}
		});

		stage.addEventListener("pointerup", event => {
			if (drawStart && (activeTool === "text" || activeTool.startsWith("shape:"))) {
				const tool = activeTool, end = screenToWorld(event.clientX, event.clientY),
					x = Math.min(drawStart.x, end.x), y = Math.min(drawStart.y, end.y),
					w = Math.max(80, Math.abs(end.x - drawStart.x)), h = Math.max(36, Math.abs(end.y - drawStart.y)),
					isText = tool === "text", item = {
						id: uid("item"),
						type: isText ? "text" : "shape",
						kind: isText ? "rectangle" : tool.slice(6),
						x,
						y,
						w,
						h,
						text: isText ? "Text" : "",
						style: {...currentStyle}
					};
				documentState.items.push(item);
				selected = new Set([item.id]);
				drawPreview?.remove();
				drawPreview = null;
				drawStart = null;
				setTool("select");
				render();
				setTimeout(() => beginTextEdit(item, itemsLayer.querySelector(`[data-id="${item.id}"]`)), 0);
				return;
			}
			finishConnector(event);
			drag = pan = resize = null;
		});

		stage.addEventListener("pointercancel", () => {
			drawPreview?.remove();
			drawPreview = null;
			drawStart = null;
			drag = pan = resize = null;
		});

		stage.addEventListener("wheel", event => {
			event.preventDefault();
			const rect = stage.getBoundingClientRect(), v = documentState.viewport, old = v.scale,
				next = Math.min(3, Math.max(.25, old * Math.exp(-event.deltaY * .001)));
			const wx = (event.clientX - rect.left - v.x) / old, wy = (event.clientY - rect.top - v.y) / old;
			v.x = event.clientX - rect.left - wx * next;
			v.y = event.clientY - rect.top - wy * next;
			v.scale = next;
			applyViewport();
		}, {passive: false});

		const setTool = tool => {
			activeTool = tool;
			root.querySelectorAll(".charts-tool-button").forEach(button => button.classList.toggle("active", button.dataset.action === tool || tool.startsWith(`${button.dataset.action}:`)));
			stage.classList.toggle("charts-drawing", tool === "text" || tool.startsWith("shape:"));
		};

		const shapeButton = root.querySelector('[data-action="shape"]');
		shapeButton?.popoutmenu(window.Plastic.shapeOptions.map(option => ({
			label: option.label, icon: option.icon, action: () => {
				shapeButton.innerHTML = option.icon;
				setTool(`shape:${option.type}`);
			}
		})));

		root.querySelector('[data-action="text"]').onclick = () => setTool(activeTool === "text" ? "select" : "text");
		root.querySelector('[data-action="image"]').onclick = () => {
			setTool("image");
			imageInput.click();
		};

		imageInput.onchange = () => {
			const file = imageInput.files?.[0];
			if (!file) {
				setTool("select");
				return;
			}
			const reader = new FileReader();
			reader.onload = () => {
				addItem("image", "image", {src: reader.result, w: 240, h: 160});
				setTool("select");
			};
			reader.readAsDataURL(file);
			imageInput.value = "";
		};

		const fontFamilyInput = root.querySelector("#charts-font-family"),
			fontSizeInput = root.querySelector("#charts-font-size");
		fontFamilyInput?.addEventListener("change", () => {
			currentStyle.fontFamily = fontFamilyInput.dataset.searchComboboxSelectedValue || fontFamilyInput.value || "Inter";
			applyStyle();
		});
		fontSizeInput?.addEventListener("change", () => {
			currentStyle.fontSize = Math.min(96, Math.max(8, Number(fontSizeInput.dataset.searchComboboxSelectedValue || fontSizeInput.value) || 16));
			applyStyle();
		});

		root.querySelectorAll("[data-style]").forEach(control => control.addEventListener("change", () => {
			const key = control.dataset.style;
			currentStyle[key] = control.value;
			applyStyle();
		}));

		const alignButton = root.querySelector('[data-action="align"]');
		alignButton?.popoutmenu(Object.entries(ALIGN_ICONS).map(([value, icon]) => ({
			label: `Align ${value[0].toUpperCase()}${value.slice(1)}`,
			icon,
			action: () => {
				currentStyle.align = value;
				alignButton.innerHTML = icon;
				applyStyle();
			}
		})));

		root.querySelectorAll("[data-toggle]").forEach(control => control.onclick = () => {
			const key = control.dataset.toggle;
			currentStyle[key] = !currentStyle[key];
			control.classList.toggle("active", currentStyle[key]);
			applyStyle();
		});

		root.querySelector('[data-action="background"]').oninput = event => {
			documentState.background = event.target.value;
			render();
		};

		root.querySelector("#charts-connector-style").onchange = event => {
			documentState.connectorStyle = event.currentTarget.value || "straight";
			render();
		};

		stage.addEventListener("keydown", event => {
			if (editing) return;
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
				event.preventDefault();
				copy();
			}
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
				event.preventDefault();
				paste();
			}
			if (event.key === "Delete" || event.key === "Backspace") {
				event.preventDefault();
				removeSelected();
			}
		});

		activeController = {
			load: render, focusMatch: match => {
				const item = match?.item || (match?.connector && itemById(match.connector.from.itemId));
				if (!item) return;
				selected = new Set([match.item?.id || match.connector.id]);
				const rect = stage.getBoundingClientRect(), v = documentState.viewport;
				v.x = rect.width / 2 - (item.x + item.w / 2) * v.scale;
				v.y = rect.height / 2 - (item.y + item.h / 2) * v.scale;
				render();
				itemsLayer.querySelector(`[data-id="${item.id}"]`)?.classList.add("charts-search-hit");
			}
		};
		render();
		stage.focus();
	}

	async function renderChartsList() {
		try {
			const tree = await CLI.send("tree Charts");
			const files = Array.isArray(tree?.children) ? tree.children.filter(file => !file.children && /\.chrts$/i.test(file.name || "")) : [];
			if (!files.length) return `<div class="charts-empty faded">No charts</div>`;
			return files.map(file => `<div class="chart-file padded radius pointer hover-background hover-shadowed center" directive="${esc(file.path)}"><img class="large-icon contained" src="/icons/interfaces/charts.png"><div>${esc(file.name)}</div></div>`).join("");
		} catch (_) {
			return `<div class="faded small-padding">Charts folder not available yet.</div>`;
		}
	}

	function bindList(root) {
		refreshList = async () => {
			const list = root.querySelector(".charts-list");
			if (!list) return;
			list.innerHTML = await renderChartsList();
			list.querySelectorAll(".chart-file").forEach(file => file.onclick = () => openPath(file.getAttribute("directive")));
		};
		refreshList();
	}

	modular.register(new Service(SERVICE_ID, [new Portal({
		title: "Charts",
		hints: ["charts", "flowcharts", "diagrams"],
		dimensions: [1000, 720],
		horizontal_nav: true,
		centered_nav: true,
		maximized: true,
		icon: "/icons/interfaces/charts.png",
		svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.5h6A1.5 1.5 0 0 1 11.25 6v3A1.5 1.5 0 0 1 9.75 10.5h-6A1.5 1.5 0 0 1 2.25 9V6A1.5 1.5 0 0 1 3.75 4.5Zm10.5 9h6A1.5 1.5 0 0 1 21.75 15v3a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5v-3a1.5 1.5 0 0 1 1.5-1.5ZM11.25 7.5h3.375A3.375 3.375 0 0 1 18 10.875V13.5m0 0-2.25-2.25M18 13.5l2.25-2.25"/></svg>`,
		tools: [{title: "Save", icon: window.Plastic.icons.save, onclick: saveChart}, {
			title: "Print",
			icon: window.Plastic.icons.print,
			onclick: showPrintMenu
		}, {
			title: "Search",
			icon: window.Plastic.icons.search,
			onclick: event => showSearch(event.currentTarget)
		}, {
			title: "Export Mermaid",
			icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/></svg>`,
			onclick: exportMermaid
		}, {
			title: "New Chart",
			icon: window.Plastic.icons.create,
			onclick: () => {
				documentState = freshState();
				activePath = "";
				activeController?.load();
			}
		}],
		routes: [{
			text: "Edit",
			icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="m4 20 4-1 11-11-3-3L5 16l-1 4Z"/></svg>`,
			route: () => editorMarkup(),
			afterRender: windowBody => setupEditor(windowBody.querySelector(".charts-editor"))
		}, {
			text: "Charts",
			icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 16v-4m4 4V8m4 8v-6"/></svg>`,
			route: () => div({style: "charts-list large-padding-top", content: ""}),
			afterRender: bindList
		}]
	})]));
})();
