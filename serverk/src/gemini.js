export class GeminiError extends Error {
  constructor(message) {
    super(message);
    this.name = "GeminiError";
  }
}

function normalizeGeminiModelName(model, fallback) {
  const trimmed = (model || "").trim();
  const effective = trimmed || fallback;
  if (!effective) return "models/gemini-3-pro-image-preview";
  if (effective.startsWith("models/") || effective.startsWith("tunedModels/")) return effective;
  return `models/${effective}`;
}

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function pickResponseJsonText(result) {
  const parts = (((result?.candidates ?? [])[0]?.content ?? {})?.parts ?? []);
  const texts = [];
  for (const part of parts) {
    if (typeof part?.text === "string" && part.text.trim()) texts.push(part.text);
  }
  return texts.join("\n").trim();
}

function pickResponseInlineImage(result) {
  const parts = (((result?.candidates ?? [])[0]?.content ?? {})?.parts ?? []);
  for (const part of parts) {
    const inline = part?.inline_data ?? part?.inlineData;
    if (inline?.data) {
      return {
        mimeType: (inline?.mime_type ?? inline?.mimeType ?? "image/png").toString(),
        data: inline.data.toString(),
      };
    }
  }
  return null;
}

async function fetchJsonWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function generateText(opts) {
  const apiKey = (opts.apiKey || "").trim();
  if (!apiKey) throw new GeminiError("Missing API key.");

  const modelName = normalizeGeminiModelName(opts.model, "gemini-3-flash-preview");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent`;
  const url = `${endpoint}?${new URLSearchParams({ key: apiKey }).toString()}`;

  const parts = [{ text: opts.promptText }];
  for (const img of opts.images ?? []) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: bytesToBase64(img.data),
      },
    });
  }

  const payload = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.2,
      ...(typeof opts.maxOutputTokens === "number" ? { maxOutputTokens: opts.maxOutputTokens } : {}),
    },
  };

  const resp = await fetchJsonWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    typeof opts.timeoutMs === "number" ? opts.timeoutMs : 120000,
  );

  const rawBody = await resp.text();
  if (!resp.ok) {
    throw new GeminiError(`Gemini API error (${resp.status}): ${rawBody.slice(0, 500)}`);
  }

  let json;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new GeminiError("Gemini API returned non-JSON response.");
  }

  const text = pickResponseJsonText(json);
  if (!text) throw new GeminiError("Gemini API did not return text.");
  return { text, raw: json };
}

const PROMPT_QUALITY_MARKER = "Photo quality requirements:";
const PROMPT_PHOTOSHOOT_QUALITY_BLOCK = [
  "Photo quality requirements:",
  "- Output resolution: 1080x1440 pixels (3:4 portrait).",
  "- Photorealistic, high-resolution, ultra-sharp detail, crisp focus (no motion blur).",
  "- Professional high-end fashion/product photoshoot look (studio-grade lighting, clean color, high dynamic range).",
  "- Accurate textures (skin/fabric), natural shadows, realistic perspective and depth.",
  "- Shot on a high-end camera with a premium lens; clean, natural bokeh where applicable.",
  "- Composition: keep the main subject large and fully in frame; avoid extreme wide shots with a tiny subject.",
  "- Color and finish: balanced exposure, medium contrast, gentle highlight roll-off; natural skin tones; no crushed blacks or blown highlights.",
  "- Detail: preserve natural skin texture (no plastic/over-smoothed retouching); enhance fabric micro-contrast so seams/weave/print read clearly.",
  "- Avoid: low-res, blurry, noise, compression artifacts, over-smoothing/plastic look, CGI/cartoon look.",
].join("\n");

function enhanceImagePrompt(promptText) {
  const trimmed = (promptText || "").trim();
  if (!trimmed) return PROMPT_PHOTOSHOOT_QUALITY_BLOCK;
  if (trimmed.includes(PROMPT_QUALITY_MARKER)) return trimmed;
  return `${trimmed}\n\n${PROMPT_PHOTOSHOOT_QUALITY_BLOCK}`;
}

export async function generateImage(opts) {
  const apiKey = (opts.apiKey || "").trim();
  if (!apiKey) throw new GeminiError("Missing API key.");

  const modelName = normalizeGeminiModelName(opts.model, "gemini-3-pro-image-preview");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent`;
  const url = `${endpoint}?${new URLSearchParams({ key: apiKey }).toString()}`;

  const parts = [{ text: enhanceImagePrompt(opts.promptText) }];
  for (const img of opts.images ?? []) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: bytesToBase64(img.data),
      },
    });
  }

  const payloadBase = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.2,
      responseModalities: ["IMAGE"],
      ...((opts.aspectRatio || opts.width || opts.height)
        ? {
            imageConfig: {
              ...(opts.aspectRatio ? { aspectRatio: opts.aspectRatio } : {}),
              ...(typeof opts.width === "number" ? { width: Math.round(opts.width) } : {}),
              ...(typeof opts.height === "number" ? { height: Math.round(opts.height) } : {}),
            },
          }
        : {}),
    },
  };

  async function post(payload) {
    const resp = await fetchJsonWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      typeof opts.timeoutMs === "number" ? opts.timeoutMs : 180000,
    );

    const rawBody = await resp.text();
    if (!resp.ok) {
      throw new GeminiError(`Gemini API error (${resp.status}): ${rawBody.slice(0, 500)}`);
    }

    try {
      return JSON.parse(rawBody);
    } catch {
      throw new GeminiError("Gemini API returned non-JSON response.");
    }
  }

  let json;
  try {
    json = await post(payloadBase);
  } catch (err) {
    const msg = String(err?.message || err);
    const requestedImageConfig = Boolean(opts.aspectRatio || opts.width || opts.height);
    const looksLikeUnknownField =
      requestedImageConfig &&
      (msg.includes("Unknown name")
        || msg.includes("unknown field")
        || msg.includes("Invalid JSON payload")
        || msg.includes("imageConfig")
        || msg.includes("aspectRatio")
        || msg.includes("width")
        || msg.includes("height"));
    if (!looksLikeUnknownField) throw err;

    const payloadFallback = {
      ...payloadBase,
      generationConfig: {
        ...payloadBase.generationConfig,
      },
    };
    delete payloadFallback.generationConfig.imageConfig;
    json = await post(payloadFallback);
  }

  const inline = pickResponseInlineImage(json);
  if (!inline) {
    const responseText = pickResponseJsonText(json);
    const detail = (responseText || "").trim();
    throw new GeminiError(
      `Gemini API did not return an image.${detail ? ` Response text: ${detail.slice(0, 500)}` : ""}`,
    );
  }
  return { mimeType: inline.mimeType, imageBase64: inline.data, raw: json };
}

export function extractJsonObject(text) {
  let src = (text || "").trim();
  if (!src) throw new GeminiError("Empty response.");

  if (src.includes("```")) {
    const lines = src.split(/\r?\n/g);
    const chunks = [];
    let inFence = false;
    for (const line of lines) {
      if (line.trim().startsWith("```")) {
        inFence = !inFence;
        continue;
      }
      if (inFence) chunks.push(line);
    }
    const candidate = chunks.join("\n").trim();
    if (candidate) src = candidate;
  }

  const start = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new GeminiError("No JSON object found.");
  }
  try {
    return JSON.parse(src.slice(start, end + 1));
  } catch {
    throw new GeminiError("Failed to parse JSON.");
  }
}
