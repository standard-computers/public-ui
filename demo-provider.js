const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizePath(value = "") {
    return String(value || "")
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\/home\/standard-system\/?/, "")
        .replace(/^\/+|\/+$/g, "");
}

function tokenize(value = "") {
    const tokens = [];
    let current = "";
    let quote = "";
    let escaped = false;
    let depth = 0;
    for (const character of String(value)) {
        if (escaped) {
            current += character;
            escaped = false;
            continue;
        }
        if (character === "\\") {
            escaped = true;
            continue;
        }
        if (quote) {
            if (character === quote) quote = "";
            else current += character;
            continue;
        }
        if (character === "\"" || character === "'") {
            quote = character;
            continue;
        }
        if (character === "[" || character === "(" || character === "{") depth += 1;
        if (character === "]" || character === ")" || character === "}") depth = Math.max(0, depth - 1);
        if (/\s|,/.test(character) && depth === 0) {
            if (current) tokens.push(current);
            current = "";
            continue;
        }
        current += character;
    }
    if (current) tokens.push(current);
    return tokens;
}

function parseValue(value = "") {
    const normalized = String(value || "").trim();
    if (normalized.startsWith("@")) return normalized.slice(1);
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    if (normalized === "null" || normalized === "@") return null;
    if (/^-?\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized);
    if ((normalized.startsWith("[") && normalized.endsWith("]")) || (normalized.startsWith("{") && normalized.endsWith("}"))) {
        try {
            return JSON.parse(normalized);
        } catch (_) {
            return normalized;
        }
    }
    return normalized;
}

function parseFilter(value = "") {
    const filter = {};
    const tokens = tokenize(value);
    for (let index = 0; index < tokens.length; index += 2) {
        if (tokens[index]) filter[tokens[index].toLowerCase()] = parseValue(tokens[index + 1] || "");
    }
    return filter;
}

function recordMatches(record, filter) {
    return Object.entries(filter).every(([key, value]) => {
        const candidate = record[key] ?? record[key.toLowerCase()] ?? record[key.toUpperCase()];
        return String(candidate ?? "") === String(value ?? "");
    });
}

function decodeNestedJson(value) {
    let candidate = value;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (candidate && typeof candidate === "object") return candidate;
        if (typeof candidate !== "string" || !candidate.trim()) return candidate;
        try {
            candidate = JSON.parse(candidate);
        } catch (_) {
            return candidate;
        }
    }
    return candidate;
}

class DemoProvider {
    constructor({fixturePath, ttlMs = DEFAULT_TTL_MS, maxSessions = 50} = {}) {
        this.fixturePath = fixturePath || path.join(__dirname, "demo-data.json");
        this.ttlMs = Math.max(60_000, Number(ttlMs) || DEFAULT_TTL_MS);
        this.maxSessions = Math.max(1, Number(maxSessions) || 50);
        this.sessions = new Map();
        this.fixture = this.loadFixture();
    }

    loadFixture() {
        const fixture = JSON.parse(fs.readFileSync(this.fixturePath, "utf8"));
        if (!fixture || typeof fixture !== "object" || !fixture.records || !fixture.files) {
            throw new Error("Demo fixture must contain records and files");
        }
        return fixture;
    }

    createState() {
        const state = clone(this.fixture);
        state.records = state.records || {};
        state.content = state.content || {};
        state.files = state.files || {};
        state.nextId = Number(state.nextId) || 1000;
        return state;
    }

    ensureSession(session) {
        if (!session) throw new Error("Demo session is required");
        this.prune();
        if (!session.demoId) session.demoId = crypto.randomUUID();
        let entry = this.sessions.get(session.demoId);
        if (!entry) {
            if (this.sessions.size >= this.maxSessions) {
                const error = new Error("Demo capacity reached");
                error.code = "DEMO_CAPACITY";
                throw error;
            }
            entry = {state: this.createState(), lastSeenAt: Date.now()};
            this.sessions.set(session.demoId, entry);
        }
        entry.lastSeenAt = Date.now();
        return entry.state;
    }

    resetSession(session) {
        if (session?.demoId) this.sessions.delete(session.demoId);
    }

    prune() {
        const cutoff = Date.now() - this.ttlMs;
        for (const [id, entry] of this.sessions.entries()) {
            if (!entry?.lastSeenAt || entry.lastSeenAt < cutoff) this.sessions.delete(id);
        }
    }

    user(session) {
        const state = this.ensureSession(session);
        return clone(state.records.user?.[0] || null);
    }

    records(session, standard) {
        const state = this.ensureSession(session);
        return clone(state.records[String(standard || "").toLowerCase()] || []);
    }

    execute(session, rawCommand) {
        const state = this.ensureSession(session);
        const command = String(rawCommand || "").trim();
        if (!command) return "";
        if (command === "status") return JSON.stringify({status: "connected", mode: "demo", device: "Public Demo"});
        if (command === "stds") return Object.keys(state.records).join("\n");
        if (command.startsWith("stds ")) {
            const standard = command.slice(5).replace(/\s+json$/i, "").trim().toLowerCase();
            const fields = Object.keys(state.records[standard]?.[0] || {});
            return command.endsWith(" json") ? JSON.stringify({name: standard, fields}) : fields.join("\n");
        }
        if (/^tree(?:\s|$)/i.test(command)) return JSON.stringify(this.tree(state, command.replace(/^tree\s*/i, "")));
        if (/^files\s+/i.test(command)) return this.executeFileCommand(state, command);
        if (/^rcs\s+/i.test(command)) return "1";

        const match = command.match(/^\[([a-z0-9_-]+)]\s*([\s\S]*)$/i);
        if (!match) return "0";
        const standard = match[1].toLowerCase();
        const body = match[2].trim();
        if (!state.records[standard]) state.records[standard] = [];
        if (!body || body.startsWith("<")) return JSON.stringify(this.selectRecords(state, standard, body));
        if (body.startsWith("+")) return this.createRecord(state, standard, body);
        if (body.startsWith("-")) return this.deleteRecord(state, standard, body);
        return this.updateRecord(state, standard, body);
    }

    selectRecords(state, standard, body) {
        const filterMatch = body.match(/<([\s\S]+)>/);
        const filter = filterMatch ? parseFilter(filterMatch[1]) : {};
        let records = state.records[standard].filter(record => recordMatches(record, filter));
        if (standard === "email" && /\bdirection\s+2\b/i.test(filterMatch?.[1] || "")) {
            records = state.records.email.filter(record => Number(record.direction) === 2);
        }
        return {[standard]: clone(records)};
    }

    createRecord(state, standard, body) {
        const valuesMatch = body.match(/\(([\s\S]*)\)/);
        const values = tokenize(valuesMatch?.[1] || "").map(parseValue);
        const id = String(++state.nextId);
        const fieldMap = {
            contacts: ["firstname", "middlename", "lastname", "birthday", "address", "phone", "email", "company"],
            notes: ["user", "content", "color", "parent"],
            alarms: ["user", "name", "timestamp", "level", "enabled", "repeats", "days"],
            cats: ["name", "color"],
            events: ["owner", "category", "name", "start", "end", "invitees", "recurrence"],
            email: ["thread", "messageId", "inReplyTo", "references", "threadTopic", "threadIndex", "draft", "from", "to", "cc", "bcc", "subject", "body", "html", "folder", "category", "read", "starred", "priority", "direction", "date", "parent"],
            articles: ["title", "description", "link", "content", "source", "priority"]
        };
        const record = {id};
        (fieldMap[standard] || []).forEach((field, index) => {
            record[field] = values[index];
        });
        if (standard === "cache") {
            record.user = values[0];
            record.key = values[1];
            record.value = values[2];
        }
        if (standard === "email" && record.date === "$now") record.date = new Date().toISOString();
        if (!record.created) record.created = new Date().toISOString();
        state.records[standard].push(record);
        return id;
    }

    deleteRecord(state, standard, body) {
        const filter = parseFilter(body.match(/<([\s\S]+)>/)?.[1] || "");
        const before = state.records[standard].length;
        state.records[standard] = state.records[standard].filter(record => !recordMatches(record, filter));
        return before === state.records[standard].length ? "0" : "1";
    }

    updateRecord(state, standard, body) {
        const filterText = body.match(/<([\s\S]+)>/)?.[1] || "";
        const filter = parseFilter(filterText);
        const assignment = body.replace(/<[\s\S]+>/, "").trim();
        const tokens = tokenize(assignment);
        const field = tokens.shift();
        const value = decodeNestedJson(parseValue(tokens.join(" ")));
        const records = state.records[standard].filter(record => recordMatches(record, filter));
        records.forEach(record => {
            record[field] = value;
            if (standard === "user" && field === "settings") record.theme = value;
        });
        return records.length ? "1" : "0";
    }

    executeFileCommand(state, command) {
        const tokens = tokenize(command);
        const action = (tokens[1] || "").toLowerCase();
        const source = normalizePath(tokens[2]);
        const target = normalizePath(tokens[3]);
        if (action === "folders") {
            const folder = source;
            if (folder && !state.files[folder]) state.files[folder] = {type: "directory"};
            return "1";
        }
        if (action === "remove") {
            let removed = false;
            for (const filePath of Object.keys(state.files)) {
                if (filePath === source || filePath.startsWith(`${source}/`)) {
                    delete state.files[filePath];
                    removed = true;
                }
            }
            return removed ? "1" : "0";
        }
        if (action === "move" && source && target) {
            const moved = {};
            for (const [filePath, file] of Object.entries(state.files)) {
                if (filePath === source || filePath.startsWith(`${source}/`)) {
                    moved[`${target}${filePath.slice(source.length)}`] = file;
                    delete state.files[filePath];
                }
            }
            Object.assign(state.files, moved);
            return Object.keys(moved).length ? "1" : "0";
        }
        return "0";
    }

    tree(state, requestedPath = "") {
        const directory = normalizePath(requestedPath);
        const prefix = directory ? `${directory}/` : "";
        const children = [];
        const seen = new Set();
        for (const [filePath, file] of Object.entries(state.files)) {
            if (directory && filePath !== directory && !filePath.startsWith(prefix)) continue;
            const remainder = directory ? filePath.slice(prefix.length) : filePath;
            if (!remainder || remainder.startsWith("../")) continue;
            const [name, ...rest] = remainder.split("/");
            const childPath = directory ? `${directory}/${name}` : name;
            if (seen.has(childPath)) continue;
            seen.add(childPath);
            const isDirectory = rest.length > 0 || file.type === "directory";
            children.push({
                name,
                path: `/home/standard-system/${childPath}`,
                type: isDirectory ? "directory" : (file.contentType || "file"),
                ...(isDirectory ? {children: []} : {})
            });
        }
        return {
            name: directory.split("/").pop() || "standard-system",
            path: `/home/standard-system/${directory}`,
            type: "directory",
            children
        };
    }

    allFiles(session) {
        const state = this.ensureSession(session);
        return Object.entries(state.files)
            .filter(([, file]) => file.type !== "directory")
            .map(([filePath, file], index) => ({
                id: `file-${index + 1}`,
                name: path.posix.basename(filePath),
                path: `/home/standard-system/${filePath}`,
                type: file.contentType || "file"
            }));
    }

    uploadFile(session, directory, file) {
        const state = this.ensureSession(session);
        const normalizedDirectory = normalizePath(directory);
        const filePath = normalizePath(`${normalizedDirectory}/${file.originalname}`);
        state.files[filePath] = {
            contentType: file.mimetype || "application/octet-stream",
            content: Buffer.from(file.buffer).toString("base64")
        };
        return filePath;
    }

    linkRecordContent(session, recordId, file) {
        const state = this.ensureSession(session);
        state.content[String(recordId)] = {
            contentType: file.mimetype || "application/octet-stream",
            name: file.originalname,
            content: Buffer.from(file.buffer).toString("base64")
        };
        return String(recordId);
    }

    getRecordContent(session, recordId) {
        const state = this.ensureSession(session);
        const entry = state.content[String(recordId)];
        if (!entry) return null;
        return {...entry, buffer: Buffer.from(entry.content || "", "base64")};
    }

    getFile(session, rawPath) {
        const state = this.ensureSession(session);
        const entry = state.files[normalizePath(rawPath)];
        if (!entry || entry.type === "directory") return null;
        return {...entry, buffer: Buffer.from(entry.content || "", "base64")};
    }
}

module.exports = {DemoProvider};
