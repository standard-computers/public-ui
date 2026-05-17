(() => {
    const EMAIL_SERVICE_ID = "com.standard.email";
    const INBOX_COMMAND = `[email] <folder "inbox">`;
    const MAIL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>`;
    const INBOX_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3" /></svg>`;
    const SENT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>`;
    const EVERYTHING_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m7.875 14.25 1.214 1.942a2.25 2.25 0 0 0 1.908 1.058h2.006c.776 0 1.497-.4 1.908-1.058l1.214-1.942M2.41 9h4.636a2.25 2.25 0 0 1 1.872 1.002l.164.246a2.25 2.25 0 0 0 1.872 1.002h2.092a2.25 2.25 0 0 0 1.872-1.002l.164-.246A2.25 2.25 0 0 1 16.954 9h4.636M2.41 9a2.25 2.25 0 0 0-.16.832V12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 12V9.832c0-.287-.055-.57-.16-.832M2.41 9a2.25 2.25 0 0 1 .382-.632l3.285-3.832a2.25 2.25 0 0 1 1.708-.786h8.43c.657 0 1.281.287 1.709.786l3.284 3.832c.163.19.291.404.382.632M4.5 20.25h15A2.25 2.25 0 0 0 21.75 18v-2.625c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125V18a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>`;
    const SPAM_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>`;
    const DELETED_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`;
    let inboxMessages = [];
    let selectedInboxMessageId = "";
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
                return [{id: "message-0", subject: "Inbox", body: trimmed}];
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
        return {
            id: String(firstValue(record, ["id", "emailid", "emailId", "messageId", "message_id"], `message-${index}`)),
            subject,
            from,
            to,
            date,
            body: stripMarkup(body),
            snippet: stripMarkup(firstValue(record, ["snippet", "preview", "summary"], body)).replace(/\s+/g, " ").trim(),
            unread: Boolean(record?.unread || record?.read === false || record?.seen === false),
            raw: record
        };
    };
    const renderEmptyInbox = () => div({
        style: "email-empty-state",
        content: children([
            `<img class="email-empty-icon" src="/icons/interfaces/email.png" alt="">`,
            div({style: "email-empty-label", content: "Inbox is empty"}),
            div({style: "faded", content: "New email will appear here."})
        ])
    });
    const renderMailboxError = error => div({
        style: "email-empty-state",
        content: children([
            `<img class="email-empty-icon" src="/icons/interfaces/email.png" alt="">`,
            div({style: "email-empty-label", content: "Unable to load inbox"}),
            div({style: "faded", content: escapeMarkup(error?.message || "The email command did not return mail.")})
        ])
    });
    const renderMessageListItem = message => div({
        style: `email-message-item${message.id === selectedInboxMessageId ? " active" : ""}${message.unread ? " unread" : ""}`,
        data: message.id,
        onclick: event => {
            const item = event.target?.closest?.(".email-message-item");
            selectInboxMessage(item?.getAttribute("data"), item?.closest?.(".email-shell"));
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
    const renderMailbox = messages => {
        inboxMessages = messages;
        if (!inboxMessages.length) return renderEmptyInbox();
        if (!selectedInboxMessageId || !inboxMessages.some(message => message.id === selectedInboxMessageId)) {
            selectedInboxMessageId = inboxMessages[0].id;
        }
        const selectedMessage = inboxMessages.find(message => message.id === selectedInboxMessageId) || inboxMessages[0];
        return div({
            style: "email-shell",
            content: children([
                div({
                    style: "email-list-pane",
                    content: children([
                        div({style: "email-list-header", content: children([
                            h({level: 3, content: "Inbox"}),
                            div({style: "email-count", content: `${inboxMessages.length}`})
                        ])}),
                        div({style: "email-message-list", content: children(inboxMessages.map(renderMessageListItem))})
                    ])
                }),
                div({style: "email-reading-pane", content: renderReadingPane(selectedMessage)})
            ])
        });
    };
    const selectInboxMessage = (messageId, root = document) => {
        root = root || document;
        selectedInboxMessageId = messageId || selectedInboxMessageId;
        const selectedMessage = inboxMessages.find(message => message.id === selectedInboxMessageId) || inboxMessages[0];
        root.querySelectorAll(".email-message-item").forEach(item => {
            item.classList.toggle("active", item.getAttribute("data") === selectedInboxMessageId);
        });
        const pane = root.querySelector(".email-reading-pane");
        if (pane) pane.innerHTML = renderReadingPane(selectedMessage);
    };
    const loadInbox = () => CLI.send(INBOX_COMMAND)
        .then(response => renderMailbox(parseResponse(response).map(normalizeMessage)))
        .catch(error => {
            console.error("Failed to load inbox:", error);
            return renderMailboxError(error);
        });
    const renderMailboxRoute = title => div({
        style: "small-padding",
        content: children([
            h({level: 3, content: title}),
            div({style: "spacer"}),
            div({
                style: "padded secondary-tile brick radius faded",
                content: `${title} mail will appear here.`
            })
        ])
    });
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
            route: () => loadInbox()
        }, {
            text: "Sent",
            icon: SENT_ICON,
            route: () => renderMailboxRoute("Sent")
        }, {
            text: "Everything",
            icon: EVERYTHING_ICON,
            route: () => renderMailboxRoute("Everything")
        }, {
            text: "Spam",
            icon: SPAM_ICON,
            route: () => renderMailboxRoute("Spam")
        }, {
            text: "Deleted",
            icon: DELETED_ICON,
            route: () => renderMailboxRoute("Deleted")
        }]
    })]));
})();