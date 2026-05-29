(() => {
    const registerWeatherWidget = () => {
        const renderWidgetMarkup = () => div({
            style: "weather-widget",
            content: children([
                div({style: "weather-widget-location", content: "Weather"}),
                div({style: "weather-widget-current", content: children([
                    div({style: "weather-widget-icon hidden", content: ""}),
                    div({style: "weather-widget-temp", content: "--\u00B0F"}),
                    div({style: "weather-widget-summary", content: "Loading..."})
                ])}),
            ])
        });
        const bindWidget = widgetNode => {
            if (!(widgetNode instanceof HTMLElement) || !window.standardWeather) return;
            const locationNode = widgetNode.querySelector(".weather-widget-location");
            const tempNode = widgetNode.querySelector(".weather-widget-temp");
            const summaryNode = widgetNode.querySelector(".weather-widget-summary");
            const iconNode = widgetNode.querySelector(".weather-widget-icon");
            if (!locationNode || !tempNode || !summaryNode || !iconNode) return;
            if (typeof widgetNode.__weatherWidgetUnsub === "function") {
                widgetNode.__weatherWidgetUnsub();
            }
            widgetNode.__weatherWidgetUnsub = window.standardWeather.subscribe(snapshot => {
                const weather = snapshot?.data;
                locationNode.textContent = weather?.location?.name || snapshot?.locationLabel || "Weather";
                if (snapshot?.loading && !weather) {
                    tempNode.textContent = "--\u00B0F";
                    summaryNode.textContent = "Loading...";
                    iconNode.innerHTML = "";
                    iconNode.style.display = "none";
                    return;
                }
                if (snapshot?.error && !weather) {
                    tempNode.textContent = "--\u00B0F";
                    summaryNode.textContent = "Weather unavailable";
                    iconNode.innerHTML = "";
                    iconNode.style.display = "none";
                    return;
                }
                tempNode.textContent = Number.isFinite(weather?.current?.temperature)
                    ? `${Math.round(weather.current.temperature)}\u00B0F`
                    : "--\u00B0F";
                summaryNode.textContent = weather?.current?.description || "Unavailable";
                iconNode.innerHTML = weather?.current?.icon
                    ? img({src: weather.current.icon, style: "small-icon contained float-left small-space-right"})
                    : "";
                iconNode.style.display = weather?.current?.icon ? "" : "none";
            });
            widgetNode.onclick = () => modular.start("com.standard.weather");
            widgetNode.title = "Open Weather";
            window.standardWeather.initialize();
        };
        modular.registerWidget(new Widget({
            id: "com.standard.widgets.weather",
            portal: "com.standard.weather",
            title: "Weather",
            icon: "/icons/interfaces/weather.png",
            dimensions: [260, 110],
            navigation: false,
            show_title: false,
            route: renderWidgetMarkup,
            afterRender: widgetNode => bindWidget(widgetNode),
        }));
        console.info("[weather] widget registered");
    };
    const waitForWidgetDependencies = (attempt = 0) => {
        const ready = typeof modular !== "undefined"
            && typeof Widget !== "undefined"
            && typeof div === "function"
            && typeof children === "function"
            && typeof window.standardWeather !== "undefined";
        if (ready) {
            registerWeatherWidget();
            return;
        }
        if (attempt >= 100) {
            console.error("[weather] widget dependencies never became ready");
            return;
        }
        window.setTimeout(() => waitForWidgetDependencies(attempt + 1), 50);
    };
    waitForWidgetDependencies();
})();
