const work = [
  {
    id: "apilens",
    title: "ApiLens",
    description: "A versioning + visual diffs system for OpenAPI endpoint documentation.",
    url: "https://mariacristoforo.com/work/apilens",
    tags: ["developer-tools", "python", "open-source"]
  },
  {
    id: "canvas-annotation-revamp",
    title: "Canvas & Annotation Revamp",
    description: "Redesign of an annotation canvas for image data labeling at scale.",
    url: "https://mariacristoforo.com/work/canvas-annotation-revamp",
    tags: ["product-design", "ux-research", "data-annotation"]
  },
  {
    id: "turn-based-audio-annotation",
    title: "Turn-Based Audio Annotation",
    description: "New annotation workflow for multi-speaker audio data.",
    url: "https://mariacristoforo.com/work/turn-based-audio-annotation",
    tags: ["product-design", "audio", "data-annotation", "design-to-code"]
  }
];

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.status(200).json({ count: work.length, data: work });
}
