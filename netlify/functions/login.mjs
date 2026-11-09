import crypto from "node:crypto";
import { getStore, json, parseBody, passwordMatches, SESSION_TTL_SECONDS } from "../lib/common.mjs";

export default async function login(request) {
  if (request.method !== "POST") return json(405, { success: false, error: "Method not allowed." });
  const data = await parseBody(request);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return json(400, { success: false, error: "A JSON payload is required." });
  }

  const username = String(data.username || "").trim();
  const password = String(data.password || "");
  if (!username || !password) return json(400, { success: false, error: "Username and password are required." });

  const user = await getStore("portfolio-users").get("admin", { type: "json" });
  const matches = user && (
    user.name === username ||
    (typeof user.email === "string" && user.email.toLowerCase() === username.toLowerCase())
  );
  if (!matches || !passwordMatches(password, user)) {
    return json(401, { success: false, error: "Invalid username or password." });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  await getStore("portfolio-sessions").setJSON(token, {
    user: { name: user.name, email: user.email },
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  });
  return json(200, { success: true, token, user: { name: user.name } });
}
