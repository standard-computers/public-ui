(() => {
    const EMAIL_SERVICE_ID = "com.standard.email";
    const buildFolderCommand = folder => `[email] <folder "${String(folder || "inbox").replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}">`;
    const EMAIL_FOLDERS = [
        {folder: "inbox", title: "Inbox", icon: "inbox"},
        {folder: "sent", title: "Sent", icon: "sent"},
        {folder: "everything", title: "Everything", icon: "everything"},
        {folder: "spam", title: "Spam", icon: "spam"},
        {folder: "deleted", title: "Deleted", icon: "deleted"}
    ];
    const MAIL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>`;
    const INBOX_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3" /></svg>`;
    const SENT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>`;
    const EVERYTHING_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m7.875 14.25 1.214 1.942a2.25 2.25 0 0 0 1.908 1.058h2.006c.776 0 1.497-.4 1.908-1.058l1.214-1.942M2.41 9h4.636a2.25 2.25 0 0 1 1.872 1.002l.164.246a2.25 2.25 0 0 0 1.872 1.002h2.092a2.25 2.25 0 0 0 1.872-1.002l.164-.246A2.25 2.25 0 0 1 16.954 9h4.636M2.41 9a2.25 2.25 0 0 0-.16.832V12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 12V9.832c0-.287-.055-.57-.16-.832M2.41 9a2.25 2.25 0 0 1 .382-.632l3.285-3.832a2.25 2.25 0 0 1 1.708-.786h8.43c.657 0 1.281.287 1.709.786l3.284 3.832c.163.19.291.404.382.632M4.5 20.25h15A2.25 2.25 0 0 0 21.75 18v-2.625c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125V18a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>`;
    const SPAM_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>`;
    const DELETED_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`;
    const EMAIL_FONT_FAMILIES = window.StandardUI?.fontFamilies || ["Inter", "Georgia", "Times New Roman", "Courier New", "Verdana"];
    const EMAIL_FONT_SIZES = ["8", "9", "10", "11", "12", "14", "16", "18", "20", "22", "24", "26", "28", "36", "48", "72"];
    const EMAIL_LINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" style="fill:none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path fill="none" style="fill:none" stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>`;
    const EMAIL_TABLE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 5.25h16.5v13.5H3.75V5.25Zm0 4.5h16.5M3.75 14.25h16.5M9.25 5.25v13.5M14.75 5.25v13.5" /></svg>`;
    const EMAIL_ALIGN_ICONS = {
        left: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor"><path stroke-linecap="round" d="M4 6.5h16M4 10.5h10M4 14.5h16M4 18.5h10" /></svg>`
    };
    let emailListPaneWidth = 340;
    let activeEmailResize = null;
    let mailboxMessages = [];
    let selectedMailboxMessageId = "";
    let activeMailboxFolder = "inbox";
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
    const normalizeMessage = (record, index) => {
        const body = firstValue(record, ["body", "content", "text", "message", "html", "snippet", "preview"]);
        const subject = String(firstValue(record, ["subject", "title", "name"], "(No subject)")).trim() || "(No subject)";
        const from = formatAddress(firstValue(record, ["from", "sender", "author", "from_email", "fromEmail"]));
        const to = formatAddress(firstValue(record, ["to", "recipient", "recipients", "to_email", "toEmail"]));
        const date = firstValue(record, ["date", "timestamp", "created", "created_at", "received", "received_at", "sent", "sent_at"]);
        const readValue = record?.read;
        const seenValue = record?.seen;
        return {
            id: String(firstValue(record, ["id", "emailid", "emailId", "messageId", "message_id"], `message-${index}`)),
            subject,
            from,
            to,
            date,
            body: stripMarkup(body),
            snippet: stripMarkup(firstValue(record, ["snippet", "preview", "summary"], body)).replace(/\s+/g, " ").trim(),
            unread: Boolean(record?.unread || readValue === false || `${readValue}`.toLowerCase() === "false" || seenValue === false || `${seenValue}`.toLowerCase() === "false"),
            raw: record
        };
    };
    const countUnreadMessages = messages => messages.filter(message => message.unread).length;
    const getFolderMeta = folder => EMAIL_FOLDERS.find(item => item.folder === folder) || EMAIL_FOLDERS[0];
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
    const renderEmailEditorBar = () => div({
        id: "email-editor-toolbar",
        style: "bordered shadowed radius small-padding blurred",
        content: div({style: "faded", content: children([
            searchComboBox({id: "email-editor-font-family", wrapperStyle: "search-combobox-wrapper searchbox-wrapper small-margin-right", style: "inner-radius editor-font-family-combo", value: "Inter", placeholder: "Font", options: EMAIL_FONT_FAMILIES.map((fontName) => ({label: fontName, value: fontName}))}),
            searchComboBox({id: "email-editor-font-size", wrapperStyle: "search-combobox-wrapper searchbox-wrapper small-margin-right", style: "inner-radius editor-font-size-combo", value: "12", placeholder: "Size", allow_custom: true, options: EMAIL_FONT_SIZES.map((fontSize) => ({label: fontSize, value: fontSize}))}),
            button({id: "email-editor-style-bold", style: "naked align-bottom small-margin-right inner-radius", title: "Bold", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 5.7519531 2.0039062 A 0.750075 0.750075 0 0 0 5.0019531 2.7539062 L 5.0019531 11.703125 A 0.750075 0.750075 0 0 0 5.0019531 11.757812 L 5.0078125 21.257812 A 0.750075 0.750075 0 0 0 5.7578125 22.007812 L 13.505859 22.007812 C 16.534311 22.007812 19.005859 19.536265 19.005859 16.507812 C 19.005859 14.261755 17.639043 12.332811 15.701172 11.480469 C 17.057796 10.528976 18.005859 9.0314614 18.005859 7.2558594 C 18.005859 4.3643887 15.645377 2.0039063 12.753906 2.0039062 L 5.7519531 2.0039062 z M 6.5019531 3.5039062 L 12.753906 3.5039062 C 14.834436 3.5039063 16.505859 5.17533 16.505859 7.2558594 C 16.505859 9.3363887 14.834436 11.007813 12.753906 11.007812 L 6.5019531 11.007812 L 6.5019531 3.5039062 z M 6.5019531 12.507812 L 12.753906 12.507812 L 13.505859 12.507812 C 15.723408 12.507812 17.505859 14.290264 17.505859 16.507812 C 17.505859 18.725361 15.723408 20.507812 13.505859 20.507812 L 6.5058594 20.507812 L 6.5019531 12.507812 z"/></svg>`}),
            button({id: "email-editor-style-italic", style: "naked align-bottom small-margin-right inner-radius", title: "Italicize", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 10 2.0078125 L 10 3.5078125 L 10.75 3.5078125 L 13.119141 3.5078125 L 9.3417969 20.503906 L 6.7558594 20.503906 L 6.0058594 20.503906 L 6.0058594 22.003906 L 6.7558594 22.003906 L 13.2558594 22.003906 L 14.0058594 22.003906 L 14.0058594 20.503906 L 13.2558594 20.503906 L 10.878906 20.503906 L 14.65625 3.5078125 L 17.25 3.5078125 L 18 3.5078125 L 18 2.0078125 L 17.25 2.0078125 L 10.75 2.0078125 L 10 2.0078125 z"/></svg>`}),
            button({id: "email-editor-style-underline", style: "naked align-bottom small-margin-right inner-radius", title: "Underline", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 6.0058594 2 L 6.0058594 2.75 L 6.0058594 12.585938 C 6.0058594 15.618894 8.7446099 18.001953 12.003906 18.001953 C 15.263203 18.001953 18.003906 15.618893 18.003906 12.585938 L 18.003906 2.75 L 18.003906 2 L 16.503906 2 L 16.503906 2.75 L 16.503906 12.585938 C 16.503906 14.706981 14.54261 16.501953 12.003906 16.501953 C 9.4652032 16.501953 7.5058594 14.70698 7.5058594 12.585938 L 7.5058594 2.75 L 7.5058594 2 L 6.0058594 2 z M 4.9980469 20.003906 L 4.9980469 21.503906 L 5.7480469 21.503906 L 18.251953 21.503906 L 19.001953 21.503906 L 19.001953 20.003906 L 18.251953 20.003906 L 5.7480469 20.003906 L 4.9980469 20.003906 z"/></svg>`}),
            button({id: "email-editor-style-link", style: "naked align-bottom small-margin-right inner-radius", title: "Hyperlink", icon: EMAIL_LINK_ICON}),
            button({id: "email-editor-style-color", style: "naked align-bottom small-margin-right inner-radius", title: "Foreground", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 12.017578 2 A 0.750075 0.750075 0 0 0 11.294922 2.4941406 L 6.0507812 16.996094 A 0.75065194 0.75065194 0 1 0 7.4628906 17.505859 L 8.3691406 14.998047 L 15.638672 14.998047 L 16.546875 17.505859 A 0.750075 0.750075 0 1 0 17.957031 16.996094 L 12.705078 2.4941406 A 0.750075 0.750075 0 0 0 12.017578 2 z M 12 4.9550781 L 15.095703 13.498047 L 8.9121094 13.498047 L 12 4.9550781 z M 5.7480469 20.003906 A 0.750075 0.750075 0 1 0 5.7480469 21.503906 L 18.251953 21.503906 A 0.750075 0.750075 0 1 0 18.251953 20.003906 L 5.7480469 20.003906 z"/></svg>`}),
            button({id: "email-editor-style-background", style: "naked align-bottom small-margin-right inner-radius", title: "Background", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 9.0996094 -0.00390625 A 0.750075 0.750075 0 0 0 8.578125 1.2832031 L 9.9414062 2.6484375 L 3.0214844 9.5722656 C 1.6862427 10.90878 1.6862427 13.097079 3.0214844 14.433594 L 9.5683594 20.984375 C 10.904906 22.320922 13.094894 22.322395 14.431641 20.984375 L 21.880859 13.53125 A 0.750075 0.750075 0 0 0 21.880859 12.472656 L 9.6386719 0.22265625 A 0.750075 0.750075 0 0 0 9.0996094 -0.00390625 z M 11.001953 3.7089844 L 20.289062 13.001953 L 13.371094 19.923828 C 12.60784 20.687809 11.39236 20.687282 10.628906 19.923828 L 4.0820312 13.373047 C 3.319273 12.609561 3.319273 11.396299 4.0820312 10.632812 L 11.001953 3.7089844 z M 8 13.25 A 0.75 0.75 0 0 0 8 14.75 A 0.75 0.75 0 0 0 8 13.25 z M 12 13.25 A 0.75 0.75 0 0 0 12 14.75 A 0.75 0.75 0 0 0 12 13.25 z M 16 13.25 A 0.75 0.75 0 0 0 16 14.75 A 0.75 0.75 0 0 0 16 13.25 z M 10 15.25 A 0.75 0.75 0 0 0 10 16.75 A 0.75 0.75 0 0 0 10 15.25 z M 14 15.25 A 0.75 0.75 0 0 0 14 16.75 A 0.75 0.75 0 0 0 14 15.25 z M 22 17 C 21.596 17 21.232875 17.301656 20.796875 17.972656 C 20.360875 18.643656 20 19.282 20 20 C 20 21.105 20.895 22 22 22 C 23.105 22 24 21.105 24 20 C 24 19.282 23.639125 18.643656 23.203125 17.972656 C 22.767125 17.301656 22.404 17 22 17 z M 12 17.25 A 0.75 0.75 0 0 0 12 18.75 A 0.75 0.75 0 0 0 12 17.25 z"/></svg>`}),
            button({id: "email-editor-style-align", style: "naked align-bottom small-margin-right inner-radius", title: "Alignment", icon: EMAIL_ALIGN_ICONS.left}),
            button({id: "email-editor-style-highlight", style: "naked align-bottom small-margin-right inner-radius", title: "Highlight", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" viewBox="0 0 24 24"><path d="M 12.494141 1.1171875 C 12.366141 1.1171875 12.238125 1.1661719 12.140625 1.2636719 L 9.1484375 4.2578125 C 8.0944375 5.3118125 7.299125 6.5957656 6.828125 8.0097656 L 5.5742188 11.775391 C 5.4752187 12.069391 5.3098438 12.338594 5.0898438 12.558594 L 3.3027344 14.345703 C 2.9117344 14.736703 2.9117344 15.369766 3.3027344 15.759766 L 3.8554688 16.3125 L 1.2851562 19.009766 C 0.78015625 19.540766 0.99835938 20.416438 1.6933594 20.648438 L 4.6074219 21.591797 C 4.9524219 21.706797 5.3316094 21.625906 5.5996094 21.378906 L 7.328125 19.783203 L 8.2539062 20.708984 C 8.4489063 20.903984 8.7049375 21.001953 8.9609375 21.001953 C 9.2169375 21.001953 9.4729687 20.903984 9.6679688 20.708984 L 11.455078 18.921875 C 11.675078 18.701875 11.941328 18.5355 12.236328 18.4375 L 16.001953 17.183594 C 17.415953 16.712594 18.700859 15.917281 19.755859 14.863281 L 22.748047 11.869141 C 22.943047 11.674141 22.943047 11.357109 22.748047 11.162109 C 22.552047 10.967109 22.236016 10.967109 22.041016 11.162109 L 19.048828 14.15625 C 19.040972 14.164106 19.031323 14.16991 19.023438 14.177734 L 9.8359375 4.9882812 C 9.8431253 4.981042 9.8482537 4.9720588 9.8554688 4.9648438 L 12.847656 1.9707031 C 13.042656 1.7757031 13.042656 1.4586719 12.847656 1.2636719 C 12.750156 1.1661719 12.622141 1.1171875 12.494141 1.1171875 z M 9.171875 5.7382812 L 18.273438 14.841797 C 17.49882 15.44921 16.624226 15.921729 15.685547 16.234375 L 11.919922 17.490234 C 11.477922 17.637234 11.076094 17.884844 10.746094 18.214844 L 8.9609375 20.001953 L 4.0097656 15.052734 L 5.796875 13.265625 C 6.125875 12.936625 6.3734844 12.533797 6.5214844 12.091797 L 7.7773438 8.3261719 C 8.0908498 7.387136 8.5643624 6.513116 9.171875 5.7382812 z"/></svg>`}),
            button({id: "email-editor-style-list", style: "naked align-bottom small-margin-right inner-radius", title: "List", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>`}),
            button({id: "email-editor-style-image", style: "naked align-bottom small-margin-right inner-radius", title: "Image", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>`}),
            button({id: "email-editor-style-table", style: "naked align-bottom small-margin-right inner-radius", title: "Table", icon: EMAIL_TABLE_ICON}),
            button({id: "email-editor-style-other", style: "naked align-bottom small-margin-right inner-radius", title: "Other", icon: `<svg xmlns="http://www.w3.org/2000/svg" class="small-icon" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>`})
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
        });
    };
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
        style: `email-message-item${message.id === selectedMailboxMessageId ? " active" : ""}${message.unread ? " unread" : ""}`,
        data: message.id,
        onclick: event => {
            const item = event.target?.closest?.(".email-message-item");
            selectMailboxMessage(item?.getAttribute("data"), item?.closest?.(".email-shell"));
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
    const renderReadingPane = message => {
        if (!message) {
            return div({
                style: "email-reading-empty",
                content: "Select an email to read."
            });
        }
        return children([
            div({style: "email-reading-header", content: children([
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
    const renderMailbox = (messages, {folder = "inbox", title = "Inbox", error = null} = {}) => {
        activeMailboxFolder = folder;
        mailboxMessages = messages;
        if (!mailboxMessages.some(message => message.id === selectedMailboxMessageId)) {
            selectedMailboxMessageId = mailboxMessages[0]?.id || "";
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
                div({style: "email-reading-pane", content: renderReadingPane(selectedMessage)})
            ])
        });
        requestAnimationFrame(() => bindEmailPaneResizer(document));
        requestAnimationFrame(() => applyEmailMessageItemStyles(document));
        requestAnimationFrame(() => updateEmailRouteUnreadCounts());
        return div({
            style: "email-workspace",
            data: folder,
            content: children([
                renderEmailEditorBar(),
                div({style: "spacer"}),
                mailbox
            ])
        });
    };
    const selectMailboxMessage = (messageId, root = document) => {
        root = root || document;
        selectedMailboxMessageId = messageId || selectedMailboxMessageId;
        const selectedMessage = mailboxMessages.find(message => message.id === selectedMailboxMessageId) || mailboxMessages[0];
        root.querySelectorAll(".email-message-item").forEach(item => {
            item.classList.toggle("active", item.getAttribute("data") === selectedMailboxMessageId);
        });
        applyEmailMessageItemStyles(root);
        const pane = root.querySelector(".email-reading-pane");
        if (pane) pane.innerHTML = renderReadingPane(selectedMessage);
    };
    const loadMailboxFolder = (folder = "inbox", title = "Inbox") => {
        prefetchMailboxFolders();
        activeMailboxFolder = folder;
        selectedMailboxMessageId = "";
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
            text: "Spam",
            icon: SPAM_ICON,
            route: () => loadMailboxFolder("spam", "Spam")
        }, {
            text: "Deleted",
            icon: DELETED_ICON,
            route: () => loadMailboxFolder("deleted", "Deleted")
        }]
    })]));
})();
