import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export function getEmailConfig() {
  const user = process.env.SMTP_USER || process.env.SMTP_EMAIL || "";
  const pass = process.env.SMTP_PASS || process.env.SMTP_APP_PASSWORD || "";
  const port = Number(process.env.SMTP_PORT || 587);
  const disabled = ["false", "0", "no"].includes((process.env.EMAIL_ENABLED || "").toLowerCase());
  return {
    enabled: !disabled && Boolean(user && pass && Number.isInteger(port) && port > 0 && port <= 65535),
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: process.env.SMTP_SECURE
      ? ["true", "1", "yes"].includes(process.env.SMTP_SECURE.toLowerCase())
      : port === 465,
    user,
    pass,
    from: process.env.SMTP_FROM || user,
    to: process.env.RECEIVER_EMAIL || process.env.MAIL_TO || process.env.SMTP_FROM || user,
  };
}

export function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const digest = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, passwordHash: digest };
}

export function passwordMatches(password, user) {
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

export function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function bearerToken(request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") || "");
  return match ? match[1].trim() : "";
}

export async function getSession(request) {
  const token = bearerToken(request);
  if (!token) return null;
  const store = getStore("portfolio-sessions");
  const session = await store.get(token, { type: "json" });
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    await store.delete(token);
    return null;
  }
  return session.user;
}
