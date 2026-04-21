(() => {
    console.log("[weather] initializing");
    const DEFAULT_COORDINATES = {lat: 39.103699, lon: -84.513611};
    const WEATHER_SERVICE_ID = "com.standard.weather";
    const WEATHER_INTERFACE_ICON = "/icons/interfaces/weather.png";
    const WEATHER_ICON_BASE_PATH = "/icons/weather";
    const WEATHER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" /></svg>`;
    const listeners = new Set();
    const state = {data: null, error: null, loading: false, initialized: false, lastUpdated: null, locationLabel: "Cincinnati, OH", coords: {...DEFAULT_COORDINATES}, usingBrowserLocation: false,};
    let inFlightRequest = null;
    let refreshTimer = null;
    let geolocationAttempt = null;
    const pickValue = (...values) => values.find(value => value !== undefined && value !== null && value !== "");
    const firstWeatherEntry = value => Array.isArray(value) && value.length ? value[0] || {} : {};
    const toNumber = (...values) => {
        for (const value of values) {
            const parsed = Number.parseFloat(value);
            if (Number.isFinite(parsed)) return parsed;
        }
        return null;
    };
    const toPercent = (...values) => {
        const numeric = toNumber(...values);
        if (!Number.isFinite(numeric)) return null;
        return numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
    };
    const formatTemperature = value => Number.isFinite(value) ? `${Math.round(value)}\u00B0F` : "--\u00B0F";
    const formatPercent = value => Number.isFinite(value) ? `${Math.round(value)}%` : "--";
    const formatWind = value => Number.isFinite(value) ? `${Math.round(value)} mph` : "--";
    const formatTimestamp = value => {
        if (!value) return "Updated just now";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Updated just now";
        return `Updated ${date.toLocaleTimeString([], {hour: "numeric", minute: "2-digit"})}`;
    };
    const formatDayLabel = (value, fallbackIndex = 0) => {
        if (typeof value === "string" && value.trim()) return value;
        if (!value) return fallbackIndex === 0 ? "Today" : `Day ${fallbackIndex + 1}`;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return fallbackIndex === 0 ? "Today" : `Day ${fallbackIndex + 1}`;
        return date.toLocaleDateString([], {weekday: "short"});
    };
    const formatHourLabel = (value, fallbackIndex = 0) => {
        if (typeof value === "string" && /\d/.test(value) && /am|pm/i.test(value)) return value;
        const date = value ? new Date(value) : null;
        if (date && !Number.isNaN(date.getTime())) return date.toLocaleTimeString([], {hour: "numeric"});
        return fallbackIndex === 0 ? "Now" : `+${fallbackIndex}h`;
    };
    const resolveWeatherIcon = (...values) => {
        for (const value of values) {
            if (typeof value !== "string") continue;
            const trimmed = value.trim();
            if (!trimmed) continue;
            if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) return trimmed;
            const match = trimmed.match(/\b(01|02|03|04|09|10|11|13|50)(d|n)\b/i);
            if (match) return `${WEATHER_ICON_BASE_PATH}/${match[1]}${match[2].toLowerCase()}.png`;
        }
        return "";
    };
    const buildWeatherEndpoint = coords => `https://standardcomputers.net/api/weather?lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}`;
    const normalizeLocation = payload => {
        const location = payload?.location || payload?.metadata?.location || {};
        const name = pickValue(location?.name, location?.label, location?.city, payload?.city, state.usingBrowserLocation ? "Current location" : "Cincinnati, OH");
        const region = pickValue(location?.region, location?.state, location?.admin1, payload?.state, payload?.region, location?.country, payload?.country);
        return {name: region && name !== region ? `${name}, ${region}` : name};
    };
    const normalizeCurrent = payload => {
        const current = payload?.current || payload?.currently || payload?.observation || payload?.now || {};
        const currentWeather = firstWeatherEntry(current?.weather);
        return {
            temperature: toNumber(current?.temperature, current?.temp, current?.temp_f, current?.temperatureF),
            feelsLike: toNumber(current?.feelsLike, current?.apparentTemperature, current?.feels_like, current?.heatIndex),
            humidity: toPercent(current?.humidity, current?.relativeHumidity),
            windSpeed: toNumber(current?.windSpeed, current?.wind_speed, current?.windMph),
            description: pickValue(current?.description, current?.summary, current?.condition, current?.shortForecast, currentWeather?.description, currentWeather?.main, current?.weather) || "Unavailable",
            icon: resolveWeatherIcon(current?.icon, current?.iconUrl, current?.symbol, current?.iconCode, currentWeather?.icon),
            updatedAt: pickValue(current?.updatedAt, current?.timestamp, payload?.updatedAt, payload?.generatedAt, new Date().toISOString()),
        };
    };
    const normalizeDailyForecast = payload => {
        const rawDaily = payload?.forecast?.daily || payload?.daily || payload?.days || payload?.forecastDaily || [];
        return rawDaily.slice(0, 6).map((entry, index) => {
            const weatherEntry = firstWeatherEntry(entry?.weather);
            return ({
                label: formatDayLabel(pickValue(entry?.label, entry?.day, entry?.name, entry?.weekday, entry?.date), index),
                high: toNumber(entry?.high, entry?.highTemp, entry?.maxTemp, entry?.temperatureMax, entry?.tempmax, entry?.max),
                low: toNumber(entry?.low, entry?.lowTemp, entry?.minTemp, entry?.temperatureMin, entry?.tempmin, entry?.min),
                description: pickValue(entry?.description, entry?.summary, entry?.condition, entry?.shortForecast, weatherEntry?.description, weatherEntry?.main, entry?.weather) || "Forecast unavailable",
                precipitationChance: toPercent(entry?.precipitationChance, entry?.precipChance, entry?.precipProbability, entry?.pop),
                icon: resolveWeatherIcon(entry?.icon, entry?.iconUrl, entry?.symbol, entry?.iconCode, weatherEntry?.icon),
            });
        });
    };
    const normalizeHourlyForecast = payload => {
        const rawHourly = payload?.forecast?.hourly || payload?.hourly || payload?.hours || payload?.forecastHourly || [];
        return rawHourly.slice(0, 8).map((entry, index) => {
            const weatherEntry = firstWeatherEntry(entry?.weather);
            return ({
                label: formatHourLabel(pickValue(entry?.label, entry?.time, entry?.hour, entry?.startsAt, entry?.timestamp, entry?.date), index),
                temperature: toNumber(entry?.temperature, entry?.temp, entry?.temp_f, entry?.temperatureF),
                description: pickValue(entry?.description, entry?.summary, entry?.condition, entry?.shortForecast, weatherEntry?.description, weatherEntry?.main, entry?.weather) || "Forecast unavailable",
                precipitationChance: toPercent(entry?.precipitationChance, entry?.precipChance, entry?.precipProbability, entry?.pop),
                icon: resolveWeatherIcon(entry?.icon, entry?.iconUrl, entry?.symbol, entry?.iconCode, weatherEntry?.icon),
            });
        });
    };
    const normalizeWeatherResponse = payload => ({
        location: normalizeLocation(payload),
        current: normalizeCurrent(payload),
        dailyForecast: normalizeDailyForecast(payload),
        hourlyForecast: normalizeHourlyForecast(payload),
        raw: payload,
    });
    const notify = () => {
        const snapshot = {
            ...state,
            data: state.data ? {...state.data} : null,
            coords: state.coords ? {...state.coords} : null,
        };
        listeners.forEach(listener => {
            try {
                listener(snapshot);
            } catch (error) {
                console.error("[weather] subscriber failed", error);
            }
        });
    };
    const setState = nextState => {
        Object.assign(state, nextState);
        notify();
    };
    const ensureCoordinates = () => {
        if (geolocationAttempt) return geolocationAttempt;
        geolocationAttempt = new Promise(resolve => {
            if (!navigator.geolocation) {
                resolve({...DEFAULT_COORDINATES, usingBrowserLocation: false});
                return;
            }
            navigator.geolocation.getCurrentPosition(position => {
                const coords = {
                    lat: Number(position?.coords?.latitude) || DEFAULT_COORDINATES.lat,
                    lon: Number(position?.coords?.longitude) || DEFAULT_COORDINATES.lon,
                    usingBrowserLocation: true,
                };
                setState({coords: {lat: coords.lat, lon: coords.lon}, usingBrowserLocation: true});
                resolve(coords);
            }, () => {
                resolve({...DEFAULT_COORDINATES, usingBrowserLocation: false});
            }, {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 10 * 60 * 1000,
            });
        });
        return geolocationAttempt;
    };
    const fetchWeather = async ({force = false} = {}) => {
        console.log("[weather] fetchWeather", {force});
        if (inFlightRequest && !force) return inFlightRequest;
        setState({loading: true, error: null});
        inFlightRequest = ensureCoordinates().then(coords => {
            const endpoint = buildWeatherEndpoint({lat: coords.lat, lon: coords.lon});
            return fetch(endpoint, {cache: "no-store"});
        }).then(async response => {
            if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
            return response.json();
        }).then(payload => {
            const normalized = normalizeWeatherResponse(payload);
            setState({
                data: normalized,
                error: null,
                loading: false,
                initialized: true,
                lastUpdated: new Date().toISOString(),
                locationLabel: normalized?.location?.name || (state.usingBrowserLocation ? "Current location" : "Cincinnati, OH"),
            });
            return normalized;
        }).catch(error => {
            console.error("[weather] fetch failed", error);
            setState({
                error,
                loading: false,
                initialized: true,
            });
            return state.data;
        }).finally(() => {
            inFlightRequest = null;
        });
        return inFlightRequest;
    };
    const initializeWeather = () => {
        if (!refreshTimer) {
            refreshTimer = window.setInterval(() => fetchWeather({force: true}), 10 * 60 * 1000);
        }
        return fetchWeather();
    };
    window.standardWeather = {
        initialize: initializeWeather,
        refresh: () => fetchWeather({force: true}),
        subscribe(listener) {
            if (typeof listener !== "function") return () => {};
            listeners.add(listener);
            listener({...state, data: state.data ? {...state.data} : null, coords: {...state.coords}});
            return () => listeners.delete(listener);
        },
        state: () => ({...state, data: state.data ? {...state.data} : null, coords: {...state.coords}}),
    };
    const weatherPortalMarkup = () => div({style: "weather-portal padded large-padding-top", content: children([
            div({style: "weather-hero", content: children([
                    div({style: "weather-hero-copy bordered radius padded shadowed", content: children([
                            div({style: "weather-location", content: state.locationLabel}),
                            div({ style: "", content: children([
                                    div({style: "weather-current-icon padded inline float-left", content: ""}),
                                    div({style: "inline", content: children([
                                            div({style: "weather-current-temp", content: "--\u00B0F"}),
                                            div({style: "weather-current-summary", content: "Loading forecast..."}),
                                        ])
                                    }),
                                ])
                            }),
                            div({style: "weather-last-updated", content: "Fetching latest conditions"}),
                        ])
                    }),
                    div({style: "weather-stat-grid", content: children([
                            div({style: "weather-stat-card bordered radius padded shadowed", content: children([div({style: "weather-stat-label faded", content: "Feels like"}), div({style: "weather-stat-value weather-feels-like", content: "--\u00B0F"})])}),
                            div({style: "weather-stat-card bordered radius padded shadowed", content: children([div({style: "weather-stat-label faded", content: "Humidity"}), div({style: "weather-stat-value weather-humidity", content: "--"})])}),
                            div({style: "weather-stat-card bordered radius padded shadowed", content: children([div({style: "weather-stat-label faded", content: "Wind"}), div({style: "weather-stat-value weather-wind", content: "--"})])}),
                        ])
                    })
                ])
            }),
            div({style: "weather-error padded hidden radius", content: "Weather unavailable right now."}),
            div({style: "weather-panels", content: children([
                    div({style: "weather-panel padded", content: children([
                            h({level: 3, style: "weather-panel-title", content: "Next Hours"}),
                            div({style: "weather-hourly-list", content: div({style: "weather-empty-state", content: "Waiting for forecast data..."})})
                        ])
                    }),
                    div({style: "weather-panel padded", content: children([
                            h({level: 3, style: "weather-panel-title", content: "Extended Forecast"}),
                            div({style: "weather-daily-list", content: div({style: "weather-empty-state", content: "Waiting for forecast data..."})})
                        ])
                    })
                ])
            })
        ])
    });
    const renderPortal = (windowNode, routeContext, snapshot) => {
        if (!(windowNode instanceof HTMLElement)) return;
        const locationNode = windowNode.querySelector(".weather-location");
        const tempNode = windowNode.querySelector(".weather-current-temp");
        const summaryNode = windowNode.querySelector(".weather-current-summary");
        const updatedNode = windowNode.querySelector(".weather-last-updated");
        const currentIconNode = windowNode.querySelector(".weather-current-icon");
        const feelsLikeNode = windowNode.querySelector(".weather-feels-like");
        const humidityNode = windowNode.querySelector(".weather-humidity");
        const windNode = windowNode.querySelector(".weather-wind");
        const hourlyListNode = windowNode.querySelector(".weather-hourly-list");
        const dailyListNode = windowNode.querySelector(".weather-daily-list");
        const errorNode = windowNode.querySelector(".weather-error");
        if (!locationNode || !tempNode || !summaryNode || !updatedNode || !currentIconNode || !feelsLikeNode || !humidityNode || !windNode || !hourlyListNode || !dailyListNode || !errorNode) return;
        const weather = snapshot?.data;
        const current = weather?.current || {};
        locationNode.textContent = weather?.location?.name || snapshot?.locationLabel || "Weather";
        tempNode.textContent = formatTemperature(current?.temperature);
        currentIconNode.innerHTML = current?.icon ? img({src: current.icon, style: "large-icon contained float-left space-right"}) : "";
        currentIconNode.style.display = current?.icon ? "" : "none";
        summaryNode.textContent = current?.description || (snapshot?.loading ? "Loading forecast..." : "Forecast unavailable");
        updatedNode.textContent = formatTimestamp(current?.updatedAt || snapshot?.lastUpdated);
        feelsLikeNode.textContent = formatTemperature(current?.feelsLike);
        humidityNode.textContent = formatPercent(current?.humidity);
        windNode.textContent = formatWind(current?.windSpeed);
        if (snapshot?.error) {
            errorNode.textContent = weather ? "Showing saved weather because the latest request failed." : "Weather unavailable right now.";
            errorNode.style.display = "";
        } else {
            errorNode.textContent = "Weather unavailable right now.";
            errorNode.style.display = "none";
        }
        const hourlyCards = (weather?.hourlyForecast || []).map(hour => div({
            style: "weather-hour-card bordered radius padded shadowed", content: children([
                div({style: "weather-hour-label faded", content: hour.label || "Now"}),
                hour?.icon ? div({content: img({src: hour.icon, style: "icon contained brick"})}) : "",
                div({style: "weather-hour-temp", content: formatTemperature(hour.temperature)}),
                div({style: "weather-hour-summary faded", content: hour.description || "Unavailable"}),
                div({style: "weather-hour-rain faded", content: `Rain ${formatPercent(hour.precipitationChance)}`}),
            ])
        }));
        hourlyListNode.innerHTML = hourlyCards.length ? children(hourlyCards) : div({style: "weather-empty-state", content: "Hourly forecast unavailable."});
        const dailyRows = (weather?.dailyForecast || []).map(day => div({
            style: "weather-day-row bordered radius padded shadowed", content: children([
                day?.icon ? img({src: day.icon, style: "icon contained float-left space-right"}) : "",
                div({style: "weather-day-copy", content: children([div({style: "weather-day-label", content: day.label || "Day"})])}),
                div({style: "weather-day-temps padded", content: children([
                        div({style: "weather-day-high inline", content: formatTemperature(day.high)}),
                        div({style: "weather-day-low inline faded", content: formatTemperature(day.low)}),
                        div({style: "weather-day-rain faded brick", content: formatPercent(day.precipitationChance)}),
                    ])
                }),
                div({style: "weather-day-summary faded", content: day.description || "Forecast unavailable"}),
            ])
        }));
        dailyListNode.innerHTML = dailyRows.length ? children(dailyRows) : div({style: "weather-empty-state", content: "Extended forecast unavailable."});
    };
    const subscribePortal = (windowNode, routeContext) => {
        if (!(windowNode instanceof HTMLElement)) return;
        const previousUnsub = windowNode.__weatherPortalUnsub;
        if (typeof previousUnsub === "function") previousUnsub();
        windowNode.__weatherPortalUnsub = window.standardWeather.subscribe(snapshot => renderPortal(windowNode, routeContext, snapshot));
        window.standardWeather.initialize();
    };
    const registerWeatherService = () => {
        modular.register(new Service(WEATHER_SERVICE_ID, [new Portal({
            title: "Weather",
            hints: ["weather", "forecast", "temperature", "rain"],
            dimensions: [900, 620],
            navigation: false,
            icon: WEATHER_INTERFACE_ICON,
            svg_icon: WEATHER_ICON,
            tools: [{
                title: "Refresh forecast",
                icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>`,
                onclick: () => window.standardWeather?.refresh?.()
            }],
            route: weatherPortalMarkup,
            afterRender(windowNode, routeContext) {
                subscribePortal(windowNode, routeContext);
            }
        })]));
        console.info("[weather] service registered");
    };
    const waitForWeatherDependencies = (attempt = 0) => {
        const ready = typeof modular !== "undefined" && typeof Service !== "undefined" && typeof Portal !== "undefined" && typeof div === "function" && typeof children === "function" && typeof h === "function";
        if (ready) {
            registerWeatherService();
            return;
        }
        if (attempt >= 100) return;
        window.setTimeout(() => waitForWeatherDependencies(attempt + 1), 50);
    };
    waitForWeatherDependencies();
})();