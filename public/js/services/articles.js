(() => {

    const ARTICLE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75h1.5m9 0h-9"/></svg>`;
    const DEFAULT_ARTICLE_ICON = "/icons/interfaces/articles.svg";
    const escapeQuoted = value => String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const safeUrl = value => /^(https?:\/\/|mailto:)/i.test(String(value || "").trim()) ? String(value).trim() : "";
    const articleImage = article => article.id ? `/api/records/images/${encodeURIComponent(article.id)}?cb=${Date.now()}` : DEFAULT_ARTICLE_ICON;

    const normalizeArticle = (article = {}) => ({
        ...article,
        id: article.id ?? "",
        title: article.title ??  article.ttl ?? "",
        description: article.description ?? "",
        link: article.link ?? "",
        content: article.content ?? "",
        source: article.source ?? "",
        priority: article.priority ?? 0,
        created: article.created ?? ""
    });

    const recordsFrom = payload => {
        if (payload === 0 || !payload) return [];
        const records = Array.isArray(payload) ? payload : (payload.articles || payload.article || payload.ARTS || payload.ART || []);
        return Array.isArray(records) ? records.map(normalizeArticle) : [];
    };

    const renderInline = value => escapeHtml(String(value || ""))
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    const renderContent = value => String(value || "").replace(/\r\n?/g, "\n").split(/\n{2,}/).map(block => {
        const heading = block.match(/^(#{1,6})\s+(.+)$/);
        if (heading) return `<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>`;
        return `<p>${block.split("\n").map(renderInline).join("<br>")}</p>`;
    }).join("");

    const field = (id, label, value = "", {
        textarea: multiline = false, type = "text"} = {}) => div({
        style: "articles-field",
        content: children([
            div({style: "bold small-padding", content: label}),
            div({style: "padded", content: multiline
                ? textarea({id, style: "undecorated no-padding fill articles-textarea", value: String(value ?? "")})
                : input({id, type, style: "undecorated no-padding fill", value: String(value ?? "")})})
        ])
    });

    const readForm = prefix => normalizeArticle({
        title: document.getElementById(`${prefix}-title`)?.value?.trim() || "",
        description: document.getElementById(`${prefix}-description`)?.value?.trim() || "",
        link: document.getElementById(`${prefix}-link`)?.value?.trim() || "",
        content: document.getElementById(`${prefix}-content`)?.value || "",
        source: document.getElementById(`${prefix}-source`)?.value?.trim() || "",
        priority: Number.parseInt(document.getElementById(`${prefix}-priority`)?.value, 10) || 0
    });

    const editorRoute = (article = {}, prefix = "article") => div({style: "large-padding-top small-padding", content: children([
        field(`${prefix}-title`, "Title", article.title),
        field(`${prefix}-description`, "Description", article.description),
        field(`${prefix}-link`, "Link", article.link),
        field(`${prefix}-content`, "Content", article.content, {textarea: true}),
        field(`${prefix}-source`, "Source", article.source),
        field(`${prefix}-priority`, "Priority", article.priority, {type: "number"})
    ])});

    const refreshArticles = () => modular.refresh("com.standard.articles");

    const removeArticleFromLists = articleId => {
        const normalizedId = String(articleId || "");
        document.querySelectorAll('.article-tile[data]').forEach(tile => {
            if (tile.getAttribute("data") === normalizedId) tile.remove();
        });
    };

    const beginDeleteProgress = article => window.StandardDownloads?.beginOpenProgress?.(`Deleting ${article.title || "article"}`) || 0;
    const finishDeleteProgress = (token, label = "Article deleted") => {
        window.StandardDownloads?.updateOpenProgress?.({label, loaded: 1, total: 1, indeterminate: false, token});
        window.setTimeout(() => window.StandardDownloads?.hideOpenProgress?.(token), 220);
    };
    const hideDeleteProgress = token => window.StandardDownloads?.hideOpenProgress?.(token);

    const saveArticle = async (article, prefix, portal) => {
        const next = {...article, ...readForm(prefix)};
        if (!next.title || !next.description) return modular.error("Title and description are required");
        const responses = await Promise.all(["title", "description", "link", "content", "source"].map(key =>
            CLI.send(`[articles] ${key} "${escapeQuoted(next[key])}" <id ${article.id}>`)
        ).concat(CLI.send(`[articles] priority ${next.priority} <id ${article.id}>`)));
        if (responses.some(response => response === 0)) return modular.error("Failed to save article");
        portal?.close?.();
        refreshArticles();
        openArticle(next);
        modular.success("Saved article");
    };

    const deleteArticle = (article, portal = null) => confirmationDialogue({
        title: "Delete Article?",
        content: "Confirm deleting" + escapeHtml(article.title || "this article"),
        destructive: true,
        confirmation: async () => {
            const progressToken = beginDeleteProgress(article);
            try {
                const response = await CLI.send(`[articles] - <id ${article.id}>`);
                if (response === 0) {
                    hideDeleteProgress(progressToken);
                    return modular.error("Failed to delete article");
                }
                removeArticleFromLists(article.id);
                portal?.close?.();
                finishDeleteProgress(progressToken);
                modular.success("Deleted article");
            } catch (_) {
                hideDeleteProgress(progressToken);
                modular.error("Failed to delete article");
            }
        }
    });

    const openEditor = article => {
        article = normalizeArticle(article);
        const portal = new Portal({
            title: `Edit ${article.title || "Article"}`,
            dimensions: [560, 650], navigation: false, svg_icon: ARTICLE_ICON,
            tools: [
                {title: "Delete", icon: modular.icons.delete, onclick: () => deleteArticle(article, portal)},
                {title: "Save", icon: modular.icons.save, onclick: () => saveArticle(article, "edit-article", portal)}
            ],
            route: () => editorRoute(article, "edit-article")
        });
        portal.show();
        return portal;
    };

    const openArticle = article => {
        article = normalizeArticle(article);
        const title = article.title.trim() || "Untitled Article";
        const link = safeUrl(article.link);
        const source = safeUrl(article.source);
        const portal = new Portal({
            title,
            dimensions: [680, 560],
            navigation: false,
            svg_icon: ARTICLE_ICON,
            tools: [
                {
                    title: "Delete",
                    icon: modular.icons.delete,
                    onclick: () => deleteArticle(article, portal)
                },
                {
                    title: "Edit",
                    icon: modular.icons.modify,
                    onclick: () => {
                        portal.close();
                        openEditor(article);
                    }
                }
            ],
            route: () => div({style: "large-padding-top small-padding", content: `<div class="internals-article-preview"><div class="internals-article-header"><div class="internals-article-meta"><div>${escapeHtml(article.created)}</div><div>Priority ${escapeHtml(article.priority)}</div></div><img class="article-icon internals-article-icon" src="${escapeHtml(articleImage(article))}" onerror="this.onerror=null;this.src='${DEFAULT_ARTICLE_ICON}'" alt="${escapeHtml(title)}"><h2>${escapeHtml(title)}</h2><div>${escapeHtml(article.description)}</div>${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.link)}</a>` : ""}</div><div class="internals-article-content">${renderContent(article.content)}</div>${article.source ? `<div class="internals-article-source faded">Source: ${source ? `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.source)}</a>` : escapeHtml(article.source)}</div>` : ""}</div>`})
        });
        portal.show();
        return true;
    };

    const createArticle = async portal => {
        const article = readForm("new-article");
        if (!article.title || !article.description) return modular.error("Title and description are required");
        const response = await CLI.send(`[articles] + ("${escapeQuoted(article.title)}", "${escapeQuoted(article.description)}", "${escapeQuoted(article.link)}", "${escapeQuoted(article.content)}", "${escapeQuoted(article.source)}", ${article.priority}, @)`);
        if (response === 0) return modular.error("Failed to create article");
        portal?.close?.();
        refreshArticles();
        modular.success("Created article");
    };

    const createPortal = new Portal({
        title: "Create Article", hints: ["create article", "new article", "write article"],
        dimensions: [560, 650], navigation: false, svg_icon: ARTICLE_ICON,
        tools: [{title: "Save", icon: modular.icons.save, onclick: (_, context) => createArticle(context?.portal)}],
        route: () => editorRoute({}, "new-article")
    });

    window.StandardArticles = {openArticle, openEditor};

    const renderArticleSearchResults = payload => {
        const articles = recordsFrom(payload).sort((a, b) => Number(b.priority) - Number(a.priority) || String(b.created).localeCompare(String(a.created)));
        if (!articles.length) return emptyState({icon: DEFAULT_ARTICLE_ICON, label: "No articles"});
        return div({style: "articles-list", content: children(articles.map(article => div({
            style: "article-tile padded secondary-tile line small-spaced hover-shadowed radius", data: String(article.id || ""), onclick: event => {
                if (event.target.closest("button")) return;
                openArticle(article);
            }, content: children([
                button({style: "naked inner-radius float-right expose small-padding", icon: modular.icons.modify, onclick: () => openEditor(article)}),
                button({style: "naked inner-radius float-right expose small-padding", icon: modular.icons.delete, onclick: () => deleteArticle(article)}),
                img({style: "article-icon articles-list-icon inline", src: articleImage(article)}),
                strong({content: escapeHtml(article.title || "Untitled Article")}),
                div({style: "smaller faded", content: escapeHtml(article.description || "")}),
                div({style: "tiny faded", content: `Priority ${escapeHtml(article.priority)} · ${escapeHtml(article.created || "")}`})
            ])
        })))});
    };

    const bindArticleSearch = root => {
        const contentRoot = root?.querySelector?.(".large-padding-top.small-padding");
        const resultsHost = contentRoot?.querySelector?.("#articles-list-results");
        if (!contentRoot || !resultsHost || contentRoot.querySelector("#articles-search-input")) return;
        const searchInput = document.createElement("input");
        searchInput.id = "articles-search-input";
        searchInput.type = "search";
        searchInput.className = "fill fixed";
        searchInput.placeholder = "Search article titles";
        searchInput.setAttribute("aria-label", "Search article titles");
        searchInput.style.boxSizing = "border-box";
        const searchSpacer = document.createElement("div");
        searchSpacer.className = "large-padding-top padded";
        contentRoot.prepend(searchSpacer);
        contentRoot.prepend(searchInput);
        const constrainSearchWidth = () => {
            if (!contentRoot.isConnected) return;
            const contentBounds = contentRoot.getBoundingClientRect();
            const inputBounds = searchInput.getBoundingClientRect();
            searchInput.style.maxWidth = `${Math.max(0, contentBounds.right - inputBounds.left)}px`;
        };
        constrainSearchWidth();
        if (typeof ResizeObserver === "function") {
            const resizeObserver = new ResizeObserver(constrainSearchWidth);
            resizeObserver.observe(contentRoot);
        }
        searchInput.addEventListener("keyup", async event => {
            if (event.key !== "Enter") return;
            const query = searchInput.value.trim();
            if (!query) return;
            resultsHost.innerHTML = "Loading...";
            try {
                const payload = await CLI.send(`[articles] <title CONTAINS "${escapeQuoted(query)}" IGNORE CASE>`);
                resultsHost.innerHTML = renderArticleSearchResults(payload);
            } catch (_) {
                resultsHost.innerHTML = emptyState({icon: DEFAULT_ARTICLE_ICON, label: "Unable to search articles"});
            }
        });
    };

    modular.register(new Service("com.standard.articles", [
        new Portal({
            title: "Articles", hints: ["articles", "article manager", "publishing"], dimensions: [560, 600], navigation: false,
            svg_icon: ARTICLE_ICON, icon: DEFAULT_ARTICLE_ICON,
            tools: [{title: "Create Article", icon: modular.icons.create, onclick: () => modular.show("com.standard.articles", 1)}],
            route: () => div({style: "large-padding-top small-padding", content: div({id: "articles-list-results", content: () => CLI.send("[articles] <LIMIT 25>").then(payload => {
                const articles = recordsFrom(payload).sort((a, b) => Number(b.priority) - Number(a.priority) || String(b.created).localeCompare(String(a.created)));
                if (!articles.length) return emptyState({icon: DEFAULT_ARTICLE_ICON, label: "No articles"});
                return div({style: "articles-list", content: children(articles.map(article => div({
                    style: "article-tile padded secondary-tile line small-spaced hover-shadowed radius", data: String(article.id || ""), onclick: event => {
                        if (event.target.closest("button")) return;
                        openArticle(article);
                    }, content: children([
                        button({style: "naked inner-radius float-right expose small-padding", icon: modular.icons.modify, onclick: () => openEditor(article)}),
                        button({style: "naked inner-radius float-right expose small-padding", icon: modular.icons.delete, onclick: () => deleteArticle(article)}),
                        img({style: "article-icon articles-list-icon inline", src: articleImage(article)}),
                        strong({content: escapeHtml(article.title || "Untitled Article")}),
                        div({style: "smaller faded", content: escapeHtml(article.description || "")}),
                        div({style: "tiny faded", content: `Priority ${escapeHtml(article.priority)} · ${escapeHtml(article.created || "")}`})
                    ])
                })))})
            }).catch(() => emptyState({icon: DEFAULT_ARTICLE_ICON, label: "Unable to load articles"}))})}),
            afterRender: bindArticleSearch
        }),
        createPortal
    ]));
})();
