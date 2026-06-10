export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.status(200).json({
    status: "open_to_chat",
    windows: [
      { days: "Monday–Friday", hours: "12–1pm PT" },
      { days: "Monday–Friday", hours: "after 5pm PT" }
    ],
    preferred_contact: "email",
    email: "maria.h.cristoforo@gmail.com",
    response_time: "asap, usually within a few days",
    note: "Happy to chat about roles, collaborations, or just interesting problems."
  });
}
