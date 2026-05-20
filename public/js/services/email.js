(() => {
    const EMAIL_SERVICE_ID = "com.standard.email";
    const EMAIL_DRAG_MIME = "application/x-standard-email";
    const escapeEmailCommandValue = value => String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    const buildFolderCommand = folder => folder === "everything" ? "[email]" : `[email] <folder "${escapeEmailCommandValue(folder || "inbox")}">`;
    const buildReadStateCommand = (recordId, read) => `[email] read ${read ? "true" : "false"} <id "${escapeEmailCommandValue(recordId)}">`;
    const buildStarredStateCommand = (recordId, starred) => `[email] starred ${starred ? "true" : "false"} <id "${escapeEmailCommandValue(recordId)}">`;
    const buildCategoryCommand = (recordId, category) => `[email] category ${category ? escapeEmailCommandValue(category) : "\"\""} <id "${escapeEmailCommandValue(recordId)}">`;
    const buildReplyCommand = recordId => `[email] reply <id "${escapeEmailCommandValue(recordId)}">`;
    const buildMoveFolderCommand = (recordId, folder) => `[email] folder "${escapeEmailCommandValue(folder)}" <id "${escapeEmailCommandValue(recordId)}">`;
    const EMAIL_FOLDERS = [
        {folder: "inbox", title: "Inbox", icon: "inbox"},
        {folder: "sent", title: "Sent", icon: "sent"},
        {folder: "everything", title: "Everything", icon: "everything"},
        {folder: "archived", title: "Archive", icon: "archive"},
        {folder: "spam", title: "Spam", icon: "spam"},
        {folder: "deleted", title: "Deleted", icon: "deleted"}
    ];
    const MAIL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>`;
    const INBOX_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3" /></svg>`;
    const SENT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>`;
    const EVERYTHING_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m7.875 14.25 1.214 1.942a2.25 2.25 0 0 0 1.908 1.058h2.006c.776 0 1.497-.4 1.908-1.058l1.214-1.942M2.41 9h4.636a2.25 2.25 0 0 1 1.872 1.002l.164.246a2.25 2.25 0 0 0 1.872 1.002h2.092a2.25 2.25 0 0 0 1.872-1.002l.164-.246A2.25 2.25 0 0 1 16.954 9h4.636M2.41 9a2.25 2.25 0 0 0-.16.832V12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 12V9.832c0-.287-.055-.57-.16-.832M2.41 9a2.25 2.25 0 0 1 .382-.632l3.285-3.832a2.25 2.25 0 0 1 1.708-.786h8.43c.657 0 1.281.287 1.709.786l3.284 3.832c.163.19.291.404.382.632M4.5 20.25h15A2.25 2.25 0 0 0 21.75 18v-2.625c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125V18a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>`;
    const ARCHIVE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>`;
    const SPAM_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>`;
    const DELETED_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`;
    const READ_UNREAD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 9v8.25A2.25 2.25 0 0 1 19.5 19.5h-15a2.25 2.25 0 0 1-2.25-2.25V9m19.5 0A2.25 2.25 0 0 0 19.5 6.75h-15A2.25 2.25 0 0 0 2.25 9m19.5 0-8.25 5.25a2.25 2.25 0 0 1-3 0L2.25 9" /></svg>`;
    const CATEGORY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l8.682 8.682a2.25 2.25 0 0 0 3.182 0l4.318-4.318a2.25 2.25 0 0 0 0-3.182L11.159 3.659A2.25 2.25 0 0 0 9.568 3Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>`;
    const REPLY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>`;
    const ARCHIVE_ACTION_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>`;
    const STAR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>`;
    const CATEGORY_ACTION_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>`;
    let emailListPaneWidth = 340;
    let activeEmailResize = null;
    let mailboxMessages = [];
    let selectedMailboxMessageId = "";
    const selectedMailboxMessageIds = new Set();
    let activeMailboxFolder = "inbox";
    let activeViewerMessage = null;
    let activeViewerFolderTitle = "";
    let activeViewerFolder = "";
    const mailboxCache = new Map();
    const mailboxFetches = new Map();
    let mailboxPrefetchStarted = false;
    const escapeMarkup = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const firstValue = (record, keys, fallback = "") => {
        for (const key of keys) {
            const value = record?.[key];
            if (value !== undefined && value !== null && `${value}`.trim() !== "") return value;
        }
        return fallback;
    };
    const stripMarkup = value => {
        const raw = String(value ?? "");
        if (!/<[a-z][\s\S]*>/i.test(raw)) return raw;
        const template = document.createElement("template");
        template.innerHTML = raw.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n");
        template.content.querySelectorAll("script,style,iframe,object,embed").forEach(node => node.remove());
        return template.content.textContent || "";
    };
    const formatAddress = value => {
        if (Array.isArray(value)) return value.map(formatAddress).filter(Boolean).join(", ");
        if (value && typeof value === "object") {
            const name = firstValue(value, ["name", "displayName", "display_name"]);
            const email = firstValue(value, ["email", "address", "mail"]);
            if (name && email) return `${name} <${email}>`;
            return name || email || "";
        }
        return String(value ?? "").trim();
    };
    const formatDate = value => {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    };
    const parseBooleanValue = value => {
        if (value === true || value === false) return value;
        const normalized = String(value ?? "").trim().toLowerCase();
        if (["true", "1", "yes", "y"].includes(normalized)) return true;
        if (["false", "0", "no", "n"].includes(normalized)) return false;
        return null;
    };
    const isMessageUnread = message => {
        const raw = message?.raw || message || {};
        const unreadValue = parseBooleanValue(raw?.unread);
        if (unreadValue !== null) return unreadValue;
        const readValue = parseBooleanValue(raw?.read);
        if (readValue !== null) return !readValue;
        const seenValue = parseBooleanValue(raw?.seen);
        if (seenValue !== null) return !seenValue;
        return message?.unread === true;
    };
    const isMessageStarred = message => {
        const raw = message?.raw || message || {};
        for (const key of ["starred", "star", "favorite", "favourite"]) {
            const value = parseBooleanValue(raw?.[key]);
            if (value !== null) return value;
        }
        return message?.starred === true;
    };
    const parseResponse = response => {
        if (!response || response === 0) return [];
        let payload = response;
        if (typeof payload === "string") {
            const trimmed = payload.trim();
            if (!trimmed) return [];
            try {
                payload = JSON.parse(trimmed);
            } catch (_) {
                return [{id: "message-0", subject: activeMailboxFolder || "Mail", body: trimmed}];
            }
        }
        if (Array.isArray(payload)) return payload;
        if (payload && typeof payload === "object") {
            for (const key of ["emails", "email", "messages", "mail", "inbox", "items", "records", "data"]) {
                if (Array.isArray(payload[key])) return payload[key];
            }
            return [payload];
        }
        return [];
    };
    const resolveEmailRecordId = record => firstValue(record, [
        "id",
        "ID",
        "_id",
        "recordId",
        "recordID",
        "record_id",
        "emailid",
        "emailId",
        "email_id"
    ]);
    const resolveEmailViewId = (record, index) => firstValue(record, [
        "id",
        "ID",
        "_id",
        "recordId",
        "recordID",
        "record_id",
        "emailid",
        "emailId",
        "email_id",
        "messageId",
        "message_id"
    ], `message-${index}`);
    const normalizeMessage = (record, index) => {
        const body = firstValue(record, ["body", "content", "text", "message", "html", "snippet", "preview"]);
        const subject = String(firstValue(record, ["subject", "title", "name"], "(No subject)")).trim() || "(No subject)";
        const from = formatAddress(firstValue(record, ["from", "sender", "author", "from_email", "fromEmail"]));
        const to = formatAddress(firstValue(record, ["to", "recipient", "recipients", "to_email", "toEmail"]));
        const date = firstValue(record, ["date", "timestamp", "created", "created_at", "received", "received_at", "sent", "sent_at"]);
        const recordId = String(resolveEmailRecordId(record) || "");
        return {
            id: String(resolveEmailViewId(record, index)),
            recordId,
            subject,
            from,
            to,
            date,
            body: stripMarkup(body),
            snippet: stripMarkup(firstValue(record, ["snippet", "preview", "summary"], body)).replace(/\s+/g, " ").trim(),
            unread: isMessageUnread(record),
            starred: isMessageStarred(record),
            category: firstValue(record, ["category", "category_id", "categoryId"]),
            raw: record
        };
    };
    const countUnreadMessages = messages => messages.filter(message => message.unread).length;
    const getFolderMeta = folder => EMAIL_FOLDERS.find(item => item.folder === folder) || EMAIL_FOLDERS[0];
    const resolveMessageFolderTitle = (message, fallbackTitle = "") => {
        const folder = firstValue(message?.raw || message || {}, ["folder", "mailbox", "folderName", "folder_name"], fallbackTitle);
        const meta = EMAIL_FOLDERS.find(item => item.folder === folder || item.title.toLowerCase() === String(folder).toLowerCase());
        return meta?.title || folder || fallbackTitle;
    };
    const parseMailboxMessages = response => parseResponse(response).map(normalizeMessage);
    const setMailboxCache = (folder, messages = [], error = null) => {
        const meta = getFolderMeta(folder);
        mailboxCache.set(folder, {folder, title: meta.title, messages, error, unreadCount: countUnreadMessages(messages)});
        updateEmailRouteUnreadCounts();
        return mailboxCache.get(folder);
    };
    const fetchMailboxFolder = (folder, {force = false} = {}) => {
        if (!force && mailboxCache.has(folder)) return Promise.resolve(mailboxCache.get(folder));
        if (!force && mailboxFetches.has(folder)) return mailboxFetches.get(folder);
        const fetchPromise = CLI.send(buildFolderCommand(folder))
            .then(response => setMailboxCache(folder, parseMailboxMessages(response), null))
            .catch(error => {
                console.error(`Failed to load ${folder}:`, error);
                return setMailboxCache(folder, [], error);
            })
            .finally(() => mailboxFetches.delete(folder));
        mailboxFetches.set(folder, fetchPromise);
        return fetchPromise;
    };
    const prefetchMailboxFolders = () => {
        if (mailboxPrefetchStarted) return;
        mailboxPrefetchStarted = true;
        EMAIL_FOLDERS.forEach(({folder}) => {
            fetchMailboxFolder(folder).catch(() => {});
        });
    };
    const renderEmailToolbar = () => div({
        id: "email-editor-toolbar",
        style: "bordered shadowed radius small-padding blurred",
        content: div({style: "faded", content: children([
            button({style: "naked align-bottom small-margin-right inner-radius", title: "Reply", icon: REPLY_ICON, onclick: event => replyToEmailFromToolbar(event)}),
            button({style: "naked align-bottom small-margin-right inner-radius", title: "Archive", icon: ARCHIVE_ACTION_ICON, onclick: event => moveEmailFromToolbar(event, "archived")}),
            button({style: "naked align-bottom small-margin-right inner-radius", title: "Delete", icon: DELETED_ICON, onclick: event => moveEmailFromToolbar(event, "deleted")}),
            button({style: "naked align-bottom small-margin-right inner-radius", title: "Star", icon: STAR_ICON, onclick: event => toggleStarredFromToolbar(event)}),
            button({style: "naked align-bottom small-margin-right inner-radius", title: "Categorize", icon: CATEGORY_ACTION_ICON, onclick: event => categorizeEmailFromToolbar(event)})
        ])})
    });
    const renderEmailResizeHandle = () => `<div class="email-resize-handle" title="Resize panes" style="width:8px;min-width:8px;height:100%;cursor:col-resize;background:var(--border);transition:background 120ms ease;user-select:none;touch-action:none;"></div>`;
    const applyEmailShellLayout = (shell) => {
        if (!shell) return;
        const workspace = shell.closest(".email-workspace");
        if (workspace) {
            workspace.style.display = "flex";
            workspace.style.flexDirection = "column";
            workspace.style.height = "100%";
            workspace.style.minHeight = "0";
            workspace.style.overflow = "hidden";
        }
        const toolbar = workspace?.querySelector("#email-editor-toolbar");
        if (toolbar) {
            toolbar.style.flex = "none";
            toolbar.style.overflow = "visible";
        }
        const listPane = shell.querySelector(".email-list-pane");
        const handle = shell.querySelector(".email-resize-handle");
        const isStacked = shell.getBoundingClientRect().width <= 720;
        shell.style.display = "grid";
        shell.style.flex = "1 1 auto";
        shell.style.height = "auto";
        shell.style.minHeight = "0";
        if (isStacked) {
            shell.style.gridTemplateColumns = "1fr";
            shell.style.gridTemplateRows = "minmax(180px, 42%) 0 minmax(0, 1fr)";
            if (handle) {
                handle.style.width = "100%";
                handle.style.minWidth = "0";
                handle.style.height = "0";
                handle.style.cursor = "default";
                handle.style.background = "transparent";
                handle.style.pointerEvents = "none";
            }
            if (listPane) listPane.style.borderRight = "0";
            return;
        }
        const shellWidth = shell.getBoundingClientRect().width || 1000;
        const maxWidth = Math.max(230, shellWidth - 320);
        emailListPaneWidth = Math.max(230, Math.min(emailListPaneWidth, maxWidth));
        shell.style.gridTemplateColumns = `${emailListPaneWidth}px 8px minmax(0, 1fr)`;
        shell.style.gridTemplateRows = "";
        if (handle) {
            handle.style.width = "8px";
            handle.style.minWidth = "8px";
            handle.style.height = "100%";
            handle.style.cursor = "col-resize";
            handle.style.background = "var(--border)";
            handle.style.pointerEvents = "";
        }
        if (listPane) listPane.style.borderRight = "0";
    };
    const bindEmailPaneResizer = (root = document) => {
        const shells = Array.from(root.querySelectorAll?.(".email-shell") || []);
        shells.forEach(applyEmailShellLayout);
    };
    const applyEmailMessageItemStyles = (root = document) => {
        root.querySelectorAll?.(".email-message-item").forEach(item => {
            const isUnread = item.classList.contains("unread");
            item.style.borderLeft = isUnread ? "3px solid var(--primary)" : "3px solid transparent";
            item.style.boxShadow = "none";
        });
    };
    const updateEmailRouteUnreadCounts = () => {
        const emailWindows = Array.from(document.querySelectorAll(".draggable-window"))
            .filter(windowNode => windowNode?.portal?.serviceId?.() === EMAIL_SERVICE_ID);
        const routeLabels = (emailWindows.length ? emailWindows : [document])
            .flatMap(root => Array.from(root.querySelectorAll(".sidebar-item > span")));
        EMAIL_FOLDERS.forEach(({folder, title}) => {
            const label = routeLabels.find(node => node?.childNodes?.[0]?.textContent === title || node?.textContent?.trim()?.startsWith(title));
            if (!label) return;
            const unreadCount = mailboxCache.get(folder)?.unreadCount || 0;
            if (!label.dataset.emailBaseLabel) {
                label.dataset.emailBaseLabel = title;
                label.textContent = title;
            }
            let badge = label.querySelector(".email-route-unread-count");
            if (!unreadCount) {
                badge?.remove();
                return;
            }
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "faded email-route-unread-count";
                badge.style.float = "right";
                badge.style.fontWeight = "700";
                badge.style.marginLeft = "8px";
                label.appendChild(badge);
            }
            badge.textContent = `${unreadCount}`;
        });
    };
    const refreshRenderedMailboxFolder = (folder, cache = mailboxCache.get(folder)) => {
        if (!cache) return;
        document.querySelectorAll?.(`.email-workspace[data="${folder}"]`).forEach(workspace => {
            workspace.outerHTML = renderMailbox(cache.messages, {folder, title: cache.title, error: cache.error});
        });
        requestAnimationFrame(() => {
            bindEmailPaneResizer(document);
            applyEmailMessageItemStyles(document);
            updateEmailRouteUnreadCounts();
            bindEmailMessageContextMenus(document);
            bindEmailDragAndDrop(document);
        });
    };
    const findMailboxMessageContext = target => {
        const item = target?.closest?.(".email-message-item");
        const workspace = item?.closest?.(".email-workspace");
        const folder = workspace?.getAttribute("data") || activeMailboxFolder;
        const cache = mailboxCache.get(folder);
        const messageId = item?.getAttribute("data") || "";
        const message = (cache?.messages || mailboxMessages).find(entry => entry.id === messageId);
        return {item, workspace, folder, cache, messageId, message};
    };
    const syncMailboxMessageCache = (folder, messages) => {
        const currentCache = mailboxCache.get(folder);
        const meta = getFolderMeta(folder);
        mailboxCache.set(folder, {
            folder,
            title: currentCache?.title || meta.title,
            messages,
            error: currentCache?.error || null,
            unreadCount: countUnreadMessages(messages)
        });
    };
    const refreshMailboxContext = ({workspace, folder} = {}) => {
        const cache = mailboxCache.get(folder);
        if (cache) refreshRenderedMailboxFolder(folder, cache);
        if (workspace) {
            requestAnimationFrame(() => bindEmailMessageContextMenus(workspace));
        }
        updateEmailRouteUnreadCounts();
    };
    const escapeSelectorValue = value => typeof window.CSS?.escape === "function" ? window.CSS.escape(String(value ?? "")) : String(value ?? "").replace(/"/g, "\\\"");
    const findMailboxMessageContextById = (messageId = "", folder = activeMailboxFolder) => {
        const escapedFolder = escapeSelectorValue(folder);
        const escapedMessageId = escapeSelectorValue(messageId);
        const workspace = Array.from(document.querySelectorAll(`.email-workspace[data="${escapedFolder}"]`)).find(node => node.querySelector(`.email-message-item[data="${escapedMessageId}"]`)) || null;
        const item = workspace?.querySelector?.(`.email-message-item[data="${escapedMessageId}"]`) || null;
        const cache = mailboxCache.get(folder);
        const message = (cache?.messages || mailboxMessages).find(entry => entry.id === messageId);
        return {item, workspace, folder, cache, messageId, message};
    };
    const openEmailViewer = (message, folderTitle = "") => {
        if (!message) return;
        activeViewerMessage = message;
        activeViewerFolderTitle = resolveMessageFolderTitle(message, folderTitle);
        activeViewerFolder = EMAIL_FOLDERS.find(item => item.title === activeViewerFolderTitle)?.folder || activeMailboxFolder;
        const viewer = modular?.start?.(EMAIL_SERVICE_ID, {portalIndex: 1});
        viewer?.setTitle?.(message.subject || "Email");
        viewer?.setWindowState?.({messageId: message.id, folderTitle: activeViewerFolderTitle}, {persist: false});
        viewer?.refresh?.();
    };
    const setMailboxMessageReadState = (context, read) => {
        const recordId = context.message.recordId || resolveEmailRecordId(context.message.raw);
        if (!recordId) {
            modular?.error?.("Couldn't update email: missing record id");
            return null;
        }
        context.message.unread = !read;
        context.message.recordId = String(recordId);
        if (context.message.raw && typeof context.message.raw === "object") {
            context.message.raw.unread = context.message.unread;
            context.message.raw.read = read;
            context.message.raw.seen = read;
        }
        if (context.item) {
            context.item.classList.toggle("unread", context.message.unread);
        }
        return recordId;
    };
    const updateMailboxMessageReadState = target => {
        const context = findMailboxMessageContext(target);
        if (!context.message || !context.cache) return;
        const nextReadState = isMessageUnread(context.message);
        const recordId = setMailboxMessageReadState(context, nextReadState);
        if (!recordId) return;
        syncMailboxMessageCache(context.folder, context.cache.messages);
        applyEmailMessageItemStyles(context.workspace || document);
        updateEmailRouteUnreadCounts();
        CLI.send(buildReadStateCommand(recordId, nextReadState))
            .then(() => modular?.success?.(nextReadState ? "Marked email as read" : "Marked email as unread"))
            .catch(error => {
                console.error("Failed to update email read state:", error);
                modular?.error?.(nextReadState ? "Couldn't mark email as read" : "Couldn't mark email as unread");
            });
    };
    const updateSelectedMailboxMessagesReadState = (contexts = []) => {
        const validContexts = contexts.filter(context => context?.message && context?.cache);
        if (!validContexts.length) return;
        const nextReadState = validContexts.some(context => isMessageUnread(context.message));
        const updates = validContexts
            .map(context => ({context, recordId: setMailboxMessageReadState(context, nextReadState)}))
            .filter(update => update.recordId);
        if (!updates.length) return;
        const touchedFolders = new Set();
        const touchedWorkspaces = new Set();
        updates.forEach(({context}) => {
            touchedFolders.add(context.folder);
            if (context.workspace) touchedWorkspaces.add(context.workspace);
        });
        touchedFolders.forEach(folder => {
            const cache = mailboxCache.get(folder);
            if (cache) syncMailboxMessageCache(folder, cache.messages);
        });
        touchedWorkspaces.forEach(workspace => applyEmailMessageItemStyles(workspace));
        updateEmailRouteUnreadCounts();
        Promise.all(updates.map(({recordId}) => CLI.send(buildReadStateCommand(recordId, nextReadState))))
            .then(() => modular?.success?.(nextReadState ? "Marked selected emails as read" : "Marked selected emails as unread"))
            .catch(error => {
                console.error("Failed to update selected email read state:", error);
                modular?.error?.(nextReadState ? "Couldn't mark selected emails as read" : "Couldn't mark selected emails as unread");
            });
    };
    const contextForViewerMessage = () => {
        if (!activeViewerMessage) return null;
        const folder = activeViewerFolder || activeMailboxFolder;
        const context = findMailboxMessageContextById(activeViewerMessage.id, folder);
        return context.message ? context : {
            item: null,
            workspace: null,
            folder,
            cache: mailboxCache.get(folder),
            messageId: activeViewerMessage.id,
            message: activeViewerMessage
        };
    };
    const contextsForToolbarAction = event => {
        const portal = event?.target?.closest?.(".draggable-window")?.portal;
        if (portal?.serviceId?.() === EMAIL_SERVICE_ID && portal.portalIndex?.() === 1) {
            const context = contextForViewerMessage();
            return context?.message ? [context] : [];
        }
        return findSelectedMailboxContextsForShortcut(event?.target);
    };
    const recordIdForContext = context => context?.message?.recordId || resolveEmailRecordId(context?.message?.raw);
    const refreshToolbarContexts = (contexts = []) => {
        const touchedFolders = new Set();
        const touchedWorkspaces = new Set();
        contexts.forEach(context => {
            if (context?.folder) touchedFolders.add(context.folder);
            if (context?.workspace) touchedWorkspaces.add(context.workspace);
        });
        touchedFolders.forEach(folder => {
            const cache = mailboxCache.get(folder);
            if (cache) syncMailboxMessageCache(folder, cache.messages);
        });
        touchedWorkspaces.forEach(workspace => applyEmailMessageItemStyles(workspace));
        updateEmailRouteUnreadCounts();
    };
    const replyToEmailFromToolbar = event => {
        const context = contextsForToolbarAction(event)[0];
        const recordId = recordIdForContext(context);
        if (!recordId) {
            modular?.error?.("Select an email to reply");
            return;
        }
        CLI.send(buildReplyCommand(recordId))
            .then(() => modular?.success?.("Reply started"))
            .catch(error => {
                console.error("Failed to reply to email:", error);
                modular?.error?.("Couldn't start reply");
            });
    };
    const moveEmailFromToolbar = (event, folder) => {
        const contexts = contextsForToolbarAction(event);
        if (!contexts.length) {
            modular?.error?.("Select an email first");
            return;
        }
        contexts.forEach(context => moveMailboxMessageContextToFolder(context, folder));
    };
    const toggleStarredFromToolbar = event => {
        const contexts = contextsForToolbarAction(event).filter(context => context?.message);
        if (!contexts.length) {
            modular?.error?.("Select an email first");
            return;
        }
        const nextStarredState = !contexts.every(context => isMessageStarred(context.message));
        const updates = contexts.map(context => {
            const recordId = recordIdForContext(context);
            if (!recordId) return null;
            context.message.starred = nextStarredState;
            if (context.message.raw && typeof context.message.raw === "object") {
                context.message.raw.starred = nextStarredState;
                context.message.raw.star = nextStarredState;
            }
            return {context, recordId};
        }).filter(Boolean);
        if (!updates.length) {
            modular?.error?.("Couldn't update email: missing record id");
            return;
        }
        refreshToolbarContexts(updates.map(update => update.context));
        Promise.all(updates.map(({recordId}) => CLI.send(buildStarredStateCommand(recordId, nextStarredState))))
            .then(() => modular?.success?.(nextStarredState ? "Starred email" : "Unstarred email"))
            .catch(error => {
                console.error("Failed to update email starred state:", error);
                modular?.error?.(nextStarredState ? "Couldn't star email" : "Couldn't unstar email");
            });
    };
    const normalizeCategoryRecordId = value => String(value ?? "").replace(/^@/, "").trim();
    const resolveEmailCategoryValue = async (categoryInput = "") => {
        const requested = String(categoryInput || "").trim();
        if (!requested) return "";
        try {
            const response = await CLI.send("[cats]");
            const categories = Array.isArray(response?.categories) ? response.categories
                : Array.isArray(response?.cats) ? response.cats
                    : parseResponse(response);
            const match = categories.find(category => {
                const id = normalizeCategoryRecordId(firstValue(category, ["id", "ID", "_id", "recordId", "record_id"]));
                const name = String(firstValue(category, ["name", "title"], "")).trim();
                return id === requested || name.toLowerCase() === requested.toLowerCase();
            });
            return normalizeCategoryRecordId(firstValue(match, ["id", "ID", "_id", "recordId", "record_id"], requested));
        } catch (_) {
            return requested;
        }
    };
    const categorizeEmailFromToolbar = async event => {
        const contexts = contextsForToolbarAction(event).filter(context => context?.message);
        if (!contexts.length) {
            modular?.error?.("Select an email first");
            return;
        }
        const currentCategory = firstValue(contexts[0].message, ["category"], firstValue(contexts[0].message.raw, ["category", "category_id", "categoryId"]));
        const categoryInput = window.prompt("Category", currentCategory || "");
        if (categoryInput === null) return;
        const category = await resolveEmailCategoryValue(categoryInput);
        const updates = contexts.map(context => {
            const recordId = recordIdForContext(context);
            if (!recordId) return null;
            context.message.category = category;
            if (context.message.raw && typeof context.message.raw === "object") {
                context.message.raw.category = category;
                context.message.raw.category_id = category;
            }
            return {context, recordId};
        }).filter(Boolean);
        if (!updates.length) {
            modular?.error?.("Couldn't update email: missing record id");
            return;
        }
        refreshToolbarContexts(updates.map(update => update.context));
        Promise.all(updates.map(({recordId}) => CLI.send(buildCategoryCommand(recordId, category))))
            .then(() => modular?.success?.(category ? "Categorized email" : "Category cleared"))
            .catch(error => {
                console.error("Failed to categorize email:", error);
                modular?.error?.("Couldn't categorize email");
            });
    };
    const moveMailboxMessageContextToFolder = (context, destinationFolder) => {
        if (!context.message || !context.cache || context.folder === destinationFolder) return;
        const recordId = context.message.recordId || resolveEmailRecordId(context.message.raw);
        if (!recordId) {
            modular?.error?.("Couldn't move email: missing record id");
            return;
        }
        const nextSourceMessages = context.cache.messages.filter(message => message.id !== context.messageId);
        syncMailboxMessageCache(context.folder, nextSourceMessages);
        const destinationCache = mailboxCache.get(destinationFolder);
        if (destinationCache && !destinationCache.messages.some(message => message.id === context.messageId)) {
            syncMailboxMessageCache(destinationFolder, [{...context.message, recordId: String(recordId)}, ...destinationCache.messages]);
        }
        if (selectedMailboxMessageId === context.messageId) selectedMailboxMessageId = nextSourceMessages[0]?.id || "";
        refreshMailboxContext(context);
        CLI.send(buildMoveFolderCommand(recordId, destinationFolder))
            .then(() => modular?.success?.(`Moved email to ${getFolderMeta(destinationFolder).title}`))
            .catch(error => {
                console.error("Failed to move email:", error);
                modular?.error?.(`Couldn't move email to ${getFolderMeta(destinationFolder).title}`);
            });
    };
    const moveMailboxMessageToFolder = (target, destinationFolder) => {
        moveMailboxMessageContextToFolder(findMailboxMessageContext(target), destinationFolder);
    };
    const categorizeMailboxMessage = async target => {
        const context = findMailboxMessageContext(target);
        if (!context.message || !context.cache) return;
        const currentCategory = context.message.category || context.message.raw?.category || "";
        const categoryInput = window.prompt("Category", currentCategory);
        if (categoryInput === null) return;
        const category = await resolveEmailCategoryValue(categoryInput);
        const recordId = recordIdForContext(context);
        if (!recordId) {
            modular?.error?.("Couldn't update email: missing record id");
            return;
        }
        context.message.category = category;
        if (context.message.raw && typeof context.message.raw === "object") {
            context.message.raw.category = context.message.category;
            context.message.raw.category_id = context.message.category;
        }
        syncMailboxMessageCache(context.folder, context.cache.messages);
        refreshMailboxContext(context);
        CLI.send(buildCategoryCommand(recordId, category))
            .then(() => modular?.success?.(context.message.category ? `Categorized as ${context.message.category}` : "Category cleared"))
            .catch(error => {
                console.error("Failed to categorize email:", error);
                modular?.error?.("Couldn't categorize email");
            });
    };
    const hasEmailMessageMenuTarget = (_list, target) => !!target?.closest?.(".email-message-item");
    const getReadUnreadMailboxLabel = (_list, target) => {
        const context = findMailboxMessageContext(target);
        return isMessageUnread(context.message) ? "Mark Read" : "Mark Unread";
    };
    const createEmailMessageContextMenuItems = () => [{
        icon: READ_UNREAD_ICON,
        label: getReadUnreadMailboxLabel,
        visible: hasEmailMessageMenuTarget,
        action: (_list, _event, item) => updateMailboxMessageReadState(item)
    }, {
        icon: ARCHIVE_ICON,
        label: "Archive",
        visible: hasEmailMessageMenuTarget,
        action: (_list, _event, item) => moveMailboxMessageToFolder(item, "archived")
    }, {
        icon: SPAM_ICON,
        label: "Spam",
        visible: hasEmailMessageMenuTarget,
        action: (_list, _event, item) => moveMailboxMessageToFolder(item, "spam")
    }, {
        icon: CATEGORY_ICON,
        label: "Categorize",
        visible: hasEmailMessageMenuTarget,
        action: (_list, _event, item) => categorizeMailboxMessage(item)
    }, {
        icon: DELETED_ICON,
        label: "Deleted",
        destructive: true,
        visible: hasEmailMessageMenuTarget,
        action: (_list, _event, item) => moveMailboxMessageToFolder(item, "deleted")
    }];
    const bindEmailMessageContextMenus = (root = document) => {
        root.querySelectorAll?.(".email-message-list").forEach(list => {
            if (list.dataset.emailContextMenuBound === "true") return;
            list.dataset.emailContextMenuBound = "true";
            list.contextmenu(createEmailMessageContextMenuItems(), ".email-message-item");
        });
    };
    const isEmailDragEvent = event => Array.from(event?.dataTransfer?.types || []).includes(EMAIL_DRAG_MIME);
    const readEmailDragData = event => {
        try {
            const raw = event?.dataTransfer?.getData?.(EMAIL_DRAG_MIME) || "";
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    };
    const resolveEmailSidebarFolder = target => {
        const route = target?.closest?.(".sidebar-item");
        if (!route?.closest?.(".draggable-window")?.portal || route.closest(".draggable-window").portal.serviceId?.() !== EMAIL_SERVICE_ID) return "";
        const label = route.querySelector("span");
        const labelText = label?.dataset?.emailBaseLabel || label?.childNodes?.[0]?.textContent || label?.textContent || "";
        const normalized = String(labelText).trim().toLowerCase();
        return EMAIL_FOLDERS.find(item => item.title.toLowerCase() === normalized)?.folder || "";
    };
    const stopEmailDragEvent = event => {
        event.preventDefault();
        event.stopPropagation();
    };
    const bindEmailDragAndDrop = (root = document) => {
        root.querySelectorAll?.(".email-message-item").forEach(item => {
            if (item.dataset.emailDragBound === "true") return;
            item.dataset.emailDragBound = "true";
            item.draggable = true;
            item.addEventListener("dragstart", event => {
                const context = findMailboxMessageContext(item);
                if (!context.message) return;
                event.stopPropagation();
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(EMAIL_DRAG_MIME, JSON.stringify({messageId: context.messageId, sourceFolder: context.folder}));
                event.dataTransfer.setData("text/plain", context.message.subject || "Email");
                document.body.classList.remove("drag-active");
            });
            item.addEventListener("dragend", event => {
                event.stopPropagation();
                document.body.classList.remove("drag-active");
            });
        });
        root.querySelectorAll?.(".email-workspace, .email-message-list, .email-message-item").forEach(node => {
            if (node.dataset.emailDragStopBound === "true") return;
            node.dataset.emailDragStopBound = "true";
            ["dragenter", "dragover", "drop"].forEach(eventName => {
                node.addEventListener(eventName, event => {
                    if (!isEmailDragEvent(event)) return;
                    stopEmailDragEvent(event);
                    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                    document.body.classList.remove("drag-active");
                });
            });
        });
        root.querySelectorAll?.(".draggable-window").forEach(windowNode => {
            if (windowNode.portal?.serviceId?.() !== EMAIL_SERVICE_ID) return;
            windowNode.querySelectorAll(".sidebar-item").forEach(route => {
                if (route.dataset.emailDropBound === "true") return;
                route.dataset.emailDropBound = "true";
                route.addEventListener("dragenter", event => {
                    if (!isEmailDragEvent(event)) return;
                    stopEmailDragEvent(event);
                    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                    route.style.background = "var(--bg)";
                    document.body.classList.remove("drag-active");
                });
                route.addEventListener("dragover", event => {
                    if (!isEmailDragEvent(event)) return;
                    stopEmailDragEvent(event);
                    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                    route.style.background = "var(--bg)";
                    document.body.classList.remove("drag-active");
                });
                route.addEventListener("dragleave", event => {
                    if (!isEmailDragEvent(event)) return;
                    event.stopPropagation();
                    route.style.background = "";
                });
                route.addEventListener("drop", event => {
                    if (!isEmailDragEvent(event)) return;
                    stopEmailDragEvent(event);
                    route.style.background = "";
                    document.body.classList.remove("drag-active");
                    const dragData = readEmailDragData(event);
                    const destinationFolder = resolveEmailSidebarFolder(route);
                    if (!dragData?.messageId || !dragData?.sourceFolder || !destinationFolder) return;
                    const context = findMailboxMessageContextById(dragData.messageId, dragData.sourceFolder);
                    moveMailboxMessageContextToFolder(context, destinationFolder);
                });
            });
        });
    };
    const isEmailReadShortcut = event => (
        event.ctrlKey
        && !event.altKey
        && !event.metaKey
        && !event.shiftKey
        && event.key?.toLowerCase?.() === "u"
    );
    const isEditableShortcutTarget = target => !!target?.closest?.("input, textarea, select, [contenteditable='true'], [contenteditable='']");
    const getFocusedEmailWindow = target => {
        const targetWindow = target?.closest?.(".draggable-window");
        if (targetWindow?.portal?.serviceId?.() === EMAIL_SERVICE_ID) return targetWindow;
        const focusedWindow = document.querySelector(".draggable-window.window-focused");
        if (focusedWindow?.portal?.serviceId?.() === EMAIL_SERVICE_ID) return focusedWindow;
        return null;
    };
    const findFocusedMailboxWorkspace = target => getFocusedEmailWindow(target)?.querySelector?.(".email-workspace") || null;
    const isEmailSelectAllShortcut = event => (
        event.ctrlKey
        && !event.altKey
        && !event.metaKey
        && !event.shiftKey
        && event.key?.toLowerCase?.() === "a"
    );
    const findSelectedMailboxItemForShortcut = target => {
        const workspace = findFocusedMailboxWorkspace(target);
        if (!workspace) return null;
        const escapedSelectedId = escapeSelectorValue(selectedMailboxMessageId);
        return workspace.querySelector(".email-message-item.active")
            || (selectedMailboxMessageId ? workspace.querySelector(`.email-message-item[data="${escapedSelectedId}"]`) : null);
    };
    const findSelectedMailboxContextsForShortcut = target => {
        const workspace = findFocusedMailboxWorkspace(target);
        if (!workspace) return [];
        const selectedItems = Array.from(workspace.querySelectorAll(".email-message-item.active"));
        const items = selectedItems.length ? selectedItems : [findSelectedMailboxItemForShortcut(target)].filter(Boolean);
        return items.map(findMailboxMessageContext).filter(context => context.message && context.cache);
    };
    const selectAllMailboxMessages = target => {
        const workspace = findFocusedMailboxWorkspace(target);
        const items = Array.from(workspace?.querySelectorAll?.(".email-message-item") || []);
        if (!workspace || !items.length || !workspace.querySelector(".email-message-item.active")) return false;
        selectedMailboxMessageIds.clear();
        items.forEach(item => {
            const messageId = item.getAttribute("data") || "";
            if (messageId) selectedMailboxMessageIds.add(messageId);
            item.classList.add("active");
        });
        applyEmailMessageItemStyles(workspace);
        return true;
    };
    document.addEventListener("keydown", (event) => {
        if (event.defaultPrevented || isEditableShortcutTarget(event.target)) return;
        if (isEmailSelectAllShortcut(event)) {
            if (!selectAllMailboxMessages(event.target)) return;
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (isEmailReadShortcut(event)) {
            const selectedContexts = findSelectedMailboxContextsForShortcut(event.target);
            if (!selectedContexts.length) return;
            event.preventDefault();
            event.stopPropagation();
            updateSelectedMailboxMessagesReadState(selectedContexts);
        }
    }, true);
    document.addEventListener("mouseenter", (event) => {
        const handle = event.target?.closest?.(".email-resize-handle");
        if (!handle || handle.style.pointerEvents === "none") return;
        handle.style.background = "var(--primary)";
    }, true);
    document.addEventListener("mouseleave", (event) => {
        const handle = event.target?.closest?.(".email-resize-handle");
        if (!handle || activeEmailResize?.handle === handle) return;
        handle.style.background = "var(--border)";
    }, true);
    document.addEventListener("mousedown", (event) => {
        const handle = event.target?.closest?.(".email-resize-handle");
        if (!handle || handle.style.pointerEvents === "none") return;
        const shell = handle.closest(".email-shell");
        if (!shell) return;
        event.preventDefault();
        activeEmailResize = {
            handle,
            shell,
            startX: event.clientX,
            startWidth: shell.querySelector(".email-list-pane")?.getBoundingClientRect().width || emailListPaneWidth
        };
        handle.style.background = "var(--primary)";
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    });
    document.addEventListener("mousemove", (event) => {
        if (!activeEmailResize) return;
        const {shell, startX, startWidth} = activeEmailResize;
        const shellWidth = shell.getBoundingClientRect().width || 1000;
        const maxWidth = Math.max(230, shellWidth - 320);
        emailListPaneWidth = Math.max(230, Math.min(startWidth + event.clientX - startX, maxWidth));
        applyEmailShellLayout(shell);
    });
    document.addEventListener("mouseup", () => {
        if (!activeEmailResize) return;
        activeEmailResize.handle.style.background = activeEmailResize.handle.matches(":hover") ? "var(--primary)" : "var(--border)";
        activeEmailResize = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    });
    window.addEventListener("resize", () => bindEmailPaneResizer(document));
    const renderMailboxListEmpty = folderTitle => div({
        style: "email-empty-state",
        content: children([
            `<img class="email-empty-icon" src="/icons/interfaces/email.png" alt="">`,
            div({style: "email-empty-label", content: `No mail in ${escapeMarkup(folderTitle)}`}),
            div({style: "faded", content: "Messages for this folder will appear here."})
        ])
    });
    const renderMailboxListError = (folderTitle, error) => div({
        style: "email-empty-state",
        content: children([
            `<img class="email-empty-icon" src="/icons/interfaces/email.png" alt="">`,
            div({style: "email-empty-label", content: `Unable to load ${escapeMarkup(folderTitle)}`}),
            div({style: "faded", content: escapeMarkup(error?.message || "The email command did not return mail.")})
        ])
    });
    const renderMessageListItem = message => div({
        style: `email-message-item${selectedMailboxMessageIds.has(message.id) || message.id === selectedMailboxMessageId ? " active" : ""}${message.unread ? " unread" : ""}`,
        data: message.id,
        onclick: event => {
            const item = event.target?.closest?.(".email-message-item");
            selectMailboxMessage(item?.getAttribute("data"), item?.closest?.(".email-shell"));
        },
        ondblclick: event => {
            event.stopPropagation();
            const context = findMailboxMessageContext(event.target);
            openEmailViewer(context.message, getFolderMeta(context.folder).title);
        },
        content: children([
            div({style: "email-message-row", content: children([
                div({style: "email-message-sender", content: escapeMarkup(message.from || "Unknown sender")}),
                div({style: "email-message-date", content: escapeMarkup(formatDate(message.date))})
            ])}),
            div({style: "email-message-subject", content: escapeMarkup(message.subject)}),
            div({style: "email-message-snippet", content: escapeMarkup(message.snippet || message.body || "")})
        ])
    });
    const renderReadingPane = (message, folderTitle = "") => {
        if (!message) {
            return div({
                style: "email-reading-empty",
                content: "Select an email to read."
            });
        }
        const resolvedFolderTitle = resolveMessageFolderTitle(message, folderTitle);
        return children([
            div({style: "email-reading-header", content: children([
                resolvedFolderTitle ? div({style: "label float-right", content: escapeMarkup(resolvedFolderTitle)}) : "",
                h({level: 2, content: escapeMarkup(message.subject)}),
                div({style: "email-reading-meta", content: children([
                    message.from ? div({content: `<strong>From</strong> ${escapeMarkup(message.from)}`}) : "",
                    message.to ? div({content: `<strong>To</strong> ${escapeMarkup(message.to)}`}) : "",
                    message.date ? div({content: `<strong>Date</strong> ${escapeMarkup(formatDate(message.date))}`}) : ""
                ])})
            ])}),
            div({style: "email-reading-body", content: escapeMarkup(message.body || message.snippet || "")})
        ]);
    };
    const renderEmailViewer = (routeContext = {}) => {
        const state = routeContext?.windowState?.get?.() || {};
        const message = activeViewerMessage;
        const folderTitle = activeViewerFolderTitle || state.folderTitle || "";
        return div({
            style: "email-workspace",
            content: children([
                renderEmailToolbar(),
                div({style: "spacer"}),
                div({
                    style: "email-reading-pane",
                    content: message
                        ? renderReadingPane(message, folderTitle)
                        : div({style: "email-reading-empty", content: "Double-click an email to open it here."})
                })
            ])
        });
    };
    const renderMailbox = (messages, {folder = "inbox", title = "Inbox", error = null} = {}) => {
        activeMailboxFolder = folder;
        mailboxMessages = messages;
        if (!mailboxMessages.some(message => message.id === selectedMailboxMessageId)) {
            selectedMailboxMessageId = mailboxMessages[0]?.id || "";
        }
        const availableMessageIds = new Set(mailboxMessages.map(message => message.id));
        Array.from(selectedMailboxMessageIds).forEach(messageId => {
            if (!availableMessageIds.has(messageId)) selectedMailboxMessageIds.delete(messageId);
        });
        if (!selectedMailboxMessageIds.size && selectedMailboxMessageId) {
            selectedMailboxMessageIds.add(selectedMailboxMessageId);
        }
        const selectedMessage = mailboxMessages.find(message => message.id === selectedMailboxMessageId) || mailboxMessages[0];
        const mailbox = div({
            style: "email-shell",
            content: children([
                div({
                    style: "email-list-pane",
                    content: children([
                        div({style: "email-list-header", content: children([
                            h({level: 3, content: escapeMarkup(title)}),
                            div({style: "email-count", content: `${mailboxMessages.length}`})
                        ])}),
                        div({
                            style: "email-message-list",
                            content: error
                                ? renderMailboxListError(title, error)
                                : (mailboxMessages.length ? children(mailboxMessages.map(renderMessageListItem)) : renderMailboxListEmpty(title))
                        })
                    ])
                }),
                renderEmailResizeHandle(),
                div({style: "email-reading-pane", content: renderReadingPane(selectedMessage, title)})
            ])
        });
        requestAnimationFrame(() => bindEmailPaneResizer(document));
        requestAnimationFrame(() => applyEmailMessageItemStyles(document));
        requestAnimationFrame(() => updateEmailRouteUnreadCounts());
        requestAnimationFrame(() => bindEmailMessageContextMenus(document));
        requestAnimationFrame(() => bindEmailDragAndDrop(document));
        return div({
            style: "email-workspace",
            data: folder,
            content: children([
                renderEmailToolbar(),
                div({style: "spacer"}),
                mailbox
            ])
        });
    };
    const selectMailboxMessage = (messageId, root = document) => {
        root = root || document;
        selectedMailboxMessageId = messageId || selectedMailboxMessageId;
        selectedMailboxMessageIds.clear();
        if (selectedMailboxMessageId) selectedMailboxMessageIds.add(selectedMailboxMessageId);
        const selectedMessage = mailboxMessages.find(message => message.id === selectedMailboxMessageId) || mailboxMessages[0];
        const folderTitle = getFolderMeta(root.closest?.(".email-workspace")?.getAttribute("data") || activeMailboxFolder).title;
        root.querySelectorAll(".email-message-item").forEach(item => {
            item.classList.toggle("active", selectedMailboxMessageIds.has(item.getAttribute("data")));
        });
        applyEmailMessageItemStyles(root);
        const pane = root.querySelector(".email-reading-pane");
        if (pane) pane.innerHTML = renderReadingPane(selectedMessage, folderTitle);
    };
    const loadMailboxFolder = (folder = "inbox", title = "Inbox") => {
        prefetchMailboxFolders();
        activeMailboxFolder = folder;
        selectedMailboxMessageId = "";
        selectedMailboxMessageIds.clear();
        const renderCachedMailbox = cache => renderMailbox(cache?.messages || [], {folder, title, error: cache?.error || null});
        const cached = mailboxCache.get(folder);
        if (cached) {
            fetchMailboxFolder(folder, {force: true}).then(freshCache => {
                if (activeMailboxFolder === folder) refreshRenderedMailboxFolder(folder, freshCache);
            }).catch(() => {});
            return renderCachedMailbox(cached);
        }
        return fetchMailboxFolder(folder).then(renderCachedMailbox);
    };
    modular.register(new Service(EMAIL_SERVICE_ID, [new Portal({
        title: "Email",
        hints: ["email", "mail", "smtp"],
        dimensions: [1000, 660],
        maximized: true,
        svg_icon: MAIL_ICON,
        icon: "/icons/interfaces/email.png",
        routes: [{
            text: "Inbox",
            icon: INBOX_ICON,
            route: () => loadMailboxFolder("inbox", "Inbox")
        }, {
            text: "Sent",
            icon: SENT_ICON,
            route: () => loadMailboxFolder("sent", "Sent")
        }, {
            text: "Everything",
            icon: EVERYTHING_ICON,
            route: () => loadMailboxFolder("everything", "Everything")
        }, {
            text: "Archive",
            icon: ARCHIVE_ICON,
            route: () => loadMailboxFolder("archived", "Archive")
        }, {
            text: "Spam",
            icon: SPAM_ICON,
            route: () => loadMailboxFolder("spam", "Spam")
        }, {
            text: "Deleted",
            icon: DELETED_ICON,
            route: () => loadMailboxFolder("deleted", "Deleted")
        }]
    }), new Portal({
        title: "View Email",
        hints: ["view email", "read email", "email message"],
        dimensions: [720, 540],
        svg_icon: MAIL_ICON,
        icon: "/icons/interfaces/email.png",
        route: (_struct, routeContext) => renderEmailViewer(routeContext)
    })]));
})();
