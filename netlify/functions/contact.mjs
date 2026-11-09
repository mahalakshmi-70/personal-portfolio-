import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { EMAIL_PATTERN, getStore, json, parseBody } from "../lib/common.mjs";

export default async function contact(request) {
  if (request.method !== "POST") return json(405, { success: false, error: "Method not allowed." });
  const data = await parseBody(request);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return json(400, { success: false, error: "A JSON payload is required." });
  }

  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim();
  const phone = String(data.phone || "").trim();
  const message = String(data.message || "").trim();
  if (!name || !email || !message) {
    return json(400, { success: false, error: "Name, email, and message are required." });
  }
  if (!EMAIL_PATTERN.test(email)) return json(400, { success: false, error: "Invalid email format." });
  if (name.length > 100 || email.length > 254 || phone.length > 40 || message.length > 10000) {
    return json(400, { success: false, error: "One or more fields are too long." });
  }

  const id = crypto.randomUUID();
  const entry = { id, name, email, phone, message, createdAt: new Date().toISOString() };
  await getStore("portfolio-messages").setJSON(id, entry);

  let emailSent = false;
  const emailEnabled = process.env.EMAIL_ENABLED?.toLowerCase() !== "false" && process.env.EMAIL_ENABLED !== "0";
  if (emailEnabled && process.env.SMTP_EMAIL && process.env.SMTP_APP_PASSWORD && process.env.RECEIVER_EMAIL) {
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: { user: process.env.SMTP_EMAIL, pass: process.env.SMTP_APP_PASSWORD },
      });
      await transporter.sendMail({
        from: process.env.SMTP_EMAIL,
        to: process.env.RECEIVER_EMAIL,
        replyTo: email,
        subject: "New Portfolio Contact Message",
        text: `New Portfolio Contact Message\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || "N/A"}\nMessage: ${message}`,
      });
      emailSent = true;
    } catch (error) {
      console.error("Contact email delivery failed:", error.message);
    }
  }

  return json(200, {
    success: true,
    message: emailSent
      ? "Your message has been received."
      : "Your message was saved, but the email notification could not be sent.",
    emailSent,
  });
}
