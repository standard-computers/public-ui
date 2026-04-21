class Widget {
    #struct;
    #container;
    #widgetDiv;
    #windowBody;
    #initialRender;
    #activeRoute;
    #dragState;
    #pinButton;
    #pinIcon;
    #unpinIcon;
    #isPinned = false;
    #widgetId;
    #widgetIndex = 0;

    constructor(data) {
        this.#struct = data || {};
        this.#widgetId = data?.id;
        this.#widgetIndex = data?.index ?? 0;
        this.#container = document.body;
        this.#build();
    }

    setContext(widgetId, widgetIndex = 0) {
        this.#widgetId = widgetId;
        this.#widgetIndex = widgetIndex;
        this.#struct = {...this.#struct, id: widgetId, index: widgetIndex};
    }

    id() {
        return this.#widgetId;
    }

    index() {
        return this.#widgetIndex;
    }

    is(widgetId) {
        return this.#widgetId === widgetId;
    }

    isOpen() {
        return Boolean(this.#widgetDiv?.parentElement);
    }

    #syncDescendantDimensions(root) {
        if (!root) return;
        const excludedTags = new Set(['IMG', 'SVG', 'PATH', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'LABEL', 'SPAN', 'A', 'CANVAS']);
        Array.from(root.children || []).forEach((child) => {
            if (!(child instanceof HTMLElement)) return;
            if (!excludedTags.has(child.tagName)) {
                child.style.minWidth = '0';
                child.style.maxWidth = '100%';
            }
            this.#syncDescendantDimensions(child);
        });
    }

    element() {
        return this.#widgetDiv;
    }

    #build() {
        const {
            title,
            dimensions,
            accent,
            background,
            foreground,
            icon,
            route,
            routes,
            navigation,
            horizontal_nav
        } = this.#struct;
        this.#widgetDiv = document.createElement('div');
        this.#widgetDiv.style.width = `${dimensions[0]}px`;
        this.#widgetDiv.classList.add('draggable-window', 'widget-window');
        const navigationBar = document.createElement('div');
        navigationBar.className = horizontal_nav ? 'window-topbar' : 'window-sidebar';
        const header = document.createElement('div');
        header.className = 'window-header';
        const titleElement = document.createElement("div");
        titleElement.className = 'title';
        if(this.#struct.show_title !== false) titleElement.innerHTML = title || '';
        if (accent) titleElement.style.color = accent;
        header.appendChild(titleElement);
        if (icon) {
            if (icon.startsWith("https") || icon.startsWith("/")) {
                const img = document.createElement('img');
                img.src = icon;
                img.alt = title;
                img.className = 'window-icon';
                header.prepend(img);
            } else {
                const parser = new DOMParser();
                const doc = parser.parseFromString(icon, "image/svg+xml");
                const s = doc.documentElement;
                if (accent) s.style.stroke = accent;
                s.classList.add('window-icon');
                header.prepend(s);
            }
        }
        this.#pinButton = document.createElement('div');
        this.#pinButton.classList.add('closer', 'pin-button');
        this.#pinIcon = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 16v5M8 5.292c0-.271 0-.407.013-.52a2 2 0 0 1 1.758-1.759c.114-.013.25-.013.52-.013h3.417c.271 0 .407 0 .52.013a2 2 0 0 1 1.759 1.758c.013.114.013.25.013.52c0 .088 0 .131-.003.172a1 1 0 0 1-.48.774c-.034.021-.073.04-.15.08l-.262.13c-.403.202-.605.303-.737.459a1 1 0 0 0-.216.442c-.042.2.002.422.09.864L15 12h.333c.62 0 .93 0 1.185.068a2 2 0 0 1 1.414 1.414c.068.255.068.565.068 1.185c0 .31 0 .465-.034.592a1 1 0 0 1-.707.707c-.127.034-.282.034-.592.034H7.333c-.31 0-.465 0-.592-.034a1 1 0 0 1-.707-.707C6 15.132 6 14.977 6 14.667c0-.62 0-.93.068-1.185a2 2 0 0 1 1.414-1.414C7.737 12 8.047 12 8.667 12H9l.758-3.788c.088-.442.132-.663.09-.864a1 1 0 0 0-.216-.442c-.132-.156-.334-.257-.737-.459l-.262-.13a2 2 0 0 1-.15-.08a1 1 0 0 1-.48-.774C8 5.423 8 5.379 8 5.292"/></svg>`, "image/svg+xml").documentElement;
        this.#unpinIcon = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m3 21l5-5m5.259 2.871c-3.744-.85-7.28-4.386-8.13-8.13c-.135-.592-.202-.888-.007-1.369c.194-.48.433-.63.909-.927c1.076-.672 2.242-.886 3.451-.78c1.697.151 2.546.226 2.97.005c.423-.22.71-.736 1.286-1.767l.728-1.307c.48-.86.72-1.291 1.285-1.494s.905-.08 1.585.166a5.63 5.63 0 0 1 3.396 3.396c.246.68.369 1.02.166 1.585c-.203.564-.633.804-1.494 1.285l-1.337.745c-1.03.574-1.544.862-1.765 1.289c-.22.428-.14 1.258.02 2.918c.118 1.22-.085 2.394-.766 3.484c-.298.476-.447.714-.928.909c-.48.194-.777.127-1.37-.008" color="currentColor"/></svg>`, "image/svg+xml").documentElement;
        if (accent) {
            this.#pinIcon.style.stroke = accent;
            this.#unpinIcon.style.stroke = accent;
        }
        this.#pinButton.appendChild(this.#pinIcon);
        this.#pinButton.appendChild(this.#unpinIcon);
        this.#pinButton.addEventListener('click', () => this.#togglePinned());
        header.prepend(this.#pinButton);
        this.#setPinnedState(this.#isPinned);
        const exiter = document.createElement("div");
        exiter.classList.add('closer');
        exiter.addEventListener("click", () => this.hide());
        const closeIcon = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`, "image/svg+xml").documentElement;
        if (accent) closeIcon.style.stroke = accent;
        exiter.appendChild(closeIcon);
        header.prepend(exiter);
        const content = document.createElement('div');
        content.className = (route || horizontal_nav || (routes && routes.length <= 1) ? 'window-content' : 'window-content-barred');
        const windowBody = document.createElement('div');
        windowBody.className = 'window-body';
        windowBody.style.minHeight = `${dimensions[1]}px`;
        windowBody.style.maxHeight = `${dimensions[1]}px`;
        windowBody.style.height = `${dimensions[1]}px`;
        this.#windowBody = windowBody;
        const setActiveRoute = (routeContent, afterRender) => {
            this.#activeRoute = {route: routeContent, afterRender};
            this.#renderRouteContent(routeContent, afterRender);
        };
        if (routes && routes.length > 1 || navigation === true) {
            routes.forEach(navItem => {
                const navElement = document.createElement('div');
                navElement.className = 'sidebar-item';
                if (navItem.icon !== undefined && navItem.icon.startsWith("https")) {
                    const img = document.createElement('img');
                    img.src = navItem.icon;
                    img.alt = title;
                    img.className = 'sidebar-icon';
                    navElement.prepend(img);
                } else if (navItem.icon !== undefined && navItem.icon !== "") {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(navItem.icon, "image/svg+xml");
                    navElement.prepend(doc.documentElement);
                }
                const text = document.createElement('span');
                text.innerText = navItem.text;
                navElement.appendChild(text);
                navElement.addEventListener('click', () => {
                    this.#widgetDiv.querySelectorAll(".sidebar-item").forEach(v => v.classList.remove("active-route"));
                    navElement.classList.add("active-route");
                    const routeResolver = typeof navItem.route === "function" ? () => navItem.route(this.#struct) : () => navItem.route;
                    setActiveRoute(routeResolver, navItem.afterRender);
                });
                navigationBar.appendChild(navElement);
            });
            this.#initialRender = () => navigationBar.children[0].click();
            content.appendChild(navigationBar);
        } else {
            const routeResolver = typeof route === "function" ? () => route(this.#struct) : () => route;
            this.#initialRender = () => setActiveRoute(routeResolver, this.#struct.afterRender);
        }
        this.#widgetDiv.appendChild(header);
        content.appendChild(windowBody);
        this.#widgetDiv.appendChild(content);
        this.#makeDraggable(this.#widgetDiv, header);
        this.#widgetDiv.portal = this;
        if (background !== undefined) {
            this.#widgetDiv.style.background = background;
        }
        if (foreground !== undefined) {
            this.#widgetDiv.style.color = foreground;
            titleElement.style.color = foreground;
            const svgs = this.#widgetDiv.querySelectorAll('svg');
            svgs.forEach(svg => svg.fill = foreground);
        }
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        ['top', 'right', 'bottom', 'left', 'top-right', 'top-left', 'bottom-right', 'bottom-left'].forEach(position => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${position}`;
            resizer.appendChild(handle);
            handle.addEventListener('mousedown', (e) => {
                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = this.#widgetDiv.offsetWidth;
                const startHeight = this.#widgetDiv.offsetHeight;
                const startLeft = this.#widgetDiv.offsetLeft;
                const startTop = this.#widgetDiv.offsetTop;
                const content = this.#widgetDiv.querySelector('.window-body');
                const onMouseMove = (moveEvent) => {
                    const dx = moveEvent.clientX - startX;
                    const dy = moveEvent.clientY - startY;
                    if (position.includes('right')) {
                        const newWidth = Math.max(startWidth + dx, 180);
                        this.#widgetDiv.style.width = `${newWidth}px`;
                        content.style.width = `${newWidth}px`;
                    }
                    if (position.includes('bottom')) {
                        const newHeight = Math.max(startHeight + dy, 120);
                        this.#widgetDiv.style.height = `${newHeight}px`;
                        content.style.height = `${newHeight}px`;
                    }
                    if (position.includes('left')) {
                        const newWidth = Math.max(startWidth - dx, 180);
                        this.#widgetDiv.style.width = `${newWidth}px`;
                        this.#widgetDiv.style.left = `${startLeft + dx}px`;
                        content.style.width = `${newWidth}px`;
                    }
                    if (position.includes('top')) {
                        const newHeight = Math.max(startHeight - dy, 120);
                        this.#widgetDiv.style.height = `${newHeight}px`;
                        this.#widgetDiv.style.top = `${startTop + dy}px`;
                        content.style.height = `${newHeight}px`;
                    }
                    this.#syncDescendantDimensions(content);
                };
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    this.#persistWindowState({open: true});
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
        this.#widgetDiv.appendChild(resizer);
    }

    #makeDraggable(element, handle) {
        const dragState = {
            offsetX: 0, offsetY: 0, isDragging: false, disableSelection: (e) => {
                if (!(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                    e.preventDefault();
                }
            }
        };
        const getClientPosition = (event) => {
            if (event.touches && event.touches.length > 0) {
                return {x: event.touches[0].clientX, y: event.touches[0].clientY};
            }
            return {x: event.clientX, y: event.clientY};
        };
        const isInteractiveTarget = (target) => {
            return target?.closest('button, .closer, .resizer, [data-no-drag], a, input, textarea, select, option');
        };

        const startDrag = (e) => {
            if (this.#isPinned || isInteractiveTarget(e.target)) return;
            const {x, y} = getClientPosition(e);
            dragState.offsetX = x - element.offsetLeft;
            dragState.offsetY = y - element.offsetTop;
            dragState.isDragging = true;
            handle.style.cursor = 'grabbing';
            document.addEventListener('selectstart', dragState.disableSelection);
            if (e.cancelable) e.preventDefault();
        };
        const moveDrag = (e) => {
            if (dragState.isDragging && !this.#isPinned) {
                const {x, y} = getClientPosition(e);
                element.style.left = `${x - dragState.offsetX}px`;
                element.style.top = `${y - dragState.offsetY}px`;
                if (e.cancelable) e.preventDefault();
            }
        };
        const endDrag = () => {
            if (dragState.isDragging) {
                dragState.isDragging = false;
                handle.style.cursor = this.#isPinned ? 'default' : 'grab';
                document.removeEventListener('selectstart', dragState.disableSelection);
                this.#persistWindowState({open: true});
            }
        };
        handle.addEventListener('mousedown', startDrag);
        handle.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('mousemove', moveDrag);
        document.addEventListener('touchmove', moveDrag, {passive: false});
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
        document.addEventListener('touchcancel', endDrag);
        handle.style.cursor = 'grab';
        this.#dragState = {
            element, handle, ...dragState, onMouseDown: startDrag, onMouseMove: moveDrag, onMouseUp: endDrag
        };
    }

    #togglePinned() {
        this.#setPinnedState(!this.#isPinned);
        if (!this.#dragState) return;
        this.#dragState.isDragging = false;
        this.#dragState.handle.style.cursor = this.#isPinned ? 'default' : 'grab';
        document.removeEventListener('selectstart', this.#dragState.disableSelection);
        this.#persistWindowState();
    }

    show() {
        if (!this.#widgetDiv) {
            this.#build();
        }
        if (typeof windowStateManager?.applyToWidget === "function") {
            windowStateManager.applyToWidget(this).then(() => this.#persistWindowState({open: true}));
        }
        this.#container.appendChild(this.#widgetDiv);
        if (typeof modular?.bringToFront === "function") {
            modular.bringToFront(this.#widgetDiv);
        }
        if (this.#initialRender && this.#activeRoute === undefined) {
            requestAnimationFrame(() => this.#initialRender());
        }
        if (typeof modular?.dockWidgets === "function") {
            modular.dockWidgets();
        }
        this.#persistWindowState({open: true});
    }

    hide() {
        if (this.#widgetDiv?.parentElement) {
            this.#persistWindowState({open: false});
            this.#widgetDiv.remove();
            if (typeof modular?.dockWidgets === "function") {
                modular.dockWidgets();
            }
        }
    }

    setPosition(left, top, dockPosition) {
        if (!this.#widgetDiv) return;
        this.#widgetDiv.style.left = `${left}px`;
        this.#widgetDiv.style.top = `${top}px`;
        this.#persistWindowState({open: true, dockPosition: dockPosition || modular?.widgetDockPosition});
    }

    applyWindowState(state = {}) {
        if (!this.#widgetDiv) return;
        if (state.width) this.#widgetDiv.style.width = state.width;
        if (state.height) this.#widgetDiv.style.height = state.height;
        if (state.left) this.#widgetDiv.style.left = state.left;
        if (state.top) this.#widgetDiv.style.top = state.top;
        if (state.bodyHeight && this.#windowBody) {
            this.#windowBody.style.minHeight = state.bodyHeight;
            this.#windowBody.style.maxHeight = state.bodyHeight;
            this.#windowBody.style.height = state.bodyHeight;
        }
        this.#setPinnedState(state.pinned);
        if (state.dockPosition && typeof modular?.setWidgetDockPosition === "function") {
            modular.setWidgetDockPosition(state.dockPosition, {skipPersist: true});
        }
    }

    getDimensions() {
        const rect = this.#widgetDiv?.getBoundingClientRect();
        return {width: rect?.width || 0, height: rect?.height || 0};
    }

    #renderRouteContent(routeContent, afterRender) {
        const resolvedRoute = typeof routeContent === "function" ? routeContent() : routeContent;
        const runAfterRender = () => {
            if (typeof afterRender === "function") afterRender(this.#widgetDiv);
        };
        const applyContent = (content) => {
            if (content instanceof Node) {
                this.#windowBody.replaceChildren(content);
            } else {
                this.#windowBody.innerHTML = content ?? "";
            }
            runAfterRender();
        };
        if (resolvedRoute instanceof Promise) {
            resolvedRoute.then(applyContent).catch(_ => this.#windowBody.innerHTML = "Failed to load content");
        } else {
            applyContent(resolvedRoute);
        }
    }

    #setPinnedState(isPinned) {
        this.#isPinned = Boolean(isPinned);
        if (this.#dragState?.handle) {
            this.#dragState.handle.style.cursor = this.#isPinned ? 'default' : 'grab';
        }
        if (this.#pinIcon && this.#unpinIcon) {
            this.#pinIcon.style.display = this.#isPinned ? 'none' : 'block';
            this.#unpinIcon.style.display = this.#isPinned ? 'block' : 'none';
        }
    }

    #captureWindowState(extra = {}) {
        if (!this.#widgetDiv) return null;
        const rect = this.#widgetDiv.getBoundingClientRect();
        const bodyHeight = this.#windowBody ? (this.#windowBody.style.height || `${this.#windowBody.getBoundingClientRect().height}px`) : undefined;
        return {
            serviceId: this.#widgetId,
            widgetId: this.#widgetId,
            widgetIndex: this.#widgetIndex,
            type: "widget",
            dockPosition: modular?.widgetDockPosition,
            left: this.#widgetDiv.style.left || `${rect.left}px`,
            top: this.#widgetDiv.style.top || `${rect.top}px`,
            width: this.#widgetDiv.style.width || `${rect.width}px`,
            height: this.#widgetDiv.style.height || `${rect.height}px`,
            bodyHeight,
            pinned: this.#isPinned,
            open: this.#widgetDiv.parentElement !== null, ...extra
        };
    }

    #persistWindowState(extra = {}) {
        const snapshot = this.#captureWindowState(extra);
        if (!snapshot) return;
        windowStateManager?.saveState(this.#widgetId, this.#widgetIndex, snapshot, "widget");
    }
}
