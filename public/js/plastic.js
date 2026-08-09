/**
 * Standard Computers LLC
 * Plastic UI is the Standard Computers Design System
 * It's malleable. Apply styles by change css vars in JavaScript
 */

/**
 * Element Effects/Controls
 */
HTMLElement.prototype.out = function () {
	let e = this;
	e.style.opacity = 1;
	let n = null;
	window.requestAnimationFrame(function i(o) {
		o -= n = n || o, e.style.opacity = 1 - Math.min(o / 50, 1), o < 50 ? window.requestAnimationFrame(i) : e.style.display = "none"
	})
};

HTMLElement.prototype.in = function () {
	let e = this;
	e.style.display = "block", e.style.opacity = 0;
	let i = null;
	window.requestAnimationFrame(function n(l) {
		l -= i = i || l, e.style.opacity = Math.min(l / 50, 1), l < 50 && window.requestAnimationFrame(n)
	})
};

Element.prototype.contextmenu = function (items, selector = null) {
	const ele = this;
	let lastClickedTarget = null;
	let menu = document.createElement("div");
	menu.className = "custom-context-menu hidden";
	const resolveItems = () => typeof items === "function" ? (items(ele, lastClickedTarget) || []) : (items || []);

	function buildMenu() {
		menu.innerHTML = "";
		let itemCount = 0;
		resolveItems().forEach(item => {
			if (typeof item?.visible === "function" && !item.visible(ele, lastClickedTarget)) return;
			if (item?.visible === false) return;
			if (item === "separator") {
				if (!itemCount) return;
				const hr = document.createElement("div");
				hr.style.height = "1px";
				hr.style.margin = "5px 0";
				hr.style.background = "var(--secondary-border)";
				menu.appendChild(hr);
				return;
			}
			itemCount += 1;
			const option = document.createElement("div");
			option.className = "context-menu-item";
			applyAltSyncProperty(option, item, ele, lastClickedTarget);
			applyHandleProperty(option, item, ele, lastClickedTarget);
			if (item.className) option.classList.add(...String(item.className).split(/\s+/).filter(Boolean));
			if (item.destructive) option.classList.add("text-red");
			const label = typeof item.label === "function" ? item.label(ele, lastClickedTarget) : item.label;
			if (item.content) {
				option.innerHTML = item.content;
			} else if (item.icon) {
				option.innerHTML = `${item.icon}<span>${label}</span>`;
			} else {
				option.textContent = label;
			}
			option.onclick = (e) => {
				e.preventDefault();
				e.stopPropagation();
				hideMenu();
				if (typeof item.action === "function") {
					let target = lastClickedTarget;
					if (selector && lastClickedTarget) {
						target = lastClickedTarget.closest(selector);
					}
					item.action(ele, e, target);
				}
			};
			menu.appendChild(option);
		});
		return itemCount;
	}

	function showMenu(x, y) {
		menu.__altSyncOwnerWindow = ele.closest?.(".draggable-window") || null;
		if (!buildMenu()) {
			hideMenu();
			return;
		}
		menu.style.left = x + "px";
		menu.style.top = y + "px";
		menu.classList.remove("hidden");
		menu.in();
		requestAnimationFrame(() => {
			const rect = menu.getBoundingClientRect();
			if (rect.right > window.innerWidth) {
				menu.style.left = (x - rect.width) + "px";
			}
			if (rect.bottom > window.innerHeight) {
				menu.style.top = (y - rect.height) + "px";
			}
		});
		menu.addEventListener("mouseleave", _ => menu.out());
	}

	function hideMenu() {
		menu.classList.add("hidden");
		menu.style.display = "none";
		menu.style.opacity = 0;
	}

	document.body.appendChild(menu);
	ele.addEventListener("contextmenu", (e) => {
		lastClickedTarget = e.target;
		if (!buildMenu()) return;
		e.preventDefault();
		showMenu(e.clientX, e.clientY);
	});
	document.addEventListener("click", hideMenu);
};

Element.prototype.popoutmenu = function (items, selector = null) {
	const ele = this;
	let lastClickedTarget = null;
	let selectedIndex = -1;
	let menu = document.createElement("div");
	menu.className = "custom-context-menu hidden";
	menu.setAttribute("role", "menu");
	const resolveItems = () => typeof items === "function" ? (items(ele, lastClickedTarget) || []) : (items || []);
	const menuOptions = () => Array.from(menu.querySelectorAll(".context-menu-item"));

	function updateSelection(index) {
		const options = menuOptions();
		if (!options.length) {
			selectedIndex = -1;
			return;
		}
		selectedIndex = ((index % options.length) + options.length) % options.length;
		options.forEach((option, optionIndex) => {
			const selected = optionIndex === selectedIndex;
			option.classList.toggle("selected", selected);
			option.setAttribute("aria-selected", String(selected));
			if (selected) option.scrollIntoView({block: "nearest"});
		});
	}

	function buildMenu() {
		menu.innerHTML = "";
		selectedIndex = -1;
		resolveItems().forEach(item => {
			if (item === "separator") {
				const hr = document.createElement("div");
				hr.style.height = "1px";
				hr.style.margin = "5px 0";
				hr.style.background = "var(--secondary-border)";
				menu.appendChild(hr);
				return;
			}
			const option = document.createElement("div");
			option.className = "context-menu-item";
			option.setAttribute("role", "menuitem");
			applyAltSyncProperty(option, item, ele, lastClickedTarget);
			applyHandleProperty(option, item, ele, lastClickedTarget);
			if (item.className) option.classList.add(...String(item.className).split(/\s+/).filter(Boolean));
			if (item.destructive) option.classList.add("text-red");
			if (item.content) {
				option.innerHTML = item.content;
			} else if (item.icon) {
				option.innerHTML = `${item.icon}<span>${item.label}</span>`;
			} else {
				option.textContent = item.label;
			}
			option.onclick = (e) => {
				const interactiveTarget = e.target.closest('button, a, input, select, textarea, [contenteditable="true"]');
				if (item.interactive && interactiveTarget && option.contains(interactiveTarget)) return;
				e.preventDefault();
				e.stopPropagation();
				hideMenu();
				if (typeof item.action === "function") {
					let target = lastClickedTarget;
					if (selector && lastClickedTarget) {
						target = lastClickedTarget.closest(selector);
					}
					item.action(ele, e, target);
				}
			};
			option.addEventListener("pointerenter", () => updateSelection(menuOptions().indexOf(option)));
			menu.appendChild(option);
			if (typeof item.bind === "function") item.bind(option, ele, lastClickedTarget, menu, hideMenu);
		});
	}

	function showMenu(x, y) {
		menu.__altSyncOwnerWindow = ele.closest?.(".draggable-window") || null;
		buildMenu();
		menu.style.left = x + "px";
		menu.style.top = y + "px";
		menu.classList.remove("hidden");
		menu.in();
		ele.setAttribute("aria-expanded", "true");
		updateSelection(0);
		requestAnimationFrame(() => {
			const rect = menu.getBoundingClientRect();
			if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + "px";
			if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + "px";
		});
		menu.addEventListener("mouseleave", _ => {
			selectedIndex = -1;
			ele.setAttribute("aria-expanded", "false");
			menu.out();
		});
	}

	function hideMenu() {
		menu.classList.add("hidden");
		menu.style.display = "none";
		menu.style.opacity = 0;
		selectedIndex = -1;
		ele.setAttribute("aria-expanded", "false");
	}

	function handleMenuKeydown(event) {
		if (menu.classList.contains("hidden") || menu.style.display === "none") return;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			event.stopPropagation();
			updateSelection(selectedIndex + (event.key === "ArrowDown" ? 1 : -1));
			return;
		}
		if (event.key === "Enter") {
			const option = menuOptions()[selectedIndex];
			if (!option) return;
			event.preventDefault();
			event.stopPropagation();
			option.click();
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			hideMenu();
			ele.focus?.();
		}
	}

	document.body.appendChild(menu);
	ele.addEventListener("click", (e) => {
		const interactiveTarget = e.target.closest('[data-onclick-id], [data-ondblclick-id], button, a, input, select, textarea, [contenteditable="true"]');
		if (interactiveTarget && interactiveTarget !== ele && ele.contains(interactiveTarget)) return;
		e.stopPropagation();
		lastClickedTarget = e.target;
		const anchor = ele.getBoundingClientRect();
		const keyboardActivated = e.detail === 0;
		showMenu(keyboardActivated ? anchor.left : e.clientX, keyboardActivated ? anchor.bottom : e.clientY);
	});
	document.addEventListener("keydown", handleMenuKeydown, true);
	document.addEventListener("click", (e) => {
		if (!menu.contains(e.target)) hideMenu();
	});
};

/**
 * Anchored, keyboard-navigable suggestions for text inputs.
 * Items may be strings or {label, value, description} objects.
 */
Element.prototype.autocompleteMenu = function (options = {}) {

	const input = this;
	const menu = document.createElement("div");
	const listId = options.id || `autocomplete-menu-${Math.random().toString(36).slice(2)}`;
	let items = [];
	let selectedIndex = -1;
	let open = false;
	menu.id = listId;
	menu.className = `custom-context-menu autocomplete-context-menu hidden${options.className ? ` ${options.className}` : ""}`;
	menu.setAttribute("role", "listbox");
	input.setAttribute("aria-autocomplete", "list");
	input.setAttribute("aria-controls", listId);
	input.setAttribute("aria-expanded", "false");

	const normalizeItem = item => typeof item === "string" ? {label: item, value: item} : {
		...item,
		label: `${item?.label ?? item?.value ?? ""}`,
		value: `${item?.value ?? item?.label ?? ""}`
	};

	const positionMenu = () => {
		if (!open) return;
		const rect = input.getBoundingClientRect();
		const gap = Number.isFinite(options.gap) ? options.gap : 6;
		const viewportMargin = 8;
		const availableWidth = window.innerWidth - (viewportMargin * 2);
		const matchAnchorWidth = options.matchAnchorWidth !== false;
		const minimumWidth = matchAnchorWidth ? Math.max(rect.width, options.minWidth || 0) : (options.minWidth || 0);
		menu.style.width = matchAnchorWidth ? "auto" : "max-content";
		menu.style.minWidth = `${Math.min(availableWidth, minimumWidth)}px`;
		menu.style.maxWidth = `${Math.max(180, Math.min(options.maxWidth || 520, availableWidth))}px`;
		menu.style.left = `${Math.max(viewportMargin, Math.min(rect.left, window.innerWidth - menu.offsetWidth - viewportMargin))}px`;
		const below = rect.bottom + gap;
		const above = rect.top - menu.offsetHeight - gap;
		const preferAbove = options.placement === "above";
		menu.style.top = `${preferAbove || below + menu.offsetHeight > window.innerHeight - viewportMargin ? Math.max(viewportMargin, above) : below}px`;
	};

	const updateSelection = index => {
		if (!items.length) {
			selectedIndex = -1;
			input.removeAttribute("aria-activedescendant");
			return;
		}
		selectedIndex = ((index % items.length) + items.length) % items.length;
		Array.from(menu.children).forEach((node, nodeIndex) => {
			const selected = nodeIndex === selectedIndex;
			node.classList.toggle("selected", selected);
			node.setAttribute("aria-selected", `${selected}`);
			if (selected) {
				input.setAttribute("aria-activedescendant", node.id);
				node.scrollIntoView({block: "nearest"});
			}
		});
	};

	const hide = () => {
		open = false;
		menu.classList.add("hidden");
		menu.style.display = "none";
		input.setAttribute("aria-expanded", "false");
		input.removeAttribute("aria-activedescendant");
	};

	const select = (index = selectedIndex) => {
		if (!items.length) return false;
		const item = items[index < 0 ? 0 : index];
		hide();
		if (typeof options.onSelect === "function") options.onSelect(item, input);
		else input.value = item.value;
		input.focus();
		return true;
	};

	const render = () => {
		menu.innerHTML = "";
		items.forEach((item, index) => {
			const option = document.createElement("div");
			const label = document.createElement("span");
			option.id = `${listId}-option-${index}`;
			option.className = "context-menu-item autocomplete-context-menu-item";
			option.setAttribute("role", "option");
			label.className = "autocomplete-context-menu-label";
			label.textContent = item.label;
			option.appendChild(label);
			if (item.description) {
				const description = document.createElement("span");
				description.className = "autocomplete-context-menu-description";
				description.textContent = item.description;
				option.appendChild(description);
			}
			option.addEventListener("pointerenter", () => updateSelection(index));
			option.addEventListener("mousedown", event => event.preventDefault());
			option.addEventListener("click", event => {
				event.preventDefault();
				event.stopPropagation();
				select(index);
			});
			menu.appendChild(option);
		});
	};

	const setItems = nextItems => {
		items = (nextItems || []).map(normalizeItem).filter(item => item.value);
		if (!items.length) {
			hide();
			return;
		}
		render();
		open = true;
		menu.style.display = "block";
		menu.classList.remove("hidden");
		input.setAttribute("aria-expanded", "true");
		updateSelection(0);
		requestAnimationFrame(positionMenu);
	};

	const handleKeydown = event => {
		if (!open) return false;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			updateSelection(selectedIndex + (event.key === "ArrowDown" ? 1 : -1));
			return true;
		}
		if (event.key === "Enter" || event.key === "Tab") {
			event.preventDefault();
			return select();
		}
		if (event.key === "Escape") {
			event.preventDefault();
			hide();
			return true;
		}
		return false;
	};

	const handleDocumentPointer = event => {
		if (event.target !== input && !menu.contains(event.target)) hide();
	};

	const destroy = () => {
		hide();
		menu.remove();
		input.removeAttribute("aria-autocomplete");
		input.removeAttribute("aria-controls");
		input.removeAttribute("aria-expanded");
		document.removeEventListener("pointerdown", handleDocumentPointer);
		window.removeEventListener("resize", positionMenu);
		window.removeEventListener("scroll", positionMenu, true);
	};

	document.body.appendChild(menu);
	document.addEventListener("pointerdown", handleDocumentPointer);
	window.addEventListener("resize", positionMenu);
	window.addEventListener("scroll", positionMenu, true);
	return {destroy, handleKeydown, hide, isOpen: () => open, select, setItems};
};

Element.prototype.empty = function () {
	for (; this.firstChild;) this.removeChild(this.firstChild)
};

Element.prototype.remove = function () {
	this.parentNode && this.parentNode.removeChild(this)
};

Element.prototype.prepend = function () {
	for (let t = 0; t < arguments.length; t++) {
		let e = arguments[t];
		if ("string" == typeof e) {
			let i = document.createElement("div");
			for (i.innerHTML = e.trim(); i.firstChild;) this.insertBefore(i.firstChild, this.firstChild)
		} else this.insertBefore(e, this.firstChild)
	}
};

Element.prototype.append = function () {
	for (let e = 0; e < arguments.length; e++) {
		let t = arguments[e];
		if ("string" == typeof t) {
			let i = document.createElement("div");
			for (i.innerHTML = t.trim(); i.firstChild;) this.appendChild(i.firstChild)
		} else this.appendChild(t)
	}
};

Element.prototype.animate = function (n, t, o, c) {
	let f = performance.now(), i = this, a = {}, e = {}, u = Object.keys(n);
	u.forEach(function (t) {
		a[t] = parseFloat(getComputedStyle(i)[t]), e[t] = parseFloat(n[t])
	}), "function" != typeof o && (o = function (n) {
		return n
	}), requestAnimationFrame(function n() {
		var r = performance.now() - f, p = o(r = Math.min(1, r / t));
		u.forEach(function (n) {
			var t = a[n];
			t += (e[n] - t) * p, i.style[n] = t + ("opacity" === n ? "" : "px")
		}), r < 1 ? requestAnimationFrame(n) : "function" == typeof c && c.call(i)
	})
};

Element.prototype.keydown = function (n) {
	let e, o = Date.now();
	this.addEventListener("keydown", t => {
		clearTimeout(e), o = Date.now(), e = setTimeout(() => {
			let e = Date.now(), w = e - o;
			w >= 600 && n(t)
		}, 600)
	})
};

Element.prototype.keyup = function (e) {
	let t, n = Date.now();
	this.addEventListener("keyup", o => {
		clearTimeout(t), n = Date.now(), t = setTimeout(() => {
			let t = Date.now(), p = t - n;
			p >= 200 && e(o)
		}, 200)
	})
};

/**
 * Building Elements
 */
function applyCommonAttributes(el, n) {
	if (!n) return;
	const altSync = n.altSync ?? n.altsync ?? n.alt_sync ?? n["alt-sync"];
	if (altSync !== undefined && altSync !== null && `${altSync}`.trim()) el.setAttribute("alt-sync", `${altSync}`.trim());
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
	if (n.handle !== undefined && n.handle !== null) el.setAttribute("handle", String(n.handle));
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
	applyCommonAttributes(el, n);
	if (n.src) el.src = n.src;
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

function emptyState(n = {}) {
	return div({
		id: n.id,
		style: n.style || "empty-state",
		content: children([
			n.icon ? img({src: n.icon, style: n.iconStyle || "empty-state-icon", alt: n.iconAlt || ""}) : "",
			div({style: n.labelStyle || "empty-state-label", content: n.label || ""})
		])
	});
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
const dropdownPayloads = {};
let dropdownIndex = 0;
let segmentedIndex = 0;
let openDropdown = null;
let openDropdownMenu = null;
let openDropdownOptionIndex = -1;
function escapeHtml(value) {
	return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function hideDropdownMenu({focus = false} = {}) {
	if (!openDropdown) return;
	openDropdown.setAttribute("aria-expanded", "false");
	openDropdownMenu?.remove();
	const previousDropdown = openDropdown;
	openDropdown = null;
	openDropdownMenu = null;
	openDropdownOptionIndex = -1;
	if (focus) previousDropdown.focus();
}

function positionDropdownMenu() {
	if (!openDropdown || !openDropdownMenu) return;
	const anchorRect = openDropdown.getBoundingClientRect();
	const viewportMargin = 8;
	const gap = 6;
	openDropdownMenu.style.minWidth = `${anchorRect.width}px`;
	openDropdownMenu.style.left = `${Math.max(viewportMargin, Math.min(anchorRect.left, window.innerWidth - openDropdownMenu.offsetWidth - viewportMargin))}px`;
	const below = anchorRect.bottom + gap;
	const above = anchorRect.top - openDropdownMenu.offsetHeight - gap;
	openDropdownMenu.style.top = `${below + openDropdownMenu.offsetHeight > window.innerHeight - viewportMargin ? Math.max(viewportMargin, above) : below}px`;
}

function updateDropdownOption(index) {
	if (!openDropdownMenu?.children.length) return;
	const options = Array.from(openDropdownMenu.children);
	openDropdownOptionIndex = ((index % options.length) + options.length) % options.length;
	options.forEach((option, optionIndex) => {
		const selected = optionIndex === openDropdownOptionIndex;
		option.classList.toggle("selected", selected);
		option.setAttribute("aria-selected", `${selected}`);
		if (selected) option.scrollIntoView({block: "nearest"});
	});
}

function selectDropdownOption(dropdown, optionIndex) {
	const dropdownId = dropdown?.getAttribute("data-plastic-dropdown-id");
	const payload = dropdownPayloads[dropdownId];
	const option = payload?.options?.[optionIndex];
	if (!payload || !option) return;
	dropdown.value = option.value;
	dropdown.querySelector(".plastic-dropdown-label").textContent = option.label;
	hideDropdownMenu({focus: true});
	dropdown.dispatchEvent(new Event("change", {bubbles: true}));
}

function setDropdownOptions(dropdown, items = [], value = dropdown?.value) {
	const dropdownId = dropdown?.getAttribute("data-plastic-dropdown-id");
	const payload = dropdownPayloads[dropdownId];
	if (!dropdown || !payload) return;
	payload.options = (Array.isArray(items) ? items : []).map(item => ({
		label: `${item?.label ?? item?.value ?? ""}`,
		value: `${item?.value ?? item?.label ?? ""}`
	}));
	const selectedOption = payload.options.find(option => option.value === `${value ?? ""}`) || payload.options[0] || {label: "", value: ""};
	dropdown.value = selectedOption.value;
	const labelNode = dropdown.querySelector(".plastic-dropdown-label");
	if (labelNode) labelNode.textContent = selectedOption.label;
	if (openDropdown === dropdown) hideDropdownMenu();
}

function selectSegmentedOption(control, option, {focus = true, notify = true} = {}) {
	if (!control || !option || option.disabled || control.getAttribute("aria-disabled") === "true") return false;
	const options = Array.from(control.querySelectorAll(".plastic-segment"));
	const changed = option.getAttribute("aria-selected") !== "true";
	options.forEach((candidate) => {
		const selected = candidate === option;
		candidate.classList.toggle("selected", selected);
		candidate.setAttribute("aria-selected", `${selected}`);
		candidate.tabIndex = selected ? 0 : -1;
	});
	const value = option.getAttribute("data-plastic-segment-value") ?? "";
	control.setAttribute("value", value);
	control.value = value;
	if (focus) option.focus();
	if (notify && changed) {
		control.dispatchEvent(new CustomEvent("change", {
			bubbles: true,
			detail: {value, index: options.indexOf(option)}
		}));
	}
	return true;
}

function showDropdownMenu(dropdown) {
	const dropdownId = dropdown?.getAttribute("data-plastic-dropdown-id");
	const payload = dropdownPayloads[dropdownId];
	if (!payload?.options?.length) return;
	if (openDropdown === dropdown) {
		hideDropdownMenu({focus: true});
		return;
	}
	hideDropdownMenu();
	const menu = document.createElement("div");
	menu.className = "custom-context-menu plastic-dropdown-menu";
	menu.setAttribute("role", "listbox");
	if (dropdown.id) menu.setAttribute("aria-labelledby", dropdown.id);
	payload.options.forEach((option, optionIndex) => {
		const menuOption = document.createElement("div");
		menuOption.className = "context-menu-item";
		menuOption.setAttribute("role", "option");
		menuOption.setAttribute("data-plastic-dropdown-option", `${optionIndex}`);
		menuOption.textContent = option.label;
		menu.appendChild(menuOption);
	});
	document.body.appendChild(menu);
	openDropdown = dropdown;
	openDropdownMenu = menu;
	dropdown.setAttribute("aria-expanded", "true");
	const selectedIndex = payload.options.findIndex(option => option.value === dropdown.value);
	updateDropdownOption(selectedIndex < 0 ? 0 : selectedIndex);
	requestAnimationFrame(positionDropdownMenu);
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
	const segment = event.target.closest('[data-plastic-segment-value]');
	if (segment) {
		const control = segment.closest('[data-plastic-segmented]');
		if (control) {
			event.preventDefault();
			selectSegmentedOption(control, segment);
			return;
		}
	}

	const dropdownOption = event.target.closest('[data-plastic-dropdown-option]');
	if (dropdownOption && openDropdownMenu?.contains(dropdownOption)) {
		event.preventDefault();
		event.stopPropagation();
		selectDropdownOption(openDropdown, Number(dropdownOption.getAttribute("data-plastic-dropdown-option")));
		return;
	}

	const dropdown = event.target.closest('[data-plastic-dropdown-id]');
	if (dropdown) {
		event.preventDefault();
		showDropdownMenu(dropdown);
		return;
	}

	hideDropdownMenu();

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
	const formattedInput = event.target.closest('input[data-plastic-input]');
	if (formattedInput) {
		const formatter = formattedInput.getAttribute("data-plastic-input") === "phone" ? formatPhoneInputValue : formatDateInputValue;
		formattedInput.value = formatter(formattedInput.value);
	}
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
	const segment = event.target.closest('[data-plastic-segment-value]');
	if (segment && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
		const control = segment.closest('[data-plastic-segmented]');
		const options = Array.from(control?.querySelectorAll(".plastic-segment:not(:disabled)") || []);
		if (control && options.length) {
			event.preventDefault();
			const currentIndex = options.indexOf(segment);
			let nextIndex = currentIndex;
			if (event.key === "Home") nextIndex = 0;
			else if (event.key === "End") nextIndex = options.length - 1;
			else nextIndex = (currentIndex + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + options.length) % options.length;
			selectSegmentedOption(control, options[nextIndex]);
			return;
		}
	}
	const dropdown = event.target.closest('[data-plastic-dropdown-id]');
	if (dropdown) {
		if (event.key === "Escape") {
			event.preventDefault();
			hideDropdownMenu({focus: true});
			return;
		}
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (openDropdown !== dropdown) showDropdownMenu(dropdown);
			else updateDropdownOption(openDropdownOptionIndex + (event.key === "ArrowDown" ? 1 : -1));
			return;
		}
		if ((event.key === "Enter" || event.key === " ") && openDropdown === dropdown) {
			event.preventDefault();
			selectDropdownOption(dropdown, openDropdownOptionIndex);
			return;
		}
	}
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
	if (n.handle !== undefined && n.handle !== null) el.setAttribute("handle", String(n.handle));
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

function formatPhoneInputValue(value = "") {
	const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
	if (digits.length <= 1) return digits ? `+${digits}` : "";
	if (digits.length <= 4) return `+${digits[0]} (${digits.slice(1)}`;
	if (digits.length <= 7) return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4)}`;
	return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
}

function phoneInput(n = {}) {
	const el = document.createElement("input");
	applyCommonAttributes(el, n);
	el.type = "tel";
	el.inputMode = "tel";
	el.placeholder = n.placeholder || "+# (###) ###-####";
	el.value = formatPhoneInputValue(n.value);
	el.setAttribute("data-plastic-input", "phone");
	registerElementHandler(el, "onchange", n.onchange);
	return el.outerHTML;
}

function formatDateInputValue(value = "") {
	const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
	if (digits.length <= 2) return digits;
	if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
	return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function dateInput(n = {}) {
	const el = document.createElement("input");
	applyCommonAttributes(el, n);
	el.type = "text";
	el.inputMode = "numeric";
	el.placeholder = n.placeholder || "MM/DD/YYYY";
	el.value = formatDateInputValue(n.value);
	el.setAttribute("data-plastic-input", "date");
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

function dropdown(n = {}) {
	const dropdownId = `plastic-dropdown-${dropdownIndex++}`;
	const options = (Array.isArray(n.options) ? n.options : []).map(item => ({
		label: `${item?.label ?? item?.value ?? ""}`,
		value: `${item?.value ?? item?.label ?? ""}`
	}));
	const selectedOption = options.find(option => option.value === `${n.value ?? ""}`) || options[0] || {label: "", value: ""};
	const el = document.createElement("button");
	applyCommonAttributes(el, n);
	el.className = `${n.style || ""} secondary plastic-dropdown`.trim();
	el.type = "button";
	if (n.disabled) el.disabled = true;
	el.value = selectedOption.value;
	el.setAttribute("data-plastic-dropdown-id", dropdownId);
	el.setAttribute("role", "combobox");
	el.setAttribute("aria-haspopup", "listbox");
	el.setAttribute("aria-expanded", "false");
	if (n.ariaLabel) el.setAttribute("aria-label", n.ariaLabel);
	registerElementHandler(el, "onchange", n.onchange);
	const labelNode = document.createElement("span");
	labelNode.className = "plastic-dropdown-label";
	labelNode.textContent = selectedOption.label;
	const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	chevron.classList.add("plastic-dropdown-caret", "float-right");
	chevron.setAttribute("viewBox", "0 0 20 20");
	chevron.setAttribute("aria-hidden", "true");
	chevron.innerHTML = '<path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>';
	el.append(labelNode, chevron);
	dropdownPayloads[dropdownId] = {options};
	return el.outerHTML;
}

/**
 * Equal-width segmented selection control.
 * Options accept {label, value, icon, title, disabled}; icon may be SVG markup.
 */
function segmentedSelection(n = {}) {
	const control = document.createElement("div");
	const options = Array.isArray(n.options) ? n.options : [];
	const requestedValue = `${n.value ?? ""}`;
	let selectedIndex = options.findIndex(item => `${item?.value ?? item?.label ?? ""}` === requestedValue && !item?.disabled);
	if (selectedIndex < 0) selectedIndex = options.findIndex(item => !item?.disabled);

	applyCommonAttributes(control, n);
	control.className = `${n.style || ""} plastic-segmented`.trim();
	control.id = n.id || `plastic-segmented-${segmentedIndex++}`;
	control.setAttribute("data-plastic-segmented", "");
	control.setAttribute("role", "tablist");
	control.style.setProperty("--plastic-segment-count", Math.max(options.length, 1));
	if (n.ariaLabel) control.setAttribute("aria-label", n.ariaLabel);
	if (n.disabled) control.setAttribute("aria-disabled", "true");
	registerElementHandler(control, "onchange", n.onchange || n.onChange);

	options.forEach((item, optionIndex) => {
		const value = `${item?.value ?? item?.label ?? ""}`;
		const selected = optionIndex === selectedIndex;
		const option = document.createElement("button");
		option.type = "button";
		option.className = `plastic-segment${item?.icon ? " has-icon" : ""}${selected ? " selected" : ""}`;
		option.setAttribute("role", "tab");
		option.setAttribute("aria-selected", `${selected}`);
		option.setAttribute("data-plastic-segment-value", value);
		option.tabIndex = selected ? 0 : -1;
		option.disabled = Boolean(n.disabled || item?.disabled);
		if (item?.title) option.title = item.title;
		if (item?.ariaLabel) option.setAttribute("aria-label", item.ariaLabel);
		if (item?.icon) {
			const icon = document.createElement("span");
			icon.className = "plastic-segment-icon";
			icon.setAttribute("aria-hidden", "true");
			icon.innerHTML = item.icon;
			option.appendChild(icon);
		}
		const label = document.createElement("span");
		label.className = "plastic-segment-label";
		label.textContent = item?.label ?? value;
		option.appendChild(label);
		control.appendChild(option);
	});

	const selectedOption = options[selectedIndex];
	const selectedValue = selectedOption ? `${selectedOption?.value ?? selectedOption?.label ?? ""}` : "";
	control.setAttribute("value", selectedValue);
	return control.outerHTML;
}

function segmented(n = {}) {
	return segmentedSelection(n);
}

function searchbox(n = {}) {
	const searchboxId = `searchbox-${searchboxIndex++}`;
	const wrapper = document.createElement("div");
	wrapper.className = n.wrapperStyle ?? "searchbox-wrapper";
	const el = document.createElement("input");
	applyCommonAttributes(el, n);
	if (n.handle !== undefined && n.handle !== null) el.setAttribute("handle", String(n.handle));
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
		handle: n.handle,
		content: children([input({
			style: "ios-switch float-right",
			type: "checkbox",
			id: n.id,
			checked: n.checked,
			onchange: n.onchange
		}), label({input: n.id, content: n.content})])
	})
}

function inputDialogue(n) {
	document.querySelectorAll(".dialogue").forEach(d => d.remove());
	document.getElementById("cover").in();
	const locationPickerEnabled = n.location_picker === true;
	const dialogue = createMarkupNode(div({
		style: "dialogue padded",
		content: children([
			label({content: n.title}),
			(n.title_entry ? input({
				style: "undecorated",
				placeholder: n.titleholder,
				value: n.title_value,
				autofocus: true
			}) : ""),
			input({style: "undecorated", placeholder: n.placeholder, value: n.value, autofocus: true}),
			(locationPickerEnabled ? div({
				style: "input-dialogue-location small-margin-top margin-bottom",
				content: children([
					label({content: "Location"}),
					div({style: "faded small-margin-top", content: n.location || n.location_root || "Documents"}),
					div({style: "search-dialogue-results bordered radius padded", content: "Loading folders…"})
				])
			}) : ""),
			div({
				style: "float-right input-dialogue-actions", content: children([
					button({style: "undecorated space-right input-dialogue-cancel", content: "Cancel"}),
					button({style: "primary input-dialogue-confirm", content: "Confirm"})
				])
			})
		])
	}));
	document.querySelector("body").append(dialogue);
	const cancelButton = dialogue.querySelector(".input-dialogue-cancel");
	const confirmButton = dialogue.querySelector(".input-dialogue-confirm");
	const locationRoot = String(n.location_root || "Documents").replace(/^\/home\/standard-system\//, "").replace(/^\/+|\/+$/g, "") || "Documents";
	let selectedLocation = String(n.location || locationRoot).replace(/^\/home\/standard-system\//, "").replace(/^\/+|\/+$/g, "") || locationRoot;
	const locationNode = dialogue.querySelector(".input-dialogue-location");
	const locationLabel = locationNode?.querySelector(".faded");
	const locationResults = locationNode?.querySelector(".search-dialogue-results");
	let locationRequest = 0;
	const isDirectoryRecord = record => {
		if (Array.isArray(record?.children)) return true;
		return ["directory", "folder", "dir"].includes(String(record?.type || record?.kind || record?.entryType || "").toLowerCase());
	};
	const normalizeLocationPath = rawPath => String(rawPath || "").replace(/^\/home\/standard-system\//, "").replace(/^\/+|\/+$/g, "");
	const renderLocation = async directoryPath => {
		if (!locationResults || typeof window.CLI?.send !== "function") return;
		const nextLocation = normalizeLocationPath(directoryPath) || locationRoot;
		if (nextLocation !== locationRoot && !nextLocation.startsWith(`${locationRoot}/`)) return;
		selectedLocation = nextLocation;
		if (locationLabel) locationLabel.textContent = selectedLocation;
		locationResults.textContent = "Loading folders…";
		const request = ++locationRequest;
		try {
			const directory = await window.CLI.send(`tree ${selectedLocation}`);
			if (request !== locationRequest || !dialogue.isConnected) return;
			const folders = (Array.isArray(directory?.children) ? directory.children : [])
				.filter(isDirectoryRecord)
				.sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || "")));
			locationResults.replaceChildren();
			if (selectedLocation !== locationRoot) {
				const parentButton = document.createElement("button");
				parentButton.type = "button";
				parentButton.className = "search-dialogue-result";
				const parentButtonContent = document.createElement("span");
				parentButtonContent.innerHTML = `<svg class="small-icon tiny-margin-right" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"/></svg>`;
				parentButtonContent.append(document.createTextNode("Parent folder"));
				parentButton.append(parentButtonContent);
				parentButton.addEventListener("click", () => renderLocation(selectedLocation.split("/").slice(0, -1).join("/") || locationRoot));
				locationResults.append(parentButton);
			}
			folders.forEach(folder => {
				const folderPath = normalizeLocationPath(folder?.path) || `${selectedLocation}/${folder?.name || ""}`;
				const folderButton = document.createElement("button");
				folderButton.type = "button";
				folderButton.className = "search-dialogue-result";
				const folderButtonContent = document.createElement("span");
				const folderIcon = document.createElement("img");
				folderIcon.className = "small-icon tiny-margin-right";
				folderIcon.src = "/icons/folder.png";
				folderIcon.alt = "";
				folderIcon.setAttribute("aria-hidden", "true");
				folderButtonContent.append(folderIcon, document.createTextNode(folder?.name || folderPath.split("/").pop()));
				folderButton.append(folderButtonContent);
				folderButton.addEventListener("click", () => renderLocation(folderPath));
				locationResults.append(folderButton);
			});
			if (!locationResults.children.length) locationResults.textContent = "No folders here";
		} catch (_) {
			if (request !== locationRequest || !dialogue.isConnected) return;
			locationResults.textContent = "Unable to load folders";
		}
	};
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
		n.confirmation(input_title, input_content, selectedLocation);
	});
	document.addEventListener("keydown", dialogueKeydownHandler, true);
	dialogue.querySelector("input")?.focus();
	if (locationPickerEnabled) renderLocation(selectedLocation);
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
			div({style: "float-right search-dialogue-actions",
				content: children([
					button({style: "undecorated space-right", content: "Cancel"}),
					button({style: "primary", content: n.confirmText || "Confirm"})
				])
			})
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

		if (!matches.length) {
			const emptyNode = document.createElement("div");
			emptyNode.className = "search-dialogue-empty";
			emptyNode.textContent = n.noResultsText || "No matches";
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
	document.querySelector("body").append(div({style: "dialogue padded center medium-padding",
		content: children([
			h({level: 2, content: n.title}),
			blockquote({style: "margin-bottom", content: n.content}),
			button({style: "primary hover-shadowed brick fill fat small-margin-bottom " + (n.destructive ? "background-red border-red color-white faded" : ""),
				content: "Confirm", onclick: () => {
					document.querySelectorAll(".dialogue").forEach(d => d.out());
					document.getElementById("cover").out()
					n.confirmation();
				}
			}),
			button({style: "secondary space-right brick fill fat",
				content: "Cancel", onclick: () => {
					document.querySelectorAll(".dialogue").forEach(d => d.out());
					document.getElementById("cover").out()
				}
			})
		])
	}));
}

function alertDialogue(n = {}) {
	const options = typeof n === "string" ? {content: n} : n;
	document.querySelectorAll(".dialogue").forEach(d => d.remove());
	const cover = document.getElementById("cover");
	const previouslyFocused = document.activeElement;
	cover?.in();
	const dialogue = createMarkupNode(div({
		style: "dialogue padded center medium-padding",
		content: children([
			options.title ? h({level: 2, content: options.title}) : "",
			blockquote({style: "margin-bottom", content: options.content || ""}),
			button({style: "secondary brick fill fat", content: "Dismiss"})
		])
	}));
	dialogue.setAttribute("role", "alertdialog");
	dialogue.setAttribute("aria-modal", "true");
	const dismissButton = dialogue.querySelector("button");
	const closeDialogue = () => {
		document.removeEventListener("keydown", dialogueKeydownHandler, true);
		cover?.out();
		dialogue.remove();
		if (previouslyFocused?.isConnected) previouslyFocused.focus();
		if (typeof options.dismissal === "function") options.dismissal();
	};
	const dialogueKeydownHandler = (event) => {
		if (!dialogue.isConnected || event.key !== "Escape") return;
		event.preventDefault();
		closeDialogue();
	};
	dismissButton?.addEventListener("click", closeDialogue);
	document.querySelector("body").append(dialogue);
	document.addEventListener("keydown", dialogueKeydownHandler, true);
	dismissButton?.focus();
	return {close: closeDialogue, element: dialogue};
}

function colorPicker(n = {}) {
	const colors = Array.isArray(n.colors) ? n.colors : [];
	const styleClasses = (n.style || "").trim();
	const mergedStyle = `colors ${styleClasses}`.trim();
	return div({style: mergedStyle, id: n.id, content: () => {
			let cos = [];
			for (let i = 0; i < colors.length; i++) {
				const o = colors[i];
				cos.push(div({
					style: "color-option animated",
					background: o.color,
					primary: o.color,
					secondary: o.secondary,
					content: div({style: "color-name no-wrap hidden", content: o.name}),
					title: o.name
				}));
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
	const editorNode = createMarkupNode(div({
		style: "custom-context-menu editor-inline-style-menu", content: children([
			div({
				style: "editor-inline-style-header", content: children([
					div({style: "editor-inline-style-title", content: title}),
					button({
						style: "tiny", content: "Reset", onclick: (event) => {
							event.preventDefault();
							if (typeof n.onchange === "function") n.onchange({});
							removeInlineStyleEditor(false);
						}
					})
				])
			}),
			div({
				style: "editor-inline-style-row", content: children([
					button({
						style: activeStyle.fontWeight === "bold" ? "tiny primary naked" : "naked",
						icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 5.7519531 2.0039062 A 0.750075 0.750075 0 0 0 5.0019531 2.7539062 L 5.0019531 11.703125 A 0.750075 0.750075 0 0 0 5.0019531 11.757812 L 5.0078125 21.257812 A 0.750075 0.750075 0 0 0 5.7578125 22.007812 L 13.505859 22.007812 C 16.534311 22.007812 19.005859 19.536265 19.005859 16.507812 C 19.005859 14.261755 17.639043 12.332811 15.701172 11.480469 C 17.057796 10.528976 18.005859 9.0314614 18.005859 7.2558594 C 18.005859 4.3643887 15.645377 2.0039063 12.753906 2.0039062 L 5.7519531 2.0039062 z M 6.5019531 3.5039062 L 12.753906 3.5039062 C 14.834436 3.5039063 16.505859 5.17533 16.505859 7.2558594 C 16.505859 9.3363887 14.834436 11.007813 12.753906 11.007812 L 6.5019531 11.007812 L 6.5019531 3.5039062 z M 6.5019531 12.507812 L 12.753906 12.507812 L 13.505859 12.507812 C 15.723408 12.507812 17.505859 14.290264 17.505859 16.507812 C 17.505859 18.725361 15.723408 20.507812 13.505859 20.507812 L 6.5058594 20.507812 L 6.5019531 12.507812 z"/></svg>`,
						onclick: (event) => {
							event.preventDefault();
							activeStyle.fontWeight = activeStyle.fontWeight === "bold" ? "" : "bold";
							if (typeof n.onchange === "function") n.onchange({...activeStyle});
							removeInlineStyleEditor(false);
						}
					}),
					button({
						style: activeStyle.fontStyle === "italic" ? "tiny primary naked" : "naked",
						icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 10 2.0078125 L 10 3.5078125 L 10.75 3.5078125 L 13.119141 3.5078125 L 9.3417969 20.503906 L 6.7558594 20.503906 L 6.0058594 20.503906 L 6.0058594 22.003906 L 6.7558594 22.003906 L 13.255859 22.003906 L 14.005859 22.003906 L 14.005859 20.503906 L 13.255859 20.503906 L 10.878906 20.503906 L 14.65625 3.5078125 L 17.25 3.5078125 L 18 3.5078125 L 18 2.0078125 L 17.25 2.0078125 L 10.75 2.0078125 L 10 2.0078125 z"/></svg>`,
						onclick: (event) => {
							event.preventDefault();
							activeStyle.fontStyle = activeStyle.fontStyle === "italic" ? "" : "italic";
							if (typeof n.onchange === "function") n.onchange({...activeStyle});
							removeInlineStyleEditor(false);
						}
					}),
					button({
						style: activeStyle.textDecoration === "underline" ? "tiny primary naked" : "naked",
						icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 6.0058594 2 L 6.0058594 2.75 L 6.0058594 12.585938 C 6.0058594 15.618894 8.7446099 18.001953 12.003906 18.001953 C 15.263203 18.001953 18.003906 15.618893 18.003906 12.585938 L 18.003906 2.75 L 18.003906 2 L 16.503906 2 L 16.503906 2.75 L 16.503906 12.585938 C 16.503906 14.706981 14.54261 16.501953 12.003906 16.501953 C 9.4652032 16.501953 7.5058594 14.70698 7.5058594 12.585938 L 7.5058594 2.75 L 7.5058594 2 L 6.0058594 2 z M 4.9980469 20.003906 L 4.9980469 21.503906 L 5.7480469 21.503906 L 18.251953 21.503906 L 19.001953 21.503906 L 19.001953 20.003906 L 18.251953 20.003906 L 5.7480469 20.003906 L 4.9980469 20.003906 z"/></svg>`,
						onclick: (event) => {
							event.preventDefault();
							activeStyle.textDecoration = activeStyle.textDecoration === "underline" ? "" : "underline";
							if (typeof n.onchange === "function") n.onchange({...activeStyle});
							removeInlineStyleEditor(false);
						}
					}),
					select({
						style: "editor-inline-style-select", value: activeStyle.textAlign || "",
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
					select({
						style: "editor-inline-style-select",
						value: activeStyle.fontSize ? String(activeStyle.fontSize).replace(/px$/i, "") : "",
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
				])
			}),
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
	const svg = plasticSvgNode({
		attrs: {
			viewBox: `0 0 ${width} ${height}`,
			role: "img",
			"aria-label": title || "Chart"
		}
	});
	root.append(svg);
	return {root, svg, width, height};
}

function drawPlasticChartAxes(svg, width, height, inset = {}) {
	const left = inset.left ?? 42;
	const right = inset.right ?? 16;
	const top = inset.top ?? 20;
	const bottom = inset.bottom ?? 38;
	svg.append(plasticSvgNode({
		tag: "line",
		attrs: {x1: left, y1: top, x2: left, y2: height - bottom, class: "plastic-chart-axis"}
	}));
	svg.append(plasticSvgNode({
		tag: "line",
		attrs: {x1: left, y1: height - bottom, x2: width - right, y2: height - bottom, class: "plastic-chart-axis"}
	}));
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
		svg.append(appendPlasticSvgTitle(plasticSvgNode({
			tag: "rect",
			attrs: {
				x,
				y,
				width: barWidth,
				height: barHeight,
				rx: 3,
				fill: item.color,
				class: "plastic-chart-value-mark"
			}
		}), getPlasticChartItemTitle(item)));
		if (n.labelValues) appendPlasticValueLabel(svg, formatPlasticChartValue(item.value), x + (barWidth / 2), Math.max(plot.top + 12, y - 6));
		svg.append(plasticSvgNode({
			tag: "text",
			text: item.label,
			attrs: {x: x + (barWidth / 2), y: height - 14, class: "plastic-chart-label", "text-anchor": "middle"}
		}));
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
		svg.append(plasticSvgNode({
			tag: "polyline",
			attrs: {points: points.map((point) => `${point.x},${point.y}`).join(" "), class: "plastic-chart-line"}
		}));
	}
	points.forEach((point, index) => {
		svg.append(appendPlasticSvgTitle(plasticSvgNode({
			tag: "circle",
			attrs: {
				cx: point.x,
				cy: point.y,
				r: 4,
				fill: point.item.color || PLASTIC_CHART_COLORS[index % PLASTIC_CHART_COLORS.length],
				class: "plastic-chart-value-mark"
			}
		}), getPlasticChartItemTitle(point.item)));
		if (n.labelValues) appendPlasticValueLabel(svg, formatPlasticChartValue(point.item.value), point.x, Math.max(plot.top + 12, point.y - 8));
		svg.append(plasticSvgNode({
			tag: "text",
			text: point.item.label,
			attrs: {x: point.x, y: height - 14, class: "plastic-chart-label", "text-anchor": "middle"}
		}));
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
		svg.append(plasticSvgNode({
			tag: "polygon",
			attrs: {points: pathPoints.join(" "), class: "plastic-chart-area"}
		}));
		svg.append(plasticSvgNode({
			tag: "polyline",
			attrs: {points: points.map((point) => `${point.x},${point.y}`).join(" "), class: "plastic-chart-line"}
		}));
	}
	points.forEach((point, index) => {
		svg.append(appendPlasticSvgTitle(plasticSvgNode({
			tag: "circle",
			attrs: {
				cx: point.x,
				cy: point.y,
				r: 4,
				fill: point.item.color || PLASTIC_CHART_COLORS[index % PLASTIC_CHART_COLORS.length],
				class: "plastic-chart-value-mark"
			}
		}), getPlasticChartItemTitle(point.item)));
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
		svg.append(appendPlasticSvgTitle(plasticSvgNode({
			tag: "circle",
			attrs: {cx: x, cy: y, r: 5, fill: item.color, class: "plastic-chart-value-mark"}
		}), getPlasticChartItemTitle(item)));
		if (n.labelValues) appendPlasticValueLabel(svg, formatPlasticChartValue(item.value), x, Math.max(plot.top + 12, y - 8));
		svg.append(plasticSvgNode({
			tag: "text",
			text: item.label,
			attrs: {x, y: height - 14, class: "plastic-chart-label", "text-anchor": "middle"}
		}));
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
window.StandardPlastic.segmented = segmented;
window.StandardPlastic.segmentedSelection = segmentedSelection;
