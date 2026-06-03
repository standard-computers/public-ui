let usingHttps = false;
require("dotenv").config();
const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
const multer = require("multer");
const upload = multer({limits: {fileSize: MAX_UPLOAD_BYTES}});
const express = require("express");
const exphbs = require("express-handlebars");
const cors = require("cors");
const path = require("path");
const http = require("http");
const https = require("https");
const WebSocket = require("ws");
const fs = require("fs/promises");
const fsSync = require("fs");
const crypto = require("crypto");
const os = require("os");
const cookieParser = require('cookie-parser');
const {Bonjour} = require("bonjour-service");
const app = express();
const APP_RUNTIME = (process.env.APP_RUNTIME || (process.versions?.electron ? "electron" : "server")).trim().toLowerCase();
const isElectronRuntime = APP_RUNTIME === "electron";
const PORT = Number(process.env.PORT || 80);
const STD_SYS_PORT = process.env.STD_SYS_PORT || 9002;
const TIMEOUT = process.env.TIMEOUT || 60000;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || "/etc/letsencrypt/live/ui.standardcomputers.net/fullchain.pem";
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || "/etc/letsencrypt/live/ui.standardcomputers.net/privkey.pem";
const MODE = (process.env.MODE || "").toLowerCase();
const isRelayMode = MODE === "relay";
const isDesktopSetupEnabled = isElectronRuntime && !isRelayMode;
function resolveWsUrl() {
    const configuredUrl = (process.env.CPP_WS_URL || "").trim();
    const defaultProtocol = isRelayMode ? "wss" : "ws";
    const fallbackUrl = `${defaultProtocol}://127.0.0.1:${STD_SYS_PORT}`;
    if (!configuredUrl) return fallbackUrl;
    if (!isRelayMode) return configuredUrl;
    return configuredUrl.replace(/^ws:\/\//i, "wss://");
}
const WS_URL = resolveWsUrl();
const STANDARD_CHIT = (process.env.STANDARD_CHIT || "").trim();
const SETUP_COOKIE_NAME = "setup";
const SETUP_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365;
const REQUIRED_RELAY_COOKIES = ["relay_chit", "relay_device", "sid", "uid"];
const RELAY_CONNECTION_EXEMPT_PATHS = ["/bad-connection", "/api/login", "/api/status", "/api/device/status", "/api/keys/push"];
const RELAY_COOKIE_DOMAIN = process.env.RELAY_COOKIE_DOMAIN || process.env.COOKIE_DOMAIN || "";
const RELAY_COOKIE_SECRET = process.env.RELAY_COOKIE_SECRET || process.env.COOKIE_SECRET || process.env.SESSION_SECRET || "";
const RELAY_COOKIE_SECRETS = process.env.RELAY_COOKIE_SECRETS || "";
const RELAY_SETTINGS_COOKIE_PREFIX = process.env.RELAY_SETTINGS_COOKIE_PREFIX || "relay_settings_";
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || "";
const MAPBOX_ACCESS_TOKEN = (process.env.MAPBOX_ACCESS_TOKEN || "").trim();
const RECONNECT_INTERVAL = Number(process.env.WS_RETRY_INTERVAL || 15000);
const WS_CONNECT_TIMEOUT = Number(process.env.WS_CONNECT_TIMEOUT || 10000);
const WS_BINARY_SETTLE_MS = Math.max(120, Number(process.env.WS_BINARY_SETTLE_MS || (isRelayMode ? 1000 : 120)) || 120);
const SESSION_TTL_MS = Math.max(60 * 1000, Number(process.env.SESSION_TTL_MS || 1000 * 60 * 60 * 12) || 1000 * 60 * 60 * 12);
const SESSION_PRUNE_INTERVAL_MS = Math.max(60 * 1000, Number(process.env.SESSION_PRUNE_INTERVAL_MS || 1000 * 60 * 10) || 1000 * 60 * 10);
const USER_RECORD_CACHE_TTL_MS = Math.max(5 * 1000, Number(process.env.USER_RECORD_CACHE_TTL_MS || 1000 * 60 * 5) || 1000 * 60 * 5);
const REQUEST_BODY_LIMIT = (process.env.REQUEST_BODY_LIMIT || "25mb").trim() || "25mb";
const THEMES_REPO_PATH = path.join(__dirname, "public", "themes.json");
const USER_DATA_ROOT = path.join(__dirname, "user_data");
const ELECTRON_SETUP_CONFIG_PATH = path.join(USER_DATA_ROOT, "desktop-setup.json");
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(origin => origin.trim()).filter(Boolean);
const LOCAL_HOSTNAME = (process.env.LOCAL_HOSTNAME || "standard").replace(/\.local$/i, "").trim();
const shouldAdvertiseLocalHostname = !isRelayMode && Boolean(LOCAL_HOSTNAME);
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (!allowedOrigins.length || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
};
let wsClient;
let reconnectTimer = null;
let wsConnectTimer = null;
let connectionStatus = "connecting";
const statusSubscribers = new Set();
const pushSubscribers = new Set();
const userSessions = new Map();
const knownUsernames = new Map();
const knownUserFolders = new Map();
let fileDownloadQueue = Promise.resolve();
let fileUploadQueue = Promise.resolve();
const AUTO_UPLOAD_FOLDERS_BY_EXTENSION = {
    Music: new Set(["aac", "aif", "aiff", "alac", "flac", "m4a", "mid", "midi", "mp3", "oga", "ogg", "opus", "wav", "weba", "wma"]),
    Photos: new Set(["avif", "bmp", "gif", "heic", "heif", "ico", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"]),
    Videos: new Set(["3gp", "avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "ogv", "webm", "wmv"])
};
const AUTO_UPLOAD_FOLDERS_BY_MIME_PREFIX = {
    "audio/": "Music",
    "image/": "Photos",
    "video/": "Videos"
};
let recordImageQueue = Promise.resolve();
let bonjour = null;
let bonjourService = null;
const wsRequestQueue = [];
let activeWsRequest = null;
let wsRequestSequence = 0;
let runtimeWsUrl = WS_URL;
let runtimeStandardChit = STANDARD_CHIT;
let runtimeMapboxAccessToken = MAPBOX_ACCESS_TOKEN;

function parseCookies(cookieHeader = "") {
    return cookieHeader.split(";").reduce((acc, pair) => {
        const index = pair.indexOf("=");
        if (index === -1) return acc;
        const key = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        if (!key || !value) return acc;
        acc[key] = decodeURIComponent(value);
        return acc;
    }, {});
}

function getRequestCookies(req) {
    if (req?.cookies && typeof req.cookies === "object") {
        const signedCookies = req?.signedCookies && typeof req.signedCookies === "object" ? req.signedCookies : {};
        return {...req.cookies, ...signedCookies};
    }
    return parseCookies(req?.headers?.cookie || "");
}

function pathStartsWithAny(pathname = "", prefixes = []) {
    return prefixes.some(prefix => pathname.startsWith(prefix));
}

function isRelayConnectionExemptPath(req) {
    return pathStartsWithAny(req?.path || "", RELAY_CONNECTION_EXEMPT_PATHS);
}

function hasRequiredRelayCookies(req) {
    const cookies = getRequestCookies(req);
    return REQUIRED_RELAY_COOKIES.every(cookieName => String(cookies[cookieName] || "").trim());
}

const relaySecrets = [
    RELAY_COOKIE_SECRET,
    ...RELAY_COOKIE_SECRETS.split(",").map(secret => secret.trim()).filter(Boolean)
].filter(Boolean);
const relayKeys = relaySecrets.map(secret => crypto.createHash("sha256").update(secret).digest());

if (isRelayMode && !relayKeys.length) {
    throw new Error("Relay mode requires RELAY_COOKIE_SECRET, COOKIE_SECRET, or SESSION_SECRET to be set.");
}

function isSecureRequest(req) {
    if (usingHttps) return true;
    const forwardedProto = req?.headers?.["x-forwarded-proto"];
    return !!(req?.secure || (typeof forwardedProto === "string" && forwardedProto.split(",")[0].trim() === "https"));
}

function encryptCookieValue(value = "") {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", relayKeys[0], iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decryptCookieValue(encoded = "") {
    const normalized = normalizeRelayCookieValue(encoded);
    if (!normalized) return null;
    const data = Buffer.from(normalized, "base64");
    if (data.length < 28) return null;
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const ciphertext = data.subarray(28);
    for (const key of relayKeys) {
        try {
            const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
            decipher.setAuthTag(tag);
            const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
            return decrypted.toString("utf8");
        } catch (err) {
            continue;
        }
    }
    console.error("Failed to decrypt relay cookie: Unsupported state or unable to authenticate data");
    return null;
}

function normalizeRelayCookieValue(value = "") {
    if (!value) return "";
    let cleaned = value.trim();
    if ((cleaned.startsWith("\"") && cleaned.endsWith("\"")) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) cleaned = cleaned.slice(1, -1);
    cleaned = cleaned.replace(/ /g, "+");
    cleaned = cleaned.replace(/-/g, "+").replace(/_/g, "/");
    const paddingNeeded = cleaned.length % 4;
    if (paddingNeeded) cleaned = cleaned.padEnd(cleaned.length + (4 - paddingNeeded), "=");
    return cleaned;
}

function readRelayCookies(req) {
    const cookies = getRequestCookies(req);
    const deviceSerial = decryptCookieValue(cookies["relay_device"]);
    const chit = decryptCookieValue(cookies["relay_chit"]);
    if (deviceSerial && chit) return {deviceSerial, chit};
    return null;
}

function writeRelayCookies(req, res, {deviceSerial, chit}) {
    const domain = RELAY_COOKIE_DOMAIN || undefined;
    const baseOptions = {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isSecureRequest(req),
        domain
    };
    res.cookie("relay_device", encryptCookieValue(deviceSerial), baseOptions);
    res.cookie("relay_chit", encryptCookieValue(chit), baseOptions);
}

function clearRelayCookies(req, res) {
    const domain = RELAY_COOKIE_DOMAIN || undefined;
    const baseOptions = {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isSecureRequest(req),
        maxAge: 0,
        domain
    };
    res.cookie("relay_device", "", baseOptions);
    res.cookie("relay_chit", "", baseOptions);
}

function encodeUserCookieValue(userRecord = {}) {
    return Buffer.from(JSON.stringify(userRecord)).toString("base64url");
}

function writeUserDataCookie(res, userRecord = null) {
    if (!res) return;
    if (!userRecord || typeof userRecord !== "object" || Array.isArray(userRecord)) {
        res.cookie("user", "", {maxAge: 0, httpOnly: true, sameSite: "lax", path: "/"});
        return;
    }
    const encoded = encodeUserCookieValue(userRecord);
    res.cookie("user", encoded, {httpOnly: true, sameSite: "lax", path: "/", maxAge: 1000 * 60 * 60 * 24 * 30});
}

function getRuntimeWsUrl() {
    return runtimeWsUrl || resolveWsUrl();
}

function getRuntimeStandardChit() {
    return runtimeStandardChit || "";
}

function getRuntimeMapboxAccessToken() {
    return runtimeMapboxAccessToken || "";
}

function applyDesktopSetupConfig({endpoint, deviceKey, mapboxKey} = {}) {
    const nextEndpoint = typeof endpoint === "string" ? endpoint.trim() : "";
    const nextDeviceKey = typeof deviceKey === "string" ? deviceKey.trim() : "";
    const nextMapboxKey = typeof mapboxKey === "string" ? mapboxKey.trim() : "";
    runtimeWsUrl = nextEndpoint || resolveWsUrl();
    runtimeStandardChit = nextDeviceKey || STANDARD_CHIT;
    runtimeMapboxAccessToken = nextMapboxKey || MAPBOX_ACCESS_TOKEN;
}

function hasSavedDesktopSetupConfig() {
    return Boolean(String(runtimeStandardChit || "").trim());
}

async function loadDesktopSetupConfig() {
    if (!isElectronRuntime) return;
    try {
        const raw = await fs.readFile(ELECTRON_SETUP_CONFIG_PATH, "utf8");
        const parsed = JSON.parse(raw);
        applyDesktopSetupConfig(parsed);
    } catch (err) {
        if (err?.code !== "ENOENT") {
            console.error("Failed to load desktop setup config:", err.message);
        }
    }
}

async function saveDesktopSetupConfig({endpoint, deviceKey, mapboxKey} = {}) {
    await ensureUserDataRoot();
    const payload = {
        endpoint: typeof endpoint === "string" ? endpoint.trim() : "",
        deviceKey: typeof deviceKey === "string" ? deviceKey.trim() : "",
        mapboxKey: typeof mapboxKey === "string" ? mapboxKey.trim() : ""
    };
    await fs.writeFile(ELECTRON_SETUP_CONFIG_PATH, JSON.stringify(payload, null, 2), "utf8");
    applyDesktopSetupConfig(payload);
}

function decodeUserCookieValue(value = "") {
    if (!value || typeof value !== "string") return null;
    try {
        return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    } catch (_) {
        return null;
    }
}

function relaySettingsCookieBaseName(fileName = "") {
    const normalized = String(fileName || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    if (!normalized) throw new Error("Invalid relay settings cookie name");
    return `${RELAY_SETTINGS_COOKIE_PREFIX}${normalized}`;
}

function clearRelaySettingsCookie(req, res, fileName) {
    const cookies = getRequestCookies(req);
    const baseName = relaySettingsCookieBaseName(fileName);
    const countName = `${baseName}_count`;
    const options = {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isSecureRequest(req),
        domain: RELAY_COOKIE_DOMAIN || undefined,
        maxAge: 0
    };
    const storedCount = Number.parseInt(cookies[countName], 10);
    if (Number.isInteger(storedCount) && storedCount > 0) {
        for (let index = 0; index < storedCount; index += 1) {
            res.cookie(`${baseName}_${index}`, "", options);
        }
    }
    Object.keys(cookies).forEach(cookieName => {
        if (cookieName === baseName || cookieName === countName || cookieName.startsWith(`${baseName}_`)) {
            res.cookie(cookieName, "", options);
        }
    });
    res.cookie(baseName, "", options);
    res.cookie(countName, "", options);
}

function attachRelayContextToSession(req, relayContext) {
    if (!relayContext || !req) return;
    if (!req.session) return;
    req.session.relayContext = relayContext;
}

function buildRelayCommand(command, relayContext, {allowMissingContext = false} = {}) {
    if (!isRelayMode || typeof command !== "string") return command;
    const trimmed = command.trimStart();
    const lowered = trimmed.toLowerCase();
    const relayPrefixed = lowered.startsWith("relay");
    const relayParts = trimmed.split("~").map(part => part.trim()).filter(Boolean);
    const hasExplicitRelayTarget = relayPrefixed && trimmed.includes("~") && relayParts.length >= 2;
    if (hasExplicitRelayTarget) {
        return command;
    }
    if (!relayContext || !relayContext.deviceSerial || !relayContext.chit) {
        if (allowMissingContext) return command;
        throw new Error("Missing relay context for command");
    }
    const commandBody = relayPrefixed ? trimmed.replace(/^relay\s*~\s*/i, "").trim() : command;
    return `relay ~ ${relayContext.deviceSerial} ~ ${relayContext.chit} ~ ${commandBody}`;
}

function prepareCommandForRequest(req, res, command, {allowMissingRelayContext = false} = {}) {
    const relayContext = resolveRelayContext(req);
    if (isRelayMode && !relayContext && !allowMissingRelayContext) {
        if (res && !res.headersSent) res.redirect("/bad-connection");
        return null;
    }
    try {
        return buildRelayCommand(command, relayContext, {allowMissingContext: allowMissingRelayContext});
    } catch (err) {
        console.error("Failed to prepare relay command:", err.message);
        if (res && !res.headersSent) res.status(400).send("Missing relay connection data");
        return null;
    }
}

function getSessionCookieOptions(req = null) {
    return {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: req ? isSecureRequest(req) : false
    };
}

function cloneUserRecordForSession(userRecord) {
    if (!userRecord || typeof userRecord !== "object" || Array.isArray(userRecord)) {
        return null;
    }
    try {
        return JSON.parse(JSON.stringify(userRecord));
    } catch (_) {
        return null;
    }
}

function setCachedUserRecord(session, userRecord) {
    if (!session) return;
    const cloned = cloneUserRecordForSession(userRecord);
    if (!cloned) {
        delete session.userRecordCache;
        delete session.userRecordCachedAt;
        return;
    }
    session.userRecordCache = cloned;
    session.userRecordCachedAt = Date.now();
}

function getCachedUserRecord(session) {
    if (!session?.userRecordCache || !session?.userRecordCachedAt) {
        return null;
    }
    if ((Date.now() - session.userRecordCachedAt) > USER_RECORD_CACHE_TTL_MS) {
        delete session.userRecordCache;
        delete session.userRecordCachedAt;
        return null;
    }
    return cloneUserRecordForSession(session.userRecordCache);
}

function setSession(res, userId, userFolder = userId) {
    const token = crypto.randomUUID();
    const now = Date.now();
    const session = {userId, userFolder, createdAt: now, lastSeenAt: now};
    userSessions.set(token, session);
    res.cookie("sid", token, getSessionCookieOptions());
    return session;
}

function clearSession(res, token, req = null) {
    if (token && userSessions.has(token)) userSessions.delete(token);
    res.cookie("sid", "", {...getSessionCookieOptions(req), maxAge: 0});
}

function hasCompletedDesktopSetup(req) {
    if (!isDesktopSetupEnabled) return true;
    if (hasSavedDesktopSetupConfig()) return true;
    const setupValue = String(getRequestCookies(req)?.[SETUP_COOKIE_NAME] || "").trim().toLowerCase();
    return setupValue === "true";
}

function setDesktopSetupCookie(res, req) {
    res.cookie(SETUP_COOKIE_NAME, "true", {
        ...getSessionCookieOptions(req),
        maxAge: SETUP_COOKIE_MAX_AGE_MS
    });
}

function isExpiredSession(session) {
    if (!session?.lastSeenAt) return true;
    return (Date.now() - session.lastSeenAt) > SESSION_TTL_MS;
}

function pruneExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of userSessions.entries()) {
        if (!session?.lastSeenAt || (now - session.lastSeenAt) > SESSION_TTL_MS) {
            userSessions.delete(token);
        }
    }
}

function sessionMiddleware(req, res, next) {
    const cookies = getRequestCookies(req);
    const token = cookies.sid;
    if (token && userSessions.has(token)) {
        const session = userSessions.get(token);
        if (isExpiredSession(session)) {
            userSessions.delete(token);
            res.cookie("sid", "", {...getSessionCookieOptions(req), maxAge: 0});
        } else {
            session.lastSeenAt = Date.now();
            req.session = session;
            req.sessionToken = token;
        }
    } else if (isRelayMode && token) {
        const userId = sanitizeUserId(cookies.uid || "");
        const relayContext = readRelayCookies(req);
        if (userId && relayContext) {
            const now = Date.now();
            const session = {
                userId,
                userFolder: userId,
                createdAt: now,
                lastSeenAt: now,
                relayContext
            };
            userSessions.set(token, session);
            req.session = session;
            req.sessionToken = token;
        }
    }
    next();
}

function isRelayFailureResponse(value = "") {
    const normalized = String(value || "").trim().toUpperCase();
    return normalized.startsWith("RELAY ") || normalized.includes(" RELAY ");
}

async function ensureUserDataRoot() {
    await fs.mkdir(USER_DATA_ROOT, {recursive: true, mode: 0o700});
}

async function readThemesRepo() {
    try {
        const raw = await fs.readFile(THEMES_REPO_PATH, "utf8");
        const parsed = JSON.parse(raw);
        return {themes: Array.isArray(parsed?.themes) ? parsed.themes : []};
    } catch (err) {
        if (err.code === "ENOENT") return {themes: []};
        throw err;
    }
}

async function writeThemesRepo(repo) {
    await fs.mkdir(path.dirname(THEMES_REPO_PATH), {recursive: true});
    await fs.writeFile(THEMES_REPO_PATH, JSON.stringify({themes: Array.isArray(repo?.themes) ? repo.themes : []}, null, 2));
}

function createServer() {
    if (!isElectronRuntime && (isRelayMode || Number(PORT) === 443)) {
        try {
            const sslOptions = {key: fsSync.readFileSync(SSL_KEY_PATH), cert: fsSync.readFileSync(SSL_CERT_PATH)};
            usingHttps = true;
            console.log("Starting HTTPS server using Let's Encrypt certificates for ui.standardcomputers.net");
            return https.createServer(sslOptions, app);
        } catch (err) {
            console.error("Failed to load SSL certificates; falling back to HTTP:", err.message);
        }
    }
    return http.createServer(app);
}

function sanitizeUserId(userId = "") {
    return userId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function sanitizeUsername(username = "") {
    return `${username}`.trim().toLowerCase();
}

function resolveKnownUserId(username = "") {
    const normalizedUsername = sanitizeUsername(username);
    if (!normalizedUsername) return "";
    const directUserId = knownUsernames.get(normalizedUsername);
    if (directUserId) return directUserId;
    for (const [knownUsername, knownUserId] of knownUsernames.entries()) {
        if (sanitizeUsername(knownUsername) === normalizedUsername) {
            return knownUserId;
        }
    }
    return "";
}

function resolveUserFromUsers(username = "", users = []) {
    const normalizedUsername = sanitizeUsername(username);
    if (!normalizedUsername || !Array.isArray(users)) return null;
    for (const user of users) {
        if (!user) continue;
        const candidateUsername = sanitizeUsername(user.username || "");
        const candidateUserId = sanitizeUserId(user.userId || "");
        if (candidateUsername === normalizedUsername || sanitizeUsername(candidateUserId) === normalizedUsername) {
            return user;
        }
    }
    return null;
}

function resolveSessionUserFolder(session) {
    return sanitizeUserId(session?.userFolder || session?.userId || "");
}

async function ensureUserDir(userId) {
    await ensureUserDataRoot();
    const userDir = path.join(USER_DATA_ROOT, userId);
    await fs.mkdir(userDir, {recursive: true, mode: 0o700});
    return userDir;
}

function extractUsers(data) {
    const raw = data.toString();
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        return [];
    }
    const users = (() => {
        if (Array.isArray(parsed)) return parsed;
        if (!parsed || typeof parsed !== "object") return [];
        if (Array.isArray(parsed.user)) return parsed.user;
        if (Array.isArray(parsed.users)) return parsed.users;
        if (Array.isArray(parsed.records)) return parsed.records;
        if (Array.isArray(parsed.record)) return parsed.record;
        if (Array.isArray(parsed.data)) return parsed.data;
        if (Array.isArray(parsed.results)) return parsed.results;
        if (Array.isArray(parsed.items)) return parsed.items;
        const firstArrayEntry = Object.values(parsed).find(Array.isArray);
        if (Array.isArray(firstArrayEntry)) return firstArrayEntry;
        if (parsed.user && typeof parsed.user === "object") return [parsed.user];
        if (parsed.record && typeof parsed.record === "object") return [parsed.record];
        return [parsed];
    })();
    return users
        .map(item => {
            if (typeof item === "string") {
                const userId = sanitizeUserId(item);
                return userId ? {userId, username: userId, userFolder: userId} : null;
            }
            if (!item || typeof item !== "object") return null;
            const userId = sanitizeUserId(item.userid || item.userId || item.id || item.email || item.name || "");
            const displayName = [item.firstname, item.lastname].filter(Boolean).join(" ").trim();
            const username = sanitizeUsername(
                item.username || item.userName || item.displayName || displayName || item.name || item.email || item.userid || item.userId || item.id || ""
            );
            const userFolder = sanitizeUserId(item.userid || item.userId || userId || item.id || "");
            if (!userId) return null;
            return {userId, username, userFolder: userFolder || userId};
        })
        .filter(Boolean);
}

function resolveRelayContext(req) {
    if (!isRelayMode) return null;
    const contextFromSession = req?.session?.relayContext;
    if (contextFromSession && contextFromSession.deviceSerial && contextFromSession.chit) return contextFromSession;
    const contextFromCookies = req ? readRelayCookies(req) : null;
    if (contextFromCookies) return contextFromCookies;
    return null;
}

function createWsError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function parseRelayControlPayload(data, isBinary = false) {
    if (!isRelayMode || isBinary) return null;
    const raw = Buffer.isBuffer(data) ? data.toString("utf8") : String(data ?? "");
    if (!raw || raw[0] !== "{") return null;
    try {
        const payload = JSON.parse(raw);
        if (!payload || payload.standard_relay !== 1 || typeof payload.kind !== "string") return null;
        return payload;
    } catch (_) {
        return null;
    }
}

function bindRelayRequestId(entry, requestId) {
    const normalized = String(requestId || "").trim();
    if (!entry || !normalized) return true;
    if (!entry.relayRequestId) {
        entry.relayRequestId = normalized;
        return true;
    }
    return entry.relayRequestId === normalized;
}

function relayProtocolError(entry, message) {
    failWsRequest(entry, createWsError("WS_RELAY_PROTOCOL", message));
}

function logWsRequestEvent(entry, stage, extra = {}) {
    const payload = {
        id: entry?.id,
        name: entry?.name,
        queueDepth: wsRequestQueue.length,
        activeRequestId: activeWsRequest?.id || null,
        sessions: userSessions.size,
        ...extra
    };
    console.log(`[ws-dispatch:${stage}]`, payload);
}

function detachWsRequestResponse(entry) {
    if (entry?.response && typeof entry._responseCloseHandler === "function") {
        entry.response.off("close", entry._responseCloseHandler);
        entry._responseCloseHandler = null;
    }
}

function settleWsRequest(entry, {error = null, value = undefined} = {}) {
    if (!entry || entry.settled) return;
    entry.settled = true;
    if (entry.timeoutHandle) {
        clearTimeout(entry.timeoutHandle);
        entry.timeoutHandle = null;
    }
    detachWsRequestResponse(entry);
    if (activeWsRequest === entry) {
        activeWsRequest = null;
    } else {
        const queuedIndex = wsRequestQueue.indexOf(entry);
        if (queuedIndex !== -1) {
            wsRequestQueue.splice(queuedIndex, 1);
        }
    }
    try {
        if (error) {
            entry.onError?.(error, entry);
            entry.reject?.(error);
            logWsRequestEvent(entry, "error", {code: error.code || null, message: error.message});
        } else {
            entry.onSuccess?.(value, entry);
            entry.resolve?.(value);
            logWsRequestEvent(entry, "complete");
        }
    } finally {
        try {
            entry.onSettled?.(entry);
        } finally {
            pumpWsRequestQueue();
        }
    }
}

function failWsRequest(entry, error) {
    settleWsRequest(entry, {error});
}

function completeWsRequest(entry, value) {
    if (entry?.awaitRelayDone && entry.relayProtocolActive && !entry.relayDoneSeen) {
        entry.relayCompletionValue = value;
        entry.relayPayloadCompleted = true;
        return;
    }
    settleWsRequest(entry, {value});
}

function cancelWsRequest(entry, message = "Request closed") {
    failWsRequest(entry, createWsError("WS_REQUEST_CANCELED", message));
}

function flushQueuedWsRequests(error) {
    const pending = [];
    if (activeWsRequest) pending.push(activeWsRequest);
    activeWsRequest = null;
    if (wsRequestQueue.length) {
        pending.push(...wsRequestQueue.splice(0, wsRequestQueue.length));
    }
    pending.forEach(entry => {
        if (!entry.settled) {
            settleWsRequest(entry, {error});
        }
    });
}

function isBinaryWsPayload(payload) {
    return Buffer.isBuffer(payload) || payload instanceof ArrayBuffer || ArrayBuffer.isView(payload);
}

function sendWsPayload(payload, callback = null) {
    const options = isBinaryWsPayload(payload)
        ? {binary: true, compress: false, fin: true}
        : undefined;
    if (options) {
        wsClient.send(payload, options, callback || undefined);
        return;
    }
    wsClient.send(payload, callback || undefined);
}

function sendQueuedWsPayload(entry, payload) {
    sendWsPayload(payload, err => {
        if (err) {
            failWsRequest(entry, err);
        }
    });
}

function startWsRequest(entry) {
    if (entry.settled) {
        pumpWsRequestQueue();
        return;
    }
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
        failWsRequest(entry, createWsError("WS_NOT_CONNECTED", "WebSocket not connected"));
        return;
    }
    activeWsRequest = entry;
    entry.timeoutHandle = setTimeout(() => {
        failWsRequest(entry, createWsError("WS_TIMEOUT", entry.timeoutMessage || "Timeout waiting for WebSocket response"));
    }, entry.timeoutMs);
    logWsRequestEvent(entry, "start");
    try {
        entry.start(entry);
    } catch (err) {
        failWsRequest(entry, err);
    }
}

function pumpWsRequestQueue() {
    if (activeWsRequest || !wsClient || wsClient.readyState !== WebSocket.OPEN) return;
    while (wsRequestQueue.length) {
        const next = wsRequestQueue.shift();
        if (!next || next.settled) continue;
        startWsRequest(next);
        return;
    }
}

function enqueueWsRequest({
    name = "request",
    timeoutMs = TIMEOUT,
    timeoutMessage = "Timeout waiting for WebSocket response",
    response = null,
    start,
    onMessage,
    onError,
    onSuccess,
    onRelayDone,
    onSettled
} = {}) {
    return new Promise((resolve, reject) => {
        const entry = {
            id: `ws-${++wsRequestSequence}`,
            name,
            timeoutMs,
            timeoutMessage,
            response,
            start,
            onMessage,
            onError,
            onSuccess,
            onRelayDone,
            onSettled,
            resolve,
            reject,
            settled: false,
            timeoutHandle: null,
            createdAt: Date.now(),
            awaitRelayDone: isRelayMode,
            relayProtocolActive: false,
            relayRequestId: null,
            relayBinaryActive: false,
            relayBinaryStarted: false,
            relayBinaryRemaining: 0,
            relayTextChunks: [],
            relayPayloadCompleted: false,
            relayCompletionValue: undefined,
            relayDoneSeen: false
        };
        if (response) {
            entry._responseCloseHandler = () => cancelWsRequest(entry);
            response.on("close", entry._responseCloseHandler);
        }
        wsRequestQueue.push(entry);
        logWsRequestEvent(entry, "queued");
        pumpWsRequestQueue();
    });
}

function dispatchWsMessage(data, isBinary = false) {
    if (handleInboundPushCommand(data, isBinary)) return;
    if (!activeWsRequest || typeof activeWsRequest.onMessage !== "function") {
        console.warn("[ws-dispatch:unhandled-message]", {
            activeRequestId: activeWsRequest?.id || null,
            isBinary: !!isBinary,
            size: isBinary ? Buffer.from(data).length : String(data ?? "").length
        });
        return;
    }
    if (isRelayMode) {
        if (isBinary) {
            if (!activeWsRequest.relayProtocolActive) {
                try {
                    activeWsRequest.onMessage(data, true, activeWsRequest);
                } catch (err) {
                    failWsRequest(activeWsRequest, err);
                }
                return;
            }
            if (!activeWsRequest.relayBinaryActive) {
                relayProtocolError(activeWsRequest, "Unexpected relay binary frame");
                return;
            }
            const chunk = Buffer.from(data);
            if (chunk.length > activeWsRequest.relayBinaryRemaining) {
                relayProtocolError(activeWsRequest, "Relay binary byte count mismatch");
                return;
            }
            activeWsRequest.relayBinaryRemaining -= chunk.length;
            try {
                activeWsRequest.onMessage(chunk, true, activeWsRequest);
            } catch (err) {
                failWsRequest(activeWsRequest, err);
            }
            return;
        }

        const relayControl = parseRelayControlPayload(data, false);
        if (relayControl) {
            activeWsRequest.relayProtocolActive = true;
            const requestId = relayControl.request_id;
            if (!bindRelayRequestId(activeWsRequest, requestId)) {
                relayProtocolError(activeWsRequest, "Relay response request id mismatch");
                return;
            }

            if (relayControl.kind === "exec.text") {
                activeWsRequest.relayTextChunks.push(Buffer.from(String(relayControl.text ?? ""), "utf8"));
                return;
            }

            if (relayControl.kind === "exec.error") {
                failWsRequest(activeWsRequest, createWsError("WS_RELAY_ERROR", String(relayControl.error || "Relay execution failed")));
                return;
            }

            if (relayControl.kind === "exec.binary.start") {
                const byteCount = Number(relayControl.bytes);
                if (!Number.isSafeInteger(byteCount) || byteCount < 0) {
                    relayProtocolError(activeWsRequest, "Invalid relay binary byte count");
                    return;
                }
                activeWsRequest.relayBinaryStarted = true;
                activeWsRequest.relayBinaryActive = true;
                activeWsRequest.relayBinaryRemaining = byteCount;
                return;
            }

            if (relayControl.kind === "exec.done") {
                const completedRequest = activeWsRequest;
                if (completedRequest.relayBinaryActive && completedRequest.relayBinaryRemaining !== 0) {
                    relayProtocolError(completedRequest, "Relay binary response ended before all bytes arrived");
                    return;
                }
                completedRequest.relayBinaryActive = false;
                completedRequest.relayBinaryRemaining = 0;
                completedRequest.relayDoneSeen = true;
                if (!completedRequest.relayBinaryStarted && completedRequest.relayTextChunks.length) {
                    try {
                        completedRequest.onMessage(Buffer.concat(completedRequest.relayTextChunks), false, completedRequest);
                    } catch (err) {
                        failWsRequest(completedRequest, err);
                    }
                    if (completedRequest.settled) {
                        return;
                    }
                }
                try {
                    completedRequest.onRelayDone?.(completedRequest);
                } catch (err) {
                    failWsRequest(completedRequest, err);
                    return;
                }
                completeWsRequest(completedRequest, completedRequest.relayCompletionValue);
                return;
            }

            relayProtocolError(activeWsRequest, `Unsupported relay control kind: ${relayControl.kind}`);
            return;
        }
    }
    try {
        activeWsRequest.onMessage(data, isBinary, activeWsRequest);
    } catch (err) {
        failWsRequest(activeWsRequest, err);
    }
}

function sendWsMessage(message, {relayContext, allowMissingRelayContext = false, name = "send"} = {}) {
    let preparedMessage = message;
    try {
        preparedMessage = buildRelayCommand(message, relayContext, {allowMissingContext: allowMissingRelayContext});
    } catch (err) {
        return Promise.reject(err);
    }
    return enqueueWsRequest({
        name,
        timeoutMessage: "Timeout waiting for WebSocket response",
        start: entry => sendQueuedWsPayload(entry, preparedMessage),
        onMessage: (data, _isBinary, entry) => completeWsRequest(entry, data)
    });
}

async function refreshUsersFromSocket(req = null) {
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN) return [];
    const relayContext = resolveRelayContext(req);
    if (isRelayMode && !relayContext) return [];
    try {
        const response = await sendWsMessage("[user]", {relayContext, allowMissingRelayContext: false, name: "login-refresh-users"});
        const users = extractUsers(response);
        const nextUsernames = new Map();
        const nextUserFolders = new Map();
        await ensureUserDataRoot();
        await Promise.all(users.map(async ({userId, username, userFolder}) => {
            if (username) nextUsernames.set(username, userId);
            nextUsernames.set(userId, userId);
            nextUserFolders.set(userId, userFolder);
            await ensureUserDir(userFolder);
        }));
        knownUsernames.clear();
        knownUserFolders.clear();
        for (const [username, userId] of nextUsernames.entries()) knownUsernames.set(username, userId);
        for (const [userId, userFolder] of nextUserFolders.entries()) knownUserFolders.set(userId, userFolder);
        return users;
    } catch (err) {
        console.error("Failed to refresh users from Standard System:", err.message);
    }
    return [];
}

function quoteCliPath(filePath) {
    return `"${String(filePath || "").replace(/\\/g, "/").trim().replace(/"/g, '\\"')}"`;
}

function buildFilesCliCommand(action, ...filePaths) {
    const normalizedAction = String(action || "").trim();
    const normalizedPaths = filePaths
        .map(filePath => quoteCliPath(filePath))
        .join(" ");
    return normalizedPaths ? `files ${normalizedAction} ${normalizedPaths}` : `files ${normalizedAction}`;
}

function buildBinaryCommandPayload(commandName, filePath, fileBuffer, relayContext = null) {
    const normalizedFilePath = String(filePath || "").replace(/\\/g, "/").trim();
    const binaryBuffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer || []);
    let commandHeader = `${commandName} ${quoteCliPath(normalizedFilePath)} ${binaryBuffer.length}`;
    if (relayContext) {
        commandHeader = buildRelayCommand(commandHeader, relayContext);
    }
    return Buffer.concat([
        Buffer.from(`${commandHeader}\n`, "utf8"),
        binaryBuffer
    ]);
}

function decodeBase64Payload(value = "") {
    const normalized = String(value || "").trim().replace(/\s+/g, "");
    if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/=]+$/.test(normalized)) return null;
    try {
        return Buffer.from(normalized, "base64");
    } catch (_) {
        return null;
    }
}

function unwrapRelayTextPayload(value = "") {
    const raw = String(value ?? "");
    if (!isRelayMode) return raw;
    if (!/^\s*relay\b/i.test(raw)) return raw;
    return raw.replace(/^\s*relay\s*~\s*[^~\r\n]+(?:\s*~\s*[^~\r\n]+)?\s*~\s*/i, "");
}

function normalizeTextWebSocketPayload(value = "") {
    const raw = unwrapRelayTextPayload(value);
    const dataUrlMatch = /^data:([^;,]+)?;base64,([\s\S]+)$/i.exec(raw.trim());
    if (dataUrlMatch) {
        const decoded = decodeBase64Payload(dataUrlMatch[2]);
        if (decoded) {
            return {
                buffer: decoded,
                contentType: dataUrlMatch[1] || "application/octet-stream"
            };
        }
    }
    const prefixedBase64Match = /^(?:base64|b64):([\s\S]+)$/i.exec(raw.trim());
    if (prefixedBase64Match) {
        const decoded = decodeBase64Payload(prefixedBase64Match[1]);
        if (decoded) {
            return {
                buffer: decoded,
                contentType: "application/octet-stream"
            };
        }
    }
    const decoded = decodeBase64Payload(raw);
    if (decoded && decoded.length > 0) {
        return {
            buffer: decoded,
            contentType: "application/octet-stream"
        };
    }
    return {
        buffer: Buffer.from(raw),
        contentType: "application/octet-stream"
    };
}

function createTempPayloadSink(defaultContentType = "application/octet-stream") {
    const tempDir = path.join(os.tmpdir(), "public-ui", "ws-downloads");
    fsSync.mkdirSync(tempDir, {recursive: true});
    const tempPath = path.join(tempDir, `${Date.now()}-${crypto.randomUUID()}.bin`);
    const fd = fsSync.openSync(tempPath, "w");
    let bytesWritten = 0;
    let detectedContentType = defaultContentType;
    let pendingText = "";
    let closed = false;
    const closeHandle = () => {
        if (closed) return;
        closed = true;
        fsSync.closeSync(fd);
    };
    const appendBuffer = (buffer) => {
        if (!buffer?.length) return;
        fsSync.writeSync(fd, buffer, 0, buffer.length, bytesWritten);
        bytesWritten += buffer.length;
    };
    const flushText = () => {
        if (!pendingText) return;
        const normalizedTextPayload = normalizeTextWebSocketPayload(pendingText);
        pendingText = "";
        if (normalizedTextPayload?.buffer?.length) {
            if (normalizedTextPayload.contentType && detectedContentType === defaultContentType) {
                detectedContentType = normalizedTextPayload.contentType;
            }
            appendBuffer(normalizedTextPayload.buffer);
        }
    };
    return {
        add(chunk, isBinary = true) {
            if (isBinary) {
                flushText();
                appendBuffer(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                return;
            }
            pendingText += unwrapRelayTextPayload(chunk?.toString?.() ?? chunk ?? "");
        },
        hasData() {
            return bytesWritten > 0 || pendingText.length > 0;
        },
        getContentType() {
            return detectedContentType || defaultContentType;
        },
        getByteLength() {
            return bytesWritten;
        },
        finalize() {
            flushText();
            closeHandle();
            return {
                tempPath,
                contentType: detectedContentType || defaultContentType,
                byteLength: bytesWritten
            };
        },
        cleanup() {
            try {
                closeHandle();
            } catch (_) {
            }
            try {
                if (fsSync.existsSync(tempPath)) {
                    fsSync.unlinkSync(tempPath);
                }
            } catch (_) {
            }
        }
    };
}

function splitWebSocketStatusMessage(value = "") {
    const raw = unwrapRelayTextPayload(value);
    const normalized = raw.replace(/\r\n/g, "\n");
    const match = /^(0x[0-9a-f]+)(?:\n([\s\S]*))?$/i.exec(normalized);
    if (!match) {
        return {status: null, remainder: raw};
    }
    return {
        status: match[1],
        remainder: match[2] || ""
    };
}

function uploadSingleFile(req, res, next) {
    upload.single("file")(req, res, err => {
        if (!err) {
            next();
            return;
        }
        if (err.code === "LIMIT_FILE_SIZE") {
            res.status(413).json({
                error: `File exceeds the ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024 * 1024))}GB upload limit`
            });
            return;
        }
        next(err);
    });
}

function normalizeUploadDirectoryPath(rawDirectory = "") {
    return String(rawDirectory || "")
        .trim()
        .replace(/\\/g, "/")
        .replace(/\/+$/, "")
        .replace(/^\/home\/standard-system\//, "")
        .replace(/^home\/standard-system\//, "")
        .replace(/^\/+/, "");
}

function getFileExtension(fileName = "") {
    const baseName = path.basename(String(fileName || ""));
    return baseName.includes(".") ? baseName.split(".").pop().toLowerCase() : "";
}

function inferUploadFolderForFile(file = {}) {
    const mimeType = String(file.mimetype || "").toLowerCase();
    for (const [prefix, folder] of Object.entries(AUTO_UPLOAD_FOLDERS_BY_MIME_PREFIX)) {
        if (mimeType.startsWith(prefix)) return folder;
    }
    const extension = getFileExtension(file.originalname);
    return Object.entries(AUTO_UPLOAD_FOLDERS_BY_EXTENSION).find(([, extensions]) => extensions.has(extension))?.[0] || "";
}

function resolveUploadDirectoryForFile(file = {}, rawDirectory = "") {
    return inferUploadFolderForFile(file) || normalizeUploadDirectoryPath(rawDirectory);
}

function requireLogin(req, res, next) {
    const publicPaths = ["/login", "/bad-connection", "/api/login", "/api/status", "/api/device/status", "/api/keys/push"];
    if (isDesktopSetupEnabled) {
        publicPaths.push("/setup");
    }
    if (isRelayMode && !isRelayConnectionExemptPath(req) && !hasRequiredRelayCookies(req)) {
        return res.redirect("/bad-connection");
    }
    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }
    if (isRelayMode && req.method === "GET" && req.path === "/") {
        return next();
    }
    if (req.session && req.session.userId) {
        res.locals.userId = req.session.userId;
        return next();
    }
    return res.redirect("/login");
}

function broadcastStatus(status) {
    const payload = `data: ${JSON.stringify({status, timestamp: Date.now()})}\n\n`;
    for (const res of statusSubscribers) {
        res.write(payload);
    }
}

function parseInboundPushCommand(data, isBinary = false) {
    if (isBinary) return null;
    const raw = String(data ?? "").trim();
    if (!raw) return null;
    let targetSerial = null;
    let commandText = raw;
    if (isRelayMode) {
        const relayMatch = raw.match(/^@([^\s]+)\s+(.+)$/);
        if (!relayMatch) return null;
        targetSerial = relayMatch[1].trim();
        commandText = relayMatch[2].trim();
        if (!targetSerial || !commandText) return null;
    }
    const notificationCommand = parseInboundNotificationCommand(commandText, targetSerial);
    if (notificationCommand) return notificationCommand;
    const startMatch = commandText.match(/^start\s+([a-z0-9][a-z0-9_.-]*)(?:\s*)$/i);
    if (!startMatch) return null;
    const serviceId = startMatch[1].trim();
    if (!/^com\.standard\.[a-z0-9_.-]+$/i.test(serviceId)) return null;
    return {
        command: "start",
        serviceId,
        targetSerial,
        receivedAt: Date.now()
    };
}

function parseInboundNotificationCommand(commandText = "", targetSerial = null) {
    const normalizedText = String(commandText || "").trim().replace(/^start\s+/i, "");
    const segments = normalizedText.split("|").map(segment => segment.trim());
    if (segments.length < 2) return null;
    const serviceId = segments[0].toLowerCase();
    if (serviceId !== "com.standard.notifications" && serviceId !== "com.standard.noticiations") return null;
    const notificationType = segments[1].toLowerCase();
    if (!/^[a-z0-9_.-]+$/i.test(notificationType)) return null;
    return {
        command: "notify",
        serviceId: "com.standard.notifications",
        notificationType,
        notificationData: segments.slice(2),
        targetSerial,
        receivedAt: Date.now()
    };
}

function broadcastPushCommand(pushCommand) {
    if (!pushCommand) return false;
    const payloadBody = {
        command: pushCommand.command,
        serviceId: pushCommand.serviceId,
        timestamp: pushCommand.receivedAt || Date.now()
    };
    if (pushCommand.command === "notify") {
        payloadBody.notificationType = pushCommand.notificationType;
        payloadBody.notificationData = pushCommand.notificationData || [];
    }
    const payload = `data: ${JSON.stringify(payloadBody)}\n\n`;
    let delivered = false;
    for (const subscriber of pushSubscribers) {
        if (isRelayMode) {
            const subscriberSerial = subscriber?.relayContext?.deviceSerial;
            if (!subscriberSerial || subscriberSerial !== pushCommand.targetSerial) continue;
        }
        subscriber.res.write(payload);
        delivered = true;
    }
    return delivered;
}

function handleInboundPushCommand(data, isBinary = false) {
    const pushCommand = parseInboundPushCommand(data, isBinary);
    if (!pushCommand) return false;
    const delivered = broadcastPushCommand(pushCommand);
    console.log("[ws-push-command]", {
        command: pushCommand.command,
        serviceId: pushCommand.serviceId,
        notificationType: pushCommand.notificationType || null,
        targetSerial: pushCommand.targetSerial || null,
        delivered
    });
    return true;
}

function updateConnectionStatus(nextStatus) {
    if (connectionStatus === nextStatus) return;
    connectionStatus = nextStatus;
    broadcastStatus(connectionStatus);
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectToStdSystem();
    }, RECONNECT_INTERVAL);
}
function clearWsConnectTimer() {
    if (!wsConnectTimer) return;
    clearTimeout(wsConnectTimer);
    wsConnectTimer = null;
}

function connectToStdSystem() {
    const targetWsUrl = getRuntimeWsUrl();
    const targetStandardChit = getRuntimeStandardChit();
    console.log(`attempting connection to ${targetWsUrl} (mode=${MODE || "default"})`);
    if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) return;
    updateConnectionStatus("connecting");
    const wsOptions = {
        handshakeTimeout: WS_CONNECT_TIMEOUT
    };
    if (targetStandardChit) {
        wsOptions.headers = {
            "X-Standard-Chit": targetStandardChit
        };
    } else {
        console.warn("STANDARD_CHIT is not set; opening WebSocket without X-Standard-Chit header");
    }
    const client = new WebSocket(targetWsUrl, wsOptions);
    wsClient = client;
    clearWsConnectTimer();
    wsConnectTimer = setTimeout(() => {
        if (wsClient !== client || client.readyState !== WebSocket.CONNECTING) return;
        console.error(`WebSocket connection timed out after ${WS_CONNECT_TIMEOUT}ms: ${targetWsUrl}`);
        try {
            client.terminate();
        } catch (err) {
        }
        if (wsClient === client) {
            wsClient = undefined;
        }
        updateConnectionStatus("disconnected");
        scheduleReconnect();
    }, WS_CONNECT_TIMEOUT);
    client.on("open", async () => {
        clearWsConnectTimer();
        console.log(`Connected to Standard System at ${targetWsUrl}`);
        updateConnectionStatus("connected");
        pumpWsRequestQueue();
        await refreshUsersFromSocket();
    });
    client.on("message", (data, isBinary) => {
        dispatchWsMessage(data, isBinary);
    });
    client.on("error", err => {
        clearWsConnectTimer();
        if (wsClient === client) {
            wsClient = undefined;
        }
        flushQueuedWsRequests(createWsError("WS_NOT_CONNECTED", "WebSocket disconnected"));
        console.error("WebSocket client error:", err);
        updateConnectionStatus("disconnected");
        scheduleReconnect();
    });
    client.on("unexpected-response", (request, response) => {
        clearWsConnectTimer();
        const chunks = [];
        response.on("data", chunk => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8").trim();
            console.error(`WebSocket handshake rejected (${response.statusCode} ${response.statusMessage || ""})${body ? `: ${body}` : ""}`);
        });
    });
    client.on("close", (code, reasonBuffer) => {
        clearWsConnectTimer();
        if (wsClient === client) {
            wsClient = undefined;
        }
        flushQueuedWsRequests(createWsError("WS_NOT_CONNECTED", "WebSocket disconnected"));
        const reason = Buffer.isBuffer(reasonBuffer) ? reasonBuffer.toString("utf8") : `${reasonBuffer || ""}`;
        console.log(`WebSocket connection closed (code=${code}${reason ? `, reason=${reason}` : ""})`);
        updateConnectionStatus("disconnected");
        scheduleReconnect();
    });
}

function restartStdSystemConnection() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    clearWsConnectTimer();
    if (wsClient) {
        const client = wsClient;
        wsClient = undefined;
        try {
            client.terminate();
        } catch (_) {
        }
    }
    connectToStdSystem();
}

function ensureWsOpen(res) {
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
        res.status(503).send("WebSocket not connected");
        return false;
    }
    return true;
}

function withWsResponse(res, sendFn, onMessage, {timeoutMessage = "Timeout waiting for response", onSettled = null, requestName = "http-response"} = {}) {
    if (!ensureWsOpen(res)) return;
    enqueueWsRequest({
        name: requestName,
        response: res,
        timeoutMessage,
        start: entry => {
            const result = sendFn(entry);
            if (result === false && !res.headersSent) {
                throw createWsError("WS_REQUEST_ABORTED", "Failed to send command");
            }
        },
        onMessage: (data, isBinary, entry) => {
            if (!res.headersSent) onMessage(data, isBinary, entry);
            completeWsRequest(entry);
        },
        onError: err => {
            if (res.headersSent || err.code === "WS_REQUEST_CANCELED") return;
            if (err.code === "WS_TIMEOUT") {
                res.status(504).send(timeoutMessage);
                return;
            }
            if (err.code === "WS_NOT_CONNECTED") {
                res.status(503).send("WebSocket not connected");
                return;
            }
            res.status(400).send(err.message || "Failed to send command");
        },
        onSettled: () => {
            if (typeof onSettled === "function") onSettled();
        }
    }).catch(() => null);
}

function withRelayBinaryUploadResponse(res, payload, {onSettled = null, requestName = "relay-binary-upload"} = {}) {
    if (!ensureWsOpen(res)) return;
    let fallbackHandle = null;
    const clearFallback = () => {
        if (!fallbackHandle) return;
        clearTimeout(fallbackHandle);
        fallbackHandle = null;
    };
    enqueueWsRequest({
        name: requestName,
        response: res,
        timeoutMessage: "Timeout waiting for upload confirmation",
        start: entry => {
            sendWsPayload(payload, err => {
                if (err) {
                    clearFallback();
                    failWsRequest(entry, err);
                    return;
                }
                fallbackHandle = setTimeout(() => {
                    fallbackHandle = null;
                    if (!res.headersSent) {
                        res.send("Upload queued");
                    }
                    completeWsRequest(entry);
                }, WS_BINARY_SETTLE_MS);
            });
        },
        onMessage: (data, _isBinary, entry) => {
            clearFallback();
            if (!res.headersSent) {
                res.send(data.toString());
            }
            completeWsRequest(entry);
        },
        onError: err => {
            clearFallback();
            if (res.headersSent || err.code === "WS_REQUEST_CANCELED") return;
            if (err.code === "WS_NOT_CONNECTED") {
                res.status(503).send("WebSocket not connected");
                return;
            }
            res.status(500).send(err.message || "Upload failed");
        },
        onSettled: () => {
            clearFallback();
            if (typeof onSettled === "function") onSettled();
        }
    }).catch(() => null);
}

app.use(cookieParser());
app.engine("handlebars", exphbs.engine({defaultLayout: "index"}));
app.set("view engine", "handlebars");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", 1);
app.use(cors(corsOptions));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({extended: true, limit: REQUEST_BODY_LIMIT}));
app.use(express.json({limit: REQUEST_BODY_LIMIT}));
app.use(sessionMiddleware);
app.use((err, req, res, next) => {
    if (err?.message === "Not allowed by CORS") {
        return res.status(403).json({error: "CORS origin not allowed"});
    }
    next(err);
});

ensureUserDataRoot().catch(err => console.error("Failed to prepare user data root:", err));
const sessionPruneInterval = setInterval(pruneExpiredSessions, SESSION_PRUNE_INTERVAL_MS);
sessionPruneInterval.unref?.();

function advertiseLocalHostname() {
    if (!shouldAdvertiseLocalHostname) return;
    try {
        const listeningPort = getListeningPort();
        const protocol = getServerProtocol();
        if (!(listeningPort > 0)) return;
        bonjour = new Bonjour();
        bonjourService = bonjour.publish({
            name: LOCAL_HOSTNAME,
            host: `${LOCAL_HOSTNAME}.local`,
            type: "http",
            port: listeningPort
        });
        console.log(`mDNS advertisement enabled: ${protocol}://${LOCAL_HOSTNAME}.local:${listeningPort}`);
    } catch (err) {
        console.error("Failed to publish mDNS service:", err.message);
    }
}

function stopLocalHostnameAdvertisement() {
    if (bonjourService) bonjourService.stop(() => {});
    if (bonjour) bonjour.destroy();
}

app.get("/login", (req, res) => {
    if (isDesktopSetupEnabled && !hasCompletedDesktopSetup(req)) {
        return res.redirect("/setup");
    }
    if (isRelayMode) {
        return res.redirect("/");
    }
    if (req.session && req.session.userId) {
        return res.redirect("/");
    }
    res.render("login", {error: req.query?.error || null});
});

function wantsLoginJson(req) {
    const accept = String(req.get("accept") || "").toLowerCase();
    const requestedWith = String(req.get("x-requested-with") || "").toLowerCase();
    return requestedWith === "xmlhttprequest" || accept.includes("application/json");
}

function redirectLoginError(req, res, message = "Unable to login", status = 303) {
    if (wantsLoginJson(req)) {
        const responseStatus = status >= 400 && status < 600 ? status : 400;
        return res.status(responseStatus).json({error: message});
    }
    return res.redirect(status, `/login?error=${encodeURIComponent(message)}`);
}

app.post("/login", async (req, res) => {
    if (isDesktopSetupEnabled && !hasCompletedDesktopSetup(req)) {
        if (wantsLoginJson(req)) return res.json({redirect: "/setup"});
        return res.redirect("/setup");
    }
    const username = sanitizeUsername(req.body.username || "");
    if (!username) {
        return redirectLoginError(req, res, "Username is required", 400);
    }
    const refreshedUsers = await refreshUsersFromSocket(req);
    const matchedUser = resolveUserFromUsers(username, refreshedUsers);
    let userId = sanitizeUserId(matchedUser?.userId || "") || resolveKnownUserId(username);
    if (!knownUsernames.size && !refreshedUsers.length) {
        return redirectLoginError(req, res, "Unable to verify users right now", 503);
    }
    if ((knownUsernames.size || refreshedUsers.length) && !userId) {
        return redirectLoginError(req, res, "Unknown user", 401);
    }
    const refreshedUser = matchedUser || refreshedUsers.find(user => sanitizeUserId(user.userId) === userId);
    const userFolder = knownUserFolders.get(userId) || refreshedUser?.userFolder || userId;
    try {
        await ensureUserDir(userFolder);
        req.session = setSession(res, userId, userFolder);
        res.cookie("uid", userId, {sameSite: "lax", path: "/", maxAge: 1000 * 60 * 60 * 24 * 30});
        res.cookie("loginUsername", username, {sameSite: "lax", path: "/", maxAge: 1000 * 60 * 60 * 24 * 30});
        try {
            const userRecord = await fetchUserRecordById(userId);
            setCachedUserRecord(req.session, userRecord);
            writeUserDataCookie(res, userRecord);
        } catch (err) {
            console.error("Login user record lookup failed:", err.message);
            writeUserDataCookie(res, null);
        }
        if (wantsLoginJson(req)) return res.json({redirect: "/"});
        return res.redirect("/");
    } catch (err) {
        console.error("Login failed while starting session:", err.message);
        return redirectLoginError(req, res, "Failed to start session", 500);
    }
});

app.get("/logout", (req, res) => {
    clearSession(res, req.sessionToken, req);
    res.cookie("uid", "", {maxAge: 0, sameSite: "lax", path: "/"});
    writeUserDataCookie(res, null);
    clearRelayCookies(req, res);
    clearRelaySettingsCookie(req, res, "interface-windows");
    if (isRelayMode) {
        return res.redirect("https://standardcomputers.net/dashboard");
    }
    return res.redirect("/login");
});

app.get("/bad-connection", (req, res) => res.status(503).render("bad-connection", {layout: "index"}));

app.post("/api/login", async (req, res) => {
    if (!isRelayMode) {
        console.log("Relay mode is required but was triggered");
        return res.status(400).json({error: "Relay mode is not enabled"});
    }
    const deviceSerial = req.body?.d?.device_uid;
    const userId = sanitizeUserId(req.body?.d?.owner_id);
    console.log(userId)
    if (!deviceSerial || !userId) {
        console.log("Not providing proper information")
        return res.status(401).json({error: "device_uid and user_id are required"});
    }
    try {
        const command = `relay ~ ${deviceSerial} ~ relay chit ${userId}`;
        const response = await sendWsMessage(command, {
            relayContext: null,
            allowMissingRelayContext: true
        });
        const token = response.toString().trim();
        if (!token || isRelayFailureResponse(token)) {
            return res.status(502).json({error: "Failed to obtain relay token"});
        }
        const relayContext = {deviceSerial, chit: token};
        if (req.sessionToken) {
            clearSession(res, req.sessionToken, req);
        }
        clearRelaySettingsCookie(req, res, "interface-windows");
        req.session = setSession(res, userId, userId);
        res.cookie("uid", userId, {sameSite: "lax", path: "/", maxAge: 1000 * 60 * 60 * 24 * 30});
        attachRelayContextToSession(req, relayContext);
        writeRelayCookies(req, res, relayContext);
        try {
            const userRecord = await fetchUserRecordById(userId, {relayContext, allowMissingRelayContext: false});
            setCachedUserRecord(req.session, userRecord);
            writeUserDataCookie(res, userRecord);
        } catch (err) {
            console.error("Relay login user record lookup failed:", err.message);
            writeUserDataCookie(res, null);
        }
        return res.json({token, userId});
    } catch (err) {
        console.error("Relay login failed:", err.message);
        return res.status(502).json({error: "Relay login failed"});
    }
});

app.post("/api/keys/push", async (req, res) => {
    if (!isRelayMode) return res.status(400).json({error: "Relay mode is not enabled"});
    const deviceSerial = req.body?.deviceUid;
    if (!deviceSerial) return res.status(401).json({error: "deviceUid is are required"});
    try {
        const command = `relay chit ${deviceSerial}`;
        const response = await sendWsMessage(command, { relayContext: null, allowMissingRelayContext: true });
        const token = response.toString().trim();
        if (!token || isRelayFailureResponse(token)) return res.status(502).json({error: "Failed to obtain relay token"});
        return res.json({token});
    } catch (err) {
        console.error("Relay login failed:", err.message);
        return res.status(502).json({error: "Relay login failed"});
    }
});

app.use((req, res, next) => {
    if (!isDesktopSetupEnabled || hasCompletedDesktopSetup(req)) {
        return next();
    }
    if (req.path.startsWith("/setup")) {
        return next();
    }
    return res.redirect("/setup");
});

app.use(requireLogin);

function relayGuard(req, res, next) {
    if (!isRelayMode) {
        return next();
    }
    if (isRelayConnectionExemptPath(req)) {
        return next();
    }
    const relayContext = resolveRelayContext(req);
    if (!relayContext) {
        return res.redirect("/bad-connection");
    }
    attachRelayContextToSession(req, relayContext);
    req.relayContext = relayContext;
    return next();
}

app.use(relayGuard);

app.get("/", async (req, res) => {
    try {
        await refreshUserCookieForRequest(req, res);
    } catch (err) {
        console.error("Failed to refresh user cookie for home:", err.message);
    }
    return res.render("home", {
        mapboxAccessTokenJson: JSON.stringify(getRuntimeMapboxAccessToken())
    });
});

app.get("/setup", (req, res) => {
    if (!isDesktopSetupEnabled) {
        return res.status(404).send("Not found");
    }
    if (hasCompletedDesktopSetup(req)) {
        return res.redirect("/");
    }
    res.render("setup", {
        endpoint: getRuntimeWsUrl(),
        deviceKey: getRuntimeStandardChit(),
        mapboxKey: getRuntimeMapboxAccessToken()
    });
});

app.post("/setup", async (req, res) => {
    if (!isDesktopSetupEnabled) {
        return res.status(404).send("Not found");
    }
    try {
        await saveDesktopSetupConfig({
            endpoint: req.body?.endpoint,
            deviceKey: req.body?.["device-key"],
            mapboxKey: req.body?.["mapbox-key"]
        });
        restartStdSystemConnection();
    } catch (err) {
        console.error("Failed to save desktop setup config:", err.message);
        return res.status(500).render("setup", {
            endpoint: typeof req.body?.endpoint === "string" ? req.body.endpoint.trim() : "",
            deviceKey: typeof req.body?.["device-key"] === "string" ? req.body["device-key"].trim() : "",
            mapboxKey: typeof req.body?.["mapbox-key"] === "string" ? req.body["mapbox-key"].trim() : "",
            error: "Failed to save setup values"
        });
    }
    setDesktopSetupCookie(res, req);
    if (req.session && req.session.userId) {
        return res.redirect("/");
    }
    return res.redirect("/login");
});

app.get("/api/device/status", (req, res) => {
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
        return res.sendStatus(404);
    } else {
        return res.sendStatus(200);
    }
})

app.get("/api/client-context", (req, res) => {
    return res.json({isRelayMode});
});

app.get("/events/device-status", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) res.flushHeaders();
    statusSubscribers.add(res);
    res.write(`data: ${JSON.stringify({status: connectionStatus, timestamp: Date.now()})}\n\n`);
    req.on("close", () => {
        statusSubscribers.delete(res);
    });
});

app.get("/events/push", (req, res) => {
    const relayContext = isRelayMode ? (req.relayContext || resolveRelayContext(req)) : null;
    if (isRelayMode && !relayContext) {
        return res.status(403).end();
    }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) res.flushHeaders();
    const subscriber = {
        res,
        userId: req.session?.userId || null,
        relayContext
    };
    pushSubscribers.add(subscriber);
    res.write(`data: ${JSON.stringify({command: "ready", timestamp: Date.now()})}\n\n`);
    req.on("close", () => {
        pushSubscribers.delete(subscriber);
    });
});

/**
 * Checks if a device with Serial (Device ID) is connected.
 */
app.post("/api/status", (req, res) => {
    const deviceId = req.body?.d?.device_uid;
    if (!deviceId) return res.status(400).json({error: "device_uid is required"});
    withWsResponse(res, entry => sendQueuedWsPayload(entry, `relay ping ${deviceId}`), data => {
        const isConnected = data.toString().trim() === "true";
        const status = isConnected ? 200 : 404;
        res.status(status).json({connected: isConnected});
    }, {timeoutMessage: "Timeout waiting for relay response"});
});

app.get("/api/stds", (req, res) => {
    const command = prepareCommandForRequest(req, res, "stds");
    if (!command) return;
    withWsResponse(res, entry => sendQueuedWsPayload(entry, command), data => {
        res.send(data.toString());
    });
});

app.get("/api/stds/:standard", (req, res) => {
    const command = prepareCommandForRequest(req, res, `stds ${req.params.standard}`);
    if (!command) return;
    withWsResponse(res, entry => sendQueuedWsPayload(entry, command), data => {
        res.send(data.toString());
    });
});

app.get("/api/stds/:standard/json", (req, res) => {
    const command = prepareCommandForRequest(req, res, `stds ${req.params.standard} json`);
    if (!command) return;
    withWsResponse(res, entry => sendQueuedWsPayload(entry, command), data => {
        res.json(JSON.parse(data.toString()));
    });
});

app.get("/api/records/:standard", (req, res) => {
    const command = prepareCommandForRequest(req, res, `[${req.params.standard}]`);
    if (!command) return;
    withWsResponse(res, entry => sendQueuedWsPayload(entry, command), data => {
        if (data !== "NO RECORDS FOUND") {
            res.json(JSON.parse(data.toString()));
        }
    });
});

app.get("/api/tree", (req, res) => {
    const command = prepareCommandForRequest(req, res, "tree");
    if (!command) return;
    withWsResponse(res, entry => sendQueuedWsPayload(entry, command), data => {
        res.json(JSON.parse(data.toString()));
    });
});

app.get("/api/user/by-email/:useremail", (req, res) => {
    let command;
    try {
        command = prepareCommandForRequest(req, res, buildUserLookupByEmailCommand(req.params.useremail));
    } catch (_) {
        return res.status(400).json({error: "Invalid user email"});
    }
    if (!command) {
        return;
    }
    withWsResponse(res, entry => sendQueuedWsPayload(entry, command), data => {
        res.json(JSON.parse(data.toString()));
    });
});

app.get("/api/weather/current", async (req, res) => {
    if (!OPENWEATHER_API_KEY) {
        return res.status(503).json({error: "OPENWEATHER_API_KEY is not configured on the server."});
    }
    const providedLocation = `${req.query.location || ""}`.trim();
    const units = `${req.query.units || "imperial"}`.trim() || "imperial";
    const lat = Number.parseFloat(req.query.lat);
    const lon = Number.parseFloat(req.query.lon);
    let queryLat = lat;
    let queryLon = lon;
    let locationLabel = providedLocation;
    try {
        if (!Number.isFinite(queryLat) || !Number.isFinite(queryLon)) {
            const fallbackLocation = providedLocation || "Cincinnati";
            const zipMatch = fallbackLocation.match(/^(\d{5}(?:-\d{4})?)(?:\s*,\s*([A-Za-z]{2}))?$/);
            const geoUrl = new URL(zipMatch ? "https://api.openweathermap.org/geo/1.0/zip" : "https://api.openweathermap.org/geo/1.0/direct");
            if (zipMatch) {
                geoUrl.searchParams.set("zip", `${zipMatch[1].slice(0, 5)},${zipMatch[2] || "US"}`);
            } else {
                geoUrl.searchParams.set("q", fallbackLocation);
                geoUrl.searchParams.set("limit", "1");
            }
            geoUrl.searchParams.set("appid", OPENWEATHER_API_KEY);
            const geoRes = await fetch(geoUrl.toString());
            if (!geoRes.ok) {
                return res.status(geoRes.status).json({error: "Failed to geocode location."});
            }
            const geocodedPayload = await geoRes.json();
            const geocoded = Array.isArray(geocodedPayload) ? geocodedPayload[0] : geocodedPayload;
            if (!geocoded || !Number.isFinite(Number.parseFloat(geocoded.lat)) || !Number.isFinite(Number.parseFloat(geocoded.lon))) {
                return res.status(404).json({error: "Location not found."});
            }
            queryLat = geocoded.lat;
            queryLon = geocoded.lon;
            locationLabel = geocoded.name || fallbackLocation;
        }
        const weatherUrl = new URL("https://api.openweathermap.org/data/2.5/weather");
        weatherUrl.searchParams.set("lat", `${queryLat}`);
        weatherUrl.searchParams.set("lon", `${queryLon}`);
        weatherUrl.searchParams.set("units", units);
        weatherUrl.searchParams.set("appid", OPENWEATHER_API_KEY);
        const weatherRes = await fetch(weatherUrl.toString());
        if (!weatherRes.ok) {
            const upstream = await weatherRes.text();
            return res.status(weatherRes.status).json({error: "OpenWeather request failed.", detail: upstream});
        }
        const payload = await weatherRes.json();
        const selectedWeather = Array.isArray(payload.weather) ? payload.weather[0] : {};
        return res.json({
            location: {
                name: payload.name || locationLabel || "Unknown",
                country: payload.sys?.country || "",
                coordinates: {
                    lat: payload.coord?.lat,
                    lon: payload.coord?.lon
                }
            },
            current: {
                temperature: payload.main?.temp,
                feelsLike: payload.main?.feels_like,
                humidity: payload.main?.humidity,
                windSpeed: payload.wind?.speed,
                description: selectedWeather?.description,
                icon: selectedWeather?.icon
            },
            meta: {
                units,
                usedCoordinates: Number.isFinite(lat) && Number.isFinite(lon)
            }
        });
    } catch (err) {
        console.error("Weather lookup failed:", err.message);
        return res.status(500).json({error: "Unable to fetch weather right now."});
    }
});

app.get("/api/rcs/:tempID/:recordID", (req, res) => {
    const {tempID, recordID} = req.params;
    if (!tempID || !recordID) {
        return res.status(400).send("Temp ID and Record ID are required");
    }
    const command = prepareCommandForRequest(req, res, `rcs ${recordID} * @${tempID}`);
    if (!command) {
        return;
    }
    withWsResponse(res, entry => sendQueuedWsPayload(entry, command), data => {
        res.send(data.toString());
    }, {timeoutMessage: "Timeout waiting for rcs response"});
});

app.post("/api/upload/temp/:recordID", uploadSingleFile, async (req, res) => {
    const {recordID} = req.params;
    if (!recordID) return res.status(400).send("Record ID is required");
    if (!req.file) return res.status(400).send("No file uploaded");
    if (!ensureWsOpen(res)) return;
    try {
        const fileName = req.file.originalname;
        const tempPayload = buildBinaryCommandPayload("temp", fileName, req.file.buffer, resolveRelayContext(req));
        const {tempRef, tempMessages} = await new Promise((resolve, reject) => {
            const messages = [];
            let settleTimeout = null;
            const finalize = () => {
                const normalized = messages
                    .map(message => message.trim())
                    .filter(Boolean);
                const nonHexMessage = normalized.find(message => !/^0x[0-9a-f]+$/i.test(message));
                const tempRef = nonHexMessage || normalized[normalized.length - 1] || null;
                if (!tempRef) {
                    reject(new Error("No temp reference returned from upload"));
                    return;
                }
                resolve({tempRef, tempMessages: normalized});
            };
            const onMessage = (data, _isBinary, entry) => {
                messages.push(data.toString());
                if (settleTimeout) {
                    clearTimeout(settleTimeout);
                }
                settleTimeout = setTimeout(() => {
                    if (settleTimeout) {
                        clearTimeout(settleTimeout);
                        settleTimeout = null;
                    }
                    finalize();
                    completeWsRequest(entry, {tempMessages: messages.slice()});
                }, 120);
            };
            function cleanup() {
                if (settleTimeout) {
                    clearTimeout(settleTimeout);
                    settleTimeout = null;
                }
            }
            enqueueWsRequest({
                name: "temp-upload",
                response: res,
                timeoutMessage: "Timeout waiting for upload confirmation",
                start: entry => sendQueuedWsPayload(entry, tempPayload),
                onMessage,
                onError: err => {
                    cleanup();
                    reject(err.code === "WS_TIMEOUT" ? new Error("Timeout waiting for upload confirmation") : new Error("WebSocket disconnected"));
                },
                onSettled: cleanup
            }).catch(() => null);
        });
        const command = prepareCommandForRequest(req, res, `rcs ${recordID} * @${tempRef}`);
        if (!command) return;
        withWsResponse(res, entry => sendQueuedWsPayload(entry, command), data => {
            const rcsResponse = data.toString();
            res.json({tempId: tempRef, response: rcsResponse, rcsResponse, tempMessages});
        }, {timeoutMessage: "Timeout waiting for rcs response"});
    } catch (err) {
        console.error("Temp upload + record link failed:", err);
        if (!res.headersSent) {
            res.status(500).send("Temp upload + record link failed");
        }
    }
});

app.post("/api/upload/temp", uploadSingleFile, async (req, res) => {
    if (!req.file) return res.status(400).send("No file uploaded");
    try {
        const fileName = req.file.originalname;
        const tempPayload = buildBinaryCommandPayload("temp", fileName, req.file.buffer, resolveRelayContext(req));
        withWsResponse(res, entry => sendQueuedWsPayload(entry, tempPayload), data => {
            res.type("text/plain").send(data.toString());
        }, {timeoutMessage: "Timeout waiting for upload confirmation"});
    } catch (err) {
        console.error("Upload failed:", err);
        res.status(500).send("Upload failed");
    }
});

app.post("/api/upload", uploadSingleFile, async (req, res) => {
    if (!req.file) return res.status(400).send("No file uploaded");
    fileUploadQueue = fileUploadQueue
        .catch(() => null)
        .then(() => new Promise(resolve => {
            if (!ensureWsOpen(res)) {
                resolve();
                return;
            }
            try {
                const fileName = req.file.originalname;
                const rawUploadDirectory = typeof req.query.directory === "string" ? req.query.directory.trim() : "";
                const uploadDirectory = resolveUploadDirectoryForFile(req.file, rawUploadDirectory);
                const importPath = uploadDirectory ? `${uploadDirectory}/${fileName}` : fileName;
                const importPayload = buildBinaryCommandPayload("import", importPath, req.file.buffer, resolveRelayContext(req));
                if (isRelayMode) {
                    withRelayBinaryUploadResponse(res, importPayload, {
                        requestName: "relay-file-upload",
                        onSettled: resolve
                    });
                    return;
                }
                withWsResponse(res, entry => sendQueuedWsPayload(entry, importPayload), data => {
                    res.send(data.toString());
                }, {
                    timeoutMessage: "Timeout waiting for upload confirmation",
                    onSettled: resolve
                });
            } catch (err) {
                console.error("Upload failed:", err);
                if (!res.headersSent) {
                    res.status(500).send("Upload failed");
                }
                resolve();
            }
        }));
});

app.get("/api/files/download", (req, res) => {
    fileDownloadQueue = fileDownloadQueue
        .catch(() => null)
        .then(() => new Promise(resolve => {
            const filePath = req.query.path;
            console.log("[/api/files/download] request", {
                path: filePath,
                relayMode: isRelayMode
            });
            if (!filePath) {
                res.status(400).send("File path is required");
                resolve();
                return;
            }
            if (!ensureWsOpen(res)) {
                resolve();
                return;
            }
            const command = prepareCommandForRequest(req, res, buildFilesCliCommand("get", filePath));
            if (!command) {
                resolve();
                return;
            }
            const filename = path.basename(filePath) || "download.bin";
            const inlinePreview = String(req.query.inline || "") === "1";
            const isPdfPreview = inlinePreview && /\.pdf$/i.test(filename);
            let receivedStatus = false;
            let settleTimeout = null;
            let messageCount = 0;
            let finalized = false;
            let downloadEntry = null;
            let payloadFrameReceived = false;
            const payloadSink = createTempPayloadSink("application/octet-stream");
            const finalizePayload = () => {
                if (finalized) return;
                finalized = true;
                const payload = payloadSink.finalize();
                cleanup();
                console.log("[/api/files/download] finalize", {
                    path: filePath,
                    filename,
                    messageCount,
                    contentType: payload.contentType,
                    payloadBytes: payload.byteLength
                });
                res.setHeader("Content-Type", isPdfPreview ? "application/pdf" : payload.contentType);
                res.setHeader("Content-Disposition", `${isPdfPreview ? "inline" : "attachment"}; filename=\"${filename}\"`);
                res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
                res.setHeader("Content-Length", `${payload.byteLength}`);
                const cleanupTempFile = () => {
                    try {
                        fsSync.unlinkSync(payload.tempPath);
                    } catch (_) {
                    }
                };
                const readStream = fsSync.createReadStream(payload.tempPath);
                readStream.on("error", err => {
                    console.error("[/api/files/download] stream error", {path: filePath, err: err.message});
                    cleanupTempFile();
                    if (!res.headersSent) {
                        res.status(500).send("Failed to stream downloaded file");
                    } else {
                        res.destroy(err);
                    }
                });
                res.once("finish", cleanupTempFile);
                res.once("close", cleanupTempFile);
                readStream.pipe(res);
                if (downloadEntry && !downloadEntry.settled) {
                    completeWsRequest(downloadEntry);
                }
            };
            const queuePayloadChunk = (chunk, isBinary = true) => {
                payloadFrameReceived = true;
                payloadSink.add(chunk, isBinary);
                if (settleTimeout) clearTimeout(settleTimeout);
                settleTimeout = setTimeout(finalizePayload, WS_BINARY_SETTLE_MS);
            };
            const onRequestTimeout = () => {
                if (payloadSink.hasData() || payloadFrameReceived) {
                    console.log("[/api/files/download] timeout after payload", {
                        path: filePath,
                        messageCount
                    });
                    finalizePayload();
                    return;
                }
                console.log("[/api/files/download] timeout without payload", {
                    path: filePath,
                    messageCount
                });
                cleanup();
                if (!res.headersSent) {
                    res.status(504).send("Timeout waiting for file download");
                }
            };
            const onRequestError = err => {
                if (err.code === "WS_TIMEOUT") {
                    onRequestTimeout();
                    return;
                }
                if (payloadSink.hasData() || payloadFrameReceived) {
                    console.log("[/api/files/download] websocket closed after payload", {
                        path: filePath,
                        messageCount
                    });
                    finalizePayload();
                    return;
                }
                console.log("[/api/files/download] websocket closed without payload", {
                    path: filePath,
                    messageCount
                });
                cleanup();
                if (!res.headersSent) {
                    if (err.code === "WS_REQUEST_CANCELED") {
                        return;
                    }
                    if (err.code === "WS_RELAY_ERROR" || err.code === "WS_RELAY_PROTOCOL") {
                        res.status(502).send(err.message || "Relay response failed");
                        return;
                    }
                    res.status(503).send("WebSocket disconnected");
                }
            };
            const onMessage = (data, isBinary) => {
                messageCount += 1;
                const preview = isBinary
                    ? Buffer.from(data).subarray(0, 24).toString("hex")
                    : String(data).slice(0, 160);
                console.log("[/api/files/download] ws message", {
                    path: filePath,
                    messageCount,
                    isBinary: !!isBinary,
                    size: isBinary ? Buffer.from(data).length : String(data).length,
                    preview
                });
                if (!receivedStatus) {
                    const {status, remainder} = isBinary ? {status: null, remainder: ""} : splitWebSocketStatusMessage(data.toString());
                    console.log("[/api/files/download] first frame parse", {
                        path: filePath,
                        status,
                        remainderLength: remainder.length
                    });
                    if (!isBinary && status) {
                        receivedStatus = true;
                        if (status !== "0x009") {
                            console.log("[/api/files/download] unexpected status", {
                                path: filePath,
                                status
                            });
                            cleanup();
                            if (!res.headersSent) {
                                res.status(502).send(status || "Unexpected download status");
                            }
                        }
                        if (remainder) {
                            queuePayloadChunk(remainder, false);
                        }
                        return;
                    }
                    receivedStatus = true;
                    queuePayloadChunk(data, !!isBinary);
                    return;
                }
                queuePayloadChunk(data, !!isBinary);
            };
            function cleanup() {
                if (settleTimeout) {
                    clearTimeout(settleTimeout);
                }
                resolve();
            }
            console.log("[/api/files/download] sending command", {
                path: filePath,
                command
            });
            enqueueWsRequest({
                name: "file-download",
                response: res,
                timeoutMessage: "Timeout waiting for file download",
                start: entry => {
                    downloadEntry = entry;
                    sendQueuedWsPayload(entry, command);
                },
                onMessage,
                onError: onRequestError,
                onRelayDone: entry => {
                    if (payloadSink.hasData() || payloadFrameReceived || entry.relayBinaryStarted) {
                        finalizePayload();
                    } else if (!res.headersSent) {
                        res.status(502).send("No file payload received");
                    }
                },
                onSettled: cleanup,
                onSuccess: () => null
            }).catch(() => null);
        }));
});

app.get("/api/records/images/:recordId", (req, res) => {
    recordImageQueue = recordImageQueue
        .catch(() => null)
        .then(() => new Promise(resolve => {
            const recordId = req.params.recordId;
            if (!recordId) {
                res.status(400).send("Record ID is required");
                resolve();
                return;
            }
            const command = prepareCommandForRequest(req, res, `rcs ${recordId}`);
            if (!command) {
                resolve();
                return;
            }
            if (!ensureWsOpen(res)) {
                resolve();
                return;
            }
            let receivedStatus = false;
            let settleTimeout = null;
            let finalized = false;
            let imageEntry = null;
            let payloadFrameReceived = false;
            const payloadSink = createTempPayloadSink("image/*");
            const finalizePayload = () => {
                if (finalized) return;
                finalized = true;
                const payload = payloadSink.finalize();
                cleanup();
                res.setHeader("Content-Type", payload.contentType);
                res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
                res.setHeader("Content-Length", `${payload.byteLength}`);
                const cleanupTempFile = () => {
                    try {
                        fsSync.unlinkSync(payload.tempPath);
                    } catch (_) {
                    }
                };
                const readStream = fsSync.createReadStream(payload.tempPath);
                readStream.on("error", err => {
                    console.error("[/api/records/images] stream error:", err.message);
                    cleanupTempFile();
                    if (!res.headersSent) {
                        res.status(500).send("Failed to stream record image");
                    } else {
                        res.destroy(err);
                    }
                });
                res.once("finish", cleanupTempFile);
                res.once("close", cleanupTempFile);
                readStream.pipe(res);
                if (imageEntry && !imageEntry.settled) {
                    completeWsRequest(imageEntry);
                }
            };
            const queuePayloadChunk = (chunk, isBinary = true) => {
                payloadFrameReceived = true;
                payloadSink.add(chunk, isBinary);
                if (settleTimeout) clearTimeout(settleTimeout);
                settleTimeout = setTimeout(finalizePayload, WS_BINARY_SETTLE_MS);
            };
            const onRequestTimeout = () => {
                if (payloadSink.hasData() || payloadFrameReceived) {
                    finalizePayload();
                    return;
                }
                cleanup();
                if (!res.headersSent) {
                    res.status(504).send("Timeout waiting for record image");
                }
            };
            const onRequestError = err => {
                if (err.code === "WS_TIMEOUT") {
                    onRequestTimeout();
                    return;
                }
                if (payloadSink.hasData() || payloadFrameReceived) {
                    finalizePayload();
                    return;
                }
                cleanup();
                if (!res.headersSent) {
                    if (err.code === "WS_REQUEST_CANCELED") return;
                    if (err.code === "WS_RELAY_ERROR" || err.code === "WS_RELAY_PROTOCOL") {
                        res.status(502).send(err.message || "Relay response failed");
                        return;
                    }
                    res.status(503).send("WebSocket disconnected");
                }
            };
            const onMessage = (data, isBinary) => {
                if (!receivedStatus) {
                    const {status, remainder} = isBinary ? {status: null, remainder: ""} : splitWebSocketStatusMessage(data.toString());
                    if (!isBinary && status) {
                        receivedStatus = true;
                        if (status !== "0x010") {
                            cleanup();
                            if (!res.headersSent) {
                                res.status(502).send(status || "Unexpected record image status");
                            }
                        }
                        if (remainder) {
                            queuePayloadChunk(remainder, false);
                        }
                        return;
                    }
                    receivedStatus = true;
                    queuePayloadChunk(data, !!isBinary);
                    return;
                }
                queuePayloadChunk(data, !!isBinary);
            };
            function cleanup() {
                if (settleTimeout) {
                    clearTimeout(settleTimeout);
                }
                resolve();
            }
            enqueueWsRequest({
                name: "record-image",
                response: res,
                timeoutMessage: "Timeout waiting for record image",
                start: entry => {
                    imageEntry = entry;
                    sendQueuedWsPayload(entry, command);
                },
                onMessage,
                onError: onRequestError,
                onRelayDone: entry => {
                    if (payloadSink.hasData() || payloadFrameReceived || entry.relayBinaryStarted) {
                        finalizePayload();
                    } else if (!res.headersSent) {
                        res.status(502).send("No record image payload received");
                    }
                },
                onSettled: cleanup,
                onSuccess: () => null
            }).catch(() => null);
        }));
});

function handleCliRequest(req, res, command) {
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
        return res.status(503).send("WebSocket not connected");
    }
    const preparedCommand = prepareCommandForRequest(req, res, command);
    if (!preparedCommand) {
        return;
    }
    wsClient._receiver?._state?.bufferedPayloads?.length && wsClient._receiver._state.bufferedPayloads.splice(0);
    res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Surrogate-Control": "no-store"
    });
    withWsResponse(res, entry => sendQueuedWsPayload(entry, preparedCommand), data => {
        res.send(data.toString());
    }, {timeoutMessage: "Timeout waiting for response", requestName: "cli"});
}

app.get("/api/cli", (req, res) => {
    handleCliRequest(req, res, req.query.query);
});

app.post("/api/cli", (req, res) => {
    handleCliRequest(req, res, req.body?.query);
});

function sanitizeUserDataFileName(name = "") {
    const normalized = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "");
    if (!normalized) return "data.json";
    return path.extname(normalized) ? normalized : `${normalized}.json`;
}

function resolveUserDataPath(userId, fileName) {
    const safeUserId = sanitizeUserId(userId);
    if (!safeUserId) {
        throw new Error("Invalid user ID");
    }
    const safeFileName = sanitizeUserDataFileName(fileName);
    const userDir = path.join(USER_DATA_ROOT, safeUserId);
    const fullPath = path.normalize(path.join(userDir, safeFileName));
    const normalizedUserDir = path.normalize(userDir + path.sep);
    if (!fullPath.startsWith(normalizedUserDir)) {
        throw new Error("Invalid file path");
    }
    return {userDir, fullPath};
}

function sanitizeUploadFileName(name = "") {
    const normalized = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "");
    return normalized || "upload.bin";
}

function resolveUserLocalPath(userId, fileName) {
    const safeUserId = sanitizeUserId(userId);
    if (!safeUserId) {
        throw new Error("Invalid user ID");
    }
    const safeFileName = sanitizeUploadFileName(fileName);
    const userLocalDir = path.join(USER_DATA_ROOT, safeUserId, "local");
    const fullPath = path.normalize(path.join(userLocalDir, safeFileName));
    const normalizedLocalDir = path.normalize(userLocalDir + path.sep);
    if (!fullPath.startsWith(normalizedLocalDir)) {
        throw new Error("Invalid file path");
    }
    return {userLocalDir, fullPath};
}

function normalizeCurrentUserRecord(payload, fallbackUserId = "") {
    if (!payload) return null;
    let record = null;
    if (Array.isArray(payload)) {
        record = payload[0] || null;
    } else if (Array.isArray(payload.user)) {
        record = payload.user[0] || null;
    } else if (payload.user && typeof payload.user === "object") {
        record = payload.user;
    } else if (typeof payload === "object") {
        record = payload;
    }
    if (!record || typeof record !== "object" || Array.isArray(record)) {
        return null;
    }
    const normalized = {...record};
    const safeUserId = sanitizeUserId(
        `${normalized.userid || normalized.userId || normalized.id || fallbackUserId || ""}`
    );
    if (safeUserId) {
        normalized.userid = safeUserId;
        if (!normalized.userId) {
            normalized.userId = safeUserId;
        }
    }
    if ((normalized.settings === undefined || normalized.settings === null || normalized.settings === "") && normalized.theme !== undefined) {
        normalized.settings = normalized.theme;
    }
    if ((normalized.theme === undefined || normalized.theme === null || normalized.theme === "") && normalized.settings !== undefined) {
        normalized.theme = normalized.settings;
    }
    return normalized;
}

function parseUserSettingsValue(value) {
    let candidate = value;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (!candidate) return null;
        if (typeof candidate === "object" && !Array.isArray(candidate)) return candidate;
        if (typeof candidate !== "string") return null;
        const trimmed = candidate.trim();
        if (!trimmed) return null;
        try {
            candidate = JSON.parse(trimmed);
            continue;
        } catch (_) {
        }
        try {
            candidate = JSON.parse(trimmed.replace(/\\"/g, "\"").replace(/\\\\/g, "\\"));
            continue;
        } catch (_) {
        }
        return null;
    }
    return (candidate && typeof candidate === "object" && !Array.isArray(candidate)) ? candidate : null;
}

function extractUserThemeSettings(userRecord) {
    if (!userRecord || typeof userRecord !== "object") return null;
    return parseUserSettingsValue(userRecord.settings) || parseUserSettingsValue(userRecord.theme);
}

function buildUserSettingsUpdateCommand(userId, settings) {
    const safeUserId = sanitizeUserId(userId);
    if (!safeUserId) {
        throw new Error("Invalid user ID");
    }
    const normalizedSettings = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
    const escapedSettings = JSON.stringify(JSON.stringify(normalizedSettings));
    return `[user] settings ${escapedSettings} <userid "${safeUserId}">`;
}

function buildUserLookupByIdCommand(userId) {
    const safeUserId = sanitizeUserId(userId);
    if (!safeUserId) {
        throw new Error("Invalid user ID");
    }
    return `[user] <userid "${safeUserId}">`;
}

function buildUserLookupByEmailCommand(userEmail = "") {
    const normalizedEmail = `${userEmail || ""}`.trim().replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    if (!normalizedEmail) {
        throw new Error("Invalid user email");
    }
    return `[user] <email "${normalizedEmail}">`;
}

function parseWsJsonResponse(responseBuffer, label = "response") {
    const raw = responseBuffer?.toString?.() ?? "";
    try {
        return JSON.parse(raw);
    } catch (err) {
        const preview = `${raw}`.trim().slice(0, 200);
        const trimmed = `${raw}`.trim();
        console.error("Invalid WebSocket JSON response", {
            label,
            bytes: Buffer.byteLength(raw),
            chars: raw.length,
            startsWith: trimmed.slice(0, 40),
            endsWith: trimmed.slice(-120),
            parseError: err.message
        });
        const error = new Error(`Invalid JSON for ${label}${preview ? `: ${preview}` : ""}`);
        error.code = "INVALID_WS_JSON";
        throw error;
    }
}

async function fetchCurrentUserRecord(req) {
    const sessionUserId = sanitizeUserId(req?.session?.userId || "");
    if (!sessionUserId) {
        return null;
    }
    const cachedUserRecord = getCachedUserRecord(req?.session);
    if (cachedUserRecord) {
        return cachedUserRecord;
    }
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket not connected");
    }
    const payload = parseWsJsonResponse(await sendWsMessage(buildUserLookupByIdCommand(sessionUserId), {
        relayContext: resolveRelayContext(req),
        allowMissingRelayContext: false,
        name: "fetch-current-user"
    }), "current user lookup");
    const normalizedRecord = normalizeCurrentUserRecord(payload, sessionUserId);
    if (normalizedRecord) {
        setCachedUserRecord(req?.session, normalizedRecord);
    }
    return normalizedRecord;
}

async function fetchUserRecordById(userId, {relayContext = null, allowMissingRelayContext = false} = {}) {
    const safeUserId = sanitizeUserId(userId);
    if (!safeUserId) return null;
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket not connected");
    }
    const payload = parseWsJsonResponse(await sendWsMessage(buildUserLookupByIdCommand(safeUserId), {
        relayContext,
        allowMissingRelayContext,
        name: "fetch-user-by-id"
    }), "user lookup by id");
    return normalizeCurrentUserRecord(payload, safeUserId);
}

async function refreshUserCookieForRequest(req, res) {
    const sessionUserId = sanitizeUserId(req?.session?.userId || "");
    if (!sessionUserId) return null;
    const userRecord = await fetchCurrentUserRecord(req);
    if (userRecord) {
        writeUserDataCookie(res, userRecord);
    }
    return userRecord;
}

function getUserRecordFallback(req) {
    const cachedUserRecord = getCachedUserRecord(req?.session);
    if (cachedUserRecord) {
        return cachedUserRecord;
    }
    const cookieUserRecord = decodeUserCookieValue(req?.cookies?.user || "");
    const normalizedCookieUserRecord = normalizeCurrentUserRecord(cookieUserRecord, sanitizeUserId(req?.session?.userId || ""));
    if (normalizedCookieUserRecord) {
        setCachedUserRecord(req?.session, normalizedCookieUserRecord);
        return normalizedCookieUserRecord;
    }
    return null;
}

app.get("/api/user", async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({error: "Unauthorized"});
    }
    try {
        const userRecord = await fetchCurrentUserRecord(req);
        if (!userRecord) {
            return res.status(404).json({error: "User not found"});
        }
        writeUserDataCookie(res, userRecord);
        return res.json(userRecord);
    } catch (err) {
        console.error("Failed to fetch current user:", err.message);
        const status = err.message === "WebSocket not connected" ? 503 : 500;
        return res.status(status).json({error: "Failed to fetch current user"});
    }
});

app.get("/api/user/theme", async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({error: "Unauthorized"});
    }
    try {
        const sessionUserId = sanitizeUserId(req.session.userId || "");
        const userRecord = await fetchCurrentUserRecord(req).catch(err => {
            console.error("Failed to fetch current user theme:", err.message);
            return getUserRecordFallback(req);
        });
        if (!userRecord) {
            const fallbackUser = getUserRecordFallback(req);
            if (!fallbackUser) {
                return res.status(404).json({error: "User not found"});
            }
            const fallbackTheme = extractUserThemeSettings(fallbackUser);
            const normalizedFallbackUser = normalizeCurrentUserRecord(fallbackUser, sessionUserId) || {userid: sessionUserId, userId: sessionUserId};
            writeUserDataCookie(res, normalizedFallbackUser);
            return res.json({
                userid: normalizedFallbackUser.userid || sessionUserId,
                theme: fallbackTheme || null,
                user: normalizedFallbackUser
            });
        }
        const theme = extractUserThemeSettings(userRecord);
        const normalizedUser = normalizeCurrentUserRecord(userRecord, sessionUserId) || {userid: sessionUserId, userId: sessionUserId};
        writeUserDataCookie(res, normalizedUser);
        return res.json({
            userid: normalizedUser.userid || sessionUserId,
            theme: theme || null,
            user: normalizedUser
        });
    } catch (err) {
        console.error("Failed to fetch current user theme:", err.message);
        const status = err.message === "WebSocket not connected" ? 503 : 500;
        return res.status(status).json({error: "Failed to fetch current user theme"});
    }
});

app.post("/api/themes", async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({error: "Unauthorized"});
    }
    try {
        const name = `${req.body?.name || ""}`.trim();
        const data = req.body?.data;
        const user = sanitizeUserId(req.session.userId || "");
        if (!name) return res.status(400).json({error: "Theme name is required"});
        if (!user) return res.status(401).json({error: "Unauthorized"});
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return res.status(400).json({error: "Theme data is required"});
        }
        const repo = await readThemesRepo();
        const theme = {
            name,
            user,
            timestamp: new Date().toISOString(),
            data
        };
        repo.themes.push(theme);
        await writeThemesRepo(repo);
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        return res.status(201).json({theme, themes: repo.themes});
    } catch (err) {
        console.error("Failed to save theme:", err);
        return res.status(500).json({error: "Failed to save theme"});
    }
});

app.get("/api/user-data/:fileName", async (req, res) => {
    try {
        const safeFileName = path.basename(String(req.params.fileName || ""));
        if (safeFileName === "theme") {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
            const userRecord = await fetchCurrentUserRecord(req);
            if (!userRecord) {
                return res.status(404).json({error: "File not found"});
            }
            const settings = extractUserThemeSettings(userRecord);
            if (settings && typeof settings === "object") {
                return res.json(settings);
            }
            return res.status(404).json({error: "File not found"});
        }
        if (isRelayMode) {
            res.setHeader("Vary", "Cookie");
            return res.status(404).json({error: "File not found"});
        }
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        const userFolder = resolveSessionUserFolder(req.session);
        const {fullPath} = resolveUserDataPath(userFolder, req.params.fileName);
        await ensureUserDir(userFolder);
        const extension = path.extname(fullPath).toLowerCase();
        try {
            if (extension === ".json") {
                const content = await fs.readFile(fullPath, "utf8");
                return res.json(JSON.parse(content));
            }
            const content = await fs.readFile(fullPath);
            res.type(extension || "application/octet-stream");
            return res.send(content);
        } catch (err) {
            if (err.code === "ENOENT") {
                return res.status(404).json({error: "File not found"});
            }
            if (err instanceof SyntaxError && extension === ".json") {
                console.error("Failed to parse user data JSON:", err);
                return res.status(500).json({error: "Invalid JSON content"});
            }
            throw err;
        }
    } catch (err) {
        const status = err.message.startsWith("Invalid") ? 400 : 500;
        console.error("Failed to read user data:", err);
        return res.status(status).json({error: "Failed to read user data"});
    }
});

app.post("/api/user-data/:fileName", uploadSingleFile, async (req, res) => {
    try {
        const safeFileName = path.basename(String(req.params.fileName || ""));
        if (safeFileName === "theme") {
            if (req.file) {
                return res.status(400).json({error: "Binary uploads are not supported for theme settings"});
            }
            const userId = sanitizeUserId(req?.session?.userId || "");
            if (!userId) {
                return res.status(401).json({error: "Unauthorized"});
            }
            const command = buildUserSettingsUpdateCommand(userId, req.body ?? {});
            const existingUserRecord = getCachedUserRecord(req.session) || {userid: userId, userId};
            const serializedTheme = JSON.stringify(JSON.stringify(req.body ?? {}));
            const nextUserRecord = {...existingUserRecord, settings: serializedTheme, theme: serializedTheme};
            setCachedUserRecord(req.session, nextUserRecord);
            writeUserDataCookie(res, nextUserRecord);
            handleCliRequest(req, res, command);
            return;
        }
        if (isRelayMode) {
            res.setHeader("Vary", "Cookie");
            return res.status(404).json({error: "File not found"});
        }
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        const userFolder = resolveSessionUserFolder(req.session);
        const {fullPath} = resolveUserDataPath(userFolder, req.params.fileName);
        const extension = path.extname(fullPath).toLowerCase();
        await ensureUserDir(userFolder);
        let exists = false;
        try {
            await fs.access(fullPath);
            exists = true;
        } catch (err) {
            if (err.code !== "ENOENT") {
                throw err;
            }
        }
        if (req.file) {
            await fs.writeFile(fullPath, req.file.buffer);
        } else if (extension === ".json") {
            await fs.writeFile(fullPath, JSON.stringify(req.body ?? {}, null, 2));
        } else {
            return res.status(400).json({error: "Binary uploads must use multipart/form-data with a file field"});
        }
        const status = exists ? 200 : 201;
        const message = exists ? "File overwritten" : "File created";
        return res.status(status).json({message, fileName: path.basename(fullPath)});
    } catch (err) {
        const status = err.message.startsWith("Invalid") ? 400 : 500;
        console.error("Failed to save user data file:", err);
        return res.status(status).json({error: "Failed to save user data file"});
    }
});

app.post("/api/user-data/local", uploadSingleFile, async (req, res) => {
    if (!req.session || !req.session.userId) return res.status(401).json({error: "Unauthorized"});
    if (!req.file) return res.status(400).json({error: "No file uploaded"});
    try {
        const userFolder = resolveSessionUserFolder(req.session);
        const {userLocalDir, fullPath} = resolveUserLocalPath(userFolder, req.file.originalname);
        await fs.mkdir(userLocalDir, {recursive: true, mode: 0o700});
        await fs.writeFile(fullPath, req.file.buffer);
        return res.status(201).json({message: "File uploaded", fileName: path.basename(fullPath)});
    } catch (err) {
        const status = err.message.startsWith("Invalid") ? 400 : 500;
        console.error("Failed to save uploaded file:", err);
        return res.status(status).json({error: "Failed to save uploaded file"});
    }
});

app.get("/api/cache/:interface", async (req, res) => {
    return res.status(410).json({error: "Server file cache is obsolete. Cache entries are stored in the browser."});
});

app.get("/api/cache/:interface/:key", async (req, res) => {
    return res.status(410).json({error: "Server file cache is obsolete. Cache entries are stored in the browser."});
});

app.post("/api/cache/:interface/:key", express.raw({type: ["application/octet-stream", "image/*"], limit: REQUEST_BODY_LIMIT}), async (req, res) => {
    return res.status(410).json({error: "Server file cache is obsolete. Cache entries are stored in the browser."});
});

app.delete("/api/cache/:interface/:key", async (req, res) => {
    return res.status(410).json({error: "Server file cache is obsolete. Cache entries are stored in the browser."});
});

const server = createServer();
let hasStartedServer = false;

function getServerProtocol() {
    return usingHttps ? "https" : "http";
}

function getListeningPort() {
    const address = server.address();
    if (address && typeof address === "object" && address.port) {
        return address.port;
    }
    return PORT;
}

function getServerUrl(host = "127.0.0.1") {
    return `${getServerProtocol()}://${host}:${getListeningPort()}`;
}

async function startServer() {
    if (hasStartedServer && server.listening) {
        return {
            server,
            port: getListeningPort(),
            protocol: getServerProtocol(),
            url: getServerUrl()
        };
    }
    if (isDesktopSetupEnabled) {
        await loadDesktopSetupConfig();
    }
    return new Promise((resolve, reject) => {
        const handleError = (err) => {
            server.off("error", handleError);
            reject(err);
        };
        server.once("error", handleError);
        server.listen(PORT, () => {
            server.off("error", handleError);
            hasStartedServer = true;
            const protocol = getServerProtocol();
            const listeningPort = getListeningPort();
            console.log(`Server running at ${protocol}://localhost:${listeningPort}`);
            if (shouldAdvertiseLocalHostname) {
                console.log(`LAN URL (mDNS): ${protocol}://${LOCAL_HOSTNAME}.local:${listeningPort}`);
            } else if (isRelayMode) {
                console.log(`Relay mode enabled; listening on ${protocol}://0.0.0.0:${listeningPort}`);
            }
            advertiseLocalHostname();
            connectToStdSystem();
            resolve({
                server,
                port: listeningPort,
                protocol,
                url: getServerUrl()
            });
        });
    });
}

function stopServer() {
    return new Promise((resolve, reject) => {
        stopLocalHostnameAdvertisement();
        if (!server.listening) {
            hasStartedServer = false;
            return resolve();
        }
        server.close((err) => {
            hasStartedServer = false;
            if (err) return reject(err);
            resolve();
        });
    });
}

if (require.main === module) {
    startServer().catch((err) => {
        console.error("Failed to start server:", err);
        process.exit(1);
    });

    process.on("SIGINT", () => {
        stopServer().finally(() => process.exit(0));
    });

    process.on("SIGTERM", () => {
        stopServer().finally(() => process.exit(0));
    });
}

module.exports = {
    app,
    server,
    startServer,
    stopServer,
    getServerUrl,
    isElectronRuntime,
    isRelayMode
};
