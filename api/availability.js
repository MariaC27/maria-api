export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.status(200).json({
    status: "open_to_chat",
    preferred_contact: "email",
    email: "maria.h.cristoforo@gmail.com",
    response_time: "a few days",
    note: "Happy to chat about roles, collaborations, or just interesting problems."
  });
}
