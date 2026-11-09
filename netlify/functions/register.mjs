import crypto from "node:crypto";
import { EMAIL_PATTERN, getStore, hashPassword, json, parseBody, safeEqual } from "../lib/common.mjs";

export default async function register(request) {
  if (request.method !== "POST") return json(405, { success: false, error: "Method not allowed." });
  const data = await parseBody(request);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return json(400, { success: false, error: "A JSON payload is required." });
  }

  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "");
  if (!name || !email || !password) {
    return json(400, { success: false, error: "Name, email, and password are required." });
  }
  if (name.length > 100 || !EMAIL_PATTERN.test(email)) {
    return json(400, { success: false, error: "Enter a valid name and email." });
  }
  if (password.length < 7) return json(400, { success: false, error: "Password must be at least 7 characters." });

  const setupKey = process.env.ADMIN_SETUP_KEY;
  if (!setupKey) return json(503, { success: false, error: "Admin setup is not configured on the server." });
  if (!safeEqual(String(data.setupKey || ""), setupKey)) {
    return json(403, { success: false, error: "A valid admin setup key is required." });
  }

  const users = getStore("portfolio-users");
  const existing = await users.get("admin", { type: "json" });
  if (existing) {
    return json(409, { success: false, error: "Admin registration is closed. Sign in with the existing account." });
  }

  const user = {
    id: crypto.randomUUID(),
    name,
    email,
    ...hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  const result = await users.setJSON("admin", user, { onlyIfNew: true });
  if (!result.modified) {
    return json(409, { success: false, error: "Admin registration is closed. Sign in with the existing account." });
  }
  return json(201, { success: true, message: "Admin account created." });
}
