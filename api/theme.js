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

// Lines that look like bare gradient color stops (e.g. "#ea580c 0%," or "rgba(... 50%)")
const GRADIENT_STOP_RE = /^\s*(#[0-9a-f]{3,8}|rgba?\([^)]+\))\s*[\d.]+%/i;

function filterCss(css, ctaClasses = []) {
  const lines = css.split("\n");

  // Tier 1: CSS custom properties and :root / @font-face blocks (highest signal)
  const tier1 = lines.filter((line) => {
    if (GRADIENT_STOP_RE.test(line)) return false;
    return line.includes("--") || line.includes(":root") || line.includes("@font-face");
  });

  // Tier 2: font-family and border-radius declarations
  const tier2 = lines.filter((line) => {
    if (GRADIENT_STOP_RE.test(line)) return false;
    if (tier1.includes(line)) return false;
    return line.includes("font-family") || /border-radius\s*:/.test(line);
  });

  // Tier 3: color/background on CTA class selectors specifically (highest confidence for brand color)
  const ctaPattern = ctaClasses.length
    ? new RegExp(ctaClasses.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i")
    : null;
  const tier3 = lines.filter((line) => {
    if (GRADIENT_STOP_RE.test(line)) return false;
    if (tier1.includes(line) || tier2.includes(line)) return false;
    if (/linear-gradient|radial-gradient|conic-gradient/i.test(line)) return false;
    const COLOR_PROPERTY_RE = /^\s*(color|background-color|background|border-color|fill|stroke)\s*:/i;
    if (!COLOR_PROPERTY_RE.test(line)) return false;
    // Prefer lines near CTA class selectors if we have them
    if (ctaPattern) return ctaPattern.test(line);
    return true;
  });

  const combined = [...tier1, ...tier2, ...tier3];
  return combined.join("\n").slice(0, 8000);
}

// Extract non-trivial fill/stroke colors from SVG elements in HTML.
// Logos and icons almost always encode the brand color as a fill attribute directly in HTML.
function extractSvgColors(html) {
  const IGNORE = new Set(["none", "transparent", "currentcolor", "inherit", "white", "black", "#fff", "#000", "#ffffff", "#000000"]);
  const seen = new Set();
  const colors = [];

  for (const match of html.matchAll(/(?:fill|stroke)=["']([^"']+)["']/gi)) {
    const v = match[1].trim().toLowerCase();
    if (!IGNORE.has(v) && !seen.has(v) && (v.startsWith("#") || v.startsWith("rgb"))) {
      seen.add(v);
      colors.push(match[1].trim());
    }
  }
  return colors.slice(0, 20); // cap to avoid noise
}

// Find class names on <a> and <button> elements that suggest CTA / primary action.
// These are the highest-signal selectors for brand color.
function extractCtaClasses(html) {
  const candidates = new Set();
  for (const match of html.matchAll(/<(?:a|button)[^>]+class=["']([^"']+)["']/gi)) {
    for (const cls of match[1].split(/\s+/)) {
      if (/cta|btn|button|primary|action|hero|signup|get.?started|try|start/i.test(cls)) {
        candidates.add(cls);
      }
    }
  }
  return [...candidates].slice(0, 10);
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

  // Extract visual signals directly from HTML (no CSS needed)
  const svgColors = extractSvgColors(html);
  const ctaClasses = extractCtaClasses(html);

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
  const filteredCss = filterCss(allCss, ctaClasses);

  // Call Claude Haiku
  let tokens;
  try {
    const svgSection = svgColors.length
      ? `SVG fill/stroke colors found in page HTML (logos, icons — high confidence for brand color):\n${svgColors.join(", ")}`
      : "";

    const ctaSection = ctaClasses.length
      ? `CTA/button class names found on <a> and <button> elements: ${ctaClasses.join(", ")}`
      : "";

    const prompt = `You are extracting design tokens from a website to configure a documentation theme.

${fontHints.length ? `Google Fonts detected: ${[...new Set(fontHints)].join(", ")}` : ""}
${svgSection}
${ctaSection}

CSS (filtered — custom properties, font declarations, border-radius, and CTA-selector colors):
\`\`\`css
${filteredCss || "(no CSS extracted)"}
\`\`\`

Respond with valid JSON only, no markdown, no explanation:
{
  "colors": {
    "primary": "#hex",
    "primary_light": "#hex",
    "primary_dark": "#hex",
    "background_light": "#hex",
    "background_dark": "#hex"
  },
  "fonts": {
    "heading": "font name",
    "body": "font name",
    "mono": "font name"
  },
  "border_radius": "none | small | medium | large | pill"
}

Decision rules:
- PRIMARY = the color a human would immediately identify as the brand accent when skimming the page. Check in this priority order: (1) CSS custom properties like --color-primary, --brand, --accent; (2) SVG fill colors listed above — these often ARE the logo/icon color and therefore the brand color; (3) background-color on CTA button selectors. Do NOT pick colors that only appear in hero illustrations or animated backgrounds.
- BORDER_RADIUS: look at border-radius values on button/card selectors. "none"=0px sharp corners, "small"=2-4px, "medium"=6-8px, "large"=12-16px, "pill"=9999px/50%.
- If no font found, default to "Inter" / "Inter" / "JetBrains Mono".
- If no background found, default to "#ffffff" / "#111111".
- All colors must be valid 6-digit hex starting with #.`;

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

  const { colors, fonts, border_radius } = tokens;
  const primaryRgb = hexToRgb(colors.primary);

  const borderRadiusPx = { none: "0px", small: "4px", medium: "8px", large: "14px", pill: "9999px" }[border_radius] || "8px";

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
    style: {
      border_radius,
      border_radius_px: borderRadiusPx,
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
      style_css: `/* Add to style.css */\nbody { font-family: '${fonts.body}', sans-serif !important; }\nh1, h2, h3 { font-family: '${fonts.heading}', sans-serif !important; }\nbutton, .btn { border-radius: ${borderRadiusPx} !important; }`,
    },
  };

  // Resend notification (silent failure)
  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "maria.h.cristoforo@gmail.com",
      subject: `Theme extracted: ${parsedUrl.href}`,
      text: `Someone used the design system extractor!\n\nSource: ${parsedUrl.href}\n\nColors:\n- Primary: ${colors.primary}\n- Background light: ${colors.background_light}\n- Background dark: ${colors.background_dark}\n\nFonts:\n- Heading: ${fonts.heading}\n- Body: ${fonts.body}\n- Mono: ${fonts.mono}\n\nBorder radius: ${border_radius}`,
    });
  } catch {
    // Silent failure
  }

  res.status(200).json(response);
}
