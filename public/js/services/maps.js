(() => {
    let activeMap = null;
    let activeMapContainer = null;
    let detachMapsSearchHandlers = null;
    const MAPS_CACHE_KEY = "recent-searches";
    const MAPS_CACHE_LIMIT = 10;
    const MAP_STYLE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3" /></svg>`;
    const MAP_STYLE_OPTIONS = [{
        id: "default",
        label: "Default",
        style: "mapbox://styles/mapbox/streets-v12"
    }, {
        id: "monochrome",
        label: "Monochrome",
        style: "mapbox://styles/mapbox/standard",
        config: {basemap: {theme: "monochrome"}}
    }, {
        id: "outdoors",
        label: "Outdoors",
        style: "mapbox://styles/mapbox/outdoors-v12"
    }, {
        id: "satellite",
        label: "Satellite",
        style: "mapbox://styles/mapbox/satellite-streets-v12"
    }, {
        id: "warm",
        label: "Warm",
        style: "mapbox://styles/mapbox/standard",
        config: {basemap: {lightPreset: "dusk"}}
    }, {
        id: "dark",
        label: "Dark",
        style: "mapbox://styles/mapbox/dark-v11"
    }, {
        id: "light",
        label: "Light",
        style: "mapbox://styles/mapbox/light-v11"
    }, {
        id: "navigation",
        label: "Navigation",
        style: "mapbox://styles/mapbox/navigation-day-v1"
    }];
    modular.register(new Service("com.standard.maps", [
        new Portal({
            title: "Maps",
            hints: ["maps", "where am i"],
            dimensions: [800, 450],
            horizontal_nav: true,
            centered_nav: true,
            icon: "/icons/interfaces/maps.png",
            svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" /></svg>`,
            route: () => div({empty: true, style: "flex maps-shell", id: "map-shell", content: div({style: "maps-search-overlay", content: [
                            div({style: "maps-search-stack", content: [
                            input({id: "maps-search-input", placeholder: "Search by address or lat, lng", style: "maps-search-input", type: "text"}),
                                div({id: "maps-search-autocomplete", style: "maps-search-autocomplete hidden"})
                            ].join("")}),
                            button({id: "maps-search-button", style: "maps-search-button", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="smaller-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>`})
                        ].join("")}) +
                    div({style: "maps-controls-overlay no-background", content: [
                            button({id: "maps-zoom-in", style: "maps-control-button no-padding small-padding secondary-bordered no-background blurred", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`}),
                            button({id: "maps-zoom-out", style: "maps-control-button no-padding small-padding secondary-bordered no-background blurred", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" /></svg>`}),
                            div({style: "maps-control-row no-background", content: [
                                    button({id: "maps-style", style: "maps-control-button no-padding small-padding secondary-bordered no-background blurred", icon: MAP_STYLE_ICON}),
                                    button({id: "maps-home", style: "maps-control-button no-padding small-padding secondary-bordered no-background blurred", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>`})
                                ].join("")})
                        ].join("")
                    }) +
                    div({style: "brick radius bordered maps-canvas", id: "map"})
            }),
            afterRender: async (_, view) => {
                const mapShell = document.getElementById("map-shell");
                const mapContainer = document.getElementById("map");
                if (!mapShell || !mapContainer) return;
                const bodyNode = view?.body instanceof HTMLElement ? view.body : mapContainer.closest(".window-body");
                const syncMapViewport = () => {
                    const availableHeight = Math.max((bodyNode?.clientHeight || mapShell.clientHeight || mapContainer.clientHeight) - 12, 200);
                    mapShell.style.width = "100%";
                    mapShell.style.height = `${availableHeight}px`;
                    mapShell.style.minHeight = `${availableHeight}px`;
                    mapContainer.style.width = "100%";
                    mapContainer.style.height = `${availableHeight}px`;
                    mapContainer.style.minHeight = `${availableHeight}px`;
                };
                syncMapViewport();
                if (activeMap && activeMapContainer === mapContainer) {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            syncMapViewport();
                            activeMap.resize();
                        });
                    });
                    return;
                }
                if (activeMap) {
                    activeMap.remove();
                    activeMap = null;
                    activeMapContainer = null;
                }
                if (typeof detachMapsSearchHandlers === "function") {
                    detachMapsSearchHandlers();
                    detachMapsSearchHandlers = null;
                }
                const mapboxToken = window.StandardRuntimeConfig?.mapboxAccessToken || "";
                if (!mapboxToken) {
                    console.error("Missing Mapbox access token");
                    return;
                }
                mapboxgl.accessToken = mapboxToken;
                const map = new mapboxgl.Map({
                    container: mapContainer,
                    zoom: 11.2,
                    center: [-84.513611, 39.103699],
                    style: 'mapbox://styles/mapbox/streets-v12'
                });
                map.once("load", () => {
                    syncMapViewport();
                    map.resize();
                });
                activeMap = map;
                activeMapContainer = mapContainer;
                const defaultCenter = [-84.513611, 39.103699];
                const defaultLocationLabel = "Cincinnati, OH";
                let homeCoordinates = defaultCenter;
                let homeLocationLabel = defaultLocationLabel;
                let activeLocationPopup = null;
                let pendingActiveLocationFeature = {
                    lng: defaultCenter[0],
                    lat: defaultCenter[1],
                    label: defaultLocationLabel
                };
                const ACTIVE_LOCATION_SOURCE_ID = "active-location-source";
                const ACTIVE_LOCATION_LAYER_ID = "active-location-layer";
                const ACTIVE_LOCATION_IMAGE_ID = "active-location-dot";
                let activeLocationLayerHandlersAttached = false;
                const formatCoordinate = (value) => Number(value).toFixed(6);
                const buildActiveLocationFeature = (lng, lat, label = "Selected Location") => ({
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [lng, lat]
                    },
                    properties: {
                        label,
                        coordinatesLabel: `${formatCoordinate(lat)}, ${formatCoordinate(lng)}`
                    }
                });
                const buildActiveLocationData = (lng, lat, label = "Selected Location") => ({
                    type: "FeatureCollection",
                    features: [buildActiveLocationFeature(lng, lat, label)]
                });
                const clearActiveLocationPopup = () => {
                    activeLocationPopup?.remove();
                    activeLocationPopup = null;
                };
                const createActiveLocationImage = () => ({
                    width: 100,
                    height: 100,
                    data: new Uint8Array(100 * 100 * 4),
                    onAdd() {
                        const canvas = document.createElement("canvas");
                        canvas.width = this.width;
                        canvas.height = this.height;
                        this.context = canvas.getContext("2d");
                    },
                    render() {
                        const duration = 1000;
                        const t = (performance.now() % duration) / duration;
                        const radius = 12;
                        const outerRadius = 26 * t + radius;
                        const context = this.context;
                        if (!context) return false;
                        context.clearRect(0, 0, this.width, this.height);
                        context.beginPath();
                        context.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
                        context.fillStyle = `rgba(255, 159, 10, ${1 - t})`;
                        context.fill();
                        context.beginPath();
                        context.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
                        context.fillStyle = "rgba(255, 159, 10, 1)";
                        context.strokeStyle = "rgba(255, 255, 255, 0.95)";
                        context.lineWidth = 4;
                        context.fill();
                        context.stroke();
                        this.data = context.getImageData(0, 0, this.width, this.height).data;
                        map.triggerRepaint();
                        return true;
                    }
                });
                const handleActiveLocationMouseenter = (event) => {
                    const feature = event.features?.[0];
                    if (!feature || feature.geometry?.type !== "Point") return;
                    map.getCanvas().style.cursor = "pointer";
                    const [lng, lat] = feature.geometry.coordinates;
                    const popupContent = document.createElement("div");
                    const title = document.createElement("strong");
                    title.textContent = feature.properties?.label || "Selected Location";
                    const coordinates = document.createElement("div");
                    coordinates.textContent = `${formatCoordinate(lat)}, ${formatCoordinate(lng)}`;
                    popupContent.appendChild(title);
                    popupContent.appendChild(coordinates);
                    clearActiveLocationPopup();
                    activeLocationPopup = new mapboxgl.Popup({
                        closeButton: false,
                        closeOnClick: false,
                        offset: 18
                    }).setLngLat([lng, lat]).setDOMContent(popupContent).addTo(map);
                };
                const handleActiveLocationMouseleave = () => {
                    map.getCanvas().style.cursor = "";
                    clearActiveLocationPopup();
                };
                const ensureActiveLocationLayer = () => {
                    if (!map.isStyleLoaded()) return;
                    if (!map.hasImage(ACTIVE_LOCATION_IMAGE_ID)) {
                        map.addImage(ACTIVE_LOCATION_IMAGE_ID, createActiveLocationImage(), {pixelRatio: 2});
                    }
                    if (!map.getSource(ACTIVE_LOCATION_SOURCE_ID)) {
                        map.addSource(ACTIVE_LOCATION_SOURCE_ID, {
                            type: "geojson",
                            data: buildActiveLocationData(pendingActiveLocationFeature.lng, pendingActiveLocationFeature.lat, pendingActiveLocationFeature.label)
                        });
                    }
                    if (!map.getLayer(ACTIVE_LOCATION_LAYER_ID)) {
                        map.addLayer({
                            id: ACTIVE_LOCATION_LAYER_ID,
                            type: "symbol",
                            source: ACTIVE_LOCATION_SOURCE_ID,
                            layout: {
                                "icon-image": ACTIVE_LOCATION_IMAGE_ID,
                                "icon-size": 1.125,
                                "icon-allow-overlap": true
                            }
                        });
                        if (!activeLocationLayerHandlersAttached) {
                            activeLocationLayerHandlersAttached = true;
                            map.on("mouseenter", ACTIVE_LOCATION_LAYER_ID, handleActiveLocationMouseenter);
                            map.on("mouseleave", ACTIVE_LOCATION_LAYER_ID, handleActiveLocationMouseleave);
                        }
                    }
                };
                const setActiveLocation = (lng, lat, label = "Selected Location") => {
                    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
                    pendingActiveLocationFeature = {lng, lat, label};
                    ensureActiveLocationLayer();
                    const source = map.getSource(ACTIVE_LOCATION_SOURCE_ID);
                    if (!source) return;
                    source.setData(buildActiveLocationData(lng, lat, label));
                    clearActiveLocationPopup();
                };
                const flyToCoordinates = (lng, lat, zoom = 14, label = "Selected Location") => {
                    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
                    setActiveLocation(lng, lat, label);
                    map.flyTo({center: [lng, lat], zoom});
                };
                const searchInput = document.getElementById("maps-search-input");
                const autocomplete = document.getElementById("maps-search-autocomplete");
                const searchButton = document.getElementById("maps-search-button");
                const zoomInButton = document.getElementById("maps-zoom-in");
                const zoomOutButton = document.getElementById("maps-zoom-out");
                const styleButton = document.getElementById("maps-style");
                const homeButton = document.getElementById("maps-home");
                let cachedSearches = [];
                let cacheWriteInFlight = Promise.resolve();
                let activeStyleId = MAP_STYLE_OPTIONS[0].id;
                const normalizeSearchValue = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
                const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[character] || character));
                const getSearchCachePayload = () => ({searches: cachedSearches});
                const setAutocompleteVisibility = (visible) => {
                    if (!autocomplete) return;
                    autocomplete.classList.toggle("hidden", !visible);
                };
                const updateCachedSearches = (query) => {
                    cachedSearches = [query]
                        .concat(cachedSearches.filter((entry) => entry.toLowerCase() !== query.toLowerCase()))
                        .slice(0, MAPS_CACHE_LIMIT);
                };
                const parseSearchCoordinates = (query) => {
                    const coordinateMatch = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
                    if (!coordinateMatch) return null;
                    const first = Number.parseFloat(coordinateMatch[1]);
                    const second = Number.parseFloat(coordinateMatch[2]);
                    const looksLikeLatLng = Math.abs(first) <= 90 && Math.abs(second) <= 180;
                    return {
                        lat: looksLikeLatLng ? first : second,
                        lng: looksLikeLatLng ? second : first
                    };
                };
                const getAutocompleteMatches = (query) => {
                    const normalizedQuery = normalizeSearchValue(query).toLowerCase();
                    if (!normalizedQuery) return cachedSearches.slice(0, MAPS_CACHE_LIMIT);
                    return cachedSearches
                        .filter((entry) => entry.toLowerCase().includes(normalizedQuery))
                        .sort((a, b) => {
                        const aStarts = a.toLowerCase().startsWith(normalizedQuery);
                        const bStarts = b.toLowerCase().startsWith(normalizedQuery);
                        if (aStarts !== bStarts) return aStarts ? -1 : 1;
                        return a.localeCompare(b);
                    })
                        .slice(0, MAPS_CACHE_LIMIT);
                };
                const renderAutocomplete = (query = "") => {
                    if (!autocomplete) return;
                    const matches = getAutocompleteMatches(query);
                    if (!matches.length) {
                        autocomplete.innerHTML = "";
                        setAutocompleteVisibility(false);
                        return;
                    }
                    autocomplete.innerHTML = matches.map((value) => `<button type="button" class="maps-autocomplete-option" data-maps-autocomplete-value="${encodeURIComponent(value)}">${escapeHtml(value)}</button>`).join("");
                    setAutocompleteVisibility(true);
                };
                const scheduleCachedSearchSave = (query) => {
                    const normalizedQuery = normalizeSearchValue(query);
                    if (!normalizedQuery) return;
                    updateCachedSearches(normalizedQuery);
                    renderAutocomplete(searchInput?.value ?? "");
                    cacheWriteInFlight = cacheWriteInFlight
                        .catch(() => undefined)
                        .then(() => new Promise((resolve) => {
                        setTimeout(async () => {
                            try {
                                await view.cache.create(MAPS_CACHE_KEY, getSearchCachePayload(), {format: "json"});
                            } catch (error) {
                                console.error("Failed to cache map search:", error);
                            }
                            resolve();
                        }, 0);
                    }));
                };
                const runSearch = async (rawQuery) => {
                    const query = normalizeSearchValue(rawQuery ?? searchInput?.value);
                    if (!query) return;
                    if (searchInput) searchInput.value = query;
                    setAutocompleteVisibility(false);
                    const coordinates = parseSearchCoordinates(query);
                    if (coordinates) {
                        flyToCoordinates(coordinates.lng, coordinates.lat, 14, "Custom Coordinates");
                        scheduleCachedSearchSave(query);
                        return;
                    }
                    const geocodeResponse = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&access_token=${mapboxgl.accessToken}`);
                    const geocodeData = await geocodeResponse.json();
                    const firstFeature = geocodeData?.features?.[0];
                    const firstMatch = firstFeature?.center;
                    if (Array.isArray(firstMatch) && firstMatch.length === 2) {
                        flyToCoordinates(firstMatch[0], firstMatch[1], 14, firstFeature.place_name || query);
                    }
                    scheduleCachedSearchSave(query);
                };
                try {
                    const payload = await view.cache.get(MAPS_CACHE_KEY, {format: "json"});
                    const storedSearches = Array.isArray(payload) ? payload : payload?.searches;
                    cachedSearches = Array.isArray(storedSearches) ? storedSearches.map(normalizeSearchValue).filter(Boolean).slice(0, MAPS_CACHE_LIMIT) : [];
                } catch (error) {
                    console.error("Failed to load cached map searches:", error);
                }
                searchButton.addEventListener("click", runSearch);
                searchInput.addEventListener("keydown", (event) => {
                    if (event.key === "Enter") runSearch();
                    if (event.key === "Escape") setAutocompleteVisibility(false);
                });
                searchInput.addEventListener("input", () => renderAutocomplete(searchInput.value));
                searchInput.addEventListener("focus", () => renderAutocomplete(searchInput.value));
                searchInput.addEventListener("blur", () => {
                    setTimeout(() => setAutocompleteVisibility(false), 0);
                });
                autocomplete?.addEventListener("mousedown", (event) => {
                    const option = event.target.closest("[data-maps-autocomplete-value]");
                    if (!option) return;
                    event.preventDefault();
                    const value = decodeURIComponent(option.getAttribute("data-maps-autocomplete-value") || "");
                    runSearch(value);
                });
                const handleDocumentClick = (event) => {
                    if (!mapShell.contains(event.target)) {
                        setAutocompleteVisibility(false);
                    }
                };
                document.addEventListener("click", handleDocumentClick);
                detachMapsSearchHandlers = () => document.removeEventListener("click", handleDocumentClick);
                const applyMapStyle = (styleOption) => {
                    if (!styleOption || activeStyleId === styleOption.id) return;
                    const previousStyleId = activeStyleId;
                    activeStyleId = styleOption.id;
                    const center = map.getCenter();
                    const zoom = map.getZoom();
                    const bearing = map.getBearing();
                    const pitch = map.getPitch();
                    clearActiveLocationPopup();
                    const applyStyleConfig = () => {
                        if (!styleOption.config?.basemap || typeof map.setConfigProperty !== "function") return;
                        Object.entries(styleOption.config.basemap).forEach(([key, value]) => {
                            map.setConfigProperty("basemap", key, value);
                        });
                    };
                    const handleStyleLoad = () => {
                        applyStyleConfig();
                        map.jumpTo({center, zoom, bearing, pitch});
                        syncMapViewport();
                        map.resize();
                        ensureActiveLocationLayer();
                        setActiveLocation(pendingActiveLocationFeature.lng, pendingActiveLocationFeature.lat, pendingActiveLocationFeature.label);
                    };
                    map.once("style.load", handleStyleLoad);
                    try {
                        map.setStyle(styleOption.style);
                    } catch (error) {
                        map.off("style.load", handleStyleLoad);
                        activeStyleId = previousStyleId;
                        console.error("Failed to apply map style:", error);
                    }
                };
                styleButton?.popoutmenu(MAP_STYLE_OPTIONS.map((styleOption) => ({
                    icon: MAP_STYLE_ICON,
                    label: styleOption.label,
                    action: () => applyMapStyle(styleOption)
                })));
                zoomInButton.addEventListener("click", () => map.zoomIn());
                zoomOutButton.addEventListener("click", () => map.zoomOut());
                homeButton.addEventListener("click", () => flyToCoordinates(homeCoordinates[0], homeCoordinates[1], 13, homeLocationLabel));
                if (navigator.geolocation) navigator.geolocation.getCurrentPosition((position) => {
                    homeCoordinates = [position.coords.longitude, position.coords.latitude];
                    homeLocationLabel = "Current Location";
                });
                map.once("load", () => {
                    ensureActiveLocationLayer();
                    setActiveLocation(defaultCenter[0], defaultCenter[1], defaultLocationLabel);
                });
            }
        })
    ]))
})();
