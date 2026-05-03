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
const USER_DATA_ROOT = path.join(__dirname, "user_data");
const SETTINGS_ARCHIVE_ROOT = USER_DATA_ROOT;
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
const userSessions = new Map();
const knownUsernames = new Map();
const knownUserFolders = new Map();
let fileDownloadQueue = Promise.resolve();
let fileUploadQueue = Promise.resolve();
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
    const hasInlineRelayContext = relayPrefixed && relayParts.length >= 4;
    if (relayPrefixed && hasInlineRelayContext) {
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
    }
    next();
}

async function ensureUserDataRoot() {
    await fs.mkdir(USER_DATA_ROOT, {recursive: true, mode: 0o700});
}

const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
        let value = i;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        }
        table[i] = value >>> 0;
    }
    return table;
})();

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

function sanitizeSettingsUserFolder(userId = "") {
    return `${userId}`.trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

function resolveSessionUserFolder(session) {
    return sanitizeUserId(session?.userFolder || session?.userId || "");
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function getZipDateParts(date = new Date()) {
    const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const year = Math.max(1980, safeDate.getFullYear());
    const dosTime = (safeDate.getHours() << 11) | (safeDate.getMinutes() << 5) | Math.floor(safeDate.getSeconds() / 2);
    const dosDate = ((year - 1980) << 9) | ((safeDate.getMonth() + 1) << 5) | safeDate.getDate();
    return {dosTime, dosDate};
}

async function collectZipEntries(rootDir, archiveRoot = "") {
    const dirEntries = await fs.readdir(rootDir, {withFileTypes: true});
    dirEntries.sort((a, b) => a.name.localeCompare(b.name));
    const zipEntries = [];
    for (const dirEntry of dirEntries) {
        const sourcePath = path.join(rootDir, dirEntry.name);
        const archivePath = archiveRoot ? `${archiveRoot}/${dirEntry.name}` : dirEntry.name;
        if (dirEntry.isDirectory()) {
            const stats = await fs.stat(sourcePath);
            zipEntries.push({
                name: `${archivePath}/`,
                data: Buffer.alloc(0),
                isDirectory: true,
                modifiedAt: stats.mtime
            });
            zipEntries.push(...await collectZipEntries(sourcePath, archivePath));
            continue;
        }
        if (!dirEntry.isFile()) {
            continue;
        }
        const [stats, data] = await Promise.all([fs.stat(sourcePath), fs.readFile(sourcePath)]);
        zipEntries.push({
            name: archivePath,
            data,
            isDirectory: false,
            modifiedAt: stats.mtime
        });
    }
    return zipEntries;
}

async function createUserSettingsZip(userFolder) {
    const safeUserFolder = sanitizeSettingsUserFolder(userFolder);
    if (!safeUserFolder) {
        throw new Error("Invalid user folder");
    }
    const sourceDir = path.normalize(path.join(SETTINGS_ARCHIVE_ROOT, safeUserFolder));
    const normalizedRoot = path.normalize(SETTINGS_ARCHIVE_ROOT + path.sep);
    if (!sourceDir.startsWith(normalizedRoot)) {
        throw new Error("Invalid user folder path");
    }
    const stats = await fs.stat(sourceDir).catch(() => null);
    if (!stats || !stats.isDirectory()) {
        return null;
    }

    const entries = [{
        name: `${safeUserFolder}/`,
        data: Buffer.alloc(0),
        isDirectory: true,
        modifiedAt: stats.mtime
    }, ...await collectZipEntries(sourceDir, safeUserFolder)];

    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBuffer = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
        const dataBuffer = entry.data || Buffer.alloc(0);
        const {dosTime, dosDate} = getZipDateParts(entry.modifiedAt);
        const compressedSize = dataBuffer.length;
        const uncompressedSize = dataBuffer.length;
        const checksum = entry.isDirectory ? 0 : crc32(dataBuffer);

        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0, 6);
        localHeader.writeUInt16LE(0, 8);
        localHeader.writeUInt16LE(dosTime, 10);
        localHeader.writeUInt16LE(dosDate, 12);
        localHeader.writeUInt32LE(checksum, 14);
        localHeader.writeUInt32LE(compressedSize, 18);
        localHeader.writeUInt32LE(uncompressedSize, 22);
        localHeader.writeUInt16LE(nameBuffer.length, 26);
        localHeader.writeUInt16LE(0, 28);
        localParts.push(localHeader, nameBuffer, dataBuffer);

        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0, 8);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt16LE(dosTime, 12);
        centralHeader.writeUInt16LE(dosDate, 14);
        centralHeader.writeUInt32LE(checksum, 16);
        centralHeader.writeUInt32LE(compressedSize, 20);
        centralHeader.writeUInt32LE(uncompressedSize, 24);
        centralHeader.writeUInt16LE(nameBuffer.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(entry.isDirectory ? 0x10 : 0x20, 38);
        centralHeader.writeUInt32LE(offset, 42);
        centralParts.push(centralHeader, nameBuffer);

        offset += localHeader.length + nameBuffer.length + dataBuffer.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const endOfCentralDirectory = Buffer.alloc(22);
    endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
    endOfCentralDirectory.writeUInt16LE(0, 4);
    endOfCentralDirectory.writeUInt16LE(0, 6);
    endOfCentralDirectory.writeUInt16LE(entries.length, 8);
    endOfCentralDirectory.writeUInt16LE(entries.length, 10);
    endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
    endOfCentralDirectory.writeUInt32LE(offset, 16);
    endOfCentralDirectory.writeUInt16LE(0, 20);

    return {
        fileName: `${safeUserFolder}.zip`,
        buffer: Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory])
    };
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

function sendQueuedWsPayload(entry, payload) {
    wsClient.send(payload, err => {
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
            onSettled,
            resolve,
            reject,
            settled: false,
            timeoutHandle: null,
            createdAt: Date.now()
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
    if (!activeWsRequest || typeof activeWsRequest.onMessage !== "function") {
        console.warn("[ws-dispatch:unhandled-message]", {
            activeRequestId: activeWsRequest?.id || null,
            isBinary: !!isBinary,
            size: isBinary ? Buffer.from(data).length : String(data ?? "").length
        });
        return;
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

function createWebSocketPayloadCollector(defaultContentType = "application/octet-stream") {
    const segments = [];
    let detectedContentType = defaultContentType;
    return {
        add(chunk, isBinary = true) {
            if (isBinary) {
                segments.push({
                    type: "binary",
                    value: Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
                });
                return;
            }
            segments.push({
                type: "text",
                value: unwrapRelayTextPayload(chunk?.toString?.() ?? chunk ?? "")
            });
        },
        hasData() {
            return segments.some(segment => segment.type === "binary" ? segment.value.length > 0 : segment.value.length > 0);
        },
        getContentType() {
            return detectedContentType || defaultContentType;
        },
        toBuffer() {
            const parts = [];
            let pendingText = "";
            const flushText = () => {
                if (!pendingText) return;
                const normalizedTextPayload = normalizeTextWebSocketPayload(pendingText);
                pendingText = "";
                if (normalizedTextPayload?.buffer) {
                    if (normalizedTextPayload.contentType && detectedContentType === defaultContentType) {
                        detectedContentType = normalizedTextPayload.contentType;
                    }
                    parts.push(normalizedTextPayload.buffer);
                }
            };
            for (const segment of segments) {
                if (segment.type === "text") {
                    pendingText += segment.value;
                    continue;
                }
                flushText();
                parts.push(segment.value);
            }
            flushText();
            return parts.length ? Buffer.concat(parts) : Buffer.alloc(0);
        }
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

function requireLogin(req, res, next) {
    const publicPaths = ["/login", "/bad-connection", "/api/login", "/api/status", "/api/device/status", "/api/keys/push"];
    if (isDesktopSetupEnabled) {
        publicPaths.push("/setup");
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
        start: () => {
            const result = sendFn();
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
            wsClient.send(payload, err => {
                if (err) {
                    clearFallback();
                    failWsRequest(entry, err);
                    return;
                }
                fallbackHandle = setTimeout(() => {
                    fallbackHandle = null;
                    if (!res.headersSent) {
                        res.send("Upload sent");
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

function detectServerIp() {
    if (process.env.SERVER_IP) {
        return process.env.SERVER_IP;
    }
    const interfaces = os.networkInterfaces();
    for (const entries of Object.values(interfaces)) {
        for (const entry of entries) {
            if (entry.family === "IPv4" && !entry.internal) {
                return entry.address;
            }
        }
    }
    return null;
}

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
        } catch (_) {
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
            relayContext: resolveRelayContext(req),
            allowMissingRelayContext: true
        });
        const token = response.toString().trim();
        if (!token) {
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
        } catch (_) {
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
        const response = await sendWsMessage(command, { relayContext: resolveRelayContext(req), allowMissingRelayContext: true });
        const token = response.toString().trim();
        if (!token) return res.status(502).json({error: "Failed to obtain relay token"});
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

app.get("/mysettings", async (req, res) => {
    if (isRelayMode) return res.status(404).send("Not found");
    try {
        const archive = await createUserSettingsZip(req.query.user);
        if (!archive) return res.status(404).send("User settings folder not found");
        res.status(200);
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${archive.fileName}"`);
        res.setHeader("Content-Length", archive.buffer.length);
        res.setHeader("Content-Transfer-Encoding", "binary");
        res.setHeader("X-Content-Type-Options", "nosniff");
        return res.end(archive.buffer, "binary");
    } catch (err) {
        console.error("Failed to create settings archive:", err);
        return res.status(400).send("Unable to create settings archive");
    }
});

app.use(requireLogin);

function relayGuard(req, res, next) {
    if (!isRelayMode) {
        return next();
    }
    const exemptPaths = ["/", "/api/status", "/api/login", "/api/device/status", "/api/keys/push", "/bad-connection"];
    if (exemptPaths.some(path => req.path.startsWith(path))) {
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

/**
 * Checks if a device with Serial (Device ID) is connected.
 */
app.post("/api/status", (req, res) => {
    const deviceId = req.body?.d?.device_uid;
    if (!deviceId) return res.status(400).json({error: "device_uid is required"});
    withWsResponse(res, () => wsClient.send(`relay ping ${deviceId}`), data => {
        const isConnected = data.toString().trim() === "true";
        const status = isConnected ? 200 : 404;
        res.status(status).json({connected: isConnected});
    }, {timeoutMessage: "Timeout waiting for relay response"});
});

app.get("/api/stds", (req, res) => {
    withWsResponse(res, () => wsClient.send("stds"), data => {
        res.send(data.toString());
    });
});

app.get("/api/stds/:standard", (req, res) => {
    withWsResponse(res, () => wsClient.send(`stds ${req.params.standard}`), data => {
        res.send(data.toString());
    });
});

app.get("/api/stds/:standard/json", (req, res) => {
    withWsResponse(res, () => wsClient.send(`stds ${req.params.standard} json`), data => {
        res.json(JSON.parse(data.toString()));
    });
});

app.get("/api/records/:standard", (req, res) => {
    withWsResponse(res, () => wsClient.send(`[${req.params.standard}]`), data => {
        if (data !== "NO RECORDS FOUND") {
            res.json(JSON.parse(data.toString()));
        }
    });
});

app.get("/api/tree", (req, res) => {
    withWsResponse(res, () => wsClient.send("tree"), data => {
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
    withWsResponse(res, () => wsClient.send(command), data => {
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
    withWsResponse(res, () => {
        wsClient.send(command);
    }, data => {
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
        withWsResponse(res, () => {
            wsClient.send(command);
        }, data => {
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
        withWsResponse(res, () => {
            wsClient.send(tempPayload);
        }, data => {
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
                const uploadDirectory = rawUploadDirectory.replace(/\\/g, "/").replace(/\/+$/, "").replace(/^\/home\/standard-system\//, "").replace(/^home\/standard-system\//, "").replace(/^\/+/, "");
                const importPath = uploadDirectory ? `${uploadDirectory}/${fileName}` : fileName;
                const importPayload = buildBinaryCommandPayload("import", importPath, req.file.buffer, resolveRelayContext(req));
                if (isRelayMode) {
                    withRelayBinaryUploadResponse(res, importPayload, {
                        requestName: "relay-file-upload",
                        onSettled: resolve
                    });
                    return;
                }
                withWsResponse(res, () => {
                    wsClient.send(importPayload);
                }, data => {
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
            let receivedStatus = false;
            let settleTimeout = null;
            let messageCount = 0;
            let finalized = false;
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
                res.setHeader("Content-Type", payload.contentType);
                res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
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
            };
            const queuePayloadChunk = (chunk, isBinary = true) => {
                payloadSink.add(chunk, isBinary);
                if (settleTimeout) clearTimeout(settleTimeout);
                settleTimeout = setTimeout(finalizePayload, WS_BINARY_SETTLE_MS);
            };
            const onRequestTimeout = () => {
                if (payloadSink.hasData()) {
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
                if (payloadSink.hasData()) {
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
                start: entry => sendQueuedWsPayload(entry, command),
                onMessage,
                onError: onRequestError,
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
            };
            const queuePayloadChunk = (chunk, isBinary = true) => {
                payloadSink.add(chunk, isBinary);
                if (settleTimeout) clearTimeout(settleTimeout);
                settleTimeout = setTimeout(finalizePayload, WS_BINARY_SETTLE_MS);
            };
            const onRequestTimeout = () => {
                if (payloadSink.hasData()) {
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
                if (payloadSink.hasData()) {
                    finalizePayload();
                    return;
                }
                cleanup();
                if (!res.headersSent) {
                    if (err.code === "WS_REQUEST_CANCELED") return;
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
                start: entry => sendQueuedWsPayload(entry, command),
                onMessage,
                onError: onRequestError,
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
    withWsResponse(res, () => {
        sendQueuedWsPayload(activeWsRequest, preparedCommand);
    }, data => {
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

function sanitizeCacheSegment(value = "", {allowDots = true} = {}) {
    const pattern = allowDots ? /[^a-zA-Z0-9._-]/g : /[^a-zA-Z0-9_-]/g;
    return `${value}`.trim().replace(pattern, "");
}

function resolveCachePath(interfaceName, key, format) {
    const safeInterface = sanitizeCacheSegment(interfaceName);
    const safeKey = sanitizeCacheSegment(key);
    const safeFormat = format ? sanitizeCacheSegment(format, {allowDots: false}) : "";
    if (!safeInterface || !safeKey) {
        throw new Error("Invalid cache path");
    }
    const fileName = safeFormat ? `${safeKey}.${safeFormat}` : safeKey;
    const cacheRoot = path.join(__dirname, "private", "cache");
    const interfaceDir = path.join(cacheRoot, safeInterface);
    const fullPath = path.normalize(path.join(interfaceDir, fileName));
    const normalizedInterfaceDir = path.normalize(interfaceDir + path.sep);
    if (!fullPath.startsWith(normalizedInterfaceDir)) {
        throw new Error("Invalid cache path");
    }
    return {interfaceDir, fullPath, safeFormat};
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
    try {
        const safeInterface = sanitizeCacheSegment(req.params.interface);
        if (!safeInterface) {
            throw new Error("Invalid cache path");
        }
        const cacheRoot = path.join(__dirname, "private", "cache");
        const interfaceDir = path.join(cacheRoot, safeInterface);
        const normalizedInterfaceDir = path.normalize(interfaceDir + path.sep);
        if (!normalizedInterfaceDir.startsWith(path.normalize(cacheRoot + path.sep))) throw new Error("Invalid cache path");
        let entries = [];
        try {
            entries = await fs.readdir(interfaceDir, {withFileTypes: true});
        } catch (err) {
            if (err.code === "ENOENT") return res.json({files: []});
            throw err;
        }
        const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
        return res.json({files});
    } catch (err) {
        const status = err.message.startsWith("Invalid") ? 400 : 500;
        console.error("Failed to list cache files:", err);
        return res.status(status).json({error: "Failed to list cache files"});
    }
});

app.get("/api/cache/:interface/:key", async (req, res) => {
    try {
        const {fullPath, safeFormat} = resolveCachePath(req.params.interface, req.params.key, req.query.format);
        const content = await fs.readFile(fullPath);
        if (safeFormat) res.type(safeFormat);
        return res.send(content);
    } catch (err) {
        if (err.code === "ENOENT") return res.status(404).json({error: "Cache file not found"});
        const status = err.message.startsWith("Invalid") ? 400 : 500;
        console.error("Failed to read cache file:", err);
        return res.status(status).json({error: "Failed to read cache file"});
    }
});

app.post("/api/cache/:interface/:key", express.raw({type: ["application/octet-stream", "image/*"], limit: REQUEST_BODY_LIMIT}), async (req, res) => {
    try {
        const {interfaceDir, fullPath} = resolveCachePath(req.params.interface, req.params.key, req.query.format);
        await fs.mkdir(interfaceDir, {recursive: true});
        let content = "";
        if (Buffer.isBuffer(req.body)) {
            content = req.body;
        } else if (typeof req.body === "string") {
            content = req.body;
        } else if (req.body !== undefined && req.body !== null && Object.keys(req.body).length > 0) {
            content = JSON.stringify(req.body, null, 2);
        }
        await fs.writeFile(fullPath, content);
        return res.status(201).json({message: "Cache file saved", path: fullPath});
    } catch (err) {
        const status = err.message.startsWith("Invalid") ? 400 : 500;
        console.error("Failed to save cache file:", err);
        return res.status(status).json({error: "Failed to save cache file"});
    }
});

app.delete("/api/cache/:interface/:key", async (req, res) => {
    try {
        const {fullPath} = resolveCachePath(req.params.interface, req.params.key, req.query.format);
        await fs.unlink(fullPath);
        return res.json({message: "Cache file deleted"});
    } catch (err) {
        if (err.code === "ENOENT") return res.status(404).json({error: "Cache file not found"});
        const status = err.message.startsWith("Invalid") ? 400 : 500;
        console.error("Failed to delete cache file:", err);
        return res.status(status).json({error: "Failed to delete cache file"});
    }
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
