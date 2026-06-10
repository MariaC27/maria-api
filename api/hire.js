import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

const MARIA_CONTEXT = `
Maria Cristoforo is a Product Designer & Engineer based in San Francisco, currently at Ocular AI (YC W24).

Skills:
- Active (daily use): TypeScript, React, Next.js, Tailwind, HTML/CSS, AI-assisted design, design-to-code, technical writing, cross-functional collaboration, customer-facing communication
- Fluent (comfortable, not current): JavaScript, Python, Figma, UX research
- Familiar (solid foundations): Java

Background:
- Strong overlap between design and engineering — comfortable owning work from wireframe to shipped feature
- Experience building and shipping AI-powered tools
- Early-stage startup experience, adapts quickly in fast-moving environments
- Technical writing and cross-functional communication across eng, design, and product
- Have worked as a SWE and support engineer at various companies, experience with user reserach and customer communication
`.trim();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { role, team, description } = req.body || {};

  if (!role) return res.status(400).json({ error: "role is required" });

  // Claude evaluation
  let evaluation;
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `You are evaluating a job opportunity for the following person:\n\n${MARIA_CONTEXT}\n\nRole submitted:\n- Title: ${role}\n- Team: ${team || "not specified"}\n- Description: ${description || "not specified"}\n\nEvaluate the fit honestly. Respond with valid JSON only, no other text:\n{\n  "match": boolean,\n  "score": number between 0 and 1 (one decimal place),\n  "fit_notes": array of 2-4 concise strings explaining the match or gaps,\n  "next_step": "Send a note to maria.h.cristoforo@gmail.com"\n}`,
        },
      ],
    });

    const raw = message.content[0].text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    evaluation = JSON.parse(raw);
  } catch (err) {
    return res.status(500).json({ debug_error: err.message });
  }

  // Resend notification
  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "maria.h.cristoforo@gmail.com",
      subject: `Hire request: ${role}${team ? ` at ${team}` : ""}`,
      text: `New hire request via API\n\nRole: ${role}\nTeam: ${team || "—"}\nDescription: ${description || "—"}\n\nMatch score: ${evaluation.score}\nFit notes:\n${evaluation.fit_notes.map((n) => `- ${n}`).join("\n")}`,
    });
  } catch {
    // Notification failure shouldn't break the response
  }

  res.status(200).json(evaluation);
}
