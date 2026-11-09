import { bearerToken, getStore, json } from "../lib/common.mjs";

export default async function logout(request) {
  if (request.method !== "POST") return json(405, { success: false, error: "Method not allowed." });
  const token = bearerToken(request);
  if (token) await getStore("portfolio-sessions").delete(token);
  return json(200, { success: true });
}
