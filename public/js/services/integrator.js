(() => {
	const SERVICE_ID = "com.standard.integrator";
	const escapeHtml = (v = "") => `${v ?? ""}`.replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"}[c] || c));
	const renderIntegrations = async () => {
		const r = await fetch("/api/integrations", {credentials: "same-origin", cache: "no-store"});
		if (!r.ok) throw new Error(`Failed to load integrations (${r.status})`);
		const payload = await r.json();
		const integrations = Array.isArray(payload?.integrations) ? payload.integrations : [];
		const content = integrations.length ? integrations.map(integration => {
			const name = escapeHtml(integration?.name || "Integration");
			const iconSource = `${integration?.icon || ""}`.trim();
			const icon = /^\/[a-zA-Z0-9/_.-]+$/.test(iconSource) ? iconSource : "";
			return div({style: "settings-interface-item bordered radius", content: div({
				style: "settings-interface-row",
				content: children([
					div({style: "settings-interface-icon", content: icon ? img({src: icon, alt: name}) : ""}),
					div({style: "settings-interface-copy", content: div({style: "settings-interface-title", content: name})})
				])
			})});
		}).join("") : div({style: "faded small-padding", content: "No integrations are configured."});

		return div({style: "large-padding-top small-padding", content: children([
			div({style: "padded", content: children([
				h({level: 3, content: "Integrations"}),
				div({style: "faded", content: "Connections for these services will be available here."})
			])}),
			div({style: "settings-interfaces-list small-padding", content})
		])});
	};

	modular.register(new Service(SERVICE_ID, [new Portal({
		title: "Integrator",
		hints: ["integrator", "integration", "apis"],
		dimensions: [420, 450],
		navigation: false,
		svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v2.25A2.25 2.25 0 0 0 6 10.5Zm0 9.75h2.25A2.25 2.25 0 0 0 10.5 18v-2.25a2.25 2.25 0 0 0-2.25-2.25H6a2.25 2.25 0 0 0-2.25 2.25V18A2.25 2.25 0 0 0 6 20.25Zm9.75-9.75H18a2.25 2.25 0 0 0 2.25-2.25V6A2.25 2.25 0 0 0 18 3.75h-2.25A2.25 2.25 0 0 0 13.5 6v2.25a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>`,
		icon: "/icons/interfaces/cli.png",
		route: renderIntegrations
	})]));
})();
