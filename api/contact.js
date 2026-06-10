import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, email, subject, message } = req.body || {};

  if (!email || !subject || !message) {
    return res.status(400).json({ error: "email, subject, and message are required" });
  }

  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "maria.h.cristoforo@gmail.com",
      reply_to: email,
      subject: `Contact: ${subject}`,
      text: `New message via portfolio API\n\nFrom: ${name || "—"}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
    });
  } catch {
    return res.status(500).json({ error: "Failed to send message. Try emailing maria.h.cristoforo@gmail.com directly." });
  }

  res.status(200).json({
    received: true,
    message: "Thanks for reaching out. I'll get back to you soon.",
  });
}
