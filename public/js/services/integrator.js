(() => {
    const SERVICE_ID = "com.standard.integrator";

    modular.register(new Service(SERVICE_ID, [new Portal({
        title: "Integrator",
        hints: ["integrator", "integration"],
        internal: true,
        dimensions: [520, 420],
        navigation: false,
        icon: "/icons/interfaces/cli.png",
        route: () => div({style: "large-padding-top small-padding", content: div({style: "padded bordered radius", content: children([
            h({level: 3, content: "Integrator"}),
            div({style: "faded", content: "Internal integration portal"})
        ])})})
    })]));
})();
