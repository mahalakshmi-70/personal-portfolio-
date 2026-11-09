import { getSession, getStore, json } from "../lib/common.mjs";

export default async function messages(request) {
  if (request.method !== "GET") return json(405, { success: false, error: "Method not allowed." });
  if (!await getSession(request)) return json(401, { success: false, error: "Authentication required." });

  const store = getStore("portfolio-messages");
  const { blobs } = await store.list();
  const records = await Promise.all(blobs.map(({ key }) => store.get(key, { type: "json" })));
  return json(200, records.filter(Boolean).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
}
