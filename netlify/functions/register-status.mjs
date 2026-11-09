import { getStore, json } from "../lib/common.mjs";

export default async function registrationStatus(request) {
  if (request.method !== "GET") return json(405, { error: "Method not allowed." });
  const admin = await getStore("portfolio-users").get("admin", { type: "json" });
  return json(200, { registrationAvailable: !admin });
}
