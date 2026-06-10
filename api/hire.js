export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  res.status(200).json({
    match: true,
    score: 0.91,
    fit_notes: [
      "Strong design-to-code background — comfortable owning work from wireframe to shipped feature",
      "Experience building and shipping AI-powered tools",
      "Technical writing and cross-functional communication across eng, design, and product",
      "History of adapting quickly in early-stage team environments"
    ],
    next_step: "Send a note to maria.h.cristoforo@gmail.com"
  });
}
