const crypto = require("node:crypto");

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PASSWORD_HASH_LENGTH = 64;
const SESSION_TTL_SECONDS = 8 * 60 * 60;

async function getStore(name) {
  const { getStore: openStore } = await import("@netlify/blobs");
  return openStore(name);
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  };
}

function parseBody(event) {
  if (!event.body) return null;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const digest = crypto.scryptSync(password, salt, PASSWORD_HASH_LENGTH).toString("hex");
  return { salt, passwordHash: digest };
}

function passwordMatches(password, user) {
  if (typeof user.salt === "string" && typeof user.passwordHash === "string") {
    try {
      const actual = Buffer.from(hashPassword(password, user.salt).passwordHash, "hex");
      const expected = Buffer.from(user.passwordHash, "hex");
      return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
  return typeof user.password === "string" && safeEqual(password, user.password);
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function bearerToken(event) {
  const authorization = event.headers?.authorization || event.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match ? match[1].trim() : "";
}

async function getSession(event) {
  const token = bearerToken(event);
  if (!token) return null;
  const store = await getStore("portfolio-sessions");
  const session = await store.get(token, { type: "json" });
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    await store.delete(token);
    return null;
  }
  return session.user;
}

module.exports = {
  EMAIL_PATTERN,
  SESSION_TTL_SECONDS,
  bearerToken,
  getSession,
  getStore,
  hashPassword,
  json,
  parseBody,
  passwordMatches,
  safeEqual,
};
