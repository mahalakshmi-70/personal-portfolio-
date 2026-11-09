import { json } from "../lib/common.mjs";

export default async function health(request) {
  if (request.method !== "GET") return json(405, { error: "Method not allowed." });
  const emailEnabled = process.env.EMAIL_ENABLED?.toLowerCase() !== "false" &&
    process.env.EMAIL_ENABLED !== "0" &&
    Boolean(process.env.SMTP_EMAIL && process.env.SMTP_APP_PASSWORD && process.env.RECEIVER_EMAIL);
  return json(200, { status: "ok", emailEnabled });
}
