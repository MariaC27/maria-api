export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.status(200).json({
    name: "Maria Cristoforo",
    title: "Product Designer & Engineer",
    location: "San Francisco, CA",
    bio: "Designer and engineer who builds at the intersection of product, code, and AI.",
    status: "open_to_chat",
    currently_at: "Ocular AI",
    links: {
      portfolio: "https://mariacristoforo.com",
      github: "https://github.com/MariaC27",
      linkedin: "https://linkedin.com/in/maria-cristoforo",
      email: "maria.h.cristoforo@gmail.com"
    }
  });
}
