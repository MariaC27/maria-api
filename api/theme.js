import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return `${r} ${g} ${b}`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

const CSS_FILTER_KEYWORDS = [":root", "--", "color", "font-family", "background", "@font-face"];

function filterCss(css) {
  const lines = css.split("\n");
  const kept = lines.filter((line) =>
    CSS_FILTER_KEYWORDS.some((kw) => line.includes(kw))
  );
  return kept.join("\n").slice(0, 8000);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "url is required" });

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  // Fetch the target page HTML
  let html;
  try {
    const pageRes = await fetchWithTimeout(parsedUrl.href, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DesignExtractor/1.0)" },
    });
    if (!pageRes.ok) {
      return res.status(400).json({ error: `Site returned ${pageRes.status}` });
    }
    html = await pageRes.text();
  } catch (err) {
    return res.status(400).json({ error: "Could not fetch URL", debug_error: err.message });
  }

  // Extract Google Fonts references from HTML
  const fontHints = [];
  const googleFontMatches = html.matchAll(/fonts\.googleapis\.com\/css[^"']*family=([^"'&]+)/g);
  for (const match of googleFontMatches) {
    const families = decodeURIComponent(match[1]).split("|").map((f) => f.split(":")[0].replace(/\+/g, " "));
    fontHints.push(...families);
  }

  // Extract stylesheet URLs from HTML (limit 3)
  const styleTagMatches = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)];
  const cssUrls = styleTagMatches
    .map((m) => {
      try {
        return new URL(m[1], parsedUrl.href).href;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .slice(0, 3);

  // Fetch stylesheets
  const cssTexts = await Promise.all(
    cssUrls.map(async (cssUrl) => {
      try {
        const r = await fetchWithTimeout(cssUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; DesignExtractor/1.0)" },
        }, 5000);
        if (!r.ok) return "";
        return await r.text();
      } catch {
        return "";
      }
    })
  );

  // Also pull inline <style> blocks
  const inlineStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);

  const allCss = [...cssTexts, ...inlineStyles].join("\n");
  const filteredCss = filterCss(allCss);

  // Call Claude Haiku
  let tokens;
  try {
    const prompt = `You are analyzing CSS from a website to extract its design tokens.

${fontHints.length ? `Google Fonts detected on page: ${[...new Set(fontHints)].join(", ")}` : ""}

CSS (filtered for relevant rules):
\`\`\`css
${filteredCss || "(no CSS extracted — infer reasonable defaults from the URL domain)"}
\`\`\`

Extract the design tokens and respond with valid JSON only, no markdown, no explanation:
{
  "colors": {
    "primary": "#hex — the main brand/accent color",
    "primary_light": "#hex — a lighter variant (10-15% lighter)",
    "primary_dark": "#hex — a darker variant (10-15% darker)",
    "background_light": "#hex — the light mode background",
    "background_dark": "#hex — the dark mode background"
  },
  "fonts": {
    "heading": "Font name for headings",
    "body": "Font name for body text",
    "mono": "Monospace font name"
  }
}

Rules:
- If no font is found, use "Inter" for heading/body and "JetBrains Mono" for mono
- If no background colors found, use "#ffffff" for light and "#111111" for dark
- All colors must be valid 6-digit hex codes starting with #
- Respond with JSON only, no code fences`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    tokens = JSON.parse(raw);
  } catch (err) {
    return res.status(500).json({ error: "Failed to extract tokens", debug_error: err.message });
  }

  const { colors, fonts } = tokens;
  const primaryRgb = hexToRgb(colors.primary);

  const response = {
    source_url: parsedUrl.href,
    colors: {
      primary: colors.primary,
      primary_light: colors.primary_light,
      primary_dark: colors.primary_dark,
      primary_rgb: primaryRgb || "",
      background_light: colors.background_light,
      background_dark: colors.background_dark,
    },
    fonts: {
      heading: fonts.heading,
      body: fonts.body,
      mono: fonts.mono,
    },
    mintlify_patch: {
      docs_json: {
        colors: {
          primary: colors.primary,
          light: colors.primary_light,
          dark: colors.primary_dark,
        },
        background: {
          color: {
            light: colors.background_light,
            dark: colors.background_dark,
          },
        },
      },
      style_css: `/* Add to style.css */\nbody { font-family: '${fonts.body}', sans-serif !important; }\nh1, h2, h3 { font-family: '${fonts.heading}', sans-serif !important; }`,
    },
  };

  // Resend notification (silent failure)
  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "maria.h.cristoforo@gmail.com",
      subject: `Theme extracted: ${parsedUrl.href}`,
      text: `Someone used the design system extractor!\n\nSource: ${parsedUrl.href}\n\nColors:\n- Primary: ${colors.primary}\n- Background light: ${colors.background_light}\n- Background dark: ${colors.background_dark}\n\nFonts:\n- Heading: ${fonts.heading}\n- Body: ${fonts.body}\n- Mono: ${fonts.mono}`,
    });
  } catch {
    // Silent failure
  }

  res.status(200).json(response);
}
