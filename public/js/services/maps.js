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
                            button({id: "maps-search-button", style: "maps-search-button", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="smaller-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>`}),
                            button({id: "maps-directions-toggle", style: "maps-search-button", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="smaller-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75 11.25 4.5 13.5 6.75M11.25 4.5v15m0 0L9 17.25m2.25 2.25 2.25-2.25M15.75 8.25h1.875A2.625 2.625 0 0 1 20.25 10.875v0A2.625 2.625 0 0 1 17.625 13.5H6.375A2.625 2.625 0 0 0 3.75 16.125v0A2.625 2.625 0 0 0 6.375 18.75H7.5" /></svg>`})
                        ].join("")}) +
                    div({id: "maps-directions-panel", style: "maps-directions-panel hidden", content: [
                            div({style: "maps-directions-fields", content: [
                                    input({id: "maps-directions-origin", placeholder: "Start address or lat, lng", style: "maps-directions-input", type: "text"}),
                                    input({id: "maps-directions-destination", placeholder: "Destination address or lat, lng", style: "maps-directions-input", type: "text"})
                                ].join("")}),
                            div({style: "maps-directions-actions", content: [
                                    button({id: "maps-directions-route", style: "maps-directions-action", content: "Route"}),
                                    button({id: "maps-directions-clear", style: "maps-directions-action secondary-bordered no-background", content: "Clear"})
                                ].join("")}),
                            div({id: "maps-directions-summary", style: "maps-directions-summary hidden"}),
                            `<ol id="maps-directions-steps" class="maps-directions-steps hidden"></ol>`
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
                    const availableHeight = Math.max(bodyNode?.clientHeight || mapShell.clientHeight || mapContainer.clientHeight, 200);
                    mapShell.style.width = "100%";
                    mapShell.style.height = `${availableHeight}px`;
                    mapShell.style.minHeight = `${availableHeight}px`;
                    mapShell.style.boxSizing = "border-box";
                    mapShell.style.overflow = "hidden";
                    mapContainer.style.width = "100%";
                    mapContainer.style.height = `${availableHeight}px`;
                    mapContainer.style.minHeight = `${availableHeight}px`;
                    mapContainer.style.boxSizing = "border-box";
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
                const DIRECTIONS_ROUTE_SOURCE_ID = "directions-route-source";
                const DIRECTIONS_ROUTE_OUTLINE_LAYER_ID = "directions-route-outline-layer";
                const DIRECTIONS_ROUTE_LAYER_ID = "directions-route-layer";
                const DIRECTIONS_POINTS_SOURCE_ID = "directions-points-source";
                const DIRECTIONS_POINTS_LAYER_ID = "directions-points-layer";
                const DIRECTIONS_POINTS_LABEL_LAYER_ID = "directions-points-label-layer";
                let activeLocationLayerHandlersAttached = false;
                let pendingDirectionsRouteData = null;
                let pendingDirectionsPointsData = null;
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
                const buildDirectionsRouteData = (geometry) => ({
                    type: "FeatureCollection",
                    features: [{
                        type: "Feature",
                        geometry,
                        properties: {}
                    }]
                });
                const buildDirectionsPointsData = (origin, destination) => ({
                    type: "FeatureCollection",
                    features: [{
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: origin.coordinates
                        },
                        properties: {
                            label: "A",
                            title: origin.label || "Start"
                        }
                    }, {
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: destination.coordinates
                        },
                        properties: {
                            label: "B",
                            title: destination.label || "Destination"
                        }
                    }]
                });
                const ensureDirectionsLayers = () => {
                    if (!map.isStyleLoaded() || !pendingDirectionsRouteData || !pendingDirectionsPointsData) return;
                    if (!map.getSource(DIRECTIONS_ROUTE_SOURCE_ID)) {
                        map.addSource(DIRECTIONS_ROUTE_SOURCE_ID, {
                            type: "geojson",
                            data: pendingDirectionsRouteData
                        });
                    }
                    if (!map.getLayer(DIRECTIONS_ROUTE_OUTLINE_LAYER_ID)) {
                        map.addLayer({
                            id: DIRECTIONS_ROUTE_OUTLINE_LAYER_ID,
                            type: "line",
                            source: DIRECTIONS_ROUTE_SOURCE_ID,
                            layout: {
                                "line-cap": "round",
                                "line-join": "round"
                            },
                            paint: {
                                "line-color": "#ffffff",
                                "line-width": 8,
                                "line-opacity": 0.9
                            }
                        });
                    }
                    if (!map.getLayer(DIRECTIONS_ROUTE_LAYER_ID)) {
                        map.addLayer({
                            id: DIRECTIONS_ROUTE_LAYER_ID,
                            type: "line",
                            source: DIRECTIONS_ROUTE_SOURCE_ID,
                            layout: {
                                "line-cap": "round",
                                "line-join": "round"
                            },
                            paint: {
                                "line-color": "#0a84ff",
                                "line-width": 5,
                                "line-opacity": 0.95
                            }
                        });
                    }
                    if (!map.getSource(DIRECTIONS_POINTS_SOURCE_ID)) {
                        map.addSource(DIRECTIONS_POINTS_SOURCE_ID, {
                            type: "geojson",
                            data: pendingDirectionsPointsData
                        });
                    }
                    if (!map.getLayer(DIRECTIONS_POINTS_LAYER_ID)) {
                        map.addLayer({
                            id: DIRECTIONS_POINTS_LAYER_ID,
                            type: "circle",
                            source: DIRECTIONS_POINTS_SOURCE_ID,
                            paint: {
                                "circle-color": "#ff9f0a",
                                "circle-radius": 12,
                                "circle-stroke-color": "#ffffff",
                                "circle-stroke-width": 3
                            }
                        });
                    }
                    if (!map.getLayer(DIRECTIONS_POINTS_LABEL_LAYER_ID)) {
                        map.addLayer({
                            id: DIRECTIONS_POINTS_LABEL_LAYER_ID,
                            type: "symbol",
                            source: DIRECTIONS_POINTS_SOURCE_ID,
                            layout: {
                                "text-field": ["get", "label"],
                                "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                                "text-size": 12,
                                "text-allow-overlap": true
                            },
                            paint: {
                                "text-color": "#ffffff"
                            }
                        });
                    }
                };
                const setDirectionsData = ({route, origin, destination}) => {
                    pendingDirectionsRouteData = buildDirectionsRouteData(route.geometry);
                    pendingDirectionsPointsData = buildDirectionsPointsData(origin, destination);
                    ensureDirectionsLayers();
                    map.getSource(DIRECTIONS_ROUTE_SOURCE_ID)?.setData(pendingDirectionsRouteData);
                    map.getSource(DIRECTIONS_POINTS_SOURCE_ID)?.setData(pendingDirectionsPointsData);
                };
                const clearDirectionsData = () => {
                    pendingDirectionsRouteData = null;
                    pendingDirectionsPointsData = null;
                    [
                        DIRECTIONS_POINTS_LABEL_LAYER_ID,
                        DIRECTIONS_POINTS_LAYER_ID,
                        DIRECTIONS_ROUTE_LAYER_ID,
                        DIRECTIONS_ROUTE_OUTLINE_LAYER_ID
                    ].forEach((layerId) => {
                        if (map.getLayer(layerId)) map.removeLayer(layerId);
                    });
                    [DIRECTIONS_POINTS_SOURCE_ID, DIRECTIONS_ROUTE_SOURCE_ID].forEach((sourceId) => {
                        if (map.getSource(sourceId)) map.removeSource(sourceId);
                    });
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
                const directionsToggleButton = document.getElementById("maps-directions-toggle");
                const directionsPanel = document.getElementById("maps-directions-panel");
                const directionsOriginInput = document.getElementById("maps-directions-origin");
                const directionsDestinationInput = document.getElementById("maps-directions-destination");
                const directionsRouteButton = document.getElementById("maps-directions-route");
                const directionsClearButton = document.getElementById("maps-directions-clear");
                const directionsSummary = document.getElementById("maps-directions-summary");
                const directionsSteps = document.getElementById("maps-directions-steps");
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
                const fetchGeocodedLocation = async (query) => {
                    const normalizedQuery = normalizeSearchValue(query);
                    if (!normalizedQuery) return null;
                    const coordinates = parseSearchCoordinates(normalizedQuery);
                    if (coordinates) {
                        return {
                            coordinates: [coordinates.lng, coordinates.lat],
                            label: normalizedQuery
                        };
                    }
                    if (/^(current location|my location|here)$/i.test(normalizedQuery)) {
                        return {
                            coordinates: homeCoordinates,
                            label: homeLocationLabel
                        };
                    }
                    const geocodeResponse = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalizedQuery)}.json?limit=1&access_token=${encodeURIComponent(mapboxgl.accessToken)}`);
                    if (!geocodeResponse.ok) throw new Error("Unable to geocode location");
                    const geocodeData = await geocodeResponse.json();
                    const firstFeature = geocodeData?.features?.[0];
                    if (!Array.isArray(firstFeature?.center) || firstFeature.center.length !== 2) return null;
                    return {
                        coordinates: firstFeature.center,
                        label: firstFeature.place_name || normalizedQuery
                    };
                };
                const formatDistance = (meters) => {
                    if (!Number.isFinite(meters)) return "";
                    const miles = meters / 1609.344;
                    return miles >= 10 ? `${Math.round(miles)} mi` : `${miles.toFixed(1)} mi`;
                };
                const formatDuration = (seconds) => {
                    if (!Number.isFinite(seconds)) return "";
                    const minutes = Math.max(1, Math.round(seconds / 60));
                    if (minutes < 60) return `${minutes} min`;
                    const hours = Math.floor(minutes / 60);
                    const remainingMinutes = minutes % 60;
                    return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
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
                    const location = await fetchGeocodedLocation(query);
                    if (Array.isArray(location?.coordinates) && location.coordinates.length === 2) {
                        flyToCoordinates(location.coordinates[0], location.coordinates[1], 14, location.label || query);
                    }
                    scheduleCachedSearchSave(query);
                };
                const setDirectionsMessage = (message, isError = false) => {
                    if (!directionsSummary) return;
                    directionsSummary.textContent = message;
                    directionsSummary.classList.toggle("maps-directions-error", isError);
                    directionsSummary.classList.remove("hidden");
                };
                const hideDirectionsOutput = () => {
                    directionsSummary?.classList.add("hidden");
                    directionsSummary?.classList.remove("maps-directions-error");
                    if (directionsSteps) {
                        directionsSteps.innerHTML = "";
                        directionsSteps.classList.add("hidden");
                    }
                };
                const renderDirectionsSteps = (route) => {
                    if (!directionsSteps) return;
                    directionsSteps.innerHTML = "";
                    const steps = route?.legs?.flatMap((leg) => leg.steps || []) || [];
                    steps.slice(0, 12).forEach((step) => {
                        const item = document.createElement("li");
                        const instruction = document.createElement("span");
                        instruction.textContent = step.maneuver?.instruction || "Continue";
                        const distance = document.createElement("small");
                        distance.textContent = formatDistance(step.distance);
                        item.appendChild(instruction);
                        if (distance.textContent) item.appendChild(distance);
                        directionsSteps.appendChild(item);
                    });
                    directionsSteps.classList.toggle("hidden", !steps.length);
                };
                const fitDirectionsBounds = (route, origin, destination) => {
                    const bounds = new mapboxgl.LngLatBounds();
                    const routeCoordinates = Array.isArray(route?.geometry?.coordinates) ? route.geometry.coordinates : [];
                    routeCoordinates.forEach((coordinate) => bounds.extend(coordinate));
                    bounds.extend(origin.coordinates);
                    bounds.extend(destination.coordinates);
                    map.fitBounds(bounds, {
                        padding: {top: 130, right: 80, bottom: 80, left: 80},
                        maxZoom: 16,
                        duration: 900
                    });
                };
                const runDirections = async () => {
                    const originQuery = normalizeSearchValue(directionsOriginInput?.value);
                    const destinationQuery = normalizeSearchValue(directionsDestinationInput?.value);
                    if (!originQuery || !destinationQuery) {
                        setDirectionsMessage("Enter a start and destination.", true);
                        return;
                    }
                    directionsRouteButton?.setAttribute("disabled", "disabled");
                    setDirectionsMessage("Finding route...");
                    try {
                        const [origin, destination] = await Promise.all([
                            fetchGeocodedLocation(originQuery),
                            fetchGeocodedLocation(destinationQuery)
                        ]);
                        if (!origin || !destination) {
                            setDirectionsMessage("Could not find one of those places.", true);
                            return;
                        }
                        const coordinates = `${origin.coordinates[0]},${origin.coordinates[1]};${destination.coordinates[0]},${destination.coordinates[1]}`;
                        const routeResponse = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?alternatives=false&geometries=geojson&overview=full&steps=true&access_token=${encodeURIComponent(mapboxgl.accessToken)}`);
                        if (!routeResponse.ok) throw new Error("Unable to load route");
                        const routeData = await routeResponse.json();
                        const route = routeData?.routes?.[0];
                        if (!route?.geometry) {
                            setDirectionsMessage("No route found.", true);
                            return;
                        }
                        setDirectionsData({route, origin, destination});
                        setDirectionsMessage(`${formatDistance(route.distance)} • ${formatDuration(route.duration)}`);
                        renderDirectionsSteps(route);
                        fitDirectionsBounds(route, origin, destination);
                        scheduleCachedSearchSave(originQuery);
                        scheduleCachedSearchSave(destinationQuery);
                    } catch (error) {
                        console.error("Failed to load directions:", error);
                        setDirectionsMessage("Directions are unavailable right now.", true);
                    } finally {
                        directionsRouteButton?.removeAttribute("disabled");
                    }
                };
                const clearDirections = () => {
                    clearDirectionsData();
                    hideDirectionsOutput();
                    if (directionsOriginInput) directionsOriginInput.value = "";
                    if (directionsDestinationInput) directionsDestinationInput.value = "";
                };
                try {
                    const payload = await view.cache.get(MAPS_CACHE_KEY, {format: "json"});
                    const storedSearches = Array.isArray(payload) ? payload : payload?.searches;
                    cachedSearches = Array.isArray(storedSearches) ? storedSearches.map(normalizeSearchValue).filter(Boolean).slice(0, MAPS_CACHE_LIMIT) : [];
                } catch (error) {
                    console.error("Failed to load cached map searches:", error);
                }
                searchButton.addEventListener("click", () => runSearch());
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
                directionsToggleButton?.addEventListener("click", () => {
                    directionsPanel?.classList.toggle("hidden");
                    if (!directionsPanel?.classList.contains("hidden")) {
                        directionsOriginInput?.focus();
                    }
                });
                directionsRouteButton?.addEventListener("click", runDirections);
                directionsClearButton?.addEventListener("click", clearDirections);
                [directionsOriginInput, directionsDestinationInput].forEach((directionsInput) => {
                    directionsInput?.addEventListener("keydown", (event) => {
                        if (event.key === "Enter") runDirections();
                        if (event.key === "Escape") directionsPanel?.classList.add("hidden");
                    });
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
                        ensureDirectionsLayers();
                        if (pendingDirectionsRouteData) map.getSource(DIRECTIONS_ROUTE_SOURCE_ID)?.setData(pendingDirectionsRouteData);
                        if (pendingDirectionsPointsData) map.getSource(DIRECTIONS_POINTS_SOURCE_ID)?.setData(pendingDirectionsPointsData);
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
