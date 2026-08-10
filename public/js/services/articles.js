(() => {

    const articleListRecords = new Map();
    const createArticleIconState = {file: null, objectUrl: ""};
    const escapeQuoted = value => String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const safeUrl = value => /^(https?:\/\/|mailto:)/i.test(String(value || "").trim()) ? String(value).trim() : "";
    const articleImage = article => article.id ? `/api/records/images/${encodeURIComponent(article.id)}?cb=${Date.now()}` : "/icons/interfaces/articles.png";

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
            div({style: "padded", content: multiline ? textarea({id, style: "undecorated no-padding fill articles-textarea", value: String(value ?? "")}) : input({id, type, style: "undecorated no-padding fill", value: String(value ?? "")})})
        ])
    });

    const resetArticleIconPicker = (icon, state) => {
        if (!icon || !state) return null;
        const previousInput = state.input || icon.__articleIconInput;
        if (previousInput?.remove) previousInput.remove();
        icon.onclick = null;
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);
        icon.__articleIconInput = fileInput;
        state.input = fileInput;
        return fileInput;
    };

    const releaseArticleIconPreview = state => {
        if (!state) return;
        if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
        if (state.input?.remove) state.input.remove();
        state.file = null;
        state.objectUrl = "";
        state.input = null;
    };

    const bindArticleIconPicker = (root, article, prefix, state) => {
        const icon = root?.querySelector?.(`#${prefix}-icon`) || document.getElementById(`${prefix}-icon`);
        if (!icon) return;
        icon.alt = `${article?.title || "Article"} icon`;
        icon.src = state.objectUrl || articleImage(article);
        icon.onerror = () => {
            icon.onerror = null;
            icon.src = "/icons/interfaces/articles.png";
        };
        icon.style.cursor = "pointer";
        const fileInput = resetArticleIconPicker(icon, state);
        if (!fileInput) return;
        icon.onclick = () => fileInput.click();
        fileInput.onchange = () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            if (!file.type?.startsWith("image/")) {
                fileInput.value = "";
                modular.error("Please choose an image file");
                return;
            }
            if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
            state.file = file;
            state.objectUrl = URL.createObjectURL(file);
            icon.onerror = null;
            icon.src = state.objectUrl;
            fileInput.value = "";
        };
    };

    const uploadArticleIcon = async (file, articleId) => {
        if (!file || !articleId) return {ok: true};
        if (typeof window.StandardUploads?.uploadFile === "function") {
            return window.StandardUploads.uploadFile(file, `/api/upload/temp/${encodeURIComponent(articleId)}`, {label: `Uploading ${file.name || "article icon"}`});
        }
        const formData = new FormData();
        formData.append("file", file);
        return fetch(`/api/upload/temp/${encodeURIComponent(articleId)}`, {method: "POST", body: formData}).then(response => ({ok: response.ok, status: response.status}));
    };

    const readForm = prefix => normalizeArticle({
        title: document.getElementById(`${prefix}-title`)?.value?.trim() || "",
        description: document.getElementById(`${prefix}-description`)?.value?.trim() || "",
        link: document.getElementById(`${prefix}-link`)?.value?.trim() || "",
        content: document.getElementById(`${prefix}-content`)?.value || "",
        source: document.getElementById(`${prefix}-source`)?.value?.trim() || "",
        priority: Number.parseInt(document.getElementById(`${prefix}-priority`)?.value, 10) || 0
    });

    const editorRoute = (article = {}, prefix = "article") => div({style: "large-padding-top small-padding", content: children([
        div({style: "center article-icon-picker-wrap", content: img({id: `${prefix}-icon`, style: "article-icon article-icon-picker", src: articleImage(article), title: "Choose article icon"})}),
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
        articleListRecords.delete(normalizedId);
    };

    const beginDeleteProgress = article => window.StandardDownloads?.beginOpenProgress?.(`Deleting ${article.title || "article"}`) || 0;
    const finishDeleteProgress = (token, label = "Article deleted") => {
        window.StandardDownloads?.updateOpenProgress?.({label, loaded: 1, total: 1, indeterminate: false, token});
        window.setTimeout(() => window.StandardDownloads?.hideOpenProgress?.(token), 220);
    };
    const hideDeleteProgress = token => window.StandardDownloads?.hideOpenProgress?.(token);

    const saveArticle = async (article, prefix, portal, iconState) => {
        const next = {...article, ...readForm(prefix)};
        if (!next.title || !next.description) return modular.error("Title and description are required");
        try {
            const responses = await Promise.all(["title", "description", "link", "content", "source"].map(key =>
                CLI.send(`[articles] ${key} "${escapeQuoted(next[key])}" <id ${article.id}>`)
            ).concat(CLI.send(`[articles] priority ${next.priority} <id ${article.id}>`)));
            if (responses.some(response => response === 0)) return modular.error("Failed to save article");
            if (iconState?.file) {
                const uploadResponse = await uploadArticleIcon(iconState.file, article.id);
                if (!uploadResponse?.ok) return modular.error(`Icon upload failed (${uploadResponse?.status || "unknown error"})`);
            }
        } catch (_) {
            return modular.error("Failed to save article");
        }
        releaseArticleIconPreview(iconState);
        portal?.close?.();
        refreshArticles();
        openArticle(next);
        modular.success("Saved article");
    };

    const deleteArticle = (article, portal = null) => confirmationDialogue({
        title: "Delete Article",
        content: `You're sure you want to delete ${escapeHtml(article.title || "this article")}?`,
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
        const iconState = {file: null, objectUrl: ""};
        const portal = new Portal({
            title: `Edit ${article.title || "Article"}`,
            dimensions: [520, 650],
            navigation: false,
            svg_icon: modular.icons.articles,
            tools: [
                {
                    title: "Delete",
                    icon: modular.icons.delete,
                    onclick: () => deleteArticle(article, portal)
                }, {
                    title: "Save",
                    icon: modular.icons.save,
                    onclick: () => saveArticle(article, "edit-article", portal, iconState)
                }
            ],
            route: () => editorRoute(article, "edit-article"),
            afterRender: root => bindArticleIconPicker(root, article, "edit-article", iconState),
            onDispose: () => releaseArticleIconPreview(iconState)
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
            dimensions: [520, 560],
            auto_height: true,
            navigation: false,
            svg_icon: modular.icons.articles,
            tools: [
                {
                    title: "Delete",
                    icon: modular.icons.delete,
                    onclick: () => deleteArticle(article, portal)
                }, {
                    title: "Edit",
                    icon: modular.icons.modify,
                    onclick: () => {
                        portal.close();
                        openEditor(article);
                    }
                }
            ],
            //<img class="article-icon internals-article-icon" src="${escapeHtml(articleImage(article))}" onerror="this.onerror=null;this.src='${DEFAULT_ARTICLE_ICON}'" alt="${escapeHtml(title)}">
            route: () => div({style: "large-padding-top small-padding", content: children([
                    div({style: "internals-article-preview padded", content: children([
                            div({style: "float-right inner-radius background-secondary faded small-padding smaller", content: escapeHtml(article.description || "")}),
                            img({style: "article-icon internals-article-icon", src: escapeHtml(articleImage(article))}),
                            div({style: "internals-article-header", content: children([
                                    h({level: 2, content: article.title}),
                                    a({style: "no-wrap", src: link, content: link}),
                                ])
                            }),
                            div({style: "", content: renderContent(article.content)}),
                            div({style: "internals-article-meta"}),
                            a({style: "", src: source, content: source}),
                            div({style: "smaller faded margin-top", content: `Priority ${escapeHtml(article.priority)} · ${escapeHtml(article.created)}`}),
                        ])
                    })
                ])
            })
        });
        portal.show();
        return true;
    };

    const createArticle = async portal => {
        const article = readForm("new-article");
        if (!article.title || !article.description) return modular.error("Title and description are required");
        let articleId = "";
        try {
            const response = await CLI.send(`[articles] + ("${escapeQuoted(article.title)}", "${escapeQuoted(article.description)}", "${escapeQuoted(article.link)}", "${escapeQuoted(article.content)}", "${escapeQuoted(article.source)}", ${article.priority}, @)`);
            articleId = String(response ?? "").trim();
            if (!articleId || articleId === "0") return modular.error("Failed to create article");
        } catch (_) {
            return modular.error("Failed to create article");
        }
        if (createArticleIconState.file) {
            let uploadResponse;
            try {
                uploadResponse = await uploadArticleIcon(createArticleIconState.file, articleId);
            } catch (_) {
                uploadResponse = {ok: false, status: "network error"};
            }
            if (!uploadResponse?.ok) {
                releaseArticleIconPreview(createArticleIconState);
                portal?.close?.();
                refreshArticles();
                return modular.error(`Article created, but icon upload failed (${uploadResponse?.status || "unknown error"})`);
            }
        }
        releaseArticleIconPreview(createArticleIconState);
        portal?.close?.();
        refreshArticles();
        modular.success("Created article");
    };

    const createPortal = new Portal({
        title: "Create Article",
        hints: ["create article", "new article", "write article"],
        dimensions: [520, 650],
        navigation: false,
        svg_icon: modular.icons.articles,
        tools: [
            {
                title: "Save",
                icon: modular.icons.save,
                onclick: (_, context) => createArticle(context?.portal)
            }
        ],
        route: () => editorRoute({}, "new-article"),
        afterRender: root => bindArticleIconPicker(root, {}, "new-article", createArticleIconState),
        onDispose: () => releaseArticleIconPreview(createArticleIconState)
    });

    window.StandardArticles = {openArticle, openEditor};

    const renderArticleList = articles => div({style: "articles-list", content: children(articles.map(article => {
        articleListRecords.set(String(article.id || ""), article);
        return div({style: "article-tile padded hidden secondary-tile bordered line margin-top small-spaced hover-shadowed radius", data: String(article.id || ""), onclick: event => {
                if (event.target.closest("button")) return;
                openArticle(article);
            }, content: children([
                img({style: "article-icon articles-list-icon float-left", src: articleImage(article)}),
                div({style: "float-right inner-radius background-secondary faded small-padding smaller", content: escapeHtml(article.description || "")}),
                strong({content: escapeHtml(article.title || "Untitled Article")}),
                (article.link ? div({style: "no-wrap", content: a({style: "faded", src: article.link, content: article.link})}) : ""),
                (article.content ? div({style: "padding-top padding-bottom", content: escapeHtml(article.content || "")}) : ""),
                div({style: "smaller faded", content: `Priority ${escapeHtml(article.priority)} · ${escapeHtml(article.created || "")}`})
            ])
        });
    }))});

    const renderArticleSearchResults = payload => {
        const articles = recordsFrom(payload).sort((a, b) => Number(b.priority) - Number(a.priority) || String(b.created).localeCompare(String(a.created)));
        if (!articles.length) return emptyState({icon: "/icons/interfaces/articles.png", label: "No articles"});
        return renderArticleList(articles);
    };

    const bindArticleListContextMenu = root => {
        const resultsHost = root?.querySelector?.("#articles-list-results");
        if (!resultsHost || resultsHost.dataset.contextMenuBound === "1") return;
        resultsHost.dataset.contextMenuBound = "1";
        const hasArticleTarget = (_root, target) => !!target?.closest?.(".article-tile");
        const getArticleFromTile = tile => articleListRecords.get(String(tile?.getAttribute("data") || ""));
        resultsHost.contextmenu([{
            icon: modular.icons.open,
            label: "Open",
            visible: hasArticleTarget,
            action: (_root, _event, tile) => {
                const article = getArticleFromTile(tile);
                if (article) openArticle(article);
            }
        }, {
            icon: modular.icons.modify,
            label: "Edit",
            visible: hasArticleTarget,
            action: (_root, _event, tile) => {
                const article = getArticleFromTile(tile);
                if (article) openEditor(article);
            }
        }, {
            icon: modular.icons.delete,
            label: "Delete",
            destructive: true,
            visible: hasArticleTarget,
            action: (_root, _event, tile) => {
                const article = getArticleFromTile(tile);
                if (article) deleteArticle(article);
            }
        }], ".article-tile");
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
                resultsHost.innerHTML = emptyState({icon: "/icons/interfaces/articles.png", label: "Unable to search articles"});
            }
        });
    };

    modular.register(new Service("com.standard.articles", [
        new Portal({
            title: "Articles",
            hints: ["articles", "article manager", "publishing"],
            dimensions: [520, 560],
            navigation: false,
            svg_icon: modular.icons.articles,
            icon: "/icons/interfaces/articles.png",
            tools: [{
                title: "Create Article",
                icon: modular.icons.create,
                onclick: () => modular.show("com.standard.articles", 1)
            }],
            route: () => div({style: "large-padding-top small-padding", content: div({id: "articles-list-results", content: () => CLI.send("[articles] <LIMIT 25>").then(payload => {
                const articles = recordsFrom(payload).sort((a, b) => Number(b.priority) - Number(a.priority) || String(b.created).localeCompare(String(a.created)));
                if (!articles.length) return emptyState({icon: "/icons/interfaces/articles.png", label: "No articles"});
                return renderArticleList(articles);
            }).catch(() => emptyState({icon: "/icons/interfaces/articles.png", label: "Unable to load articles"}))})}),
            afterRender: root => {
                bindArticleSearch(root);
                bindArticleListContextMenu(root);
            }
        }),
        createPortal
    ]));
})();
