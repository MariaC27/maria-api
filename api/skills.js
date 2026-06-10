const skills = [
  { id: "typescript", category: "development", proficiency: "active", years_experience: 3, last_used: "now" },
  { id: "javascript", category: "development", proficiency: "fluent", years_experience: 5, last_used: "2024" },
  { id: "react", category: "development", proficiency: "active", years_experience: 3, last_used: "now" },
  { id: "nextjs", category: "development", proficiency: "active", years_experience: 2, last_used: "now" },
  { id: "tailwind", category: "development", proficiency: "active", years_experience: 2, last_used: "now" },
  { id: "html-css", category: "development", proficiency: "active", years_experience: 6, last_used: "now" },
  { id: "python", category: "development", proficiency: "fluent", years_experience: 4, last_used: "2024" },
  { id: "java", category: "development", proficiency: "familiar", years_experience: 2, last_used: "2023" },
  { id: "figma", category: "design", proficiency: "fluent", years_experience: 4, last_used: "now" },
  { id: "ai-assisted-design", category: "design", proficiency: "active", years_experience: 2, last_used: "now" },
  { id: "ux-research", category: "design", proficiency: "active", years_experience: 3, last_used: "now" },
  { id: "cross-functional-collaboration", category: "workflows", proficiency: "active", years_experience: 4, last_used: "now" },
  { id: "design-to-code", category: "workflows", proficiency: "active", years_experience: 3, last_used: "now" },
  { id: "technical-writing", category: "workflows", proficiency: "active", years_experience: 3, last_used: "now" },
  { id: "customer-facing-communication", category: "workflows", proficiency: "active", years_experience: 3, last_used: "now" },
];

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { proficiency, category } = req.query;
  let data = skills;

  if (proficiency) data = data.filter(s => s.proficiency === proficiency);
  if (category) data = data.filter(s => s.category === category);

  res.status(200).json({ count: data.length, data });
}
