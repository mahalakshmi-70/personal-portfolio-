import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

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
